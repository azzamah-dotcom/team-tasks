#!/usr/bin/env python3
"""Team Tasks — a task tracker for team leaders and their team members.

Zero dependencies: Python 3.9+ standard library only (http.server + sqlite3).
Run:  python3 server.py      then open http://127.0.0.1:8000
"""
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import traceback
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
STATIC = (BASE / "static").resolve()
DB_PATH = Path(os.environ.get("TEAM_TASKS_DB", BASE / "data" / "team_tasks.db"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
SECURE_COOKIES = os.environ.get("SECURE_COOKIES") == "1"
# When set, new team leaders must enter this code to sign up (recommended when hosted publicly).
LEADER_SIGNUP_CODE = os.environ.get("LEADER_SIGNUP_CODE", "").strip()
COOKIE = "tt_session"
SESSION_DAYS = 400       # browsers cap cookie lifetime at about 400 days
SESSION_RENEW_DAYS = 1   # renew the session at most once a day while it's in use
PBKDF2_ITERATIONS = 200_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
  leader_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  can_lead INTEGER NOT NULL DEFAULT 0,  -- a member who also leads their own team (sub-leader)
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  leader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  done_at TEXT,
  created_at TEXT NOT NULL,
  parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE  -- set when cascaded from a leader's task
);
CREATE INDEX IF NOT EXISTS idx_users_leader ON users(leader_id);
CREATE INDEX IF NOT EXISTS idx_tasks_leader ON tasks(leader_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
"""


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------- helpers ----------

def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_iso():
    return iso(datetime.now(timezone.utc))


def parse_deadline(value):
    if not isinstance(value, str) or not value.strip():
        raise ApiError(400, "A deadline is required.")
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        raise ApiError(400, "The deadline must be a valid date and time.")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return iso(dt)


def text(data, key, required=True, max_len=200):
    value = data.get(key, "")
    if not isinstance(value, str):
        raise ApiError(400, f"{key} must be text.")
    value = value.strip()
    if required and not value:
        raise ApiError(400, f"{key.replace('_', ' ').capitalize()} is required.")
    if len(value) > max_len:
        raise ApiError(400, f"{key.replace('_', ' ').capitalize()} is too long.")
    return value


def valid_email(data):
    email = text(data, "email").lower()
    if not EMAIL_RE.match(email):
        raise ApiError(400, "Enter a valid email address.")
    return email


def valid_password(data, key="password"):
    pw = data.get(key, "")
    if not isinstance(pw, str) or len(pw) < 6:
        raise ApiError(400, "Password must be at least 6 characters.")
    if len(pw) > 200:
        raise ApiError(400, "Password is too long.")
    return pw


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def check_password(password, stored):
    try:
        _, iterations, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(row, conn=None):
    user = {"id": row["id"], "name": row["name"], "email": row["email"],
            "role": row["role"], "leader_id": row["leader_id"], "can_lead": can_lead(row)}
    if conn is not None and row["leader_id"]:
        leader = conn.execute("SELECT name FROM users WHERE id = ?", (row["leader_id"],)).fetchone()
        user["leader_name"] = leader["name"] if leader else None
    return user


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


MIGRATIONS = [
    ("users", "can_lead", "ALTER TABLE users ADD COLUMN can_lead INTEGER NOT NULL DEFAULT 0"),
    ("tasks", "parent_id", "ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE"),
]


def migrate(conn):
    """Add columns that older databases don't have yet, after taking a backup copy."""
    pending = [sql for table, column, sql in MIGRATIONS
               if column not in {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}]
    if pending:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        backup_path = DB_PATH.with_name(f"{DB_PATH.stem}.backup-{stamp}{DB_PATH.suffix}")
        backup = sqlite3.connect(backup_path)
        conn.backup(backup)
        backup.close()
        print(f"Database backed up to {backup_path} before upgrading.")
        for sql in pending:
            conn.execute(sql)
        conn.commit()
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)")


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = db()
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA)
    migrate(conn)
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now_iso(),))
    conn.commit()
    conn.close()


# ---------- API endpoints ----------
# Each takes (handler, conn, *url_groups) and returns (status, payload).

def start_session(h, conn, user_id):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    conn.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                 (hash_token(token), user_id, iso(expires)))
    h.set_cookie(token, SESSION_DAYS * 86400)


def api_config(h, conn):
    return 200, {"signup_code_required": bool(LEADER_SIGNUP_CODE)}


def api_signup(h, conn):
    data = h.read_json()
    if LEADER_SIGNUP_CODE:
        code = str(data.get("invite_code", "")).strip()
        if not hmac.compare_digest(code.encode(), LEADER_SIGNUP_CODE.encode()):
            raise ApiError(403, "That invite code isn't right. Ask the app owner for the team leader invite code.")
    name = text(data, "name", max_len=80)
    email = valid_email(data)
    password = valid_password(data)
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise ApiError(409, "An account with this email already exists.")
    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'leader', ?)",
        (name, email, hash_password(password), now_iso()))
    start_session(h, conn, cur.lastrowid)
    user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return 201, {"user": public_user(user, conn)}


def api_login(h, conn):
    data = h.read_json()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not check_password(password, user["password_hash"]):
        raise ApiError(401, "Wrong email or password.")
    start_session(h, conn, user["id"])
    return 200, {"user": public_user(user, conn)}


def api_logout(h, conn):
    token = h.session_token()
    if token:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))
    h.set_cookie("", 0)
    return 200, {"ok": True}


def api_me(h, conn):
    return 200, {"user": public_user(h.current_user(conn), conn)}


def can_lead(user):
    """Top-level leaders and sub-leaders both manage a team."""
    return user["role"] == "leader" or bool(user["can_lead"])


def require_leader(h, conn):
    user = h.current_user(conn)
    if not can_lead(user):
        raise ApiError(403, "Only team leaders can do this.")
    return user


def own_member(conn, leader, member_id):
    member = conn.execute("SELECT * FROM users WHERE id = ? AND leader_id = ? AND role = 'member'",
                          (int(member_id), leader["id"])).fetchone()
    if not member:
        raise ApiError(404, "Team member not found.")
    return member


def api_members_list(h, conn):
    leader = require_leader(h, conn)
    rows = conn.execute("""
        SELECT u.id, u.name, u.email, u.can_lead,
          (SELECT COUNT(*) FROM users sub WHERE sub.leader_id = u.id) AS team_size,
          SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_count,
          SUM(CASE WHEN t.status = 'open' AND t.due_at < ? THEN 1 ELSE 0 END) AS overdue_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count
        FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
        WHERE u.leader_id = ? AND u.role = 'member'
        GROUP BY u.id ORDER BY u.name COLLATE NOCASE
    """, (now_iso(), leader["id"])).fetchall()
    members = [{**dict(r), "can_lead": bool(r["can_lead"]), "open_count": r["open_count"] or 0, "overdue_count": r["overdue_count"] or 0,
                "done_count": r["done_count"] or 0} for r in rows]
    return 200, {"members": members}


def api_members_create(h, conn):
    leader = require_leader(h, conn)
    data = h.read_json()
    name = text(data, "name", max_len=80)
    email = valid_email(data)
    password = valid_password(data)
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise ApiError(409, "An account with this email already exists.")
    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, role, leader_id, created_at) "
        "VALUES (?, ?, ?, 'member', ?, ?)",
        (name, email, hash_password(password), leader["id"], now_iso()))
    return 201, {"member": {"id": cur.lastrowid, "name": name, "email": email}}


def api_members_update(h, conn, member_id):
    leader = require_leader(h, conn)
    member = own_member(conn, leader, member_id)
    data = h.read_json()
    if "name" in data:
        conn.execute("UPDATE users SET name = ? WHERE id = ?", (text(data, "name", max_len=80), member["id"]))
    if "password" in data:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                     (hash_password(valid_password(data)), member["id"]))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (member["id"],))
    if "can_lead" in data:
        make_lead = bool(data["can_lead"])
        if not make_lead and conn.execute("SELECT 1 FROM users WHERE leader_id = ?", (member["id"],)).fetchone():
            raise ApiError(409, f"{member['name']} still leads a team. They need to remove their team members first.")
        conn.execute("UPDATE users SET can_lead = ? WHERE id = ?", (int(make_lead), member["id"]))
    return 200, {"ok": True}


def api_members_delete(h, conn, member_id):
    leader = require_leader(h, conn)
    member = own_member(conn, leader, member_id)
    # Tasks this member cascaded from someone else's task: re-check those parents once they're gone.
    parents = [r["parent_id"] for r in conn.execute(
        "SELECT DISTINCT parent_id FROM tasks WHERE parent_id IS NOT NULL AND (assignee_id = ? OR leader_id = ?)",
        (member["id"], member["id"]))]
    conn.execute("DELETE FROM users WHERE id = ?", (member["id"],))  # cascades to their team, tasks, sessions
    for parent_id in parents:
        refresh_parent(conn, parent_id)
    return 200, {"ok": True}


TASK_SELECT = """
    SELECT t.*, a.name AS assignee_name, l.name AS leader_name FROM tasks t
    JOIN users a ON a.id = t.assignee_id
    JOIN users l ON l.id = t.leader_id
"""


def refresh_parent(conn, parent_id):
    """A cascaded (parent) task is done exactly when all of its cascaded copies are done.

    Walks up the chain, so completing the last task at the bottom completes every level above.
    """
    while parent_id:
        parent = conn.execute("SELECT id, status, parent_id FROM tasks WHERE id = ?", (parent_id,)).fetchone()
        if not parent:
            return
        total, done = conn.execute(
            "SELECT COUNT(*), SUM(status = 'done') FROM tasks WHERE parent_id = ?", (parent_id,)).fetchone()
        if total:
            status = "done" if done == total else "open"
            if status != parent["status"]:
                conn.execute("UPDATE tasks SET status = ?, done_at = ? WHERE id = ?",
                             (status, now_iso() if status == "done" else None, parent_id))
        parent_id = parent["parent_id"]


def with_children(conn, tasks):
    """Attach each task's cascaded copies (who has it and whether it's done)."""
    by_id = {t["id"]: {**dict(t), "children": []} for t in tasks}
    if by_id:
        marks = ",".join("?" * len(by_id))
        rows = conn.execute(
            f"SELECT c.id, c.parent_id, c.assignee_id, c.status, c.due_at, a.name AS assignee_name "
            f"FROM tasks c JOIN users a ON a.id = c.assignee_id WHERE c.parent_id IN ({marks}) "
            f"ORDER BY a.name COLLATE NOCASE", list(by_id)).fetchall()
        for r in rows:
            by_id[r["parent_id"]]["children"].append(dict(r))
    return list(by_id.values())


def check_assignee(conn, leader, value):
    try:
        assignee_id = int(value)
    except (TypeError, ValueError):
        raise ApiError(400, "Choose who the task is for.")
    if assignee_id == leader["id"]:
        return assignee_id
    own_member(conn, leader, assignee_id)
    return assignee_id


def check_priority(value):
    if value not in ("low", "normal", "high"):
        raise ApiError(400, "Priority must be low, normal or high.")
    return value


def api_tasks_list(h, conn):
    user = h.current_user(conn)
    # Tasks I gave out plus tasks given to me (a sub-leader has both).
    rows = conn.execute(TASK_SELECT + " WHERE t.leader_id = ? OR t.assignee_id = ? ORDER BY t.due_at",
                        (user["id"], user["id"])).fetchall()
    return 200, {"tasks": with_children(conn, rows)}


def api_tasks_create(h, conn):
    leader = require_leader(h, conn)
    data = h.read_json()
    title = text(data, "title", max_len=140)
    description = text(data, "description", required=False, max_len=2000)
    assignee_id = check_assignee(conn, leader, data.get("assignee_id"))
    due_at = parse_deadline(data.get("due_at"))
    priority = check_priority(data.get("priority", "normal"))
    cur = conn.execute(
        "INSERT INTO tasks (leader_id, assignee_id, title, description, priority, due_at, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (leader["id"], assignee_id, title, description, priority, due_at, now_iso()))
    task = conn.execute(TASK_SELECT + " WHERE t.id = ?", (cur.lastrowid,)).fetchone()
    return 201, {"task": with_children(conn, [task])[0]}


def api_tasks_update(h, conn, task_id):
    user = h.current_user(conn)
    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (int(task_id),)).fetchone()
    is_creator = task and task["leader_id"] == user["id"]
    is_assignee = task and task["assignee_id"] == user["id"]
    if not task or not (is_creator or is_assignee):
        raise ApiError(404, "Task not found.")
    has_children = conn.execute("SELECT 1 FROM tasks WHERE parent_id = ?", (task["id"],)).fetchone() is not None
    data = h.read_json()
    updates = {}

    if "status" in data:
        if data["status"] not in ("open", "done"):
            raise ApiError(400, "Status must be open or done.")
        if data["status"] != task["status"]:
            if has_children:
                raise ApiError(409, "This task was cascaded to a team. It completes by itself when all of "
                                    "their copies are done.")
            updates["status"] = data["status"]
            updates["done_at"] = now_iso() if data["status"] == "done" else None

    detail_fields = {"title", "description", "assignee_id", "due_at", "priority"} & data.keys()
    if detail_fields and not is_creator:
        raise ApiError(403, "Only the person who assigned this task can change its details.")
    if "title" in data:
        updates["title"] = text(data, "title", max_len=140)
    if "description" in data:
        updates["description"] = text(data, "description", required=False, max_len=2000)
    if "assignee_id" in data:
        assignee_id = check_assignee(conn, user, data["assignee_id"])
        if assignee_id != task["assignee_id"] and has_children:
            raise ApiError(409, "This task has already been cascaded to a team, so it can't be reassigned. "
                                "Delete it and assign a new one instead.")
        updates["assignee_id"] = assignee_id
    if "due_at" in data:
        updates["due_at"] = check_child_deadline(conn, task["parent_id"], parse_deadline(data["due_at"]))
    if "priority" in data:
        updates["priority"] = check_priority(data["priority"])

    if updates:
        assignments = ", ".join(f"{col} = ?" for col in updates)
        conn.execute(f"UPDATE tasks SET {assignments} WHERE id = ?", (*updates.values(), task["id"]))
    if "status" in updates:
        refresh_parent(conn, task["parent_id"])
    row = conn.execute(TASK_SELECT + " WHERE t.id = ?", (task["id"],)).fetchone()
    return 200, {"task": with_children(conn, [row])[0]}


def check_child_deadline(conn, parent_id, due_at):
    """A cascaded copy can't be due later than the task it came from."""
    if parent_id:
        parent = conn.execute("SELECT due_at FROM tasks WHERE id = ?", (parent_id,)).fetchone()
        if parent and due_at > parent["due_at"]:
            raise ApiError(400, "The deadline can't be later than the original task's deadline.")
    return due_at


def api_tasks_delete(h, conn, task_id):
    user = h.current_user(conn)
    task = conn.execute("SELECT id, parent_id FROM tasks WHERE id = ? AND leader_id = ?",
                        (int(task_id), user["id"])).fetchone()
    if not task:
        raise ApiError(404, "Task not found.")
    conn.execute("DELETE FROM tasks WHERE id = ?", (task["id"],))  # also deletes its cascaded copies
    refresh_parent(conn, task["parent_id"])
    return 200, {"ok": True}


def api_tasks_cascade(h, conn, task_id):
    """A sub-leader passes a task they received down to chosen members of their own team."""
    user = require_leader(h, conn)
    task = conn.execute("SELECT * FROM tasks WHERE id = ? AND assignee_id = ?",
                        (int(task_id), user["id"])).fetchone()
    if not task:
        raise ApiError(404, "Task not found.")
    data = h.read_json()
    ids = data.get("assignee_ids")
    if not isinstance(ids, list) or not ids:
        raise ApiError(400, "Choose at least one team member.")
    due_at = task["due_at"]
    if data.get("due_at"):
        due_at = check_child_deadline(conn, task["id"], parse_deadline(data["due_at"]))
    already = {r["assignee_id"] for r in conn.execute(
        "SELECT assignee_id FROM tasks WHERE parent_id = ?", (task["id"],))}
    created = 0
    for raw_id in dict.fromkeys(ids):
        try:
            member = own_member(conn, user, int(raw_id))
        except (TypeError, ValueError):
            raise ApiError(400, "Choose people from your own team.")
        if member["id"] in already:
            continue
        conn.execute(
            "INSERT INTO tasks (leader_id, assignee_id, title, description, priority, due_at, created_at, parent_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user["id"], member["id"], task["title"], task["description"], task["priority"], due_at,
             now_iso(), task["id"]))
        created += 1
    refresh_parent(conn, task["id"])
    row = conn.execute(TASK_SELECT + " WHERE t.id = ?", (task["id"],)).fetchone()
    return 201, {"created": created, "skipped": len(dict.fromkeys(ids)) - created,
                 "task": with_children(conn, [row])[0]}


ROUTES = [
    ("GET", r"/api/config", api_config),
    ("POST", r"/api/signup", api_signup),
    ("POST", r"/api/login", api_login),
    ("POST", r"/api/logout", api_logout),
    ("GET", r"/api/me", api_me),
    ("GET", r"/api/members", api_members_list),
    ("POST", r"/api/members", api_members_create),
    ("PATCH", r"/api/members/(\d+)", api_members_update),
    ("DELETE", r"/api/members/(\d+)", api_members_delete),
    ("GET", r"/api/tasks", api_tasks_list),
    ("POST", r"/api/tasks", api_tasks_create),
    ("PATCH", r"/api/tasks/(\d+)", api_tasks_update),
    ("DELETE", r"/api/tasks/(\d+)", api_tasks_delete),
    ("POST", r"/api/tasks/(\d+)/cascade", api_tasks_cascade),
]


# ---------- HTTP handler ----------

class Handler(BaseHTTPRequestHandler):
    server_version = "TeamTasks/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PATCH(self):
        self.dispatch("PATCH")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        self.extra_headers = []
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.handle_api(method, path)
        elif method == "GET":
            self.serve_static(path)
        else:
            self.send_json(405, {"error": "Method not allowed."})

    def handle_api(self, method, path):
        for route_method, pattern, fn in ROUTES:
            match = re.fullmatch(pattern, path)
            if route_method != method or not match:
                continue
            conn = db()
            try:
                with conn:
                    status, payload = fn(self, conn, *match.groups())
                self.send_json(status, payload)
            except ApiError as e:
                self.send_json(e.status, {"error": e.message})
            except Exception:
                traceback.print_exc()
                self.send_json(500, {"error": "Something went wrong on the server."})
            finally:
                conn.close()
            return
        self.send_json(404, {"error": "Not found."})

    # --- request helpers ---
    def read_json(self):
        # Requiring a JSON content type blocks cross-site form posts (CSRF).
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise ApiError(415, "Expected a JSON request.")
        length = int(self.headers.get("Content-Length") or 0)
        if length > 100_000:
            raise ApiError(413, "Request is too large.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            raise ApiError(400, "Invalid JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "Invalid JSON.")
        return data

    def session_token(self):
        try:
            jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        except cookies.CookieError:
            return None
        return jar[COOKIE].value if COOKIE in jar else None

    def current_user(self, conn):
        token = self.session_token()
        if token:
            token_hash = hash_token(token)
            row = conn.execute(
                "SELECT u.*, s.expires_at AS session_expires FROM sessions s JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?", (token_hash, now_iso())).fetchone()
            if row:
                # Sliding session: whenever the app is used, push the expiry out again so
                # people stay signed in until they choose "Sign out".
                renew_after = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS - SESSION_RENEW_DAYS)
                if row["session_expires"] < iso(renew_after):
                    new_expiry = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
                    conn.execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?",
                                 (iso(new_expiry), token_hash))
                    self.set_cookie(token, SESSION_DAYS * 86400)
                return row
        raise ApiError(401, "Please sign in.")

    def set_cookie(self, value, max_age):
        parts = [f"{COOKIE}={value}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={max_age}"]
        if SECURE_COOKIES:
            parts.append("Secure")
        self.extra_headers.append(("Set-Cookie", "; ".join(parts)))

    # --- responses ---
    def common_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
        for key, value in self.extra_headers:
            self.send_header(key, value)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.common_headers()
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        target = (STATIC / path.lstrip("/")).resolve()
        if STATIC not in target.parents or not target.is_file():
            self.send_json(404, {"error": "Not found."})
            return
        body = target.read_bytes()
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.common_headers()
        self.end_headers()
        self.wfile.write(body)


def apply_env_password_reset():
    """One-time password reset from env vars, for a leader locked out of a hosted instance.

    Set RESET_ACCOUNT_EMAIL and RESET_ACCOUNT_PASSWORD, restart, sign in, then delete both.
    """
    email = os.environ.get("RESET_ACCOUNT_EMAIL", "").strip().lower()
    password = os.environ.get("RESET_ACCOUNT_PASSWORD", "")
    if not email and not password:
        return
    if not email or len(password) < 6:
        print("Password reset skipped: set RESET_ACCOUNT_EMAIL and a RESET_ACCOUNT_PASSWORD "
              "of at least 6 characters.")
        return
    conn = db()
    try:
        user = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            print(f"Password reset skipped: no account with the email {email}.")
        elif check_password(password, user["password_hash"]):
            print(f"Password for {email} is already set from RESET_ACCOUNT_PASSWORD. "
                  "Delete RESET_ACCOUNT_EMAIL and RESET_ACCOUNT_PASSWORD from your variables.")
        else:
            with conn:
                conn.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                             (hash_password(password), user["id"]))
                conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
            print(f"Password reset for {email}. Sign in, then delete RESET_ACCOUNT_EMAIL and "
                  "RESET_ACCOUNT_PASSWORD from your variables.")
    finally:
        conn.close()


def main():
    mimetypes.add_type("application/javascript", ".js")
    init_db()
    apply_env_password_reset()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Team Tasks running at http://{HOST}:{PORT}  (database: {DB_PATH})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

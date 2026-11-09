#!/usr/bin/env python3
"""Team Tasks — a task tracker for team leaders and their team members.

Zero dependencies: Python 3.9+ standard library only (http.server + sqlite3).
Run:  python3 server.py      then open http://127.0.0.1:8000
"""
import base64
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
  parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,  -- set when cascaded from a leader's task
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- last person to change the details
  updated_at TEXT
);
-- Gifts & giveaways stock. Each team leader owns one private stock list.
CREATE TABLE IF NOT EXISTS stock_locations (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
-- Team members the owner assigned to fill in a location's stock.
CREATE TABLE IF NOT EXISTS stock_editors (
  location_id INTEGER NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, user_id)
);
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'giveaway' CHECK (category IN ('gift', 'giveaway')),
  notes TEXT NOT NULL DEFAULT '',
  min_qty INTEGER NOT NULL DEFAULT 0,      -- flag as low stock at or below this total (0 = off)
  photo BLOB,
  photo_mime TEXT,
  photo_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS stock_levels (
  item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT,
  PRIMARY KEY (item_id, location_id)
);
CREATE TABLE IF NOT EXISTS stock_history (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  old_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  at TEXT NOT NULL
);
-- Read-only link the owner can give their manager.
CREATE TABLE IF NOT EXISTS stock_shares (
  owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_loc_owner ON stock_locations(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_owner ON stock_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_editors_user ON stock_editors(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_item ON stock_history(item_id);
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
    ("tasks", "updated_by", "ALTER TABLE tasks ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL"),
    ("tasks", "updated_at", "ALTER TABLE tasks ADD COLUMN updated_at TEXT"),
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
    user = h.current_user(conn)
    payload = public_user(user, conn)
    # Leaders keep a stock list; members see it only for the locations they were assigned to fill in.
    payload["stock_access"] = can_lead(user) or conn.execute(
        "SELECT 1 FROM stock_editors WHERE user_id = ?", (user["id"],)).fetchone() is not None
    return 200, {"user": payload}


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
    SELECT t.*, a.name AS assignee_name, l.name AS leader_name, e.name AS updated_by_name FROM tasks t
    JOIN users a ON a.id = t.assignee_id
    JOIN users l ON l.id = t.leader_id
    LEFT JOIN users e ON e.id = t.updated_by
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

    # Both the person who assigned the task and the person doing it can edit its details.
    # Only the assigner can hand it to someone else (or delete it).
    if "assignee_id" in data and not is_creator and str(data["assignee_id"]) != str(task["assignee_id"]):
        raise ApiError(403, "Only the person who assigned this task can give it to someone else.")
    if "title" in data:
        updates["title"] = text(data, "title", max_len=140)
    if "description" in data:
        updates["description"] = text(data, "description", required=False, max_len=2000)
    if "assignee_id" in data and is_creator:
        assignee_id = check_assignee(conn, user, data["assignee_id"])
        if assignee_id != task["assignee_id"] and has_children:
            raise ApiError(409, "This task has already been cascaded to a team, so it can't be reassigned. "
                                "Delete it and assign a new one instead.")
        updates["assignee_id"] = assignee_id
    if "due_at" in data:
        updates["due_at"] = check_child_deadline(conn, task["parent_id"], parse_deadline(data["due_at"]))
    if "priority" in data:
        updates["priority"] = check_priority(data["priority"])

    # Record who last changed the details, but only when something actually changed.
    detail_cols = {"title", "description", "assignee_id", "due_at", "priority"}
    if any(col in detail_cols and updates[col] != task[col] for col in updates):
        updates["updated_by"] = user["id"]
        updates["updated_at"] = now_iso()

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


# ---------- gifts & giveaways stock ----------
# Every team leader owns one private stock list. They choose which of their team members
# fill in each location, and can hand their manager a read-only link.

DEFAULT_LOCATIONS = ["HQ Store", "Yadaodeh Store", "Marketing Store", "Marketing Office"]
CATEGORIES = ("gift", "giveaway")
MAX_QTY = 1_000_000
MAX_PHOTO_BYTES = 3_000_000
PHOTO_TYPES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"RIFF": "image/webp"}


def stock_role(conn, user, owner_id):
    """Returns (is_owner, ids of locations this user may edit). 404 if they have no access."""
    owner_id = int(owner_id)
    if owner_id == user["id"] and can_lead(user):
        ids = {r["id"] for r in conn.execute("SELECT id FROM stock_locations WHERE owner_id = ?", (owner_id,))}
        return True, ids
    ids = {r["id"] for r in conn.execute(
        "SELECT l.id FROM stock_editors e JOIN stock_locations l ON l.id = e.location_id "
        "WHERE e.user_id = ? AND l.owner_id = ?", (user["id"], owner_id))}
    if not ids:
        raise ApiError(404, "Stock list not found.")
    return False, ids


def seed_locations(conn, owner_id):
    has_any = conn.execute("SELECT 1 FROM stock_locations WHERE owner_id = ? UNION ALL "
                           "SELECT 1 FROM stock_items WHERE owner_id = ? LIMIT 1", (owner_id, owner_id)).fetchone()
    if not has_any:
        for i, name in enumerate(DEFAULT_LOCATIONS):
            conn.execute("INSERT INTO stock_locations (owner_id, name, sort, created_at) VALUES (?, ?, ?, ?)",
                         (owner_id, name, i, now_iso()))


def build_stock(conn, owner, visible_ids=None, is_owner=False):
    """The stock list as JSON. visible_ids limits it to some locations (None = all)."""
    locations = [dict(r) for r in conn.execute(
        "SELECT id, name FROM stock_locations WHERE owner_id = ? ORDER BY sort, id", (owner["id"],))]
    if visible_ids is not None:
        locations = [l for l in locations if l["id"] in visible_ids]
    shown = {l["id"] for l in locations}
    if is_owner:
        for loc in locations:
            loc["editor_ids"] = [r["user_id"] for r in conn.execute(
                "SELECT user_id FROM stock_editors WHERE location_id = ?", (loc["id"],))]
    items = {}
    for r in conn.execute("""
        SELECT i.id, i.name, i.category, i.notes, i.min_qty, i.photo_version, i.created_at,
               i.photo IS NOT NULL AS has_photo, i.updated_at, u.name AS updated_by_name
        FROM stock_items i LEFT JOIN users u ON u.id = i.updated_by
        WHERE i.owner_id = ? ORDER BY i.name COLLATE NOCASE""", (owner["id"],)):
        items[r["id"]] = {**dict(r), "has_photo": bool(r["has_photo"]), "qty": {}}
    for r in conn.execute("""
        SELECT s.item_id, s.location_id, s.qty, s.updated_at, u.name AS updated_by_name
        FROM stock_levels s JOIN stock_items i ON i.id = s.item_id LEFT JOIN users u ON u.id = s.updated_by
        WHERE i.owner_id = ?""", (owner["id"],)):
        item = items.get(r["item_id"])
        if not item or r["location_id"] not in shown:
            continue
        item["qty"][str(r["location_id"])] = r["qty"]
        # Show the most recent change the viewer is allowed to see.
        if r["updated_at"] and (not item["updated_at"] or r["updated_at"] > item["updated_at"]):
            item["updated_at"], item["updated_by_name"] = r["updated_at"], r["updated_by_name"]
    return {"owner_id": owner["id"], "owner_name": owner["name"], "is_owner": is_owner,
            "locations": locations, "items": list(items.values())}


def api_stock(h, conn):
    user = h.current_user(conn)
    lists = []
    if can_lead(user):
        seed_locations(conn, user["id"])
        mine = build_stock(conn, user, is_owner=True)
        share = conn.execute("SELECT token FROM stock_shares WHERE owner_id = ?", (user["id"],)).fetchone()
        mine["share_token"] = share["token"] if share else None
        mine["editable_ids"] = [l["id"] for l in mine["locations"]]
        lists.append(mine)
    owners = conn.execute("""
        SELECT DISTINCT u.* FROM stock_editors e JOIN stock_locations l ON l.id = e.location_id
        JOIN users u ON u.id = l.owner_id WHERE e.user_id = ? AND u.id != ?""", (user["id"], user["id"])).fetchall()
    for owner in owners:
        _, ids = stock_role(conn, user, owner["id"])
        lst = build_stock(conn, owner, visible_ids=ids)
        lst["editable_ids"] = sorted(ids)
        lists.append(lst)
    return 200, {"lists": lists}


def owned_location(conn, user, location_id):
    if not can_lead(user):
        raise ApiError(403, "Only team leaders can change locations.")
    loc = conn.execute("SELECT * FROM stock_locations WHERE id = ? AND owner_id = ?",
                       (int(location_id), user["id"])).fetchone()
    if not loc:
        raise ApiError(404, "Location not found.")
    return loc


def set_editors(conn, leader, location_id, editor_ids):
    if not isinstance(editor_ids, list):
        raise ApiError(400, "Choose team members from the list.")
    conn.execute("DELETE FROM stock_editors WHERE location_id = ?", (location_id,))
    for raw in dict.fromkeys(editor_ids):
        try:
            member = own_member(conn, leader, int(raw))
        except (TypeError, ValueError):
            raise ApiError(400, "Choose team members from the list.")
        conn.execute("INSERT INTO stock_editors (location_id, user_id) VALUES (?, ?)", (location_id, member["id"]))


def api_stock_location_create(h, conn):
    leader = require_leader(h, conn)
    data = h.read_json()
    name = text(data, "name", max_len=80)
    sort = conn.execute("SELECT COALESCE(MAX(sort), -1) + 1 FROM stock_locations WHERE owner_id = ?",
                        (leader["id"],)).fetchone()[0]
    cur = conn.execute("INSERT INTO stock_locations (owner_id, name, sort, created_at) VALUES (?, ?, ?, ?)",
                       (leader["id"], name, sort, now_iso()))
    if "editor_ids" in data:
        set_editors(conn, leader, cur.lastrowid, data["editor_ids"])
    return 201, {"id": cur.lastrowid}


def api_stock_location_update(h, conn, location_id):
    leader = h.current_user(conn)
    loc = owned_location(conn, leader, location_id)
    data = h.read_json()
    if "name" in data:
        conn.execute("UPDATE stock_locations SET name = ? WHERE id = ?", (text(data, "name", max_len=80), loc["id"]))
    if "editor_ids" in data:
        set_editors(conn, leader, loc["id"], data["editor_ids"])
    return 200, {"ok": True}


def api_stock_location_delete(h, conn, location_id):
    loc = owned_location(conn, h.current_user(conn), location_id)
    if conn.execute("SELECT 1 FROM stock_levels WHERE location_id = ? AND qty > 0", (loc["id"],)).fetchone():
        raise ApiError(409, f"{loc['name']} still has stock. Set its quantities to 0 first, or rename it instead.")
    conn.execute("DELETE FROM stock_locations WHERE id = ?", (loc["id"],))
    return 200, {"ok": True}


def decode_photo(value):
    if not isinstance(value, str) or "," not in value:
        raise ApiError(400, "That photo couldn't be read. Try a JPG or PNG.")
    try:
        raw = base64.b64decode(value.split(",", 1)[1], validate=True)
    except (ValueError, base64.binascii.Error):
        raise ApiError(400, "That photo couldn't be read. Try a JPG or PNG.")
    if len(raw) > MAX_PHOTO_BYTES:
        raise ApiError(413, "That photo is too large.")
    for magic, mime in PHOTO_TYPES.items():
        if raw.startswith(magic) and (mime != "image/webp" or raw[8:12] == b"WEBP"):
            return raw, mime
    raise ApiError(400, "Photos must be JPG, PNG or WebP.")


def int_field(value, label, low=0, high=MAX_QTY):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ApiError(400, f"{label} must be a whole number.")
    if isinstance(value, float) and value != n or not low <= n <= high:
        raise ApiError(400, f"{label} must be between {low} and {high:,}.")
    return n


def save_levels(conn, user, item_id, editable_ids, qty):
    """Apply {location_id: qty} and record each change in the history."""
    if not isinstance(qty, dict):
        raise ApiError(400, "Quantities are invalid.")
    for raw_loc, raw_n in qty.items():
        try:
            loc_id = int(raw_loc)
        except (TypeError, ValueError):
            raise ApiError(400, "Quantities are invalid.")
        if loc_id not in editable_ids:
            raise ApiError(403, "You can only update the locations you're assigned to.")
        n = int_field(raw_n, "Quantity")
        row = conn.execute("SELECT qty FROM stock_levels WHERE item_id = ? AND location_id = ?",
                           (item_id, loc_id)).fetchone()
        old = row["qty"] if row else 0
        if row and old == n:
            continue
        if not row and n == 0:
            continue
        conn.execute("""INSERT INTO stock_levels (item_id, location_id, qty, updated_by, updated_at)
                        VALUES (?, ?, ?, ?, ?) ON CONFLICT (item_id, location_id)
                        DO UPDATE SET qty = excluded.qty, updated_by = excluded.updated_by,
                                      updated_at = excluded.updated_at""",
                     (item_id, loc_id, n, user["id"], now_iso()))
        conn.execute("INSERT INTO stock_history (item_id, location_id, old_qty, new_qty, user_name, at) "
                     "VALUES (?, ?, ?, ?, ?, ?)", (item_id, loc_id, old, n, user["name"], now_iso()))


def item_fields(data, partial):
    fields = {}
    if not partial or "name" in data:
        fields["name"] = text(data, "name", max_len=120)
    if not partial or "category" in data:
        cat = data.get("category", "giveaway")
        if cat not in CATEGORIES:
            raise ApiError(400, "Type must be gift or giveaway.")
        fields["category"] = cat
    if not partial or "notes" in data:
        fields["notes"] = text(data, "notes", required=False, max_len=1000)
    if not partial or "min_qty" in data:
        fields["min_qty"] = int_field(data.get("min_qty", 0) or 0, "Low stock alert")
    return fields


def api_stock_item_create(h, conn):
    user = h.current_user(conn)
    data = h.read_json(max_bytes=5_000_000)
    owner_id = data.get("owner_id", user["id"])
    _, editable = stock_role(conn, user, owner_id)
    fields = item_fields(data, partial=False)
    photo, mime = decode_photo(data["photo"]) if data.get("photo") else (None, None)
    cur = conn.execute(
        "INSERT INTO stock_items (owner_id, name, category, notes, min_qty, photo, photo_mime, photo_version, "
        "created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (int(owner_id), fields["name"], fields["category"], fields["notes"], fields["min_qty"],
         photo, mime, 1 if photo else 0, now_iso(), user["id"], now_iso()))
    save_levels(conn, user, cur.lastrowid, editable, data.get("qty") or {})
    return 201, {"id": cur.lastrowid}


def stock_item(conn, user, item_id):
    item = conn.execute("SELECT id, owner_id, name, category, notes, min_qty, photo_version FROM stock_items "
                        "WHERE id = ?", (int(item_id),)).fetchone()
    if not item:
        raise ApiError(404, "Item not found.")
    try:
        is_owner, editable = stock_role(conn, user, item["owner_id"])
    except ApiError:
        raise ApiError(404, "Item not found.")
    return item, is_owner, editable


def api_stock_item_update(h, conn, item_id):
    user = h.current_user(conn)
    item, is_owner, editable = stock_item(conn, user, item_id)
    data = h.read_json(max_bytes=5_000_000)
    if not is_owner:
        data.pop("min_qty", None)  # the low stock alert is the owner's setting
    updates ={k: v for k, v in item_fields(data, partial=True).items() if v != item[k]}
    if data.get("photo"):
        updates["photo"], updates["photo_mime"] = decode_photo(data["photo"])
        updates["photo_version"] = item["photo_version"] + 1
    elif data.get("remove_photo"):
        updates.update(photo=None, photo_mime=None, photo_version=item["photo_version"] + 1)
    if updates:
        updates.update(updated_by=user["id"], updated_at=now_iso())
        assignments = ", ".join(f"{col} = ?" for col in updates)
        conn.execute(f"UPDATE stock_items SET {assignments} WHERE id = ?", (*updates.values(), item["id"]))
    if "qty" in data:
        save_levels(conn, user, item["id"], editable, data["qty"])
    return 200, {"ok": True}


def api_stock_item_delete(h, conn, item_id):
    user = h.current_user(conn)
    item, is_owner, _ = stock_item(conn, user, item_id)
    if not is_owner:
        raise ApiError(403, "Only the list owner can delete items.")
    conn.execute("DELETE FROM stock_items WHERE id = ?", (item["id"],))
    return 200, {"ok": True}


def api_stock_item_history(h, conn, item_id):
    user = h.current_user(conn)
    item, _, editable = stock_item(conn, user, item_id)
    marks = ",".join("?" * len(editable)) or "NULL"
    rows = conn.execute(
        f"SELECT h.old_qty, h.new_qty, h.user_name, h.at, l.name AS location_name FROM stock_history h "
        f"JOIN stock_locations l ON l.id = h.location_id WHERE h.item_id = ? AND h.location_id IN ({marks}) "
        f"ORDER BY h.id DESC LIMIT 30", (item["id"], *editable)).fetchall()
    return 200, {"history": [dict(r) for r in rows]}


def send_photo(h, conn, owner_id, item_id):
    row = conn.execute("SELECT photo, photo_mime FROM stock_items WHERE id = ? AND owner_id = ?",
                       (int(item_id), owner_id)).fetchone()
    if not row or row["photo"] is None:
        raise ApiError(404, "No photo.")
    return "bytes", (row["photo"], row["photo_mime"])


def api_stock_item_photo(h, conn, item_id):
    user = h.current_user(conn)
    item, _, _ = stock_item(conn, user, item_id)
    return send_photo(h, conn, item["owner_id"], item["id"])


def api_stock_share(h, conn):
    """Turn the manager's read-only link on (a fresh link each time) or off."""
    leader = require_leader(h, conn)
    data = h.read_json()
    conn.execute("DELETE FROM stock_shares WHERE owner_id = ?", (leader["id"],))
    token = None
    if data.get("enabled"):
        token = secrets.token_urlsafe(24)
        conn.execute("INSERT INTO stock_shares (owner_id, token, created_at) VALUES (?, ?, ?)",
                     (leader["id"], token, now_iso()))
    return 200, {"share_token": token}


def shared_owner(conn, token):
    row = conn.execute("SELECT u.* FROM stock_shares s JOIN users u ON u.id = s.owner_id WHERE s.token = ?",
                       (token,)).fetchone()
    if not row:
        raise ApiError(404, "This link was turned off or replaced. Ask for a new one.")
    return row


def api_stock_shared(h, conn, token):
    return 200, {"list": build_stock(conn, shared_owner(conn, token))}


def api_stock_shared_photo(h, conn, token, item_id):
    return send_photo(h, conn, shared_owner(conn, token)["id"], item_id)


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
    ("GET", r"/api/stock", api_stock),
    ("POST", r"/api/stock/locations", api_stock_location_create),
    ("PATCH", r"/api/stock/locations/(\d+)", api_stock_location_update),
    ("DELETE", r"/api/stock/locations/(\d+)", api_stock_location_delete),
    ("POST", r"/api/stock/items", api_stock_item_create),
    ("PATCH", r"/api/stock/items/(\d+)", api_stock_item_update),
    ("DELETE", r"/api/stock/items/(\d+)", api_stock_item_delete),
    ("GET", r"/api/stock/items/(\d+)/history", api_stock_item_history),
    ("GET", r"/api/stock/items/(\d+)/photo", api_stock_item_photo),
    ("POST", r"/api/stock/share", api_stock_share),
    ("GET", r"/api/stock/shared/([\w-]{20,64})", api_stock_shared),
    ("GET", r"/api/stock/shared/([\w-]{20,64})/items/(\d+)/photo", api_stock_shared_photo),
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
                if status == "bytes":
                    self.send_bytes(*payload)
                else:
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
    def read_json(self, max_bytes=100_000):
        # Requiring a JSON content type blocks cross-site form posts (CSRF).
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise ApiError(415, "Expected a JSON request.")
        length = int(self.headers.get("Content-Length") or 0)
        if length > max_bytes:
            raise ApiError(413, "Request is too large. Try a smaller photo." if max_bytes > 100_000
                           else "Request is too large.")
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

    def send_bytes(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Photo URLs carry ?v=<version>, so a changed photo gets a new URL.
        self.send_header("Cache-Control", "private, max-age=86400")
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

#!/usr/bin/env python3
"""Reset any Team Tasks account's password (for a team leader who forgot theirs).

Run it where the database lives, e.g. in Railway's service Console:
    python reset_password.py
It asks for the account email and a new password (typing is hidden).
"""
import getpass
import sqlite3
import sys

from server import DB_PATH, EMAIL_RE, hash_password


def main():
    if not DB_PATH.exists():
        sys.exit(f"No database found at {DB_PATH}.")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    email = input("Account email: ").strip().lower()
    if not EMAIL_RE.match(email):
        sys.exit("That doesn't look like an email address.")
    user = conn.execute("SELECT id, name, role FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        sys.exit(f"No account with the email {email}.")

    password = getpass.getpass("New password (at least 6 characters, hidden): ")
    if len(password) < 6:
        sys.exit("Password must be at least 6 characters. Nothing was changed.")
    if getpass.getpass("Type it again: ") != password:
        sys.exit("The passwords didn't match. Nothing was changed.")

    with conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user[0]))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user[0],))  # sign out old sessions
    print(f"Password updated for {user[1]} ({user[2]}). You can sign in now.")


if __name__ == "__main__":
    main()

import sqlite3
import os

db_path = 'c:/Users/Eu/Documents/Laudos/laudos.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Table Info ---")
cursor.execute("PRAGMA table_info(users)")
for row in cursor.fetchall():
    print(row)

print("\n--- All Users ---")
cursor.execute("SELECT id, username, role, full_name, is_active FROM users")
for row in cursor.fetchall():
    print(row)

print("\n--- Create Statement ---")
cursor.execute("SELECT sql FROM sqlite_master WHERE name='users'")
print(cursor.fetchone()[0])

conn.close()

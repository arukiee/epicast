import sqlite3

def check_users():
    conn = sqlite3.connect('epicast.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, role, status, password_setup_token FROM users")
    print("--- Users ---")
    for u in cursor.fetchall():
        print(u)
    conn.close()

if __name__ == '__main__':
    check_users()

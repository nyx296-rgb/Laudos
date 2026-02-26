import sqlite3
import bcrypt

conn = sqlite3.connect('laudos.db')
cursor = conn.cursor()

# Criar hash da nova senha
new_pwd = 'admin123'
pwd_hash = bcrypt.hashpw(new_pwd.encode(), bcrypt.gensalt()).decode()

# Atualizar senha do admin
cursor.execute('UPDATE users SET password = ? WHERE username = ?', (pwd_hash, 'admin'))
conn.commit()

print(f"✓ Senha 'admin123' definida para usuário 'admin'")
conn.close()

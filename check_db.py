import sqlite3

conn = sqlite3.connect('c:/Users/Eu/Documents/Laudos/laudos.db')
cursor = conn.cursor()
cursor.execute('SELECT id, id_laudo, unidade, setor, data FROM laudos ORDER BY id ASC LIMIT 50')
rows = cursor.fetchall()
for row in rows:
    print(f"ID: {row[0]} | Laudo: {row[1]} | Unidade: {row[2]} | Setor: {row[3]} | Data: {row[4]}")
conn.close()

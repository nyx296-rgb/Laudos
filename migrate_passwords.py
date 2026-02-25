#!/usr/bin/env python3
"""
SCRIPT DE MIGRAÇÃO DE SEGURANÇA
Migra senhas em texto plano de versões antigas para bcrypt hash
Execute uma única vez após atualizar o código.
"""

import sqlite3
import bcrypt
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'laudos.db')

def migrate_passwords():
    """Migra senhas em texto plano para formato bcrypt."""
    if not os.path.exists(DB_PATH):
        print("❌ Banco de dados não encontrado!")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Buscar todos os usuários
        cursor.execute('SELECT id, username, password FROM users')
        users = cursor.fetchall()
        
        migrated = 0
        for user_id, username, password_stored in users:
            # Verificar se já é um hash bcrypt (começa com $2b$ ou $2a$)
            if password_stored.startswith(('$2b$', '$2a$', '$2y$')):
                print(f"✓ {username}: já está com bcrypt")
                continue
            
            # Converter para bcrypt
            try:
                password_hash = bcrypt.hashpw(password_stored.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                cursor.execute('UPDATE users SET password = ? WHERE id = ?', (password_hash, user_id))
                print(f"✓ {username}: migrado para bcrypt")
                migrated += 1
            except Exception as e:
                print(f"❌ {username}: erro ao migrar - {e}")
        
        conn.commit()
        print(f"\n✅ Migração concluída! {migrated} usuários atualizados.")
        return True
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    print("════════════════════════════════════════════════════════════════")
    print("MIGRAÇÃO DE SENHAS - DE TEXTO PLANO PARA BCRYPT")
    print("════════════════════════════════════════════════════════════════")
    print()
    
    response = input("Deseja continuar com a migração de senhas? (sim/não): ").strip().lower()
    if response in ['sim', 's', 'yes', 'y']:
        migrate_passwords()
    else:
        print("Migração cancelada.")

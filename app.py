import os
import shutil
import json
import sqlite3
import re
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template, session, redirect, url_for

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = 'laudo-secret-key-123'  # Simple key for sessions

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, 'cod_tasy.json')
DB_PATH = os.path.join(BASE_DIR, 'laudos.db')
PDF_STORAGE = os.path.join(BASE_DIR, 'static', 'laudos')
LEGACY_DIR = os.path.join(BASE_DIR, 'Laudos antigos')
NETWORK_PATH_DEFAULT = r'//SERVIDOR/Laudos' # Default if not in DB

if not os.path.exists(PDF_STORAGE):
    os.makedirs(PDF_STORAGE)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Table for users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    # Table for laudos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS laudos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_laudo TEXT NOT NULL,
            data TEXT NOT NULL,
            unidade TEXT,
            setor TEXT,
            local TEXT,
            nome_analista TEXT,
            descricao_problema TEXT,
            marca TEXT,
            modelo TEXT,
            serie TEXT,
            situacao TEXT,
            item_defeito TEXT,
            cargo_analista TEXT,
            itens_count INTEGER,
            is_test INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute("PRAGMA table_info(laudos)")
    columns = [row[1] for row in cursor.fetchall()]
    new_cols = [
        ('marca', 'TEXT'), 
        ('modelo', 'TEXT'), 
        ('serie', 'TEXT'), 
        ('situacao', 'TEXT'),
        ('item_defeito', 'TEXT'),
        ('cargo_analista', 'TEXT'),
        ('is_test', 'INTEGER DEFAULT 0'),
        ('tipo', 'TEXT DEFAULT "laudo"')
    ]
    for col_name, col_type in new_cols:
        if col_name not in columns:
            cursor.execute(f"ALTER TABLE laudos ADD COLUMN {col_name} {col_type}")
    cursor.execute('SELECT * FROM users WHERE username = "admin"')
    if not cursor.fetchone():
        cursor.execute('INSERT INTO users (username, password) VALUES ("admin", "admin123")')
    
    # Table for settings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    # Table for options
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            value TEXT NOT NULL,
            extra TEXT
        )
    ''')
    
    # Initialize default network path if not exists
    cursor.execute('SELECT * FROM settings WHERE key = "network_path"')
    if not cursor.fetchone():
        cursor.execute('INSERT INTO settings (key, value) VALUES ("network_path", ?)', (NETWORK_PATH_DEFAULT,))

    # Seed default options if empty
    cursor.execute('SELECT COUNT(*) FROM options')
    if cursor.fetchone()[0] == 0:
        defaults = {
            "unidades": [
                "Operadora", "CG24h", "CG Ambulatório", "Centro Pediátrico",
                "Medicina Preventiva", "WorkMed", "Centro Médico Bangu",
                "Centro Médico Sulacap", "Vila Nova", "Centro Social Bangu",
                "Quality Gold", "CETI", "CT - Areia Branca", "ITCM",
                "CM Seropédica", "HGSC", "Bangu"
            ],
            "setores": [
                "Administrativo", "Atendimento", "Auditoria", "Cadastro",
                "Call Center", "Cobrança", "Comercial PJ", "Compras",
                "Contabilidade", "Contas Médicas", "Controladoria",
                "Credenciamento", "DEREG - OPME - Auditoria", "Diretoria",
                "Enfermagem", "Faturamento", "Fidelização", "Financeiro",
                "Juridico", "Manutenção", "Patrimônio", "Presidência",
                "Recuperação de Produtos", "Recursos Humanos",
                "Relacionamento Empresarial", "TI"
            ],
            "locais": ["Campo Grande", "Bangu", "Sulacap", "Santa Cruz", "Itaguaí", "Seropédica"],
            "analistas": [
                {"nome": "Marcus Vinicius de Oliveira", "cargo": "Analista de TI"},
                {"nome": "Tulio Maravilha", "cargo": "Analista de TI"},
                {"nome": "Kevin Vanucci", "cargo": "Gestor de TI"},
                {"nome": "Jonathan Villas Boas", "cargo": "Assistente de TI"},
                {"nome": "Romayne de Arruda Matos", "cargo": "Analista de TI"}
            ],
            "marcas": ["Dell", "HP", "Lenovo", "Unifi", "Jabra", "Ubiquiti", "Logitech", "Kingston", "Avaya", "Samsung", "LG"],
            "modelos": ["OPTIPLEX 3070", "OPTIPLEX 3020", "PRODESK 400 G5", "Latitude 3420", "MK120", "A400 SATA III", "U7-pro", "Precison 3551", "Vostro 3470", "G3 3500"],
            "itens": ["Placa mãe", "Processador", "Memória", "Disco (HD/SSD)", "Fonte", "Placa de Rede", "Monitor", "Teclado", "Mouse", "Nobreak", "Estabilizador", "Switch", "Telefone", "Impressora", "Câmera", "Office", "Acess Point / Unifi", "Adaptadores", "Headsets", "Computador", "SSD"],
            "cargos": ["Assistente de TI", "Analista de TI", "Gestor de TI", "Gerente de TI", "Técnico Responsável", "Coordenador de Infraestrutura"]
        }
        for cat, vals in defaults.items():
            for v in vals:
                # v can be a string or a dict (for analistas)
                val = v.get('nome') if isinstance(v, dict) else v
                
                # Check if item already exists in this category
                cursor.execute('SELECT 1 FROM options WHERE category = ? AND value = ?', (cat, val))
                if not cursor.fetchone():
                    if isinstance(v, dict):
                        # For analistas
                        cursor.execute('INSERT INTO options (category, value, extra) VALUES (?, ?, ?)',
                                       (cat, val, json.dumps({'cargo': v.get('cargo')})))
                    else:
                        cursor.execute('INSERT INTO options (category, value) VALUES (?, ?)', (cat, v))

    conn.commit()
    conn.close()

init_db()

def load_tasy_data():
    """Load all tasy codes from the JSON file."""
    if not os.path.exists(JSON_PATH):
        print(f"Aviso: {JSON_PATH} não encontrado.")
        return []
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

# Pre-load data on startup
try:
    TASY_DATA_CACHE = load_tasy_data()
except Exception:
    TASY_DATA_CACHE = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = data.get('username')
    pw = data.get('password')
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ? AND password = ?', (user, pw))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        session['user_id'] = row[0]
        session['username'] = row[1]
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Usuário ou senha inválidos'}), 401

@app.route('/api/next-laudo-num')
def next_laudo_num():
    year = datetime.now().year
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Find the highest number for the current year
    # id_laudo format: XXX/YYYY
    cursor.execute("SELECT id_laudo FROM laudos WHERE id_laudo LIKE ?", (f'%/{year}',))
    rows = cursor.fetchall()
    conn.close()
    
    max_num = 0
    for (id_str,) in rows:
        try:
            num = int(id_str.split('/')[0])
            if num > max_num:
                max_num = num
        except (ValueError, IndexError):
            continue
            
    next_num = f"{max_num + 1:03d}"
    return jsonify({'success': True, 'next_id': f"{next_num}/{year}"})

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/tasy')
def get_tasy():
    return jsonify({'success': True, 'data': TASY_DATA_CACHE})

@app.route('/api/gerar-laudo', methods=['POST'])
def gerar_laudo():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Dados não recebidos'}), 400
        
        # Save to DB
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO laudos (id_laudo, data, unidade, setor, local, nome_analista, descricao_problema, marca, modelo, serie, situacao, item_defeito, cargo_analista, itens_count, is_test, tipo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('id_laudo'),
            data.get('data'),
            data.get('unidade'),
            data.get('setor'),
            data.get('local'),
            data.get('nome_analista'),
            data.get('descricao_problema'),
            data.get('marca'),
            data.get('modelo'),
            data.get('serie'),
            data.get('situacao'),
            data.get('item_defeito'),
            data.get('cargo_analista'),
            len(data.get('equipamentos', [])),
            1 if data.get('is_test') else 0,
            data.get('tipo', 'laudo')
        ))
        conn.commit()
        conn.close()

        # Add logged in user info to data for the template
        data['preenchido_por'] = session.get('username', 'Sistema')

        from laudo_generator import generate_laudo
        output_path, temp_dir = generate_laudo(data)
        
        laudo_id = data.get('id_laudo', 'laudo').replace("/", "_")
        persistent_filename = f'Laudo_{laudo_id}.pdf'
        persistent_path = os.path.join(PDF_STORAGE, persistent_filename)
        
        # Save a persistent copy locally
        shutil.copy2(output_path, persistent_path)
        
        # Attempt network copy
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = "network_path"')
            row = cursor.fetchone()
            conn.close()
            
            network_path = row[0] if row else NETWORK_PATH_DEFAULT
            
            if network_path and os.path.exists(network_path):
                shutil.copy2(output_path, os.path.join(network_path, persistent_filename))
        except Exception as net_err:
            print(f"Erro ao copiar para rede: {net_err}")

        filename = os.path.basename(output_path)
        is_pdf = filename.endswith('.pdf')
        
        mime_type = 'application/pdf' if is_pdf else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        download_name = f'Laudo_{laudo_id.replace("/", "_")}.{"pdf" if is_pdf else "docx"}'
        
        response = send_file(
            output_path,
            mimetype=mime_type,
            as_attachment=True,
            download_name=download_name
        )
        
        @response.call_on_close
        def cleanup():
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        return response
    
    except Exception as e:
        import traceback
        return jsonify({'success': False, 'error': str(e), 'trace': traceback.format_exc()}), 500

@app.route('/api/stats')
def get_stats():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Total laudos
    cursor.execute('SELECT COUNT(*) FROM laudos WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" AND tipo = "laudo"')
    total_laudos = cursor.fetchone()[0]

    # Total requests
    cursor.execute('SELECT COUNT(*) FROM laudos WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" AND tipo = "compra"')
    total_compras = cursor.fetchone()[0]
    
    # Stats by Unit (Top 5 for chart)
    cursor.execute('SELECT unidade, COUNT(*) FROM laudos WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" GROUP BY unidade ORDER BY COUNT(*) DESC')
    unidades = cursor.fetchall()
    
    # Stats by Item (Top 5 for chart)
    cursor.execute('SELECT item_defeito, COUNT(*) FROM laudos WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" AND item_defeito IS NOT NULL AND item_defeito != "" GROUP BY item_defeito ORDER BY COUNT(*) DESC LIMIT 5')
    itens = cursor.fetchall()
    
    # Recent laudos
    cursor.execute('SELECT id_laudo, data, unidade, setor, is_test, tipo FROM laudos WHERE id_laudo NOT LIKE "IMP-%" ORDER BY timestamp DESC LIMIT 10')
    recent = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        'success': True,
        'total': total_laudos,
        'total_compras': total_compras,
        'unidades': unidades,
        'itens': itens,
        'recent': recent
    })

@app.route('/api/laudos', methods=['GET'])
def get_laudos():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    tipo = request.args.get('tipo')
    if tipo:
        cursor.execute('SELECT * FROM laudos WHERE id_laudo NOT LIKE "IMP-%" AND tipo = ? ORDER BY timestamp DESC', (tipo,))
    else:
        cursor.execute('SELECT * FROM laudos WHERE id_laudo NOT LIKE "IMP-%" ORDER BY timestamp DESC')
        
    columns = [description[0] for description in cursor.description]
    rows = cursor.fetchall()
    conn.close()
    
    laudos = []
    for row in rows:
        laudos.append(dict(zip(columns, row)))
        
    return jsonify({'success': True, 'data': laudos})

@app.route('/api/laudos/<int:id>', methods=['DELETE'])
def delete_laudo(id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM laudos WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/laudos/<int:id>/toggle-test', methods=['POST'])
def toggle_test(id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE laudos SET is_test = 1 - is_test WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/reports/incidences')
def get_incidence_report():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Incidences of item_defeito by unidade
    cursor.execute('''
        SELECT item_defeito, unidade, COUNT(*) as count 
        FROM laudos 
        WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" AND item_defeito IS NOT NULL AND item_defeito != ""
        GROUP BY item_defeito, unidade 
        ORDER BY count DESC
    ''')
    incidences = cursor.fetchall()
    
    # Problems summary
    cursor.execute('''
        SELECT item_defeito, COUNT(*) as count 
        FROM laudos 
        WHERE is_test = 0 AND id_laudo NOT LIKE "IMP-%" AND item_defeito IS NOT NULL AND item_defeito != ""
        GROUP BY item_defeito 
        ORDER BY count DESC 
        LIMIT 10
    ''')
    problem_items = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        'success': True,
        'incidences': incidences,
        'problem_items': problem_items
    })

@app.route('/api/view-pdf/<path:filename>')
def view_pdf(filename):
    # 1. Primary storage check
    pdf_path = os.path.join(PDF_STORAGE, filename)
    if os.path.exists(pdf_path):
        return send_file(pdf_path, mimetype='application/pdf')
    
    # 2. Legacy fallback for imported records (IMP-XXX)
    # Expected filename from frontend: Laudo_IMP-035_2025.pdf
    match = re.search(r'Laudo_IMP-(\d+)', filename)
    if match:
        number_str = match.group(1)
        number_int = int(number_str)
        legacy_dir = os.path.join(BASE_DIR, 'Laudos antigos')
        
        if os.path.exists(legacy_dir):
            # Filenames in legacy folder: "Laudo 35 - ..."
            # We search for a file starting with "Laudo {number} " or "Laudo {number_with_leading_zero} "
            for f in os.listdir(legacy_dir):
                if f.lower().endswith('.pdf'):
                    # Match "Laudo 35 " or "Laudo 035 "
                    if f.startswith(f"Laudo {number_int} ") or f.startswith(f"Laudo {number_str} "):
                        return send_file(os.path.join(legacy_dir, f), mimetype='application/pdf')
    
    return "Arquivo não encontrado", 404

# --- Legacy PDF Management ---

@app.route('/api/legacy-pdfs', methods=['GET'])
def list_legacy_pdfs():
    """Lists all PDFs in the 'Laudos antigos' folder."""
    if not os.path.exists(LEGACY_DIR):
        return jsonify({'success': True, 'files': []})
    
    files = []
    for f in sorted(os.listdir(LEGACY_DIR)):
        if f.lower().endswith('.pdf'):
            fpath = os.path.join(LEGACY_DIR, f)
            size = os.path.getsize(fpath)
            files.append({'name': f, 'size': size})
    
    return jsonify({'success': True, 'files': files})

@app.route('/api/legacy-pdfs/<path:filename>', methods=['DELETE'])
def delete_legacy_pdf(filename):
    """Permanently deletes a PDF from the 'Laudos antigos' folder."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    # Security: ensure no path traversal
    safe_name = os.path.basename(filename)
    fpath = os.path.join(LEGACY_DIR, safe_name)
    
    if not os.path.exists(fpath):
        return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404
    
    os.remove(fpath)
    return jsonify({'success': True})

@app.route('/api/view-legacy-pdf/<path:filename>')
def view_legacy_pdf_direct(filename):
    """Directly serves a PDF from the 'Laudos antigos' folder."""
    safe_name = os.path.basename(filename)
    fpath = os.path.join(LEGACY_DIR, safe_name)
    if os.path.exists(fpath):
        return send_file(fpath, mimetype='application/pdf')
    return "Arquivo não encontrado", 404

# --- New Configuration Endpoints ---

@app.route('/api/options', methods=['GET'])
def get_options():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, category, value, extra FROM options')
    rows = cursor.fetchall()
    conn.close()
    
    options = []
    for row in rows:
        options.append({
            'id': row[0],
            'category': row[1],
            'value': row[2],
            'extra': json.loads(row[3]) if row[3] else None
        })
    return jsonify({'success': True, 'data': options})

@app.route('/api/options', methods=['POST'])
def add_option():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
        
    data = request.get_json()
    category = data.get('category')
    value = data.get('value')
    extra = data.get('extra')
    
    if not category or not value:
        return jsonify({'success': False, 'error': 'Categoria e valor são obrigatórios'}), 400
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO options (category, value, extra) VALUES (?, ?, ?)',
                 (category, value, json.dumps(extra) if extra else None))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'id': new_id})

@app.route('/api/options/<int:id>', methods=['DELETE'])
def delete_option(id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM options WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/options/<int:id>', methods=['PUT'])
def update_option(id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    data = request.get_json()
    value = data.get('value')
    extra = data.get('extra')
    
    if not value:
        return jsonify({'success': False, 'error': 'Valor é obrigatório'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE options SET value = ?, extra = ? WHERE id = ?',
                   (value, json.dumps(extra) if extra else None, id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    rows = cursor.fetchall()
    conn.close()
    
    settings = {row[0]: row[1] for row in rows}
    return jsonify({'success': True, 'data': settings})

@app.route('/api/settings', methods=['POST'])
def update_setting():
    if 'user_id' not in session:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 401
    
    data = request.get_json()
    key = data.get('key')
    value = data.get('value')
    
    if not key:
        return jsonify({'success': False, 'error': 'Chave é obrigatória'}), 400
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

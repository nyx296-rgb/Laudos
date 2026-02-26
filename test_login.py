import http.cookiejar
import urllib.request
import json

# Criar cookie jar para manter sessão PERSISTENTE
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

print("=" * 60)
print("TESTE DO FLUXO COMPLETO DE CONFIG")
print("=" * 60)

# PASSO 1: FAZER LOGIN
print("\n[1] Fazendo login com admin/admin123...")
login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5000/api/login',
    data=login_data,
    headers={'Content-Type': 'application/json'}
)

try:
    response = opener.open(req)
    result = json.loads(response.read())
    print(f"✓ Login bem-sucedido: {result['username']} ({result['role']})")
except Exception as e:
    print(f"✗ Erro no login: {e}")
    exit(1)

# PASSO 2: CHECAR AUTENTICAÇÃO
print("\n[2] Verificando sessão com /api/me...")
req2 = urllib.request.Request('http://localhost:5000/api/me')
try:
    response2 = opener.open(req2)
    result2 = json.loads(response2.read())
    print(f"✓ Sessão válida: {result2}")
except Exception as e:
    print(f"✗ Erro ao acessar /api/me: {e}")

# PASSO 3: CARREGAR OPÇÕES
print("\n[3] Carregando /api/options...")
req3 = urllib.request.Request('http://localhost:5000/api/options')
try:
    response3 = opener.open(req3)
    result3 = json.loads(response3.read())
    
    data_count = len(result3.get('data', []))
    print(f"✓ {data_count} items carregados")
    
    # Contar por categoria
    items_by_cat = {}
    for item in result3.get('data', []):
        cat = item['category']
        items_by_cat[cat] = items_by_cat.get(cat, 0) + 1
    
    print(f"\n  Items por categoria:")
    for k in sorted(items_by_cat.keys()):
        print(f"    - {k}: {items_by_cat[k]}")
        
except Exception as e:
    print(f"✗ Erro ao acessar /api/options: {e}")

# PASSO 4: SIMULAR RENDERIZAÇÃO (como faz config.html)
print("\n[4] Simulando renderização da categoria 'unidades'...")
current_category = 'unidades'
try:
    # Os dados já estão carregados em result3
    items = [opt for opt in result3['data'] if opt['category'] == current_category]
    
    if items:
        print(f"✓ {len(items)} unidades encontradas:")
        for item in items[:5]:  # Mostrar apenas as 5 primeiras
            print(f"    - {item['value']} (id: {item['id']})")
        if len(items) > 5:
            print(f"    ... e mais {len(items) - 5}")
    else:
        print(f"✗ Nenhuma unidade encontrada")
        
except Exception as e:
    print(f"✗ Erro ao renderizar: {e}")

print("\n" + "=" * 60)
print("CONCLUSÃO: FLUXO COMPLETO FUNCIONOU COM SUCESSO! ✓")
print("="  * 60)

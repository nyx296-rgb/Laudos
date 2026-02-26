import http.cookiejar
import urllib.request
import json

# Criar cookie jar
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

# Fazer login
login_data = json.dumps({'username': 'admin', 'password': 'admin123'}).encode('utf-8')
req = urllib.request.Request(
    'http://localhost:5000/api/login',
    data=login_data,
    headers={'Content-Type': 'application/json'}
)

try:
    response = opener.open(req)
    result = json.loads(response.read())
    print(f"✓ Login OK: {result['username']} ({result['role']})")
except Exception as e:
    print(f"✗ Login failed: {e}")
    exit(1)

# Testar DELETE com ID
try:
    req_del = urllib.request.Request(
        'http://localhost:5000/api/options/100',
        method='DELETE',
        headers={'Content-Type': 'application/json'}
    )
    response = opener.open(req_del)
    result = json.loads(response.read())
    print(f"✓ DELETE funcionou: {result}")
except urllib.error.HTTPError as e:
    print(f"✗ HTTP Error {e.code}: {e.reason}")
    print(f"  Response: {e.read().decode()[:200]}")
except Exception as e:
    print(f"✗ Error: {e}")

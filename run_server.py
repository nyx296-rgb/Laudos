from waitress import serve
from app import app
import socket

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    ip = get_ip()
    port = 5000
    print(f"--- Gerador de Laudos ---")
    print(f"Servidor rodando localmente em: http://localhost:{port}")
    print(f"Acesso na rede via: http://{ip}:{port}")
    print(f"Pressione Ctrl+C para encerrar.")
    serve(app, host='0.0.0.0', port=port)

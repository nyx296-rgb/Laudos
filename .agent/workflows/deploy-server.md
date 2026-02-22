---
description: Como implantar o Gerador de Laudos em um servidor Windows na rede local
---

Este guia descreve os passos para configurar o servidor e permitir que outros computadores da rede acessem o sistema.

### 1. Preparação do Servidor
Certifique-se de que o Python está instalado no computador que servirá como servidor.

### 2. Instalação das Dependências
No terminal do servidor, dentro da pasta do projeto, execute:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configuração do Firewall (Crucial)
O Windows bloqueia conexões externas por padrão. Você precisa liberar a porta **5000**:
1. Abra o **Windows Defender Firewall with Advanced Security**.
2. Vá em **Inbound Rules** (Regras de Entrada).
3. Clique em **New Rule** (Nova Regra).
4. Escolha **Port** -> **TCP** -> **Specific local ports: 5000**.
5. Permita a conexão e dê um nome como "Laudo Generator".

### 4. Execução do Servidor
Para uso profissional/estável, recomendamos usar o `waitress`. 
Crie um arquivo chamado `run_server.py` ou apenas execute via terminal:
```bash
python -c "from waitress import serve; from app import app; print('Servidor rodando em http://0.0.0.0:5000'); serve(app, host='0.0.0.0', port=5000)"
```

### 5. Acesso na Rede
Descubra o IP do servidor (digite `ipconfig` no terminal do servidor). Exemplo: `192.168.1.15`.

Em qualquer outro computador da rede, abra o navegador e digite:
`http://192.168.1.15:5000`

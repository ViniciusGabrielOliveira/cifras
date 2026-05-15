# Cifras API

API Python que serve de backend para o app de cifras. Faz autocomplete e scraping do Cifra Club.

## Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/buscar?q=<termo>` | Sugestões de músicas (autocomplete) |
| `GET` | `/importar?url=<url>` | Scrape de uma cifra completa |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI (documentação interativa) |
| `GET` | `/redoc` | ReDoc (documentação alternativa) |

## Autenticação

Todas as rotas exigem o header:

```
X-API-Key: <sua-chave>
```

Sem a chave (ou chave errada) a API retorna `401`.

## Rate limit

**10 requisições por minuto por IP.** Excedendo, retorna `429`.

## Como rodar localmente

**1. Criar ambiente virtual e instalar dependências**

```bash
cd cifras-api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**2. Configurar variáveis de ambiente**

```bash
cp .env.example .env
# Editar .env e preencher API_KEY
```

**3. Rodar o servidor**

```bash
uvicorn app.main:app --reload --port 8000
```

A API estará em `http://localhost:8000`.  
Documentação interativa: `http://localhost:8000/docs`

## Exemplos de uso

**Buscar sugestões:**

```bash
curl -H "X-API-Key: sua-chave" \
  "http://localhost:8000/buscar?q=engenheiros+do+hawaii"
```

**Importar uma cifra:**

```bash
curl -H "X-API-Key: sua-chave" \
  "http://localhost:8000/importar?url=https://www.cifraclub.com.br/engenheiros-do-hawaii/toda-forma-de-poder/"
```

**Resposta do `/importar`:**

```json
{
  "title": "Toda Forma de Poder",
  "artist": "Engenheiros do Hawaii",
  "tom": "G",
  "lyricsWithChords": "G         Em\nVerso aqui...",
  "sourceUrl": "https://www.cifraclub.com.br/engenheiros-do-hawaii/toda-forma-de-poder/"
}
```

## Deploy no Render (Free)

1. Faça push do repositório para o GitHub
2. Acesse [render.com](https://render.com) → **New Web Service**
3. Conecte o repositório e selecione a pasta `cifras-api` como **Root Directory**
4. O Render vai detectar o `render.yaml` automaticamente
5. Na aba **Environment**, adicione a variável `API_KEY` com uma chave segura:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
6. Clique em **Deploy**

> **Atenção:** O plano free do Render hiberna o serviço após 15 minutos de inatividade.  
> A primeira requisição após a hibernação pode demorar ~30 segundos para o servidor acordar.  
> Isso é esperado e não afeta o uso normal pelo painel admin.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `API_KEY` | Sim (produção) | Chave de autenticação |
| `ALLOWED_ORIGINS` | Não | Origens CORS separadas por vírgula. Padrão: `*` |

## Estrutura do projeto

```
cifras-api/
├── app/
│   ├── __init__.py
│   ├── main.py       # FastAPI: rotas, auth, rate limit, CORS
│   └── scraper.py    # Lógica de fetch e parse do Cifra Club
├── .env.example
├── render.yaml       # Configuração do Render
├── requirements.txt
└── README.md
```

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


## Diagramas automáticos (violão e cavaquinho)

Ao abrir uma cifra ou mudar o tom, o viewer solicita `POST /acordes/sync` com os
nomes únicos dos acordes (até 100 por lote). A API interpreta a harmonia e busca
posições em E–A–D–G–B–E e D–G–B–D. Notas, baixo, extensão de mão e quantidade de
dedos são verificados. O resultado fica persistido na coleção `acordes`:

- `variacoes`: desenhos de violão, compatível com a estrutura anterior.
- `variacoesCavaco`: desenhos de cavaquinho.
- `geradorVersao`: evita repetir escritas já concluídas nesta versão.
- `geracao.status`: `completo` ou `revisao`.
- `geracao.instrumentosPendentes`: instrumentos que não puderam ser resolvidos.

As transações preservam variações existentes e evitam duplicar posições. Símbolos
não suportados são mantidos para revisão, sem criar desenhos por aproximação.
A geração sob demanda usa a API existente, sem processo MCP ou agente conectado.
Acordes em revisão podem ser consultados por `geracao.status == "revisao"`.

Para preencher a base existente (preview por padrão):

```bash
.venv/bin/python scripts/backfill_chords.py --credentials ../service-account.json --report /tmp/chords-preview.json
# Adicione --apply para persistir; o relatório informa antes/depois por acorde.
```

Preenchimento inicial aplicado em 18/10/2026: 29 acordes existentes, com 186
desenhos de violão e 156 de cavaquinho; nenhum desses acordes ficou em revisão.
Fonte: execução de `scripts/backfill_chords.py --apply` e leitura do Firestore.

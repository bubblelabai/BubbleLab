# Deploy do BubbleLab no Railway

Este guia explica como fazer deploy do BubbleLab no [Railway](https://railway.app).

## Visão Geral

O BubbleLab é composto por 2 serviços principais:
- **bubblelab-api**: Backend API (Bun + Hono) - porta 3001
- **bubble-studio**: Frontend (Vite + React) - servido via nginx

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Repositório do BubbleLab no GitHub
- Chaves de API necessárias (Google API, OpenRouter, etc.)

---

## Passo 1: Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Conecte seu repositório do BubbleLab

---

## Passo 2: Configurar o Banco de Dados (PostgreSQL)

1. No seu projeto Railway, clique em **"+ New"** → **"Database"** → **"PostgreSQL"**
2. O Railway criará automaticamente a variável `DATABASE_URL`
3. Anote o valor de `DATABASE_URL` para usar nos serviços

---

## Passo 3: Deploy da API (bubblelab-api)

### 3.1 Criar o Serviço

1. Clique em **"+ New"** → **"GitHub Repo"**
2. Selecione o repositório BubbleLab
3. Renomeie o serviço para `bubblelab-api`

### 3.2 Configurar Build

Vá em **Settings** do serviço e configure:

| Campo | Valor |
|-------|-------|
| **Root Directory** | `/` |
| **Builder** | Dockerfile |
| **Dockerfile Path** | `Dockerfile.api` |
| **Watch Paths** | `/apps/bubblelab-api/**`, `/packages/**` |

### 3.3 Configurar Variáveis de Ambiente

Vá em **Variables** e adicione:

```env
# Obrigatórias
BUBBLE_ENV=PROD
DATABASE_URL=${{Postgres.DATABASE_URL}}
CREDENTIAL_ENCRYPTION_KEY=<gere-uma-chave-segura-base64>

# API Keys para geração de workflows
GOOGLE_API_KEY=<sua-google-api-key>
OPENROUTER_API_KEY=<sua-openrouter-api-key>

# Autenticação (escolha uma opção)
# Opção A: Sem autenticação (desenvolvimento)
DISABLE_AUTH=TRUE

# Opção B: Com Clerk (produção)
# DISABLE_AUTH=FALSE
# CLERK_PUBLISHABLE_KEY=<sua-clerk-publishable-key>
# CLERK_SECRET_KEY_BUBBLELAB=<sua-clerk-secret-key>
# CLERK_ISSUER_BUBBLELAB_PROD=<seu-clerk-issuer-url>

# Opcionais - Integrações
OPENAI_API_KEY=<opcional>
RESEND_API_KEY=<opcional>
FIRE_CRAWL_API_KEY=<opcional>
GOOGLE_OAUTH_CLIENT_ID=<opcional>
GOOGLE_OAUTH_CLIENT_SECRET=<opcional>
```

### 3.4 Configurar Networking

Em **Settings** → **Networking**:
- Habilite **"Public Networking"**
- Defina a porta como `3001`
- Anote o domínio gerado (ex: `bubblelab-api-production.up.railway.app`)

---

## Passo 4: Deploy do Frontend (bubble-studio)

### 4.1 Criar o Serviço

1. Clique em **"+ New"** → **"GitHub Repo"**
2. Selecione o repositório BubbleLab novamente
3. Renomeie o serviço para `bubble-studio`

### 4.2 Configurar Build

Vá em **Settings** do serviço e configure:

| Campo | Valor |
|-------|-------|
| **Root Directory** | `/` |
| **Builder** | Dockerfile |
| **Dockerfile Path** | `deployment/Dockerfile.bubble-studio` |
| **Watch Paths** | `/apps/bubble-studio/**`, `/packages/**` |

### 4.3 Configurar Variáveis de Ambiente (Build Args)

O Dockerfile usa build args. Configure em **Variables**:

```env
# URL da API (use o domínio do serviço bubblelab-api)
VITE_API_URL=https://bubblelab-api-production.up.railway.app

# Autenticação
VITE_DISABLE_AUTH=true
# Ou para produção com Clerk:
# VITE_DISABLE_AUTH=false
# VITE_CLERK_PUBLISHABLE_KEY=<sua-clerk-publishable-key>

# Analytics (opcional)
VITE_POSTHOG_API_KEY=<opcional>
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_ANALYTICS_ENABLED=false
```

### 4.4 Configurar Networking

Em **Settings** → **Networking**:
- Habilite **"Public Networking"**
- Defina a porta como `80`
- Opcionalmente, configure um domínio personalizado

---

## Passo 5: Gerar Chave de Criptografia

Para gerar uma `CREDENTIAL_ENCRYPTION_KEY` segura:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Ou OpenSSL
openssl rand -base64 32
```

---

## Passo 6: Configurar Domínio Personalizado (Opcional)

1. Vá em **Settings** → **Networking** → **Custom Domain**
2. Adicione seu domínio (ex: `app.seudominio.com`)
3. Configure os registros DNS conforme instruído pelo Railway

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────┐
│                    Railway                          │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────┐ │
│  │   bubble-   │    │  bubblelab- │    │ Postgres│ │
│  │   studio    │───▶│    api      │───▶│   DB    │ │
│  │  (nginx:80) │    │  (bun:3001) │    │         │ │
│  └─────────────┘    └─────────────┘    └─────────┘ │
│         │                                          │
└─────────┼──────────────────────────────────────────┘
          │
          ▼
      Usuários
```

---

## Troubleshooting

### Build falha com erro de memória
- Railway Free Tier tem 512MB RAM. Considere upgrade para Pro.
- Use `NODE_OPTIONS=--max-old-space-size=400` nas variáveis

### API não conecta no banco
- Verifique se `DATABASE_URL` está usando a referência correta: `${{Postgres.DATABASE_URL}}`
- Confirme que o PostgreSQL está rodando

### Frontend não conecta na API
- Verifique se `VITE_API_URL` aponta para o domínio correto da API
- Confirme que a API está com networking público habilitado

### CORS errors
- A API deve estar configurada para aceitar requests do domínio do frontend

---

## Custos Estimados

| Plano | Recursos | Preço |
|-------|----------|-------|
| **Free** | $5/mês créditos, 512MB RAM | Grátis |
| **Hobby** | $5/mês, recursos limitados | $5/mês |
| **Pro** | 8GB RAM, recursos escaláveis | Baseado em uso |

Para produção recomenda-se o plano **Pro** pelo auto-scaling e recursos adequados.

---

## Deploy com railway.toml (Alternativo)

Você também pode criar um arquivo `railway.toml` na raiz do projeto:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.api"

[deploy]
startCommand = "sh -c 'bun run src/index.ts'"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

---

## Links Úteis

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [BubbleLab Docs](https://docs.bubblelab.ai)

# Sob Investigação Service

Este é o serviço de backend para o projeto **Sob Investigação**, responsável por processar webhooks (como os do WhatsApp) e executar tarefas em background (Worker).

O projeto é construído com Node.js, TypeScript e utiliza o Firebase Firestore para persistência de dados.

## 🚀 Tecnologias

- [Node.js](https://nodejs.org/) (v20+)
- [TypeScript](https://www.typescriptlang.org/)
- [Express](https://expressjs.com/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [TSX](https://tsx.is/) (para desenvolvimento)

## 📦 Instalação

Certifique-se de ter o Node.js v20 ou superior instalado.

1. Clone o repositório.
2. Instale as dependências:

```bash
npm install
```

## ⚙️ Configuração

### Variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha os valores. Em produção (Cloud Run, etc.), defina as variáveis no ambiente de deploy.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Sim (local) | Caminho para o JSON da conta de serviço GCP. Em produção use Application Default Credentials. |
| `WHATSAPP_API_URL` | Sim | URL base da API do WhatsApp (ex.: `https://graph.facebook.com/v18.0`). |
| `WHATSAPP_ACCESS_TOKEN` | Sim | Token de acesso do app Meta (WhatsApp Business API). |
| `WHATSAPP_PHONE_NUMBER_ID` | Sim | ID do número de telefone do WhatsApp Business. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Sim | Token usado na verificação do webhook (GET) pelo Meta. |
| `VERTEX_AI_PROJECT_NUMBER` | Sim (worker) | Número do projeto GCP (apenas dígitos). |
| `VERTEX_AI_LOCATION` | Sim (worker) | Região do Vertex AI (ex.: `us-central1`). |
| `VERTEX_AI_AGENT_ENGINE_ID` | Sim (worker) | ID do Reasoning Engine / agente no Vertex AI. |
| `PORT` | Não | Porta HTTP (default: `8080`). |
| `INTERNAL_TOKEN` | Não | Token para proteção de rotas internas (middleware auth). |
| `GCP_PROJECT` | Não | ID do projeto GCP (opcional; pode ser inferido pela credencial). |

**Pub/Sub:** o tópico `sob-processing-jobs` deve existir no projeto. As credenciais são as mesmas do Firebase (ADC ou `GOOGLE_APPLICATION_CREDENTIALS`).

**Exemplo (desenvolvimento local):**

```bash
cp .env.example .env
# Edite .env com seus valores.

export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/seu/arquivo-de-servico.json"
```

No ambiente de produção ou via Docker, certifique-se de que o ambiente tenha as permissões necessárias para acessar o Firestore e o Pub/Sub.

## 🏃 Como Rodar

### Desenvolvimento

Para rodar o servidor em modo de desenvolvimento com hot-reload:

```bash
npm run dev
```

### Produção

Para compilar o código TypeScript e iniciar o servidor:

1. Gere o build:
   ```bash
   npm run build
   ```
2. Inicie o serviço:
   ```bash
   npm start
   ```

## 📂 Estrutura de Pastas

```text
src/
├── controllers/    # Lógica de processamento das rotas
├── firebase/       # Configuração e inicialização do Firebase Admin
├── middlewares/    # Middlewares do Express
├── routes/         # Definição das rotas da API
├── services/       # Serviços de negócio e integrações
├── types/          # Definições de tipos TypeScript
├── worker/         # Lógica do worker para tarefas em background
├── app.ts          # Configuração da aplicação Express
└── server.ts       # Ponto de entrada do servidor principal
```

## 🐳 Docker

O projeto inclui um `Dockerfile` para facilitar o deployment:

```bash
docker build -t sob-investigacao-service .
docker run -p 8080:8080 sob-investigacao-service
```

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

Este projeto utiliza o Firebase. Para que ele funcione corretamente, você precisa configurar as credenciais do Google Cloud.

Defina a variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS` apontando para o seu arquivo JSON de chave de conta de serviço:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/seu/arquivo-de-servico.json"
```

No ambiente de produção ou via Docker, certifique-se de que o ambiente tenha as permissões necessárias para acessar o Firestore.

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

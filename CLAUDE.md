# Sob Investigação Service

## Deploy

O `gcloud` não está no PATH por padrão neste Mac. Use o caminho completo:

```bash
# Build + Deploy do serviço principal
npm run build && ~/google-cloud-sdk/bin/gcloud run deploy sob-investigacao-service --source . --region us-central1 --project sob-investigacao-f6af4

# Ou use os scripts do package.json substituindo gcloud pelo caminho completo
```

## Logs

```bash
# Ver logs do serviço
~/google-cloud-sdk/bin/gcloud run services logs read sob-investigacao-service --region us-central1 --project sob-investigacao-f6af4 --limit 100

# Filtrar por prefixo de log
~/google-cloud-sdk/bin/gcloud run services logs read sob-investigacao-service --region us-central1 --project sob-investigacao-f6af4 --limit 100 | grep "AI_SERVICE"
```

## Estrutura

- `src/services/ai.service.ts` - Integração com Vertex AI (Reasoning Engine)
- `src/server.ts` - Servidor Express principal
- `src/worker/` - Worker para processamento de mensagens

## Projeto GCP

- Project ID: `sob-investigacao-f6af4`
- Region: `us-central1`

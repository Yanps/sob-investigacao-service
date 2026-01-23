# Índice Firestore Necessário

## Índice Composto para `conversations`

A coleção `conversations` requer um índice composto para a query que busca conversas ativas por telefone.

### Campos do Índice:
- `phoneNumber` (ASC - Ascendente)
- `status` (ASC - Ascendente)  
- `lastMessageAt` (DESC - Descendente)

### Como Criar:

**Opção 1: Link Direto (mais rápido)**
Clique no link fornecido no erro do Cloud Run:
```
https://console.firebase.google.com/v1/r/project/sob-investigacao-f6af4/firestore/indexes?create_composite=...
```

**Opção 2: Via Console do Firebase**
1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `sob-investigacao-f6af4`
3. Vá em **Firestore Database** → **Indexes**
4. Clique em **Create Index**
5. Configure:
   - Collection ID: `conversations`
   - Fields:
     - `phoneNumber` → Ascending
     - `status` → Ascending
     - `lastMessageAt` → Descending
6. Clique em **Create**

**Opção 3: Via Arquivo `firestore.indexes.json` (recomendado para versionamento)**

Crie o arquivo `firestore.indexes.json` na raiz do projeto:

```json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "phoneNumber",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "lastMessageAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Depois, faça o deploy:
```bash
firebase deploy --only firestore:indexes
```

### Tempo de Criação
O índice pode levar alguns minutos para ser criado. Você receberá um email quando estiver pronto.

### Verificação
Após criar, verifique no console do Firebase que o índice está com status "Enabled".

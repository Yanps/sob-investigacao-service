# Project Index

This document provides a comprehensive index of all files and folders in the Sob Investigação Service project.

## Root Directory

```
sob-investigacao-service/
├── agent-policy.json          # Agent policy configuration
├── dist/                      # Compiled TypeScript output (generated)
├── Dockerfile                 # Docker configuration for containerization
├── node_modules/              # Node.js dependencies (generated)
├── package-lock.json          # Locked dependency versions
├── package.json               # Project configuration and dependencies
├── README.md                  # Project documentation
├── src/                       # Source code directory
├── tsconfig.json              # TypeScript configuration
└── INDEX.md                   # This file
```

## Source Code Structure (`src/`)

### Core Files
- `app.ts` - Express application configuration
- `server.ts` - Main server entry point

### Directories

#### `config/`
Configuration files for the application.
- `retry.config.ts` - Retry logic configuration

#### `controllers/`
Request handlers and business logic controllers.
- `webhook.controller.ts` - Webhook request controller

#### `firebase/`
Firebase Admin SDK setup and configuration.
- `firestore.ts` - Firestore database configuration
- `index.ts` - Firebase initialization

#### `middlewares/`
Express middleware functions.
- `auth.ts` - Authentication middleware

#### `pubsub/`
Google Cloud Pub/Sub integration.
- `publisher.ts` - Pub/Sub message publisher

#### `routes/`
API route definitions.
- `health.routes.ts` - Health check endpoints
- `webhook.routes.ts` - Webhook endpoints

#### `services/`
Business logic and external service integrations.
- `ai.service.ts` - AI/ML service integration
- `firestore.ts` - Firestore service layer
- `saveMessage.ts` - Message persistence service
- `webhook.service.ts` - Webhook processing service
- `whatsapp.service.ts` - WhatsApp integration service

#### `types/`
TypeScript type definitions.
- `webhook.types.ts` - Webhook-related type definitions

#### `worker/`
Background worker for processing tasks.
- `index.ts` - Worker entry point

## Project Information

- **Name**: sob-investigacao-webhook
- **Version**: 1.0.0
- **Type**: Node.js/TypeScript service
- **Main Entry**: `dist/server.js`
- **Worker Entry**: `dist/worker/index.js`

## Key Technologies

- Node.js (v20+)
- TypeScript
- Express.js
- Firebase Admin SDK
- Google Cloud Pub/Sub
- Google Cloud Vertex AI
- Axios

## Build Output

The `dist/` directory contains the compiled JavaScript output from TypeScript. This directory is generated when running `npm run build`.

## Deployment

The project includes deployment scripts for Google Cloud Run:
- `deploy:webhook` - Deploys the webhook service
- `deploy:worker` - Deploys the worker service

---

*Last updated: Generated automatically*

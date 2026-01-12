import express from "express";
import webhookRoutes from "./routes/webhook.routes.js";
import healthRoutes from "./routes/health.routes.js";
const app = express();
app.use(express.json());
app.use(webhookRoutes);
app.use(healthRoutes);
export default app;

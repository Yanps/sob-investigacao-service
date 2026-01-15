import { Router } from "express";
import { whatsappWebhook, whatsappWebhookVerify } from "../controllers/webhook.controller.js";
const router = Router();
router.get("/webhook/whatsapp", whatsappWebhookVerify);
router.post("/webhook/whatsapp", whatsappWebhook);
export default router;

import { handleWhatsappWebhook } from "../services/webhook.service.js";
export async function whatsappWebhook(req, res) {
    try {
        const result = await handleWhatsappWebhook(req);
        return res.status(200).json(result);
    }
    catch (error) {
        console.error("Webhook error:", error);
        return res.status(500).json({ ok: false });
    }
}

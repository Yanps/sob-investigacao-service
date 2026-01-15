import { handleWhatsappWebhook } from "../services/webhook.service.js";
// 🔹 VERIFY (GET) — Meta usa isso
export function whatsappWebhookVerify(req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    console.log("VERIFY DEBUG", {
        envToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        receivedToken: token,
        mode,
        challenge,
    });
    if (mode === "subscribe" &&
        token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        console.log("✅ Webhook verified");
        return res.status(200).send(challenge);
    }
    console.warn("❌ Webhook verification failed");
    return res.sendStatus(403);
}
// 🔹 WEBHOOK REAL (POST)
export async function whatsappWebhook(req, res) {
    try {
        const result = await handleWhatsappWebhook(req.body);
        res.status(200).json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ ok: false });
    }
}

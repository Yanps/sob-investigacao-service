import { db } from "../firebase/firestore.js";
import { randomUUID } from "crypto";
export async function handleWhatsappWebhook(req) {
    const traceId = randomUUID();
    // 1️⃣ Log bruto do webhook
    const webhookLogRef = await db.collection("webhook_logs").add({
        traceId,
        headers: req.headers,
        payload: req.body,
        receivedAt: new Date(),
    });
    // 2️⃣ Cria job de processamento
    await db.collection("processing_jobs").add({
        traceId,
        status: "pending",
        webhookLogRef: webhookLogRef.path,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    return {
        ok: true,
        traceId,
    };
}

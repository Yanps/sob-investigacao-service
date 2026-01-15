import { db } from "../firebase/firestore.js";
import { publishProcessingJob } from "../pubsub/publisher.js";
import crypto from "crypto";
export async function handleWhatsappWebhook(payload) {
    const traceId = crypto.randomUUID();
    /**
     * 🔎 Extração segura do payload do WhatsApp
     */
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    // ⚠️ Webhooks que NÃO são mensagens (status, receipts, etc)
    if (!value || !value.messages || value.messages.length === 0) {
        console.log("ℹ️ Evento WhatsApp sem mensagem (ignorado)");
        return { ok: true };
    }
    const message = value.messages[0];
    const phoneNumber = message.from; // ✅ NÚMERO DO USUÁRIO
    const text = message?.text?.body ?? null;
    const messageId = message.id;
    if (!phoneNumber) {
        throw new Error("Payload inválido: phoneNumber ausente");
    }
    /**
     * 🧾 Log bruto do webhook (debug/auditoria)
     */
    await db.collection("webhook_logs").add({
        payload,
        traceId,
        phoneNumber,
        messageId,
        text,
        createdAt: new Date(),
    });
    /**
     * 🧠 Cria job de processamento
     */
    const jobRef = await db.collection("processing_jobs").add({
        traceId,
        phoneNumber,
        messageId,
        text,
        status: "pending",
        attempts: 0,
        createdAt: new Date(),
    });
    /**
     * 🚀 Publica no Pub/Sub (payload mínimo)
     */
    await publishProcessingJob({
        jobId: jobRef.id,
        traceId,
    });
    console.log("✅ Job criado via WhatsApp", {
        jobId: jobRef.id,
        phoneNumber,
    });
    return { ok: true };
}

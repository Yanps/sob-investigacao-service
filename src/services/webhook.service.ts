import { db } from "../firebase/firestore.js";
import { publishProcessingJob } from "../pubsub/publisher.js";
import crypto from "crypto";

export async function handleWhatsappWebhook(payload: any) {
  const traceId = crypto.randomUUID();

  const phoneNumber = payload.from;
  if (!phoneNumber) {
    throw new Error("Payload inválido: phoneNumber ausente");
  }

  // 1️⃣ Log do webhook
  await db.collection("webhook_logs").add({
    payload,
    traceId,
    createdAt: new Date(),
  });

  // 2️⃣ Cria job COM phoneNumber
  const jobRef = await db.collection("processing_jobs").add({
    traceId,
    phoneNumber,
    status: "pending",
    attempts: 0,
    createdAt: new Date(),
  });

  // 3️⃣ Publica no Pub/Sub (payload mínimo)
  await publishProcessingJob({
    jobId: jobRef.id,
    traceId,
  });

  return { ok: true };
}

import { db } from "../firebase/firestore.js";

export async function handleJobEvent(message: any) {
  console.log("📦 Raw message:", message);

  const decoded = Buffer.from(message.data, "base64").toString();
  console.log("📨 Decoded payload:", decoded);

  const payload = JSON.parse(decoded);
  const { jobId, traceId } = payload;

  if (!jobId || !traceId) {
    throw new Error("Payload inválido: jobId ou traceId ausente");
  }

  const jobRef = db.collection("processing_jobs").doc(jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    console.warn("⚠️ Job não encontrado:", jobId);
    return;
  }

  await jobRef.update({
    status: "processing",
    updatedAt: new Date(),
  });

  await db.collection("agent_responses").add({
    traceId,
    response: { text: "Processado via Pub/Sub" },
    createdAt: new Date(),
  });

  await jobRef.update({
    status: "done",
    updatedAt: new Date(),
  });

  console.log("✅ Job finalizado:", jobId);
}

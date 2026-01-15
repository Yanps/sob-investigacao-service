import express from "express";
import { db } from "../firebase/firestore.js";
import { MAX_ATTEMPTS } from "../config/retry.config.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import { generateAIResponse } from "../services/ai.service.js";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  try {
    console.log("🔥 WORKER HIT 🔥");

    const message = req.body?.message;
    if (!message?.data) {
      console.warn("⚠️ Mensagem inválida");
      return res.status(204).end();
    }

    const payload = JSON.parse(
      Buffer.from(message.data, "base64").toString()
    );


    const { jobId, traceId } = payload;
    if (!jobId) return res.status(204).end();

    const jobRef = db.collection("processing_jobs").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) return res.status(204).end();

    const jobData = jobSnap.data();
    if (!jobData) return res.status(204).end();

    // 🔁 IDEMPOTÊNCIA
    if (jobData.status !== "pending") {
      console.log("🔁 Duplicate message ignored:", jobId);
      return res.status(204).end();
    }

    const attempts = jobData.attempts ?? 0;
    const phoneNumber = jobData.phoneNumber;

    if (!phoneNumber) {
      throw new Error("phoneNumber ausente no job");
    }

    // 🔒 LOCK
    await jobRef.update({
      status: "processing",
      attempts: attempts + 1,
      startedAt: new Date(),
    });

    try {
      const responseText = await generateAIResponse({
        phoneNumber,
        text: jobData.text,
      });

      await sendWhatsAppMessage({
        to: phoneNumber,
        text: responseText,
      });

      await db.collection("agent_responses").add({
        traceId,
        phoneNumber,
        question: jobData.text,
        response: { text: responseText },
        createdAt: new Date(),
        source: "vertex-ai",
      });

      await jobRef.update({
        status: "done",
        finishedAt: new Date(),
      });

      console.log("✅ Job finalizado:", jobId);
      return res.status(204).end();
    } catch (err) {
      console.error("🔥 Erro no processamento:", err);

      if (attempts + 1 >= MAX_ATTEMPTS) {
        await jobRef.update({
          status: "failed",
          lastError: String(err),
          failedAt: new Date(),
        });

        console.error("☠️ Job enviado para DLQ:", jobId);
        return res.status(204).end();
      }

      throw err;
    }
  } catch (err) {
    console.error("🔥 Worker fatal error:", err);
    return res.status(204).end();
  }
});

// 🚀 Cloud Run
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Worker listening on port ${PORT}`);
});

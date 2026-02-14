import express from "express";
import { db } from "../firebase/firestore.js";
import { MAX_ATTEMPTS } from "../config/retry.config.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import {
  generateAIResponse,
  createVertexAISession,
  getUserName,
  getLastMessageTimestamp,
} from "../services/ai.service.js";
import {
  findOrCreateConversation,
  updateConversationSessionId,
  updateConversationLastMessage,
} from "../services/conversation.service.js";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  try {
    console.log("WORKER HIT");

    const message = req.body?.message;
    if (!message?.data) {
      console.warn("Mensagem inválida");
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

    if (jobData.status !== "pending") {
      console.log("Duplicate message ignored:", jobId);
      return res.status(204).end();
    }

    const attempts = jobData.attempts ?? 0;
    const phoneNumber = jobData.phoneNumber;
    let conversationId = jobData.conversationId;
    let sessionId = jobData.sessionId || null;

    if (!phoneNumber) {
      throw new Error("phoneNumber ausente no job");
    }

    if (!conversationId) {
      console.log("Job antigo sem conversationId, criando conversa...");
      const conversation = await findOrCreateConversation(phoneNumber);
      conversationId = conversation.conversationId;
      sessionId = conversation.adkSessionId || sessionId;

      await jobRef.update({
        conversationId,
        agentPhoneNumberId: conversation.agentPhoneNumberId,
        sessionId: sessionId || null,
      });
      console.log("Conversa criada retroativamente:", conversationId);
    } else {
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (conversationDoc.exists) {
        const conversationData = conversationDoc.data();
        sessionId = conversationData?.adkSessionId || sessionId;
        console.log("SessionId recuperado da conversa:", sessionId);
      }
    }

    await jobRef.update({
      status: "processing",
      attempts: attempts + 1,
      startedAt: new Date(),
    });

    try {
      const userName = await getUserName(phoneNumber);
      const lastMessageTimestamp = await getLastMessageTimestamp(conversationId);

      if (lastMessageTimestamp) {
        console.log("[WORKER] Timestamp da última mensagem:", lastMessageTimestamp);
      }

      if (!sessionId) {
        console.log("Criando nova sessão Vertex AI...");
        sessionId = await createVertexAISession(phoneNumber, userName);

        await updateConversationSessionId(conversationId, sessionId);
        await jobRef.update({ sessionId });
        console.log("Sessão criada e salva:", sessionId);
      }

      let aiResult = await generateAIResponse({
        phoneNumber,
        text: jobData.text,
        sessionId,
        userName,
        lastMessageTimestamp,
      });

      // Se a resposta for vazia (sessão corrompida/expirada), criar nova sessão e tentar novamente
      if (!aiResult.response || aiResult.response === "Desculpe, não consegui gerar uma resposta agora.") {
        console.log("[WORKER] Resposta vazia detectada, criando nova sessão...");

        sessionId = await createVertexAISession(phoneNumber, userName);
        await updateConversationSessionId(conversationId, sessionId);
        await jobRef.update({ sessionId });
        console.log("[WORKER] Nova sessão criada:", sessionId);

        aiResult = await generateAIResponse({
          phoneNumber,
          text: jobData.text,
          sessionId,
          userName,
          lastMessageTimestamp,
        });
        console.log("[WORKER] Retry com nova sessão concluído");
      }

      const responseText = aiResult.response;

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

      await updateConversationLastMessage(conversationId);

      await jobRef.update({
        status: "done",
        finishedAt: new Date(),
        sessionId,
      });

      console.log("Job finalizado:", jobId);
      return res.status(204).end();
    } catch (err) {
      console.error("Erro no processamento:", err);

      if (attempts + 1 >= MAX_ATTEMPTS) {
        await jobRef.update({
          status: "failed",
          lastError: String(err),
          failedAt: new Date(),
        });

        console.error("Job enviado para DLQ:", jobId);
        return res.status(204).end();
      }

      throw err;
    }
  } catch (err) {
    console.error("Worker fatal error:", err);
    return res.status(204).end();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});

import express from "express";
import { db } from "../firebase/firestore.js";
import { MAX_ATTEMPTS } from "../config/retry.config.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import {
  generateAIResponse,
  createVertexAISession,
  getUserEmail,
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
    let conversationId = jobData.conversationId;
    let sessionId = jobData.sessionId || null;

    if (!phoneNumber) {
      throw new Error("phoneNumber ausente no job");
    }

    // 🔄 Retrocompatibilidade: cria conversa se não existir no job
    if (!conversationId) {
      console.log("⚠️ Job antigo sem conversationId, criando conversa...");
      const conversation = await findOrCreateConversation(phoneNumber);
      conversationId = conversation.conversationId;
      sessionId = conversation.adkSessionId || sessionId;
      
      // Atualiza o job com conversationId para futuras execuções
      await jobRef.update({
        conversationId,
        agentPhoneNumberId: conversation.agentPhoneNumberId,
        sessionId: sessionId || null,
      });
      console.log("✅ Conversa criada retroativamente:", conversationId);
    } else {
      // 🔍 Sempre busca sessionId atualizado da conversa (fonte da verdade)
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (conversationDoc.exists) {
        const conversationData = conversationDoc.data();
        sessionId = conversationData?.adkSessionId || sessionId;
        console.log("📋 SessionId recuperado da conversa:", sessionId);
      }
    }

    // 🔒 LOCK
    await jobRef.update({
      status: "processing",
      attempts: attempts + 1,
      startedAt: new Date(),
    });

    try {
      // 📧 Busca email do usuário
      const userEmail = await getUserEmail(phoneNumber);

      // 💬 Tenta criar sessão se necessário (lazy creation)
      // Nota: Se a API não suportar criação explícita, a sessão será criada
      // automaticamente na primeira chamada e capturada na resposta
      if (!sessionId && conversationId) {
        const createdSessionId = await createVertexAISession(
          phoneNumber,
          userEmail
        );
        if (createdSessionId) {
          sessionId = createdSessionId;
          await updateConversationSessionId(conversationId, sessionId);
          await jobRef.update({ sessionId });
        }
        // Se createdSessionId for null, continuamos sem sessionId
        // A sessão será criada automaticamente na chamada abaixo
      }

      // 🤖 Gera resposta da IA com sessionId (ou sem, se não disponível)
      const aiResult = await generateAIResponse({
        phoneNumber,
        text: jobData.text,
        sessionId,
        email: userEmail,
      });

      // 📝 Atualiza sessionId se retornado na resposta (criado automaticamente)
      if (aiResult.sessionId) {
        if (!sessionId || aiResult.sessionId !== sessionId) {
          sessionId = aiResult.sessionId;
          await updateConversationSessionId(conversationId, sessionId);
          await jobRef.update({ sessionId });
        }
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

      // 📅 Atualiza timestamp da última mensagem da conversa
      await updateConversationLastMessage(conversationId);

      await jobRef.update({
        status: "done",
        finishedAt: new Date(),
        sessionId, // Salva sessionId atualizado
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

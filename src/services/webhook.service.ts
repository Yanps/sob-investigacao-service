import { db } from "../firebase/firestore.js";
import { publishProcessingJob } from "../pubsub/publisher.js";
import { findOrCreateConversation } from "./conversation.service.js";
import { sendWhatsAppMessage } from "./whatsapp.service.js";
import { markMessageAsRead, sendTypingIndicator } from "./whatsapp-status.service.js";
import { validateAndActivate } from "./gift-card.service.js";
import { saveUserMessage } from "./saveMessage.js";
import crypto from "crypto";

/** Normaliza telefone para consulta em orders (apenas dígitos; 10/11 dígitos → adiciona 55). */
function normalizePhoneForQuery(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  return digits;
}

/**
 * Verifica se o número tem acesso ao agente (ao menos um pedido pago em orders).
 */
async function hasAccessToAgent(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneForQuery(phoneNumber);
  const normalizedNumber = Number(normalized);
  console.log("[hasAccessToAgent] phoneNumber:", phoneNumber, "| normalized:", normalized, "| normalizedNumber:", normalizedNumber);

  const byPhone = await db
    .collection("orders")
    .where("phoneNumber", "==", normalizedNumber)
    .limit(1)
    .get();
  if (!byPhone.empty) {
    console.log("[hasAccessToAgent] encontrado em orders (phoneNumber), acesso OK");
    return true;
  }

  const byAlt = await db
    .collection("orders")
    .where("phoneNumberAlt", "==", normalizedNumber)
    .limit(1)
    .get();
  const hasAccess = !byAlt.empty;
  if (hasAccess) {
    console.log("[hasAccessToAgent] encontrado em orders (phoneNumberAlt), acesso OK");
  } else {
    console.log("[hasAccessToAgent] nenhum order encontrado, acesso NEGADO");
  }
  return hasAccess;
}


// 
// Alinhar o menu prinicpal aqui. Hoje o agente que fornece o menu principal
// Esse fluxo não é o correto. O correto é o fluxo de compra e ativação de gift card.
// seja por aqui e não pelo agente.
//  O agente deve ser usado apenas para responder perguntas e fornecer informações.
//
const MESSAGE_NO_ACCESS =
  "Para falar com o delegado, você precisa ter um jogo ativo.\n\n" +
  "• *Comprar:* acesse nossa loja e adquira o jogo: link.sobinvestigacao.com/casos\n\n" +
  "• *Já tem o jogo?* (ex.: recebeu de presente) Envie o código de ativação aqui no chat para ativar o gift card e liberar o acesso.";

/** Considera mensagem como possível código de ativação (formato alfanumérico com hífens, 6–60 caracteres). */
function looksLikeActivationCode(text: string | null): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length < 6 || trimmed.length > 60) return false;
  return /^[A-Za-z0-9\-]+$/.test(trimmed);
}

export async function handleWhatsappWebhook(payload: any) {
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
   * ✅ Marca mensagem como "visualizado" (dois checks azuis)
   * Envia imediatamente, sem aguardar resposta (fire and forget)
   */
  if (messageId) {
    markMessageAsRead(messageId).catch((error) => {
      console.error("[handleWhatsappWebhook] Erro ao marcar como lida:", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    /**
     * 🔤 Envia indicador de digitação (typing indicator)
     * Mostra "digitando..." para o cliente enquanto processa a mensagem
     * O indicador é desativado automaticamente após 25s ou ao enviar resposta
     */
    sendTypingIndicator(messageId).catch((error) => {
      console.error("[handleWhatsappWebhook] Erro ao enviar typing indicator:", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * 🚫 Verifica se o usuário tem acesso ao agente (ao menos um pedido pago).
   */
  console.log("[handleWhatsappWebhook] verificando acesso ao agente para:", phoneNumber);
  const hasAccess = await hasAccessToAgent(phoneNumber);
  console.log("[handleWhatsappWebhook] hasAccess:", hasAccess);

  if (!hasAccess) {
    if (text && looksLikeActivationCode(text)) {
      try {
        const result = await validateAndActivate(phoneNumber, text);
        await sendWhatsAppMessage({ to: phoneNumber, text: result.message });
      } catch (err) {
        console.error("Erro ao ativar gift card:", err);
        await sendWhatsAppMessage({
          to: phoneNumber,
          text: "Ocorreu um erro ao ativar o código. Tente novamente mais tarde.",
        });
      }
      return { ok: true };
    }
    try {
      await sendWhatsAppMessage({ to: phoneNumber, text: MESSAGE_NO_ACCESS });
    } catch (err) {
      console.error("Erro ao enviar mensagem de sem acesso:", err);
    }
    return { ok: true };
  }

  /**
   * 🔁 Idempotência: evita processar a mesma mensagem duas vezes (reenvio do WhatsApp).
   */
  const existingJob = await db
    .collection("processing_jobs")
    .where("messageId", "==", messageId)
    .limit(1)
    .get();
  if (!existingJob.empty) {
    console.log("[handleWhatsappWebhook] mensagem já processada (idempotente):", messageId);
    return { ok: true };
  }

  /**
   * 💬 Busca ou cria conversa ativa
   */
  const conversation = await findOrCreateConversation(phoneNumber);

  /**
   * 📝 Persiste mensagem do usuário no histórico da conversa
   */
  try {
    await saveUserMessage({
      conversationId: conversation.conversationId,
      messageId,
      text,
      phoneNumber,
    });
  } catch (err) {
    console.error("Erro ao salvar mensagem do usuário (histórico):", err);
  }

  /**
   * 🧠 Cria job de processamento
   */
  const jobRef = await db.collection("processing_jobs").add({
    traceId,
    phoneNumber,
    messageId,
    text,
    conversationId: conversation.conversationId,
    agentPhoneNumberId: conversation.agentPhoneNumberId,
    sessionId: conversation.adkSessionId,
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

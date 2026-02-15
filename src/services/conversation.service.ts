import { db } from "../firebase/firestore.js";

const CONVERSATION_EXPIRY_HOURS = 48;

export interface Conversation {
  conversationId: string;
  phoneNumber: string;
  agentPhoneNumberId: string;
  adkSessionId: string | null;
  status: "active" | "closed";
  startedAt: Date;
  lastMessageAt: Date;
  closedAt: Date | null;
}

/**
 * Busca ou cria uma conversa ativa para o número de telefone
 * - Verifica se existe conversa ativa (status="active")
 * - Verifica se não expirou (48h de inatividade)
 * - Se não encontrou ou expirou, cria nova conversa
 */
export async function findOrCreateConversation(
  phoneNumber: string
): Promise<Conversation> {
  const agentPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!agentPhoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado");
  }

  const now = new Date();
  const expiryThreshold = new Date(
    now.getTime() - CONVERSATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  // Busca conversa ativa para o telefone
  // ⚠️ NOTA: Requer índice composto no Firestore
  // Campos: phoneNumber (ASC), status (ASC), lastMessageAt (DESC)
  // O Firestore mostrará um link para criar o índice automaticamente na primeira execução
  const activeConversations = await db
    .collection("conversations")
    .where("phoneNumber", "==", phoneNumber)
    .where("status", "==", "active")
    .orderBy("lastMessageAt", "desc")
    .limit(1)
    .get();

  if (!activeConversations.empty) {
    const doc = activeConversations.docs[0];
    const data = doc.data();
    const lastMessageAt = data.lastMessageAt?.toDate() || data.startedAt?.toDate();

    // Verifica se não expirou
    if (lastMessageAt && lastMessageAt > expiryThreshold) {
      return {
        conversationId: doc.id,
        phoneNumber: data.phoneNumber,
        agentPhoneNumberId: data.agentPhoneNumberId,
        adkSessionId: data.adkSessionId || null,
        status: data.status,
        startedAt: data.startedAt?.toDate() || now,
        lastMessageAt: lastMessageAt,
        closedAt: data.closedAt?.toDate() || null,
      };
    } else {
      // Marca como fechada se expirou
      await doc.ref.update({
        status: "closed",
        closedAt: now,
      });
    }
  }

  // Cria nova conversa
  const newConversationRef = await db.collection("conversations").add({
    phoneNumber,
    agentPhoneNumberId,
    adkSessionId: null,
    status: "active",
    startedAt: now,
    lastMessageAt: now,
    closedAt: null,
  });

  return {
    conversationId: newConversationRef.id,
    phoneNumber,
    agentPhoneNumberId,
    adkSessionId: null,
    status: "active",
    startedAt: now,
    lastMessageAt: now,
    closedAt: null,
  };
}

/**
 * Atualiza o session_id do Vertex AI na conversa
 */
export async function updateConversationSessionId(
  conversationId: string,
  adkSessionId: string
): Promise<void> {
  await db.collection("conversations").doc(conversationId).update({
    adkSessionId,
  });
}

/**
 * Atualiza o timestamp da última mensagem da conversa
 */
export async function updateConversationLastMessage(
  conversationId: string
): Promise<void> {
  await db.collection("conversations").doc(conversationId).update({
    lastMessageAt: new Date(),
  });
}

/**
 * Retorna o lastMessageAt da conversa em formato ISO string (para uso na API do agente).
 */
export async function getLastMessageTimestamp(
  conversationId: string
): Promise<string | null> {
  const doc = await db.collection("conversations").doc(conversationId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const lastMessageAt = data?.lastMessageAt?.toDate?.();
  return lastMessageAt ? lastMessageAt.toISOString() : null;
}

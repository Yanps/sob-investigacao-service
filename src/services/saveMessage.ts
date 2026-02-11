import { db } from "../firebase/firestore.js";
import { FieldValue } from "firebase-admin/firestore";

const MESSAGES_SUBCOLLECTION = "messages";

export interface SaveUserMessageParams {
  conversationId: string;
  messageId: string;
  text: string | null;
  phoneNumber: string;
}

/**
 * Persiste a mensagem do usuário na subcollection da conversa para histórico.
 * Atualiza lastMessageAt da conversa para refletir a última atividade.
 */
export async function saveUserMessage(params: SaveUserMessageParams): Promise<void> {
  const { conversationId, messageId, text, phoneNumber } = params;

  const conversationRef = db.collection("conversations").doc(conversationId);
  const messagesRef = conversationRef.collection(MESSAGES_SUBCOLLECTION);
  const docId = String(messageId).replace(/\//g, "_").slice(0, 1500);

  await db.runTransaction(async (tx) => {
    tx.set(messagesRef.doc(docId), {
      from: "user",
      text: text ?? "",
      messageId,
      phoneNumber,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(conversationRef, {
      lastMessageAt: FieldValue.serverTimestamp(),
    });
  });
}

import { db } from "../firebase/firestore.js";
import { FieldValue } from "firebase-admin/firestore";

/** Normaliza telefone para 55 + dígitos (igual ao webhook.service). */
function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

/** Normaliza código para busca (trim + maiúsculas). */
function normalizeCode(code: string): string {
  return String(code).trim().toUpperCase();
}

export interface ActivateResult {
  success: boolean;
  message: string;
}

/**
 * Valida o código de gift card, marca como usado e cria um order sintético
 * para que hasAccessToAgent passe a retornar true para o telefone.
 */
export async function validateAndActivate(
  phoneNumber: string,
  code: string
): Promise<ActivateResult> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode || normalizedCode.length < 6) {
    return {
      success: false,
      message: "Código inválido. Verifique e tente novamente.",
    };
  }

  const snapshot = await db
    .collection("gift_cards")
    .where("code", "==", normalizedCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      success: false,
      message: "Código não encontrado ou já utilizado. Verifique e tente novamente.",
    };
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  if (data.used === true) {
    return {
      success: false,
      message: "Este código já foi utilizado.",
    };
  }

  const giftCardRef = doc.ref;
  const orderRef = db.collection("orders").doc();

  await db.runTransaction(async (tx) => {
    tx.update(giftCardRef, {
      used: true,
      usedAt: FieldValue.serverTimestamp(),
      usedByPhoneNumber: normalizedPhone,
    });
    tx.set(orderRef, {
      orderId: `gift_card_${orderRef.id}`,
      email: null,
      phoneNumber: normalizedPhone,
      phoneNumberAlt: normalizedPhone,
      name: null,
      cpf: null,
      products: ["Gift card ativado"],
      source: "gift_card",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    success: true,
    message:
      "Gift card ativado com sucesso! Agora você pode falar com o delegado. Envie uma nova mensagem para começar.",
  };
}

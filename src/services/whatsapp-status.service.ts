import fetch from "node-fetch";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL?.trim();
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

/**
 * Marca uma mensagem como lida (visualizado - dois checks azuis)
 * Envia imediatamente quando a mensagem é recebida
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  try {
    // 🔒 Validações fortes
    if (!WHATSAPP_API_URL) {
      console.warn("[markMessageAsRead] WHATSAPP_API_URL não configurado");
      return false;
    }

    if (!WHATSAPP_ACCESS_TOKEN) {
      console.warn("[markMessageAsRead] WHATSAPP_ACCESS_TOKEN não configurado");
      return false;
    }

    if (!WHATSAPP_PHONE_NUMBER_ID) {
      console.warn("[markMessageAsRead] WHATSAPP_PHONE_NUMBER_ID não configurado");
      return false;
    }

    if (!messageId) {
      console.warn("[markMessageAsRead] messageId não fornecido");
      return false;
    }

    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    console.log("[markMessageAsRead] Enviando read receipt para:", {
      messageId,
      url,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[markMessageAsRead] Erro ao marcar como lida:", {
        messageId,
        status: response.status,
        error: responseText,
      });
      return false;
    }

    console.log("[markMessageAsRead] ✅ Mensagem marcada como lida:", {
      messageId,
      status: response.status,
    });

    return true;
  } catch (error) {
    console.error("[markMessageAsRead] Exceção ao marcar como lida:", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Envia indicador de digitação (typing indicator) combinado com read receipt
 *
 * Conforme documentação oficial: https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators
 *
 * O message_id é OBRIGATÓRIO e marca a mensagem como lida automaticamente.
 * O indicador é desativado automaticamente após 25 segundos ou quando uma mensagem é enviada.
 */
export async function sendTypingIndicator(
  messageId: string,
  phoneNumberId?: string
): Promise<boolean> {
  try {
    // 🔒 Validações fortes
    if (!WHATSAPP_API_URL) {
      console.warn("[sendTypingIndicator] WHATSAPP_API_URL não configurado");
      return false;
    }

    if (!WHATSAPP_ACCESS_TOKEN) {
      console.warn("[sendTypingIndicator] WHATSAPP_ACCESS_TOKEN não configurado");
      return false;
    }

    // Usar o phoneNumberId fornecido ou o padrão
    const phoneId = phoneNumberId || WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneId) {
      console.warn("[sendTypingIndicator] WHATSAPP_PHONE_NUMBER_ID não configurado");
      return false;
    }

    if (!messageId) {
      console.warn("[sendTypingIndicator] messageId é obrigatório para typing indicator");
      return false;
    }

    const url = `${WHATSAPP_API_URL}/${phoneId}/messages`;

    // Payload conforme documentação oficial do WhatsApp
    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,           // OBRIGATÓRIO - marca como lida automaticamente
      typing_indicator: {
        type: "text",                  // Indica que está digitando texto
      },
    };

    console.log("[sendTypingIndicator] Enviando indicador de digitação:", {
      messageId,
      phoneId,
      url,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[sendTypingIndicator] Erro ao enviar typing indicator:", {
        messageId,
        status: response.status,
        error: responseText,
      });
      return false;
    }

    console.log("[sendTypingIndicator] ✅ Indicador de digitação enviado:", {
      messageId,
      status: response.status,
    });

    return true;
  } catch (error) {
    console.error("[sendTypingIndicator] Exceção ao enviar typing indicator:", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

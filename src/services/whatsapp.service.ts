import fetch from "node-fetch";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL?.trim();
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();


export async function sendWhatsAppMessage({
  to,
  text,
}: {
  to: string;
  text: string;
}) {
  // 🔒 Validações fortes (fail fast)
  if (!WHATSAPP_API_URL) {
    throw new Error("WHATSAPP_API_URL não configurado");
  }

  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado");
  }

  if (!WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado");
  }

  // ✅ URL CORRETA (igual ao Nest)
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to.replace(/[^\d]/g, ""), // normaliza telefone
    type: "text",
    text: {
      body: text,
    },
  };

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
    throw new Error(`WhatsApp API error: ${responseText}`);
  }

  // A API do WhatsApp às vezes retorna vazio ou texto
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

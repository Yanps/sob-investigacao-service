import fetch from "node-fetch";
import {
  WHATSAPP_API_URL,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_API_TOKEN,
} from "../config/whatsapp.config.js";

type SendMessageInput = {
  to: string;
  text: string;
};

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageInput) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
}

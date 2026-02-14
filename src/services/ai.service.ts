import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { db } from "../firebase/firestore.js";

const projectNumber = process.env.VERTEX_AI_PROJECT_NUMBER!;
const location = process.env.VERTEX_AI_LOCATION!;
const agentEngineId = process.env.VERTEX_AI_AGENT_ENGINE_ID!;

const reasoningEngineId = `projects/${projectNumber}/locations/${location}/reasoningEngines/${agentEngineId}`;
const apiEndpoint = `https://${location}-aiplatform.googleapis.com`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error("Não foi possível obter access token");
  }
  return accessToken.token;
}

export async function getUserEmail(
  phoneNumber: string
): Promise<string | null> {
  try {
    const ordersSnapshot = await db
      .collection("orders")
      .where("phoneNumber", "==", phoneNumber)
      .limit(1)
      .get();

    if (!ordersSnapshot.empty) {
      const orderData = ordersSnapshot.docs[0].data();
      if (orderData.email) {
        return orderData.email;
      }
    }

    const ordersAltSnapshot = await db
      .collection("orders")
      .where("phoneNumberAlt", "==", phoneNumber)
      .limit(1)
      .get();

    if (!ordersAltSnapshot.empty) {
      const orderData = ordersAltSnapshot.docs[0].data();
      if (orderData.email) {
        return orderData.email;
      }
    }

    return null;
  } catch (error) {
    console.error("Erro ao buscar email do usuário:", error);
    return null;
  }
}

export async function getUserName(phoneNumber: string): Promise<string> {
  try {
    const ordersSnapshot = await db
      .collection("orders")
      .where("phoneNumber", "==", phoneNumber)
      .limit(1)
      .get();

    if (!ordersSnapshot.empty) {
      const orderData = ordersSnapshot.docs[0].data();
      if (orderData.name) {
        return orderData.name.split(" ")[0];
      }
    }

    const ordersAltSnapshot = await db
      .collection("orders")
      .where("phoneNumberAlt", "==", phoneNumber)
      .limit(1)
      .get();

    if (!ordersAltSnapshot.empty) {
      const orderData = ordersAltSnapshot.docs[0].data();
      if (orderData.name) {
        return orderData.name.split(" ")[0];
      }
    }

    return "Investigador";
  } catch (error) {
    console.error("Erro ao buscar nome do usuário:", error);
    return "Investigador";
  }
}

export async function createVertexAISession(
  phoneNumber: string,
  userName?: string | null
): Promise<string> {
  const token = await getAccessToken();

  const name = userName || phoneNumber;
  const userId = `${name}|${phoneNumber}`;

  const response = await axios.post(
    `${apiEndpoint}/v1/${reasoningEngineId}/sessions`,
    { userId: userId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  let sessionId: string;

  if (response.data.name) {
    const match = response.data.name.match(/\/sessions\/(\d+)/);
    if (match) {
      sessionId = match[1];
    } else {
      throw new Error(
        `Formato de resposta inesperado: ${response.data.name}`
      );
    }
  } else if (response.data.id) {
    sessionId = response.data.id;
  } else {
    throw new Error("Não foi possível extrair session_id da resposta");
  }

  return sessionId;
}

/**
 * Busca o timestamp da última mensagem do usuário em uma conversa.
 * Retorna null se não houver mensagens anteriores.
 */
export async function getLastMessageTimestamp(
  conversationId: string
): Promise<string | null> {
  try {
    const messagesSnapshot = await db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .where("from", "==", "user")
      .orderBy("createdAt", "desc")
      .limit(2)
      .get();

    if (messagesSnapshot.docs.length < 2) {
      return null;
    }

    const previousMessage = messagesSnapshot.docs[1];
    const data = previousMessage.data();
    const createdAt = data.createdAt;

    if (createdAt && createdAt.toDate) {
      return createdAt.toDate().toISOString();
    }

    return null;
  } catch (error) {
    console.error("Erro ao buscar timestamp da última mensagem:", error);
    return null;
  }
}

export async function generateAIResponse({
  phoneNumber,
  text,
  sessionId,
  userName,
  lastMessageTimestamp,
}: {
  phoneNumber: string;
  text: string;
  sessionId: string;
  userName?: string | null;
  lastMessageTimestamp?: string | null;
}): Promise<{ response: string }> {
  const token = await getAccessToken();

  const name = userName || phoneNumber;
  const userId = `${name}|${phoneNumber}`;

  const url = `${apiEndpoint}/v1/${reasoningEngineId}:streamQuery`;

  const body = {
    classMethod: "stream_query",
    input: {
      message: text,
      user_id: userId,
      session_id: sessionId,
      ...(lastMessageTimestamp && { last_message_timestamp: lastMessageTimestamp }),
    },
  };

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    let fullResponse = "";
    let buffer = "";

    response.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = line.startsWith("data: ")
            ? JSON.parse(line.slice(6))
            : JSON.parse(line);

          if (json.content?.parts) {
            for (const part of json.content.parts) {
              if (part.text) {
                fullResponse += part.text;
              }
            }
          }

          // Log se houver erro na resposta da API
          if (json.error) {
            console.error("[AI_SERVICE_API_ERROR] Erro retornado pela API", {
              sessionId,
              phoneNumber,
              error: json.error,
            });
          }
        } catch (parseError) {
          console.warn("[AI_SERVICE_PARSE_WARNING] Falha ao parsear linha do stream", {
            sessionId,
            line: line.substring(0, 500),
            error: String(parseError),
          });
        }
      }
    });

    response.data.on("end", () => {
      const trimmedResponse = fullResponse.trim();

      if (!trimmedResponse) {
        console.error("[AI_SERVICE_EMPTY_RESPONSE] Resposta vazia do Vertex AI", {
          sessionId,
          phoneNumber,
          userId,
          inputText: text,
          fullResponseRaw: fullResponse,
          bufferRemaining: buffer,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("[AI_SERVICE_SUCCESS] Resposta gerada com sucesso", {
          sessionId,
          phoneNumber,
          responseLength: trimmedResponse.length,
        });
      }

      resolve({
        response: trimmedResponse || "Desculpe, não consegui gerar uma resposta agora.",
      });
    });

    response.data.on("error", (err: any) => {
      console.error("[AI_SERVICE_STREAM_ERROR] Erro no stream do Vertex AI", {
        sessionId,
        phoneNumber,
        error: err.message || err,
        stack: err.stack,
      });
      reject(err);
    });
  });
}

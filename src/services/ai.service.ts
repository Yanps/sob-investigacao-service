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

/** Estado da sessão do agente ADK (chaves usadas no callback_context.state). */
export interface VertexSessionState {
  jogo?: string | null;
  fase?: number | null;
  jogo_concluido?: boolean | null;
  nome_usuario?: string | null;
  user_phone?: string | null;
}

/**
 * Obtém o estado da sessão no Vertex AI Agent Engine (sessions.get).
 * Usado para persistir gameId, fase, gameCompleted, userName em agent_responses.
 */
export async function getVertexAISessionState(
  sessionId: string
): Promise<VertexSessionState | null> {
  try {
    const token = await getAccessToken();
    const sessionName = `${reasoningEngineId}/sessions/${sessionId}`;
    const url = `${apiEndpoint}/v1beta1/${sessionName}`;

    const response = await axios.get<{
      sessionState?: Record<string, unknown>;
    }>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = response.data as Record<string, unknown> | undefined;
    console.log("[getVertexAISessionState] raw response keys", data ? Object.keys(data) : []);
    const sessionStateRaw = data?.sessionState;
    console.log("[getVertexAISessionState] sessionState sample", sessionStateRaw != null ? JSON.stringify(sessionStateRaw).slice(0, 800) : "null/undefined");

    const raw = sessionStateRaw as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") {
      console.log("[getVertexAISessionState] sessionState vazio ou não é objeto, retornando null");
      return null;
    }

    const result = {
      jogo: raw.jogo as string | null | undefined,
      fase: raw.fase as number | null | undefined,
      jogo_concluido: raw.jogo_concluido as boolean | null | undefined,
      nome_usuario: raw.nome_usuario as string | null | undefined,
      user_phone: raw.user_phone as string | null | undefined,
    };
    console.log("[getVertexAISessionState] extraído", { sessionId, jogo: result.jogo, fase: result.fase, jogo_concluido: result.jogo_concluido });
    return result;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      console.warn("[getVertexAISessionState] Sessão não encontrada:", sessionId);
      return null;
    }
    console.error("[getVertexAISessionState] Erro ao obter estado da sessão:", err);
    return null;
  }
}

export async function generateAIResponse({
  phoneNumber,
  text,
  sessionId,
  userName,
}: {
  phoneNumber: string;
  text: string;
  sessionId: string;
  userName?: string | null;
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

          if (json.error) {
            console.error("[AI_SERVICE_API_ERROR] Erro retornado pela API", {
              sessionId,
              phoneNumber,
              error: json.error,
            });
          }
        } catch {
          // Linha incompleta ou não-JSON; ignora
        }
      }
    });

    response.data.on("end", () => {
      // Último fragmento que pode ter ficado no buffer
      if (buffer.trim()) {
        try {
          const json = buffer.startsWith("data: ")
            ? JSON.parse(buffer.slice(6))
            : JSON.parse(buffer);
          if (json.content?.parts) {
            for (const part of json.content.parts) {
              if (part.text) fullResponse += part.text;
            }
          }
        } catch {
          // ignora
        }
      }

      const trimmedResponse = fullResponse.trim();

      if (!trimmedResponse) {
        console.error("[AI_SERVICE_EMPTY_RESPONSE] Resposta vazia do Vertex AI", {
          sessionId,
          phoneNumber,
          userId,
          inputText: text?.substring(0, 200),
          timestamp: new Date().toISOString(),
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

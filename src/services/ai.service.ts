import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { db } from "../firebase/firestore.js";

const projectNumber = process.env.VERTEX_AI_PROJECT_NUMBER!;
const location = process.env.VERTEX_AI_LOCATION!;
const agentEngineId = process.env.VERTEX_AI_AGENT_ENGINE_ID!;

const agentEngineName = `projects/${projectNumber}/locations/${location}/reasoningEngines/${agentEngineId}`;
const apiEndpoint = `https://${location}-aiplatform.googleapis.com`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/**
 * Busca o email do usuário na coleção orders
 * @param phoneNumber Número de telefone do usuário
 * @returns Email do usuário ou null se não encontrado
 */
export async function getUserEmail(
  phoneNumber: string
): Promise<string | null> {
  try {
    // Busca na coleção orders por phoneNumber ou phoneNumberAlt
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

    // Se não encontrou, tenta buscar por phoneNumberAlt
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

/**
 * Cria uma sessão no Vertex AI (se suportado pela API)
 * Nota: A API pode não suportar criação explícita. Se retornar erro 400,
 * a sessão será criada automaticamente na primeira chamada.
 * @param userId Identificador do usuário (phoneNumber)
 * @param email Email do usuário (opcional)
 * @returns O ID da sessão ou null se não suportado
 */
export async function createVertexAISession(
  userId: string,
  email?: string | null
): Promise<string | null> {
  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error("Não foi possível obter access token");
    }

    const body: any = {
      context: {
        user_id: userId,
      },
    };

    // Adiciona email ao context se disponível
    if (email) {
      body.context.email = email;
    }

    const response = await axios.post(
      `${apiEndpoint}/v1/${agentEngineName}/sessions`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extrai o session_id do nome retornado
    // Formato: "projects/.../locations/.../reasoningEngines/.../sessions/SESSION_ID"
    const sessionName = response.data.name;
    if (!sessionName) {
      return null;
    }

    const sessionIdMatch = sessionName.match(/\/sessions\/([^\/]+)$/);
    if (!sessionIdMatch) {
      return null;
    }

    return sessionIdMatch[1];
  } catch (error: any) {
    // Se a API não suporta criação explícita (erro 400), retorna null
    // A sessão será criada automaticamente na primeira chamada
    if (error.response?.status === 400 || error.response?.status === 404) {
      console.warn(
        "⚠️ Criação explícita de sessão não suportada. A sessão será criada automaticamente."
      );
      return null;
    }
    // Re-throw outros erros
    throw error;
  }
}

export async function generateAIResponse({
  phoneNumber,
  text,
  sessionId,
  email,
}: {
  phoneNumber: string;
  text: string;
  sessionId?: string | null;
  email?: string | null;
}): Promise<{ response: string; sessionId?: string }> {
  // 1️⃣ Token
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Não foi possível obter access token");
  }

  // 2️⃣ Request body NO FORMATO OFICIAL
  const body: any = {
    classMethod: "stream_query",
    input: {
      user_id: phoneNumber,
      message: text,
    },
  };

  // Adiciona email ao input se disponível
  if (email) {
    body.input.email = email;
  }

  // 3️⃣ URL baseada na existência de sessionId
  const url = sessionId
    ? `${apiEndpoint}/v1/${agentEngineName}/sessions/${sessionId}:streamQuery`
    : `${apiEndpoint}/v1/${agentEngineName}:streamQuery`;

  // 4️⃣ Chamada STREAM
  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    responseType: "stream",
  });

  // 5️⃣ Ler o stream
  let fullResponse = "";
  let buffer = "";
  let capturedSessionId: string | undefined = undefined;

  return new Promise((resolve, reject) => {
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

          // Captura session_id se retornado na resposta
          if (json.session && !capturedSessionId) {
            const sessionName = json.session;
            const sessionIdMatch = sessionName.match(/\/sessions\/([^\/]+)$/);
            if (sessionIdMatch) {
              capturedSessionId = sessionIdMatch[1];
            }
          }

          // Formato padrão do Agent Engine
          if (json.content?.parts) {
            for (const part of json.content.parts) {
              if (part.text) {
                fullResponse += part.text;
              }
            }
          } else if (json.text) {
            fullResponse += json.text;
          }
        } catch {
          // fallback: texto puro
          fullResponse += line;
        }
      }
    });

    response.data.on("end", () => {
      resolve({
        response:
          fullResponse.trim() ||
          "Desculpe, não consegui gerar uma resposta agora.",
        sessionId: capturedSessionId,
      });
    });

    response.data.on("error", (err: any) => {
      reject(err);
    });
  });
}

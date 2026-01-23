import axios from "axios";
import { GoogleAuth } from "google-auth-library";

const projectNumber = process.env.VERTEX_AI_PROJECT_NUMBER!;
const location = process.env.VERTEX_AI_LOCATION!;
const agentEngineId = process.env.VERTEX_AI_AGENT_ENGINE_ID!;

const agentEngineName = `projects/${projectNumber}/locations/${location}/reasoningEngines/${agentEngineId}`;
const apiEndpoint = `https://${location}-aiplatform.googleapis.com`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/**
 * Cria uma sessão no Vertex AI
 * @param userId Identificador do usuário (phoneNumber)
 * @returns O ID da sessão extraído do nome retornado
 */
export async function createVertexAISession(
  userId: string
): Promise<string> {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Não foi possível obter access token");
  }

  const body = {
    context: {
      user_id: userId,
    },
  };

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
    throw new Error("Resposta do Vertex AI não contém nome da sessão");
  }

  const sessionIdMatch = sessionName.match(/\/sessions\/([^\/]+)$/);
  if (!sessionIdMatch) {
    throw new Error(`Formato de nome de sessão inválido: ${sessionName}`);
  }

  return sessionIdMatch[1];
}

export async function generateAIResponse({
  phoneNumber,
  text,
  sessionId,
}: {
  phoneNumber: string;
  text: string;
  sessionId?: string | null;
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

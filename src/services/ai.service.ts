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

export async function generateAIResponse({
  phoneNumber,
  text,
}: {
  phoneNumber: string;
  text: string;
}): Promise<string> {
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

  // 3️⃣ Chamada STREAM
  const response = await axios.post(
    `${apiEndpoint}/v1/${agentEngineName}:streamQuery`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
    }
  );

  // 4️⃣ Ler o stream
  let fullResponse = "";
  let buffer = "";

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
      resolve(
        fullResponse.trim() ||
          "Desculpe, não consegui gerar uma resposta agora."
      );
    });

    response.data.on("error", (err: any) => {
      reject(err);
    });
  });
}

/**
 * Teste de conversa com Vertex AI Agent Engine
 * 
 * Tradução da lógica Python para TypeScript, usando a mesma abordagem:
 * 1. Criar sessão com user_id no formato "nome|telefone"
 * 2. Enviar mensagens usando stream_query com session_id
 * 
 * Uso:
 *   npx tsx test-conversation.ts
 *   
 *   # Modo automático:
 *   npx tsx test-conversation.ts "oi" "1"
 *   
 *   # Com debug:
 *   DEBUG=1 npx tsx test-conversation.ts "oi" "1"
 */

import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import * as readline from "readline";

// Configuração - mesma do Python
const LOCATION = "us-central1";
const REASONING_ENGINE_ID = "projects/792752015826/locations/us-central1/reasoningEngines/8722290503216791552";
const API_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Seus dados
const USER_NAME = "cleiton";
const PHONE = "558596262184";

// Cache de sessões (igual ao Python)
const sessionsCache: Map<string, string> = new Map();

// Estado global
let currentSessionId: string | null = null;
let currentUserId: string | null = null;

/**
 * Obtém o access token para autenticação
 */
async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error("Não foi possível obter access token");
  }
  return accessToken.token;
}

/**
 * Cria uma sessão no Agent Engine
 * Equivalente ao create_session do Python
 * 
 * A API retorna uma operação assíncrona no formato:
 * { "name": "projects/.../sessions/SESSION_ID/operations/OP_ID", ... }
 * 
 * Extraímos o session_id do path.
 */
async function createSession(userName: string, phone: string): Promise<{ sessionId: string; userId: string }> {
  const token = await getAccessToken();
  
  // Formato user_id: "nome|telefone" (igual ao Python)
  let userId = userName;
  if (phone && !userId.includes("|")) {
    userId = `${userName}|${phone}`;
  }
  
  console.log("🔄 Criando sessão...");
  console.log(`   user_id: ${userId}`);
  
  // Chamada REST equivalente ao remote_agent_engine.create_session(user_id=user_id)
  const response = await axios.post(
    `${API_ENDPOINT}/v1/${REASONING_ENGINE_ID}/sessions`,
    { userId: userId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  
  // A resposta é uma operação assíncrona no formato:
  // { "name": "projects/.../sessions/SESSION_ID/operations/OP_ID", ... }
  // Extraímos o session_id do path
  let sessionId: string;
  
  if (response.data.name) {
    // Formato: "projects/.../sessions/SESSION_ID/operations/OP_ID"
    const match = response.data.name.match(/\/sessions\/(\d+)/);
    if (match) {
      sessionId = match[1];
    } else {
      // Fallback: último segmento
      sessionId = response.data.name.split("/").pop()!;
    }
  } else if (response.data.id) {
    sessionId = response.data.id;
  } else {
    throw new Error("Não foi possível extrair session_id da resposta");
  }
  
  // Salva no cache (igual ao Python)
  sessionsCache.set(sessionId, userId);
  
  console.log(`✅ Sessão criada: ${sessionId}`);
  
  return { sessionId, userId };
}

/**
 * Envia mensagem usando stream_query
 * Equivalente ao chat do Python com async_stream_query
 * 
 * IMPORTANTE: O endpoint é sempre :streamQuery no reasoning engine,
 * e o session_id vai no body (input), não na URL.
 */
async function sendMessage(message: string, sessionId: string, userId: string): Promise<string> {
  const token = await getAccessToken();
  
  console.log(`\n📤 Enviando: "${message}"`);
  
  // O endpoint é sempre o mesmo, session_id vai no input
  const url = `${API_ENDPOINT}/v1/${REASONING_ENGINE_ID}:streamQuery`;
  
  console.log(`🔗 URL: ${url}`);
  console.log(`🔑 Session: ${sessionId}`);
  
  const body = {
    classMethod: "stream_query",
    input: {
      message: message,
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
    let responseText = "";
    let buffer = "";
    let rawData = "";
    const events: string[] = [];
    
    response.data.on("data", (chunk: Buffer) => {
      const chunkStr = chunk.toString();
      rawData += chunkStr;
      buffer += chunkStr;
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        events.push(line);
        
        try {
          const json = line.startsWith("data: ")
            ? JSON.parse(line.slice(6))
            : JSON.parse(line);
          
          // Extrai texto da resposta (igual ao Python)
          // if hasattr(event, 'content') and event.content:
          //   if hasattr(event.content, 'parts'):
          //     for part in event.content.parts:
          //       if hasattr(part, 'text') and part.text:
          //         response_text += part.text
          if (json.content?.parts) {
            for (const part of json.content.parts) {
              if (part.text) {
                responseText += part.text;
              }
            }
          }
        } catch {
          // Ignora linhas que não são JSON válido
        }
      }
    });
    
    response.data.on("end", () => {
      if (process.env.DEBUG) {
        console.log("\n🔍 DEBUG - Eventos recebidos:");
        events.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 200)}...`));
      }
      resolve(responseText.trim() || "Sem resposta");
    });
    
    response.data.on("error", reject);
  });
}

/**
 * Função principal
 */
async function main() {
  console.log("🤖 Teste de Conversa com Vertex AI Agent");
  console.log(`👤 Nome: ${USER_NAME}`);
  console.log(`📱 Telefone: ${PHONE}`);
  console.log("─".repeat(50));
  
  try {
    // 1. Criar sessão (igual ao Python: POST /session)
    const { sessionId, userId } = await createSession(USER_NAME, PHONE);
    currentSessionId = sessionId;
    currentUserId = userId;
    
    // Modo automático: executa sequência de mensagens predefinidas
    const autoMessages = process.argv.slice(2);
    
    if (autoMessages.length > 0) {
      console.log("\n🤖 Modo automático - enviando mensagens:", autoMessages);
      
      for (const msg of autoMessages) {
        const response = await sendMessage(msg, currentSessionId, currentUserId);
        console.log(`\n📥 Resposta:\n${response}`);
        console.log("─".repeat(50));
      }
      
      console.log("\n👋 Conversa automática encerrada!");
      return;
    }
    
    // Modo interativo
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const ask = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));
    
    console.log("\n🚀 Sessão criada! Iniciando conversa...");
    
    // Mensagem inicial: "oi"
    const response1 = await sendMessage("oi", currentSessionId, currentUserId);
    console.log(`\n📥 Resposta:\n${response1}`);
    console.log("─".repeat(50));
    
    await ask("\nPressione ENTER para enviar próxima mensagem (opção 1)...");
    
    // Selecionar opção 1
    const response2 = await sendMessage("1", currentSessionId, currentUserId);
    console.log(`\n📥 Resposta:\n${response2}`);
    console.log("─".repeat(50));
    
    // Loop interativo
    while (true) {
      const input = await ask("\n💬 Sua mensagem (ou 'sair' para encerrar): ");
      if (input.toLowerCase() === "sair") break;
      
      const response = await sendMessage(input, currentSessionId, currentUserId);
      console.log(`\n📥 Resposta:\n${response}`);
      console.log("─".repeat(50));
    }
    
    console.log("\n👋 Conversa encerrada!");
    rl.close();
    
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    if (error.response?.data) {
      // Tenta ler o erro do stream se for um stream
      if (typeof error.response.data === "object" && error.response.data.on) {
        let errorData = "";
        error.response.data.on("data", (chunk: Buffer) => {
          errorData += chunk.toString();
        });
        error.response.data.on("end", () => {
          console.error("📋 Detalhes:", errorData);
        });
      } else {
        console.error("📋 Detalhes:", JSON.stringify(error.response.data, null, 2));
      }
    }
    process.exit(1);
  }
}

main();

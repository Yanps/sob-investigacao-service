/**
 * Verificação de conteúdo antes de persistir em agent_responses:
 * - ofensas/palavrões
 * - desistência (usuário ou resposta indicando volta ao menu / desistir)
 */

/** Normaliza texto para comparação: minúsculas, sem acentos. */
function normalizeForCheck(text: string): string {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Lista de termos ofensivos/palavrões (pt-BR). Pode ser expandida ou externalizada. */
const OFFENSIVE_TERMS = [
  "caralho",
  "porra",
  "merda",
  "puta",
  "puto",
  "foda",
  "foder",
  "fodido",
  "viado",
  "buceta",
  "vagabunda",
  "vagabundo",
  "idiota",
  "imbecil",
  "estupido",
  "estupida",
  "palhaco",
  "otario",
  "babaca",
  "retardado",
  "nojinho",
  "nojento",
  "lixo",
  "lixao",
  "arrombado",
  "arrombada",
  "cu",
  "cuzão",
  "cuzao",
  "vai se fuder",
  "vai tomar",
  "vtnc",
  "vtmnc",
  "pqp",
  "fdp",
];

/** Indica se o texto contém ofensas/palavrões. */
export function hasOffense(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizeForCheck(text);
  const words = normalized.split(/\s+/);
  for (const term of OFFENSIVE_TERMS) {
    if (term.includes(" ")) {
      if (normalized.includes(term)) return true;
    } else {
      if (words.some((w) => w === term || w.startsWith(term) || w.endsWith(term)))
        return true;
    }
  }
  return false;
}

/** Termos que indicam desistência na mensagem do usuário. */
const DESISTENCIA_USER_TERMS = [
  "desistir",
  "desisto",
  "quero sair",
  "voltar ao menu",
  "voltar pro menu",
  "voltar no menu",
  "nao quero mais",
  "não quero mais",
  "parar",
  "abandonar",
  "deixo pra la",
  "deixo pra lá",
  "cansei",
  "desisti",
  "sair do jogo",
  "sair da investigacao",
  "sair da investigação",
  "opcao 0",
  "opção 0",
  "numero 0",
  "número 0",
];

/** Frases na resposta do agente que indicam volta ao menu / desistência. */
const DESISTENCIA_RESPONSE_PHRASES = [
  "voltando ao menu principal",
  "voltar ao menu",
  "menu principal",
  "volte ao menu",
];

/**
 * Indica se há sinal de desistência: na pergunta do usuário ou na resposta do agente.
 */
export function hasDesistencia(
  question: string | null | undefined,
  responseText: string | null | undefined
): boolean {
  const normQuestion = question ? normalizeForCheck(question) : "";
  const normResponse = responseText ? normalizeForCheck(responseText) : "";

  for (const term of DESISTENCIA_USER_TERMS) {
    if (normQuestion.includes(term)) return true;
  }
  for (const phrase of DESISTENCIA_RESPONSE_PHRASES) {
    if (normResponse.includes(phrase)) return true;
  }
  return false;
}

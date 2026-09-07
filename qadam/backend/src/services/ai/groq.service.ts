import { aiConfig } from "../../config/ai";
import { httpJson } from "../../lib/http";
import { AIProviderError } from "../../utils/errors";
import { logger } from "../../utils/logger";

const GROQ_TIMEOUT_MS = 30_000;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GenerateTextParams {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateText(params: GenerateTextParams): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.7, maxTokens = 2048 } = params;

  if (!prompt.trim()) {
    throw new AIProviderError("EMPTY_RESPONSE", "groq", "Cannot generate text from an empty prompt");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  messages.push({ role: "user", content: prompt });

  let response: GroqResponse;
  try {
    response = await httpJson<GroqResponse>(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.groq.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.groq.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      timeoutMs: GROQ_TIMEOUT_MS,
    });
  } catch (err) {
    throw classifyProviderFailure(err, "groq", GROQ_TIMEOUT_MS, "Groq");
  }

  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AIProviderError("MALFORMED_RESPONSE", "groq", "Groq response missing choices[0].message.content");
  }
  if (!text.trim()) {
    throw new AIProviderError("EMPTY_RESPONSE", "groq", "Groq returned an empty string");
  }
  return text.trim();
}

function classifyProviderFailure(
  err: unknown,
  provider: "groq",
  timeoutMs: number,
  label: string
): AIProviderError {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes("abort")) {
    return new AIProviderError("TIMEOUT", provider, `${label} request timed out after ${timeoutMs}ms`);
  }
  if (message.includes("HTTP 429")) {
    return new AIProviderError("RATE_LIMITED", provider, message);
  }
  logger.warn(`${label} network/HTTP error`, { message });
  return new AIProviderError("NETWORK_ERROR", provider, message);
}
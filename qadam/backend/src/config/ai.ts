import { env } from "./env";

export const aiConfig = {
  gemini: {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  },
  groq: {
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL,
  },
  openRouter: {
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
  },
  huggingFace: {
    token: env.HF_TOKEN,
    embeddingModel: env.HF_EMBEDDING_MODEL,
  },
  bigDataCloud: {
    apiKey: env.BDC_API_KEY,
  },
};

import { env } from "./env";

export const aiConfig = {
  gemini: {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  },
  qwen: {
    apiKey: env.DASHSCOPE_API_KEY,
    model: env.QWEN_MODEL,
  },
  huggingFace: {
    token: env.HF_TOKEN,
    embeddingModel: env.HF_EMBEDDING_MODEL,
  },
  bigDataCloud: {
    apiKey: env.BDC_API_KEY,
  },
};

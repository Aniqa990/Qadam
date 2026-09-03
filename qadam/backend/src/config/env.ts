import "dotenv/config";
import { z } from "zod";

/**
 * Fail fast, fail loud: if a required secret is missing, the process should
 * refuse to start rather than crash later mid-request with a cryptic error.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required"),

  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),

  DASHSCOPE_API_KEY: z.string().min(1).optional().default("placeholder"),
  QWEN_MODEL: z.string().default("qwen-turbo"),

  HF_TOKEN: z.string().min(1, "HF_TOKEN is required"),
  HF_EMBEDDING_MODEL: z.string().default("sentence-transformers/all-MiniLM-L6-v2"),

  BDC_API_KEY: z.string().min(1, "BDC_API_KEY is required"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid or missing environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Environment validation failed. See errors above and check .env against .env.example.");
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;

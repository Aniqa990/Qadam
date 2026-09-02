import { env } from "./env";

export const supabaseConfig = {
  url: env.SUPABASE_URL,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
};

import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../config/supabase";

/**
 * Backend-only Supabase client using the SERVICE ROLE key.
 * Never import this file from anything that runs in the browser.
 * The frontend never talks to Supabase directly - all data access
 * goes through the Express API (see architecture.md Security Model).
 */
export const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/** Private Supabase Storage access; import this module from server routes only. */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const NOMINATION_BUCKET = "nomination-letters";
let client: SupabaseClient | undefined;

export function getStorageClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY is not configured");
  if (!client) {
    client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { "X-Client-Info": "gorton-nomination-server" } }
    });
  }
  return client;
}

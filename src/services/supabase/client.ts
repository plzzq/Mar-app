/* ------------------------------------------------------------------ */
/* Cliente Supabase — fonte oficial futura dos dados operacionais.    */
/* - Ativa automaticamente quando VITE_SUPABASE_URL e                */
/*   VITE_SUPABASE_ANON_KEY estiverem configuradas.                   */
/* - NUNCA exponha service_role ou segredos no frontend: apenas a     */
/*   chave pública (anon) é usada, com RLS no banco.                  */
/* - Sem configuração, os serviços usam o armazenamento local.        */
/* ------------------------------------------------------------------ */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** true quando o backend Supabase está configurado. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** Origem atual dos dados (para exibir na interface). */
export function dataSourceLabel(): string {
  return isSupabaseConfigured() ? "Supabase" : "Dados locais (etapa anterior ao Supabase)";
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

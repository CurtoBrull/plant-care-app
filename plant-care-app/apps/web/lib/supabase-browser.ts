import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

/**
 * Singleton del cliente Supabase para el navegador.
 * Usa variables de entorno NEXT_PUBLIC_ disponibles en cliente y servidor.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!instance) {
    instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return instance
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Inicializa el cliente Supabase. Debe llamarse una vez al arrancar la app
 * (en web: layout.tsx / en móvil: _layout.tsx) antes de usar cualquier servicio.
 */
export function initSupabase(url: string, anonKey: string): SupabaseClient {
  _client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  })
  return _client
}

/**
 * Devuelve el cliente Supabase ya inicializado.
 * Lanza si se llama antes de `initSupabase`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    throw new Error(
      'Supabase no está inicializado. Llama a initSupabase(url, anonKey) primero.',
    )
  }
  return _client
}

/** Permite inyectar un cliente externo (útil en tests). */
export function setSupabaseClient(client: SupabaseClient): void {
  _client = client
}

'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@plant-care/core'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

// ---------------------------------------------------------------------------
// Helper: mapea el usuario de Supabase al tipo de dominio
// ---------------------------------------------------------------------------

function mapSupabaseUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id: u.id,
    email: u.email ?? '',
    displayName:
      (u.user_metadata?.['full_name'] as string | undefined) ??
      (u.user_metadata?.['name'] as string | undefined) ??
      (u.email?.split('@')[0] ?? ''),
    notificationsEnabled: true,
    reminderTime: '08:00',
    fcmToken: undefined,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthCtx {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signOut: async () => { },
})

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    // Leer sesión inicial de forma asíncrona
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
      setLoading(false)
    })

    // Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await getSupabaseBrowser().auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext)
}

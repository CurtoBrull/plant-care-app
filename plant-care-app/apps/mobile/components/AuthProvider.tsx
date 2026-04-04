import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@plant-care/core'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Map Supabase user → domain User
// ---------------------------------------------------------------------------

function mapUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id:                   u.id,
    email:                u.email ?? '',
    displayName:
      (u.user_metadata?.['full_name'] as string | undefined) ??
      (u.user_metadata?.['name']      as string | undefined) ??
      (u.email?.split('@')[0] ?? ''),
    notificationsEnabled: true,
    reminderTime:         '08:00',
    fcmToken:             undefined,
    createdAt:            new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user:    User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load initial session
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapUser(session.user) : null)
      setLoading(false)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

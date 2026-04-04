'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getAuthService } from '@/lib/services'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (!loading && user) router.replace('/plants')
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await getAuthService().signInWithEmail(email, password)
      router.replace('/plants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await getAuthService().signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google')
    }
  }

  async function handleApple() {
    setError('')
    try {
      await getAuthService().signInWithApple()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Apple')
    }
  }

  if (loading) return null

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>🌿 Plant Care</h1>
        <p className="subtitle">Inicia sesión en tu cuenta</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? <><span className="spinner" /> Entrando…</> : 'Iniciar sesión'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.25rem 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <button onClick={handleGoogle} className="btn btn-secondary btn-full">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M46.5 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h12.7c-.5 3-2.2 5.5-4.6 7.2v6h7.4c4.4-4 6.9-9.9 6.9-17z"/>
              <path fill="#34A853" d="M24 47.5c6.5 0 12-2.2 16-5.9l-7.4-6c-2.2 1.5-5 2.3-8.6 2.3-6.6 0-12.2-4.4-14.2-10.4H2.1v6.2C6.1 42.3 14.4 47.5 24 47.5z"/>
              <path fill="#FBBC05" d="M9.8 28.5A14.7 14.7 0 0 1 9 24c0-1.6.3-3.1.8-4.5v-6.2H2.1A23.5 23.5 0 0 0 .5 24c0 3.8.9 7.4 2.5 10.7l7.2-5.9-.4-.3z"/>
              <path fill="#EA4335" d="M24 9.4c3.7 0 7 1.3 9.6 3.8l7.2-7.2C36 2 30.5-.5 24-.5 14.4-.5 6.1 4.7 2.1 13.3l7.7 6c2-6 7.6-9.9 14.2-9.9z"/>
            </svg>
            Continuar con Google
          </button>
          <button onClick={handleApple} className="btn btn-secondary btn-full">
            <svg width="18" height="18" viewBox="0 0 814 1000">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.3-57.8-155.4-127.8C34.7 812.2 0 710.7 0 611.5c0-223.5 147.4-341.3 292.9-341.3 76.6 0 140.5 50.3 188.8 50.3 44.8 0 114.8-52.9 197.4-52.9 31.9 0 107.2 2.6 171.4 80.9z"/>
            </svg>
            Continuar con Apple
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '.875rem', color: 'var(--text-muted)' }}>
          ¿No tienes cuenta?{' '}
          <Link href="/register" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}

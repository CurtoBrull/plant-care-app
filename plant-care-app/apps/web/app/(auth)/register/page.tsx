'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getAuthService } from '@/lib/services'

export default function RegisterPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [password2,  setPassword2]  = useState('')
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/plants')
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setSubmitting(true)
    try {
      await getAuthService().registerWithEmail(email, password)
      setSuccess('Cuenta creada. Revisa tu correo para confirmar el registro.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la cuenta')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>🌿 Plant Care</h1>
        <p className="subtitle">Crea tu cuenta</p>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {!success && (
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
                autoComplete="new-password"
                minLength={6}
              />
              <p className="form-hint">Mínimo 6 caracteres</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password2">Repetir contraseña</label>
              <input
                id="password2"
                type="password"
                className="form-input"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? <><span className="spinner" /> Creando cuenta…</> : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '.875rem', color: 'var(--text-muted)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 500 }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

import type { User } from '../models/user'

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export enum AuthErrorCode {
  EMAIL_ALREADY_IN_USE   = 'AUTH_EMAIL_ALREADY_IN_USE',
  INVALID_CREDENTIALS    = 'AUTH_INVALID_CREDENTIALS',
  SESSION_NOT_FOUND      = 'AUTH_SESSION_NOT_FOUND',
  PROVIDER_ERROR         = 'AUTH_PROVIDER_ERROR',
  UNKNOWN               = 'AUTH_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IAuthService {
  registerWithEmail(email: string, password: string, displayName?: string): Promise<User>
  signInWithEmail(email: string, password: string): Promise<User>
  signInWithGoogle(): Promise<User>
  signInWithApple(): Promise<User>
  signOut(): Promise<void>
  getCurrentUser(): User | null
  getMe(): Promise<User | null>
}

// ---------------------------------------------------------------------------
// Implementación conectada a Neon Auth API
// ---------------------------------------------------------------------------

export class AuthService implements IAuthService {
  private readonly baseUrl: string
  private cachedUser: User | null = null

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  async registerWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409) {
          throw new AuthError(
            AuthErrorCode.EMAIL_ALREADY_IN_USE,
            data.error || 'El correo electrónico ya está en uso. Prueba a iniciar sesión.',
          )
        }
        throw new AuthError(
          AuthErrorCode.UNKNOWN,
          data.error || 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
        )
      }

      this.cachedUser = data.user as User
      return this.cachedUser
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError(
        AuthErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al registrar usuario',
      )
    }
  }

  // ── Inicio de sesión email/password ───────────────────────────────────────

  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          throw new AuthError(
            AuthErrorCode.INVALID_CREDENTIALS,
            data.error || 'Credenciales incorrectas. Revisa tus datos e inténtalo de nuevo.',
          )
        }
        throw new AuthError(
          AuthErrorCode.UNKNOWN,
          data.error || 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
        )
      }

      this.cachedUser = data.user as User
      return this.cachedUser
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError(
        AuthErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al iniciar sesión',
      )
    }
  }

  // ── OAuth: Google ─────────────────────────────────────────────────────────

  async signInWithGoogle(): Promise<User> {
    throw new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      'Para autenticación con Google, utiliza el inicio de sesión con email y contraseña.',
    )
  }

  // ── OAuth: Apple ──────────────────────────────────────────────────────────

  async signInWithApple(): Promise<User> {
    throw new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      'Para autenticación con Apple, utiliza el inicio de sesión con email y contraseña.',
    )
  }

  // ── Cierre de sesión ──────────────────────────────────────────────────────

  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
      })
      this.cachedUser = null
    } catch {
      this.cachedUser = null
    }
  }

  // ── Usuario actual (síncrono) ─────────────────────────────────────────────

  getCurrentUser(): User | null {
    return this.cachedUser
  }

  // ── Obtener usuario de sesión activo (asíncrono) ───────────────────────────

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`)
      if (!res.ok) return null
      const data = await res.json()
      this.cachedUser = (data.user || null) as User | null
      return this.cachedUser
    } catch {
      return null
    }
  }
}

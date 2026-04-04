import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '../models/user'
import { getSupabaseClient } from '../lib/supabase-client'

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
  registerWithEmail(email: string, password: string): Promise<User>
  signInWithEmail(email: string, password: string): Promise<User>
  signInWithGoogle(): Promise<User>
  signInWithApple(): Promise<User>
  signOut(): Promise<void>
  getCurrentUser(): User | null
}

// ---------------------------------------------------------------------------
// Mensajes genéricos (Requisito 1.6 — no revelar qué campo falló)
// ---------------------------------------------------------------------------

const MSG_INVALID_CREDENTIALS = 'Credenciales incorrectas. Revisa tus datos e inténtalo de nuevo.'
const MSG_EMAIL_IN_USE        = 'El correo electrónico ya está en uso. Prueba a iniciar sesión.'
const MSG_PROVIDER_ERROR      = 'Error al iniciar sesión con el proveedor. Inténtalo de nuevo.'
const MSG_UNKNOWN             = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.'

// Palabras clave que Supabase puede devolver para credenciales inválidas
const INVALID_CREDENTIAL_PATTERNS = [
  'invalid login credentials',
  'invalid password',
  'invalid email',
  'email not confirmed',
  'wrong password',
]

const EMAIL_IN_USE_PATTERNS = [
  'user already registered',
  'email already in use',
  'email address is already',
]

function classifySupabaseError(message: string): AuthErrorCode {
  const lower = message.toLowerCase()
  if (EMAIL_IN_USE_PATTERNS.some((p) => lower.includes(p))) {
    return AuthErrorCode.EMAIL_ALREADY_IN_USE
  }
  if (INVALID_CREDENTIAL_PATTERNS.some((p) => lower.includes(p))) {
    return AuthErrorCode.INVALID_CREDENTIALS
  }
  return AuthErrorCode.UNKNOWN
}

// ---------------------------------------------------------------------------
// Mapper: Supabase User → dominio User
// ---------------------------------------------------------------------------

function mapUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    displayName:
      (supabaseUser.user_metadata?.['full_name'] as string | undefined) ??
      (supabaseUser.user_metadata?.['name'] as string | undefined) ??
      (supabaseUser.email?.split('@')[0] ?? ''),
    notificationsEnabled: true,
    reminderTime: '08:00',
    fcmToken: undefined,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class AuthService implements IAuthService {
  private readonly db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseClient()
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  async registerWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await this.db.auth.signUp({ email, password })

    if (error) {
      const code = classifySupabaseError(error.message)
      const msg =
        code === AuthErrorCode.EMAIL_ALREADY_IN_USE ? MSG_EMAIL_IN_USE : MSG_UNKNOWN
      throw new AuthError(code, msg)
    }

    if (!data.user) {
      throw new AuthError(AuthErrorCode.UNKNOWN, MSG_UNKNOWN)
    }

    return mapUser(data.user)
  }

  // ── Inicio de sesión email/password ───────────────────────────────────────

  async signInWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await this.db.auth.signInWithPassword({ email, password })

    if (error) {
      const code = classifySupabaseError(error.message)
      // Requisito 1.6: mensaje genérico sin revelar qué campo falló
      const msg =
        code === AuthErrorCode.INVALID_CREDENTIALS
          ? MSG_INVALID_CREDENTIALS
          : MSG_UNKNOWN
      throw new AuthError(code, msg)
    }

    if (!data.user) {
      throw new AuthError(AuthErrorCode.UNKNOWN, MSG_UNKNOWN)
    }

    return mapUser(data.user)
  }

  // ── OAuth: Google ─────────────────────────────────────────────────────────

  async signInWithGoogle(): Promise<User> {
    const { error } = await this.db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${globalThis.location?.origin ?? ''}/auth/callback` },
    })

    if (error) {
      throw new AuthError(AuthErrorCode.PROVIDER_ERROR, MSG_PROVIDER_ERROR)
    }

    // signInWithOAuth inicia un redirect; el usuario llega con sesión activa
    // tras el callback. Devolvemos el usuario actual si ya existe.
    return this._requireCurrentUser()
  }

  // ── OAuth: Apple ──────────────────────────────────────────────────────────

  async signInWithApple(): Promise<User> {
    const { error } = await this.db.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${globalThis.location?.origin ?? ''}/auth/callback` },
    })

    if (error) {
      throw new AuthError(AuthErrorCode.PROVIDER_ERROR, MSG_PROVIDER_ERROR)
    }

    return this._requireCurrentUser()
  }

  // ── Cierre de sesión ──────────────────────────────────────────────────────

  async signOut(): Promise<void> {
    const { error } = await this.db.auth.signOut()
    if (error) {
      throw new AuthError(AuthErrorCode.UNKNOWN, MSG_UNKNOWN)
    }
  }

  // ── Usuario actual (síncrono) ─────────────────────────────────────────────

  getCurrentUser(): User | null {
    const session = this.db.auth.getSession()
    // getSession() devuelve una Promise; para acceso síncrono usamos la caché interna
    const supabaseUser = (this.db as unknown as { auth: { currentUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null } }).auth.currentUser
    return supabaseUser ? mapUser(supabaseUser) : null
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private _requireCurrentUser(): User {
    const user = this.getCurrentUser()
    if (!user) {
      throw new AuthError(AuthErrorCode.SESSION_NOT_FOUND, MSG_UNKNOWN)
    }
    return user
  }
}

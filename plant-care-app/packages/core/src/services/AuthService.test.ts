/**
 * Feature: plant-care-app
 *
 * Property 1: Mensaje de error de credenciales no revela campo fallido
 *   Para cualquier par (email, password) inválido, el mensaje de error no
 *   debe contener referencias específicas al campo "email" ni "password".
 *   Valida: Requisito 1.6
 *
 * Tests unitarios:
 *   Registro exitoso, login exitoso, correo duplicado, credenciales incorrectas,
 *   cierre de sesión.
 *   Valida: Requisitos 1.1–1.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { AuthService, AuthError, AuthErrorCode } from './AuthService'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Helpers para construir mocks del cliente Supabase
// ---------------------------------------------------------------------------

type AuthMock = {
  signUp: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signInWithOAuth: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  getSession: ReturnType<typeof vi.fn>
  currentUser: object | null
}

function makeClient(authOverrides: Partial<AuthMock> = {}): SupabaseClient {
  const auth: AuthMock = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    currentUser: null,
    ...authOverrides,
  }
  return { auth } as unknown as SupabaseClient
}

const fakeSupabaseUser = {
  id: 'user-uuid-1234',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
}

// ---------------------------------------------------------------------------
// P1 — Propiedad: mensaje de error no revela campo fallido
// ---------------------------------------------------------------------------

describe('P1 — Mensaje de error no revela campo fallido (Requisito 1.6)', () => {
  it('el mensaje de INVALID_CREDENTIALS no menciona "email" ni "password" de forma aislada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 64 }),
        async (email, password) => {
          const client = makeClient({
            signInWithPassword: vi.fn().mockResolvedValue({
              data: { user: null, session: null },
              error: { message: 'Invalid login credentials' },
            }),
          })
          const service = new AuthService(client)

          const err = await service.signInWithEmail(email, password).catch((e: AuthError) => e)
          // El mensaje no debe revelar exactamente qué campo falló
          const msg = err.message.toLowerCase()
          expect(err).toBeInstanceOf(AuthError)
          expect(err.code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
          // No debe contener "email incorrecto", "contraseña incorrecta", etc.
          expect(msg).not.toMatch(/\bemail incorrecto\b/)
          expect(msg).not.toMatch(/\bcontraseña incorrecta\b/)
          expect(msg).not.toMatch(/\bpassword incorrecto\b/)
          expect(msg).not.toMatch(/\bpassword is wrong\b/)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('el mensaje de EMAIL_ALREADY_IN_USE no menciona la contraseña', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), fc.string({ minLength: 8 }), async (email, password) => {
        const client = makeClient({
          signUp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { message: 'User already registered' },
          }),
        })
        const service = new AuthService(client)

        const err = await service.registerWithEmail(email, password).catch((e: AuthError) => e)
        expect(err.code).toBe(AuthErrorCode.EMAIL_ALREADY_IN_USE)
        expect(err.message.toLowerCase()).not.toMatch(/\bpassword\b/)
        expect(err.message.toLowerCase()).not.toMatch(/\bcontraseña\b/)
      }),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios de flujos de autenticación
// ---------------------------------------------------------------------------

describe('AuthService — flujos de autenticación', () => {
  let service: AuthService
  let client: SupabaseClient

  // ── Registro ──────────────────────────────────────────────────────────────

  describe('registerWithEmail', () => {
    it('registra un usuario y devuelve User mapeado (Requisito 1.1)', async () => {
      client = makeClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: fakeSupabaseUser, session: {} },
          error: null,
        }),
      })
      service = new AuthService(client)

      const user = await service.registerWithEmail('test@example.com', 'SecurePass1!')
      expect(user.id).toBe(fakeSupabaseUser.id)
      expect(user.email).toBe(fakeSupabaseUser.email)
      expect(user.displayName).toBe('Test User')
    })

    it('lanza EMAIL_ALREADY_IN_USE si el correo ya existe (Requisito 1.4)', async () => {
      client = makeClient({
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'User already registered' },
        }),
      })
      service = new AuthService(client)

      await expect(service.registerWithEmail('dupe@example.com', 'Pass123!')).rejects.toMatchObject({
        code: AuthErrorCode.EMAIL_ALREADY_IN_USE,
      })
    })
  })

  // ── Login ─────────────────────────────────────────────────────────────────

  describe('signInWithEmail', () => {
    it('inicia sesión y devuelve User mapeado (Requisito 1.5)', async () => {
      client = makeClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: fakeSupabaseUser, session: {} },
          error: null,
        }),
      })
      service = new AuthService(client)

      const user = await service.signInWithEmail('test@example.com', 'SecurePass1!')
      expect(user.id).toBe(fakeSupabaseUser.id)
      expect(user.email).toBe(fakeSupabaseUser.email)
    })

    it('lanza INVALID_CREDENTIALS con mensaje genérico (Requisito 1.6)', async () => {
      client = makeClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      })
      service = new AuthService(client)

      const error = await service.signInWithEmail('x@x.com', 'wrong').catch((e) => e)
      expect(error).toBeInstanceOf(AuthError)
      expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
      // Mensaje genérico — no revela qué campo
      expect(error.message).toMatch(/credenciales incorrectas/i)
    })

    it('lanza INVALID_CREDENTIALS también si el error menciona "invalid password"', async () => {
      client = makeClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'invalid password' },
        }),
      })
      service = new AuthService(client)

      const error = await service.signInWithEmail('x@x.com', 'wrong').catch((e) => e)
      expect(error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
    })
  })

  // ── Cierre de sesión ──────────────────────────────────────────────────────

  describe('signOut', () => {
    it('cierra sesión sin errores (Requisito 1.7)', async () => {
      client = makeClient({
        signOut: vi.fn().mockResolvedValue({ error: null }),
      })
      service = new AuthService(client)

      await expect(service.signOut()).resolves.toBeUndefined()
    })

    it('lanza AuthError si Supabase falla al cerrar sesión', async () => {
      client = makeClient({
        signOut: vi.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      })
      service = new AuthService(client)

      await expect(service.signOut()).rejects.toBeInstanceOf(AuthError)
    })
  })

  // ── Usuario actual ────────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('devuelve null si no hay sesión activa', () => {
      client = makeClient({ currentUser: null })
      service = new AuthService(client)

      expect(service.getCurrentUser()).toBeNull()
    })

    it('devuelve User mapeado si hay sesión activa', () => {
      client = makeClient({ currentUser: fakeSupabaseUser })
      service = new AuthService(client)

      const user = service.getCurrentUser()
      expect(user).not.toBeNull()
      expect(user?.id).toBe(fakeSupabaseUser.id)
    })
  })
})

/**
 * Feature: plant-care-app
 *
 * Property 13: Posponer recordatorio
 *   Para cualquier recordatorio y valor de snooze en {1, 2, 3} días,
 *   la nueva dueDate debe ser exactamente currentDate + snoozeDays.
 *   Valida: Requisito 6.4
 *
 * Property 14: Round-trip de hora de recordatorio
 *   Para cualquier hora válida "HH:mm", guardar y recuperar devuelve el mismo valor.
 *   Valida: Requisito 6.3
 *
 * Tests unitarios:
 *   - requestPermission (Requisito 6.5)
 *   - saveFcmToken (Requisito 6.5)
 *   - setGlobalEnabled (Requisito 6.2)
 *   - Fallback in-app cuando no hay permisos (Requisito 6.6)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import {
    NotificationService,
    NotificationServiceError,
    NotificationServiceErrorCode,
    isValidHHmm,
    addDaysToDate,
} from './NotificationService'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reminder, SnoozeDays } from './NotificationService'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase (mismo patrón que los demás servicios)
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
    const chain: Record<string, unknown> = {
        then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
        catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
    }
        ;['eq', 'neq', 'order', 'limit', 'single', 'select', 'maybeSingle'].forEach((m) => {
            chain[m] = vi.fn().mockReturnValue(chain)
        })
    return chain
}

function makeClient(ops: {
    onSelect?: OpResult
    onUpdate?: OpResult
} = {}): SupabaseClient {
    const def: OpResult = { data: null, error: null }
    return {
        from: vi.fn(() => ({
            select: vi.fn(() => makeChain(ops.onSelect ?? def)),
            update: vi.fn(() => makeChain(ops.onUpdate ?? def)),
        })),
    } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

/** Genera fechas ISO "YYYY-MM-DD" entre 2020 y 2099 */
const isoDateArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10))

/** Genera valores de snooze válidos: 1, 2 o 3 */
const snoozeDaysArb = fc.constantFrom<SnoozeDays>(1, 2, 3)

/** Genera un Reminder arbitrario */
const reminderArb: fc.Arbitrary<Reminder> = fc.record({
    id: fc.uuid(),
    plantId: fc.uuid(),
    taskType: fc.constantFrom('watering', 'fertilizing', 'pruning', 'repotting'),
    dueDate: isoDateArb,
})

/** Genera horas válidas "HH:mm" */
const validTimeArb = fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

// ---------------------------------------------------------------------------
// P13 — Posponer recordatorio
// ---------------------------------------------------------------------------

describe('P13 — Posponer recordatorio (Requisito 6.4)', () => {
    it('la nueva dueDate es exactamente currentDate + snoozeDays', () => {
        fc.assert(
            fc.property(reminderArb, snoozeDaysArb, (reminder, days) => {
                const service = new NotificationService(makeClient())
                const snoozed = service.snoozeReminder(reminder, days)

                const expected = addDaysToDate(reminder.dueDate, days)
                expect(snoozed.dueDate).toBe(expected)
            }),
            { numRuns: 100 },
        )
    })

    it('los demás campos del recordatorio no cambian', () => {
        fc.assert(
            fc.property(reminderArb, snoozeDaysArb, (reminder, days) => {
                const service = new NotificationService(makeClient())
                const snoozed = service.snoozeReminder(reminder, days)

                expect(snoozed.id).toBe(reminder.id)
                expect(snoozed.plantId).toBe(reminder.plantId)
                expect(snoozed.taskType).toBe(reminder.taskType)
            }),
            { numRuns: 100 },
        )
    })

    it('lanza INVALID_SNOOZE_DAYS si days no es 1, 2 o 3', () => {
        const service = new NotificationService(makeClient())
        const reminder: Reminder = { id: 'r1', plantId: 'p1', taskType: 'watering', dueDate: '2025-04-01' }

        for (const invalid of [0, 4, -1, 10]) {
            expect(() => service.snoozeReminder(reminder, invalid as SnoozeDays)).toThrow(
                expect.objectContaining({ code: NotificationServiceErrorCode.INVALID_SNOOZE_DAYS }),
            )
        }
    })
})

// ---------------------------------------------------------------------------
// P14 — Round-trip de hora de recordatorio
// ---------------------------------------------------------------------------

describe('P14 — Round-trip de hora de recordatorio (Requisito 6.3)', () => {
    it('guardar y recuperar una hora válida devuelve el mismo valor', async () => {
        await fc.assert(
            fc.asyncProperty(validTimeArb, async (time) => {
                const userId = 'user-uuid-1'

                const client = makeClient({
                    onUpdate: { data: null, error: null },
                    onSelect: { data: { reminder_time: time }, error: null },
                })
                const service = new NotificationService(client)

                await service.setReminderTime(userId, time)
                const retrieved = await service.getReminderTime(userId)

                expect(retrieved).toBe(time)
            }),
            { numRuns: 100 },
        )
    })

    it('lanza INVALID_TIME_FORMAT para horas con formato incorrecto', async () => {
        const service = new NotificationService(makeClient())
        const invalidTimes = ['8:00', '25:00', '12:60', 'abc', '', '12:5', '24:00']

        for (const t of invalidTimes) {
            await expect(service.setReminderTime('user-1', t)).rejects.toMatchObject({
                code: NotificationServiceErrorCode.INVALID_TIME_FORMAT,
            })
        }
    })
})

// ---------------------------------------------------------------------------
// Tests unitarios — saveFcmToken
// ---------------------------------------------------------------------------

describe('saveFcmToken (Requisito 6.5)', () => {
    it('actualiza fcm_token en la tabla users sin error', async () => {
        const client = makeClient({ onUpdate: { data: null, error: null } })
        const service = new NotificationService(client)
        await expect(service.saveFcmToken('user-1', 'fcm-token-abc')).resolves.toBeUndefined()
    })

    it('lanza NotificationServiceError si Supabase devuelve error', async () => {
        const client = makeClient({ onUpdate: { data: null, error: { message: 'DB error' } } })
        const service = new NotificationService(client)
        await expect(service.saveFcmToken('user-1', 'token')).rejects.toBeInstanceOf(NotificationServiceError)
    })
})

// ---------------------------------------------------------------------------
// Tests unitarios — setGlobalEnabled
// ---------------------------------------------------------------------------

describe('setGlobalEnabled (Requisito 6.2)', () => {
    it('desactiva notificaciones globales (enabled=false)', async () => {
        const client = makeClient({ onUpdate: { data: null, error: null } })
        const service = new NotificationService(client)
        await expect(service.setGlobalEnabled('user-1', false)).resolves.toBeUndefined()
    })

    it('activa notificaciones globales (enabled=true)', async () => {
        const client = makeClient({ onUpdate: { data: null, error: null } })
        const service = new NotificationService(client)
        await expect(service.setGlobalEnabled('user-1', true)).resolves.toBeUndefined()
    })

    it('lanza NotificationServiceError si Supabase devuelve error', async () => {
        const client = makeClient({ onUpdate: { data: null, error: { message: 'DB error' } } })
        const service = new NotificationService(client)
        await expect(service.setGlobalEnabled('user-1', true)).rejects.toBeInstanceOf(NotificationServiceError)
    })

    // ── Req 6.2: verificar que la preferencia se persiste correctamente ──────

    it('persiste notifications_enabled=false en la tabla users (Requisito 6.2)', async () => {
        const updateMock = vi.fn(() => makeChain({ data: null, error: null }))
        const client = {
            from: vi.fn(() => ({ update: updateMock })),
        } as unknown as SupabaseClient

        const service = new NotificationService(client)
        await service.setGlobalEnabled('user-42', false)

        expect(client.from).toHaveBeenCalledWith('users')
        expect(updateMock).toHaveBeenCalledWith({ notifications_enabled: false })
    })

    it('persiste notifications_enabled=true en la tabla users (Requisito 6.2)', async () => {
        const updateMock = vi.fn(() => makeChain({ data: null, error: null }))
        const client = {
            from: vi.fn(() => ({ update: updateMock })),
        } as unknown as SupabaseClient

        const service = new NotificationService(client)
        await service.setGlobalEnabled('user-42', true)

        expect(client.from).toHaveBeenCalledWith('users')
        expect(updateMock).toHaveBeenCalledWith({ notifications_enabled: true })
    })
})

// ---------------------------------------------------------------------------
// Tests unitarios — requestPermission
// ---------------------------------------------------------------------------

describe('requestPermission (Requisito 6.5 / 6.6)', () => {
    const originalNotification = globalThis.Notification

    afterEach(() => {
        // Restaurar Notification tras cada test
        Object.defineProperty(globalThis, 'Notification', {
            value: originalNotification,
            writable: true,
            configurable: true,
        })
    })

    it('devuelve "default" si Notification no está disponible (SSR / entorno sin permisos)', async () => {
        Object.defineProperty(globalThis, 'Notification', {
            value: undefined,
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()
        expect(result).toBe('default')
    })

    it('devuelve "granted" si el permiso ya fue concedido', async () => {
        Object.defineProperty(globalThis, 'Notification', {
            value: { permission: 'granted', requestPermission: vi.fn() },
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()
        expect(result).toBe('granted')
    })

    it('llama a requestPermission del navegador si el permiso no está concedido', async () => {
        const mockRequest = vi.fn().mockResolvedValue('denied')
        Object.defineProperty(globalThis, 'Notification', {
            value: { permission: 'default', requestPermission: mockRequest },
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()
        expect(mockRequest).toHaveBeenCalledOnce()
        expect(result).toBe('denied')
    })

    // ── Req 6.6: fallback in-app cuando no hay permisos ──────────────────────

    it('indica fallback in-app cuando el permiso es "denied" (Requisito 6.6)', async () => {
        const mockRequest = vi.fn().mockResolvedValue('denied')
        Object.defineProperty(globalThis, 'Notification', {
            value: { permission: 'default', requestPermission: mockRequest },
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()

        // Cuando el permiso es denegado, el resultado no es 'granted',
        // lo que indica que la app debe mostrar recordatorios como alertas in-app
        expect(result).not.toBe('granted')
        expect(result).toBe('denied')
    })

    it('indica fallback in-app cuando el permiso es "default" (no solicitado) (Requisito 6.6)', async () => {
        // Notification no disponible (SSR / entorno sin API de permisos)
        Object.defineProperty(globalThis, 'Notification', {
            value: undefined,
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()

        // 'default' significa que no se han concedido permisos → fallback in-app
        expect(result).not.toBe('granted')
        expect(result).toBe('default')
    })

    it('no requiere fallback in-app cuando el permiso es "granted" (Requisito 6.6)', async () => {
        Object.defineProperty(globalThis, 'Notification', {
            value: { permission: 'granted', requestPermission: vi.fn() },
            writable: true,
            configurable: true,
        })
        const service = new NotificationService(makeClient())
        const result = await service.requestPermission()

        // Con permisos concedidos no se necesita fallback in-app
        expect(result).toBe('granted')
    })
})

// ---------------------------------------------------------------------------
// Tests unitarios — isValidHHmm (utilidad)
// ---------------------------------------------------------------------------

describe('isValidHHmm', () => {
    it('acepta horas válidas', () => {
        expect(isValidHHmm('00:00')).toBe(true)
        expect(isValidHHmm('08:30')).toBe(true)
        expect(isValidHHmm('23:59')).toBe(true)
    })

    it('rechaza horas inválidas', () => {
        expect(isValidHHmm('24:00')).toBe(false)
        expect(isValidHHmm('12:60')).toBe(false)
        expect(isValidHHmm('8:00')).toBe(false)
        expect(isValidHHmm('abc')).toBe(false)
        expect(isValidHHmm('')).toBe(false)
    })
})

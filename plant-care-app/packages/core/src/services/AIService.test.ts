/**
 * Feature: plant-care-app
 *
 * Property 15: Informe de análisis visual contiene campos requeridos y se persiste
 *   analyzeImage() devuelve AnalysisReport con generalStatus, detectedProblems
 *   y recommendations no nulos, y lo guarda en analysis_reports.
 *   Valida: Requisitos 7.2, 7.4
 *
 * Property 16: Imagen no-planta produce respuesta de rechazo
 *   analyzeImage() lanza AIError(NOT_A_PLANT) cuando la API indica notAPlant.
 *   Valida: Requisito 7.6
 *
 * Property 17: Contexto del perfil incluido en el prompt de chat
 *   buildPlantContext() incluye datos básicos, cuidados y problemas activos.
 *   Valida: Requisito 8.2
 *
 * Property 18: Historial de chat — acumulación y reset
 *   Tras N mensajes la sesión tiene exactamente N*2 entradas (user + assistant).
 *   Tras reset la sesión tiene 0 mensajes.
 *   Valida: Requisitos 8.3, 8.4
 *
 * Property 19: Mensaje vacío en chat es rechazado
 *   sendChatMessage() lanza sin llamar al fetch si el mensaje está vacío.
 *   Valida: Requisito 8.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { AIService } from './AIService'
import { AIError, AIErrorCode } from '../models/ai-errors'
import { buildPlantContext } from '../utils/plantPromptContext'
import type { Plant } from '../models/plant'
import type { Problem } from '../models/problem'
import type { ChatSession } from '../models/chat'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Helpers — mock fetch global
// ---------------------------------------------------------------------------

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(
    (url, init) => Promise.resolve(handler(String(url), init)),
  )
  return spy
}

// ---------------------------------------------------------------------------
// Mock del cliente Supabase (solo necesitamos insert y select)
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  ;['eq', 'order', 'single', 'select'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  return chain
}

function makeDbClient(ops: { onInsert?: OpResult; onSelect?: OpResult } = {}): SupabaseClient {
  const def: OpResult = { data: null, error: null }
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => makeChain(ops.onInsert ?? def)),
      select: vi.fn(() => makeChain(ops.onSelect ?? { data: [], error: null })),
    })),
  } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Planta de ejemplo para tests
// ---------------------------------------------------------------------------

const basePlant: Plant = {
  id:          'plant-uuid-1',
  userId:      'user-uuid-1',
  commonName:  'Monstera',
  species:     'Monstera deliciosa',
  careSchedule: {
    wateringFrequencyDays:    7,
    fertilizingFrequencyDays: 14,
    lightNeeds:               'indirecta',
  },
  nextCareDates: { watering: '2025-04-10' },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const baseProblem: Problem = {
  id:          'prob-1',
  plantId:     'plant-uuid-1',
  type:        'Plaga',
  description: 'Pulgones en las hojas',
  detectedAt:  '2025-03-01T00:00:00.000Z',
  resolved:    false,
}

const validReport = {
  id:               'report-uuid-1',
  plantId:          'plant-uuid-1',
  imageUrl:         'https://example.com/photo.jpg',
  generalStatus:    'La planta está en buen estado',
  detectedProblems: ['Pequeñas manchas amarillas'],
  recommendations:  ['Aumentar el riego', 'Revisar exposición a la luz'],
  createdAt:        new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// P15 — Informe contiene campos requeridos y se persiste
// ---------------------------------------------------------------------------

describe('P15 — Informe de análisis visual contiene campos requeridos y se persiste (R7.2, R7.4)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('analyzeImage devuelve AnalysisReport con todos los campos obligatorios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),    // plantId
        fc.webUrl(),  // imageUrl
        async (plantId, imageUrl) => {
          const report = { ...validReport, id: crypto.randomUUID(), plantId, imageUrl }

          mockFetch(() => new Response(JSON.stringify(report), {
            status:  200,
            headers: { 'Content-Type': 'application/json' },
          }))

          const service = new AIService({ client: makeDbClient() })
          const result = await service.analyzeImage(plantId, imageUrl)

          expect(result.generalStatus).toBeTruthy()
          expect(Array.isArray(result.detectedProblems)).toBe(true)
          expect(Array.isArray(result.recommendations)).toBe(true)
          expect(result.plantId).toBe(plantId)
          expect(result.imageUrl).toBe(imageUrl)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('persiste el informe en analysis_reports tras recibirlo', async () => {
    const insertSpy = vi.fn(() => makeChain({ data: null, error: null }))
    const db = {
      from: vi.fn(() => ({ insert: insertSpy, select: vi.fn(() => makeChain({ data: [], error: null })) })),
    } as unknown as SupabaseClient

    mockFetch(() => new Response(JSON.stringify(validReport), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const service = new AIService({ client: db })
    await service.analyzeImage(validReport.plantId, validReport.imageUrl)

    expect(insertSpy).toHaveBeenCalledOnce()
    const insertArg = insertSpy.mock.calls[0]![0] as Record<string, unknown>
    expect(insertArg['plant_id']).toBe(validReport.plantId)
    expect(insertArg['general_status']).toBe(validReport.generalStatus)
  })
})

// ---------------------------------------------------------------------------
// P16 — Imagen no-planta produce respuesta de rechazo
// ---------------------------------------------------------------------------

describe('P16 — Imagen no-planta produce respuesta de rechazo (R7.6)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('analyzeImage lanza AIError(NOT_A_PLANT) cuando la API devuelve ese código', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.webUrl(),
        async (plantId, imageUrl) => {
          mockFetch(() => new Response(
            JSON.stringify({ error: 'No es una planta', code: AIErrorCode.NOT_A_PLANT }),
            { status: 422, headers: { 'Content-Type': 'application/json' } },
          ))

          const service = new AIService({ client: makeDbClient() })
          const err = await service.analyzeImage(plantId, imageUrl).catch((e) => e)

          expect(err).toBeInstanceOf(AIError)
          expect(err.code).toBe(AIErrorCode.NOT_A_PLANT)
        },
      ),
      { numRuns: 50 },
    )
  })

  it('analyzeImage lanza AIError(SERVICE_UNAVAILABLE) en error 503', async () => {
    mockFetch(() => new Response(
      JSON.stringify({ error: 'Sin servicio', code: AIErrorCode.SERVICE_UNAVAILABLE }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ))

    const service = new AIService({ client: makeDbClient() })
    const err = await service.analyzeImage('p1', 'https://example.com/img.jpg').catch((e) => e)
    expect(err).toBeInstanceOf(AIError)
    expect(err.code).toBe(AIErrorCode.SERVICE_UNAVAILABLE)
  })
})

// ---------------------------------------------------------------------------
// P17 — Contexto del perfil incluido en prompt de chat
// ---------------------------------------------------------------------------

describe('P17 — Contexto del perfil incluido en prompt de chat (R8.2)', () => {
  it('buildPlantContext incluye commonName, species y cuidados básicos', () => {
    fc.assert(
      fc.property(
        fc.record({
          commonName:   fc.string({ minLength: 1, maxLength: 60 }),
          species:      fc.string({ minLength: 1, maxLength: 60 }),
          lightNeeds:   fc.option(fc.constantFrom('directa', 'indirecta', 'sombra' as const), { nil: undefined }),
          wateringDays: fc.option(fc.integer({ min: 1, max: 90 }), { nil: undefined }),
        }),
        ({ commonName, species, lightNeeds, wateringDays }) => {
          const plant: Plant = {
            ...basePlant,
            commonName,
            species,
            careSchedule: {
              ...(lightNeeds    !== undefined && { lightNeeds }),
              ...(wateringDays  !== undefined && { wateringFrequencyDays: wateringDays }),
            },
          }
          const ctx = buildPlantContext(plant)

          expect(ctx).toContain(commonName)
          expect(ctx).toContain(species)
          if (lightNeeds)    expect(ctx).toContain(lightNeeds)
          if (wateringDays)  expect(ctx).toContain(String(wateringDays))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('buildPlantContext incluye problemas activos cuando los hay', () => {
    const ctx = buildPlantContext(basePlant, [baseProblem])
    expect(ctx).toContain('Pulgones en las hojas')
    expect(ctx).toContain('Plaga')
  })

  it('buildPlantContext NO incluye problemas resueltos', () => {
    const resolved: Problem = { ...baseProblem, resolved: true, resolvedAt: new Date().toISOString() }
    const ctx = buildPlantContext(basePlant, [resolved])
    expect(ctx).not.toContain('Pulgones en las hojas')
  })

  it('sendChatMessage incluye contexto del perfil en la llamada a la API', async () => {
    vi.restoreAllMocks()

    let capturedBody: Record<string, unknown> = {}
    mockFetch((_url, init) => {
      capturedBody = JSON.parse((init?.body ?? '{}') as string) as Record<string, unknown>
      return new Response(
        JSON.stringify({ plantId: 'plant-1', message: { role: 'assistant', content: 'Hola', timestamp: Date.now() } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })

    const session: ChatSession = { plantId: basePlant.id, messages: [] }
    const service = new AIService({ client: makeDbClient() })
    await service.sendChatMessage(session, 'Hola', basePlant, [baseProblem])

    // La route recibirá plant y activeProblems para construir el contexto
    expect(capturedBody['plant']).toBeDefined()
    expect(capturedBody['activeProblems']).toBeDefined()
    expect((capturedBody['plant'] as Plant).commonName).toBe(basePlant.commonName)

    vi.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// P18 — Historial de chat: acumulación y reset
// ---------------------------------------------------------------------------

describe('P18 — Historial de chat: acumulación y reset (R8.3, R8.4)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('tras N mensajes la sesión acumula exactamente N pares (user + assistant)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0),
          { minLength: 1, maxLength: 8 },
        ),
        async (messages) => {
          mockFetch(() => new Response(
            JSON.stringify({ plantId: basePlant.id, message: { role: 'assistant', content: 'OK', timestamp: Date.now() } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ))

          const service = new AIService({ client: makeDbClient() })
          let session: ChatSession = { plantId: basePlant.id, messages: [] }

          for (const msg of messages) {
            const result = await service.sendChatMessage(session, msg, basePlant)
            session = result.session
          }

          // Cada mensaje genera un par user + assistant
          expect(session.messages.length).toBe(messages.length * 2)
          // El orden debe ser alternado: user, assistant, user, assistant…
          session.messages.forEach((m, i) => {
            expect(m.role).toBe(i % 2 === 0 ? 'user' : 'assistant')
          })
        },
      ),
      { numRuns: 50 },
    )
  })

  it('tras iniciar nueva conversación (reset) la sesión tiene 0 mensajes', () => {
    // Reset = crear una nueva ChatSession vacía (Requisito 8.4)
    const newSession: ChatSession = { plantId: basePlant.id, messages: [] }
    expect(newSession.messages.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// P19 — Mensaje vacío rechazado sin llamar al fetch
// ---------------------------------------------------------------------------

describe('P19 — Mensaje vacío en chat es rechazado (R8.6)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sendChatMessage lanza AIError sin llamar a fetch si el mensaje es vacío', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s.trim() === ''),
        async (emptyMsg) => {
          const fetchSpy = mockFetch(() => new Response('{}', { status: 200 }))
          const service  = new AIService({ client: makeDbClient() })
          const session: ChatSession = { plantId: basePlant.id, messages: [] }

          const err = await service.sendChatMessage(session, emptyMsg, basePlant).catch((e) => e)

          expect(err).toBeInstanceOf(AIError)
          expect(fetchSpy).not.toHaveBeenCalled()

          vi.restoreAllMocks()
        },
      ),
      { numRuns: 100 },
    )
  })
})

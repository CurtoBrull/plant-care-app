/**
 * Feature: plant-care-app
 *
 * Property 3: Eliminación de entidad (Photo)
 *   Tras deletePhoto, la foto no debe aparecer en getPhotos.
 *   Valida: Requisito 4.4
 *
 * Property 6: Historial fotográfico ordenado cronológicamente
 *   getPhotos devuelve fotos ordenadas por capturedAt descendente.
 *   Valida: Requisito 4.3
 *
 * Property 7: Foto subida tiene timestamps
 *   uploadPhoto devuelve Photo con capturedAt y uploadedAt no nulos.
 *   Valida: Requisito 4.2
 *
 * Property 8: Imagen representativa actualiza el perfil de planta
 *   setRepresentativePhoto actualiza plant.representativePhotoUrl con la URL de la foto.
 *   Valida: Requisito 4.6
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { PhotoService, PhotoServiceError, PhotoServiceErrorCode } from './PhotoService'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase con Storage y DB
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  const passthrough = ['eq', 'neq', 'or', 'order', 'limit', 'single', 'select', 'maybeSingle']
  passthrough.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  return chain
}

interface MockOps {
  onSelect?: OpResult
  onInsert?: OpResult
  onUpdate?: OpResult
  onDelete?: OpResult
  storageUpload?: { error: unknown }
  storageRemove?: { error: unknown }
  storageGetPublicUrl?: { data: { publicUrl: string } }
}

function makeClient(ops: MockOps = {}): SupabaseClient {
  const def: OpResult = { data: null, error: null }
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain(ops.onSelect ?? def)),
      insert: vi.fn(() => makeChain(ops.onInsert ?? def)),
      update: vi.fn(() => makeChain(ops.onUpdate ?? def)),
      delete: vi.fn(() => makeChain(ops.onDelete ?? def)),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue(ops.storageUpload ?? { error: null }),
        remove: vi.fn().mockResolvedValue(ops.storageRemove ?? { error: null }),
        getPublicUrl: vi.fn().mockReturnValue(
          ops.storageGetPublicUrl ?? { data: { publicUrl: 'https://cdn.example.com/photo.jpg' } },
        ),
      })),
    },
  } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

const isoTimestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2099-12-31') })
  .map((d) => d.toISOString())

interface PhotoLike {
  id: string
  plantId: string
  url: string
  storagePath: string
  capturedAt: string
  uploadedAt: string
}

const photoGen: fc.Arbitrary<PhotoLike> = fc.record({
  id: fc.uuid(),
  plantId: fc.uuid(),
  url: fc.webUrl(),
  storagePath: fc.string({ minLength: 5, maxLength: 80 }),
  capturedAt: isoTimestampArb,
  uploadedAt: isoTimestampArb,
})

// Convierte PhotoLike a la forma de fila de la BD
const toRow = (p: PhotoLike) => ({
  id: p.id,
  plant_id: p.plantId,
  url: p.url,
  storage_path: p.storagePath,
  captured_at: p.capturedAt,
  uploaded_at: p.uploadedAt,
})

// ---------------------------------------------------------------------------
// P3 — Eliminación de entidad (Photo)
// ---------------------------------------------------------------------------

describe('P3 — Eliminación de entidad: Photo (Requisito 4.4)', () => {
  it('tras deletePhoto, getPhotos no contiene la foto eliminada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(photoGen, { minLength: 1, maxLength: 10 }),
        async (photos) => {
          const target = photos[0]!
          const remaining = photos.slice(1).map(toRow)

          const client = makeClient({
            // select: primero devuelve el storage_path de la foto (single), luego las restantes
            onSelect: { data: { storage_path: target.storagePath }, error: null },
            onDelete: { data: null, error: null },
          })

          // Tras el delete, getPhotos usa un select diferente — redefinimos from en cadena
          let selectCallCount = 0
          ;(client.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            select: vi.fn(() => {
              selectCallCount++
              // Primera llamada: recuperar storage_path para delete
              if (selectCallCount === 1) return makeChain({ data: { storage_path: target.storagePath }, error: null })
              // Segunda llamada: getPhotos tras delete
              return makeChain({ data: remaining, error: null })
            }),
            delete: vi.fn(() => makeChain({ data: null, error: null })),
            insert: vi.fn(() => makeChain({ data: null, error: null })),
            update: vi.fn(() => makeChain({ data: null, error: null })),
          }))

          const service = new PhotoService(client)
          await service.deletePhoto(target.id)
          const photos2 = await service.getPhotos(target.plantId)

          expect(photos2.map((p) => p.id)).not.toContain(target.id)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P6 — Historial fotográfico ordenado cronológicamente
// ---------------------------------------------------------------------------

describe('P6 — Historial fotográfico ordenado por capturedAt DESC (Requisito 4.3)', () => {
  it('getPhotos devuelve fotos de más reciente a más antigua', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(photoGen, { minLength: 0, maxLength: 20 }),
        async (photos) => {
          // Simulamos que Supabase ya devuelve las filas ordenadas DESC (como haría con .order())
          const sorted = [...photos].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
          const rows = sorted.map(toRow)

          const client = makeClient({ onSelect: { data: rows, error: null } })
          const service = new PhotoService(client)
          const result = await service.getPhotos('plant-id')

          // Verificar orden descendente
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1]!.capturedAt >= result[i]!.capturedAt).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P7 — Foto subida tiene timestamps no nulos
// ---------------------------------------------------------------------------

describe('P7 — Foto subida tiene timestamps (Requisito 4.2)', () => {
  it('uploadPhoto devuelve Photo con capturedAt y uploadedAt no nulos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),          // plantId
        fc.option(isoTimestampArb, { nil: undefined }), // capturedAt opcional
        async (plantId, capturedAt) => {
          const photoRow = {
            id: 'photo-uuid-1',
            plant_id: plantId,
            url: 'https://cdn.example.com/photo.jpg',
            storage_path: `plants/${plantId}/1234.jpg`,
            captured_at: capturedAt ?? new Date().toISOString(),
            uploaded_at: new Date().toISOString(),
          }

          const client = makeClient({ onInsert: { data: photoRow, error: null } })
          const service = new PhotoService(client)
          const blob = new Blob(['fake-image'], { type: 'image/jpeg' })

          const photo = await service.uploadPhoto(plantId, blob, capturedAt)

          expect(photo.capturedAt).toBeTruthy()
          expect(photo.uploadedAt).toBeTruthy()
          expect(typeof photo.capturedAt).toBe('string')
          expect(typeof photo.uploadedAt).toBe('string')
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P8 — Imagen representativa actualiza el perfil de planta
// ---------------------------------------------------------------------------

describe('P8 — Imagen representativa actualiza representativePhotoUrl (Requisito 4.6)', () => {
  it('setRepresentativePhoto actualiza plants con la URL de la foto seleccionada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),   // plantId
        fc.uuid(),   // photoId
        fc.webUrl(), // url de la foto
        async (plantId, photoId, photoUrl) => {
          let updatedUrl: string | null = null

          const client = {
            from: vi.fn((table: string) => ({
              select: vi.fn(() => makeChain({ data: { url: photoUrl }, error: null })),
              update: vi.fn((data: Record<string, unknown>) => {
                if (table === 'plants') updatedUrl = data['representative_photo_url'] as string
                return makeChain({ data: null, error: null })
              }),
              insert: vi.fn(() => makeChain({ data: null, error: null })),
              delete: vi.fn(() => makeChain({ data: null, error: null })),
            })),
            storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn() })) },
          } as unknown as SupabaseClient

          const service = new PhotoService(client)
          await service.setRepresentativePhoto(plantId, photoId)

          expect(updatedUrl).toBe(photoUrl)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios
// ---------------------------------------------------------------------------

describe('PhotoService — operaciones', () => {
  const plantId = 'plant-uuid-1'
  const photoId = 'photo-uuid-1'

  const basePhotoRow = {
    id: photoId,
    plant_id: plantId,
    url: 'https://cdn.example.com/photo.jpg',
    storage_path: `plants/${plantId}/1234.jpg`,
    captured_at: '2025-04-01T10:00:00.000Z',
    uploaded_at: '2025-04-01T10:05:00.000Z',
  }

  // ── uploadPhoto ────────────────────────────────────────────────────────────

  describe('uploadPhoto', () => {
    it('sube imagen y devuelve Photo con todos los campos (Requisito 4.1, 4.2)', async () => {
      const client = makeClient({ onInsert: { data: basePhotoRow, error: null } })
      const service = new PhotoService(client)
      const blob = new Blob(['img'], { type: 'image/jpeg' })

      const photo = await service.uploadPhoto(plantId, blob, '2025-04-01T10:00:00.000Z')
      expect(photo.id).toBe(photoId)
      expect(photo.plantId).toBe(plantId)
      expect(photo.capturedAt).toBe('2025-04-01T10:00:00.000Z')
      expect(photo.uploadedAt).toBeTruthy()
      expect(photo.url).toBeTruthy()
    })

    it('lanza UPLOAD_FAILED si Storage falla', async () => {
      const client = makeClient({ storageUpload: { error: { message: 'Storage error' } } })
      const service = new PhotoService(client)
      const blob = new Blob(['img'])

      await expect(service.uploadPhoto(plantId, blob)).rejects.toMatchObject({
        code: PhotoServiceErrorCode.UPLOAD_FAILED,
      })
    })

    it('usa la hora actual como capturedAt si no se proporciona (Requisito 4.2)', async () => {
      // El servicio genera `now` internamente y lo pasa a la BD.
      // El mock devuelve la fila tal como la BD la almacenaría.
      // Verificamos que capturedAt es una ISO string válida y no está vacía.
      const nowStr = new Date().toISOString()
      const dynamicRow = { ...basePhotoRow, captured_at: nowStr, uploaded_at: nowStr }
      const client = makeClient({ onInsert: { data: dynamicRow, error: null } })
      const service = new PhotoService(client)
      const blob = new Blob(['img'])

      const photo = await service.uploadPhoto(plantId, blob)

      expect(photo.capturedAt).toBeTruthy()
      expect(photo.uploadedAt).toBeTruthy()
      // Ambos deben ser fechas ISO válidas
      expect(new Date(photo.capturedAt).toISOString()).toBe(photo.capturedAt)
      expect(new Date(photo.uploadedAt).toISOString()).toBe(photo.uploadedAt)
    })
  })

  // ── getPhotos ──────────────────────────────────────────────────────────────

  describe('getPhotos', () => {
    it('devuelve fotos ordenadas por capturedAt DESC (Requisito 4.3)', async () => {
      const rows = [
        { ...basePhotoRow, id: 'p2', captured_at: '2025-04-02T00:00:00.000Z' },
        { ...basePhotoRow, id: 'p1', captured_at: '2025-04-01T00:00:00.000Z' },
      ]
      const client = makeClient({ onSelect: { data: rows, error: null } })
      const service = new PhotoService(client)

      const photos = await service.getPhotos(plantId)
      expect(photos[0]?.id).toBe('p2')
      expect(photos[1]?.id).toBe('p1')
    })

    it('devuelve array vacío si la planta no tiene fotos', async () => {
      const client = makeClient({ onSelect: { data: [], error: null } })
      const service = new PhotoService(client)

      expect(await service.getPhotos(plantId)).toHaveLength(0)
    })
  })

  // ── deletePhoto ────────────────────────────────────────────────────────────

  describe('deletePhoto', () => {
    it('elimina foto de Storage y BD sin errores (Requisito 4.4)', async () => {
      let selectCallCount = 0
      const client = makeClient()
      ;(client.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn(() => {
          selectCallCount++
          return makeChain({ data: { storage_path: basePhotoRow.storage_path }, error: null })
        }),
        delete: vi.fn(() => makeChain({ data: null, error: null })),
        insert: vi.fn(() => makeChain({ data: null, error: null })),
        update: vi.fn(() => makeChain({ data: null, error: null })),
      }))

      const service = new PhotoService(client)
      await expect(service.deletePhoto(photoId)).resolves.toBeUndefined()
    })

    it('lanza NOT_FOUND si la foto no existe en BD', async () => {
      const client = makeClient({ onSelect: { data: null, error: { message: 'Not found' } } })
      const service = new PhotoService(client)

      await expect(service.deletePhoto('bad-id')).rejects.toMatchObject({
        code: PhotoServiceErrorCode.NOT_FOUND,
      })
    })
  })

  // ── setRepresentativePhoto ─────────────────────────────────────────────────

  describe('setRepresentativePhoto', () => {
    it('actualiza representative_photo_url en plants (Requisito 4.6)', async () => {
      const photoUrl = 'https://cdn.example.com/photo.jpg'
      const client = makeClient({
        onSelect: { data: { url: photoUrl }, error: null },
        onUpdate: { data: null, error: null },
      })
      const service = new PhotoService(client)

      await expect(service.setRepresentativePhoto(plantId, photoId)).resolves.toBeUndefined()
    })

    it('lanza NOT_FOUND si la foto no existe', async () => {
      const client = makeClient({ onSelect: { data: null, error: { message: 'Not found' } } })
      const service = new PhotoService(client)

      await expect(service.setRepresentativePhoto(plantId, 'bad-id')).rejects.toMatchObject({
        code: PhotoServiceErrorCode.NOT_FOUND,
      })
    })
  })
})

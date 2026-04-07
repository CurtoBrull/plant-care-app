'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import type { PlantScoutResult } from '@/app/api/ai/scout/route'

const DIFFICULTY_LABEL = { fácil: '🟢 Fácil', media: '🟡 Media', difícil: '🔴 Difícil' }
const LOCATION_LABEL   = { interior: '🏠 Interior', exterior: '🌳 Exterior', ambos: '🏠🌳 Interior y exterior' }
const LIGHT_LABEL      = { directa: '☀️ Directa', indirecta: '🌤 Indirecta', sombra: '🌑 Sombra' }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: '.55rem .75rem', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '.875rem', width: '40%' }}>{label}</td>
      <td style={{ padding: '.55rem .75rem', fontSize: '.875rem' }}>{value}</td>
    </tr>
  )
}

export default function ScoutPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState('')
  const [result,  setResult]    = useState<PlantScoutResult | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  async function handleIdentify() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res  = await fetch('/api/ai/scout', { method: 'POST', body: fd })
      const json = await res.json() as PlantScoutResult & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Error al analizar la planta'); return }
      setResult(json)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setPreview(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div className="page-header">
        <h1>Explorar planta</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '.9375rem' }}>
        Fotografía cualquier planta para conocer sus características antes de decidir si te la llevas a casa.
      </p>

      {/* ── Upload card ── */}
      <div className="card" style={{ maxWidth: 680, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

          {preview ? (
            <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
              <Image
                src={preview}
                alt="Vista previa"
                fill
                style={{ objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                unoptimized
              />
            </div>
          ) : (
            <div style={{
              width: 96, height: 96, flexShrink: 0,
              border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', color: 'var(--text-muted)',
            }}>
              📷
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {preview ? '🔄 Cambiar foto' : '📷 Seleccionar foto'}
            </button>
            {preview && !loading && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleIdentify()}>
                🔍 Analizar con IA
              </button>
            )}
            {loading && (
              <button type="button" className="btn btn-primary btn-sm" disabled>
                <span className="spinner" /> Analizando…
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>

      {/* ── Result ── */}
      {result && (
        <div style={{ maxWidth: 680 }}>
          {/* Header */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{result.commonName}</h2>
                <p style={{ margin: '.2rem 0 0', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '.9rem' }}>{result.scientificName}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
                Nueva búsqueda
              </button>
            </div>

            {result.description && (
              <p style={{ marginTop: '1rem', fontSize: '.9375rem', lineHeight: 1.65, borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {result.description}
              </p>
            )}

            {result.curiosity && (
              <div style={{
                marginTop: '.875rem', padding: '.65rem .875rem',
                background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)',
                fontSize: '.875rem',
              }}>
                💡 {result.curiosity}
              </div>
            )}
          </div>

          {/* Tabla de características */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '.875rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '.9375rem' }}>
              Características
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Tipo"         value={result.plantType.charAt(0).toUpperCase() + result.plantType.slice(1)} />
                <Row label="Dificultad"   value={DIFFICULTY_LABEL[result.difficulty] ?? result.difficulty} />
                <Row label="Ubicación"    value={LOCATION_LABEL[result.location]     ?? result.location} />
                <Row label="Luz"          value={LIGHT_LABEL[result.lightNeeds]      ?? result.lightNeeds} />
                <Row label="Riego"        value={`Cada ${result.wateringFrequencyDays} días`} />
                <Row label="Temperatura"  value={`${result.temperatureMinC} °C – ${result.temperatureMaxC} °C`} />
                {result.fertilizingFrequencyDays && (
                  <Row label="Fertilización" value={`Cada ${result.fertilizingFrequencyDays} días${result.fertilizerType ? ` · ${result.fertilizerType}` : ''}`} />
                )}
                {result.pruningFrequencyMonths && (
                  <Row label="Poda" value={`Cada ${result.pruningFrequencyMonths} meses`} />
                )}
                {result.repottingFrequencyMonths && (
                  <Row label="Trasplante" value={`Cada ${result.repottingFrequencyMonths} meses`} />
                )}
                <Row
                  label="Flores"
                  value={result.flowers.hasFlowers
                    ? `✅ Sí${result.flowers.color ? ` · ${result.flowers.color}` : ''}${result.flowers.season ? ` · ${result.flowers.season}` : ''}`
                    : '❌ No'}
                />
                <Row
                  label="Frutos"
                  value={result.fruits.hasFruits
                    ? `✅ Sí${result.fruits.description ? ` · ${result.fruits.description}` : ''}${result.fruits.edible != null ? (result.fruits.edible ? ' · Comestible' : ' · No comestible') : ''}`
                    : '❌ No'}
                />
                <Row
                  label="Toxicidad"
                  value={result.toxicity.toxic
                    ? `⚠️ Tóxica${result.toxicity.details ? ` · ${result.toxicity.details}` : ''}`
                    : '✅ No tóxica'}
                />
                <Row
                  label="Mascotas"
                  value={result.petFriendly ? '✅ Segura para mascotas' : '⚠️ No apta para mascotas'}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

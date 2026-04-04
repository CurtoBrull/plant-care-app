'use client'

import { useState } from 'react'
import type { CreatePlantInput, Plant } from '@plant-care/core'

interface AIHints {
  location?: 'interior' | 'exterior'
  lightNeeds?: 'directa' | 'indirecta' | 'sombra'
  fertilizerType?: string
}

interface Props {
  initialValues?: Partial<Plant>
  aiHints?: AIHints
  onSubmit: (input: CreatePlantInput) => Promise<void>
  onCancel?: () => void
}

const locationLabel: Record<string, string> = { interior: 'Interior', exterior: 'Exterior' }
const lightLabel: Record<string, string> = { directa: 'Directa', indirecta: 'Indirecta', sombra: 'Sombra' }

function RecommendedBadge({ text }: { text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.25rem',
      fontSize: '.75rem', color: 'var(--primary)', fontWeight: 500,
      background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
      borderRadius: '999px', padding: '.1rem .5rem', marginLeft: '.375rem',
    }}>
      🤖 {text}
    </span>
  )
}

export default function PlantForm({ initialValues, aiHints, onSubmit, onCancel }: Props) {
  const cs = initialValues?.careSchedule

  const [commonName, setCommonName] = useState(initialValues?.commonName ?? '')
  const [species, setSpecies] = useState(initialValues?.species ?? '')
  const [scientificName, setScientificName] = useState(initialValues?.scientificName ?? '')
  const [acquisitionDate, setAcquisitionDate] = useState(initialValues?.acquisitionDate ?? '')
  const [location, setLocation] = useState(initialValues?.location ?? '')
  const [notes, setNotes] = useState(initialValues?.notes ?? '')

  const [waterDays, setWaterDays] = useState(cs?.wateringFrequencyDays?.toString() ?? '')
  const [fertilDays, setFertilDays] = useState(cs?.fertilizingFrequencyDays?.toString() ?? '')
  const [fertilizerType, setFertilizerType] = useState(cs?.fertilizerType ?? '')
  const [lightNeeds, setLightNeeds] = useState(cs?.lightNeeds ?? '')
  const [tempMin, setTempMin] = useState(cs?.temperatureMinC?.toString() ?? '')
  const [tempMax, setTempMax] = useState(cs?.temperatureMaxC?.toString() ?? '')
  const [pruningMonths, setPruningMonths] = useState(cs?.pruningFrequencyMonths?.toString() ?? '')
  const [repotMonths, setRepotMonths] = useState(cs?.repottingFrequencyMonths?.toString() ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const input: CreatePlantInput = {
      commonName: commonName.trim(),
      species: species.trim(),
      scientificName: scientificName.trim() || undefined,
      acquisitionDate: acquisitionDate || undefined,
      location: (location as CreatePlantInput['location']) || undefined,
      notes: notes.trim() || undefined,
      careSchedule: {
        wateringFrequencyDays: waterDays ? Number(waterDays) : undefined,
        fertilizingFrequencyDays: fertilDays ? Number(fertilDays) : undefined,
        fertilizerType: fertilizerType.trim() || undefined,
        lightNeeds: (lightNeeds as import('@plant-care/core').LightNeeds) || undefined,
        temperatureMinC: tempMin ? Number(tempMin) : undefined,
        temperatureMaxC: tempMax ? Number(tempMax) : undefined,
        pruningFrequencyMonths: pruningMonths ? Number(pruningMonths) : undefined,
        repottingFrequencyMonths: repotMonths ? Number(repotMonths) : undefined,
      },
    }
    setSubmitting(true)
    try {
      await onSubmit(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <p className="form-section">Datos básicos</p>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="commonName">Nombre común *</label>
          <input id="commonName" type="text" className="form-input" required
            value={commonName} onChange={(e) => setCommonName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="species">Especie *</label>
          <input id="species" type="text" className="form-input" required
            value={species} onChange={(e) => setSpecies(e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="scientificName">Nombre científico</label>
          <input id="scientificName" type="text" className="form-input"
            value={scientificName} onChange={(e) => setScientificName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="acquisitionDate">Fecha de adquisición</label>
          <input id="acquisitionDate" type="date" className="form-input"
            value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        {/* ── Ubicación con hint ── */}
        <div className="form-group">
          <label className="form-label" htmlFor="location">
            Ubicación
            {aiHints?.location && (
              <RecommendedBadge text={`IA: ${locationLabel[aiHints.location]}`} />
            )}
          </label>
          <select id="location" className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">— Seleccionar —</option>
            <option value="interior">
              Interior{aiHints?.location === 'interior' ? ' ✓' : ''}
            </option>
            <option value="exterior">
              Exterior{aiHints?.location === 'exterior' ? ' ✓' : ''}
            </option>
          </select>
        </div>

        {/* ── Luz con hint ── */}
        <div className="form-group">
          <label className="form-label" htmlFor="lightNeeds">
            Luz necesaria
            {aiHints?.lightNeeds && (
              <RecommendedBadge text={`IA: ${lightLabel[aiHints.lightNeeds]}`} />
            )}
          </label>
          <select id="lightNeeds" className="form-select" value={lightNeeds} onChange={(e) => setLightNeeds(e.target.value)}>
            <option value="">— Seleccionar —</option>
            <option value="directa">
              Directa{aiHints?.lightNeeds === 'directa' ? ' ✓' : ''}
            </option>
            <option value="indirecta">
              Indirecta{aiHints?.lightNeeds === 'indirecta' ? ' ✓' : ''}
            </option>
            <option value="sombra">
              Sombra{aiHints?.lightNeeds === 'sombra' ? ' ✓' : ''}
            </option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="notes">Notas</label>
        <textarea id="notes" className="form-textarea"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <p className="form-section">Programa de cuidados</p>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="waterDays">Riego (cada N días)</label>
          <input id="waterDays" type="number" className="form-input" min={1}
            value={waterDays} onChange={(e) => setWaterDays(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="fertilDays">Fertilizado (cada N días)</label>
          <input id="fertilDays" type="number" className="form-input" min={1}
            value={fertilDays} onChange={(e) => setFertilDays(e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="pruningMonths">Poda (cada N meses)</label>
          <input id="pruningMonths" type="number" className="form-input" min={1}
            value={pruningMonths} onChange={(e) => setPruningMonths(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="repotMonths">Trasplante (cada N meses)</label>
          <input id="repotMonths" type="number" className="form-input" min={1}
            value={repotMonths} onChange={(e) => setRepotMonths(e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="tempMin">Temperatura mín. (°C)</label>
          <input id="tempMin" type="number" className="form-input" min={0} max={60}
            value={tempMin} onChange={(e) => setTempMin(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tempMax">Temperatura máx. (°C)</label>
          <input id="tempMax" type="number" className="form-input" min={0} max={60}
            value={tempMax} onChange={(e) => setTempMax(e.target.value)} />
        </div>
      </div>

      {/* ── Fertilizante con hint ── */}
      <div className="form-group">
        <label className="form-label" htmlFor="fertilizerType">
          Tipo de fertilizante
          {aiHints?.fertilizerType && (
            <RecommendedBadge text={`IA: ${aiHints.fertilizerType}`} />
          )}
        </label>
        <input
          id="fertilizerType"
          type="text"
          className="form-input"
          placeholder={aiHints?.fertilizerType ? `Recomendado: ${aiHints.fertilizerType}` : 'Ej: NPK equilibrado'}
          value={fertilizerType}
          onChange={(e) => setFertilizerType(e.target.value)}
        />
        {aiHints?.fertilizerType && !fertilizerType && (
          <button
            type="button"
            onClick={() => setFertilizerType(aiHints.fertilizerType!)}
            className="form-hint"
            style={{ cursor: 'pointer', color: 'var(--primary)', background: 'none', border: 'none', padding: 0, marginTop: '.25rem' }}
          >
            ↑ Usar recomendación de IA
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', marginTop: '.5rem' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={submitting}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Guardando…</> : 'Guardar planta'}
        </button>
      </div>
    </form>
  )
}

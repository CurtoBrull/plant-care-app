'use client'

import { useState } from 'react'
import type { CareSchedule, Plant } from '@plant-care/core'
import { getCareService } from '@/lib/services'

interface Props {
  plant:     Plant
  onRefresh: () => Promise<void>  // recarga la planta desde el servidor
}

type CareTaskType = 'watering' | 'fertilizing' | 'pruning' | 'repotting'

const TASKS: { key: CareTaskType; emoji: string; label: string }[] = [
  { key: 'watering',    emoji: '💧', label: 'Riego'      },
  { key: 'fertilizing', emoji: '🌱', label: 'Fertilizado' },
  { key: 'pruning',     emoji: '✂️', label: 'Poda'        },
  { key: 'repotting',   emoji: '🪴', label: 'Trasplante'  },
]

function dueSuffix(isoDate: string | undefined): { text: string; cls: string } {
  if (!isoDate) return { text: 'Sin programar', cls: '' }
  const days = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
  if (days < 0)   return { text: `Vencido hace ${-days} día${-days !== 1 ? 's' : ''}`, cls: 'due-overdue' }
  if (days === 0) return { text: 'Hoy', cls: 'due-soon' }
  if (days <= 3)  return { text: `En ${days} día${days !== 1 ? 's' : ''}`, cls: 'due-soon' }
  return { text: `En ${days} días`, cls: 'due-ok' }
}

export default function CareSection({ plant, onRefresh }: Props) {
  const nd = plant.nextCareDates
  const cs = plant.careSchedule

  const [editing,  setEditing]  = useState(false)
  const [logging,  setLogging]  = useState<CareTaskType | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // Formulario de edición
  const [waterDays,     setWaterDays]     = useState(cs?.wateringFrequencyDays?.toString()    ?? '')
  const [fertilDays,    setFertilDays]    = useState(cs?.fertilizingFrequencyDays?.toString() ?? '')
  const [pruningMonths, setPruningMonths] = useState(cs?.pruningFrequencyMonths?.toString()   ?? '')
  const [repotMonths,   setRepotMonths]   = useState(cs?.repottingFrequencyMonths?.toString() ?? '')

  async function handleLogTask(taskType: CareTaskType) {
    setLogging(taskType)
    setError('')
    try {
      await getCareService().logCareTask(plant.id, {
        taskType,
        performedAt: new Date().toISOString(),
      })
      await onRefresh()
      setSuccess(`✔ ${TASKS.find(t => t.key === taskType)?.label} registrado`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar cuidado')
    } finally {
      setLogging(null)
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const schedule: CareSchedule = {
      ...cs,
      wateringFrequencyDays:    waterDays    ? Number(waterDays)    : undefined,
      fertilizingFrequencyDays: fertilDays   ? Number(fertilDays)   : undefined,
      pruningFrequencyMonths:   pruningMonths? Number(pruningMonths): undefined,
      repottingFrequencyMonths: repotMonths  ? Number(repotMonths)  : undefined,
    }
    try {
      await getCareService().updateCareSchedule(plant.id, schedule)
      await onRefresh()
      setEditing(false)
      setSuccess('Programa de cuidados guardado')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const nextMap: Record<CareTaskType, string | undefined> = {
    watering:    nd?.watering,
    fertilizing: nd?.fertilizing,
    pruning:     nd?.pruning,
    repotting:   nd?.repotting,
  }

  return (
    <div>
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Próximas fechas ── */}
      <div className="card-header">
        <h2>Próximas fechas</h2>
        <button onClick={() => setEditing(!editing)} className="btn btn-secondary btn-sm">
          {editing ? 'Cancelar' : '✏️ Editar programa'}
        </button>
      </div>

      <div className="care-grid" style={{ marginBottom: '1.5rem' }}>
        {TASKS.map(({ key, emoji, label }) => {
          const isoDate = nextMap[key]
          const { text, cls } = dueSuffix(isoDate)
          return (
            <div key={key} className="care-item">
              <div className="care-item-label">{emoji} {label}</div>
              <div className="care-item-value">
                {isoDate ? new Date(isoDate).toLocaleDateString('es-ES') : '—'}
              </div>
              {isoDate && <div className={`care-item-due ${cls}`}>{text}</div>}
            </div>
          )
        })}
      </div>

      {/* ── Registrar cuidado ── */}
      <div className="card-header" style={{ marginTop: '1.5rem' }}>
        <h2>Registrar cuidado realizado</h2>
      </div>
      <div style={{ display: 'flex', gap: '.625rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {TASKS.map(({ key, emoji, label }) => (
          <button
            key={key}
            onClick={() => void handleLogTask(key)}
            disabled={logging !== null}
            className="btn btn-secondary"
          >
            {logging === key ? <span className="spinner" /> : emoji} {label}
          </button>
        ))}
      </div>

      {/* ── Editor de frecuencias ── */}
      {editing && (
        <div className="card" style={{ marginTop: '.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Editar frecuencias</h2>
          <form onSubmit={(e) => void handleSaveSchedule(e)}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Riego (días)</label>
                <input type="number" min={1} className="form-input"
                  value={waterDays} onChange={(e) => setWaterDays(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fertilizado (días)</label>
                <input type="number" min={1} className="form-input"
                  value={fertilDays} onChange={(e) => setFertilDays(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Poda (meses)</label>
                <input type="number" min={1} className="form-input"
                  value={pruningMonths} onChange={(e) => setPruningMonths(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Trasplante (meses)</label>
                <input type="number" min={1} className="form-input"
                  value={repotMonths} onChange={(e) => setRepotMonths(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

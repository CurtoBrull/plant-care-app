'use client'

import { useEffect, useState } from 'react'
import type { CreateProblemInput, Problem } from '@plant-care/core'
import { getProblemService } from '@/lib/services'

interface Props { plantId: string }

const PROBLEM_TYPES: Array<{ value: string; label: string }> = [
  { value: 'plague',                 label: 'Plaga'                   },
  { value: 'disease',                label: 'Enfermedad'              },
  { value: 'nutritional_deficiency', label: 'Deficiencia nutricional' },
  { value: 'watering_issue',         label: 'Problema de riego'       },
  { value: 'light_issue',            label: 'Problema de luz'         },
  { value: 'root_rot',               label: 'Pudrición de raíces'     },
  { value: 'other',                  label: 'Otro'                    },
]

const typeLabel = Object.fromEntries(PROBLEM_TYPES.map(({ value, label }) => [value, label]))

export default function ProblemsSection({ plantId }: Props) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [error,    setError]    = useState('')
  const [confirm,  setConfirm]  = useState<string | null>(null)

  // Formulario
  const [pType,  setPType]  = useState(PROBLEM_TYPES[0]!.value)
  const [pDesc,  setPDesc]  = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, [plantId])

  async function load() {
    setLoading(true)
    try {
      const list = await getProblemService().getProblems(plantId)
      setProblems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar problemas')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!pDesc.trim()) return
    setSaving(true)
    setError('')
    const data: CreateProblemInput = {
      type:        pType,
      description: pDesc.trim(),
      detectedAt:  new Date().toISOString(),
    }
    try {
      // createProblem(plantId, data) — plantId como primer argumento
      const p = await getProblemService().createProblem(plantId, data)
      setProblems((prev) => [p, ...prev])
      setPDesc('')
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar problema')
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve(problemId: string) {
    setError('')
    try {
      const updated = await getProblemService().markAsResolved(problemId)
      setProblems((prev) => prev.map((p) => p.id === problemId ? updated : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar como resuelto')
    }
  }

  async function handleDelete(problemId: string) {
    setError('')
    try {
      await getProblemService().deleteProblem(problemId)
      setProblems((prev) => prev.filter((p) => p.id !== problemId))
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar problema')
    }
  }

  if (loading) return <div className="loading-page" style={{ minHeight: 200 }}><span className="spinner" /></div>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {confirm && (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <span>¿Eliminar este problema?</span>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button onClick={() => void handleDelete(confirm)} className="btn btn-danger btn-sm">Eliminar</button>
            <button onClick={() => setConfirm(null)} className="btn btn-secondary btn-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-header">
        <h2>Problemas registrados</h2>
        <button onClick={() => setAdding(!adding)} className="btn btn-primary btn-sm">
          {adding ? 'Cancelar' : '+ Registrar problema'}
        </button>
      </div>

      {adding && (
        <form onSubmit={(e) => void handleAdd(e)} className="card" style={{ marginBottom: '1rem', marginTop: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Tipo de problema</label>
            <select className="form-select" value={pType} onChange={(e) => setPType(e.target.value)}>
              {PROBLEM_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" required
              placeholder="Describe el problema observado…"
              value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <span className="spinner" /> : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {problems.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✅</div>
          <p>No hay problemas registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '1rem' }}>
          {problems.map((p) => (
            <div key={p.id} className="problem-item">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                  <span className={`badge ${p.resolved ? 'badge-green' : 'badge-red'}`}>
                    {p.resolved ? 'Resuelto' : 'Activo'}
                  </span>
                  <strong>{typeLabel[p.type] ?? p.type}</strong>
                </div>
                <p style={{ fontSize: '.9rem', color: 'var(--text-muted)', marginBottom: '.25rem' }}>{p.description}</p>
                <p style={{ fontSize: '.8125rem', color: 'var(--text-muted)' }}>
                  Detectado: {new Date(p.detectedAt).toLocaleDateString('es-ES')}
                  {p.resolved && p.resolvedAt && ` · Resuelto: ${new Date(p.resolvedAt).toLocaleDateString('es-ES')}`}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.375rem', flexShrink: 0 }}>
                {!p.resolved && (
                  <button onClick={() => void handleResolve(p.id)} className="btn btn-secondary btn-sm">
                    ✔ Resuelto
                  </button>
                )}
                <button onClick={() => setConfirm(p.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

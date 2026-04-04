'use client'

import { useEffect, useState } from 'react'
import { getNotificationService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'

export default function SettingsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [globalEnabled, setGlobalEnabled] = useState(false)
  const [reminderTime,  setReminderTime]  = useState('08:00')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState('')

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const time = await getNotificationService().getReminderTime(userId)
        if (time) setReminderTime(time)
      } catch {
        // Usar valor por defecto
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [userId])

  async function handleToggleGlobal(enabled: boolean) {
    if (!userId) return
    setError('')
    setSaving(true)
    try {
      if (enabled && 'Notification' in window) {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setError('No se han concedido permisos de notificaciones. Actívalos en la configuración del navegador.')
          return
        }
        await getNotificationService().requestPermission()
      }
      await getNotificationService().setGlobalEnabled(userId, enabled)
      setGlobalEnabled(enabled)
      showSuccess(enabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar configuración')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTime() {
    if (!userId) return
    setError('')
    setSaving(true)
    try {
      await getNotificationService().setReminderTime(userId, reminderTime)
      showSuccess('Hora de recordatorio guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la hora')
    } finally {
      setSaving(false)
    }
  }

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  if (loading) {
    return <div className="loading-page"><span className="spinner" /> Cargando…</div>
  }

  return (
    <>
      <div className="page-header">
        <h1>Notificaciones</h1>
      </div>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Activar / desactivar ── */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.25rem' }}>
        <div className="card-header">
          <h2>Recordatorios de cuidado</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <p style={{ fontWeight: 500 }}>Activar notificaciones</p>
            <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
              Recibirás un recordatorio diario para las plantas con tareas pendientes.
            </p>
          </div>
          <button
            onClick={() => void handleToggleGlobal(!globalEnabled)}
            disabled={saving}
            className={`btn ${globalEnabled ? 'btn-danger' : 'btn-primary'}`}
            style={{ flexShrink: 0 }}
          >
            {saving ? <span className="spinner" /> : globalEnabled ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* ── Hora de recordatorio ── */}
      <div className="card" style={{ maxWidth: 520, marginBottom: '1.25rem' }}>
        <div className="card-header">
          <h2>Hora del recordatorio diario</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input
            type="time"
            className="form-input"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <button onClick={() => void handleSaveTime()} disabled={saving} className="btn btn-primary">
            {saving ? <span className="spinner" /> : 'Guardar'}
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: '.5rem' }}>
          El recordatorio se envía una vez al día a esta hora para las plantas que tengan tareas vencidas.
        </p>
      </div>

      {/* ── Posponer (info) ── */}
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-header">
          <h2>Posponer recordatorio</h2>
        </div>
        <div className="alert alert-warning" style={{ margin: 0 }}>
          💡 El posponer un recordatorio específico está disponible desde el perfil de cada planta,
          en la pestaña <strong>Cuidados</strong>.
        </div>
      </div>
    </>
  )
}

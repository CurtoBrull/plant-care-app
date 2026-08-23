// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class NotificationServiceError extends Error {
  constructor(
    public readonly code: NotificationServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'NotificationServiceError'
  }
}

export enum NotificationServiceErrorCode {
  INVALID_SNOOZE_DAYS = 'NOTIFICATION_INVALID_SNOOZE_DAYS',
  INVALID_TIME_FORMAT = 'NOTIFICATION_INVALID_TIME_FORMAT',
  NOT_FOUND = 'NOTIFICATION_NOT_FOUND',
  UNKNOWN = 'NOTIFICATION_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SnoozeDays = 1 | 2 | 3

export interface Reminder {
  id: string
  plantId: string
  taskType: string
  dueDate: string   // ISO date "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface INotificationService {
  requestPermission(): Promise<NotificationPermission>
  saveFcmToken(userId: string, token: string): Promise<void>
  snoozeReminder(reminder: Reminder, days: SnoozeDays): Reminder
  getGlobalEnabled(userId: string): Promise<boolean>
  setGlobalEnabled(userId: string, enabled: boolean): Promise<void>
  setReminderTime(userId: string, time: string): Promise<void>
  getReminderTime(userId: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Implementación con REST API (Neon PostgreSQL)
// ---------------------------------------------------------------------------

export class NotificationService implements INotificationService {
  private readonly baseUrl: string

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Solicitar permiso ──────────────────────────────────────────────────────

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') return 'default'
    if (Notification.permission === 'granted') return 'granted'
    return Notification.requestPermission()
  }

  // ── Guardar token FCM ──────────────────────────────────────────────────────

  async saveFcmToken(userId: string, token: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fcmToken: token }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      if (err instanceof NotificationServiceError) throw err
      throw new NotificationServiceError(
        NotificationServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al guardar token FCM',
      )
    }
  }

  // ── Posponer recordatorio (síncrono) ───────────────────────────────────────

  snoozeReminder(reminder: Reminder, days: SnoozeDays): Reminder {
    if (days !== 1 && days !== 2 && days !== 3) {
      throw new NotificationServiceError(
        NotificationServiceErrorCode.INVALID_SNOOZE_DAYS,
        `snoozeReminder solo acepta 1, 2 o 3 días. Recibido: ${days}`,
      )
    }

    const current = new Date(reminder.dueDate)
    current.setDate(current.getDate() + days)
    const newDueDate = current.toISOString().slice(0, 10)

    return { ...reminder, dueDate: newDueDate }
  }

  // ── Activar / desactivar recordatorios globales ────────────────────────────

  async getGlobalEnabled(userId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/settings?userId=${encodeURIComponent(userId)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
      return json.notificationsEnabled ?? true
    } catch (err) {
      if (err instanceof NotificationServiceError) throw err
      throw new NotificationServiceError(
        NotificationServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al obtener estado de notificaciones',
      )
    }
  }

  async setGlobalEnabled(userId: string, enabled: boolean): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, notificationsEnabled: enabled }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      if (err instanceof NotificationServiceError) throw err
      throw new NotificationServiceError(
        NotificationServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al actualizar notificaciones',
      )
    }
  }

  // ── Guardar hora de recordatorio ───────────────────────────────────────────

  async setReminderTime(userId: string, time: string): Promise<void> {
    if (!isValidHHmm(time)) {
      throw new NotificationServiceError(
        NotificationServiceErrorCode.INVALID_TIME_FORMAT,
        `Formato de hora inválido: "${time}". Se esperaba "HH:mm".`,
      )
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/users/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reminderTime: time }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      if (err instanceof NotificationServiceError) throw err
      throw new NotificationServiceError(
        NotificationServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al actualizar hora de recordatorio',
      )
    }
  }

  // ── Recuperar hora de recordatorio ────────────────────────────────────────

  async getReminderTime(userId: string): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/settings?userId=${encodeURIComponent(userId)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
      return json.reminderTime || '08:00'
    } catch (err) {
      if (err instanceof NotificationServiceError) throw err
      throw new NotificationServiceError(
        NotificationServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al obtener hora de recordatorio',
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Valida formato "HH:mm" (00:00 – 23:59) */
export function isValidHHmm(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [hh, mm] = time.split(':').map(Number)
  return hh! >= 0 && hh! <= 23 && mm! >= 0 && mm! <= 59
}

/** Suma `days` días a una fecha ISO "YYYY-MM-DD" y devuelve "YYYY-MM-DD" */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

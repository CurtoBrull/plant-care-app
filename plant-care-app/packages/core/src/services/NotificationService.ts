import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabase-client'

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
    /**
     * Solicita permiso de notificaciones al sistema operativo / navegador.
     * Devuelve el estado del permiso: 'granted' | 'denied' | 'default'.
     */
    requestPermission(): Promise<NotificationPermission>

    /**
     * Persiste el token FCM del dispositivo en la tabla `users`.
     * Requisito 6.5
     */
    saveFcmToken(userId: string, token: string): Promise<void>

    /**
     * Pospone un recordatorio sumando `days` días a su `dueDate`.
     * Solo acepta valores 1, 2 o 3.
     * Requisito 6.4
     */
    snoozeReminder(reminder: Reminder, days: SnoozeDays): Reminder

    /**
     * Activa o desactiva los recordatorios globales del usuario.
     * Persiste la preferencia en la tabla `users`.
     * Requisito 6.2
     */
    setGlobalEnabled(userId: string, enabled: boolean): Promise<void>

    /**
     * Guarda la hora preferida de recordatorio diario ("HH:mm").
     * Requisito 6.3
     */
    setReminderTime(userId: string, time: string): Promise<void>

    /**
     * Recupera la hora preferida de recordatorio del usuario.
     * Requisito 6.3
     */
    getReminderTime(userId: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class NotificationService implements INotificationService {
    private readonly db: SupabaseClient

    constructor(client?: SupabaseClient) {
        this.db = client ?? getSupabaseClient()
    }

    // ── Solicitar permiso ──────────────────────────────────────────────────────

    async requestPermission(): Promise<NotificationPermission> {
        // En entorno de test o SSR, Notification puede no existir
        if (typeof Notification === 'undefined') return 'default'
        if (Notification.permission === 'granted') return 'granted'
        return Notification.requestPermission()
    }

    // ── Guardar token FCM ──────────────────────────────────────────────────────

    async saveFcmToken(userId: string, token: string): Promise<void> {
        const { error } = await this.db
            .from('users')
            .update({ fcm_token: token })
            .eq('id', userId)

        if (error) throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, error.message)
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

    async setGlobalEnabled(userId: string, enabled: boolean): Promise<void> {
        const { error } = await this.db
            .from('users')
            .update({ notifications_enabled: enabled })
            .eq('id', userId)

        if (error) throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, error.message)
    }

    // ── Guardar hora de recordatorio ───────────────────────────────────────────

    async setReminderTime(userId: string, time: string): Promise<void> {
        if (!isValidHHmm(time)) {
            throw new NotificationServiceError(
                NotificationServiceErrorCode.INVALID_TIME_FORMAT,
                `Formato de hora inválido: "${time}". Se esperaba "HH:mm".`,
            )
        }

        const { error } = await this.db
            .from('users')
            .update({ reminder_time: time })
            .eq('id', userId)

        if (error) throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, error.message)
    }

    // ── Recuperar hora de recordatorio ────────────────────────────────────────

    async getReminderTime(userId: string): Promise<string> {
        const { data, error } = await this.db
            .from('users')
            .select('reminder_time')
            .eq('id', userId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotificationServiceError(NotificationServiceErrorCode.NOT_FOUND, `Usuario ${userId} no encontrado.`)
            }
            throw new NotificationServiceError(NotificationServiceErrorCode.UNKNOWN, error.message)
        }

        return (data as { reminder_time: string }).reminder_time
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

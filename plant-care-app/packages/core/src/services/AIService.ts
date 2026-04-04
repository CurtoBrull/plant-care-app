import type { AnalysisReport } from '../models/analysis-report'
import type { ChatMessage, ChatSession } from '../models/chat'
import type { Plant } from '../models/plant'
import type { Problem } from '../models/problem'
import { AIError, AIErrorCode } from '../models/ai-errors'
import { getSupabaseClient } from '../lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IAIService {
  /**
   * Envía una imagen a /api/ai/analyze, persiste el informe en analysis_reports
   * y lo devuelve.
   * Propiedad 15, 16.
   */
  analyzeImage(plantId: string, imageUrl: string): Promise<AnalysisReport>

  /**
   * Envía un mensaje al chat de la planta, actualizando la sesión en memoria.
   * Propiedades 17, 18, 19.
   */
  sendChatMessage(
    session: ChatSession,
    message: string,
    plant: Plant,
    activeProblems?: Problem[],
  ): Promise<{ session: ChatSession; reply: ChatMessage }>

  /**
   * Obtiene el historial de informes de análisis para una planta.
   */
  getAnalysisReports(plantId: string): Promise<AnalysisReport[]>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class AIService implements IAIService {
  private readonly apiBase: string
  private readonly db: SupabaseClient

  constructor(options?: { apiBase?: string; client?: SupabaseClient }) {
    // En web usa rutas relativas; en móvil se pasa la URL completa del servidor
    this.apiBase = options?.apiBase ?? ''
    this.db = options?.client ?? getSupabaseClient()
  }

  // ── Análisis visual ────────────────────────────────────────────────────────

  async analyzeImage(plantId: string, imageUrl: string): Promise<AnalysisReport> {
    const response = await fetch(`${this.apiBase}/api/ai/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plantId, imageUrl }),
    })

    const data = await response.json() as Record<string, unknown>

    if (!response.ok) {
      const code = (data['code'] as AIErrorCode | undefined) ?? AIErrorCode.SERVICE_UNAVAILABLE
      const msg  = (data['error'] as string | undefined) ?? 'Error desconocido'
      throw new AIError(code, msg)
    }

    const report = data as unknown as AnalysisReport

    // Persistir en analysis_reports
    const { error: dbError } = await this.db
      .from('analysis_reports')
      .insert({
        id:                report.id,
        plant_id:          report.plantId,
        image_url:         report.imageUrl,
        general_status:    report.generalStatus,
        detected_problems: report.detectedProblems,
        recommendations:   report.recommendations,
        created_at:        report.createdAt,
      })

    if (dbError) {
      // Loguear pero no fallar — el informe ya fue generado por Gemini
      console.warn('[AIService] No se pudo persistir el informe:', dbError.message)
    }

    return report
  }

  // ── Chat conversacional ────────────────────────────────────────────────────

  async sendChatMessage(
    session: ChatSession,
    message: string,
    plant: Plant,
    activeProblems: Problem[] = [],
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    // Propiedad 19 — mensaje vacío rechazado antes de llamar al servicio
    if (message.trim() === '') {
      throw new AIError(AIErrorCode.INVALID_IMAGE, 'El mensaje no puede estar vacío.')
    }

    const userMessage: ChatMessage = {
      role:      'user',
      content:   message,
      timestamp: Date.now(),
    }

    // Historial actualizado con el mensaje del usuario
    const updatedHistory: ChatMessage[] = [...session.messages, userMessage]

    const response = await fetch(`${this.apiBase}/api/ai/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        plantId:        session.plantId,
        message,
        history:        session.messages, // historial ANTES del mensaje actual
        plant,
        activeProblems,
      }),
    })

    const data = await response.json() as Record<string, unknown>

    if (!response.ok) {
      const code = (data['code'] as AIErrorCode | undefined) ?? AIErrorCode.SERVICE_UNAVAILABLE
      const msg  = (data['error'] as string | undefined) ?? 'Error desconocido'
      throw new AIError(code, msg)
    }

    const reply = (data['message'] as ChatMessage)

    // Propiedad 18 — acumular mensajes en orden
    const finalHistory: ChatMessage[] = [...updatedHistory, reply]

    return {
      session: { plantId: session.plantId, messages: finalHistory },
      reply,
    }
  }

  // ── Historial de informes ──────────────────────────────────────────────────

  async getAnalysisReports(plantId: string): Promise<AnalysisReport[]> {
    const { data, error } = await this.db
      .from('analysis_reports')
      .select('*')
      .eq('plant_id', plantId)
      .order('created_at', { ascending: false })

    if (error) throw new AIError(AIErrorCode.SERVICE_UNAVAILABLE, error.message)

    return (data as Array<{
      id: string
      plant_id: string
      image_url: string
      general_status: string
      detected_problems: string[]
      recommendations: string[]
      created_at: string
    }>).map((row) => ({
      id:               row.id,
      plantId:          row.plant_id,
      imageUrl:         row.image_url,
      generalStatus:    row.general_status,
      detectedProblems: row.detected_problems,
      recommendations:  row.recommendations,
      createdAt:        row.created_at,
    }))
  }
}

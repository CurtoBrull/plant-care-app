import type { AnalysisReport } from '../models/analysis-report'
import type { ChatMessage, ChatSession } from '../models/chat'
import type { Plant } from '../models/plant'
import type { Problem } from '../models/problem'
import { AIError, AIErrorCode } from '../models/ai-errors'

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IAIService {
  analyzeImage(plantId: string, imageUrl: string): Promise<AnalysisReport>
  sendChatMessage(
    session: ChatSession,
    message: string,
    plant: Plant,
    activeProblems?: Problem[],
  ): Promise<{ session: ChatSession; reply: ChatMessage }>
  getAnalysisReports(plantId: string): Promise<AnalysisReport[]>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class AIService implements IAIService {
  private readonly apiBase: string

  constructor(options?: { apiBase?: string }) {
    this.apiBase = options?.apiBase ?? ''
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

    return data as unknown as AnalysisReport
  }

  // ── Chat conversacional ────────────────────────────────────────────────────

  async sendChatMessage(
    session: ChatSession,
    message: string,
    plant: Plant,
    activeProblems: Problem[] = [],
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    if (message.trim() === '') {
      throw new AIError(AIErrorCode.INVALID_IMAGE, 'El mensaje no puede estar vacío.')
    }

    const userMessage: ChatMessage = {
      role:      'user',
      content:   message,
      timestamp: Date.now(),
    }

    const updatedHistory: ChatMessage[] = [...session.messages, userMessage]

    const response = await fetch(`${this.apiBase}/api/ai/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        plantId:        session.plantId,
        message,
        history:        session.messages,
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
    const finalHistory: ChatMessage[] = [...updatedHistory, reply]

    return {
      session: { plantId: session.plantId, messages: finalHistory },
      reply,
    }
  }

  // ── Historial de informes ──────────────────────────────────────────────────

  async getAnalysisReports(plantId: string): Promise<AnalysisReport[]> {
    try {
      const response = await fetch(`${this.apiBase}/api/ai/reports?plantId=${encodeURIComponent(plantId)}`)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }
      const data = await response.json()
      return (data.reports || []) as AnalysisReport[]
    } catch (err) {
      throw new AIError(
        AIErrorCode.SERVICE_UNAVAILABLE,
        err instanceof Error ? err.message : 'Error al obtener reportes',
      )
    }
  }
}

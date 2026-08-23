import type { Problem, CreateProblemInput } from '../models/problem'

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class ProblemServiceError extends Error {
  constructor(
    public readonly code: ProblemServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ProblemServiceError'
  }
}

export enum ProblemServiceErrorCode {
  NOT_FOUND  = 'PROBLEM_NOT_FOUND',
  VALIDATION = 'PROBLEM_VALIDATION',
  UNKNOWN    = 'PROBLEM_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IProblemService {
  createProblem(plantId: string, data: CreateProblemInput): Promise<Problem>
  getProblems(plantId: string): Promise<Problem[]>
  markAsResolved(problemId: string, resolvedAt?: string): Promise<Problem>
  deleteProblem(problemId: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Implementación con REST API (Neon PostgreSQL)
// ---------------------------------------------------------------------------

export class ProblemService implements IProblemService {
  private readonly baseUrl: string

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Crear registro de problema ─────────────────────────────────────────────

  async createProblem(plantId: string, data: CreateProblemInput): Promise<Problem> {
    if (!data.type?.trim()) {
      throw new ProblemServiceError(ProblemServiceErrorCode.VALIDATION, 'El tipo de problema es obligatorio.')
    }
    if (!data.description?.trim()) {
      throw new ProblemServiceError(ProblemServiceErrorCode.VALIDATION, 'La descripción es obligatoria.')
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId, ...data }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }

      return json.problem as Problem
    } catch (err) {
      if (err instanceof ProblemServiceError) throw err
      throw new ProblemServiceError(
        ProblemServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al registrar problema',
      )
    }
  }

  // ── Listar problemas (detectedAt DESC) ────────────────────────────────────

  async getProblems(plantId: string): Promise<Problem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/problems?plantId=${encodeURIComponent(plantId)}`)

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }

      return (json.problems || []) as Problem[]
    } catch (err) {
      if (err instanceof ProblemServiceError) throw err
      throw new ProblemServiceError(
        ProblemServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al obtener problemas',
      )
    }
  }

  // ── Marcar como resuelto ──────────────────────────────────────────────────

  async markAsResolved(problemId: string, resolvedAt?: string): Promise<Problem> {
    try {
      const res = await fetch(`${this.baseUrl}/api/problems/${problemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedAt }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 404) {
          throw new ProblemServiceError(ProblemServiceErrorCode.NOT_FOUND, `Problema ${problemId} no encontrado.`)
        }
        throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }

      return json.problem as Problem
    } catch (err) {
      if (err instanceof ProblemServiceError) throw err
      throw new ProblemServiceError(
        ProblemServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al resolver problema',
      )
    }
  }

  // ── Eliminar registro ─────────────────────────────────────────────────────

  async deleteProblem(problemId: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/problems/${problemId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      if (err instanceof ProblemServiceError) throw err
      throw new ProblemServiceError(
        ProblemServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al eliminar problema',
      )
    }
  }
}

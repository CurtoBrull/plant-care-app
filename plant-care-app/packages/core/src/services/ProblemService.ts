import type { SupabaseClient } from '@supabase/supabase-js'
import type { Problem, CreateProblemInput } from '../models/problem'
import { getSupabaseClient } from '../lib/supabase-client'

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
// Tipo fila de la tabla problems
// ---------------------------------------------------------------------------

interface ProblemRow {
  id: string
  plant_id: string
  type: string
  description: string
  detected_at: string
  image_url: string | null
  resolved: boolean
  resolved_at: string | null
}

function rowToProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    plantId: row.plant_id,
    type: row.type,
    description: row.description,
    detectedAt: row.detected_at,
    ...(row.image_url != null && { imageUrl: row.image_url }),
    resolved: row.resolved,
    ...(row.resolved_at != null && { resolvedAt: row.resolved_at }),
  }
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
// Implementación
// ---------------------------------------------------------------------------

export class ProblemService implements IProblemService {
  private readonly db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseClient()
  }

  // ── Crear registro de problema ─────────────────────────────────────────────

  async createProblem(plantId: string, data: CreateProblemInput): Promise<Problem> {
    if (!data.type?.trim()) {
      throw new ProblemServiceError(ProblemServiceErrorCode.VALIDATION, 'El tipo de problema es obligatorio.')
    }
    if (!data.description?.trim()) {
      throw new ProblemServiceError(ProblemServiceErrorCode.VALIDATION, 'La descripción es obligatoria.')
    }

    const { data: row, error } = await this.db
      .from('problems')
      .insert({
        plant_id:    plantId,
        type:        data.type.trim(),
        description: data.description.trim(),
        detected_at: data.detectedAt,
        image_url:   data.imageUrl ?? null,
        resolved:    false,
        resolved_at: null,
      })
      .select()
      .single()

    if (error) throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, error.message)
    return rowToProblem(row as ProblemRow)
  }

  // ── Listar problemas (detectedAt DESC) ────────────────────────────────────

  async getProblems(plantId: string): Promise<Problem[]> {
    const { data, error } = await this.db
      .from('problems')
      .select('*')
      .eq('plant_id', plantId)
      .order('detected_at', { ascending: false })

    if (error) throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, error.message)
    return (data as ProblemRow[]).map(rowToProblem)
  }

  // ── Marcar como resuelto ──────────────────────────────────────────────────

  async markAsResolved(problemId: string, resolvedAt?: string): Promise<Problem> {
    const timestamp = resolvedAt ?? new Date().toISOString()

    const { data: row, error } = await this.db
      .from('problems')
      .update({ resolved: true, resolved_at: timestamp })
      .eq('id', problemId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ProblemServiceError(ProblemServiceErrorCode.NOT_FOUND, `Problema ${problemId} no encontrado.`)
      }
      throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, error.message)
    }

    return rowToProblem(row as ProblemRow)
  }

  // ── Eliminar registro ─────────────────────────────────────────────────────

  async deleteProblem(problemId: string): Promise<void> {
    const { error } = await this.db
      .from('problems')
      .delete()
      .eq('id', problemId)

    if (error) throw new ProblemServiceError(ProblemServiceErrorCode.UNKNOWN, error.message)
  }
}

import { AIErrorCode, buildPlantContext } from '@plant-care/core'
import type { Plant, Problem, ChatMessage } from '@plant-care/core'
import { callChatAI } from '@/lib/ai-client'

const SYSTEM_INSTRUCTION = `
Eres un asistente experto en el cuidado de plantas. Responde SIEMPRE en español.
Sé amable, conciso y práctico. Usa el contexto del perfil de la planta para dar consejos personalizados.
Si no sabes algo con certeza, indícalo claramente.
`.trim()

export async function POST(request: Request): Promise<Response> {
  let plantId: string
  let message: string
  let history: ChatMessage[]
  let plant: Plant
  let activeProblems: Problem[]

  try {
    const body = await request.json() as {
      plantId?: string; message?: string; history?: ChatMessage[]
      plant?: Plant; activeProblems?: Problem[]
    }
    if (!body.message || body.message.trim() === '') {
      return Response.json({ error: 'El mensaje no puede estar vacío', code: 'EMPTY_MESSAGE' }, { status: 400 })
    }
    if (!body.plantId || !body.plant) {
      return Response.json({ error: 'Se requieren plantId y plant', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    plantId = body.plantId
    message = body.message.trim()
    history = body.history ?? []
    plant = body.plant
    activeProblems = body.activeProblems ?? []
  } catch {
    return Response.json({ error: 'Body inválido', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const hasKey = !!(process.env['OPENROUTER_API_KEY'] || process.env['GEMINI_API_KEY'])
  if (!hasKey) {
    return Response.json(
      { error: 'El chat no está disponible temporalmente', code: AIErrorCode.SERVICE_UNAVAILABLE },
      { status: 503 },
    )
  }

  const plantContext = buildPlantContext(plant, activeProblems)
  const systemPrompt = `${SYSTEM_INSTRUCTION}\n\n${plantContext}`
  const messages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: message }]

  try {
    const responseText = await callChatAI({ systemPrompt, messages })

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText.trim(),
      timestamp: Date.now(),
    }

    return Response.json({ plantId, message: assistantMessage }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
      return Response.json(
        { error: 'El chat no está disponible temporalmente', code: AIErrorCode.RATE_LIMITED },
        { status: 429 },
      )
    }
    return Response.json(
      { error: 'El chat no está disponible temporalmente', code: AIErrorCode.SERVICE_UNAVAILABLE },
      { status: 503 },
    )
  }
}

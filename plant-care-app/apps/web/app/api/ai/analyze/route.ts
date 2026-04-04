import { AIErrorCode } from '@plant-care/core'
import { callVisionAI } from '@/lib/ai-client'

const PROMPT = `
Eres un experto en el cuidado de plantas. Analiza la imagen y responde ÚNICAMENTE en español con JSON válido (sin markdown).

Si la imagen NO muestra una planta, responde exactamente:
{"notAPlant": true}

Si SÍ es una planta, responde con este JSON:
{
  "generalStatus": "<descripción breve del estado general>",
  "detectedProblems": ["<problema 1>"],
  "recommendations": ["<recomendación 1>"]
}

Sé conciso y accionable. Si no hay problemas, devuelve arrays vacíos.
`.trim()

export async function POST(request: Request): Promise<Response> {
  let plantId: string
  let imageUrl: string
  try {
    const body = await request.json() as { plantId?: string; imageUrl?: string }
    if (!body.plantId || !body.imageUrl) {
      return Response.json({ error: 'Se requieren plantId e imageUrl', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    plantId = body.plantId
    imageUrl = body.imageUrl
  } catch {
    return Response.json({ error: 'Body inválido', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const hasKey = !!(process.env['OPENROUTER_API_KEY'] || process.env['GEMINI_API_KEY'])
  if (!hasKey) {
    return Response.json(
      { error: 'El servicio de IA no está configurado', code: AIErrorCode.SERVICE_UNAVAILABLE },
      { status: 503 },
    )
  }

  // Descargar imagen
  let imageBase64: string
  let mimeType: string
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)
    mimeType = (imgRes.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim()
    imageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
  } catch (err) {
    return Response.json(
      { error: `No se pudo descargar la imagen: ${err instanceof Error ? err.message : err}`, code: AIErrorCode.INVALID_IMAGE },
      { status: 422 },
    )
  }

  try {
    const text = await callVisionAI({ prompt: PROMPT, imageBase64, mimeType })
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: { notAPlant?: boolean; generalStatus?: string; detectedProblems?: string[]; recommendations?: string[] }
    try {
      parsed = JSON.parse(cleaned) as typeof parsed
    } catch {
      parsed = { generalStatus: text, detectedProblems: [], recommendations: [] }
    }

    if (parsed.notAPlant) {
      return Response.json(
        { error: 'La imagen no corresponde a una planta.', code: AIErrorCode.NOT_A_PLANT },
        { status: 422 },
      )
    }

    return Response.json({
      id: crypto.randomUUID(),
      plantId,
      imageUrl,
      generalStatus: parsed.generalStatus ?? 'Estado no determinado',
      detectedProblems: parsed.detectedProblems ?? [],
      recommendations: parsed.recommendations ?? [],
      createdAt: new Date().toISOString(),
    }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
      return Response.json(
        { error: 'Límite de peticiones alcanzado. Espera un momento.', code: AIErrorCode.RATE_LIMITED },
        { status: 429 },
      )
    }
    return Response.json(
      { error: 'El servicio de IA no está disponible temporalmente', code: AIErrorCode.SERVICE_UNAVAILABLE },
      { status: 503 },
    )
  }
}

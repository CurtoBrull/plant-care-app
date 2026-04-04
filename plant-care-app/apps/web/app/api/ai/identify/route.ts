import { AIErrorCode } from '@plant-care/core'
import { callVisionAI } from '@/lib/ai-client'

export interface PlantIdentification {
    commonName: string
    species: string
    scientificName: string
    description: string
    location?: 'interior' | 'exterior'
    careSchedule: {
        wateringFrequencyDays?: number
        fertilizingFrequencyDays?: number
        fertilizerType?: string
        lightNeeds?: 'directa' | 'indirecta' | 'sombra'
        temperatureMinC?: number
        temperatureMaxC?: number
        pruningFrequencyMonths?: number
        repottingFrequencyMonths?: number
    }
}

const PROMPT = `
Eres un experto botánico. Analiza la imagen y responde ÚNICAMENTE en español con JSON válido (sin markdown, sin bloques de código).

Si la imagen NO muestra una planta, responde exactamente:
{"notAPlant": true}

Si SÍ es una planta, responde con este esquema:
{
  "commonName": "<nombre común en español>",
  "species": "<género y especie, ej: Monstera deliciosa>",
  "scientificName": "<nombre científico completo>",
  "description": "<descripción breve, 1-2 frases>",
  "location": "<interior|exterior>",
  "careSchedule": {
    "wateringFrequencyDays": <entero, días entre riegos>,
    "fertilizingFrequencyDays": <entero, días entre fertilizaciones>,
    "fertilizerType": "<tipo de fertilizante recomendado, ej: NPK equilibrado 10-10-10>",
    "lightNeeds": "<directa|indirecta|sombra>",
    "temperatureMinC": <número °C>,
    "temperatureMaxC": <número °C>,
    "pruningFrequencyMonths": <entero, meses entre podas>,
    "repottingFrequencyMonths": <entero, meses entre trasplantes>
  }
}
`.trim()

export async function POST(request: Request): Promise<Response> {
    const hasKey = !!(process.env['GROQ_API_KEY'] || process.env['OPENROUTER_API_KEY'] || process.env['GEMINI_API_KEY'])
    if (!hasKey) {
        return Response.json(
            { error: 'El servicio de IA no está configurado', code: AIErrorCode.SERVICE_UNAVAILABLE },
            { status: 503 },
        )
    }

    let imageBase64: string
    let mimeType: string
    try {
        const formData = await request.formData()
        const file = formData.get('image')
        if (!file || !(file instanceof Blob)) {
            return Response.json({ error: 'Se requiere el campo "image"', code: 'VALIDATION_ERROR' }, { status: 400 })
        }
        mimeType = file.type || 'image/jpeg'
        imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    } catch {
        return Response.json({ error: 'Error al procesar la imagen', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    try {
        const text = await callVisionAI({ prompt: PROMPT, imageBase64, mimeType })
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

        let parsed: { notAPlant?: boolean } & Partial<PlantIdentification>
        try {
            parsed = JSON.parse(cleaned) as typeof parsed
        } catch {
            return Response.json(
                { error: 'El servicio de IA devolvió una respuesta inesperada', code: AIErrorCode.SERVICE_UNAVAILABLE },
                { status: 503 },
            )
        }

        if (parsed.notAPlant) {
            return Response.json(
                { error: 'La imagen no corresponde a una planta.', code: AIErrorCode.NOT_A_PLANT },
                { status: 422 },
            )
        }

        return Response.json(parsed, { status: 200 })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
            return Response.json(
                { error: 'Límite de peticiones alcanzado. Espera un momento e inténtalo de nuevo.', code: AIErrorCode.RATE_LIMITED },
                { status: 429 },
            )
        }
        return Response.json(
            { error: 'El servicio de IA no está disponible temporalmente', code: AIErrorCode.SERVICE_UNAVAILABLE },
            { status: 503 },
        )
    }
}

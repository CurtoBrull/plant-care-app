import { AIErrorCode } from '@plant-care/core'
import { callVisionAI } from '@/lib/ai-client'

export interface PlantScoutResult {
  commonName: string
  scientificName: string
  species: string
  description: string
  plantType: string
  difficulty: 'fácil' | 'media' | 'difícil'
  location: 'interior' | 'exterior' | 'ambos'
  lightNeeds: 'directa' | 'indirecta' | 'sombra'
  wateringFrequencyDays: number
  temperatureMinC: number
  temperatureMaxC: number
  fertilizingFrequencyDays?: number
  fertilizerType?: string
  pruningFrequencyMonths?: number
  repottingFrequencyMonths?: number
  flowers: { hasFlowers: boolean; color?: string; season?: string }
  fruits: { hasFruits: boolean; description?: string; edible?: boolean }
  toxicity: { toxic: boolean; details?: string }
  petFriendly: boolean
  curiosity?: string
}

const PROMPT = `
Eres un experto botánico. Analiza la imagen y responde ÚNICAMENTE en español con JSON válido (sin markdown, sin bloques de código).

Si la imagen NO muestra una planta, responde exactamente:
{"notAPlant": true}

Si SÍ es una planta, responde con este esquema (todos los campos son obligatorios salvo los marcados con ?):
{
  "commonName": "<nombre común en español>",
  "scientificName": "<nombre científico completo>",
  "species": "<género y especie, ej: Monstera deliciosa>",
  "description": "<descripción de 4-6 frases en español: qué es y su origen, carácter ornamental o funcional, cuidados generales y adaptabilidad>",
  "plantType": "<uno de: suculenta | cactus | tropical | herbácea | frutal | arbusto | árbol | acuática | otra>",
  "difficulty": "<uno de: fácil | media | difícil>",
  "location": "<uno de: interior | exterior | ambos>",
  "lightNeeds": "<uno de: directa | indirecta | sombra>",
  "wateringFrequencyDays": <entero, días entre riegos>,
  "temperatureMinC": <número °C mínimo tolerable>,
  "temperatureMaxC": <número °C máximo tolerable>,
  "fertilizingFrequencyDays": <entero o null, días entre fertilizaciones>,
  "fertilizerType": "<string o null, tipo de fertilizante recomendado>",
  "pruningFrequencyMonths": <entero o null, meses entre podas>,
  "repottingFrequencyMonths": <entero o null, meses entre trasplantes>,
  "flowers": {
    "hasFlowers": <true|false>,
    "color": "<color/es de las flores o null>",
    "season": "<época de floración en español o null>"
  },
  "fruits": {
    "hasFruits": <true|false>,
    "description": "<descripción del fruto o null>",
    "edible": <true|false|null>
  },
  "toxicity": {
    "toxic": <true|false>,
    "details": "<para quién es tóxica (personas, mascotas) y qué partes, o null si no es tóxica>"
  },
  "petFriendly": <true si es segura para mascotas, false si no>,
  "curiosity": "<un dato curioso o consejo especial sobre esta planta, o null>"
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

    let parsed: { notAPlant?: boolean } & Partial<PlantScoutResult>
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

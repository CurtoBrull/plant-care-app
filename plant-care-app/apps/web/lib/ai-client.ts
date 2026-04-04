/**
 * Cliente de IA unificado.
 * Prioridad: Groq → OpenRouter → Gemini directo
 */

export interface AIImageRequest {
    prompt: string
    imageBase64: string
    mimeType: string
}

export interface AITextRequest {
    systemPrompt: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'meta-llama/llama-4-maverick:free'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function callVisionAI(req: AIImageRequest): Promise<string> {
    const groqKey = process.env['GROQ_API_KEY']
    const openRouterKey = process.env['OPENROUTER_API_KEY']
    const geminiKey = process.env['GEMINI_API_KEY']

    if (groqKey) return callOpenAICompatible(GROQ_URL, groqKey, GROQ_MODEL, req)
    if (openRouterKey) return callOpenAICompatible(OPENROUTER_URL, openRouterKey, OPENROUTER_MODEL, req, { 'HTTP-Referer': 'https://plant-care-app.vercel.app' })
    if (geminiKey) return callGeminiDirect(geminiKey, req.prompt, req.imageBase64, req.mimeType)

    throw new Error('NO_API_KEY')
}

export async function callChatAI(req: AITextRequest): Promise<string> {
    const groqKey = process.env['GROQ_API_KEY']
    const openRouterKey = process.env['OPENROUTER_API_KEY']
    const geminiKey = process.env['GEMINI_API_KEY']

    const messages = [
        { role: 'system' as const, content: req.systemPrompt },
        ...req.messages,
    ]

    if (groqKey) return callChatOpenAICompatible(GROQ_URL, groqKey, GROQ_MODEL, messages)
    if (openRouterKey) return callChatOpenAICompatible(OPENROUTER_URL, openRouterKey, OPENROUTER_MODEL, messages, { 'HTTP-Referer': 'https://plant-care-app.vercel.app' })
    if (geminiKey) return callGeminiChat(geminiKey, req)

    throw new Error('NO_API_KEY')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callOpenAICompatible(
    url: string,
    apiKey: string,
    model: string,
    req: AIImageRequest,
    extraHeaders: Record<string, string> = {},
): Promise<string> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: req.prompt },
                    { type: 'image_url', image_url: { url: `data:${req.mimeType};base64,${req.imageBase64}` } },
                ],
            }],
        }),
    })
    if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}: ${await res.text()}`)
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message.content ?? ''
}

async function callChatOpenAICompatible(
    url: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    extraHeaders: Record<string, string> = {},
): Promise<string> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({ model, messages }),
    })
    if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}: ${await res.text()}`)
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message.content ?? ''
}

async function callGeminiDirect(apiKey: string, prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    })
    const result = await model.generateContent([prompt, { inlineData: { mimeType, data: imageBase64 } }])
    return result.response.text()
}

async function callGeminiChat(apiKey: string, req: AITextRequest): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const chat = model.startChat({
        history: req.messages.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        })),
        systemInstruction: req.systemPrompt,
    })
    const last = req.messages.at(-1)
    const result = await chat.sendMessage(last?.content ?? '')
    return result.response.text()
}

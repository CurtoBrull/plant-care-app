'use client'

import { useEffect, useRef, useState } from 'react'
import type { AnalysisReport, ChatMessage, ChatSession, Photo, Plant } from '@plant-care/core'
import { AIErrorCode } from '@plant-care/core'
import { getAIService, getPhotoService } from '@/lib/services'

interface Props { plant: Plant }

interface DisplayMsg { role: 'user' | 'assistant'; content: string }

function emptySession(plantId: string): ChatSession {
  return { plantId, messages: [] }
}

export default function AISection({ plant }: Props) {
  // ── Análisis visual ──
  const [photos,         setPhotos]         = useState<Photo[]>([])
  const [selectedPhoto,  setSelectedPhoto]  = useState<string>('')
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null)
  const [analyzing,      setAnalyzing]      = useState(false)
  const [analyzeError,   setAnalyzeError]   = useState('')

  // ── Chat ──
  const [session,     setSession]     = useState<ChatSession>(() => emptySession(plant.id))
  const [messages,    setMessages]    = useState<DisplayMsg[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError,   setChatError]   = useState('')

  const [activeTab, setActiveTab] = useState<'analyze' | 'chat'>('analyze')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getPhotoService()
      .getPhotos(plant.id)
      .then((list) => {
        setPhotos(list)
        if (list[0]) setSelectedPhoto(list[0].url)
      })
  }, [plant.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Analizar imagen ──
  async function handleAnalyze() {
    if (!selectedPhoto) return
    setAnalyzing(true)
    setAnalyzeError('')
    setAnalysisReport(null)
    try {
      const report = await getAIService().analyzeImage(plant.id, selectedPhoto)
      setAnalysisReport(report)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === AIErrorCode.NOT_A_PLANT) {
          setAnalyzeError('La imagen no corresponde a una planta. Selecciona otra foto.')
          return
        }
        if (code === AIErrorCode.SERVICE_UNAVAILABLE) {
          setAnalyzeError('El servicio de IA no está disponible. Inténtalo más tarde.')
          return
        }
      }
      setAnalyzeError(err instanceof Error ? err.message : 'Error al analizar la imagen')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Enviar mensaje de chat ──
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return

    setChatInput('')
    setChatError('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setChatLoading(true)

    try {
      const { session: updated, reply } = await getAIService().sendChatMessage(
        session,
        text,
        plant,
      )
      setSession(updated)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.content }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el asistente'
      setChatError(msg)
      setMessages((prev) => [...prev, { role: 'assistant', content: '⚠️ ' + msg }])
    } finally {
      setChatLoading(false)
    }
  }

  function handleNewConversation() {
    setSession(emptySession(plant.id))
    setMessages([])
    setChatError('')
  }

  return (
    <div>
      {/* ── Sub-pestañas ── */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
        <button
          onClick={() => setActiveTab('analyze')}
          className={`btn btn-sm ${activeTab === 'analyze' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🔬 Análisis visual
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`btn btn-sm ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
        >
          💬 Chat con IA
        </button>
      </div>

      {/* ══════════ TAB: Análisis visual ══════════ */}
      {activeTab === 'analyze' && (
        <div>
          {analyzeError && <div className="alert alert-error">{analyzeError}</div>}

          <div className="form-group">
            <label className="form-label">Selecciona una foto para analizar</label>
            {photos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>
                No hay fotos disponibles. Sube fotos en la pestaña <strong>Fotos</strong>.
              </p>
            ) : (
              <select
                className="form-select"
                value={selectedPhoto}
                onChange={(e) => setSelectedPhoto(e.target.value)}
              >
                {photos.map((photo, i) => (
                  <option key={photo.id} value={photo.url}>
                    Foto {i + 1} — {new Date(photo.capturedAt).toLocaleDateString('es-ES')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => void handleAnalyze()}
            disabled={analyzing || !selectedPhoto}
            className="btn btn-primary"
            style={{ marginBottom: '1.25rem' }}
          >
            {analyzing ? <><span className="spinner" /> Analizando…</> : '🔬 Analizar imagen'}
          </button>

          {analysisReport && (
            <div className="card">
              <div style={{ marginBottom: '1rem' }}>
                <span className="form-label">Estado general</span>
                <p style={{ marginTop: '.25rem', fontWeight: 500 }}>{analysisReport.generalStatus}</p>
              </div>
              {analysisReport.detectedProblems.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <span className="form-label">Problemas detectados</span>
                  <ul style={{ marginTop: '.5rem', paddingLeft: '1.25rem' }}>
                    {analysisReport.detectedProblems.map((p, i) => (
                      <li key={i} style={{ marginBottom: '.25rem', color: 'var(--danger)' }}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisReport.recommendations.length > 0 && (
                <div>
                  <span className="form-label">Recomendaciones</span>
                  <ul style={{ marginTop: '.5rem', paddingLeft: '1.25rem' }}>
                    {analysisReport.recommendations.map((r, i) => (
                      <li key={i} style={{ marginBottom: '.25rem' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p style={{ fontSize: '.8125rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                Analizado el {new Date(analysisReport.createdAt).toLocaleString('es-ES')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: Chat ══════════ */}
      {activeTab === 'chat' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.75rem' }}>
            <button onClick={handleNewConversation} className="btn btn-secondary btn-sm">
              🔄 Nueva conversación
            </button>
          </div>

          {chatError && <div className="alert alert-error" style={{ marginBottom: '.75rem' }}>{chatError}</div>}

          <div className="chat-container">
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>🌿</div>
                  <p style={{ fontSize: '.9rem' }}>
                    Pregúntame sobre el cuidado de <strong>{plant.commonName}</strong>.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-assistant'}`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="chat-msg chat-msg-assistant">
                  <span className="spinner" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => void handleSendMessage(e)} className="chat-input-row">
              <textarea
                className="chat-input"
                rows={2}
                placeholder={`Pregunta sobre ${plant.commonName}…`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendMessage(e as unknown as React.FormEvent)
                  }
                }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end' }}
              >
                Enviar
              </button>
            </form>
          </div>
          <p className="form-hint" style={{ marginTop: '.5rem' }}>
            Intro para enviar · Shift+Intro para nueva línea
          </p>
        </div>
      )}
    </div>
  )
}

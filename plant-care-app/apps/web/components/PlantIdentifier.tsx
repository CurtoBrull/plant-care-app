'use client'

import { useRef, useState } from 'react'
import type { PlantIdentification } from '@/app/api/ai/identify/route'

interface Props {
    /** Se llama con los datos de identificación Y el File original para poder subirlo. */
    onIdentified: (data: PlantIdentification, file: File) => void
}

export default function PlantIdentifier({ onIdentified }: Props) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<PlantIdentification | null>(null)

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setPreview(URL.createObjectURL(file))
        setResult(null)
        setError('')
    }

    async function handleIdentify() {
        const file = fileRef.current?.files?.[0]
        if (!file) return
        setLoading(true)
        setError('')
        setResult(null)

        try {
            const fd = new FormData()
            fd.append('image', file)
            const res = await fetch('/api/ai/identify', { method: 'POST', body: fd })
            const json = await res.json() as PlantIdentification & { error?: string; code?: string }

            if (!res.ok) {
                setError(json.error ?? 'Error al identificar la planta')
                return
            }
            setResult(json)
        } catch {
            setError('Error de conexión. Inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    function handleConfirm() {
        const file = fileRef.current?.files?.[0]
        if (!result) return
        if (!file) {
            // Guard: file ref lost — shouldn't normally happen, but warn clearly
            console.error('[PlantIdentifier] No se encontró el archivo seleccionado al confirmar.')
            setError('No se pudo obtener la imagen seleccionada. Vuelve a seleccionarla.')
            return
        }
        onIdentified(result, file)
        // Reset component so the user knows the data was accepted
        setResult(null)
        setPreview(null)
        if (fileRef.current) fileRef.current.value = ''
    }

    return (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--surface-2, #f8faf8)', border: '1.5px dashed var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🤖</span>
                <strong>Identificar planta con IA</strong>
                <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '.25rem' }}>
                    — sube una foto y rellenamos el formulario automáticamente
                </span>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '.75rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Selector de imagen */}
                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="btn btn-secondary btn-sm"
                    >
                        📷 Seleccionar foto
                    </button>
                </div>

                {/* Preview */}
                {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={preview}
                        alt="Preview"
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                    />
                )}

                {/* Botón identificar */}
                {preview && !result && (
                    <button
                        type="button"
                        onClick={() => void handleIdentify()}
                        disabled={loading}
                        className="btn btn-primary btn-sm"
                    >
                        {loading ? <><span className="spinner" /> Identificando…</> : '🔍 Identificar'}
                    </button>
                )}
            </div>

            {/* Resultado */}
            {result && (
                <div style={{ marginTop: '1rem', padding: '.875rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>{result.commonName}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', fontStyle: 'italic' }}>{result.scientificName}</p>
                            {result.description && (
                                <p style={{ fontSize: '.875rem', marginTop: '.375rem', maxWidth: 420 }}>{result.description}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="btn btn-primary btn-sm"
                            style={{ flexShrink: 0 }}
                        >
                            ✔ Usar estos datos
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

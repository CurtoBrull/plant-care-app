'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getOfflineSyncService } from '@/lib/services'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  // Sincronizar cambios offline al recuperar conexión
  useEffect(() => {
    const flush = () => { void getOfflineSyncService().flushPendingChanges() }
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [])

  if (loading) {
    return (
      <div className="loading-page">
        <span className="spinner" /> Cargando…
      </div>
    )
  }

  if (!user) return null

  const isPlants   = pathname.startsWith('/plants')
  const isSettings = pathname === '/settings'

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">🌿 Plant Care</div>
        <nav className="sidebar-nav">
          <Link href="/plants"   className={`nav-link${isPlants   ? ' active' : ''}`}>🪴 Mis plantas</Link>
          <Link href="/settings" className={`nav-link${isSettings ? ' active' : ''}`}>🔔 Notificaciones</Link>
        </nav>
        <div className="sidebar-footer">
          <p style={{ fontSize: '.8125rem', color: 'var(--text-muted)', marginBottom: '.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </p>
          <button onClick={() => { void signOut().then(() => router.replace('/login')) }} className="btn btn-secondary btn-sm btn-full">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

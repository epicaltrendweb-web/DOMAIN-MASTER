'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search, Globe, CheckCircle2, XCircle, HelpCircle, Loader2,
  Trash2, RefreshCw, ExternalLink, BookOpen, Sparkles, Tag, Clock,
  Server, Infinity as InfinityIcon, Zap, DollarSign, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type CategoryKey = 'freeForever' | 'freeFirstYear' | 'paid' | 'freeSubdomains'

type ResultEntry = {
  category: CategoryKey
  tld: string
  domain: string
  pattern: string
  available: boolean | null
  httpStatus: number
  responseTimeMs: number
  registrar?: string | null
  expiresAt?: string | null
  registeredAt?: string | null
  errorMessage?: string
  claimUrl: string
  howToGet: string
  renewal: string
  notes: string
  free: boolean
  freeApex?: boolean
  autoRegistrable?: boolean
}

type SearchAllResult = {
  ok: boolean
  name: string
  checkedAt: string
  categories: Record<CategoryKey, ResultEntry[]>
  summary: Record<CategoryKey, { total: number; available: number }>
  autoRegistered: { url?: string; error?: string } | null
  totalChecked: number
  totalAvailable: number
  error?: string
}

type Tracked = {
  id: string
  name: string
  tld: string
  status: string
  registrar: string | null
  registeredAt: string | null
  expiresAt: string | null
  lastChecked: string | null
  notes: string | null
  createdAt: string
}

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMs(ms: number | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<SearchAllResult | null>(null)

  const [tracked, setTracked] = useState<Tracked[]>([])
  const [loadingTracked, setLoadingTracked] = useState(true)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  // ─── Load tracked domains (for "Mis dominios" tab) ───
  const loadTracked = useCallback(async () => {
    setLoadingTracked(true)
    try {
      const r = await fetch('/api/tracked', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) setTracked(d.items)
    } finally {
      setLoadingTracked(false)
    }
  }, [])

  useEffect(() => { loadTracked() }, [loadTracked])

  // ─── Unified search ───
  const onSearch = useCallback(async () => {
    const name = query.trim().toLowerCase()
    if (!name) {
      toast.error('Ingresá un nombre')
      return
    }
    if (!NAME_RE.test(name)) {
      toast.error('Nombre inválido: 1-63 chars, alfanumérico + guiones, empieza y termina con letra/número')
      return
    }
    setSearching(true)
    setResult(null)
    try {
      const r = await fetch(`/api/search-all?name=${encodeURIComponent(name)}&register=1`, { cache: 'no-store' })
      const d: SearchAllResult = await r.json()
      if (!d.ok) {
        toast.error(d.error || 'Error al buscar')
        return
      }
      setResult(d)
      if (d.autoRegistered?.url) {
        toast.success(`.dev auto-registrado: ${d.autoRegistered.url}`)
      } else if (d.totalAvailable > 0) {
        toast.success(`${d.totalAvailable} dominios disponibles con "${d.name}"`)
      } else {
        toast.info(`"${d.name}" tomado en todos lados`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }, [query])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch()
  }

  // ─── Tracked actions ───
  const track = useCallback(async (name: string) => {
    try {
      const r = await fetch('/api/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const d = await r.json()
      if (d.ok) {
        toast.success(`Guardado "${name}"`)
        await loadTracked()
      } else if (d.error === 'Already tracked') {
        toast.info(`"${name}" ya está guardado`)
      } else {
        toast.error(d.error || 'Error al guardar')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [loadTracked])

  const refresh = useCallback(async (id: string) => {
    setRefreshingId(id)
    try {
      const r = await fetch(`/api/tracked/check?id=${id}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        toast.success('Re-chequeado')
        await loadTracked()
      } else {
        toast.error(d.error || 'Error al re-chequear')
      }
    } finally {
      setRefreshingId(null)
    }
  }, [loadTracked])

  const remove = useCallback(async (id: string, name: string) => {
    try {
      const r = await fetch(`/api/tracked?id=${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.ok) {
        toast.success(`"${name}" eliminado`)
        setTracked((prev) => prev.filter((t) => t.id !== id))
      } else {
        toast.error(d.error || 'Error al eliminar')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const isTracked = useCallback(
    (name: string) => tracked.some((t) => t.name === name),
    [tracked]
  )

  // ─── Random name generator ───
  const randomName = useCallback(() => {
    const adj = ['calm','deep','echo','fair','iron','moon','nova','onyx','pure','swift','wild','zen','atom','byte']
    const noun = ['lab','hub','node','wave','sky','flux','core','loop','spark','forge','edge','glow','port','gate']
    const n = `${adj[Math.floor(Math.random()*adj.length)]}${noun[Math.floor(Math.random()*noun.length)]}${Math.floor(Math.random()*90+10)}`
    setQuery(n)
  }, [])

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 via-white to-emerald-50/40">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <Globe className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 leading-tight">
              DOMAIN-MASTER
            </h1>
            <p className="text-[11px] text-neutral-500 leading-tight truncate">
              Buscador de dominios gratis · 26+ TLDs · 4 categorías
            </p>
          </div>
          <a
            href="https://github.com/epicaltrendweb-web/DOMAIN-MASTER"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center text-xs text-neutral-500 hover:text-emerald-700 transition"
          >
            <BookOpen className="h-4 w-4 mr-1" /> Repo
          </a>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto">
          {/* ── Hero search ── */}
          <section className="mb-8 text-center">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 mb-2">
              Encontrá tu dominio <span className="text-emerald-600">gratis</span>
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mb-6 max-w-2xl mx-auto">
              Escribí el nombre que querés. Chequea en paralelo <strong>26+ terminaciones</strong> y te muestra los resultados en <strong>4 categorías claras</strong>.
            </p>
            <div className="flex gap-2 max-w-xl mx-auto">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                onKeyDown={onKeyDown}
                placeholder="ej: einstein · mi-proyecto · banana"
                className="h-12 text-base sm:text-lg border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/30 shadow-sm"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                onClick={onSearch}
                disabled={searching || !query.trim()}
                className="h-12 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md transition-all"
              >
                {searching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                <span className="ml-2 hidden sm:inline">{searching ? 'Buscando…' : 'Buscar'}</span>
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <button
                onClick={randomName}
                className="text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
              >
                🎲 nombre al azar
              </button>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-500">Enter para buscar</span>
            </div>
          </section>

          {/* ── Loading state ── */}
          {searching && (
            <div className="space-y-3 mb-8">
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-medium text-emerald-900">
                  Chequeando 26+ TLDs en paralelo…
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Esto toma ~7-10s por rate limits de RDAP
                </p>
              </div>
              <SkeletonGrid />
            </div>
          )}

          {/* ── Results ── */}
          {result && !searching && (
            <div className="space-y-6 mb-8">
              {/* Auto-registered .dev banner */}
              {result.autoRegistered?.url && (
                <div className="rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        ⚡ .dev auto-registrado
                      </p>
                      <a
                        href={result.autoRegistered.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm sm:text-base font-bold text-emerald-900 hover:underline break-all"
                      >
                        {result.autoRegistered.url.replace('https://', '')}
                      </a>
                    </div>
                    <a
                      href={result.autoRegistered.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition flex-shrink-0"
                    >
                      Abrir <ArrowRight className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
              )}

              {/* Summary badges */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                  {result.totalAvailable} disponibles
                </Badge>
                <Badge variant="outline" className="bg-white">
                  {result.totalChecked} chequeados
                </Badge>
                <Badge variant="outline" className="bg-white font-mono text-neutral-500">
                  name="{result.name}"
                </Badge>
              </div>

              {/* ── Category 1: FREE FOREVER ── */}
              <CategorySection
                result={result}
                catKey="freeForever"
                title="★★★ Gratis para SIEMPRE (apex real)"
                subtitle="Las únicas 2-3 terminaciones reales que son 100% gratis para siempre. Sin ser estudiante. Sin pagar."
                icon={<InfinityIcon className="h-5 w-5" />}
                accent="emerald"
                track={track}
                isTracked={isTracked}
              />

              {/* ── Category 2: FREE FIRST YEAR ── */}
              <CategorySection
                result={result}
                catKey="freeFirstYear"
                title="⚡ Gratis 1er año (Student Pack)"
                subtitle="Gratis el primer año vía Name.com + GitHub Student Pack. Renovación ~$15/año después. Máximo 1 por año por cuenta de estudiante."
                icon={<Zap className="h-5 w-5" />}
                accent="amber"
                track={track}
                isTracked={isTracked}
              />

              {/* ── Category 3: PAID ── */}
              <CategorySection
                result={result}
                catKey="paid"
                title="💰 Siempre pago"
                subtitle="TLDs pagos, con promos primer año $1-5. Renovación $10-100/año según TLD."
                icon={<DollarSign className="h-5 w-5" />}
                accent="neutral"
                track={track}
                isTracked={isTracked}
                collapsible
              />

              {/* ── Category 4: FREE SUBDOMAINS ── */}
              <CategorySection
                result={result}
                catKey="freeSubdomains"
                title="🆓 Subdominios gratis para siempre"
                subtitle="Sub-dominios (no apex) en TLDs reales. .workers.dev es auto-deployable por DOMAIN-MASTER en 5s."
                icon={<Server className="h-5 w-5" />}
                accent="emerald"
                track={track}
                isTracked={isTracked}
              />

              <p className="text-center text-xs text-neutral-400 pt-4">
                Última búsqueda: {new Date(result.checkedAt).toLocaleString()}
              </p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!result && !searching && (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 mx-auto text-emerald-200 mb-3" />
              <p className="text-base font-medium text-neutral-700">
                Buscá tu dominio arriba
              </p>
              <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
                Te muestra 4 categorías: gratis para siempre, 1er año gratis, siempre pago, subdominios gratis. El .dev se auto-registra.
              </p>
            </div>
          )}

          {/* ── Tabs: Mis dominios + Providers catalog ── */}
          <Tabs defaultValue="tracked" className="mt-12">
            <TabsList className="mb-4 grid grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="tracked">
                Mis dominios
                {tracked.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center text-[10px] rounded-full bg-neutral-200 text-neutral-600 h-4 min-w-4 px-1">
                    {tracked.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="about">Sobre las categorías</TabsTrigger>
            </TabsList>

            <TabsContent value="tracked">
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-neutral-100">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Dominios guardados</h3>
                    <p className="text-[11px] text-neutral-500">
                      Re-chequeá disponibilidad cuando quieras
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadTracked}
                    disabled={loadingTracked}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingTracked ? 'animate-spin' : ''}`} />
                    Refrescar
                  </Button>
                </div>
                {loadingTracked ? (
                  <div className="flex items-center justify-center py-8 text-neutral-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : tracked.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Tag className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                    <p className="text-sm font-medium text-neutral-700">Sin dominios guardados</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Buscá uno arriba y clickeá "Guardar" en cualquier resultado
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-96 overflow-y-auto">
                    {tracked.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0"
                      >
                        <StatusPill status={t.status} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-neutral-900 truncate">
                            {t.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            {t.registrar ? `${t.registrar} · ` : ''}
                            {t.lastChecked ? `últ. check ${fmtDate(t.lastChecked)}` : 'sin check aún'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={refreshingId === t.id}
                          onClick={() => refresh(t.id)}
                          title="Re-chequear"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === t.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600"
                          onClick={() => remove(t.id, t.name)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="about">
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoCard
                  icon={<InfinityIcon className="h-5 w-5 text-emerald-600" />}
                  title="★★★ Gratis para SIEMPRE (apex real)"
                  body="Las únicas terminaciones reales que son 100% gratis para siempre. Sin ser estudiante. Sin pagar. Sin renovar."
                  items={[
                    '.eu.org — approve manual, nunca expira (desde 1996)',
                    '.pp.ua — verificación periódica de teléfono+CC',
                    '<user>.github.io — automático con GitHub',
                  ]}
                  accent="emerald"
                />
                <InfoCard
                  icon={<Zap className="h-5 w-5 text-amber-600" />}
                  title="⚡ Gratis 1er año (Student Pack)"
                  body="Gratis el primer año vía Name.com + GitHub Student Pack. Renovación ~$15/año después del 1er año. Máximo 1 dominio por año por cuenta de estudiante verificada."
                  items={[
                    '.app, .dev, .live, .studio, .software',
                    '.games, .tattoo, .dentist (8 TLDs en total)',
                    'Requiere verificación de estudiante en education.github.com/pack',
                  ]}
                  accent="amber"
                />
                <InfoCard
                  icon={<DollarSign className="h-5 w-5 text-neutral-600" />}
                  title="💰 Siempre pago"
                  body="TLDs pagos, con promos primer año $1-5. Renovación $10-100/año según TLD."
                  items={[
                    '.com (~$10/yr), .net (~$12/yr), .org (~$10/yr)',
                    '.io (~$35/yr), .co (~$25/yr), .xyz ($1 promo + $10 renewal)',
                    '.tech, .page, .ai (~$70-100/yr premium)',
                  ]}
                  accent="neutral"
                />
                <InfoCard
                  icon={<Server className="h-5 w-5 text-emerald-600" />}
                  title="🆓 Subdominios gratis para siempre"
                  body="Sub-dominios (no apex) en TLDs reales. .workers.dev es auto-deployable por DOMAIN-MASTER en 5s."
                  items={[
                    '.workers.dev (REAL .dev — auto-deployed)',
                    '.deno.dev (REAL .dev — via Deno Deploy)',
                    '.netlify.app, .vercel.app (REAL .app)',
                    '.web.app + .firebaseapp.com (REAL .app)',
                    '.surge.sh, .onrender.com',
                  ]}
                  accent="emerald"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="mt-auto border-t border-neutral-200 bg-white py-4 px-4 text-center text-xs text-neutral-400">
        DOMAIN-MASTER · 26+ TLDs chequeados vía RDAP · {tracked.length} dominios guardados
      </footer>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded-md bg-neutral-100 animate-pulse" />
      ))}
    </div>
  )
}

function CategorySection({
  result, catKey, title, subtitle, icon, accent, track, isTracked, collapsible,
}: {
  result: SearchAllResult
  catKey: CategoryKey
  title: string
  subtitle: string
  icon: React.ReactNode
  accent: 'emerald' | 'amber' | 'neutral'
  track: (name: string) => void
  isTracked: (name: string) => boolean
  collapsible?: boolean
}) {
  const entries = result.categories[catKey] || []
  const summary = result.summary[catKey] || { total: 0, available: 0 }
  const [expanded, setExpanded] = useState(!collapsible)

  const accentMap = {
    emerald: {
      border: 'border-emerald-300',
      bg: 'bg-emerald-50/60',
      title: 'text-emerald-900',
      subtitle: 'text-emerald-700',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-600 text-white',
    },
    amber: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/60',
      title: 'text-amber-900',
      subtitle: 'text-amber-700',
      icon: 'text-amber-600',
      badge: 'bg-amber-500 text-white',
    },
    neutral: {
      border: 'border-neutral-300',
      bg: 'bg-neutral-50/60',
      title: 'text-neutral-900',
      subtitle: 'text-neutral-700',
      icon: 'text-neutral-600',
      badge: 'bg-neutral-700 text-white',
    },
  }[accent]

  if (entries.length === 0) return null

  return (
    <section className={`rounded-xl border-2 ${accentMap.border} ${accentMap.bg} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`${accentMap.icon} mt-0.5`}>{icon}</div>
          <div>
            <h3 className={`text-base font-bold ${accentMap.title}`}>{title}</h3>
            <p className={`text-xs ${accentMap.subtitle} mt-0.5 max-w-2xl`}>{subtitle}</p>
          </div>
        </div>
        <Badge className={`${accentMap.badge} hover:${accentMap.badge}`}>
          {summary.available}/{summary.total}
        </Badge>
      </div>

      {collapsible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-neutral-600 hover:text-neutral-900 mb-2"
        >
          {expanded ? '− colapsar' : '+ expandir'} ({entries.length} entradas)
        </button>
      )}

      {expanded && (
        <div className={`grid gap-1.5 ${catKey === 'paid' ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
          {entries.map((r, i) => (
            <EntryCard
              key={i}
              entry={r}
              accent={accent}
              track={track}
              isTracked={isTracked(r.domain)}
              onTrack={() => track(r.domain)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EntryCard({
  entry, accent, isTracked, onTrack,
}: {
  entry: ResultEntry
  accent: 'emerald' | 'amber' | 'neutral'
  isTracked: boolean
  onTrack: () => void
}) {
  const available = entry.available === true
  const taken = entry.available === false
  const unknown = entry.available === null

  const accentMap = {
    emerald: 'bg-white border-emerald-200 hover:border-emerald-400',
    amber: 'bg-white border-amber-200 hover:border-amber-400',
    neutral: 'bg-white border-neutral-200 hover:border-neutral-400',
  }[accent]

  return (
    <div className={`rounded-md border ${accentMap} p-2.5 transition-all`}>
      <div className="flex items-center gap-2 mb-1.5">
        {available ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        ) : taken ? (
          <XCircle className="h-4 w-4 text-neutral-400 flex-shrink-0" />
        ) : (
          <HelpCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}
        <a
          href={entry.claimUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-mono text-sm flex-1 truncate ${
            available ? 'text-emerald-800 font-bold hover:underline' : 'text-neutral-700 hover:underline'
          }`}
        >
          {entry.domain}
        </a>
        {available && (
          <a
            href={entry.claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-800"
            title="Registrar"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="text-[11px] text-neutral-600 leading-snug space-y-0.5 mb-1.5">
        <div><span className="font-semibold">Cómo:</span> {entry.howToGet}</div>
        <div><span className="font-semibold">Renueva:</span> {entry.renewal}</div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-100">
        {taken && entry.registrar ? (
          <span className="text-[10px] text-neutral-500 truncate" title={entry.registrar}>
            {entry.registrar.split(' ').slice(0, 2).join(' ')}
          </span>
        ) : (
          <span className="text-[10px] text-neutral-400">
            {available ? `${fmtMs(entry.responseTimeMs)}` : unknown ? 'sin datos RDAP' : 'tomado'}
          </span>
        )}
        {available && (
          <Button
            size="sm"
            variant={isTracked ? 'secondary' : 'outline'}
            className="h-6 text-[10px] px-2"
            disabled={isTracked}
            onClick={onTrack}
          >
            {isTracked ? 'Guardado ✓' : 'Guardar'}
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'available') {
    return (
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    )
  }
  if (status === 'taken') {
    return (
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-neutral-200 text-neutral-600 flex-shrink-0">
        <XCircle className="h-4 w-4" />
      </span>
    )
  }
  if (status === 'unknown') {
    return (
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
        <HelpCircle className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-red-100 text-red-700 flex-shrink-0">
      <XCircle className="h-4 w-4" />
    </span>
  )
}

function InfoCard({
  icon, title, body, items, accent,
}: {
  icon: React.ReactNode
  title: string
  body: string
  items: string[]
  accent: 'emerald' | 'amber' | 'neutral'
}) {
  const accentMap = {
    emerald: 'border-emerald-300 bg-emerald-50/40',
    amber: 'border-amber-300 bg-amber-50/40',
    neutral: 'border-neutral-300 bg-neutral-50/40',
  }[accent]

  return (
    <div className={`rounded-xl border-2 ${accentMap} p-4`}>
      <div className="flex items-start gap-3 mb-2">
        {icon}
        <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      </div>
      <p className="text-xs text-neutral-700 mb-2 leading-snug">{body}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[11px] text-neutral-600 flex items-start gap-1.5">
            <span className="text-neutral-400 mt-0.5">•</span>
            <span className="font-mono">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

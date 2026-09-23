'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search,
  Globe,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Server,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'

// ---------- Types ----------
type CheckResult = {
  ok: boolean
  name?: string
  available?: boolean | null
  status?: 'available' | 'taken' | 'unknown' | 'error'
  registrar?: string | null
  registeredAt?: string | null
  expiresAt?: string | null
  nameservers?: string[]
  responseTimeMs?: number
  httpStatus?: number
  errorMessage?: string
  checkedAt?: string
  error?: string
}

type Provider = {
  slug: string
  tld: string
  name: string
  type: 'subdomain' | 'tld' | 'student' | 'platform' | 'hosting'
  free: boolean
  requirements: string[]
  url: string
  signupUrl?: string
  notes: string
  alive: boolean
  researchNote?: string
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
  checks?: { id: string; status: string; responseTime: number | null; checkedAt: string }[]
}

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  const [providers, setProviders] = useState<Provider[]>([])
  const [investigation, setInvestigation] = useState<{
    query: string
    verdict: string
    likelyExplanation: string
    findings: string[]
    autoDiscoverAvailable?: string
  } | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(true)

  // Discover state
  const [discovering, setDiscovering] = useState(false)
  const [discoverResult, setDiscoverResult] = useState<{
    available: Array<{ name: string; responseTimeMs: number; saved?: boolean }>
    taken: number
    unknown: number
    checkedAt: string
    candidatesChecked: number
    skipped: number
  } | null>(null)

  const [tracked, setTracked] = useState<Tracked[]>([])
  const [loadingTracked, setLoadingTracked] = useState(true)

  const [trackingName, setTrackingName] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  // ---------- Load catalogs ----------
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const r = await fetch('/api/providers')
      const d = await r.json()
      if (d.ok) {
        setProviders(d.providers)
        if (d.investigation) setInvestigation(d.investigation)
      }
    } finally {
      setLoadingProviders(false)
    }
  }, [])

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

  useEffect(() => {
    loadProviders()
    loadTracked()
  }, [loadProviders, loadTracked])

  // ---------- Search ----------
  // ---------- Discover ----------
  const discover = useCallback(async () => {
    setDiscovering(true)
    setDiscoverResult(null)
    try {
      const r = await fetch('/api/discover?count=12', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok) {
        setDiscoverResult({
          available: d.available,
          taken: d.taken?.length || 0,
          unknown: d.unknown?.length || 0,
          checkedAt: d.checkedAt,
          candidatesChecked: d.candidatesChecked,
          skipped: d.skipped,
        })
        if (d.available?.length > 0) {
          toast.success(`${d.available.length} dominios libres encontrados!`)
        } else {
          toast.info('Ninguno libre en esta tanda. Probá de nuevo.')
        }
        await loadTracked()
      } else {
        toast.error(d.error || 'Error al descubrir')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDiscovering(false)
    }
  }, [loadTracked])

  const onSearch = useCallback(async () => {
    const name = query.trim().toLowerCase()
    if (!name) return
    if (!DOMAIN_RE.test(name)) {
      toast.error('Formato inválido. Usá algo como "ejemplo.com"')
      return
    }
    setSearching(true)
    setResult(null)
    try {
      const r = await fetch(`/api/domains/check?name=${encodeURIComponent(name)}`, {
        cache: 'no-store',
      })
      const d: CheckResult = await r.json()
      if (!d.ok) {
        toast.error(d.error || 'Error al consultar')
        setResult(d)
      } else {
        setResult(d)
        if (d.status === 'available') toast.success(`✓ ${name} está disponible!`)
        else if (d.status === 'taken') toast.info(`${name} ya está registrado`)
        else if (d.status === 'unknown') toast.warning(`${name}: TLD sin RDAP, revisá manualmente`)
        else toast.error(d.errorMessage || 'Error en la consulta')
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

  // ---------- Track ----------
  const track = useCallback(
    async (name: string) => {
      setTrackingName(name)
      try {
        const r = await fetch('/api/tracked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        const d = await r.json()
        if (d.ok) {
          toast.success(`Tracking "${name}"`)
          await loadTracked()
        } else {
          if (d.error === 'Already tracked') {
            toast.info(`"${name}" ya está en tracking`)
          } else {
            toast.error(d.error || 'Error al trackear')
          }
        }
      } finally {
        setTrackingName(null)
      }
    },
    [loadTracked]
  )

  // ---------- Refresh tracked ----------
  const refresh = useCallback(
    async (id: string) => {
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
    },
    [loadTracked]
  )

  // ---------- Delete tracked ----------
  const remove = useCallback(
    async (id: string, name: string) => {
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
    },
    []
  )

  const isTracked = useCallback(
    (name: string) => tracked.some((t) => t.name === name),
    [tracked]
  )

  return (
    <main className="min-h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-600 text-white">
            <Globe className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 leading-tight">
              DOMAIN-MASTER
            </h1>
            <p className="text-[11px] text-neutral-500 leading-tight">
              Disponibilidad de dominios + dominios gratis (.dev, .app, .eu.org, .js.org, ...)
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <Server className="h-3 w-3 mr-1" /> RDAP
          </Badge>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero search */}
          <section className="mb-8">
            <div className="text-center mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                ¿Está libre tu dominio?
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Consulta por RDAP (WHOIS moderno, sin auth). 200 = tomado · 404 = libre.
              </p>
            </div>
            <div className="flex gap-2 max-w-xl mx-auto">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="ej: miprojecto.dev"
                className="h-11 text-base"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                onClick={onSearch}
                disabled={searching || !query.trim()}
                className="h-11 px-5"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1">Buscar</span>
              </Button>
            </div>
          </section>

          {/* Result */}
          {result && (
            <section className="mb-8">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">{result.name}</CardTitle>
                    {result.responseTimeMs != null && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        <Clock className="h-3 w-3 mr-1" />
                        {fmtMs(result.responseTimeMs)} · HTTP {result.httpStatus}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <ResultBadge result={result} />
                  {result.registrar && (
                    <ResultRow label="Registrar" value={result.registrar} />
                  )}
                  {result.registeredAt && (
                    <ResultRow label="Registrado" value={fmtDate(result.registeredAt)} />
                  )}
                  {result.expiresAt && (
                    <ResultRow label="Expira" value={fmtDate(result.expiresAt)} />
                  )}
                  {result.nameservers && result.nameservers.length > 0 && (
                    <ResultRow
                      label="Nameservers"
                      value={result.nameservers.slice(0, 4).join(', ')}
                    />
                  )}
                  {result.errorMessage && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                      {result.errorMessage}
                    </div>
                  )}
                  {result.ok && result.name && (
                    <div className="pt-2">
                      {isTracked(result.name) ? (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Ya en tracking
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trackingName === result.name}
                          onClick={() => track(result.name!)}
                        >
                          {trackingName === result.name ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Tag className="h-4 w-4 mr-1" />
                          )}
                          Trackear este dominio
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Tabs: Tracked + Providers */}
          <Tabs defaultValue="discover" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="discover">
                <Search className="h-3 w-3 mr-1" />
                Descubrir
              </TabsTrigger>
              <TabsTrigger value="tracked">
                Trackeados
                {tracked.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center text-[10px] rounded-full bg-neutral-200 text-neutral-600 h-4 min-w-4 px-1">
                    {tracked.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="providers">Dominios gratis</TabsTrigger>
            </TabsList>

            {/* Discover tab */}
            <TabsContent value="discover">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        Auto-descubrimiento de dominios
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Genera nombres al azar (.dev, .app, .com), chequea vía RDAP en paralelo y guarda los libres. Vos no hacés nada.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={discover}
                      disabled={discovering}
                    >
                      {discovering ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      {discovering ? 'Buscando…' : 'Buscar libres'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {discoverResult && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                          {discoverResult.available.length} libres
                        </Badge>
                        <Badge variant="outline" className="text-neutral-600">
                          {discoverResult.taken} tomados
                        </Badge>
                        {discoverResult.unknown > 0 && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            {discoverResult.unknown} sin RDAP
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-neutral-500 font-mono">
                          {discoverResult.candidatesChecked} candidatos · {discoverResult.skipped} ya trackeados
                        </Badge>
                      </div>

                      {discoverResult.available.length === 0 ? (
                        <div className="text-center py-8 text-sm text-neutral-500">
                          <p>Ningún dominio libre en esta tanda.</p>
                          <p className="text-xs mt-1">Hacé clic en "Buscar libres" de nuevo para otra ronda.</p>
                        </div>
                      ) : (
                        <ul className="max-h-96 overflow-y-auto -mx-2 space-y-1">
                          {discoverResult.available.map((d, i) => {
                            const tld = d.name.split('.').pop() || ''
                            const registrar = tld === 'dev'
                              ? 'Porkbun'
                              : tld === 'app'
                                ? 'Cloudflare'
                                : 'Namecheap'
                            const registrarUrl =
                              tld === 'dev'
                                ? `https://porkbun.com/products/domains?tld=${tld}&search=${d.name.split('.')[0]}`
                                : tld === 'app'
                                  ? `https://www.namecheap.com/domains/registration/results/?domain=${d.name}`
                                  : `https://www.namecheap.com/domains/registration/results/?domain=${d.name}`
                            return (
                              <li
                                key={i}
                                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
                              >
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <span className="font-mono text-sm text-neutral-900 flex-1 truncate">
                                  {d.name}
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  {d.responseTimeMs}ms
                                </span>
                                {d.saved && (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                    guardado
                                  </Badge>
                                )}
                                <a
                                  href={registrarUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                  Registrar →
                                </a>
                              </li>
                            )
                          })}
                        </ul>
                      )}

                      <div className="text-[11px] text-neutral-400 pt-1">
                        Última ronda: {new Date(discoverResult.checkedAt).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {!discoverResult && !discovering && (
                    <div className="text-center py-10">
                      <Sparkles className="h-8 w-8 mx-auto text-emerald-300 mb-2" />
                      <p className="text-sm font-medium text-neutral-700">
                        Hacé clic en "Buscar libres"
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Cada randa chequea 12 nombres al azar en paralelo y guarda los disponibles.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tracked tab */}
            <TabsContent value="tracked">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Dominios trackeados</CardTitle>
                      <CardDescription className="text-xs">
                        Guardado en SQLite local. Re-chequeá cuando quieras.
                      </CardDescription>
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
                </CardHeader>
                <CardContent>
                  {loadingTracked ? (
                    <div className="flex items-center justify-center py-10 text-neutral-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : tracked.length === 0 ? (
                    <EmptyState
                      title="Sin dominios trackeados"
                      desc="Buscá uno arriba y hacé clic en 'Trackear'."
                    />
                  ) : (
                    <div className="max-h-[28rem] overflow-y-auto -mx-2">
                      <ul className="space-y-1">
                        {tracked.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200"
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
                            <div className="flex items-center gap-1">
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
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Providers tab */}
            <TabsContent value="providers">
              {loadingProviders ? (
                <div className="flex items-center justify-center py-10 text-neutral-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Investigation banner */}
                  {investigation && (
                    <Card className="border-emerald-200 bg-emerald-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-emerald-900">
                          <CheckCircle2 className="h-4 w-4" />
                          Investigación: ¿Antigravity da .dev gratis?
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-1 space-y-2">
                        <p className="text-xs text-emerald-800">
                          <span className="font-semibold">Consulta:</span> {investigation.query}
                        </p>
                        <p className="text-xs text-emerald-900 font-medium">
                          <span className="font-semibold">Veredicto:</span> {investigation.verdict}
                        </p>
                        <p className="text-xs text-emerald-800">
                          {investigation.likelyExplanation}
                        </p>
                        {investigation.autoDiscoverAvailable && (
                          <div className="text-xs text-emerald-900 bg-emerald-100 rounded p-2 border border-emerald-200">
                            <span className="font-semibold">✨ Auto-discovery:</span> {investigation.autoDiscoverAvailable}
                          </div>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-emerald-700 hover:text-emerald-900">
                            Evidencia encontrada ({investigation.findings?.length || 0} items)
                          </summary>
                          <ul className="mt-1 space-y-1 list-disc list-inside text-emerald-700">
                            {investigation.findings?.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </details>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {providers.map((p) => (
                      <Card key={p.slug} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-bold truncate flex items-center gap-1.5">
                                {p.name}
                                {p.free ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] px-1.5 py-0 h-4">
                                    GRATIS
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    PAGA
                                  </Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="font-mono text-[11px] text-neutral-500 mt-0.5">
                                {p.tld}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">
                              {p.type}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2 space-y-2">
                          <p className="text-xs text-neutral-600 leading-snug">{p.notes}</p>
                          {p.researchNote && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
                              <span className="font-semibold">Investigación: </span>
                              {p.researchNote}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {p.requirements.map((r) => (
                              <span
                                key={r}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            {p.signupUrl && (
                              <a
                                href={p.signupUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700"
                              >
                                <ExternalLink className="h-3 w-3 mr-0.5" /> Registrarse
                              </a>
                            )}
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-neutral-500 hover:text-neutral-700"
                            >
                              <BookOpen className="h-3 w-3 mr-0.5" /> Docs
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="mt-auto border-t border-neutral-200 bg-white py-4 px-4 text-center text-xs text-neutral-400">
        DOMAIN-MASTER · Next.js 16 + Prisma + RDAP · {tracked.length} dominios trackeados
      </footer>
    </main>
  )
}

// ---------- Sub-components ----------
function ResultBadge({ result }: { result: CheckResult }) {
  if (!result.ok) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50 text-red-700 text-sm font-medium">
        <XCircle className="h-4 w-4" /> Error
      </div>
    )
  }
  if (result.status === 'available') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" /> Disponible para registrar
      </div>
    )
  }
  if (result.status === 'taken') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-100 text-neutral-700 text-sm font-medium">
        <XCircle className="h-4 w-4" /> Ya registrado
      </div>
    )
  }
  if (result.status === 'unknown') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 text-sm font-medium">
        <HelpCircle className="h-4 w-4" /> TLD sin RDAP — consulta manual
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50 text-red-700 text-sm font-medium">
      <XCircle className="h-4 w-4" /> {result.errorMessage || 'Error'}
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-neutral-400 w-28 flex-shrink-0">{label}</span>
      <span className="text-neutral-900 font-medium break-all">{value}</span>
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

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center py-10 px-4">
      <Globe className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      <p className="text-xs text-neutral-500 mt-1">{desc}</p>
    </div>
  )
}

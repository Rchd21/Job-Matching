import * as React from 'react'
import { HistoryIcon, SearchIcon, Trash2Icon, TrendingUpIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, PageHeader, StatCard, fieldClass } from '@/components/common'
import { toneBadge } from '@/components/results-view'
import { useToast } from '@/components/toast'
import type { AnalysisDoc } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { hostOf } from '@/lib/text'
import { cn } from '@/lib/utils'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Courbe des scores dans le temps (SVG, sans dépendance). */
function ScoreChart({ items }: { items: AnalysisDoc[] }) {
  const points = [...items].reverse().slice(-20)
  const [hover, setHover] = React.useState<number | null>(null)
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-muted-foreground">La courbe apparaîtra à partir de deux analyses.</p>
  }
  const W = 640, H = 180, P = 28
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1)
  const y = (s: number) => H - P - (s / 100) * (H - 2 * P)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.result.score).toFixed(1)}`).join(' ')
  const active = hover !== null ? points[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label={`Évolution de vos scores sur ${points.length} analyses, de ${points[0].result.score} à ${points[points.length - 1].result.score}.`}>
        {[0, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v ? '3 4' : undefined} />
            <text x={4} y={y(v) + 4} className="fill-subtle-foreground text-[10px]">{v}</text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.result.score)} r={hover === i ? 6 : 4} className={cn('stroke-card', p.result.score >= 75 ? 'fill-success' : p.result.score >= 50 ? 'fill-warning' : 'fill-destructive')} strokeWidth={2} />
            <rect
              x={x(i) - 14} y={P / 2} width={28} height={H - P}
              fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => navigate(`analyse/${p.id}`)}
              className="cursor-pointer"
            />
          </g>
        ))}
      </svg>
      {active && (
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
          <p className="max-w-64 truncate font-semibold">{active.offerTitle}</p>
          <p className="text-muted-foreground">{fmtDate(active.createdAt)} · score <span className="font-semibold text-foreground">{active.result.score}</span></p>
        </div>
      )}
    </div>
  )
}

export function HistoryPage() {
  const { analyses, removeAnalysis, cvs } = useData()
  const toast = useToast()
  const [q, setQ] = React.useState('')
  const [cvFilter, setCvFilter] = React.useState('')

  const filtered = analyses.filter((a) =>
    (!cvFilter || a.cvId === cvFilter) &&
    (!q || `${a.offerTitle} ${a.offerText.slice(0, 300)}`.toLowerCase().includes(q.toLowerCase())),
  )
  const avg = analyses.length ? Math.round(analyses.reduce((s, a) => s + a.result.score, 0) / analyses.length) : 0
  const best = analyses.reduce<AnalysisDoc | null>((b, a) => (!b || a.result.score > b.result.score ? a : b), null)
  const last5 = analyses.slice(0, 5), prev5 = analyses.slice(5, 10)
  const trend = last5.length && prev5.length
    ? Math.round(last5.reduce((s, a) => s + a.result.score, 0) / last5.length - prev5.reduce((s, a) => s + a.result.score, 0) / prev5.length)
    : null

  const remove = async (a: AnalysisDoc) => {
    if (!confirm(`Supprimer l'analyse « ${a.offerTitle} » ?`)) return
    await removeAnalysis(a.id).catch((e) => toast(e.message, 'error'))
  }

  return (
    <div>
      <PageHeader title="Historique" description="Toutes vos analyses, rouvrables sans utiliser de crédit." />

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
            <HistoryIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Aucune analyse pour le moment</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Vos rapports s'enregistreront ici automatiquement.</p>
          <Button className="mt-5" onClick={() => navigate('analyser')}>Analyser une offre</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Analyses" value={analyses.length} />
            <StatCard label="Score moyen" value={<>{avg}<span className="text-sm font-normal text-muted-foreground">/100</span></>} />
            <StatCard label="Meilleur score" value={best?.result.score ?? '—'} hint={best?.offerTitle} />
            <StatCard
              label="Tendance récente"
              icon={TrendingUpIcon}
              value={trend === null ? '—' : <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>{trend > 0 ? '+' : ''}{trend} pts</span>}
              hint={trend === null ? 'Après 10 analyses' : '5 dernières vs 5 précédentes'}
            />
          </div>

          <section className="rounded-xl border bg-card p-4 shadow-xs" aria-labelledby="chart-title">
            <h2 id="chart-title" className="mb-2 text-sm font-semibold">Évolution de vos scores</h2>
            <ScoreChart items={analyses} />
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-labelledby="list-title">
            <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              <h2 id="list-title" className="flex-1 text-sm font-semibold">{filtered.length} analyse{filtered.length > 1 ? 's' : ''}</h2>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
                <label htmlFor="hist-q" className="sr-only">Rechercher</label>
                <input id="hist-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une offre" className={cn(fieldClass, 'h-9 w-full pr-3 pl-8 sm:w-56')} />
              </div>
              {cvs.length > 1 && (
                <>
                  <label htmlFor="hist-cv" className="sr-only">Filtrer par CV</label>
                  <select id="hist-cv" value={cvFilter} onChange={(e) => setCvFilter(e.target.value)} className={cn(fieldClass, 'h-9 px-2 sm:w-40')}>
                    <option value="">Tous les CV</option>
                    {cvs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </>
              )}
            </header>
            <ul className="divide-y">
              {filtered.map((a) => {
                const tools = Object.keys(a.tools || {}).length
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                    <Badge tone={toneBadge(a.result.score)} className="w-10 justify-center py-1 text-sm">{a.result.score}</Badge>
                    <button type="button" onClick={() => navigate(`analyse/${a.id}`)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold hover:text-primary">{a.offerTitle}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {fmtDate(a.createdAt)}
                        {a.cvName && ` · ${a.cvName}`}
                        {a.offerUrl && ` · ${hostOf(a.offerUrl)}`}
                        {a.source === 'comparaison' && ' · comparatif'}
                        {tools > 0 && ` · ${tools} document${tools > 1 ? 's' : ''} généré${tools > 1 ? 's' : ''}`}
                      </span>
                    </button>
                    <Button variant="destructive" size="icon-sm" onClick={() => remove(a)} aria-label={`Supprimer ${a.offerTitle}`}>
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

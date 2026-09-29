import * as React from 'react'
import { AlertCircleIcon, ClipboardPasteIcon, ExternalLinkIcon, LinkIcon, LoaderCircleIcon, PlusIcon, ScaleIcon, SearchIcon, Trash2Icon, TrophyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CvSummary } from '@/components/cv-card'
import { Badge, CompanyAvatar, Notice, PageHeader, fieldClass } from '@/components/common'
import { toneBadge } from '@/components/results-view'
import { ScoreGauge, scoreTone } from '@/components/score-gauge'
import { BlurFade } from '@/components/magicui/blur-fade'
import { BorderBeam } from '@/components/magicui/border-beam'
import { DotPattern } from '@/components/magicui/dot-pattern'
import { api, newId, type Analysis, type CompareItem } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { MIN_WORDS, hostOf, isLinkedIn, offerTitle, words } from '@/lib/text'
import { cn } from '@/lib/utils'

export const MAX_COMPARE = 5

export const newCompareItem = (text: string, url?: string, title?: string): CompareItem => ({
  id: newId(),
  title: title || offerTitle(text) || 'Offre sans titre',
  text,
  url,
  status: 'idle',
})

// Lance au plus `limit` analyses en parallèle.
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift()!)
  }))
}

const CATEGORIES = [
  { key: 'Compétences techniques', short: 'Technique' },
  { key: 'Expérience', short: 'Expérience' },
  { key: 'Formation', short: 'Formation' },
  { key: 'Soft skills', short: 'Soft skills' },
  { key: 'Langues', short: 'Langues' },
]

const splitTitle = (t: string) => {
  const [title, company] = t.split(' · ')
  return { title, company: company || '' }
}

function CategoryCell({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-subtle-foreground">—</span>
  return (
    <div className="w-12">
      <span className="text-xs font-semibold tabular-nums">{score}</span>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full origin-left rounded-full', scoreTone(score).bg)} style={{ transform: `scaleX(${score / 100})` }} />
      </div>
    </div>
  )
}

function StatusScore({ it, r, compact }: { it: CompareItem; r?: Analysis; compact?: boolean }) {
  if (r) return <ScoreGauge score={r.score} size={compact ? 52 : 60} compact />
  if (it.status === 'loading') return <LoaderCircleIcon className="size-6 animate-spin text-primary" aria-label="Analyse en cours" />
  if (it.status === 'error') return <AlertCircleIcon className="size-6 text-destructive" aria-label="Erreur" />
  return <span className="text-xs font-semibold text-subtle-foreground">À analyser</span>
}

export function ComparePage({ openBookmarklet }: { openBookmarklet: () => void }) {
  const { compare: items, setCompare: setItems, analyses, addAnalysis, defaultCv } = useData()
  const [mode, setMode] = React.useState<'url' | 'text'>('url')
  const [url, setUrl] = React.useState('')
  const [text, setText] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState('')
  const [running, setRunning] = React.useState(false)

  const cvOk = !!defaultCv && words(defaultCv.text) >= MIN_WORDS
  const full = items.length >= MAX_COMPARE
  const results = React.useMemo(() => new Map(analyses.map((a) => [a.id, a.result])), [analyses])
  const resultOf = (it: CompareItem) => (it.analysisId ? results.get(it.analysisId) : undefined)
  const update = (id: string, patch: Partial<CompareItem>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (full) return
    if (mode === 'text') {
      if (words(text) < MIN_WORDS) { setError(`L'offre doit contenir au moins ${MIN_WORDS} mots.`); return }
      setItems((l) => [...l, newCompareItem(text.trim())])
      setText('')
      return
    }
    const u = url.trim()
    if (!u) return
    if (isLinkedIn(u)) { openBookmarklet(); return }
    setAdding(true)
    try {
      const data = await api.fetchOffer(u)
      setItems((l) => [...l, newCompareItem(data.text, data.url, data.company ? `${data.title} · ${data.company}` : data.title)])
      setUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const compare = async () => {
    if (!defaultCv) return
    const todo = items.filter((it) => !resultOf(it))
    if (!todo.length) return
    setRunning(true)
    todo.forEach((it) => update(it.id, { status: 'loading', error: undefined }))
    await pool(todo, 3, async (it) => {
      try {
        const doc = await api.analyze({ cv: defaultCv.text, offer: it.text, offerUrl: it.url, cvId: defaultCv.id, cvName: defaultCv.name, source: 'comparaison' })
        addAnalysis(doc)
        update(it.id, { status: 'done', analysisId: doc.id, score: doc.result.score })
      } catch (err) {
        update(it.id, { status: 'error', error: (err as Error).message })
      }
    })
    setRunning(false)
  }

  const ranked = [...items].sort((a, b) => (resultOf(b)?.score ?? -1) - (resultOf(a)?.score ?? -1))
  const pending = items.filter((it) => !resultOf(it)).length
  const analysed = items.length - pending
  const bestId = analysed > 1 ? ranked[0].id : null
  const best = bestId ? ranked[0] : null
  const bestResult = best ? resultOf(best) : undefined
  const remove = (id: string) => setItems((l) => l.filter((x) => x.id !== id))
  const openDetail = (it: CompareItem) => it.analysisId && navigate(`analyse/${it.analysisId}`)

  return (
    <div>
      <PageHeader
        title="Comparer des offres"
        description={`Jusqu'à ${MAX_COMPARE} offres analysées avec votre CV par défaut, puis classées par compatibilité.`}
        actions={pending > 0 && (
          <Button onClick={compare} disabled={running || !cvOk}>
            {running ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <ScaleIcon aria-hidden="true" />}
            {running ? 'Analyse en cours…' : `Analyser ${pending > 1 ? `${pending} offres` : "l'offre"} · ${pending} crédit${pending > 1 ? 's' : ''}`}
          </Button>
        )}
      />

      <div className="space-y-5">
        <CvSummary />

        <section aria-labelledby="add-title" className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="add-title" className="text-sm font-semibold">
              Ajouter une offre <span className="ml-1 font-normal text-muted-foreground tabular-nums">{items.length}/{MAX_COMPARE}</span>
            </h2>
            <div className="inline-flex rounded-lg border bg-muted/60 p-0.5" role="group" aria-label="Mode d'ajout">
              {([['url', 'Lien', LinkIcon], ['text', 'Texte', ClipboardPasteIcon]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => { setMode(m); setError('') }}
                  className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors', mode === m ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
                >
                  <Icon className="size-3.5" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={add} className={cn('flex gap-2', mode === 'text' && 'flex-col')}>
            {mode === 'url' ? (
              <>
                <label htmlFor="cmp-url" className="sr-only">Lien de l'offre</label>
                <input id="cmp-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={full} placeholder="https://… (Indeed, Welcome to the Jungle, France Travail…)" className={cn(fieldClass, 'h-10 min-w-0 flex-1 px-3')} />
              </>
            ) : (
              <>
                <label htmlFor="cmp-text" className="sr-only">Texte de l'offre</label>
                <textarea id="cmp-text" value={text} onChange={(e) => setText(e.target.value)} disabled={full} placeholder="Collez l'annonce complète (la première ligne sert de titre)…" className={cn(fieldClass, 'min-h-32 resize-y p-3 leading-relaxed')} />
              </>
            )}
            <Button type="submit" variant="outline" disabled={full || adding || (mode === 'url' ? !url.trim() : !text.trim())} className={cn(mode === 'text' && 'self-end')}>
              {adding ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
              {adding ? 'Import…' : 'Ajouter'}
            </Button>
          </form>
          {full && <p className="mt-2 text-xs text-muted-foreground">Maximum atteint : retirez une offre pour en ajouter une autre.</p>}
          {error && <div className="mt-3"><Notice error={error} /></div>}
        </section>

        {items.length === 0 ? (
          <div className="relative overflow-hidden rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <DotPattern width={18} height={18} cr={1} className="text-border-strong [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
            <div className="relative">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
                <ScaleIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold">Comparez vos pistes</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Ajoutez des offres par lien ou texte ci-dessus, ou laissez Claude en trouver qui correspondent à votre profil.</p>
              <Button variant="outline" className="mt-5" onClick={() => navigate('offres')}>
                <SearchIcon aria-hidden="true" /> Trouver des offres pour moi
              </Button>
            </div>
          </div>
        ) : (
          <section aria-labelledby="rank-title" className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 id="rank-title" className="text-sm font-semibold">{analysed ? 'Classement' : 'Offres à comparer'}</h2>
              {running && <span className="text-xs text-muted-foreground">Analyses en parallèle · ~30 s</span>}
            </header>

            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-2.5 text-left font-semibold">#</th>
                    <th scope="col" className="px-2 py-2.5 text-left font-semibold">Offre</th>
                    <th scope="col" className="px-2 py-2.5 text-center font-semibold">Score</th>
                    {CATEGORIES.map((c) => <th key={c.key} scope="col" className="hidden px-1.5 py-2.5 text-left font-semibold lg:table-cell">{c.short}</th>)}
                    <th scope="col" className="px-2 py-2.5 text-left font-semibold">Manquants</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((it, index) => {
                    const r = resultOf(it)
                    const { title, company } = splitTitle(it.title)
                    const isBest = it.id === bestId
                    return (
                      <tr key={it.id} className={cn('border-t transition-colors hover:bg-muted/40', isBest && 'bg-success-soft/40')}>
                        <td className="px-4 py-3 align-middle font-semibold text-muted-foreground tabular-nums">
                          {isBest ? <TrophyIcon className="size-4 text-success" aria-label="Meilleur choix" /> : r ? index + 1 : '–'}
                        </td>
                        <td className="max-w-60 px-2 py-3">
                          <div className="flex items-center gap-3">
                            <CompanyAvatar name={company || title} className="size-9 text-xs" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold" title={title}>{title}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {company && <span>{company} · </span>}
                                {it.url ? (
                                  <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                                    {hostOf(it.url)} <ExternalLinkIcon className="size-3" aria-hidden="true" />
                                  </a>
                                ) : 'Texte collé'}
                              </p>
                              {it.status === 'error' && <p className="mt-0.5 text-xs text-destructive">{it.error}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center"><div className="flex justify-center"><StatusScore it={it} r={r} /></div></td>
                        {CATEGORIES.map((c) => (
                          <td key={c.key} className="hidden px-1.5 py-3 lg:table-cell">
                            <CategoryCell score={r?.breakdown.find((b) => b.category === c.key)?.score} />
                          </td>
                        ))}
                        <td className="px-2 py-3">
                          {r ? <span title={r.missing_keywords.join(', ')}><Badge tone="danger">{r.missing_keywords.length} mots-clés</Badge></span> : <span className="text-subtle-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {r && <Button size="sm" variant="outline" onClick={() => openDetail(it)}>Rapport</Button>}
                            <Button size="icon-sm" variant="destructive" onClick={() => remove(it.id)} disabled={it.status === 'loading'} aria-label={`Retirer ${title}`}>
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ol className="divide-y md:hidden">
              {ranked.map((it, index) => {
                const r = resultOf(it)
                const { title, company } = splitTitle(it.title)
                const isBest = it.id === bestId
                return (
                  <li key={it.id}>
                    <BlurFade delay={0.04 * index} className="relative p-4">
                      <div className="flex items-start gap-3">
                        <StatusScore it={it} r={r} compact />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {r && <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>}
                            {isBest && <Badge tone="success"><TrophyIcon className="size-3" aria-hidden="true" />Meilleur choix</Badge>}
                            {r && <Badge tone={toneBadge(r.score)}>{scoreTone(r.score).label}</Badge>}
                          </div>
                          <p className="mt-1 font-semibold">{title}</p>
                          <p className="text-xs text-muted-foreground">{company || (it.url ? hostOf(it.url) : 'Texte collé')}</p>
                          {r && <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-semibold text-destructive">{r.missing_keywords.length} manquants</span> · {r.missing_keywords.slice(0, 3).join(', ')}</p>}
                          {it.status === 'error' && <p className="mt-1 text-xs text-destructive">{it.error}</p>}
                          <div className="mt-3 flex gap-2">
                            {r && <Button size="sm" variant="outline" onClick={() => openDetail(it)}>Voir le rapport</Button>}
                            <Button size="sm" variant="destructive" onClick={() => remove(it.id)} disabled={it.status === 'loading'}>
                              <Trash2Icon aria-hidden="true" /> Retirer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </BlurFade>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {best && bestResult && (
          <BlurFade delay={0.1} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
            <BorderBeam size={120} duration={8} borderWidth={1.5} colorFrom="#22c55e" colorTo="#2563eb" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-soft">
                <TrophyIcon className="size-5 text-success" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Recommandation : {splitTitle(best.title).title}{splitTitle(best.title).company && ` chez ${splitTitle(best.title).company}`}</p>
                <p className="text-sm text-muted-foreground">
                  Meilleur score ({bestResult.score}/100), avec {bestResult.missing_keywords.length} mots-clés à ajouter. {bestResult.priority_actions[0]}
                </p>
              </div>
              <Button size="sm" onClick={() => openDetail(best)}>Ouvrir le rapport</Button>
            </div>
          </BlurFade>
        )}
      </div>
    </div>
  )
}

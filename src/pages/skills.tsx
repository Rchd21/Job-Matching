import * as React from 'react'
import { BookOpenIcon, ClockIcon, ExternalLinkIcon, GraduationCapIcon, LoaderCircleIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Notice, PageHeader, Panel } from '@/components/common'
import { BlurFade } from '@/components/magicui/blur-fade'
import { api } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'

const PRIORITY_TONE = { haute: 'danger', moyenne: 'warning', basse: 'neutral' } as const

export function SkillsPage() {
  const { analyses, skillPlan, setSkillPlan } = useData()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  // Compétences manquantes les plus fréquentes, calculées à partir de l'historique.
  const missing = React.useMemo(() => {
    const counts = new Map<string, { keyword: string; count: number }>()
    for (const a of analyses) {
      for (const k of a.result.missing_keywords) {
        const key = k.trim().toLowerCase()
        const cur = counts.get(key) || { keyword: k.trim(), count: 0 }
        cur.count += 1
        counts.set(key, cur)
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 12)
  }, [analyses])
  const max = missing[0]?.count || 1
  const stale = skillPlan && skillPlan.basedOn < analyses.length

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      setSkillPlan(await api.skillsPlan())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`

  return (
    <div>
      <PageHeader
        title="Plan de compétences"
        description="Les compétences qui vous manquent le plus souvent dans les offres visées, et comment les acquérir."
        actions={analyses.length > 0 && (
          <Button onClick={generate} disabled={busy}>
            {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : skillPlan ? <RefreshCwIcon aria-hidden="true" /> : <SparklesIcon aria-hidden="true" />}
            {busy ? 'Génération…' : skillPlan ? 'Mettre à jour le plan · 1 crédit' : 'Générer mon plan · 1 crédit'}
          </Button>
        )}
      />

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
            <GraduationCapIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Analysez quelques offres d'abord</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Le plan s'appuie sur les mots-clés manquants de vos analyses. Plus vous en faites, plus il est précis.</p>
          <Button className="mt-5" onClick={() => navigate('analyser')}>Analyser une offre</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {error && <Notice error={error} />}
          {stale && <Notice notice={`Plan basé sur ${skillPlan!.basedOn} analyse(s) ; vous en avez ${analyses.length} maintenant. Mettez-le à jour pour en tenir compte.`} />}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] [&>*]:min-w-0">
            <Panel icon={BookOpenIcon} title="Compétences les plus demandées" subtitle={`Absentes de votre CV · ${analyses.length} analyse${analyses.length > 1 ? 's' : ''}`}>
              {missing.length ? (
                <ol className="space-y-2.5">
                  {missing.map((m) => (
                    <li key={m.keyword}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{m.keyword}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{m.count} offre{m.count > 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(m.count / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-muted-foreground">Aucune compétence manquante détectée.</p>}
            </Panel>

            <div className="space-y-4">
              {skillPlan ? (
                <>
                  <div className="rounded-xl border bg-card p-4 shadow-xs">
                    <p className="text-sm leading-relaxed">{skillPlan.plan.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Généré le {new Date(skillPlan.generatedAt).toLocaleDateString('fr-FR')} à partir de {skillPlan.basedOn} analyse(s).</p>
                  </div>
                  {skillPlan.plan.skills.map((s, i) => (
                    <BlurFade key={s.name} delay={0.05 * i} className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{s.name}</h3>
                        <Badge tone={PRIORITY_TONE[s.priority]}>Priorité {s.priority}</Badge>
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><ClockIcon className="size-3.5" aria-hidden="true" />{s.duration}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.why}</p>
                      <div className="mt-4 grid grid-cols-1 gap-4 break-words md:grid-cols-2 [&>*]:min-w-0">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Étapes</h4>
                          <ol className="space-y-1.5">
                            {s.steps.map((st, j) => (
                              <li key={j} className="flex gap-2 text-sm"><span className="font-semibold text-primary tabular-nums">{j + 1}.</span>{st}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Ressources</h4>
                          <ul className="space-y-1.5">
                            {s.resources.map((r) => (
                              <li key={r.title} className="flex items-center gap-2 text-sm">
                                <Badge>{r.type}</Badge>
                                <a href={search(r.title)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline">
                                  <span className="truncate">{r.title}</span> <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </BlurFade>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
                  <SparklesIcon className="size-6 text-primary" aria-hidden="true" />
                  <h2 className="mt-3 font-semibold">Obtenez votre plan personnalisé</h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Claude regroupe vos lacunes, les priorise et propose étapes, durées et ressources reconnues.</p>
                  <Button className="mt-5" onClick={generate} disabled={busy}>
                    {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <SparklesIcon aria-hidden="true" />} Générer mon plan
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

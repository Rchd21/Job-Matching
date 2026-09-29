import * as React from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowLeftIcon, BanknoteIcon, CheckIcon, CircleAlertIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, KanbanSquareIcon, ListChecksIcon, LoaderCircleIcon,
  MailIcon, MessagesSquareIcon, PlusIcon, PrinterIcon, RefreshCwIcon, SparklesIcon, TagsIcon, TargetIcon, ThumbsUpIcon,
} from 'lucide-react'
import { api, newId, type AnalysisDoc, type Impact, type ToolName } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge, PageHeader, Panel, StatCard, Tabs } from '@/components/common'
import { ScoreGauge, scoreTone } from '@/components/score-gauge'
import { useToast } from '@/components/toast'
import { BlurFade } from '@/components/magicui/blur-fade'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { copyText, downloadDocx, printDocument } from '@/lib/export'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { hostOf } from '@/lib/text'
import { cn } from '@/lib/utils'

type TabValue = 'conseils' | 'mots-cles' | 'forces' | 'cv' | 'lettre' | 'entretien' | 'salaire'

const IMPACT: Record<Impact, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: 'Impact fort', tone: 'danger' },
  medium: { label: 'Impact moyen', tone: 'warning' },
  low: { label: 'Impact faible', tone: 'neutral' },
}

export const toneBadge = (score: number) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger'

function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print"
      onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1600) } }}
    >
      {done ? <CheckIcon className="text-success" aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {done ? 'Copié' : label}
    </Button>
  )
}

const TOOL_INFO: Record<ToolName, { icon: React.ElementType; title: string; text: string }> = {
  tailor: { icon: FileTextIcon, title: 'CV adapté à cette offre', text: "Claude réécrit votre CV avec le vocabulaire de l'offre et met en avant vos expériences les plus pertinentes, sans rien inventer." },
  letter: { icon: MailIcon, title: 'Lettre de motivation', text: 'Une lettre personnalisée de 250 à 350 mots, construite à partir de vos réalisations réelles.' },
  interview: { icon: MessagesSquareIcon, title: "Préparation d'entretien", text: 'Les questions les plus probables pour ce poste, pourquoi elles sont posées et comment y répondre.' },
  salary: { icon: BanknoteIcon, title: 'Estimation du salaire', text: 'Une fourchette indicative pour ce poste, votre expérience et la ville, avec des conseils de négociation.' },
}

function ToolEmpty({ tool, busy, onRun }: { tool: ToolName; busy: boolean; onRun: () => void }) {
  const info = TOOL_INFO[tool]
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft">
        <info.icon className="size-5 text-primary" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold">{info.title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{info.text}</p>
      <Button className="mt-5" onClick={onRun} disabled={busy}>
        {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <SparklesIcon aria-hidden="true" />}
        {busy ? 'Génération… (20 à 40 s)' : 'Générer · 1 crédit'}
      </Button>
    </div>
  )
}

function ToolFooter({ at, busy, onRun }: { at: string; busy: boolean; onRun: () => void }) {
  return (
    <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
      <span>Généré le {new Date(at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · à relire avant envoi</span>
      <Button variant="ghost" size="sm" onClick={onRun} disabled={busy}>
        {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <RefreshCwIcon aria-hidden="true" />} Régénérer
      </Button>
    </div>
  )
}

export function ResultsView({ doc, onBack, backLabel = 'Nouvelle analyse' }: { doc: AnalysisDoc; onBack: () => void; backLabel?: string }) {
  const { addAnalysis, saveApplication, applications } = useData()
  const toast = useToast()
  const data = doc.result
  const [tab, setTab] = React.useState<TabValue>('conseils')
  const [busyTool, setBusyTool] = React.useState<ToolName | null>(null)
  const tone = scoreTone(data.score)
  const totalKw = data.matched_keywords.length + data.missing_keywords.length
  const coverage = totalKw ? Math.round((data.matched_keywords.length / totalKw) * 100) : 0
  const highImpact = data.recommendations.filter((r) => r.impact === 'high').length
  const tracked = applications.find((a) => a.analysisId === doc.id)

  React.useEffect(() => {
    if (data.score < 75) return
    const id = setTimeout(() => {
      confetti({ particleCount: 80, spread: 70, startVelocity: 36, origin: { y: 0.3 }, zIndex: 60, disableForReducedMotion: true })
    }, 900)
    return () => clearTimeout(id)
  }, [data.score, doc.id])

  const runTool = async (tool: ToolName) => {
    setBusyTool(tool)
    try {
      addAnalysis(await api.tool(doc.id, tool))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusyTool(null)
    }
  }

  const track = async () => {
    const [title, companyLine] = doc.offerText.trim().split('\n')
    const company = (companyLine || '').split('·')[0].trim()
    await saveApplication({
      id: newId(), title: title.slice(0, 120), company: company.startsWith('Source') ? '' : company.slice(0, 80), url: doc.offerUrl,
      status: 'a-postuler', createdAt: new Date().toISOString(), analysisId: doc.id, score: data.score,
    })
    toast('Offre ajoutée à vos candidatures.')
  }

  const t = doc.tools || {}
  const tabs = [
    { value: 'conseils' as const, label: 'Recommandations', count: data.recommendations.length },
    { value: 'mots-cles' as const, label: 'Mots-clés', count: totalKw },
    { value: 'forces' as const, label: 'Forces et écarts' },
    { value: 'cv' as const, label: t.tailor ? 'CV adapté ✓' : 'CV adapté' },
    { value: 'lettre' as const, label: t.letter ? 'Lettre ✓' : 'Lettre' },
    { value: 'entretien' as const, label: t.interview ? 'Entretien ✓' : 'Entretien' },
    { value: 'salaire' as const, label: t.salary ? 'Salaire ✓' : 'Salaire' },
  ]
  const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  return (
    <div>
      <PageHeader
        eyebrow={
          <button type="button" onClick={onBack} className="no-print inline-flex items-center gap-1.5 rounded text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" /> {backLabel}
          </button>
        }
        title={doc.offerTitle || 'Rapport de compatibilité'}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {doc.cvName && <span>CV : {doc.cvName}</span>}
            {doc.offerUrl && (
              <a href={doc.offerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                {hostOf(doc.offerUrl)} <ExternalLinkIcon className="size-3" aria-hidden="true" />
              </a>
            )}
          </span>
        }
        actions={
          <>
            {tracked ? (
              <Button variant="outline" onClick={() => navigate('candidatures')}><KanbanSquareIcon aria-hidden="true" /> Voir la candidature</Button>
            ) : (
              <Button variant="outline" onClick={track}><PlusIcon aria-hidden="true" /> Suivre la candidature</Button>
            )}
            <Button variant="outline" onClick={() => window.print()}><PrinterIcon aria-hidden="true" /> PDF</Button>
          </>
        }
      />

      <div className="space-y-5">
        <BlurFade delay={0.04} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Score global" icon={TargetIcon}>
            <div className="mt-2 flex items-baseline gap-1">
              <NumberTicker value={data.score} className="text-2xl font-bold tracking-tight" />
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="mt-1"><Badge tone={toneBadge(data.score)}>{tone.label}</Badge></div>
          </StatCard>
          <StatCard label="Mots-clés couverts" icon={TagsIcon} hint={`${data.matched_keywords.length} sur ${totalKw} termes de l'offre`}>
            <div className="mt-2 flex items-baseline gap-0.5">
              <NumberTicker value={coverage} className="text-2xl font-bold tracking-tight" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </StatCard>
          <StatCard label="Points forts" icon={ThumbsUpIcon} value={data.strengths.length} hint="Atouts pour ce poste" />
          <StatCard label="Actions à fort impact" icon={SparklesIcon} value={highImpact} hint={`sur ${data.recommendations.length} recommandations`} />
        </BlurFade>

        <BlurFade delay={0.1} className="grid gap-5 lg:grid-cols-3">
          <Panel icon={TargetIcon} title="Synthèse" subtitle="Évaluation par catégorie" className="lg:col-span-2">
            <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2 sm:border-r sm:pr-6">
                <ScoreGauge score={data.score} size={148} />
                <Badge tone={toneBadge(data.score)}>{tone.label}</Badge>
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">Scores par catégorie</caption>
                  <tbody>
                    {data.breakdown.map((b) => (
                      <tr key={b.category} className="border-t first:border-t-0">
                        <th scope="row" className="w-40 py-2 pr-3 text-left font-medium">{b.category}</th>
                        <td className="py-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <div className={cn('h-full origin-left rounded-full transition-transform duration-700', scoreTone(b.score).bg)} style={{ transform: `scaleX(${b.score / 100})` }} />
                          </div>
                        </td>
                        <td className="w-12 py-2 pl-3 text-right font-semibold tabular-nums">{b.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel icon={ListChecksIcon} title="Actions prioritaires" subtitle="Les 3 changements les plus rentables">
            <ol className="space-y-3">
              {data.priority_actions.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-sm leading-relaxed">{a}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </BlurFade>

        <BlurFade delay={0.16} className="rounded-xl border bg-card shadow-xs">
          <div className="no-print px-4 pt-1">
            <Tabs tabs={tabs} value={tab} onChange={setTab} label="Détails et outils" idPrefix="res" />
          </div>
          <div role="tabpanel" id={`res-panel-${tab}`} aria-labelledby={`res-tab-${tab}`} className="p-4 sm:p-5">
            <BlurFade key={tab} duration={0.25}>
              {tab === 'conseils' && (
                <ol className="divide-y">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[2rem_1fr]">
                      <span className="hidden text-sm font-semibold text-subtle-foreground tabular-nums sm:block">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{r.title}</h3>
                          <Badge tone={IMPACT[r.impact].tone}>{IMPACT[r.impact].label}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
                        {r.example && (
                          <div className="mt-3 flex items-start gap-3 rounded-lg border bg-muted/50 p-3">
                            <p className="min-w-0 flex-1 text-sm leading-relaxed">{r.example}</p>
                            <CopyButton text={r.example} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {tab === 'mots-cles' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <CheckIcon className="size-4 text-success" aria-hidden="true" /> Présents dans votre CV <Badge tone="success">{data.matched_keywords.length}</Badge>
                    </h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {data.matched_keywords.map((k) => <li key={k} className="rounded-md border border-success/25 bg-success-soft px-2 py-1 text-xs font-semibold text-success">{k}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <PlusIcon className="size-4 text-destructive" aria-hidden="true" /> Absents de votre CV <Badge tone="danger">{data.missing_keywords.length}</Badge>
                    </h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {data.missing_keywords.map((k) => <li key={k} className="rounded-md border border-dashed border-destructive/40 bg-destructive-soft px-2 py-1 text-xs font-semibold text-destructive">{k}</li>)}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">Les logiciels de tri (ATS) recherchent ces termes exacts. N'ajoutez que ce que vous maîtrisez réellement.</p>
                  </div>
                </div>
              )}

              {tab === 'forces' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ThumbsUpIcon className="size-4 text-success" aria-hidden="true" /> Points forts</h3>
                    <ul className="space-y-2.5">
                      {data.strengths.map((s, i) => <li key={i} className="flex gap-2.5 text-sm leading-relaxed"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CircleAlertIcon className="size-4 text-warning" aria-hidden="true" /> Écarts avec l'offre</h3>
                    <ul className="space-y-2.5">
                      {data.gaps.map((s, i) => <li key={i} className="flex gap-2.5 text-sm leading-relaxed"><CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />{s}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'cv' && (t.tailor ? (
                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <CopyButton text={t.tailor.cv} label="Copier le CV" />
                    <Button variant="outline" size="sm" onClick={() => downloadDocx(`CV - ${doc.offerTitle}`, t.tailor!.cv)}><DownloadIcon aria-hidden="true" /> Word</Button>
                    <Button variant="outline" size="sm" onClick={() => printDocument(`CV - ${doc.offerTitle}`, t.tailor!.cv) || toast('Autorisez les fenêtres pop-up pour exporter en PDF.', 'error')}><PrinterIcon aria-hidden="true" /> PDF</Button>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                    <pre className="max-h-[36rem] overflow-auto rounded-lg border bg-muted/40 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{t.tailor.cv}</pre>
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Modifications apportées</h3>
                      <ol className="space-y-3">
                        {t.tailor.changes.map((c, i) => (
                          <li key={i} className="rounded-lg border p-3 text-sm">
                            <Badge tone="primary">{c.section}</Badge>
                            <p className="mt-1.5 font-medium">{c.change}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{c.reason}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <ToolFooter at={t.tailor.generatedAt} busy={busyTool === 'tailor'} onRun={() => runTool('tailor')} />
                </div>
              ) : <ToolEmpty tool="tailor" busy={busyTool === 'tailor'} onRun={() => runTool('tailor')} />)}

              {tab === 'lettre' && (t.letter ? (
                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <CopyButton text={`${t.letter.subject}\n\n${t.letter.body}`} label="Copier la lettre" />
                    <Button variant="outline" size="sm" onClick={() => downloadDocx(`Lettre - ${doc.offerTitle}`, `Objet : ${t.letter!.subject}\n\n${t.letter!.body}`)}><DownloadIcon aria-hidden="true" /> Word</Button>
                    <Button variant="outline" size="sm" onClick={() => printDocument(`Lettre - ${doc.offerTitle}`, `Objet : ${t.letter!.subject}\n\n${t.letter!.body}`) || toast('Autorisez les fenêtres pop-up pour exporter en PDF.', 'error')}><PrinterIcon aria-hidden="true" /> PDF</Button>
                  </div>
                  <article className="mx-auto max-w-2xl rounded-lg border bg-muted/30 p-6 text-sm leading-relaxed">
                    <p className="mb-4 font-semibold">Objet : {t.letter.subject}</p>
                    <div className="whitespace-pre-wrap">{t.letter.body}</div>
                  </article>
                  <ToolFooter at={t.letter.generatedAt} busy={busyTool === 'letter'} onRun={() => runTool('letter')} />
                </div>
              ) : <ToolEmpty tool="letter" busy={busyTool === 'letter'} onRun={() => runTool('letter')} />)}

              {tab === 'entretien' && (t.interview ? (
                <div>
                  <ol className="space-y-3">
                    {t.interview.questions.map((q, i) => (
                      <li key={i}>
                        <details className="group rounded-lg border bg-card open:bg-muted/30">
                          <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                            <span className="text-sm font-semibold text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                            <span className="min-w-0 flex-1">
                              <Badge tone={q.category === 'Point faible' ? 'warning' : 'neutral'}>{q.category}</Badge>
                              <span className="mt-1.5 block text-sm font-semibold">{q.question}</span>
                            </span>
                            <PlusIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true" />
                          </summary>
                          <div className="space-y-2 px-4 pb-4 pl-11 text-sm">
                            <p><span className="font-semibold">Pourquoi : </span><span className="text-muted-foreground">{q.why}</span></p>
                            <p><span className="font-semibold">Comment répondre : </span><span className="text-muted-foreground">{q.tips}</span></p>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                  <ToolFooter at={t.interview.generatedAt} busy={busyTool === 'interview'} onRun={() => runTool('interview')} />
                </div>
              ) : <ToolEmpty tool="interview" busy={busyTool === 'interview'} onRun={() => runTool('interview')} />)}

              {tab === 'salaire' && (t.salary ? (
                <div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label="Fourchette basse" value={eur(t.salary.low)} hint="brut annuel" />
                    <StatCard label="Médiane estimée" value={<span className="text-primary">{eur(t.salary.median)}</span>} hint="brut annuel" />
                    <StatCard label="Fourchette haute" value={eur(t.salary.high)} hint="brut annuel" />
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-gradient-to-r from-warning/40 via-primary/60 to-success/50" aria-hidden="true" />
                  <p className="mt-4 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Base : </span>{t.salary.basis}</p>
                  <p className="mt-2 text-sm leading-relaxed">{t.salary.rationale}</p>
                  <h3 className="mt-5 mb-2 text-sm font-semibold">Conseils de négociation</h3>
                  <ul className="space-y-2">
                    {t.salary.tips.map((tip, i) => <li key={i} className="flex gap-2.5 text-sm"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{tip}</li>)}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">Estimation indicative générée par IA, à recouper avec les grilles du secteur et les salaires affichés dans des offres similaires.</p>
                  <ToolFooter at={t.salary.generatedAt} busy={busyTool === 'salary'} onRun={() => runTool('salary')} />
                </div>
              ) : <ToolEmpty tool="salary" busy={busyTool === 'salary'} onRun={() => runTool('salary')} />)}
            </BlurFade>
          </div>
        </BlurFade>
      </div>
    </div>
  )
}

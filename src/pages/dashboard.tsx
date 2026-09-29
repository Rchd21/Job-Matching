import { ArrowRightIcon, BellRingIcon, FileTextIcon, KanbanSquareIcon, ScaleIcon, SearchIcon, SparklesIcon, TargetIcon, TrophyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, CompanyAvatar, PageHeader, Panel, StatCard } from '@/components/common'
import { toneBadge } from '@/components/results-view'
import { BlurFade } from '@/components/magicui/blur-fade'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { needsFollowUp, STATUS_LABEL } from '@/pages/applications'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { MIN_WORDS, words } from '@/lib/text'

const hello = () => (new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir')

export function DashboardPage() {
  const { user, analyses, applications, suggestions, defaultCv, usage } = useData()
  const cvOk = !!defaultCv && words(defaultCv.text) >= MIN_WORDS
  const avg = analyses.length ? Math.round(analyses.reduce((s, a) => s + a.result.score, 0) / analyses.length) : 0
  const active = applications.filter((a) => a.status !== 'refuse' && a.status !== 'offre')
  const interviews = applications.filter((a) => a.status === 'entretien').length
  const due = applications.filter(needsFollowUp)
  const newOffers = suggestions?.offers.filter((o) => o.isNew) || []

  const steps = [
    { done: cvOk, label: 'Ajouter votre CV', go: 'cv' },
    { done: analyses.length > 0, label: 'Analyser une première offre', go: 'analyser' },
    { done: !!suggestions, label: 'Trouver des offres pour vous', go: 'offres' },
    { done: applications.length > 0, label: 'Suivre une candidature', go: 'candidatures' },
  ]
  const onboarding = steps.some((s) => !s.done)

  return (
    <div>
      <PageHeader
        title={`${hello()} ${user.name}`}
        description="Voici où en est votre recherche d'emploi."
        actions={<Button onClick={() => navigate('analyser')}><SparklesIcon aria-hidden="true" /> Analyser une offre</Button>}
      />

      <div className="space-y-5">
        {onboarding && (
          <BlurFade className="rounded-xl border bg-card p-4 shadow-xs">
            <p className="text-sm font-semibold">Bien démarrer · {steps.filter((s) => s.done).length}/{steps.length}</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <button
                    type="button"
                    onClick={() => navigate(s.go)}
                    disabled={s.done}
                    className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors enabled:hover:border-primary disabled:cursor-default disabled:bg-success-soft/50"
                  >
                    <span className={s.done ? 'flex size-6 items-center justify-center rounded-full bg-success text-xs font-bold text-white' : 'flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold text-muted-foreground'}>
                      {s.done ? '✓' : i + 1}
                    </span>
                    <span className={s.done ? 'text-muted-foreground line-through' : 'font-medium'}>{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </BlurFade>
        )}

        <BlurFade delay={0.05} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Analyses" icon={TargetIcon} hint={analyses.length ? `Score moyen ${avg}/100` : 'Aucune pour le moment'}>
            <div className="mt-2 text-2xl font-bold"><NumberTicker value={analyses.length} /></div>
          </StatCard>
          <StatCard label="Candidatures en cours" icon={KanbanSquareIcon} hint={`${applications.length} au total`}>
            <div className="mt-2 text-2xl font-bold"><NumberTicker value={active.length} /></div>
          </StatCard>
          <StatCard label="Entretiens" icon={TrophyIcon} hint="Candidatures au stade entretien">
            <div className="mt-2 text-2xl font-bold"><NumberTicker value={interviews} /></div>
          </StatCard>
          <StatCard label="Crédits IA du jour" icon={SparklesIcon} value={usage ? `${usage.limit - usage.used}` : '—'} hint={usage ? `restants sur ${usage.limit}` : undefined} />
        </BlurFade>

        <BlurFade delay={0.1} className="grid gap-5 lg:grid-cols-2">
          <Panel
            icon={BellRingIcon}
            title="À relancer"
            subtitle="Candidatures sans réponse depuis la date prévue"
            badge={due.length ? <Badge tone="warning">{due.length}</Badge> : undefined}
            actions={<Button variant="ghost" size="sm" onClick={() => navigate('candidatures')}>Tout voir</Button>}
          >
            {due.length ? (
              <ul className="-my-1 divide-y">
                {due.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <CompanyAvatar name={a.company || a.title} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.company} · {STATUS_LABEL[a.status]} le {a.appliedAt && new Date(a.appliedAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    {a.contact && <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">{a.contact}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-sm text-muted-foreground">Rien à relancer aujourd'hui.</p>}
          </Panel>

          <Panel
            icon={SearchIcon}
            title="Nouvelles offres pour vous"
            subtitle={suggestions ? `Dernière recherche le ${new Date(suggestions.at).toLocaleDateString('fr-FR')}` : 'Aucune recherche pour le moment'}
            badge={newOffers.length ? <Badge tone="primary">{newOffers.length}</Badge> : undefined}
            actions={<Button variant="ghost" size="sm" onClick={() => navigate('offres')}>Tout voir</Button>}
          >
            {suggestions?.offers.length ? (
              <ul className="-my-1 divide-y">
                {(newOffers.length ? newOffers : suggestions.offers).slice(0, 4).map((o) => (
                  <li key={o.url} className="flex items-center gap-3 py-2.5">
                    <CompanyAvatar name={o.company} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{o.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{o.company}{o.location && ` · ${o.location}`}</p>
                    </div>
                    <Badge tone={toneBadge(o.match_score)}>{o.match_score}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4">
                <p className="text-sm text-muted-foreground">Laissez Claude trouver des offres adaptées à votre CV.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('offres')}>Rechercher <ArrowRightIcon aria-hidden="true" /></Button>
              </div>
            )}
          </Panel>
        </BlurFade>

        <BlurFade delay={0.15}>
          <Panel icon={FileTextIcon} title="Dernières analyses" actions={<Button variant="ghost" size="sm" onClick={() => navigate('historique')}>Historique</Button>} bodyClassName="p-0">
            {analyses.length ? (
              <ul className="divide-y">
                {analyses.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => navigate(`analyse/${a.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                      <Badge tone={toneBadge(a.result.score)} className="w-10 justify-center py-1 text-sm">{a.result.score}</Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{a.offerTitle}</span>
                        <span className="block text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}{a.cvName && ` · ${a.cvName}`}</span>
                      </span>
                      <ArrowRightIcon className="size-4 text-subtle-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5">
                <p className="text-sm text-muted-foreground">Votre première analyse apparaîtra ici.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('comparer')}><ScaleIcon aria-hidden="true" /> Comparer</Button>
                  <Button size="sm" onClick={() => navigate('analyser')}>Analyser</Button>
                </div>
              </div>
            )}
          </Panel>
        </BlurFade>
      </div>
    </div>
  )
}

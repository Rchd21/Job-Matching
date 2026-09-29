import * as React from 'react'
import {
  BellIcon, BellRingIcon, BriefcaseIcon, CheckIcon, ExternalLinkIcon, KanbanSquareIcon, LoaderCircleIcon, MapPinIcon, PlusIcon, RefreshCwIcon, SearchIcon, SparklesIcon, WifiIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CvSummary } from '@/components/cv-card'
import { Badge, CompanyAvatar, Notice, PageHeader, fieldClass } from '@/components/common'
import { toneBadge } from '@/components/results-view'
import { useToast } from '@/components/toast'
import { BlurFade } from '@/components/magicui/blur-fade'
import { BorderBeam } from '@/components/magicui/border-beam'
import { DotPattern } from '@/components/magicui/dot-pattern'
import { api, newId, type SuggestedOffer } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { MIN_WORDS, hostOf, words } from '@/lib/text'
import { cn } from '@/lib/utils'

export const CONTRACTS = ['', 'CDI', 'CDD', 'Alternance', 'Stage', 'Freelance']
const STEPS = ["Lecture de votre profil", "Recherche sur les sites d'emploi", 'Vérification des annonces', 'Classement par pertinence']

function SearchingState() {
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 20000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs" role="status" aria-live="polite">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">{STEPS[step]}…</p>
        <span className="ml-auto text-xs text-muted-foreground">1 à 2 minutes</span>
      </div>
      <ul className="divide-y" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="skeleton size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-2/5 rounded" />
              <div className="skeleton h-3 w-1/4 rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
            <div className="skeleton h-7 w-12 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SuggestPage({ onAnalyze, onCompare, compareUrls, compareFull }: {
  onAnalyze: (offer: SuggestedOffer) => Promise<void>
  onCompare: (offer: SuggestedOffer) => Promise<void>
  compareUrls: Set<string>
  compareFull: boolean
}) {
  const { defaultCv, suggestions, setSuggestions, alerts, applications, saveApplication } = useData()
  const toast = useToast()
  const [location, setLocation] = React.useState(suggestions?.criteria?.location || alerts?.location || '')
  const [contract, setContract] = React.useState(suggestions?.criteria?.contract || alerts?.contract || '')
  const [remote, setRemote] = React.useState(!!(suggestions?.criteria?.remote ?? alerts?.remote))
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState<Record<string, 'analyze' | 'compare' | undefined>>({})
  const [cardError, setCardError] = React.useState<Record<string, string>>({})

  const cvOk = !!defaultCv && words(defaultCv.text) >= MIN_WORDS
  const trackedUrls = new Set(applications.map((a) => a.url).filter(Boolean))
  const newCount = suggestions?.offers.filter((o) => o.isNew).length || 0

  // Les nouvelles offres des alertes sont marquées « vues » en quittant la page.
  React.useEffect(() => () => { if (newCount) api.alertsSeen().catch(() => {}) }, [newCount])

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!cvOk) return
    setError('')
    setLoading(true)
    try {
      setSuggestions(await api.suggest({ location: location.trim(), contract, remote }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const act = async (o: SuggestedOffer, kind: 'analyze' | 'compare') => {
    setBusy((b) => ({ ...b, [o.url]: kind }))
    setCardError((c) => ({ ...c, [o.url]: '' }))
    try {
      await (kind === 'analyze' ? onAnalyze(o) : onCompare(o))
      if (kind === 'compare') toast('Offre ajoutée au comparatif.')
    } catch (err) {
      setCardError((c) => ({ ...c, [o.url]: (err as Error).message }))
    } finally {
      setBusy((b) => ({ ...b, [o.url]: undefined }))
    }
  }

  const track = async (o: SuggestedOffer) => {
    await saveApplication({ id: newId(), title: o.title, company: o.company, url: o.url, status: 'a-postuler', createdAt: new Date().toISOString(), score: o.match_score })
    toast('Offre ajoutée à vos candidatures.')
  }

  return (
    <div>
      <PageHeader
        title="Offres pour moi"
        description="Claude lit votre CV, recherche des offres ouvertes sur les sites d'emploi et les classe par pertinence."
        actions={
          <Button variant="outline" onClick={() => navigate('parametres')}>
            {alerts?.enabled ? <BellRingIcon className="text-primary" aria-hidden="true" /> : <BellIcon aria-hidden="true" />}
            {alerts?.enabled ? `Alerte ${alerts.frequency === 'daily' ? 'quotidienne' : 'hebdomadaire'}` : 'Créer une alerte'}
          </Button>
        }
      />

      <div className="space-y-5">
        <CvSummary />

        <form onSubmit={search} className="rounded-xl border bg-card p-4 shadow-xs" aria-label="Critères de recherche">
          <div className="grid gap-3 md:grid-cols-[1fr_11rem_auto_auto] md:items-end">
            <div>
              <label htmlFor="loc" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ville ou région</label>
              <div className="relative">
                <MapPinIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
                <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Toute la France" autoComplete="address-level2" className={cn(fieldClass, 'h-10 pr-3 pl-9')} />
              </div>
            </div>
            <div>
              <label htmlFor="contract" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contrat</label>
              <select id="contract" value={contract} onChange={(e) => setContract(e.target.value)} className={cn(fieldClass, 'h-10 px-3')}>
                {CONTRACTS.map((c) => <option key={c} value={c}>{c || 'Tous'}</option>)}
              </select>
            </div>
            <label className="flex h-10 items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs">
              <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Télétravail
            </label>
            <Button type="submit" disabled={!cvOk || loading}>
              {loading ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : suggestions ? <RefreshCwIcon aria-hidden="true" /> : <SearchIcon aria-hidden="true" />}
              {loading ? 'Recherche…' : suggestions ? 'Relancer' : 'Rechercher'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-subtle-foreground">Recherche web par IA · 1 à 2 minutes · 3 crédits. Les annonces expirées sont écartées.</p>
        </form>

        {error && <Notice error={error} />}
        {alerts?.lastError && alerts.enabled && <Notice error={`Dernière alerte en échec : ${alerts.lastError}`} />}

        {loading ? (
          <SearchingState />
        ) : suggestions ? (
          <section aria-labelledby="sugg-title" className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
              <h2 id="sugg-title" className="flex items-center gap-2 text-sm font-semibold">
                {suggestions.offers.length} offres correspondantes
                {newCount > 0 && <Badge tone="primary">{newCount} nouvelle{newCount > 1 ? 's' : ''}</Badge>}
              </h2>
              <p className="text-xs text-muted-foreground">Mise à jour le {new Date(suggestions.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · score estimé</p>
            </header>
            <ul className="divide-y">
              {suggestions.offers.map((o, index) => {
                const inCompare = compareUrls.has(o.url)
                const tracked = trackedUrls.has(o.url)
                return (
                  <li key={o.url}>
                    <BlurFade delay={0.05 * index} className="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start">
                      {index === 0 && <BorderBeam size={80} duration={8} borderWidth={1.5} colorFrom="#22c55e" colorTo="#2563eb" />}
                      <CompanyAvatar name={o.company} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{o.title}</h3>
                          {o.isNew && <Badge tone="primary">Nouveau</Badge>}
                          {index === 0 && <Badge tone="success"><SparklesIcon className="size-3" aria-hidden="true" />Meilleure piste</Badge>}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{o.company}</span>
                          {o.location && <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3" aria-hidden="true" />{o.location}</span>}
                          {o.contract && <span className="inline-flex items-center gap-1"><BriefcaseIcon className="size-3" aria-hidden="true" />{o.contract}</span>}
                          {/t[ée]l[ée]travail|remote|hybride/i.test(`${o.location} ${o.why}`) && <span className="inline-flex items-center gap-1"><WifiIcon className="size-3" aria-hidden="true" />Télétravail</span>}
                          <a href={o.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                            {hostOf(o.url)} <ExternalLinkIcon className="size-3" aria-hidden="true" />
                          </a>
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.why}</p>
                        {cardError[o.url] && <p className="mt-2 text-xs font-medium text-destructive" role="alert">{cardError[o.url]}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <div className="text-right">
                          <Badge tone={toneBadge(o.match_score)} className="px-2 py-1 text-sm">{o.match_score}</Badge>
                          <p className="mt-0.5 hidden text-[11px] text-subtle-foreground sm:block">score estimé</p>
                        </div>
                        <div className="ml-auto flex flex-wrap gap-1.5 sm:ml-0 sm:mt-2 sm:justify-end">
                          <Button size="sm" variant="ghost" onClick={() => track(o)} disabled={tracked} aria-label={tracked ? 'Déjà suivie' : `Suivre ${o.title}`}>
                            {tracked ? <CheckIcon aria-hidden="true" /> : <KanbanSquareIcon aria-hidden="true" />}{tracked ? 'Suivie' : 'Suivre'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => act(o, 'compare')} disabled={!!busy[o.url] || inCompare || compareFull}>
                            {busy[o.url] === 'compare' ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : inCompare ? <CheckIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
                            {inCompare ? 'Comparée' : 'Comparer'}
                          </Button>
                          <Button size="sm" onClick={() => act(o, 'analyze')} disabled={!!busy[o.url]}>
                            {busy[o.url] === 'analyze' && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
                            Analyser
                          </Button>
                        </div>
                      </div>
                    </BlurFade>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <DotPattern width={18} height={18} cr={1} className="text-border-strong [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
            <div className="relative">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
                <SearchIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold">Lancez votre première recherche</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Précisez éventuellement une ville et un type de contrat, puis cliquez sur « Rechercher ».</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

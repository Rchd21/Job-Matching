import * as React from 'react'
import { ArrowRightIcon, BookmarkPlusIcon, BriefcaseIcon, CheckCircle2Icon, CircleIcon, LinkIcon, LoaderCircleIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CvCard, useCvDraft } from '@/components/cv-card'
import { Badge, Notice, PageHeader, Panel, ProgressSteps, fieldClass } from '@/components/common'
import { useToast } from '@/components/toast'
import { WordRotate } from '@/components/magicui/word-rotate'
import { api } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { MIN_WORDS, isLinkedIn, offerTitle, words } from '@/lib/text'
import { cn } from '@/lib/utils'

export interface IncomingOffer {
  text: string
  autorun: boolean
  url?: string
  notice?: string
}

const STEPS = ['Lecture de votre CV', "Analyse des exigences de l'offre", 'Comparaison des compétences', 'Rédaction des recommandations']

function ReadyItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', ok ? 'text-foreground' : 'text-muted-foreground')}>
      {ok ? <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" /> : <CircleIcon className="size-4" aria-hidden="true" />}
      {label}
    </span>
  )
}

export function SinglePage({ incoming, onIncomingHandled, openBookmarklet }: {
  incoming: IncomingOffer | null
  onIncomingHandled: () => void
  openBookmarklet: () => void
}) {
  const { addAnalysis, loading } = useData()
  const toast = useToast()
  const draft = useCvDraft()
  const [analyzing, setAnalyzing] = React.useState(false)
  const [offer, setOffer] = React.useState('')
  const [offerUrl, setOfferUrl] = React.useState<string | undefined>()
  const [url, setUrl] = React.useState('')
  const [importing, setImporting] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [error, setError] = React.useState('')
  const [ranking, setRanking] = React.useState<{ cv_id: string; score: number; reason: string }[] | null>(null)
  const [ranking_busy, setRankingBusy] = React.useState(false)

  const cvOk = words(draft.text) >= MIN_WORDS
  const offerOk = words(offer) >= MIN_WORDS
  const ready = cvOk && offerOk

  const run = React.useCallback(async (cvText: string, offerText: string, srcUrl?: string) => {
    setError('')
    setNotice('')
    setAnalyzing(true)
    window.scrollTo({ top: 0 })
    try {
      const doc = await api.analyze({ cv: cvText, offer: offerText, offerUrl: srcUrl, cvId: draft.selected?.id, cvName: draft.selected?.name })
      addAnalysis(doc)
      navigate(`analyse/${doc.id}`)
    } catch (e) {
      setError((e as Error).message)
      setAnalyzing(false)
    }
  }, [addAnalysis, draft.selected])

  // Offre transmise par le favori LinkedIn ou par la page « Offres pour moi ».
  React.useEffect(() => {
    if (!incoming || loading) return
    onIncomingHandled()
    setOffer(incoming.text)
    setOfferUrl(incoming.url)
    setUrl('')
    if (incoming.autorun && words(draft.text) >= MIN_WORDS) run(draft.text, incoming.text, incoming.url)
    else setNotice(incoming.notice || "Offre importée. Vérifiez le texte puis lancez l'analyse.")
  }, [incoming, loading, onIncomingHandled, draft.text, run])

  const onImport = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    if (!u) return
    setError('')
    setNotice('')
    if (isLinkedIn(u)) { openBookmarklet(); return }
    setImporting(true)
    try {
      const data = await api.fetchOffer(u)
      setOffer(data.text)
      setOfferUrl(data.url)
      setNotice(`Offre importée depuis ${data.host.replace(/^www\./, '')}. Vérifiez le texte puis lancez l'analyse.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const pickBestCv = async () => {
    setRankingBusy(true)
    try {
      const { ranking } = await api.bestCv(offer)
      setRanking(ranking)
      if (ranking[0]) draft.select(ranking[0].cv_id)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setRankingBusy(false)
    }
  }

  if (analyzing) {
    return (
      <>
        <PageHeader title="Analyse en cours" description={offerTitle(offer)} />
        <ProgressSteps steps={STEPS} interval={7000} title="Claude compare votre CV à l'offre" subtitle="Environ 30 secondes, ne fermez pas la page." />
      </>
    )
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Analyser une offre"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-1">
            Mesurez si votre CV est prêt pour
            <WordRotate words={['ce poste.', 'ce recruteur.', 'les logiciels ATS.']} duration={2800} className="font-semibold text-foreground" />
          </span>
        }
        actions={draft.cvs.length > 1 && offerOk && (
          <Button variant="outline" onClick={pickBestCv} disabled={ranking_busy}>
            {ranking_busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <WandSparklesIcon aria-hidden="true" />}
            Quel CV envoyer ?
          </Button>
        )}
      />

      {(error || notice) && <div className="mb-5"><Notice error={error} notice={notice} /></div>}

      {ranking && (
        <div className="mb-5 rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-sm font-semibold">CV recommandé pour cette offre</p>
          <ol className="mt-3 space-y-2">
            {ranking.map((r, i) => {
              const cv = draft.cvs.find((c) => c.id === r.cv_id)
              return (
                <li key={r.cv_id} className="flex items-start gap-3 text-sm">
                  <Badge tone={i === 0 ? 'success' : 'neutral'}>{r.score}</Badge>
                  <span className="min-w-0 flex-1"><span className="font-semibold">{cv?.name || 'CV'}</span> <span className="text-muted-foreground">— {r.reason}</span></span>
                  {draft.selectedId !== r.cv_id && <Button size="sm" variant="ghost" onClick={() => draft.select(r.cv_id)}>Utiliser</Button>}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <CvCard draft={draft} />

        <Panel
          icon={BriefcaseIcon}
          title="Offre d'emploi"
          subtitle="Lien d'un site d'emploi ou texte de l'annonce"
          badge={offerOk ? <Badge tone="success">{words(offer)} mots</Badge> : <Badge>{words(offer) ? `${words(offer)} mots` : 'Vide'}</Badge>}
          actions={offer && (
            <Button variant="ghost" size="icon-sm" aria-label="Effacer l'offre" onClick={() => { setOffer(''); setOfferUrl(undefined); setRanking(null) }}>
              <Trash2Icon aria-hidden="true" />
            </Button>
          )}
        >
          <form onSubmit={onImport} className="flex gap-2">
            <label htmlFor="url" className="sr-only">Lien de l'offre</label>
            <div className="relative min-w-0 flex-1">
              <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
              <input id="url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (Indeed, Welcome to the Jungle, France Travail…)" className={cn(fieldClass, 'h-10 pr-3 pl-9')} />
            </div>
            <Button type="submit" variant="outline" disabled={importing || !url.trim()}>
              {importing && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
              {importing ? 'Import…' : 'Importer'}
            </Button>
          </form>
          <button type="button" onClick={openBookmarklet} className="mt-2 inline-flex items-center gap-1.5 self-start rounded text-xs font-semibold text-primary hover:underline">
            <BookmarkPlusIcon className="size-3.5" aria-hidden="true" /> Offre LinkedIn ? Installer le bouton « Envoyer à CV Matcher »
          </button>
          <label htmlFor="offer" className="mt-4 mb-1.5 text-xs font-semibold text-muted-foreground">Texte de l'offre</label>
          <textarea
            id="offer"
            value={offer}
            onChange={(e) => { setOffer(e.target.value); if (!e.target.value) setOfferUrl(undefined) }}
            placeholder="Intitulé du poste, missions, profil recherché, compétences requises…"
            className={cn(fieldClass, 'min-h-72 flex-1 resize-y p-3 leading-relaxed')}
          />
          <p className="mt-2 text-xs text-subtle-foreground">Si un site bloque l'import, copiez-collez simplement l'annonce.</p>
        </Panel>
      </div>

      <div className="no-print fixed inset-x-0 bottom-16 z-30 border-t bg-card/90 backdrop-blur-md lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="hidden items-center gap-5 sm:flex" aria-label="Prérequis">
            <ReadyItem ok={cvOk} label="CV prêt" />
            <ReadyItem ok={offerOk} label="Offre prête" />
            <span className="text-xs text-subtle-foreground">Minimum {MIN_WORDS} mots chacun · 1 crédit · ~30 s</span>
          </div>
          <Button size="lg" disabled={!ready} onClick={() => run(draft.text, offer, offerUrl)} className="w-full sm:w-auto">
            Lancer l'analyse <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

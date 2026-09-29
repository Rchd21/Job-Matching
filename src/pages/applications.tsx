import * as React from 'react'
import { BellRingIcon, CalendarIcon, ExternalLinkIcon, FileBarChartIcon, KanbanSquareIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, CompanyAvatar, PageHeader, fieldClass } from '@/components/common'
import { toneBadge } from '@/components/results-view'
import { useToast } from '@/components/toast'
import { APP_STATUSES, newId, type AppStatus, type ApplicationDoc } from '@/lib/api'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { hostOf } from '@/lib/text'
import { cn } from '@/lib/utils'

export const STATUS_LABEL: Record<AppStatus, string> = {
  'a-postuler': 'À postuler',
  postule: 'Postulé',
  entretien: 'Entretien',
  offre: 'Offre reçue',
  refuse: 'Refusé',
}
const STATUS_DOT: Record<AppStatus, string> = {
  'a-postuler': 'bg-subtle-foreground',
  postule: 'bg-primary',
  entretien: 'bg-warning',
  offre: 'bg-success',
  refuse: 'bg-destructive',
}

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')

export const needsFollowUp = (a: ApplicationDoc) => (a.status === 'postule' || a.status === 'entretien') && !!a.followUpAt && a.followUpAt <= today()

/** Met à jour le statut en renseignant les dates utiles (candidature, relance à J+7). */
export function withStatus(app: ApplicationDoc, status: AppStatus): ApplicationDoc {
  const next = { ...app, status }
  if (status === 'postule' && !app.appliedAt) {
    next.appliedAt = today()
    next.followUpAt = app.followUpAt || addDays(today(), 7)
  }
  if (status === 'offre' || status === 'refuse') next.followUpAt = undefined
  return next
}

function ApplicationDialog({ app, onClose }: { app: ApplicationDoc | null; onClose: () => void }) {
  const { saveApplication, removeApplication, applications } = useData()
  const ref = React.useRef<HTMLDialogElement>(null)
  const [form, setForm] = React.useState<ApplicationDoc | null>(app)

  React.useEffect(() => {
    setForm(app)
    const d = ref.current
    if (!d) return
    if (app && !d.open) d.showModal()
    if (!app && d.open) d.close()
  }, [app])

  const set = <K extends keyof ApplicationDoc>(k: K, v: ApplicationDoc[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !form.title.trim()) return
    await saveApplication(form)
    onClose()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      aria-labelledby="app-dialog-title"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-slate-950/40"
    >
      {form && (
        <form onSubmit={save}>
          <header className="flex items-center gap-3 border-b px-5 py-4">
            <h2 id="app-dialog-title" className="flex-1 font-semibold">{app?.title ? 'Candidature' : 'Nouvelle candidature'}</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer"><XIcon aria-hidden="true" /></Button>
          </header>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="app-title" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Poste</label>
              <input id="app-title" required value={form.title} onChange={(e) => set('title', e.target.value)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div>
              <label htmlFor="app-company" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Entreprise</label>
              <input id="app-company" value={form.company} onChange={(e) => set('company', e.target.value)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div>
              <label htmlFor="app-status" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Statut</label>
              <select id="app-status" value={form.status} onChange={(e) => setForm(withStatus(form, e.target.value as AppStatus))} className={cn(fieldClass, 'h-10 px-3')}>
                {APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="app-url" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Lien de l'offre</label>
              <input id="app-url" type="url" value={form.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div>
              <label htmlFor="app-applied" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Date de candidature</label>
              <input id="app-applied" type="date" value={form.appliedAt || ''} onChange={(e) => set('appliedAt', e.target.value || undefined)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div>
              <label htmlFor="app-follow" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Relancer le</label>
              <input id="app-follow" type="date" value={form.followUpAt || ''} onChange={(e) => set('followUpAt', e.target.value || undefined)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="app-contact" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contact (recruteur, e-mail…)</label>
              <input id="app-contact" value={form.contact || ''} onChange={(e) => set('contact', e.target.value)} className={cn(fieldClass, 'h-10 px-3')} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="app-notes" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Notes</label>
              <textarea id="app-notes" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className={cn(fieldClass, 'min-h-24 resize-y p-3')} />
            </div>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t px-5 py-3">
            {app && applications.some((a) => a.id === app.id) ? (
              <Button variant="destructive" size="sm" onClick={async () => { await removeApplication(form.id); onClose() }}>
                <Trash2Icon aria-hidden="true" /> Supprimer
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
  )
}

function AppCard({ app, onOpen, onMove, dragging, setDragging }: {
  app: ApplicationDoc
  onOpen: () => void
  onMove: (s: AppStatus) => void
  dragging: boolean
  setDragging: (id: string | null) => void
}) {
  const due = needsFollowUp(app)
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', app.id); e.dataTransfer.effectAllowed = 'move'; setDragging(app.id) }}
      onDragEnd={() => setDragging(null)}
      className={cn('group rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md', dragging && 'opacity-50', due && 'border-warning/50')}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2.5 text-left">
        <CompanyAvatar name={app.company || app.title} className="size-8 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{app.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{app.company || (app.url ? hostOf(app.url) : '—')}</span>
        </span>
        {app.score !== undefined && <Badge tone={toneBadge(app.score)}>{app.score}</Badge>}
      </button>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {app.appliedAt && <span className="inline-flex items-center gap-1"><CalendarIcon className="size-3" aria-hidden="true" />{fmt(app.appliedAt)}</span>}
        {due && <Badge tone="warning"><BellRingIcon className="size-3" aria-hidden="true" />À relancer</Badge>}
        {!due && app.followUpAt && (app.status === 'postule' || app.status === 'entretien') && <span>Relance {fmt(app.followUpAt)}</span>}
        <label className="sr-only" htmlFor={`move-${app.id}`}>Changer le statut de {app.title}</label>
        <select
          id={`move-${app.id}`}
          value={app.status}
          onChange={(e) => onMove(e.target.value as AppStatus)}
          className="ml-auto h-7 rounded-md border border-transparent bg-transparent px-1 text-[11px] font-semibold text-muted-foreground hover:border-border focus:border-ring"
        >
          {APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {(app.analysisId || app.url) && (
        <div className="mt-2 flex gap-3 border-t pt-2 text-[11px] font-semibold">
          {app.analysisId && <button type="button" onClick={() => navigate(`analyse/${app.analysisId}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><FileBarChartIcon className="size-3" aria-hidden="true" />Rapport</button>}
          {app.url && <a href={app.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLinkIcon className="size-3" aria-hidden="true" />Offre</a>}
        </div>
      )}
    </li>
  )
}

export function ApplicationsPage() {
  const { applications, saveApplication } = useData()
  const toast = useToast()
  const [editing, setEditing] = React.useState<ApplicationDoc | null>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<AppStatus | null>(null)

  const move = (app: ApplicationDoc, status: AppStatus) => {
    if (app.status === status) return
    const next = withStatus(app, status)
    saveApplication(next)
    if (status === 'postule' && next.followUpAt) toast(`Relance programmée le ${fmt(next.followUpAt)}.`)
  }

  const dueCount = applications.filter(needsFollowUp).length
  const active = applications.filter((a) => a.status !== 'refuse' && a.status !== 'offre').length
  const sorted = (s: AppStatus) => applications.filter((a) => a.status === s).sort((a, b) => Number(needsFollowUp(b)) - Number(needsFollowUp(a)) || (b.updatedAt || '').localeCompare(a.updatedAt || ''))

  return (
    <div>
      <PageHeader
        title="Candidatures"
        description={applications.length ? `${active} en cours${dueCount ? ` · ${dueCount} à relancer` : ''}. Glissez les cartes d'une colonne à l'autre.` : 'Suivez chaque candidature, de la découverte de l\'offre à la réponse.'}
        actions={
          <Button onClick={() => setEditing({ id: newId(), title: '', company: '', status: 'a-postuler', createdAt: new Date().toISOString() })}>
            <PlusIcon aria-hidden="true" /> Ajouter
          </Button>
        }
      />

      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
            <KanbanSquareIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Aucune candidature suivie</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Depuis un rapport ou une offre suggérée, cliquez sur « Suivre », ou ajoutez une candidature à la main.</p>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[60rem] grid-cols-5 gap-3">
            {APP_STATUSES.map((s) => {
              const list = sorted(s)
              return (
                <section
                  key={s}
                  aria-labelledby={`col-${s}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(s) }}
                  onDragLeave={() => setOver((o) => (o === s ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault()
                    setOver(null)
                    const app = applications.find((a) => a.id === e.dataTransfer.getData('text/plain'))
                    if (app) move(app, s)
                  }}
                  className={cn('flex min-h-64 flex-col rounded-xl border bg-muted/40 p-2 transition-colors', over === s && 'border-primary bg-primary-soft')}
                >
                  <h2 id={`col-${s}`} className="flex items-center gap-2 px-1.5 py-1.5 text-xs font-semibold">
                    <span className={cn('size-2 rounded-full', STATUS_DOT[s])} aria-hidden="true" />
                    {STATUS_LABEL[s]}
                    <span className="ml-auto text-muted-foreground tabular-nums">{list.length}</span>
                  </h2>
                  <ul className="mt-1 flex flex-1 flex-col gap-2">
                    {list.map((a) => (
                      <AppCard key={a.id} app={a} onOpen={() => setEditing(a)} onMove={(st) => move(a, st)} dragging={dragging === a.id} setDragging={setDragging} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      )}

      <ApplicationDialog app={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

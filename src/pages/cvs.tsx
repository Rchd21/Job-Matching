import * as React from 'react'
import { CopyPlusIcon, FileTextIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CvEditor, CvStatusBadge, SaveState } from '@/components/cv-card'
import { Badge, PageHeader, Panel, fieldClass } from '@/components/common'
import { useToast } from '@/components/toast'
import { newId, type CvDoc } from '@/lib/api'
import { useData } from '@/lib/store'
import { words } from '@/lib/text'
import { cn } from '@/lib/utils'

export function CvsPage() {
  const { cvs, saveCv, removeCv, analyses, loading } = useData()
  const toast = useToast()
  const [selectedId, setSelectedId] = React.useState<string | undefined>(cvs.find((c) => c.isDefault)?.id || cvs[0]?.id)
  const selected = cvs.find((c) => c.id === selectedId) || null
  const [draft, setDraft] = React.useState<CvDoc | null>(selected)
  const [saving, setSaving] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
    if (!selectedId && cvs[0]) setSelectedId(cvs[0].id)
  }, [cvs, selectedId])
  React.useEffect(() => { setDraft(cvs.find((c) => c.id === selectedId) || null) }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<CvDoc>) => {
    if (!draft) return
    const next = { ...draft, ...patch }
    setDraft(next)
    setSaving('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try { await saveCv(next); setSaving('saved') } catch (e) { toast((e as Error).message, 'error'); setSaving('idle') }
    }, 700)
  }

  const create = async (from?: CvDoc) => {
    const doc = await saveCv({
      id: newId(),
      name: from ? `${from.name} (copie)` : `CV ${cvs.length + 1}`,
      text: from?.text || '',
      isDefault: !cvs.length,
      createdAt: new Date().toISOString(),
    })
    setSelectedId(doc.id)
    setDraft(doc)
  }

  const remove = async (cv: CvDoc) => {
    if (!confirm(`Supprimer le CV « ${cv.name} » ? Les analyses déjà faites sont conservées.`)) return
    await removeCv(cv.id)
    const rest = cvs.filter((c) => c.id !== cv.id)
    if (cv.isDefault && rest[0]) await saveCv({ ...rest[0], isDefault: true })
    setSelectedId(rest[0]?.id)
  }

  const usage = (id: string) => analyses.filter((a) => a.cvId === id)
  const avgScore = (id: string) => {
    const list = usage(id)
    return list.length ? Math.round(list.reduce((s, a) => s + a.result.score, 0) / list.length) : null
  }

  return (
    <div>
      <PageHeader
        title="Mes CV"
        description="Gardez plusieurs versions de votre CV (par exemple « Front-end » et « Full stack ») ; le site vous dira laquelle envoyer."
        actions={<Button onClick={() => create()}><PlusIcon aria-hidden="true" /> Nouveau CV</Button>}
      />

      {!loading && cvs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs">
            <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Ajoutez votre premier CV</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Importez un PDF ou collez le texte : il servira à toutes vos analyses.</p>
          <Button className="mt-5" onClick={() => create()}><PlusIcon aria-hidden="true" /> Créer mon CV</Button>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] [&>*]:min-w-0">
          <nav aria-label="Vos CV" className="space-y-2">
            {cvs.map((c) => {
              const avg = avgScore(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  aria-current={c.id === selectedId ? 'true' : undefined}
                  className={cn('flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-border-strong', c.id === selectedId && 'border-primary ring-1 ring-primary')}
                >
                  <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                      {c.isDefault && <StarIcon className="size-3.5 shrink-0 fill-warning text-warning" aria-label="CV par défaut" />}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {words(c.text)} mots · {usage(c.id).length} analyse{usage(c.id).length > 1 ? 's' : ''}{avg !== null && ` · moy. ${avg}`}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          {draft && (
            <Panel
              icon={FileTextIcon}
              title={draft.name || 'Sans nom'}
              subtitle={<SaveState state={saving} />}
              badge={<CvStatusBadge text={draft.text} />}
              actions={
                <>
                  {!draft.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => update({ isDefault: true })}><StarIcon aria-hidden="true" /> Par défaut</Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => create(draft)} aria-label="Dupliquer ce CV"><CopyPlusIcon aria-hidden="true" /></Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => remove(draft)} aria-label="Supprimer ce CV"><Trash2Icon aria-hidden="true" /></Button>
                </>
              }
            >
              <label htmlFor="cv-name" className="mb-1.5 text-xs font-semibold text-muted-foreground">Nom de cette version</label>
              <input id="cv-name" value={draft.name} onChange={(e) => update({ name: e.target.value.slice(0, 60) })} className={cn(fieldClass, 'mb-4 h-10 px-3')} />
              <CvEditor value={draft.text} onChange={(text) => update({ text })} minHeight="min-h-96" />
              {draft.isDefault && <p className="mt-3"><Badge tone="warning"><StarIcon className="size-3" aria-hidden="true" />CV par défaut</Badge> <span className="text-xs text-muted-foreground">Utilisé pour le comparatif, les offres suggérées et les alertes.</span></p>}
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

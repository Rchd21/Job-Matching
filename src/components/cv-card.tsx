import * as React from 'react'
import { CheckIcon, FileTextIcon, LoaderCircleIcon, StarIcon } from 'lucide-react'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { Button } from '@/components/ui/button'
import { Badge, Panel, fieldClass } from '@/components/common'
import { newId, type CvDoc } from '@/lib/api'
import { readCvFile } from '@/lib/pdf'
import { useData } from '@/lib/store'
import { navigate } from '@/lib/router'
import { MIN_WORDS, words } from '@/lib/text'
import { cn } from '@/lib/utils'

/** Zone d'import (PDF / TXT) + texte du CV. */
export function CvEditor({ value, onChange, autoFocus, minHeight = 'min-h-72' }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; minHeight?: string }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const id = React.useId()

  const onFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      onChange(await readCvFile(file))
    } catch (e) {
      setError('Impossible de lire le fichier : ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FileDropzone accept=".pdf,.txt,.md,application/pdf,text/plain" maxSizeMB={10} onUpload={onFile} onRemove={() => setError('')} busy={busy} error={error} />
      <label htmlFor={id} className="mt-4 mb-1.5 text-xs font-semibold text-muted-foreground">Contenu du CV</label>
      <textarea
        id={id}
        data-field="cv"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Collez ici votre CV : expériences, compétences, formation, langues…"
        className={cn(fieldClass, minHeight, 'flex-1 resize-y p-3 leading-relaxed')}
      />
    </>
  )
}

export function CvStatusBadge({ text }: { text: string }) {
  const n = words(text)
  return n >= MIN_WORDS ? <Badge tone="success">{n} mots</Badge> : <Badge tone="neutral">{n ? `${n} mots` : 'Vide'}</Badge>
}

/**
 * Brouillon d'un CV enregistré automatiquement (création du premier CV si besoin).
 * Renvoie le texte courant, le CV sélectionné et les fonctions pour les modifier.
 */
export function useCvDraft(initialId?: string) {
  const { cvs, defaultCv, saveCv } = useData()
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialId || defaultCv?.id)
  const selected = cvs.find((c) => c.id === selectedId) || null
  const [text, setText] = React.useState(selected?.text || '')
  const [saving, setSaving] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  // Sélection par défaut une fois les CV chargés.
  React.useEffect(() => {
    if (!selectedId && defaultCv) { setSelectedId(defaultCv.id); setText(defaultCv.text) }
  }, [defaultCv, selectedId])

  const select = (id: string) => {
    const cv = cvs.find((c) => c.id === id)
    setSelectedId(id)
    setText(cv?.text || '')
  }

  const edit = (value: string) => {
    setText(value)
    clearTimeout(timer.current)
    setSaving('saving')
    timer.current = setTimeout(async () => {
      if (!selected && words(value) < 5) { setSaving('idle'); return }
      const base: CvDoc = selected || { id: newId(), name: 'Mon CV', text: '', isDefault: !cvs.length, createdAt: new Date().toISOString() }
      const saved = await saveCv({ ...base, text: value }).catch(() => null)
      if (saved) { setSelectedId(saved.id); setSaving('saved') } else setSaving('idle')
    }, 800)
  }

  return { cvs, selected, selectedId, text, select, edit, saving }
}

export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return <span>Enregistré automatiquement</span>
  return (
    <span className="inline-flex items-center gap-1" aria-live="polite">
      {state === 'saving' ? <LoaderCircleIcon className="size-3 animate-spin" aria-hidden="true" /> : <CheckIcon className="size-3 text-success" aria-hidden="true" />}
      {state === 'saving' ? 'Enregistrement…' : 'Enregistré'}
    </span>
  )
}

/** Panneau CV de l'espace de travail « Analyser ». */
export function CvCard({ draft }: { draft: ReturnType<typeof useCvDraft> }) {
  const { cvs, selected, selectedId, text, select, edit, saving } = draft
  return (
    <Panel
      icon={FileTextIcon}
      title="Votre CV"
      subtitle={<SaveState state={saving} />}
      badge={<CvStatusBadge text={text} />}
      actions={cvs.length > 1 && (
        <>
          <label htmlFor="cv-select" className="sr-only">CV à utiliser</label>
          <select id="cv-select" value={selectedId} onChange={(e) => select(e.target.value)} className={cn(fieldClass, 'h-8 max-w-40 px-2 text-xs')}>
            {cvs.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' ★' : ''}</option>)}
          </select>
        </>
      )}
    >
      <CvEditor value={text} onChange={edit} />
      <p className="mt-2 text-xs text-subtle-foreground">
        {selected ? <>Modifications enregistrées dans « {selected.name} ». </> : null}
        <button type="button" onClick={() => navigate('cv')} className="font-semibold text-primary hover:underline">Gérer mes CV</button>
      </p>
    </Panel>
  )
}

/** Rappel compact du CV par défaut en haut des pages Comparer / Offres. */
export function CvSummary() {
  const { defaultCv } = useData()
  const ok = !!defaultCv && words(defaultCv.text) >= MIN_WORDS
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs', !ok && 'border-warning/40 bg-warning-soft')}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60">
        {ok ? <StarIcon className="size-4 text-warning" aria-hidden="true" /> : <FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{ok ? `CV utilisé : ${defaultCv!.name}` : 'Aucun CV pour le moment'}</p>
        <p className="truncate text-xs text-muted-foreground">{ok ? `Votre CV par défaut · ${words(defaultCv!.text)} mots` : 'Ajoutez votre CV pour lancer les analyses.'}</p>
      </div>
      <Button variant={ok ? 'outline' : 'default'} size="sm" onClick={() => navigate('cv')}>{ok ? 'Changer' : 'Ajouter mon CV'}</Button>
    </div>
  )
}

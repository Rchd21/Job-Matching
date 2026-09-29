import * as React from 'react'
import { BookmarkPlusIcon, XIcon } from 'lucide-react'
import { bookmarkletHref } from '@/lib/bookmarklet'

export function BookmarkletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const link = React.useRef<HTMLAnchorElement>(null)

  React.useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // React bloque les liens « javascript: » dans href : on le pose directement sur le DOM.
  React.useEffect(() => {
    link.current?.setAttribute('href', bookmarkletHref(location.origin))
  }, [])

  const steps = [
    { title: 'Affichez la barre de favoris', text: 'Appuyez sur Ctrl + Maj + B (Chrome, Edge ou Firefox).' },
    { title: 'Glissez ce bouton dans la barre de favoris', text: null },
    { title: 'Sur LinkedIn, ouvrez une offre et cliquez sur le favori', text: "L'offre s'ouvre ici et l'analyse démarre avec votre CV." },
  ]

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) onClose() }}
      aria-labelledby="bm-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="bm-title" className="text-lg font-bold">Importer des offres LinkedIn</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              LinkedIn bloque la récupération par lien. Ce bouton, installé une seule fois, envoie l'offre affichée vers CV Matcher.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted">
            <XIcon className="size-5" />
          </button>
        </div>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold">{s.title}</p>
                {s.text && <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>}
                {i === 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      ref={link}
                      onClick={(e) => e.preventDefault()}
                      draggable
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-sm"
                    >
                      <BookmarkPlusIcon className="size-4" aria-hidden="true" />
                      Envoyer à CV Matcher
                    </a>
                    <span className="text-xs text-muted-foreground">← maintenez le clic et faites glisser</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Fonctionne aussi sur les autres sites d'emploi. Si le texte est incomplet, sélectionnez la description à la souris avant de cliquer.
          CV Matcher doit être lancé sur votre ordinateur.
        </p>
      </div>
    </dialog>
  )
}

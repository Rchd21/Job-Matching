import * as React from 'react'
import { AlertCircleIcon, CheckCircle2Icon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast { id: number; message: string; tone: 'success' | 'error' }

const ToastContext = React.createContext<(message: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => React.useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
  const show = React.useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-center gap-2 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm shadow-lg',
              t.tone === 'error' && 'border-destructive/30',
            )}
          >
            {t.tone === 'error'
              ? <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              : <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fermer" className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

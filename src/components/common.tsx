import * as React from 'react'
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, LoaderCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BlurFade } from '@/components/magicui/blur-fade'

export const fieldClass =
  'w-full rounded-lg border border-input bg-card text-sm text-foreground shadow-xs placeholder:text-subtle-foreground transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none disabled:opacity-60'

/** En-tête de page d'application : titre, description, actions à droite. */
export function PageHeader({ title, description, actions, eyebrow }: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <BlurFade className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{eyebrow}</div>}
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </BlurFade>
  )
}

/** Panneau avec barre d'en-tête (icône, titre, badge, actions). */
export function Panel({ icon: Icon, title, subtitle, badge, actions, children, className, bodyClassName }: {
  icon?: React.ElementType
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs', className)}>
      <header className="flex min-h-14 items-center gap-3 border-b px-4 py-2.5">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id={id} className="truncate text-sm font-semibold">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cn('flex flex-1 flex-col p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Badge({ tone = 'neutral', children, className }: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary'
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground ring-border',
    success: 'bg-success-soft text-success ring-success/20',
    warning: 'bg-warning-soft text-warning ring-warning/20',
    danger: 'bg-destructive-soft text-destructive ring-destructive/20',
    primary: 'bg-primary-soft text-primary ring-primary/20',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset tabular-nums', tones[tone], className)}>
      {children}
    </span>
  )
}

/** Tuile d'indicateur chiffré. */
export function StatCard({ label, value, hint, icon: Icon, children }: {
  label: string
  value?: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ElementType
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-subtle-foreground" aria-hidden="true" />}
      </div>
      {value !== undefined && <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>}
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Notice({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null
  const Icon = error ? AlertCircleIcon : InfoIcon
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        error ? 'border-destructive/25 bg-destructive-soft text-destructive' : 'border-primary/20 bg-primary-soft text-foreground',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', !error && 'text-primary')} aria-hidden="true" />
      <span>{error || notice}</span>
    </div>
  )
}

/** Onglets soulignés accessibles (flèches gauche/droite). */
export function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix }: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  label: string
  idPrefix: string
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const active = tabs.findIndex((t) => t.value === value)
  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (active + delta + tabs.length) % tabs.length
    onChange(tabs[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t, i) => {
        const selected = t.value === value
        return (
          <button
            key={t.value}
            ref={(el) => { refs.current[i] = el }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150',
              selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-md px-1.5 text-[11px] tabular-nums', selected ? 'bg-primary-soft text-primary' : 'bg-muted')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ProgressSteps({ steps, interval, title, subtitle }: { steps: string[]; interval: number; title: string; subtitle: string }) {
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), interval)
    return () => clearInterval(id)
  }, [steps.length, interval])
  return (
    <div className="animate-fade-up mx-auto w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
          <LoaderCircleIcon className="size-5 animate-spin text-primary" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }} />
      </div>
      <ol className="mt-5 space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-2.5 text-sm', i <= step ? 'text-foreground' : 'text-subtle-foreground')}>
            {i < step ? (
              <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" />
            ) : i === step ? (
              <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <span className="size-4 rounded-full border-2 border-border-strong" aria-hidden="true" />
            )}
            <span className={cn(i === step && 'font-semibold')}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Initiales colorées pour représenter une entreprise sans logo. */
export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/[\s·\-–]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
  const hues = [215, 160, 265, 25, 340, 190, 45]
  const hue = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length]
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold', className)}
      style={{ background: `hsl(${hue} 70% 50% / 0.12)`, color: `hsl(${hue} 60% var(--avatar-l))` }}
    >
      {initials}
    </span>
  )
}

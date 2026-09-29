import { cn } from '@/lib/utils'

/** Logo « Monogramme » : initiales CM en blanc sur bleu, point vert. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8 shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1D4ED8" />
      <path d="M29 22a11 11 0 1 0 0 20" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M33 42V23l7 10 7-10v19" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="15" r="5" fill="#4ADE80" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-bold tracking-tight">CV Matcher <span className="font-semibold text-primary">Pro</span></span>
    </span>
  )
}

import * as React from 'react'
import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressRange,
  CircularProgressTrack,
  CircularProgressValueText,
} from '@/components/ui/circular-progress'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/magicui/number-ticker'

export function scoreTone(score: number) {
  if (score >= 75) return { text: 'text-success', bg: 'bg-success', soft: 'bg-success-soft', label: 'Excellente compatibilité' }
  if (score >= 50) return { text: 'text-warning', bg: 'bg-warning', soft: 'bg-warning-soft', label: 'Compatibilité correcte' }
  return { text: 'text-destructive', bg: 'bg-destructive', soft: 'bg-destructive-soft', label: 'Compatibilité faible' }
}

// L'arc part de 0 puis rejoint le score (transition CSS), pendant que le chiffre défile avec NumberTicker.
function useDeferredScore(target: number) {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setValue(target))
    return () => cancelAnimationFrame(id)
  }, [target])
  return value
}

// Jauge de score : « Circular Progress » (21st.dev) + « Number Ticker » (Magic UI).
export function ScoreGauge({ score, size = 168, compact = false }: { score: number; size?: number; compact?: boolean }) {
  const value = useDeferredScore(score)
  const tone = scoreTone(score)
  return (
    <CircularProgress value={value} size={size} thickness={compact ? 7 : 12} getValueText={(v) => `${v} sur 100`} aria-label="Score de compatibilité">
      <CircularProgressIndicator>
        <CircularProgressTrack className="text-muted" />
        <CircularProgressRange className={cn(tone.text, 'duration-[1200ms] ease-out')} />
      </CircularProgressIndicator>
      <CircularProgressValueText className="flex-col gap-0">
        <NumberTicker value={score} className={cn('font-extrabold tracking-tight', compact ? 'text-2xl' : 'text-5xl')} />
        {!compact && <span className="text-xs font-semibold text-muted-foreground">sur 100</span>}
      </CircularProgressValueText>
    </CircularProgress>
  )
}

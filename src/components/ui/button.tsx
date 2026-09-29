import * as React from 'react'
import { Slot as SlotPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85',
  accent: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/85',
  secondary: 'bg-muted text-foreground hover:bg-border',
  outline: 'border border-border-strong bg-card text-foreground shadow-xs hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  destructive: 'text-destructive hover:bg-destructive-soft',
} as const

const sizes = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
  lg: 'h-11 px-5 text-sm',
  icon: 'size-10',
  'icon-sm': 'size-8',
} as const

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  asChild?: boolean
}

export function Button({ className, variant = 'default', size = 'default', asChild, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

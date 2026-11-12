import type { ReactNode } from 'react'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

const TONES: Record<Tone, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-border text-text',
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
  )
}

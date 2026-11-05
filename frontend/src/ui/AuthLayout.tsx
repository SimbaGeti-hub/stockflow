import type { ReactNode } from 'react'
import { ThemeToggle } from '../theme/ThemeToggle'
import { cardClass } from './classes'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-brand-text">StockFlow</span>
          <ThemeToggle />
        </div>
        <div className={cardClass + ' p-6'}>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

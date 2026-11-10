import type { StockStatus } from '../lib/types'

const STYLES: Record<StockStatus, { label: string; className: string }> = {
  IN_STOCK: { label: 'In stock', className: 'bg-success/15 text-success' },
  LOW_STOCK: { label: 'Low stock', className: 'bg-warning/15 text-warning' },
  OUT_OF_STOCK: { label: 'Out of stock', className: 'bg-danger/15 text-danger' },
}

export function StatusBadge({ status }: { status: StockStatus }) {
  const style = STYLES[status]
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  )
}

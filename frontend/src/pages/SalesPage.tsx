import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { request } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import type { PageResponse, SaleSummary } from '../lib/types'
import { SaleDetailDialog } from '../sales/SaleDetailDialog'
import { SaleStatusBadge } from '../sales/SaleStatusBadge'
import { cardClass, inputClass, labelClass, secondaryButtonClass, smallButtonClass } from '../ui/classes'

const PAGE_SIZE = 15

type Preset = 'today' | 'week' | 'month' | 'all'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

function isoDate(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  if (preset === 'today') return { from: isoDate(now), to: isoDate(now) }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    return { from: isoDate(start), to: isoDate(now) }
  }
  if (preset === 'month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) }
  }
  return { from: '', to: '' }
}

export default function SalesPage() {
  const { me, can } = useAuth()
  const currency = me?.currencyCode ?? ''
  const [preset, setPreset] = useState<Preset | null>('today')
  const [range, setRange] = useState(() => presetRange('today'))
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const invalidRange = range.from !== '' && range.to !== '' && range.from > range.to

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['sales', range.from, range.to, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      if (status) params.set('status', status)
      return request<PageResponse<SaleSummary>>(`/sales?${params.toString()}`)
    },
    enabled: !invalidRange,
    placeholderData: keepPreviousData,
  })

  const items = data?.content ?? []
  const total = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  function choosePreset(value: Preset) {
    setPreset(value)
    setRange(presetRange(value))
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="mt-1 text-sm text-muted">
          {can('sales:read_all') ? 'Every sale in your business.' : 'The sales you recorded.'}
        </p>
      </div>

      <div className={cardClass + ' space-y-4'}>
        <div role="radiogroup" aria-label="Period" className="flex flex-wrap gap-2">
          {PRESETS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={preset === option.value}
              onClick={() => choosePreset(option.value)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                preset === option.value
                  ? 'border-primary bg-primary text-primary-contrast'
                  : 'border-border bg-surface hover:bg-bg',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="sales-from" className={labelClass}>
              From
            </label>
            <input
              id="sales-from"
              type="date"
              value={range.from}
              onChange={(e) => {
                setRange((current) => ({ ...current, from: e.target.value }))
                setPreset(null)
                setPage(0)
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sales-to" className={labelClass}>
              To
            </label>
            <input
              id="sales-to"
              type="date"
              value={range.to}
              onChange={(e) => {
                setRange((current) => ({ ...current, to: e.target.value }))
                setPreset(null)
                setPage(0)
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sales-status" className={labelClass}>
              Status
            </label>
            <select
              id="sales-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>
        {invalidRange && (
          <p role="alert" className="text-sm text-danger">
            The From date must be on or before the To date.
          </p>
        )}
      </div>

      {isPending && !invalidRange && <p className="text-sm text-muted">Loading sales...</p>}
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {error instanceof Error ? error.message : 'Could not load sales.'}
        </p>
      )}

      {data && items.length === 0 && (
        <div className={cardClass + ' text-center'}>
          <p className="font-medium">No sales found</p>
          <p className="mt-1 text-sm text-muted">Try a different period or status.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className={cardClass + ' hidden overflow-x-auto p-0 md:block'}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Receipt
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Served by
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total ({currency})
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((sale) => (
                  <tr key={sale.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{sale.receiptNumber}</div>
                      {sale.customerName && <div className="text-xs text-muted">{sale.customerName}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(sale.soldAt)}</td>
                    <td className="px-4 py-3 text-muted">{sale.soldBy}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(sale.total)}</td>
                    <td className="px-4 py-3">
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={smallButtonClass} onClick={() => setSelectedId(sale.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {items.map((sale) => (
              <li key={sale.id} className={cardClass + ' space-y-2'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{sale.receiptNumber}</p>
                    <p className="text-xs text-muted">{formatDateTime(sale.soldAt)}</p>
                  </div>
                  <SaleStatusBadge status={sale.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-semibold tabular-nums">
                      {currency} {formatMoney(sale.total)}
                    </span>
                    <span className="text-muted"> | {sale.soldBy}</span>
                  </p>
                  <button type="button" className={smallButtonClass} onClick={() => setSelectedId(sale.id)}>
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              Showing {from} to {to} of {total}
              {isFetching ? ' (updating)' : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
              >
                Previous
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedId && <SaleDetailDialog saleId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

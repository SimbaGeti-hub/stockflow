import { useState } from 'react'
import type { FormEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, request } from '../lib/api'
import { formatDateTime, formatQuantity, movementLabel } from '../lib/format'
import type { PageResponse, StockItem, StockMovement } from '../lib/types'
import { TextField } from '../ui/TextField'
import { labelClass, primaryButtonClass, secondaryButtonClass, smallButtonClass } from '../ui/classes'

type DoneHandler = (message: string) => void

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const details = Object.values(e.fieldErrors)
    return details.length > 0 ? details.join(' ') : e.message
  }
  return 'Something went wrong. Check your connection and try again.'
}

export function ReceiveForm({ item, onDone }: { item: StockItem; onDone: DoneHandler }) {
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(quantity)
    if (quantity.trim() === '' || !(amount > 0)) {
      setError('Enter a quantity above zero.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await request('/inventory/receipts', {
        method: 'POST',
        body: {
          notes: notes.trim() || undefined,
          items: [
            {
              productId: item.productId,
              quantity: amount,
              unitCost: unitCost.trim() === '' ? undefined : Number(unitCost),
            },
          ],
        },
      })
      await queryClient.invalidateQueries()
      onDone(`Received ${formatQuantity(amount)} of ${item.name}.`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">Currently {formatQuantity(item.onHand)} on hand.</p>
      <TextField
        id="receive-quantity"
        label="Quantity received"
        required
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={quantity}
        onChange={setQuantity}
      />
      <TextField
        id="receive-cost"
        label="Unit cost (optional)"
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={unitCost}
        onChange={setUnitCost}
        hint="Leave blank to use the product's cost price."
      />
      <TextField id="receive-notes" label="Notes (optional)" value={notes} onChange={setNotes} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primaryButtonClass + ' w-full'}>
        {busy ? 'Saving...' : 'Receive stock'}
      </button>
    </form>
  )
}

const PRESET_REASONS = ['Damaged', 'Lost or stolen', 'Found stock', 'Counting correction']

export function AdjustForm({ item, onDone }: { item: StockItem; onDone: DoneHandler }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'remove' | 'add'>('remove')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(quantity)
    if (quantity.trim() === '' || !(amount > 0)) {
      setError('Enter a quantity above zero.')
      return
    }
    if (reason.trim() === '') {
      setError('A reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await request<{ balanceAfter: number }>('/inventory/adjustments', {
        method: 'POST',
        body: {
          productId: item.productId,
          quantityChange: mode === 'add' ? amount : -amount,
          reason: reason.trim(),
        },
      })
      await queryClient.invalidateQueries()
      onDone(`${item.name} now has ${formatQuantity(result.balanceAfter)} on hand.`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">Currently {formatQuantity(item.onHand)} on hand.</p>

      <fieldset>
        <legend className={labelClass}>What happened?</legend>
        <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-2 gap-2">
          {(
            [
              ['remove', 'Remove stock'],
              ['add', 'Add stock'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={[
                'rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                mode === value
                  ? 'border-primary bg-primary text-primary-contrast'
                  : 'border-border bg-surface hover:bg-bg',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <TextField
        id="adjust-quantity"
        label="Quantity"
        required
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={quantity}
        onChange={setQuantity}
      />

      <div>
        <TextField id="adjust-reason" label="Reason" required value={reason} onChange={setReason} />
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_REASONS.map((preset) => (
            <button key={preset} type="button" className={smallButtonClass} onClick={() => setReason(preset)}>
              {preset}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primaryButtonClass + ' w-full'}>
        {busy ? 'Saving...' : 'Save adjustment'}
      </button>
    </form>
  )
}

export function HistoryList({ item }: { item: StockItem }) {
  const [page, setPage] = useState(0)

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['movements', item.productId, page],
    queryFn: () =>
      request<PageResponse<StockMovement>>(
        `/inventory/movements?productId=${item.productId}&page=${page}&size=10`,
      ),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <p className="text-sm text-muted">Loading history...</p>
  if (isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error instanceof Error ? error.message : 'Could not load the history.'}
      </p>
    )
  }
  if (data.content.length === 0) {
    return <p className="text-sm text-muted">No stock movements yet.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Newest first. Every change is a new entry, and entries can never be edited or deleted.
      </p>
      <ul className="divide-y divide-border">
        {data.content.map((movement) => (
          <li key={movement.id} className="py-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{movementLabel(movement.movementType)}</span>
              <span
                className={[
                  'font-semibold tabular-nums',
                  movement.quantityChange > 0 ? 'text-success' : 'text-danger',
                ].join(' ')}
              >
                {movement.quantityChange > 0 ? '+' : ''}
                {formatQuantity(movement.quantityChange)}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-3 text-xs text-muted">
              <span>
                {formatDateTime(movement.createdAt)}
                {movement.createdBy ? ` | ${movement.createdBy}` : ''}
              </span>
              <span className="tabular-nums">Balance {formatQuantity(movement.balanceAfter)}</span>
            </div>
            {movement.reason && <p className="mt-1 text-xs text-muted">{movement.reason}</p>}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Page {page + 1} of {Math.max(data.totalPages, 1)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
          >
            Newer
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { AdjustForm, HistoryList, ReceiveForm } from '../inventory/StockDialogs'
import { request } from '../lib/api'
import { formatQuantity } from '../lib/format'
import type { PageResponse, StockItem } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { Dialog } from '../ui/Dialog'
import { StatusBadge } from '../ui/StatusBadge'
import { cardClass, inputClass, secondaryButtonClass, smallButtonClass } from '../ui/classes'

const PAGE_SIZE = 10

type DialogState = { kind: 'receive' | 'adjust' | 'history'; item: StockItem } | null

export default function InventoryPage() {
  const { can } = useAuth()
  const canAdjust = can('inventory:adjust')
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [message, setMessage] = useState<string | null>(null)
  const term = useDebounced(search.trim(), 300)

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['stock', term, lowOnly, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
      if (term) params.set('search', term)
      if (lowOnly) params.set('lowStock', 'true')
      return request<PageResponse<StockItem>>(`/inventory/stock?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const items = data?.content ?? []
  const total = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  function open(kind: 'receive' | 'adjust' | 'history', item: StockItem) {
    setMessage(null)
    setDialog({ kind, item })
  }

  const closeDialog = () => setDialog(null)

  function onDone(text: string) {
    setDialog(null)
    setMessage(text)
  }

  function actions(item: StockItem) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canAdjust && (
          <>
            <button type="button" className={smallButtonClass} onClick={() => open('receive', item)}>
              Receive
            </button>
            <button type="button" className={smallButtonClass} onClick={() => open('adjust', item)}>
              Adjust
            </button>
          </>
        )}
        <button type="button" className={smallButtonClass} onClick={() => open('history', item)}>
          History
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-muted">Stock on hand for every active product. Low stock means at or below the reorder level.</p>
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="stock-search" className="sr-only">
            Search inventory
          </label>
          <input
            id="stock-search"
            type="search"
            placeholder="Search by name, SKU, or barcode"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked)
              setPage(0)
            }}
          />
          Low or out of stock only
        </label>
      </div>

      {isPending && <p className="text-sm text-muted">Loading inventory...</p>}
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {error instanceof Error ? error.message : 'Could not load inventory.'}
        </p>
      )}

      {data && items.length === 0 && (
        <div className={cardClass + ' text-center'}>
          <p className="font-medium">Nothing to show</p>
          <p className="mt-1 text-sm text-muted">
            {term || lowOnly ? 'Try a different search or filter.' : 'Add a product to start tracking stock.'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className={cardClass + ' hidden overflow-x-auto p-0 md:block'}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    On hand
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Reorder level
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
                {items.map((item) => (
                  <tr key={item.productId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatQuantity(item.onHand)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {formatQuantity(item.reorderThreshold)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">{actions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {items.map((item) => (
              <li key={item.productId} className={cardClass + ' space-y-3'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted">{item.sku}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm">
                  <span className="text-lg font-semibold tabular-nums">{formatQuantity(item.onHand)}</span>{' '}
                  <span className="text-muted">on hand | reorder at {formatQuantity(item.reorderThreshold)}</span>
                </p>
                {actions(item)}
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

      {dialog && (
        <>
          <Dialog
            open={dialog.kind === 'receive'}
            title={`Receive stock: ${dialog.item.name}`}
            onClose={closeDialog}
          >
            <ReceiveForm item={dialog.item} onDone={onDone} />
          </Dialog>
          <Dialog
            open={dialog.kind === 'adjust'}
            title={`Adjust stock: ${dialog.item.name}`}
            onClose={closeDialog}
          >
            <AdjustForm item={dialog.item} onDone={onDone} />
          </Dialog>
          <Dialog
            wide
            open={dialog.kind === 'history'}
            title={`Stock history: ${dialog.item.name}`}
            onClose={closeDialog}
          >
            <HistoryList item={dialog.item} />
          </Dialog>
        </>
      )}
    </div>
  )
}

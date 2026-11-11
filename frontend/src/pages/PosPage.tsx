import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { ApiError, request, requestText } from '../lib/api'
import { formatMoney } from '../lib/format'
import { cartTotals } from '../lib/pricing'
import type { CartLine } from '../lib/pricing'
import type { PosProduct, SaleResult } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { CancelSaleDialog } from '../pos/CancelSaleDialog'
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../ui/classes'

type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'bank_transfer'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
]

type Completed = { sale: SaleResult; receipt: string; change: number }

function fetchProducts(term: string) {
  const params = new URLSearchParams({ limit: '30' })
  if (term) params.set('search', term)
  return request<PosProduct[]>(`/pos/products?${params.toString()}`)
}

export default function PosPage() {
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const currency = me?.currencyCode ?? ''

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState<Completed | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<HTMLElement>(null)
  // One key per sale. If a request is repeated after a dropped connection, the server
  // returns the original sale instead of creating a second one.
  const keyRef = useRef<string | null>(null)

  const term = useDebounced(search.trim(), 250)

  const { data: products, isPending, isError } = useQuery({
    queryKey: ['pos', term],
    queryFn: () => fetchProducts(term),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Warn before a refresh or tab close throws away a sale in progress.
  const hasOpenSale = cart.length > 0 && !completed
  useEffect(() => {
    if (!hasOpenSale) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasOpenSale])

  const totals = useMemo(() => cartTotals(cart), [cart])
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0)

  const tenderedNumber = Number(tendered)
  const hasTendered = method === 'cash' && tendered.trim() !== '' && !Number.isNaN(tenderedNumber)
  const cashShort = hasTendered && tenderedNumber < totals.total
  const change = hasTendered && !cashShort ? tenderedNumber - totals.total : 0
  const canCharge = cart.length > 0 && !busy && !cashShort

  function addToCart(product: PosProduct) {
    setError(null)
    setNotice(null)
    setCancelled(false)
    const existing = cart.find((line) => line.product.id === product.id)
    if (product.onHand < 1) {
      setNotice(`${product.name} is out of stock.`)
      return
    }
    if (existing && existing.quantity >= product.onHand) {
      setNotice(`Only ${product.onHand} of ${product.name} in stock.`)
      return
    }
    setCart((current) =>
      existing
        ? current.map((line) =>
            line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { product, quantity: 1 }],
    )
  }

  function setQuantity(productId: string, quantity: number) {
    setNotice(null)
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.min(quantity, line.product.onHand) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    )
  }

  async function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const code = search.trim()
    if (!code) return

    // A barcode scanner types the code and presses Enter, so look it up right away.
    try {
      const results = await queryClient.fetchQuery({
        queryKey: ['pos', code],
        queryFn: () => fetchProducts(code),
        staleTime: 0,
      })
      const exact = results.find(
        (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase(),
      )
      const pick = exact ?? (results.length === 1 ? results[0] : undefined)
      if (pick) {
        addToCart(pick)
        setSearch('')
      } else {
        setNotice(
          results.length === 0 ? 'No product matches that code.' : 'Several products match. Tap the one you want.',
        )
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not search. Check your connection and try again.')
    }
  }

  async function charge() {
    setBusy(true)
    setError(null)
    if (!keyRef.current) keyRef.current = crypto.randomUUID()

    try {
      const sale = await request<SaleResult>('/sales', {
        method: 'POST',
        headers: { 'Idempotency-Key': keyRef.current },
        body: {
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          payInFullMethod: method,
          paymentReference: reference.trim() || undefined,
        },
      })
      const receipt = await requestText(`/sales/${sale.id}/receipt`)
      setCompleted({ sale, receipt, change })
      void queryClient.invalidateQueries()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record the sale. Check your connection and try again.')
      void queryClient.invalidateQueries({ queryKey: ['pos'] })
    } finally {
      setBusy(false)
    }
  }

  function newSale() {
    keyRef.current = null
    setCart([])
    setTendered('')
    setReference('')
    setSearch('')
    setError(null)
    setNotice(null)
    setCompleted(null)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function cancelSale(reason: string | null) {
    const items = cart.map((line) => ({ productId: line.product.id, quantity: line.quantity }))
    // Best effort: the sale is cancelled on screen even if the record cannot be saved.
    request('/pos/cancellations', {
      method: 'POST',
      body: { reason: reason ?? undefined, items },
    }).catch(() => undefined)
    setCancelOpen(false)
    newSale()
    setCancelled(true)
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className={cardClass}>
          <p className="text-sm font-medium text-success">Sale recorded</p>
          <p className="mt-1 text-2xl font-semibold">{completed.sale.receiptNumber}</p>
          <p className="mt-1 text-sm text-muted">
            Total {currency} {formatMoney(completed.sale.total)}
          </p>
          {completed.change > 0 && (
            <p className="mt-3 text-lg font-semibold">
              Change to give: {currency} {formatMoney(completed.change)}
            </p>
          )}
        </div>
        <div id="receipt" className="rounded-xl border border-border bg-surface p-4">
          <pre className="font-mono text-sm whitespace-pre-wrap">{completed.receipt}</pre>
        </div>
        <div className="flex gap-3">
          <button type="button" className={primaryButtonClass + ' flex-1'} onClick={newSale}>
            New sale
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>
            Print receipt
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0">
      <section aria-label="Products" className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">New sale</h1>
          <p className="mt-1 text-sm text-muted">Scan a barcode and press Enter, or search and tap a product.</p>
        </div>

        {cancelled && cart.length === 0 && (
          <p role="status" className="rounded-lg border border-border bg-surface p-3 text-sm">
            Sale cancelled. Nothing was charged and no stock was changed.
          </p>
        )}

        <div>
          <label htmlFor="pos-search" className="sr-only">
            Scan or search products
          </label>
          <input
            id="pos-search"
            ref={searchRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Scan a barcode or search by name or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => void onSearchKeyDown(e)}
            className={inputClass}
          />
        </div>

        <div aria-live="polite" className="min-h-5 text-sm text-warning">
          {notice}
        </div>

        {isPending && <p className="text-sm text-muted">Loading products...</p>}
        {isError && (
          <p role="alert" className="text-sm text-danger">
            Could not load products.
          </p>
        )}
        {products && products.length === 0 && (
          <div className={cardClass + ' text-center text-sm text-muted'}>No products found.</div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products?.map((product) => {
            const out = product.onHand < 1
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => {
                    addToCart(product)
                    searchRef.current?.focus()
                  }}
                  className={[
                    'flex h-full w-full flex-col items-start rounded-xl border border-border bg-surface p-3 text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    out ? 'cursor-not-allowed opacity-50' : 'hover:border-primary',
                  ].join(' ')}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-xs text-muted">{product.sku}</span>
                  <span className="mt-2 flex w-full items-end justify-between gap-2">
                    <span className="font-semibold tabular-nums">{formatMoney(product.sellingPrice)}</span>
                    <span className={out ? 'text-xs text-danger' : 'text-xs text-muted'}>
                      {out ? 'Out of stock' : `${product.onHand} in stock`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section ref={cartRef} aria-label="Current sale" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className={cardClass + ' space-y-4'}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Current sale</h2>
            {cart.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
                className={smallButtonClass + ' text-danger'}
              >
                Cancel sale
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-muted">The sale is empty. Add a product to begin.</p>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((line) => (
                <li key={line.product.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.product.name}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {formatMoney(line.product.sellingPrice)} each
                    </p>
                    {line.quantity >= line.product.onHand && (
                      <p className="text-xs text-warning">All {line.product.onHand} in stock are in this sale.</p>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${line.product.name} from the sale`}
                      onClick={() => setQuantity(line.product.id, 0)}
                      className="mt-1 text-xs text-muted underline hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={secondaryButtonClass + ' h-9 w-9 px-0'}
                      aria-label={`Remove one ${line.product.name}`}
                      onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className={secondaryButtonClass + ' h-9 w-9 px-0'}
                      aria-label={`Add one ${line.product.name}`}
                      disabled={line.quantity >= line.product.onHand}
                      onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-medium tabular-nums">
                    {formatMoney(line.product.sellingPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tabular-nums">{formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {currency} {formatMoney(totals.total)}
              </dd>
            </div>
          </dl>

          <fieldset>
            <legend className={labelClass}>Payment method</legend>
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
              {METHODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={method === option.value}
                  onClick={() => setMethod(option.value)}
                  className={[
                    'rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    method === option.value
                      ? 'border-primary bg-primary text-primary-contrast'
                      : 'border-border bg-surface hover:bg-bg',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {method === 'cash' ? (
            <div>
              <label htmlFor="tendered" className={labelClass}>
                Cash received (optional)
              </label>
              <input
                id="tendered"
                type="number"
                inputMode="decimal"
                min="0"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className={inputClass}
              />
              {cashShort && (
                <p role="alert" className="mt-1 text-sm text-danger">
                  That is less than the total. Part payments need a customer, which is coming soon.
                </p>
              )}
              {hasTendered && !cashShort && (
                <p className="mt-1 text-sm font-medium" aria-live="polite">
                  Change: {currency} {formatMoney(change)}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="reference" className={labelClass}>
                Payment reference (optional)
              </label>
              <input
                id="reference"
                type="text"
                autoComplete="off"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canCharge}
            onClick={() => void charge()}
            className={primaryButtonClass + ' w-full py-3 text-base'}
          >
            {busy ? 'Recording...' : `Charge ${currency} ${formatMoney(totals.total)}`}
          </button>
        </div>
      </section>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-border bg-surface px-4 py-3 md:left-64 lg:hidden">
          <p className="flex-1 text-sm">
            <span className="font-semibold">{itemCount}</span> {itemCount === 1 ? 'item' : 'items'} |{' '}
            <span className="font-semibold tabular-nums">
              {currency} {formatMoney(totals.total)}
            </span>
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Review sale
          </button>
        </div>
      )}

      <CancelSaleDialog
        open={cancelOpen}
        itemCount={itemCount}
        totalLabel={`${currency} ${formatMoney(totals.total)}`}
        onKeep={() => setCancelOpen(false)}
        onConfirm={cancelSale}
      />
    </div>
  )
}

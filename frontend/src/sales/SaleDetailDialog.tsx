import { useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { ApiError, request, requestText } from '../lib/api'
import { formatDateTime, formatMoney, formatQuantity, paymentLabel } from '../lib/format'
import type { SaleDetail } from '../lib/types'
import { Dialog } from '../ui/Dialog'
import { TextField } from '../ui/TextField'
import { dangerButtonClass, secondaryButtonClass, smallButtonClass } from '../ui/classes'
import { SaleStatusBadge } from './SaleStatusBadge'

const VOID_REASONS = ['Customer returned the goods', 'Wrong items entered', 'Entered by mistake', 'Duplicate sale']

function SaleDetailBody({ saleId }: { saleId: string }) {
  const { me, can } = useAuth()
  const queryClient = useQueryClient()
  const currency = me?.currencyCode ?? ''
  const [showReceipt, setShowReceipt] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sale = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => request<SaleDetail>(`/sales/${saleId}`),
  })
  const receipt = useQuery({
    queryKey: ['sale-receipt', saleId],
    queryFn: () => requestText(`/sales/${saleId}/receipt`),
  })

  async function onVoid(event: FormEvent) {
    event.preventDefault()
    if (reason.trim() === '') {
      setError('A reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await request<SaleDetail>(`/sales/${saleId}/void`, { method: 'POST', body: { reason: reason.trim() } })
      await queryClient.invalidateQueries()
      setVoiding(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not void the sale. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sale.isPending) return <p className="text-sm text-muted">Loading sale...</p>
  if (sale.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {sale.error instanceof Error ? sale.error.message : 'Could not load the sale.'}
      </p>
    )
  }

  const s = sale.data
  const canVoid = can('sales:void') && s.status === 'completed'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold">{s.receiptNumber}</p>
          <p className="text-sm text-muted">
            {formatDateTime(s.soldAt)} | Served by {s.soldBy}
          </p>
          {s.customerName && <p className="text-sm text-muted">Customer: {s.customerName}</p>}
        </div>
        <SaleStatusBadge status={s.status} />
      </div>

      {s.status === 'voided' && (
        <div role="note" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="font-medium text-danger">
            This sale was voided{s.voidedAt ? ` on ${formatDateTime(s.voidedAt)}` : ''}.
          </p>
          {s.voidReason && <p className="mt-1 text-muted">Reason: {s.voidReason}</p>}
          <p className="mt-1 text-muted">The items went back into stock.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((item) => (
              <tr key={item.productId} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-xs text-muted">{item.sku}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{formatMoney(item.unitPrice * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(s.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Tax</dt>
          <dd className="tabular-nums">{formatMoney(s.taxTotal)}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {currency} {formatMoney(s.total)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Paid</dt>
          <dd className="tabular-nums">{formatMoney(s.amountPaid)}</dd>
        </div>
        {s.balanceDue > 0 && (
          <div className="flex justify-between font-medium text-warning">
            <dt>Balance due</dt>
            <dd className="tabular-nums">{formatMoney(s.balanceDue)}</dd>
          </div>
        )}
      </dl>

      {s.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Payments</h3>
          <ul className="divide-y divide-border text-sm">
            {s.payments.map((payment, index) => (
              <li key={index} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {paymentLabel(payment.method)}
                  {payment.reference ? <span className="text-muted"> | {payment.reference}</span> : null}
                </span>
                <span className="tabular-nums">{formatMoney(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          aria-expanded={showReceipt}
          onClick={() => setShowReceipt((value) => !value)}
        >
          {showReceipt ? 'Hide receipt' : 'Show receipt'}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={!receipt.data}
          onClick={() => window.print()}
        >
          Print receipt
        </button>
        {canVoid && !voiding && (
          <button type="button" className={dangerButtonClass + ' ml-auto'} onClick={() => setVoiding(true)}>
            Void sale
          </button>
        )}
      </div>

      {showReceipt && receipt.data && (
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-sm whitespace-pre-wrap">
          {receipt.data}
        </pre>
      )}

      {voiding && (
        <form onSubmit={onVoid} className="space-y-3 rounded-lg border border-danger/40 p-3" noValidate>
          <p className="text-sm font-medium">Void this sale?</p>
          <p className="text-sm text-muted">
            The items go back into stock. This does not move any money. If the customer paid, give the refund
            yourself and say so in the reason.
          </p>
          <TextField id="void-reason" label="Reason" required value={reason} onChange={setReason} />
          <div className="flex flex-wrap gap-2">
            {VOID_REASONS.map((preset) => (
              <button key={preset} type="button" className={smallButtonClass} onClick={() => setReason(preset)}>
                {preset}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={dangerButtonClass}>
              {busy ? 'Voiding...' : 'Void sale'}
            </button>
            <button
              type="button"
              disabled={busy}
              className={secondaryButtonClass}
              onClick={() => {
                setVoiding(false)
                setError(null)
              }}
            >
              Keep sale
            </button>
          </div>
        </form>
      )}

      {/* Printed instead of the page when you press Print receipt. */}
      {receipt.data &&
        createPortal(
          <pre id="receipt" className="hidden font-mono text-sm whitespace-pre-wrap print:block">
            {receipt.data}
          </pre>,
          document.body,
        )}
    </div>
  )
}

export function SaleDetailDialog({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  return (
    <Dialog open title="Sale details" wide onClose={onClose}>
      <SaleDetailBody saleId={saleId} />
    </Dialog>
  )
}

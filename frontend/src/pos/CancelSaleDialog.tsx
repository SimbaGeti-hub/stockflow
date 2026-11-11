import { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { primaryButtonClass } from '../ui/classes'

const REASONS = ['Customer changed their mind', 'Wrong items added', 'Customer left', 'Price problem']

type Props = {
  open: boolean
  itemCount: number
  totalLabel: string
  onKeep: () => void
  onConfirm: (reason: string | null) => void
}

type BodyProps = Omit<Props, 'open'>

function CancelSaleBody({ itemCount, totalLabel, onKeep, onConfirm }: BodyProps) {
  const [reason, setReason] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {itemCount} {itemCount === 1 ? 'item' : 'items'} worth <span className="font-semibold">{totalLabel}</span>{' '}
        will be removed from this sale.
      </p>
      <p className="text-sm text-muted">Nothing has been charged and your stock does not change.</p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Why is it being cancelled? (optional)</legend>
        <div role="radiogroup" aria-label="Reason for cancelling" className="flex flex-wrap gap-2">
          {REASONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={reason === option}
              onClick={() => setReason(reason === option ? null : option)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                reason === option
                  ? 'border-primary bg-primary text-primary-contrast'
                  : 'border-border bg-surface hover:bg-bg',
              ].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          className="inline-flex items-center justify-center rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Cancel sale
        </button>
        <button
          type="button"
          onClick={onKeep}
          className={primaryButtonClass}
          // The browser focuses this button when the dialog opens, so Enter keeps the sale.
          ref={(element) => element?.setAttribute('autofocus', '')}
        >
          Keep selling
        </button>
      </div>
    </div>
  )
}

export function CancelSaleDialog({ open, itemCount, totalLabel, onKeep, onConfirm }: Props) {
  return (
    <Dialog open={open} title="Cancel this sale?" onClose={onKeep}>
      <CancelSaleBody itemCount={itemCount} totalLabel={totalLabel} onKeep={onKeep} onConfirm={onConfirm} />
    </Dialog>
  )
}

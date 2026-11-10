import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { secondaryButtonClass } from './classes'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}

/** Uses the browser's native modal dialog: Esc closes it and focus stays inside. */
export function Dialog({ open, title, onClose, wide = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog itself, not its content, is a click on the backdrop.
        if (event.target === ref.current) onClose()
      }}
      className={[
        'm-auto max-h-[90dvh] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-text backdrop:bg-black/50',
        wide ? 'w-[min(42rem,calc(100vw-2rem))]' : 'w-[min(30rem,calc(100vw-2rem))]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={secondaryButtonClass + ' h-8 w-8 px-0'}
        >
          x
        </button>
      </div>
      <div className="p-4">{open ? children : null}</div>
    </dialog>
  )
}

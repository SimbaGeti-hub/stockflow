const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

// The business currency will come from settings later. For now we show the number only.
export function formatMoney(value: number): string {
  return money.format(value)
}

const quantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })

export function formatQuantity(value: number): string {
  return quantity.format(value)
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

const MOVEMENT_LABELS: Record<string, string> = {
  opening_balance: 'Opening balance',
  purchase_receipt: 'Stock received',
  sale: 'Sale',
  sale_void: 'Sale voided',
  sale_refund: 'Sale refunded',
  adjustment: 'Adjustment',
}

export function movementLabel(type: string): string {
  return MOVEMENT_LABELS[type] ?? type
}

const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

// The business currency will come from settings later. For now we show the number only.
export function formatMoney(value: number): string {
  return money.format(value)
}

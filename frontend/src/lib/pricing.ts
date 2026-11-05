import type { PosProduct } from './types'

export type CartLine = {
  product: PosProduct
  quantity: number
}

const round4 = (value: number) => Math.round(value * 10000) / 10000

/** An estimate for the screen. The server calculates the real totals and the receipt. */
export function cartTotals(lines: CartLine[]) {
  let subtotal = 0
  let tax = 0
  for (const line of lines) {
    const lineSubtotal = round4(line.product.sellingPrice * line.quantity)
    subtotal += lineSubtotal
    tax += round4((lineSubtotal * line.product.taxRate) / 100)
  }
  return { subtotal: round4(subtotal), tax: round4(tax), total: round4(subtotal + tax) }
}

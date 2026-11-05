export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type Product = {
  id: string
  name: string
  sku: string
  barcode: string | null
  description: string | null
  categoryId: string | null
  categoryName: string | null
  costPrice: number | null
  sellingPrice: number
  taxRate: number
  reorderThreshold: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PosProduct = {
  id: string
  name: string
  sku: string
  barcode: string | null
  sellingPrice: number
  taxRate: number
  onHand: number
}

export type SaleResult = {
  id: string
  receiptNumber: string
  status: string
  total: number
  amountPaid: number
}

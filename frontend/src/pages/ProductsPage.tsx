import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { request } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { PageResponse, Product } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { cardClass, inputClass, secondaryButtonClass } from '../ui/classes'

const PAGE_SIZE = 10

export default function ProductsPage() {
  const { can } = useAuth()
  const showCost = can('products:write')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const term = useDebounced(search.trim(), 300)

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['products', term, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        active: 'true',
        sortBy: 'name',
        direction: 'asc',
      })
      if (term) params.set('search', term)
      return request<PageResponse<Product>>(`/products?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const items = data?.content ?? []
  const total = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-muted">Search by name, SKU, or barcode.</p>
      </div>

      <div>
        <label htmlFor="product-search" className="sr-only">
          Search products
        </label>
        <input
          id="product-search"
          type="search"
          placeholder="Search products"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className={inputClass + ' max-w-md'}
        />
      </div>

      {isPending && <p className="text-sm text-muted">Loading products...</p>}
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {error instanceof Error ? error.message : 'Could not load products.'}
        </p>
      )}

      {data && items.length === 0 && (
        <div className={cardClass + ' text-center'}>
          <p className="font-medium">No products found</p>
          <p className="mt-1 text-sm text-muted">
            {term ? 'Try a different search.' : 'Products you add will appear here.'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Table on larger screens */}
          <div className={cardClass + ' hidden overflow-x-auto p-0 md:block'}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Price
                  </th>
                  {showCost && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Cost
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted">{product.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{product.categoryName ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(product.sellingPrice)}</td>
                    {showCost && (
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {product.costPrice === null ? '-' : formatMoney(product.costPrice)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards on phones */}
          <ul className="space-y-3 md:hidden">
            {items.map((product) => (
              <li key={product.id} className={cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-muted">
                      {product.sku}
                      {product.categoryName ? ` | ${product.categoryName}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatMoney(product.sellingPrice)}</p>
                </div>
                {showCost && product.costPrice !== null && (
                  <p className="mt-2 text-xs text-muted">Cost {formatMoney(product.costPrice)}</p>
                )}
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
    </div>
  )
}

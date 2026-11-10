import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError, request } from '../lib/api'
import { formatMoney } from '../lib/format'
import type { PageResponse, Product } from '../lib/types'
import { useDebounced } from '../lib/useDebounced'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass, smallButtonClass } from '../ui/classes'

const PAGE_SIZE = 10

export default function ProductsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = can('products:write')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [page, setPage] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const term = useDebounced(search.trim(), 300)

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['products', term, showArchived, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
        active: showArchived ? 'false' : 'true',
        sortBy: 'name',
        direction: 'asc',
      })
      if (term) params.set('search', term)
      return request<PageResponse<Product>>(`/products?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  async function restore(product: Product) {
    setActionError(null)
    try {
      await request<Product>(`/products/${product.id}/restore`, { method: 'POST' })
      await queryClient.invalidateQueries()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not restore the product.')
    }
  }

  const items = data?.content ?? []
  const total = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  function rowAction(product: Product) {
    if (!canWrite) return null
    return showArchived ? (
      <button type="button" className={smallButtonClass} onClick={() => void restore(product)}>
        Restore
      </button>
    ) : (
      <Link to={`/products/${product.id}/edit`} className={smallButtonClass}>
        Edit
      </Link>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{showArchived ? 'Archived products' : 'Products'}</h1>
          <p className="mt-1 text-sm text-muted">Search by name, SKU, or barcode.</p>
        </div>
        {canWrite && (
          <Link to="/products/new" className={primaryButtonClass}>
            New product
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 basis-64">
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
            className={inputClass}
          />
        </div>
        {canWrite && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked)
                setPage(0)
              }}
            />
            Show archived
          </label>
        )}
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
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
            {term ? 'Try a different search.' : showArchived ? 'Nothing is archived.' : 'Products you add will appear here.'}
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
                  <th scope="col" className="px-4 py-3 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Price
                  </th>
                  {canWrite && (
                    <>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Cost
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </>
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
                    {canWrite && (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {product.costPrice === null ? '-' : formatMoney(product.costPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">{rowAction(product)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                {canWrite && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      {product.costPrice !== null ? `Cost ${formatMoney(product.costPrice)}` : ''}
                    </p>
                    {rowAction(product)}
                  </div>
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

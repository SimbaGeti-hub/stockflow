import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { request } from '../lib/api'
import type { PageResponse } from '../lib/types'
import { cardClass } from '../ui/classes'

function useCount(key: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['count', key],
    queryFn: () => request<PageResponse<unknown>>(path),
    enabled,
    select: (page) => page.totalElements,
  })
}

function StatCard({ label, hint, query }: { label: string; hint: string; query: UseQueryResult<number> }) {
  let value = '-'
  if (query.isError) value = 'n/a'
  else if (query.data !== undefined) value = String(query.data)
  else if (query.isFetching) value = '...'

  return (
    <div className={cardClass}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums" aria-live="polite">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { me, can } = useAuth()
  const today = new Date().toLocaleDateString('en-CA')
  const canSeeSales = can('sales:read_all') || can('sales:read_own')

  const products = useCount('products', '/products?size=1&active=true', can('products:read'))
  const lowStock = useCount('low-stock', '/inventory/stock?size=1&lowStock=true', can('inventory:read'))
  const salesToday = useCount(
    `sales-${today}`,
    `/sales?size=1&status=completed&from=${today}&to=${today}`,
    canSeeSales,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          You are signed in as {me?.role}. These numbers come live from your workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {can('products:read') && <StatCard label="Active products" hint="In your catalog" query={products} />}
        {can('inventory:read') && (
          <StatCard label="Low or out of stock" hint="At or below the reorder level" query={lowStock} />
        )}
        {canSeeSales && <StatCard label="Sales today" hint="Completed sales" query={salesToday} />}
      </div>

      <div className={cardClass}>
        <h2 className="text-sm font-semibold">Your access</h2>
        <p className="mt-1 text-sm text-muted">
          {me?.permissions.length ?? 0} permissions are active for this role. Sections you cannot use are hidden.
        </p>
      </div>
    </div>
  )
}

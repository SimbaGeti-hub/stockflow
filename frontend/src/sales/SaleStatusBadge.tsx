import { Badge } from '../ui/Badge'

export function SaleStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge tone="success">Completed</Badge>
    case 'voided':
      return <Badge tone="danger">Voided</Badge>
    case 'refunded':
      return <Badge tone="warning">Refunded</Badge>
    default:
      return <Badge tone="neutral">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
  }
}

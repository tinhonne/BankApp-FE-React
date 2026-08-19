export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  '0': 'Inactive',
  '1': 'Active',
  '2': 'Frozen',
  '3': 'Pending',
}

export const ACCOUNT_STATUS_BADGES: Record<string, string> = {
  '0': 'badge-inactive',
  '1': 'badge-active',
  '2': 'badge-frozen',
  '3': 'badge-pending',
}

export function accountStatusLabel(status: number | null) {
  return status === null ? 'Unavailable' : (ACCOUNT_STATUS_LABELS[String(status)] ?? 'Unavailable')
}

export function accountStatusBadge(status: number | null) {
  return status === null ? 'badge-inactive' : (ACCOUNT_STATUS_BADGES[String(status)] ?? 'badge-inactive')
}

export function formatMoney(value: number | null) {
  if (value === null) {
    return '—'
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
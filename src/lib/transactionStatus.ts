const TRANSACTION_STATUS_INFO: Record<string, { label: string; badge: string }> = {
  SUCCESS: { label: 'Success', badge: 'badge-active' },
  INSUFFICIENT_BALANCE: { label: 'Insufficient balance', badge: 'badge-pending' },
  SYSTEM_ERROR: { label: 'System error', badge: 'badge-inactive' },
}

export function transactionStatusInfo(status: string | null) {
  if (status && TRANSACTION_STATUS_INFO[status]) {
    return TRANSACTION_STATUS_INFO[status]
  }
  return { label: 'Unavailable', badge: 'badge-inactive' }
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.replace('T', ' ')
}
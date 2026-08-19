import { HttpError, request } from './http'
import type { Account, ApiSuccess, PageResponse } from './types'

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    (typeof item.id === 'number' || item.id === null) &&
    (typeof item.customerName === 'string' || item.customerName === null) &&
    (typeof item.accountNumber === 'string' || item.accountNumber === null) &&
    (typeof item.balance === 'number' || item.balance === null) &&
    (typeof item.status === 'number' || item.status === null)
  )
}

function isPage(value: unknown): value is PageResponse<Account> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const page = value as Record<string, unknown>
  return (
    Array.isArray(page.content) &&
    page.content.every(isAccount) &&
    typeof page.pageNumber === 'number' &&
    typeof page.pageSize === 'number' &&
    typeof page.totalElements === 'number' &&
    typeof page.totalPages === 'number' &&
    typeof page.last === 'boolean'
  )
}

export async function getAccounts(signal?: AbortSignal) {
  const response = await request<ApiSuccess<unknown>>('/accounts?page=0&size=5', {
    authenticated: true,
    signal,
  })

  if (response.code !== 'SUCCESS' || !isPage(response.result)) {
    throw new HttpError('The server returned invalid account data.', 200)
  }

  return response.result
}

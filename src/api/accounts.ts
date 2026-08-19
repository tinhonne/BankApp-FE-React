import { HttpError, request } from './http'
import type { Account, AccountCreateRequest, ApiSuccess, PageResponse } from './types'

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    (typeof item.id === 'number' || item.id === null) &&
    (typeof item.customerId === 'number' || item.customerId === null) &&
    (typeof item.customerName === 'string' || item.customerName === null) &&
    (typeof item.accountNumber === 'string' || item.accountNumber === null) &&
    (typeof item.balance === 'number' || item.balance === null) &&
    (typeof item.status === 'number' || item.status === null) &&
    (typeof item.createDatetime === 'string' || item.createDatetime === null) &&
    (typeof item.updateDatetime === 'string' || item.updateDatetime === null)
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

function assertSuccess(response: unknown): asserts response is ApiSuccess<unknown> {
  if (
    typeof response !== 'object' ||
    response === null ||
    (response as Partial<ApiSuccess<unknown>>).code !== 'SUCCESS'
  ) {
    throw new HttpError('The server returned an invalid response.', 200)
  }
}

function assertAccount(response: ApiSuccess<unknown>): asserts response is ApiSuccess<Account> {
  if (!isAccount(response.result)) {
    throw new HttpError('The server returned invalid account data.', 200)
  }
}

export async function getAccounts(page: number, size: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts?page=${page}&size=${size}`, {
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  if (!isPage(response.result)) {
    throw new HttpError('The server returned invalid account data.', 200)
  }
  return response.result
}

export async function getAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}`, { authenticated: true, signal })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function getAccountByNumber(accountNumber: string, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/number/${accountNumber}`, {
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function createAccount(data: AccountCreateRequest, signal?: AbortSignal) {
  const response = await request<unknown>('/accounts', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(data),
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function approveAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}/approve`, {
    method: 'PUT',
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function rejectAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}/reject`, {
    method: 'PUT',
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function freezeAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}/freeze`, {
    method: 'PUT',
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function unfreezeAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}/unfreeze`, {
    method: 'PUT',
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function closeAccount(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/accounts/${id}/close`, {
    method: 'PUT',
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  assertAccount(response)
  return response.result
}

export async function getCustomerAccounts(customerId: number, page: number, size: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/customers/${customerId}/accounts?page=${page}&size=${size}`, {
    authenticated: true,
    signal,
  })
  assertSuccess(response)
  if (!isPage(response.result)) {
    throw new HttpError('The server returned invalid account data.', 200)
  }
  return response.result
}
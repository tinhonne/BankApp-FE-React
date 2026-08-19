import { HttpError, request } from './http'
import type { ApiSuccess, PageResponse, Transaction, TransactionStatus, TransferRequest } from './types'

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return value === 'SUCCESS' || value === 'INSUFFICIENT_BALANCE' || value === 'SYSTEM_ERROR'
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    (typeof item.id === 'number' || item.id === null) &&
    (typeof item.transactionDate === 'string' || item.transactionDate === null) &&
    (typeof item.fromAccountNumber === 'string' || item.fromAccountNumber === null) &&
    (typeof item.toAccountNumber === 'string' || item.toAccountNumber === null) &&
    (typeof item.amount === 'number' || item.amount === null) &&
    (isTransactionStatus(item.status) || item.status === null) &&
    (typeof item.content === 'string' || item.content === null) &&
    (typeof item.errorReason === 'string' || item.errorReason === null)
  )
}

function isPage(value: unknown): value is PageResponse<Transaction> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const page = value as Record<string, unknown>
  return (
    Array.isArray(page.content) &&
    page.content.every(isTransaction) &&
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

export async function transfer(data: TransferRequest, signal?: AbortSignal) {
  const response = await request<unknown>('/transactions/transfer', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(data),
    signal,
  })
  assertSuccess(response)
  if (!isTransaction(response.result)) {
    throw new HttpError('The server returned invalid transaction data.', 200)
  }
  return response.result
}

export async function getTransactions(
  accountNumber: string,
  fromDate: string | undefined,
  toDate: string | undefined,
  page: number,
  size: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))
  if (fromDate) {
    params.set('fromDate', fromDate)
  }
  if (toDate) {
    params.set('toDate', toDate)
  }
  const response = await request<unknown>(
    `/accounts/${accountNumber}/transactions?${params.toString()}`,
    { authenticated: true, signal },
  )
  assertSuccess(response)
  if (!isPage(response.result)) {
    throw new HttpError('The server returned invalid transaction data.', 200)
  }
  return response.result
}
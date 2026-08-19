import { HttpError, request } from './http'
import type { ApiSuccess, Customer, PageResponse } from './types'

function isCustomer(value: unknown): value is Customer {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    (typeof item.id === 'number' || item.id === null) &&
    (typeof item.name === 'string' || item.name === null) &&
    (item.customerType === 'INDIVIDUAL' || item.customerType === 'CORPORATE' || item.customerType === null) &&
    (typeof item.status === 'number' || item.status === null)
  )
}

function isPage(value: unknown): value is PageResponse<Customer> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const page = value as Record<string, unknown>
  return (
    Array.isArray(page.content) &&
    page.content.every(isCustomer) &&
    typeof page.pageNumber === 'number' &&
    typeof page.pageSize === 'number' &&
    typeof page.totalElements === 'number' &&
    typeof page.totalPages === 'number' &&
    typeof page.last === 'boolean'
  )
}

export async function getCustomers(signal?: AbortSignal) {
  const response = await request<ApiSuccess<unknown>>('/customers?page=0&size=5', {
    authenticated: true,
    signal,
  })

  if (response.code !== 'SUCCESS' || !isPage(response.result)) {
    throw new HttpError('The server returned invalid customer data.', 200)
  }

  return response.result
}

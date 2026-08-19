import { HttpError, request } from './http'
import type {
  ApiSuccess,
  Customer,
  CustomerCreateRequest,
  CustomerSearchFilters,
  CustomerType,
  CustomerUpdateRequest,
  PageResponse,
} from './types'

function isCustomerType(value: unknown): value is CustomerType {
  return value === 'INDIVIDUAL' || value === 'CORPORATE'
}

function isCustomer(value: unknown): value is Customer {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    (typeof item.id === 'number' || item.id === null) &&
    (typeof item.name === 'string' || item.name === null) &&
    (typeof item.birthday === 'string' || item.birthday === null) &&
    (typeof item.address === 'string' || item.address === null) &&
    (typeof item.identityNo === 'string' || item.identityNo === null) &&
    (typeof item.mobile === 'string' || item.mobile === null) &&
    (isCustomerType(item.customerType) || item.customerType === null) &&
    (typeof item.status === 'number' || item.status === null) &&
    (typeof item.version === 'number' || item.version === null) &&
    (typeof item.createDatetime === 'string' || item.createDatetime === null) &&
    (typeof item.updateDatetime === 'string' || item.updateDatetime === null)
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

function assertSuccess(response: unknown): asserts response is ApiSuccess<unknown> {
  if (
    typeof response !== 'object' ||
    response === null ||
    (response as Partial<ApiSuccess<unknown>>).code !== 'SUCCESS'
  ) {
    throw new HttpError('The server returned an invalid response.', 200)
  }
}

function assertCustomer(response: ApiSuccess<unknown>): asserts response is ApiSuccess<Customer> {
  if (!isCustomer(response.result)) {
    throw new HttpError('The server returned invalid customer data.', 200)
  }
}

function hasFilters(filters: CustomerSearchFilters) {
  return (
    Boolean(filters.name) ||
    Boolean(filters.identityNo) ||
    Boolean(filters.mobile) ||
    Boolean(filters.customerType) ||
    filters.status !== undefined
  )
}

export async function getCustomers(
  page: number,
  size: number,
  filters: CustomerSearchFilters,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))
  if (hasFilters(filters)) {
    if (filters.name) params.set('name', filters.name)
    if (filters.identityNo) params.set('identityNo', filters.identityNo)
    if (filters.mobile) params.set('mobile', filters.mobile)
    if (filters.customerType) params.set('customerType', filters.customerType)
    if (filters.status !== undefined) params.set('status', String(filters.status))
  }

  const path = `${hasFilters(filters) ? '/customers/search' : '/customers'}?${params.toString()}`
  const response = await request<unknown>(path, { authenticated: true, signal })
  assertSuccess(response)
  if (!isPage(response.result)) {
    throw new HttpError('The server returned invalid customer data.', 200)
  }
  return response.result
}

export async function getCustomer(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/customers/${id}`, { authenticated: true, signal })
  assertSuccess(response)
  assertCustomer(response)
  return response.result
}

export async function createCustomer(data: CustomerCreateRequest, signal?: AbortSignal) {
  const response = await request<unknown>('/customers', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(data),
    signal,
  })
  assertSuccess(response)
  assertCustomer(response)
  return response.result
}

export async function updateCustomer(id: number, data: CustomerUpdateRequest, signal?: AbortSignal) {
  const response = await request<unknown>(`/customers/${id}`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify(data),
    signal,
  })
  assertSuccess(response)
  assertCustomer(response)
  return response.result
}

export async function updateCustomerStatus(id: number, status: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/customers/${id}/status`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify({ status }),
    signal,
  })
  assertSuccess(response)
  assertCustomer(response)
  return response.result
}

export async function deleteCustomer(id: number, signal?: AbortSignal) {
  await request<unknown>(`/customers/${id}`, {
    method: 'DELETE',
    authenticated: true,
    signal,
  })
}

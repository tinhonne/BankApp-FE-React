export type Role = 'EMPLOYEE' | 'MANAGER' | 'ADMIN'

export type LoginRequest = {
  username: string
  password: string
}

export type AuthenticationResult = {
  token: string
  authenticated: boolean
  mustChangePassword: boolean
}

export type ApiSuccess<T> = {
  code: string
  message: string
  result: T
}

export type ApiErrorBody = {
  code?: string
  message?: string
  result?: null
}

export type PageResponse<T> = {
  content: T[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE'

export type Customer = {
  id: number | null
  name: string | null
  birthday: string | null
  address: string | null
  identityNo: string | null
  mobile: string | null
  customerType: CustomerType | null
  status: number | null
  version: number | null
  createDatetime: string | null
  updateDatetime: string | null
}

export type CustomerCreateRequest = {
  name: string
  birthday: string
  address: string
  identityNo: string
  mobile?: string
  customerType: CustomerType
  status: number
}

export type CustomerUpdateRequest = {
  name: string
  birthday: string
  address: string
  mobile?: string
  customerType: CustomerType
  version: number
}

export type CustomerSearchFilters = {
  name?: string
  identityNo?: string
  mobile?: string
  customerType?: CustomerType
  status?: number
}

export type Account = {
  id: number | null
  customerName: string | null
  accountNumber: string | null
  balance: number | null
  status: number | null
}

export type User = {
  id: number | null
  username: string | null
  name: string | null
  enabled: boolean
  mustChangePassword: boolean
  roles: Role[]
}

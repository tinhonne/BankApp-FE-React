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
  customerId: number | null
  customerName: string | null
  accountNumber: string | null
  balance: number | null
  status: number | null
  createDatetime: string | null
  updateDatetime: string | null
}

export type AccountCreateRequest = {
  accountNumber: string
  customerId: number
  balance: number
}

export type TransactionStatus = 'SUCCESS' | 'INSUFFICIENT_BALANCE' | 'SYSTEM_ERROR'

export type Transaction = {
  id: number | null
  transactionDate: string | null
  fromAccountNumber: string | null
  toAccountNumber: string | null
  amount: number | null
  status: TransactionStatus | null
  content: string | null
  errorReason: string | null
}

export type TransferRequest = {
  fromAccountNumber: string
  toAccountNumber: string
  amount: number
  content?: string
}

export type User = {
  id: number | null
  username: string | null
  name: string | null
  enabled: boolean
  mustChangePassword: boolean
  roles: Role[]
}

export type UserDetail = {
  id: number | null
  username: string | null
  name: string | null
  enabled: boolean
  mustChangePassword: boolean
  roles: Role[]
  permissions: string[]
}

export type UserCreateRequest = {
  username: string
  password: string
  name: string
  roles?: Role[]
}

export type UserUpdateRequest = {
  name?: string
  roles?: Role[]
}

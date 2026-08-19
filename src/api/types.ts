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

export type Customer = {
  id: number | null
  name: string | null
  customerType: 'INDIVIDUAL' | 'CORPORATE' | null
  status: number | null
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

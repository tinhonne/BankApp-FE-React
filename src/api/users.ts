import { HttpError, request } from './http'
import type { ApiSuccess, Role, User } from './types'

function isRole(value: unknown): value is Role {
  return value === 'EMPLOYEE' || value === 'MANAGER' || value === 'ADMIN'
}

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const user = value as Record<string, unknown>
  return (
    (typeof user.id === 'number' || user.id === null) &&
    (typeof user.username === 'string' || user.username === null) &&
    (typeof user.name === 'string' || user.name === null) &&
    typeof user.enabled === 'boolean' &&
    typeof user.mustChangePassword === 'boolean' &&
    Array.isArray(user.roles) &&
    user.roles.every(isRole)
  )
}

export async function getUsers(signal?: AbortSignal) {
  const response = await request<ApiSuccess<unknown>>('/users', {
    authenticated: true,
    signal,
  })

  if (response.code !== 'SUCCESS' || !Array.isArray(response.result) || !response.result.every(isUser)) {
    throw new HttpError('The server returned invalid user data.', 200)
  }

  return response.result
}

import { HttpError, request } from './http'
import type { ApiSuccess, Role, User, UserCreateRequest, UserDetail, UserUpdateRequest } from './types'

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

function isUserDetail(value: unknown): value is UserDetail {
  if (!isUser(value)) {
    return false
  }

  const detail = value as Record<string, unknown>
  return (
    Array.isArray(detail.permissions) &&
    detail.permissions.every((permission) => typeof permission === 'string')
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

export async function getUsers(signal?: AbortSignal) {
  const response = await request<unknown>('/users', {
    authenticated: true,
    signal,
  })

  assertSuccess(response)
  if (!Array.isArray(response.result) || !response.result.every(isUser)) {
    throw new HttpError('The server returned invalid user data.', 200)
  }

  return response.result
}

export async function getUser(id: number, signal?: AbortSignal) {
  const response = await request<unknown>(`/users/${id}`, { authenticated: true, signal })
  assertSuccess(response)
  if (!isUserDetail(response.result)) {
    throw new HttpError('The server returned invalid user data.', 200)
  }
  return response.result
}

export async function createUser(data: UserCreateRequest, signal?: AbortSignal) {
  const body: Record<string, unknown> = {
    username: data.username,
    password: data.password,
    name: data.name,
  }
  if (data.roles && data.roles.length > 0) {
    body.roles = data.roles
  }
  const response = await request<unknown>('/users', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(body),
    signal,
  })
  assertSuccess(response)
  if (!isUser(response.result)) {
    throw new HttpError('The server returned invalid user data.', 200)
  }
  return response.result
}

export async function updateUser(id: number, data: UserUpdateRequest, signal?: AbortSignal) {
  const body: Record<string, unknown> = {}
  if (data.name !== undefined) {
    body.name = data.name
  }
  if (data.roles !== undefined) {
    body.roles = data.roles
  }
  const response = await request<unknown>(`/users/${id}`, {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify(body),
    signal,
  })
  assertSuccess(response)
  if (!isUser(response.result)) {
    throw new HttpError('The server returned invalid user data.', 200)
  }
  return response.result
}

export async function changePassword(oldPassword: string, newPassword: string, signal?: AbortSignal) {
  const response = await request<unknown>('/users/me/password', {
    method: 'PATCH',
    authenticated: true,
    body: JSON.stringify({ oldPassword, newPassword }),
    signal,
  })

  assertSuccess(response)
}

import { HttpError, request } from './http'
import type { ApiSuccess, AuthenticationResult, LoginRequest } from './types'

function isAuthenticationResponse(value: unknown): value is ApiSuccess<AuthenticationResult> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const response = value as Partial<ApiSuccess<Partial<AuthenticationResult>>>

  return (
    response.code === 'SUCCESS' &&
    typeof response.message === 'string' &&
    typeof response.result === 'object' &&
    response.result !== null &&
    typeof response.result.token === 'string' &&
    response.result.token.length > 0 &&
    response.result.authenticated === true
  )
}

function isSuccessful(response: unknown): response is ApiSuccess<unknown> {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as Partial<ApiSuccess<unknown>>).code === 'SUCCESS'
  )
}

export async function login(credentials: LoginRequest, signal?: AbortSignal) {
  const response = await request<unknown>('/auth/token', {
    method: 'POST',
    body: JSON.stringify(credentials),
    signal,
  })

  if (!isAuthenticationResponse(response)) {
    throw new HttpError('The server returned an invalid response.', 200)
  }

  return response.result
}

export async function logout(token: string, signal?: AbortSignal) {
  const response = await request<unknown>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ token }),
    signal,
  })

  if (!isSuccessful(response)) {
    throw new HttpError('The server returned an invalid response.', 200)
  }
}

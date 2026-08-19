import { getAccessToken } from '../auth/tokenStorage'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

export class HttpError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

type RequestOptions = RequestInit & {
  authenticated?: boolean
}

function buildUrl(path: string) {
  if (!apiBaseUrl) {
    throw new HttpError('The API service is not configured.', 0)
  }

  return `${apiBaseUrl.replace(/\/$/, '')}${path}`
}

function isErrorBody(value: unknown): value is { code?: string; message?: string } {
  return typeof value === 'object' && value !== null
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const { authenticated = false, headers, ...requestOptions } = options
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Content-Type', 'application/json')

  if (authenticated) {
    const token = getAccessToken()
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  let response: Response

  try {
    response = await fetch(buildUrl(path), {
      ...requestOptions,
      headers: requestHeaders,
    })
  } catch (error) {
    if (error instanceof HttpError || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error
    }

    throw new HttpError('Unable to connect to the server. Please try again.', 0)
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    body = undefined
  }

  if (!response.ok) {
    const errorBody = isErrorBody(body) ? body : undefined
    throw new HttpError(
      errorBody?.message ?? 'The server could not process your request.',
      response.status,
      typeof errorBody?.code === 'string' ? errorBody.code : undefined,
    )
  }

  return body as T
}

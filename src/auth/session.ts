import { clearAccessToken, getAccessToken } from './tokenStorage'
import type { Role } from '../api/types'

export type Session = {
  username: string
  roles: Role[]
  expiresAt: number
}

function decodePayload(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (encoded.length % 4)) % 4)
    return JSON.parse(atob(encoded + padding)) as unknown
  } catch {
    return null
  }
}

function isRole(value: unknown): value is Role {
  return value === 'EMPLOYEE' || value === 'MANAGER' || value === 'ADMIN'
}

const ROLE_PREFIX = 'ROLE_'

function parseRoles(scope: unknown): Role[] | null {
  if (typeof scope !== 'string') {
    return null
  }

  if (scope.length === 0) {
    return null
  }

  const roles: Role[] = []
  for (const entry of scope.split(' ')) {
    const name = entry.startsWith(ROLE_PREFIX) ? entry.slice(ROLE_PREFIX.length) : entry
    if (!isRole(name)) {
      return null
    }
    roles.push(name)
  }

  return roles.length > 0 ? roles : null
}

export function getSession(): Session | null {
  const token = getAccessToken()
  if (!token) {
    return null
  }

  const payload = decodePayload(token)
  if (typeof payload !== 'object' || payload === null) {
    clearAccessToken()
    return null
  }

  const claims = payload as Record<string, unknown>
  const roles = parseRoles(claims.scope)
  if (
    typeof claims.sub !== 'string' ||
    claims.sub.length === 0 ||
    roles === null ||
    typeof claims.exp !== 'number' ||
    claims.exp * 1000 <= Date.now()
  ) {
    clearAccessToken()
    return null
  }

  return {
    username: claims.sub,
    roles,
    expiresAt: claims.exp * 1000,
  }
}

export function endSession() {
  clearAccessToken()
}

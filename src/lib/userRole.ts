import type { Role } from '../api/types'

export const ALL_ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'ADMIN']

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
}

const ROLE_BADGES: Record<string, string> = {
  EMPLOYEE: 'badge-role-employee',
  MANAGER: 'badge-role-manager',
  ADMIN: 'badge-role-admin',
}

export function roleLabel(role: string | null) {
  if (role && ROLE_LABELS[role]) {
    return ROLE_LABELS[role]
  }
  return 'Unavailable'
}

export function roleBadge(role: string | null) {
  if (role && ROLE_BADGES[role]) {
    return ROLE_BADGES[role]
  }
  return 'badge-inactive'
}
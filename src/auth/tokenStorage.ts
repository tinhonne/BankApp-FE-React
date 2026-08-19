const TOKEN_KEY = 'bank-app-access-token'
const MUST_CHANGE_PASSWORD_KEY = 'bank-app-must-change-password'

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function getMustChangePassword() {
  return sessionStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true'
}

export function setMustChangePassword(value: boolean) {
  sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(value))
}

export function clearMustChangePassword() {
  sessionStorage.removeItem(MUST_CHANGE_PASSWORD_KEY)
}

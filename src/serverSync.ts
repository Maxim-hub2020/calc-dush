import type { MirrorPricingCatalog } from './mirrorPricing'
import type { PricingCatalog } from './pricing'

const sessionKey = 'shower-calc.server-session.v1'

export type ServerSession = {
  username: string
  access: string
  refresh: string
}

export type ServerCatalogs = {
  shower_catalog: PricingCatalog | Record<string, never>
  mirror_catalog: MirrorPricingCatalog | Record<string, never>
  updated_at: string | null
}

export class ServerSyncError extends Error {
  code: 'auth' | 'forbidden' | 'network' | 'server'

  constructor(code: ServerSyncError['code'], message: string) {
    super(message)
    this.name = 'ServerSyncError'
    this.code = code
  }
}

const apiBase = () => (
  window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:'
    ? 'https://calc.cehcrm.ru/api'
    : '/api'
)

const readResponseMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json() as { detail?: string }
    return payload.detail || fallback
  } catch {
    return fallback
  }
}

export const loadServerSession = (): ServerSession | null => {
  try {
    const value = localStorage.getItem(sessionKey)
    if (!value) return null
    const session = JSON.parse(value) as Partial<ServerSession>
    return session.username && session.access && session.refresh ? session as ServerSession : null
  } catch {
    return null
  }
}

const saveServerSession = (session: ServerSession) => {
  localStorage.setItem(sessionKey, JSON.stringify(session))
}

export const clearServerSession = () => {
  localStorage.removeItem(sessionKey)
}

export const loginToServer = async (username: string, password: string): Promise<ServerSession> => {
  let response: Response
  try {
    response = await fetch(`${apiBase()}/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    })
  } catch {
    throw new ServerSyncError('network', 'Нет связи с сервером')
  }

  if (!response.ok) {
    const message = await readResponseMessage(response, 'Не удалось войти')
    throw new ServerSyncError('auth', response.status === 401 ? 'Неверный логин или пароль' : message)
  }

  let tokens: { access?: string; refresh?: string }
  try {
    tokens = await response.json() as { access?: string; refresh?: string }
  } catch {
    throw new ServerSyncError('server', 'Сервер вернул неверный ответ')
  }
  if (!tokens.access || !tokens.refresh) {
    throw new ServerSyncError('server', 'Сервер не вернул данные для входа')
  }
  const session = { username: username.trim(), access: tokens.access, refresh: tokens.refresh }
  saveServerSession(session)
  return session
}

const refreshAccessToken = async (session: ServerSession): Promise<ServerSession> => {
  let response: Response
  try {
    response = await fetch(`${apiBase()}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
    })
  } catch {
    throw new ServerSyncError('network', 'Нет связи с сервером')
  }

  if (!response.ok) {
    clearServerSession()
    throw new ServerSyncError('auth', 'Сеанс завершён. Войдите снова')
  }

  const tokens = await response.json() as { access: string; refresh?: string }
  const next = { ...session, access: tokens.access, refresh: tokens.refresh || session.refresh }
  saveServerSession(next)
  return next
}

const authenticatedRequest = async (path: string, init: RequestInit = {}) => {
  const session = loadServerSession()
  if (!session) throw new ServerSyncError('auth', 'Войдите в CRM')

  const run = (access: string) => fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${access}`,
    },
  })

  let response: Response
  try {
    response = await run(session.access)
    if (response.status === 401) {
      const refreshed = await refreshAccessToken(session)
      response = await run(refreshed.access)
    }
  } catch (error) {
    if (error instanceof ServerSyncError) throw error
    throw new ServerSyncError('network', 'Нет связи с сервером')
  }

  if (response.status === 401) {
    clearServerSession()
    throw new ServerSyncError('auth', 'Сеанс завершён. Войдите снова')
  }
  if (response.status === 403) {
    throw new ServerSyncError('forbidden', await readResponseMessage(response, 'Недостаточно прав'))
  }
  if (!response.ok) {
    throw new ServerSyncError('server', await readResponseMessage(response, 'Ошибка сервера'))
  }
  return response
}

export const loadServerCatalogs = async (): Promise<ServerCatalogs> => {
  const response = await authenticatedRequest('/calculator-settings/')
  return response.json() as Promise<ServerCatalogs>
}

export const saveServerCatalogs = async (
  showerCatalog: PricingCatalog,
  mirrorCatalog: MirrorPricingCatalog,
): Promise<ServerCatalogs> => {
  const response = await authenticatedRequest('/calculator-settings/', {
    method: 'PATCH',
    body: JSON.stringify({ shower_catalog: showerCatalog, mirror_catalog: mirrorCatalog }),
  })
  return response.json() as Promise<ServerCatalogs>
}

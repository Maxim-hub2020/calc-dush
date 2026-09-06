import type { Quote } from './calculator'
import type { MirrorPricingCatalog } from './mirrorPricing'
import type { PricingCatalog } from './pricing'

const sessionKey = 'shower-calc.server-session.v1'
const quoteOutboxKey = 'shower-calc.quote-outbox.v1'
const quoteOwnerKey = 'shower-calc.quote-owner.v1'

const activeOutboxKey = () => {
  let owner = localStorage.getItem(quoteOwnerKey)
  if (!owner) {
    const session = loadServerSession()
    owner = session ? `user:${session.username.toLocaleLowerCase()}` : 'unassigned'
    localStorage.setItem(quoteOwnerKey, owner)
  }
  const key = `${quoteOutboxKey}:${owner}`
  const legacy = localStorage.getItem(quoteOutboxKey)
  if (legacy && !localStorage.getItem(key)) {
    localStorage.setItem(key, legacy)
    localStorage.removeItem(quoteOutboxKey)
  }
  return key
}

const bindQuoteOwner = (identity: CrmIdentity) => {
  const previousKey = activeOutboxKey()
  const owner = localStorage.getItem(quoteOwnerKey)
  const nextOwner = `company:${identity.workspace.id}`
  const nextKey = `${quoteOutboxKey}:${nextOwner}`
  // Only adopt first-time local drafts or the authenticated legacy user's queue.
  // A different company's pending changes stay in that company's queue.
  if (owner === 'unassigned' || owner === `user:${identity.username.toLocaleLowerCase()}`) {
    const previous = loadQuoteSyncOutbox()
    localStorage.setItem(quoteOwnerKey, nextOwner)
    const next = loadQuoteSyncOutbox()
    const byId = new Map(next.upserts.map((quote) => [quote.id, quote]))
    previous.upserts.forEach((quote) => {
      const existing = byId.get(quote.id)
      if (!existing || quoteVersion(quote) >= quoteVersion(existing)) byId.set(quote.id, quote)
    })
    const deletions = [...new Set([...next.deletions, ...previous.deletions])]
    saveQuoteSyncOutbox({ upserts: [...byId.values()].filter((quote) => !deletions.includes(quote.id)), deletions })
    if (previousKey !== nextKey) localStorage.removeItem(previousKey)
  } else {
    localStorage.setItem(quoteOwnerKey, nextOwner)
  }
}

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

export type ServerQuoteArchive = {
  quotes: Quote[]
}

export type QuoteSyncOutbox = {
  upserts: Quote[]
  deletions: string[]
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
  activeOutboxKey()
  localStorage.removeItem(sessionKey)
}

const emptyQuoteOutbox = (): QuoteSyncOutbox => ({ upserts: [], deletions: [] })

export const loadQuoteSyncOutbox = (): QuoteSyncOutbox => {
  try {
    const value = localStorage.getItem(activeOutboxKey())
    if (!value) return emptyQuoteOutbox()
    const parsed = JSON.parse(value) as Partial<QuoteSyncOutbox>
    return {
      upserts: Array.isArray(parsed.upserts) ? parsed.upserts : [],
      deletions: Array.isArray(parsed.deletions) ? parsed.deletions.filter((id): id is string => typeof id === 'string') : [],
    }
  } catch {
    return emptyQuoteOutbox()
  }
}

const saveQuoteSyncOutbox = (outbox: QuoteSyncOutbox) => {
  if (outbox.upserts.length === 0 && outbox.deletions.length === 0) {
    localStorage.removeItem(activeOutboxKey())
    return
  }
  localStorage.setItem(activeOutboxKey(), JSON.stringify(outbox))
}

export const queueServerQuoteUpserts = (quotes: Quote[]) => {
  const outbox = loadQuoteSyncOutbox()
  const byId = new Map(outbox.upserts.map((quote) => [quote.id, quote]))
  quotes.forEach((quote) => byId.set(quote.id, quote))
  const upsertIds = new Set(quotes.map((quote) => quote.id))
  saveQuoteSyncOutbox({
    upserts: [...byId.values()],
    deletions: outbox.deletions.filter((id) => !upsertIds.has(id)),
  })
}

export const queueServerQuoteDeletion = (quoteId: string) => {
  const outbox = loadQuoteSyncOutbox()
  saveQuoteSyncOutbox({
    upserts: outbox.upserts.filter((quote) => quote.id !== quoteId),
    deletions: [...new Set([...outbox.deletions, quoteId])],
  })
}

const quoteVersion = (quote: Quote) => quote.updatedAt || quote.createdAt

const clearProcessedQuoteOutbox = (processed: QuoteSyncOutbox) => {
  const current = loadQuoteSyncOutbox()
  const processedUpserts = new Map(processed.upserts.map((quote) => [quote.id, quoteVersion(quote)]))
  const processedDeletions = new Set(processed.deletions)
  saveQuoteSyncOutbox({
    upserts: current.upserts.filter((quote) => processedUpserts.get(quote.id) !== quoteVersion(quote)),
    deletions: current.deletions.filter((id) => !processedDeletions.has(id)),
  })
}

export const mergeServerQuoteArchive = (serverQuotes: Quote[], outbox = loadQuoteSyncOutbox()) => {
  const byId = new Map(serverQuotes.map((quote) => [quote.id, quote]))
  outbox.deletions.forEach((id) => byId.delete(id))
  outbox.upserts.forEach((quote) => byId.set(quote.id, quote))
  return [...byId.values()]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export const loginToServer = async (username: string, password: string): Promise<ServerSession> => {
  activeOutboxKey()
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
  const profile = await fetch(`${apiBase()}/me/`, { headers: { Authorization: `Bearer ${tokens.access}` }, cache: 'no-store' })
  if (!profile.ok) throw new ServerSyncError('server', 'Не удалось проверить компанию CRM')
  const identity = await profile.json() as CrmIdentity
  if (!identity.workspace?.id || !identity.is_admin) throw new ServerSyncError('forbidden', 'Войдите как администратор своей компании CRM')
  bindQuoteOwner(identity)
  const session = { username: identity.username, access: tokens.access, refresh: tokens.refresh }
  saveServerSession(session)
  return session
}

const requestRefreshedSession = async (session: ServerSession): Promise<ServerSession> => {
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
    if (loadServerSession()?.refresh !== session.refresh) throw new ServerSyncError('server', 'Учётная запись изменена. Повторите синхронизацию.')
    clearServerSession()
    throw new ServerSyncError('auth', 'Сеанс завершён. Войдите снова')
  }

  const tokens = await response.json() as { access: string; refresh?: string }
  if (loadServerSession()?.refresh !== session.refresh) throw new ServerSyncError('server', 'Учётная запись изменена. Повторите синхронизацию.')
  const next = { ...session, access: tokens.access, refresh: tokens.refresh || session.refresh }
  saveServerSession(next)
  return next
}

let pendingRefresh: { token: string; promise: Promise<ServerSession> } | null = null
const refreshAccessToken = (session: ServerSession): Promise<ServerSession> => {
  if (pendingRefresh?.token === session.refresh) return pendingRefresh.promise
  const promise = requestRefreshedSession(session).finally(() => {
    if (pendingRefresh?.promise === promise) pendingRefresh = null
  })
  pendingRefresh = { token: session.refresh, promise }
  return promise
}

const authenticatedRequest = async (path: string, init: RequestInit = {}) => {
  const session = loadServerSession()
  if (!session) throw new ServerSyncError('auth', 'Войдите в CRM')

  const run = (access: string) => {
    const isFormData = init.body instanceof FormData
    return fetch(`${apiBase()}${path}`, {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
        Authorization: `Bearer ${access}`,
      },
    })
  }

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

  if (loadServerSession()?.username !== session.username) {
    throw new ServerSyncError('server', 'Учётная запись изменена. Повторите синхронизацию.')
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

export type CrmIdentity = {
  id: number
  username: string
  is_admin: boolean
  workspace: { id: number; name: string; slug: string }
}

export const loadCrmIdentity = async (): Promise<CrmIdentity> => {
  const username = loadServerSession()?.username
  const response = await authenticatedRequest('/me/')
  const identity = await response.json() as CrmIdentity
  if (loadServerSession()?.username !== username) throw new ServerSyncError('server', 'Учётная запись изменена. Повторите синхронизацию.')
  if (!identity.workspace?.id) throw new ServerSyncError('server', 'В CRM не определена компания')
  bindQuoteOwner(identity)
  return identity
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

export const loadServerQuotes = async (): Promise<ServerQuoteArchive> => {
  const response = await authenticatedRequest('/calculator-quotes/')
  return response.json() as Promise<ServerQuoteArchive>
}

export const syncServerQuotes = async (quotes: Quote[]): Promise<ServerQuoteArchive> => {
  const response = await authenticatedRequest('/calculator-quotes/', {
    method: 'POST',
    body: JSON.stringify({ quotes }),
  })
  return response.json() as Promise<ServerQuoteArchive>
}

export const deleteServerQuote = async (quoteId: string) => {
  await authenticatedRequest(`/calculator-quotes/${encodeURIComponent(quoteId)}/`, {
    method: 'DELETE',
  })
}

export const synchronizeServerQuotes = async (): Promise<ServerQuoteArchive> => {
  await loadCrmIdentity()
  const owner = activeOutboxKey()
  const assertOwner = () => {
    if (owner !== activeOutboxKey() || !loadServerSession()) throw new ServerSyncError('server', 'Компания изменена. Повторите синхронизацию.')
  }
  const processed = loadQuoteSyncOutbox()
  for (const quoteId of processed.deletions) {
    assertOwner()
    await deleteServerQuote(quoteId)
  }
  assertOwner()
  const remote = processed.upserts.length > 0
    ? await syncServerQuotes(processed.upserts)
    : await loadServerQuotes()
  assertOwner()
  clearProcessedQuoteOutbox(processed)
  return remote
}

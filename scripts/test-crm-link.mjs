import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}
globalThis.window = { location: { protocol: 'https:' } }
const accounts = {
  alice: { id: 1, username: 'alice', is_admin: true, workspace: { id: 10, name: 'Company A' } },
  bob: { id: 2, username: 'bob', is_admin: true, workspace: { id: 20, name: 'Company B' } },
}
const uploads = []
let switchOnUpload = null
let refreshCount = 0
globalThis.fetch = async (url, options = {}) => {
  if (url.endsWith('/auth/token/refresh/')) {
    refreshCount += 1
    await new Promise((resolve) => setTimeout(resolve, 10))
    return Response.json({ access: 'alice', refresh: 'rotated-alice' })
  }
  if (url.endsWith('/auth/token/')) {
    const { username, password } = JSON.parse(options.body)
    if (!accounts[username] || password !== 'test') return Response.json({}, { status: 401 })
    return Response.json({ access: username, refresh: `refresh-${username}` })
  }
  const username = options.headers.Authorization?.replace('Bearer ', '')
  if (url.endsWith('/me/')) return accounts[username] ? Response.json(accounts[username]) : Response.json({}, { status: 401 })
  if (url.endsWith('/calculator-quotes/')) {
    if (options.method === 'POST') {
      uploads.push({ username, quotes: JSON.parse(options.body).quotes })
      if (switchOnUpload) await switchOnUpload()
    }
    return Response.json({ quotes: [] })
  }
  throw new Error(`Unexpected request: ${url}`)
}
const source = readFileSync(new URL('../src/serverSync.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const sync = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const quote = (id) => ({ id, createdAt: '2026-09-06T10:00:00Z' })

// Existing installations: adopt the old queue only for its verified account.
storage.set('shower-calc.server-session.v1', JSON.stringify({ username: 'alice', access: 'alice', refresh: 'refresh-alice' }))
storage.set('shower-calc.quote-outbox.v1', JSON.stringify({ upserts: [quote('legacy-A')], deletions: [] }))
assert.equal((await sync.loadCrmIdentity()).workspace.id, 10)
assert.equal(sync.loadQuoteSyncOutbox().upserts[0].id, 'legacy-A')
await sync.synchronizeServerQuotes()
assert.equal(uploads[0].username, 'alice')
assert.equal(uploads[0].quotes[0].id, 'legacy-A')

// Pending A quotes must not be uploaded to B when switching accounts.
sync.queueServerQuoteUpserts([quote('pending-A')])
sync.clearServerSession()
await sync.loginToServer('bob', 'test')
assert.deepEqual(sync.loadQuoteSyncOutbox(), { upserts: [], deletions: [] })
sync.queueServerQuoteUpserts([quote('pending-B')])
await sync.synchronizeServerQuotes()
assert.equal(uploads.at(-1).username, 'bob')
assert.deepEqual(uploads.at(-1).quotes.map((item) => item.id), ['pending-B'])
sync.clearServerSession()
await sync.loginToServer('alice', 'test')
assert.equal(sync.loadQuoteSyncOutbox().upserts[0].id, 'pending-A')

// Do not publish an old response or clear another company's queue mid-flight.
switchOnUpload = async () => {
  switchOnUpload = null
  await sync.loginToServer('bob', 'test')
  sync.queueServerQuoteUpserts([quote('new-B')])
}
await assert.rejects(sync.synchronizeServerQuotes(), /изменена/)
assert.equal(sync.loadQuoteSyncOutbox().upserts[0].id, 'new-B')
await assert.rejects(sync.loginToServer('bob', 'wrong'), /Неверный логин/)
assert.equal(sync.loadServerSession().username, 'bob')
storage.set('shower-calc.server-session.v1', JSON.stringify({ username: 'alice', access: 'expired', refresh: 'refresh-alice' }))
await Promise.all([sync.loadCrmIdentity(), sync.loadCrmIdentity()])
assert.equal(refreshCount, 1)
assert.equal(sync.loadServerSession().refresh, 'rotated-alice')
console.log('PASS: identity, legacy migration, company-isolated queues, account switching, in-flight switch, invalid login, shared token refresh')

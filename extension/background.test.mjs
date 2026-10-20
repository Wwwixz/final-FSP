import test from 'node:test'
import assert from 'node:assert/strict'
const listeners = {}
const storage = {}
const events = []
let rejectWrite = false
const event = name => ({ addListener(fn) { listeners[name] = fn }, removeListener() {} })
globalThis.chrome = {
  runtime: { id: 'test-extension', onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message') },
  storage: { local: {
    async get(key) { return { [key]: structuredClone(storage[key]) } },
    async set(values) { if (rejectWrite) throw new Error('QUOTA_BYTES exceeded'); Object.assign(storage, structuredClone(values)); events.push('stored') },
    async remove(key) { delete storage[key] },
  } },
  contextMenus: { async removeAll() {}, create(item) { events.push(item) }, onClicked: event('clicked') },
  action: { async openPopup() { events.push('popup') }, async setBadgeText(value) { events.push(value) }, async setBadgeBackgroundColor() {}, async setTitle() {} },
}
await import('./background.ts')
const send = message => new Promise(resolve => listeners.message(message, { id: 'test-extension' }, resolve))
test('context menu opens popup synchronously, persists exact selection and safely acknowledges only matching intent', async () => {
  listeners.installed()
  await send({ type: 'intent-read' })
  assert.ok(events.some(item => item?.contexts?.includes('selection')))
  events.length = 0
  listeners.clicked({ menuItemId: 'find-selected-news', selectionText: '  Новость о дорогах\nКрасноярска  ', pageUrl: 'https://example.org/news' })
  assert.equal(events[0], 'popup')
  const first = await send({ type: 'intent-read' })
  assert.equal(first.intent.text, 'Новость о дорогах\nКрасноярска')
  listeners.clicked({ menuItemId: 'find-selected-news', selectionText: 'Другая новость' })
  await send({ type: 'intent-ack', id: first.intent.id })
  const second = await send({ type: 'intent-read' })
  assert.equal(second.intent.text, 'Другая новость')
  await send({ type: 'intent-ack', id: second.intent.id })
  assert.equal((await send({ type: 'intent-read' })).intent, null)
})
test('simultaneous writes from popup do not overwrite each other and quota failure preserves stored data', async () => {
  const results = await Promise.all(['A', 'B', 'C'].map(name => send({ type: 'library-change', command: { type: 'folder-create', name } })))
  assert.ok(results.every(reply => reply.ok))
  const before = (await send({ type: 'library-read' })).library
  assert.equal(before.folders.length, 4)
  rejectWrite = true
  assert.equal((await send({ type: 'library-change', command: { type: 'folder-create', name: 'Failed' } })).ok, false)
  rejectWrite = false
  assert.deepEqual((await send({ type: 'library-read' })).library, before)
  assert.equal((await send({ type: 'library-change', command: { type: 'folder-create', name: 'After failure' } })).ok, true)
})

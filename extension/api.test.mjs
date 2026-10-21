import test from 'node:test'
import assert from 'node:assert/strict'
import { allSearchPublications, api, waitForSearch } from '../src/api.ts'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const publication = id => ({ id, sourceId: 1, sourceName: 'Источник', platform: 'VK', url: `https://example.org/${id}`, title: String(id), excerpt: '', publishedAt: null, hasDate: false, relevance: 0, aiRelevance: null, aiComment: null, likes: null, reposts: null, views: null, foundAt: '' })

test('allSearchPublications requests every page and keeps page order', async () => {
  const requested = []
  globalThis.fetch = async url => {
    const page = Number(new URL(url).searchParams.get('page'))
    requested.push(page)
    const body = { content: [publication(page)], totalPages: 3 }
    return { ok: true, status: 200, async text() { return JSON.stringify(body) } }
  }
  try {
    const result = await allSearchPublications(42, 1)
    assert.deepEqual(result.map(item => item.id), [0, 1, 2])
    assert.deepEqual(requested.sort(), [0, 1, 2])
  } finally { globalThis.fetch = originalFetch }
})

test('waitForSearch removes the abort listener after every completed poll', async () => {
  const originalSearch = api.search
  const originalSetTimeout = globalThis.setTimeout
  const signal = new AbortController().signal
  const added = []; const removed = []
  const add = signal.addEventListener.bind(signal); const remove = signal.removeEventListener.bind(signal)
  signal.addEventListener = (type, listener, options) => { if (type === 'abort') added.push(listener); return add(type, listener, options) }
  signal.removeEventListener = (type, listener, options) => { if (type === 'abort') removed.push(listener); return remove(type, listener, options) }
  let checks = 0
  api.search = async () => ({ status: ++checks < 3 ? 'RUNNING' : 'COMPLETED' })
  globalThis.window = { setTimeout: (callback, delay) => originalSetTimeout(callback, delay === 1000 ? 0 : delay), clearTimeout }
  try {
    const result = await waitForSearch(9, signal)
    assert.equal(result.status, 'COMPLETED')
    assert.equal(added.length, 2)
    assert.deepEqual(removed, added)
  } finally { api.search = originalSearch; globalThis.window = originalWindow }
})

test('waitForSearch aborts a pending poll promptly', async () => {
  const originalSearch = api.search
  const controller = new AbortController()
  api.search = async () => ({ status: 'RUNNING' })
  globalThis.window = {
    setTimeout: callback => setTimeout(() => { controller.abort(); callback() }, 0),
    clearTimeout,
  }
  try { await assert.rejects(waitForSearch(9, controller.signal), { name: 'AbortError' }) }
  finally { api.search = originalSearch; globalThis.window = originalWindow }
})

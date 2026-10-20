import test from 'node:test'
import assert from 'node:assert/strict'
import { initialNavigation, navigate, parseSession, RequestGate, withTimeout } from './state.ts'

test('search tab always returns to the form from results and other sections', () => {
  let state = navigate(initialNavigation, { type: 'results' })
  state = navigate(state, { type: 'tab', section: 'history' })
  state = navigate(state, { type: 'tab', section: 'search' })
  assert.deepEqual(state, { section: 'search', view: 'form' })
  assert.deepEqual(navigate(navigate(initialNavigation, { type: 'results' }), { type: 'tab', section: 'search' }), initialNavigation)
})

test('old saved results screen cannot hide search on popup startup', () => {
  const restored = parseSession(JSON.stringify({ section: 'settings', searchView: 'results', query: 'Дорожная безопасность', platforms: ['VK'], selectedIds: [1] }))
  assert.equal(restored.query, 'Дорожная безопасность')
  assert.equal(restored.searchView, undefined)
  assert.equal(restored.section, undefined)
  assert.equal(initialNavigation.view, 'form')
})

test('damaged browser storage cannot create an invalid form or navigation', () => {
  for (const raw of ['bad json', 'null', '[]', 'true']) assert.deepEqual(parseSession(raw), {})
  const data = parseSession(JSON.stringify({ query: {}, searchType: 'BROKEN', selectedIds: [2, 2, -1, null, '3'], platforms: ['VK', 'VK', 'BAD'], dateFrom: '2026-02-30', search: { id: 'x' } }))
  assert.equal(data.query, undefined)
  assert.equal(data.searchType, undefined)
  assert.deepEqual(data.selectedIds, [2])
  assert.deepEqual(data.platforms, ['VK'])
  assert.equal(data.dateFrom, undefined)
  assert.equal(data.search, undefined)
})

test('an intentionally empty source selection survives reopening', () => {
  const data = parseSession(JSON.stringify({ selectedIds: [], sourceSelectionReady: true, platforms: [] }))
  assert.deepEqual(data.selectedIds, [])
  assert.equal(data.sourceSelectionReady, true)
  assert.deepEqual(data.platforms, [])
})

test('late response cannot overwrite a newer search or release its busy state', async () => {
  const gate = new RequestGate()
  const old = gate.begin()
  const next = gate.begin()
  assert.equal(old.signal.aborted, true)
  assert.equal(gate.current(old.token), false)
  assert.equal(gate.finish(old.token), false)
  assert.equal(gate.busy, true)
  assert.equal(gate.current(next.token), true)
  assert.equal(gate.finish(next.token), true)
  assert.equal(gate.busy, false)
  assert.equal(next.signal.aborted, true)
})

test('cancelled waiting releases the UI even when the underlying request hangs', async () => {
  const controller = new AbortController()
  const request = withTimeout(new Promise(() => {}), { signal: controller.signal })
  controller.abort()
  await assert.rejects(request, { name: 'AbortError' })
})

test('unavailable service times out rather than leaving a permanent spinner', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), { timeoutMs: 10 }), /не ответил вовремя/)
})

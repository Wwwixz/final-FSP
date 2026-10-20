import test from 'node:test'
import assert from 'node:assert/strict'
import { changeLibrary, emptyLibrary, publicationKey, readLibrary, collectionCsv, INBOX } from './library.ts'
const publication = { id: 10, sourceId: 1, sourceName: 'Источник', platform: 'VK', url: 'https://example.org/post/1', title: 'Новость', excerpt: 'Выдержка', hasDate: false, publishedAt: null, relevance: 1, aiRelevance: null, aiComment: null, likes: null, reposts: null, views: null, foundAt: '2026-10-21' }
const save = (data, publications = [publication], folderId = INBOX) => changeLibrary(data, { type: 'save', folderId, publications }, 'item')
test('same publication saved repeatedly retains notes and flags; another source remains separate', () => {
  let data = save(emptyLibrary())
  data = changeLibrary(data, { type: 'edit', id: data.items[0].id, patch: { note: 'Проверить цитату', checked: true, important: true, inReport: true } })
  data = save(data, [{ ...publication, url: publication.url + '?utm_source=news#section' }, { ...publication, sourceId: 2 }])
  assert.equal(data.items.length, 2)
  assert.equal(data.items[0].note, 'Проверить цитату')
  assert.equal(data.items[0].inReport, true)
  assert.notEqual(publicationKey(data.items[0].publication), publicationKey(data.items[1].publication))
})
test('moving, deleting folder, trash and restore never lose notes or flags', () => {
  let data = changeLibrary(emptyLibrary(), { type: 'folder-create', name: 'Дороги' }, 'roads')
  data = save(data, [publication], 'roads')
  const id = data.items[0].id
  data = changeLibrary(data, { type: 'edit', id, patch: { note: 'Заметка', important: true } })
  data = changeLibrary(data, { type: 'trash', id })
  data = changeLibrary(data, { type: 'folder-delete', id: 'roads' })
  data = changeLibrary(data, { type: 'restore', id })
  assert.equal(data.items[0].folderId, INBOX)
  assert.equal(data.items[0].note, 'Заметка')
  assert.equal(data.items[0].important, true)
  assert.equal(data.items[0].deletedAt, null)
})
test('saving a trashed publication restores its original notes instead of making a duplicate', () => {
  let data = save(emptyLibrary())
  const id = data.items[0].id
  data = changeLibrary(data, { type: 'edit', id, patch: { note: 'Не потерять' } })
  data = changeLibrary(data, { type: 'trash', id })
  data = save(data)
  assert.equal(data.items.length, 1)
  assert.equal(data.items[0].deletedAt, null)
  assert.equal(data.items[0].note, 'Не потерять')
})
test('invalid changes and corrupt storage fail without mutating the original data', () => {
  const data = save(emptyLibrary()); const before = structuredClone(data)
  assert.throws(() => changeLibrary(data, { type: 'folder-delete', id: INBOX }))
  assert.throws(() => changeLibrary(data, { type: 'edit', id: data.items[0].id, patch: { folderId: 'gone' } }))
  assert.throws(() => changeLibrary(data, { type: 'folder-create', name: 'без папки' }))
  assert.throws(() => save(data, [{ ...publication, url: 'javascript:alert(1)' }]))
  assert.throws(() => readLibrary({ version: 8, items: [] }))
  assert.deepEqual(data, before)
})
test('CSV contains only the passed selection, preserves notes and quotes, marks unknown dates and escapes formulas', () => {
  let data = save(emptyLibrary(), [publication, { ...publication, url: 'https://example.org/post/2', title: 'Excluded' }])
  data = changeLibrary(data, { type: 'edit', id: data.items[0].id, patch: { note: '=HYPERLINK("bad")\nЗаметка', inReport: true } })
  const csv = collectionCsv(data.items.filter(item => item.inReport))
  assert.ok(csv.startsWith('\ufeff'))
  assert.match(csv, /Дата неизвестна/)
  assert.match(csv, /'=HYPERLINK\(""bad""\)/)
  assert.doesNotMatch(csv, /Excluded/)
})

import { extensionAPI as browser, INTENT_KEY } from './bridge.ts'
import type { SelectionIntent } from './bridge.ts'
import { changeLibrary, LIBRARY_KEY, readLibrary } from './library.ts'

// All writes are serialized here, including writes from a closing popup.
let writes: Promise<unknown> = Promise.resolve()
function queue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation)
  writes = result.catch(() => undefined)
  return result
}
const title = 'Краснопарс — медиамониторинг'
async function installMenu() {
  await browser.contextMenus.removeAll()
  browser.contextMenus.create({ id: 'find-selected-news', title: 'Найти эту новость в Краснопарсе', contexts: ['selection'] })
}
browser.runtime.onInstalled.addListener(() => { void installMenu().catch(console.error) })
browser.runtime.onStartup.addListener(() => { void installMenu().catch(console.error) })
browser.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== 'find-selected-news' || !info.selectionText?.trim()) return
  const intent: SelectionIntent = { id: crypto.randomUUID(), text: info.selectionText.trim(), pageUrl: info.pageUrl || '', createdAt: Date.now() }
  void queue(async () => {
    await browser.storage.local.set({ [INTENT_KEY]: intent })
    await browser.action.setBadgeBackgroundColor({ color: '#216d88' })
    await browser.action.setBadgeText({ text: '1' })
    await browser.action.setTitle({ title: 'Выделенная новость готова — откройте Краснопарс' })
  }).catch(console.error)
  // Must happen in the click handler, before an await, to retain Firefox's user gesture.
  try { void browser.action.openPopup().catch(() => { /* The saved selection and badge remain available. */ }) } catch { /* Older Chrome: use the toolbar icon. */ }
})
browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== browser.runtime.id || !message || !['library-read', 'library-change', 'intent-read', 'intent-ack'].includes(message.type)) return
  void queue(async () => {
    if (message.type === 'library-read' || message.type === 'library-change') {
      const stored = await browser.storage.local.get(LIBRARY_KEY)
      let library = readLibrary(stored[LIBRARY_KEY])
      if (message.type === 'library-change') {
        library = changeLibrary(library, message.command)
        await browser.storage.local.set({ [LIBRARY_KEY]: library })
      }
      return { ok: true as const, library }
    }
    const stored = await browser.storage.local.get(INTENT_KEY)
    const intent = stored[INTENT_KEY] as SelectionIntent | undefined
    if (message.type === 'intent-read') return { ok: true as const, intent: intent || null }
    if (intent?.id === message.id) {
      await browser.storage.local.remove(INTENT_KEY)
      await browser.action.setBadgeText({ text: '' })
      await browser.action.setTitle({ title })
    }
    return { ok: true as const }
  }).then(respond, error => respond({ ok: false, error: error instanceof Error ? error.message : 'Не удалось сохранить данные.' }))
  return true
})

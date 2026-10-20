import type { ApiPublication } from '../src/api'

export const LIBRARY_KEY = 'kp-library-v1'
export const INBOX = 'inbox'
export type Folder = { id: string; name: string }
export type SavedPublication = {
  id: string; folderId: string; publication: ApiPublication; searchId?: number;
  note: string; checked: boolean; important: boolean; inReport: boolean;
  savedAt: string; updatedAt: string; deletedAt: string | null;
}
export type Library = { version: 1; folders: Folder[]; items: SavedPublication[] }
export type LibraryCommand =
  | { type: 'folder-create'; name: string }
  | { type: 'folder-rename'; id: string; name: string }
  | { type: 'folder-delete'; id: string }
  | { type: 'save'; folderId: string; publications: ApiPublication[]; searchId?: number }
  | { type: 'edit'; id: string; patch: Partial<Pick<SavedPublication, 'note' | 'checked' | 'important' | 'inReport' | 'folderId'>> }
  | { type: 'trash' | 'restore'; id: string }
export function emptyLibrary(): Library { return { version: 1, folders: [{ id: INBOX, name: 'Без папки' }], items: [] } }
export function publicationKey(item: Pick<ApiPublication, 'url' | 'sourceId'>): string {
  const url = new URL(item.url)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('У публикации должна быть ссылка http или https.')
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  return `${item.sourceId}:${url.href}`
}
export function readLibrary(value: unknown): Library {
  if (value === undefined) return emptyLibrary()
  const data = value as Library
  if (!data || data.version !== 1 || !Array.isArray(data.folders) || !Array.isArray(data.items)
    || !data.folders.some(folder => folder.id === INBOX)
    || data.folders.some(folder => typeof folder.id !== 'string' || typeof folder.name !== 'string')
    || data.items.some(item => !item || typeof item.id !== 'string' || typeof item.note !== 'string' || !item.publication || !data.folders.some(folder => folder.id === item.folderId))) {
    throw new Error('Не удалось прочитать подборки. Данные сохранены; перезагрузите расширение.')
  }
  return data
}
export function changeLibrary(data: Library, command: LibraryCommand, id = crypto.randomUUID(), now = new Date().toISOString()): Library {
  const next = structuredClone(data)
  const folderExists = (folderId: string) => {
    if (!next.folders.some(folder => folder.id === folderId)) throw new Error('Папка больше не существует. Выберите другую.')
  }
  const folderName = (name: string, except?: string) => {
    const clean = name.trim()
    if (!clean || clean.length > 80) throw new Error('Название папки должно содержать от 1 до 80 символов.')
    if (next.folders.some(folder => folder.id !== except && folder.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('Папка с таким названием уже есть.')
    return clean
  }
  switch (command.type) {
    case 'folder-create': next.folders.push({ id, name: folderName(command.name) }); break
    case 'folder-rename': {
      folderExists(command.id)
      if (command.id === INBOX) throw new Error('Системную папку нельзя переименовать.')
      next.folders.find(folder => folder.id === command.id)!.name = folderName(command.name, command.id)
      break
    }
    case 'folder-delete': {
      folderExists(command.id)
      if (command.id === INBOX) throw new Error('Системную папку нельзя удалить.')
      next.folders = next.folders.filter(folder => folder.id !== command.id)
      next.items.forEach(item => { if (item.folderId === command.id) { item.folderId = INBOX; item.updatedAt = now } })
      break
    }
    case 'save': {
      folderExists(command.folderId)
      for (const publication of command.publications) {
        const key = publicationKey(publication)
        const existing = next.items.find(item => publicationKey(item.publication) === key)
        if (existing) {
          // Re-saving preserves notes, flags and the chosen folder of a live item.
          if (existing.deletedAt) { existing.deletedAt = null; existing.folderId = command.folderId; existing.updatedAt = now }
          continue
        }
        next.items.push({ id: `${id}-${next.items.length}`, folderId: command.folderId, publication: structuredClone(publication), searchId: command.searchId,
          note: '', checked: false, important: false, inReport: false, savedAt: now, updatedAt: now, deletedAt: null })
      }
      break
    }
    case 'edit': {
      const item = next.items.find(item => item.id === command.id && !item.deletedAt)
      if (!item) throw new Error('Материал не найден. Обновите подборку.')
      if (command.patch.folderId !== undefined) { folderExists(command.patch.folderId); item.folderId = command.patch.folderId }
      if (command.patch.note !== undefined) {
        if (typeof command.patch.note !== 'string' || command.patch.note.length > 10000) throw new Error('Заметка должна содержать не более 10 000 символов.')
        item.note = command.patch.note
      }
      for (const key of ['checked', 'important', 'inReport'] as const) if (typeof command.patch[key] === 'boolean') item[key] = command.patch[key]!
      item.updatedAt = now
      break
    }
    case 'trash': case 'restore': {
      const item = next.items.find(item => item.id === command.id)
      if (!item) throw new Error('Материал не найден.')
      item.deletedAt = command.type === 'trash' ? now : null; item.updatedAt = now
      break
    }
    default: throw new Error('Неизвестное действие с подборкой.')
  }
  return next
}
export function collectionCsv(items: SavedPublication[]): string {
  const rows: unknown[][] = [['Источник', 'Заголовок', 'Выдержка', 'Дата', 'Ссылка', 'Заметка', 'Проверено', 'Важное', 'В отчёт'],
    ...items.map(item => [item.publication.sourceName, item.publication.title, item.publication.excerpt,
      item.publication.hasDate ? item.publication.publishedAt || 'Дата неизвестна' : 'Дата неизвестна', item.publication.url, item.note,
      item.checked ? 'Да' : 'Нет', item.important ? 'Да' : 'Нет', item.inReport ? 'Да' : 'Нет'])]
  return '\ufeff' + rows.map(row => row.map(value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }).join(';')).join('\r\n')
}

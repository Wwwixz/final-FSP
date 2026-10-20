import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Download, FolderPlus, RotateCcw, Trash2 } from 'lucide-react'
import { extensionAPI, send } from './bridge'
import { INBOX, LIBRARY_KEY, publicationKey } from './library'
import type { Library, LibraryCommand, SavedPublication } from './library'

export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)
  const alive = useRef(true)
  const load = async () => {
    try { const reply = await send({ type: 'library-read' }); if (alive.current) { setLibrary(reply.library!); setError('') } }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить подборки.') }
  }
  useEffect(() => {
    alive.current = true
    void load()
    const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[LIBRARY_KEY]) void load()
    }
    extensionAPI.storage.onChanged.addListener(changed)
    return () => { alive.current = false; extensionAPI.storage.onChanged.removeListener(changed) }
  }, [])
  const change = async (command: LibraryCommand) => {
    setPending(value => value + 1)
    try {
      const reply = await send({ type: 'library-change', command })
      if (alive.current) { setLibrary(reply.library!); setError('') }
      return reply.library!
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : 'Не удалось сохранить изменение.')
      throw reason
    } finally { if (alive.current) setPending(value => value - 1) }
  }
  return { library, error, pending, change, load }
}
export type LibraryStore = ReturnType<typeof useLibrary>
export function SavePublication({ item, folderId, searchId, store, onSaved, onOpen }: {
  item: SavedPublication['publication']; folderId: string; searchId?: number; store: LibraryStore; onSaved: (text: string) => void; onOpen: () => void;
}) {
  const [saving, setSaving] = useState(false)
  let key: string | null = null
  try { key = publicationKey(item) } catch { /* Saving reports the invalid URL without crashing results. */ }
  const saved = key !== null && store.library?.items.some(entry => !entry.deletedAt && publicationKey(entry.publication) === key)
  return <button className="subtle save-publication" disabled={saving || !store.library} onClick={async () => {
    if (saved) { onOpen(); return }
    setSaving(true)
    try { await store.change({ type: 'save', folderId, publications: [item], searchId }); onSaved('Материал сохранён в подборки.') } catch { /* Store shows the error. */ }
    finally { setSaving(false) }
  }}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/>{saving ? 'Сохраняем…' : saved ? 'В подборках' : 'Сохранить'}</button>
}
function SavedCard({ item, store, onChanged }: { item: SavedPublication; store: LibraryStore; onChanged: (text: string) => void }) {
  const [note, setNote] = useState(item.note)
  const [noteStatus, setNoteStatus] = useState('')
  const noteVersion = useRef(0)
  const [working, setWorking] = useState(false)
  const change = async (command: LibraryCommand, message?: string) => {
    setWorking(true)
    try { await store.change(command); if (message) onChanged(message) } catch { /* Store shows the error. */ }
    finally { setWorking(false) }
  }
  const saveNote = async (value: string) => {
    setNote(value)
    const version = ++noteVersion.current
    setNoteStatus('Сохраняем…')
    try { await store.change({ type: 'edit', id: item.id, patch: { note: value } }); if (noteVersion.current === version) setNoteStatus('Сохранено') }
    catch { if (noteVersion.current === version) setNoteStatus('Не сохранено — повторите') }
  }
  return <article className="publication saved-card">
    <div className="publication-meta"><strong>{item.publication.sourceName}</strong><span>{item.publication.hasDate && item.publication.publishedAt ? new Date(item.publication.publishedAt).toLocaleDateString('ru-RU') : 'Дата неизвестна'}</span></div>
    <h3>{item.publication.title || 'Публикация без заголовка'}</h3><p>{item.publication.excerpt || 'Выдержка отсутствует.'}</p>
    <a href={item.publication.url} target="_blank" rel="noreferrer">Открыть публикацию<ArrowUpRight size={15}/></a>
    {item.deletedAt ? <><p className="muted">Заметки и отметки сохранены.</p><button className="subtle" disabled={working} onClick={() => void change({ type: 'restore', id: item.id }, 'Материал восстановлен.')}><RotateCcw size={16}/>Восстановить</button></> : <>
      <div className="item-flags">{([['checked', 'Проверено'], ['important', 'Важное'], ['inReport', 'В отчёт']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={item[key]} disabled={working} onChange={event => void change({ type: 'edit', id: item.id, patch: { [key]: event.target.checked } })}/>{label}</label>)}</div>
      <details className="saved-details"><summary>Заметка и папка{item.note ? ' · есть заметка' : ''}</summary><div>
        <label className="field"><span>Папка</span><select aria-label="Папка материала" value={item.folderId} disabled={working} onChange={event => void change({ type: 'edit', id: item.id, patch: { folderId: event.target.value } }, 'Материал перемещён.')}>{store.library!.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
        <label className="field"><span>Заметка</span><textarea rows={3} maxLength={10000} value={note} onChange={event => void saveNote(event.target.value)} placeholder="Контекст, выводы, что проверить…"/></label>
        <div className="note-status" role="status">{noteStatus || 'Заметка сохраняется автоматически'}{noteStatus.startsWith('Не сохранено') && <button className="subtle" onClick={() => void saveNote(note)}>Повторить</button>}</div>
        <button className="subtle" disabled={working} onClick={() => void change({ type: 'trash', id: item.id }, 'Материал перемещён в корзину.')}><Trash2 size={16}/>В корзину</button>
      </div></details>
    </>}
  </article>
}
export function Collections({ store, onChanged, onExport, exportBusy }: { store: LibraryStore; onChanged: (text: string) => void; onExport: (items: SavedPublication[]) => Promise<void>; exportBusy: boolean }) {
  const [folderId, setFolderId] = useState('all')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<'new' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [removing, setRemoving] = useState(false)
  const [working, setWorking] = useState(false)
  const library = store.library
  const chosen = library?.folders.find(folder => folder.id === folderId)
  const currentFolder = (chosen || ['all', 'trash'].includes(folderId)) ? folderId : 'all'
  const trash = currentFolder === 'trash'
  const items = library?.items.filter(item => Boolean(item.deletedAt) === trash
    && (currentFolder === 'all' || trash || item.folderId === currentFolder)
    && (filter === 'all' || item[filter as 'checked' | 'important' | 'inReport'])
    && `${item.publication.title} ${item.publication.excerpt} ${item.publication.sourceName} ${item.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt)) || []
  const folderAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (working) return
    setWorking(true)
    try {
      const next = await store.change(editing === 'new' ? { type: 'folder-create', name } : { type: 'folder-rename', id: currentFolder, name })
      if (editing === 'new') setFolderId(next.folders.at(-1)!.id)
      setEditing(null); setName(''); onChanged('Папка сохранена.')
    } catch { /* Store shows the error. */ } finally { setWorking(false) }
  }
  return <section className="panel collections">
    <div className="section-title"><div><h2>Подборки</h2><p>Материалы, заметки и отметки</p></div><button className="subtle" disabled={!library} onClick={() => { setEditing('new'); setName(''); setRemoving(false) }} aria-label="Создать папку"><FolderPlus size={18}/></button></div>
    <p className="library-location">Хранятся в этом браузере и доступны без подключения.</p>
    {store.error && <div className="inline-feedback" role="alert"><p>{store.error}</p><button onClick={() => void store.load()}>Повторить загрузку</button></div>}
    {!library ? !store.error && <p className="empty">Загружаем подборки…</p> : <>
      {editing && <form className="source-form" onSubmit={event => void folderAction(event)}><label className="field"><span>{editing === 'new' ? 'Новая папка' : 'Название папки'}</span><input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)}/></label><div><button type="button" disabled={working} onClick={() => setEditing(null)}>Отмена</button><button className="primary" disabled={working}>Сохранить</button></div></form>}
      <label className="field"><span>Папка</span><select value={currentFolder} onChange={event => { setFolderId(event.target.value); setEditing(null); setRemoving(false); setFilter('all') }}><option value="all">Все материалы ({library.items.filter(item => !item.deletedAt).length})</option>{library.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name} ({library.items.filter(item => !item.deletedAt && item.folderId === folder.id).length})</option>)}<option value="trash">Корзина ({library.items.filter(item => item.deletedAt).length})</option></select></label>
      {chosen && chosen.id !== INBOX && <div className="folder-actions"><button className="subtle" onClick={() => { setEditing('rename'); setName(chosen.name); setRemoving(false) }}>Переименовать</button><button className="subtle" onClick={() => setRemoving(true)}>Удалить папку</button></div>}
      {removing && chosen && <div className="inline-feedback"><p>Удалить папку «{chosen.name}»? Материалы переместятся в «Без папки» вместе с заметками.</p><div className="folder-actions"><button disabled={working} onClick={() => setRemoving(false)}>Отмена</button><button disabled={working} onClick={async () => { setWorking(true); try { await store.change({ type: 'folder-delete', id: chosen.id }); setFolderId(INBOX); setRemoving(false); onChanged('Материалы перемещены в «Без папки».') } catch { /* Store shows error. */ } finally { setWorking(false) } }}>Удалить папку</button></div></div>}
      <label className="field"><span>Поиск в подборке</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Заголовок, источник или заметка"/></label>
      <label className="field"><span>Показывать</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Все отметки</option><option value="checked">Проверено</option><option value="important">Важное</option><option value="inReport">В отчёт</option></select></label>
      <div className="collection-summary"><span>Материалов: {items.length}</span>{!trash && <button className="subtle" disabled={!items.length || exportBusy || store.pending > 0} onClick={() => void onExport(items)}><Download size={16}/>{exportBusy ? 'Готовим…' : 'Скачать CSV'}</button>}</div>
      {!trash && <p className="library-location">В файл попадут материалы текущего фильтра с заметками и отметками.</p>}
      {items.map(item => <SavedCard key={item.id} item={item} store={store} onChanged={onChanged}/>)}
      {!items.length && <div className="empty">{query || filter !== 'all' ? 'Материалов с такими условиями нет.' : trash ? 'Корзина пуста.' : 'Здесь пока пусто. Сохраняйте публикации из результатов поиска.'}</div>}
    </>}
  </section>
}

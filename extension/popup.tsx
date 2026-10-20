import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowUpRight, Bookmark, Database, Download, History, Plus, Radio, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { allSearchPublications, api, API_BASE_URL, waitForSearch } from '../src/api'
import type { ApiPublication, ApiSearch, ApiSource, SearchMode, SearchType, SourceSearchStatus } from '../src/api'
import { initialNavigation, isDateInput, localDateInput, navigate, parseSession, RequestGate, withTimeout } from './state'
import type { PopupSession, Section } from './state'
import { Collections, SavePublication, useLibrary } from './Collections'
import { collectionCsv, INBOX } from './library'
import type { SavedPublication } from './library'
import { extensionAPI, INTENT_KEY, send } from './bridge'
import type { SelectionIntent } from './bridge'
import './popup.css'
import './effects.css'

type Platform = ApiSource['platform']
type ExportFormat = 'xlsx' | 'csv' | 'docx'
type Settings = { region: string; format: ExportFormat; includeLinks: boolean; theme: 'system' | 'light' | 'dark'; appearanceVersion: number }
const defaultSettings: Settings = { region: 'Красноярский край', format: 'xlsx', includeLinks: true, theme: 'dark', appearanceVersion: 3 }
function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem('kp-ext-settings') || '{}') as Partial<Settings>
    const theme = stored.appearanceVersion === 3 && ['system', 'light', 'dark'].includes(stored.theme || '') ? stored.theme! : 'dark'
    return {
      ...defaultSettings, theme,
      region: typeof stored.region === 'string' ? stored.region : defaultSettings.region,
      format: ['xlsx', 'csv', 'docx'].includes(stored.format || '') ? stored.format! : defaultSettings.format,
      includeLinks: typeof stored.includeLinks === 'boolean' ? stored.includeLinks : defaultSettings.includeLinks,
    }
  } catch { return defaultSettings }
}
const typeNames: Record<SearchType, string> = { TOPIC: 'Тема', EVENT: 'Событие', PERSON: 'Человек', NEWS_TEXT: 'Текст новости' }
const platformNames: Record<Platform, string> = { VK: 'ВКонтакте', OK: 'Одноклассники', MAX: 'MAX' }
const coolKey = 'krasnopars-extension-export-next'
function countLabel(value: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(value) % 100
  const last = lastTwo % 10
  return `${value} ${lastTwo >= 11 && lastTwo <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many}`
}
const unique = (items: ApiPublication[]) => {
  const seen = new Set<string>()
  return items.filter(item => {
    try {
      const url = new URL(item.url)
      url.hash = ''
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|from$)/i.test(key)) url.searchParams.delete(key)
      const key = `${item.sourceId}:${url.href}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    } catch {
      const key = `${item.sourceId}:${item.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }
  })
}

function Popup() {
  const libraryStore = useLibrary()
  const [saveFolder, setSaveFolder] = useState(INBOX)
  const targetFolder = libraryStore.library?.folders.some(folder => folder.id === saveFolder) ? saveFolder : INBOX
  const [savingAll, setSavingAll] = useState(false)
  const [selectionToRun, setSelectionToRun] = useState<string | null>(null)
  const [selectionSource, setSelectionSource] = useState('')
  const consumedSelections = useRef(new Set<string>())
  const shellRef = useRef<HTMLElement>(null)
  const sourceFormRef = useRef<HTMLFormElement>(null)
  const [session] = useState(() => { try { return parseSession(localStorage.getItem('kp-ext-session')) } catch { return {} as PopupSession } })
  const [{ section, view: searchView }, dispatch] = useReducer(navigate, initialNavigation)
  const gate = useRef(new RequestGate()).current
  const mounted = useRef(true)
  const [sources, setSources] = useState<ApiSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [regions, setRegions] = useState<string[]>(['Красноярский край', 'Красноярск'])
  const [history, setHistory] = useState<ApiSearch[]>([])
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const savedSettings = useRef(settings)
  const [query, setQuery] = useState(session.query || '')
  const [additionalInfo, setAdditionalInfo] = useState(session.additionalInfo || '')
  const [searchType, setSearchType] = useState<SearchType>(session.searchType || 'TOPIC')
  const [mode, setMode] = useState<SearchMode>(session.mode || 'BY_SOURCES')
  const [selectedIds, setSelectedIds] = useState<number[]>(session.selectedIds || [])
  const selectionReady = useRef(session.sourceSelectionReady || false)
  const [sourceSelectionReady, setSourceSelectionReady] = useState(selectionReady.current)
  const [platforms, setPlatforms] = useState<Platform[]>(session.platforms || ['VK', 'OK', 'MAX'])
  const [dateFrom, setDateFrom] = useState(() => session.dateFrom ?? localDateInput(new Date(Date.now() - 30 * 86400000)))
  const [dateTo, setDateTo] = useState(() => session.dateTo ?? localDateInput())
  const [results, setResults] = useState<ApiPublication[]>([])
  const [coverage, setCoverage] = useState<SourceSearchStatus[]>([])
  const [currentSearch, updateCurrentSearch] = useState<ApiSearch | null>(session.search || null)
  const currentSearchRef = useRef(currentSearch)
  const setCurrentSearch = (search: ApiSearch | null) => { currentSearchRef.current = search; updateCurrentSearch(search) }
  const [loadedSearchId, setLoadedSearchId] = useState<number | null>(null)
  const [resultsPhase, setResultsPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [searchError, setSearchError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [successWave, setSuccessWave] = useState<number | null>(null)
  const successSequence = useRef(0)
  const [error, setError] = useState('')
  type SourceDraft = { id?: number; name: string; url: string; platform: Platform; active: boolean }
  const blankSource: SourceDraft = { name: '', url: '', platform: 'VK', active: true }
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(blankSource)
  const [showSourceForm, setShowSourceForm] = useState(false)
  const sourceSaveLock = useRef(false)
  const [sourceSaving, setSourceSaving] = useState(false)
  const sourceLocks = useRef(new Set<number>())
  const [pendingSources, setPendingSources] = useState<number[]>([])
  const [exportBusy, setExportBusy] = useState(false)
  const exportLock = useRef(false)
  const [connectionBusy, setConnectionBusy] = useState(false)
  const connectionLock = useRef(false)
  const pendingDeletes = useRef(new Set<number>())
  const [deletingQueries, setDeletingQueries] = useState<number[]>([])
  const sourcesGeneration = useRef(0)
  const historyGeneration = useRef(0)

  const notifySuccess = (message: string) => { setNotice(message); setSuccessWave(++successSequence.current) }
  const showSearchForm = () => {
    gate.cancel()
    setBusy(false)
    setResultsPhase(current => current === 'loading' ? 'idle' : current)
    setSearchError('')
    dispatch({ type: 'form' })
  }
  const selectSection = (next: Section) => {
    if (next === 'search') showSearchForm()
    else dispatch({ type: 'tab', section: next })
  }
  useEffect(() => () => { mounted.current = false; gate.cancel() }, [gate])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [section, searchView])
  useEffect(() => {
    const snapshot: PopupSession = { query, additionalInfo, searchType, mode, selectedIds, sourceSelectionReady, platforms, dateFrom, dateTo, search: currentSearch }
    try { localStorage.setItem('kp-ext-session', JSON.stringify(snapshot)) } catch { /* Search remains available if browser storage is full. */ }
  }, [query, additionalInfo, searchType, mode, selectedIds, sourceSelectionReady, platforms, dateFrom, dateTo, currentSearch])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (successWave === null) return
    const timer = window.setTimeout(() => setSuccessWave(null), 1700)
    return () => window.clearTimeout(timer)
  }, [successWave])
  useEffect(() => {
    const systemTheme = matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => { document.documentElement.dataset.theme = settings.theme === 'system' ? systemTheme.matches ? 'dark' : 'light' : settings.theme }
    updateTheme()
    systemTheme.addEventListener('change', updateTheme)
    try {
      localStorage.setItem('kp-ext-settings', JSON.stringify(settings))
      if (savedSettings.current !== settings) { savedSettings.current = settings; if (section === 'settings') notifySuccess('Настройки сохранены.') }
    } catch { setError('Браузер не смог сохранить настройки.') }
    return () => systemTheme.removeEventListener('change', updateTheme)
  }, [settings])
  useEffect(() => {
    if (!showSourceForm) return
    sourceFormRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    sourceFormRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [showSourceForm, sourceDraft.id])
  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const ripple = (event: PointerEvent) => {
      if (motion.matches) return
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.primary,.export,.tabs button,.platforms button,.subtle') : null
      if (!button || button.disabled) return
      const rect = button.getBoundingClientRect()
      const diameter = Math.max(rect.width, rect.height) * 2
      const wave = document.createElement('span')
      wave.className = 'interaction-ripple'
      Object.assign(wave.style, { width: `${diameter}px`, height: `${diameter}px`, left: `${event.clientX - rect.left - diameter / 2}px`, top: `${event.clientY - rect.top - diameter / 2}px` })
      button.append(wave)
      wave.animate([{ transform: 'scale(0)', opacity: .22 }, { transform: 'scale(1)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.18,.7,.25,1)' }).onfinish = () => wave.remove()
    }
    shell.addEventListener('pointerdown', ripple)
    return () => shell.removeEventListener('pointerdown', ripple)
  }, [])

  const loadSources = async () => {
    const generation = ++sourcesGeneration.current
    setSourcesLoading(true); setSourcesError('')
    try {
      const items = await withTimeout(api.sources())
      if (!mounted.current || generation !== sourcesGeneration.current) return
      const initialized = selectionReady.current
      setSources(items)
      setSelectedIds(current => initialized ? current.filter(id => items.some(source => source.id === id)) : items.filter(source => source.active).map(source => source.id))
      selectionReady.current = true; setSourceSelectionReady(true)
    } catch (reason) { if (mounted.current && generation === sourcesGeneration.current) setSourcesError(messageOf(reason)) }
    finally { if (mounted.current && generation === sourcesGeneration.current) setSourcesLoading(false) }
  }
  const loadHistory = async (announce = false) => {
    const generation = ++historyGeneration.current
    setHistoryLoading(true); setHistoryError('')
    try {
      const items = await withTimeout(api.searches())
      if (!mounted.current || generation !== historyGeneration.current) return
      setHistory([...items].sort((a, b) => b.id - a.id))
      if (announce) notifySuccess('История обновлена.')
    } catch (reason) { if (mounted.current && generation === historyGeneration.current) setHistoryError(messageOf(reason)) }
    finally { if (mounted.current && generation === historyGeneration.current) setHistoryLoading(false) }
  }
  useEffect(() => {
    void loadSources(); void loadHistory()
    void withTimeout(api.regions()).then(items => { if (mounted.current && items.length) setRegions(items) }).catch(() => undefined)
  }, [])
  useEffect(() => {
    const receive = async (intent?: SelectionIntent | null) => {
      if (!intent || !mounted.current || consumedSelections.current.has(intent.id)) return
      consumedSelections.current.add(intent.id)
      try {
        // Persist first: closing the popup cannot lose the selected text.
        const previous = parseSession(localStorage.getItem('kp-ext-session'))
        localStorage.setItem('kp-ext-session', JSON.stringify({ ...previous, query: intent.text, searchType: 'NEWS_TEXT', additionalInfo: '' }))
        showSearchForm(); setQuery(intent.text); setSearchType('NEWS_TEXT'); setAdditionalInfo('')
        setSelectionSource(/^https?:\/\//i.test(intent.pageUrl) ? intent.pageUrl : '')
        await send({ type: 'intent-ack', id: intent.id })
        if (mounted.current) setSelectionToRun(intent.id)
      } catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    }
    const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[INTENT_KEY]?.newValue) void receive(changes[INTENT_KEY].newValue as SelectionIntent)
    }
    extensionAPI.storage.onChanged.addListener(changed)
    void send({ type: 'intent-read' }).then(reply => receive(reply.intent)).catch(reason => { if (mounted.current) setError(messageOf(reason)) })
    return () => extensionAPI.storage.onChanged.removeListener(changed)
  }, [])
  const activeSources = useMemo(() => sources.filter(source => source.active && platforms.includes(source.platform)), [sources, platforms])
  const regionOptions = [...new Set([settings.region, ...regions])].filter(Boolean)
  const setSourceSelection = (id: number, checked: boolean) => {
    selectionReady.current = true; setSourceSelectionReady(true)
    setSelectedIds(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id))
  }
  const executeSearch = async (existing?: ApiSearch) => {
    if (gate.busy) return
    const { token, signal } = gate.begin()
    let record = existing || null
    setBusy(true); setSearchError(''); setError(''); setNotice(''); setResults([]); setCoverage([]); setLoadedSearchId(null)
    setCurrentSearch(record); setResultsPhase('loading'); dispatch({ type: 'results' })
    try {
      record = existing
        ? await withTimeout(api.search(existing.id), { signal })
        : await withTimeout(api.createSearch({
          query: query.trim(), additionalInfo: additionalInfo.trim() || undefined, searchType, mode,
          ...(mode === 'BY_SOURCES' ? { sourceIds: selectedIds.filter(id => activeSources.some(source => source.id === id)) } : {}),
          dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, region: settings.region || undefined, provider: 'real', useAi: true,
        }), { signal, timeoutMs: 30_000 })
      if (!gate.current(token)) return
      setCurrentSearch(record)
      const completed = record.status === 'RUNNING' ? await withTimeout(waitForSearch(record.id, signal), { signal, timeoutMs: 95_000 }) : record
      if (!gate.current(token)) return
      setCurrentSearch(completed); setCoverage(completed.sources || [])
      const publications = unique(await withTimeout(allSearchPublications(completed.id), { signal, timeoutMs: 40_000 }))
      if (!gate.current(token)) return
      setResults(publications); setLoadedSearchId(completed.id); setResultsPhase('ready')
      setHistory(current => [completed, ...current.filter(item => item.id !== completed.id)])
      if (completed.status === 'FAILED') setSearchError(completed.error || 'Не удалось обработать источники. Доступные материалы сохранены.')
      else if (!existing && completed.status === 'COMPLETED') notifySuccess(`Найдено: ${countLabel(publications.length, 'размещение', 'размещения', 'размещений')}`)
      else if (!existing && completed.status === 'COMPLETED_PARTIAL') setNotice(`Поиск выполнен частично. Найдено размещений: ${publications.length}.`)
    } catch (reason) {
      if (!gate.current(token)) return
      setResultsPhase('error')
      if (!record) { setError(messageOf(reason)); dispatch({ type: 'form' }) }
      else setSearchError(messageOf(reason))
    } finally { if (gate.finish(token) && mounted.current) setBusy(false) }
  }
  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (gate.busy) return
    if (!query.trim()) { setError('Введите запрос для поиска.'); return }
    if (query.trim().length > 2000) { setError('Запрос должен содержать не более 2000 символов.'); return }
    if ((dateFrom && !isDateInput(dateFrom)) || (dateTo && !isDateInput(dateTo)) || (dateFrom && dateTo && dateFrom > dateTo)) { setError('Проверьте период: начало должно быть не позже конца.'); return }
    if (mode === 'BY_SOURCES') {
      if (sourcesLoading) { setError('Дождитесь загрузки источников.'); return }
      if (sourcesError) { setError('Не удалось загрузить источники. Обновите их или выберите поиск по всем активным.'); return }
      if (!activeSources.some(source => selectedIds.includes(source.id))) { setError('Выберите хотя бы один активный источник.'); return }
    }
    await executeSearch()
  }
  useEffect(() => {
    if (!selectionToRun || sourcesLoading) return
    setSelectionToRun(null)
    void runSearch()
  }, [selectionToRun, sourcesLoading])
  const openHistory = (search: ApiSearch) => { void executeSearch(search) }
  const showLastResults = () => {
    if (!currentSearch) return
    if (loadedSearchId === currentSearch.id && resultsPhase === 'ready') dispatch({ type: 'results' })
    else void executeSearch(currentSearch)
  }
  const useSearchConditions = () => {
    if (!currentSearch) return
    const search = currentSearch
    showSearchForm()
    setQuery(search.query); setAdditionalInfo(search.additionalInfo || ''); setSearchType(search.searchType); setMode(search.mode)
    setDateFrom(search.dateFrom || ''); setDateTo(search.dateTo || '')
    setSettings(current => ({ ...current, region: search.region || '' }))
    if (search.mode === 'BY_SOURCES' && search.sources) {
      setSelectedIds(search.sources.map(source => source.sourceId))
      setPlatforms([...new Set(search.sources.map(source => source.platform))])
      selectionReady.current = true; setSourceSelectionReady(true)
    }
  }
  const sourceAction = async (id: number, operation: () => Promise<void>) => {
    if (sourceLocks.current.has(id)) return
    sourceLocks.current.add(id); setPendingSources([...sourceLocks.current]); setError('')
    try { await operation() }
    catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    finally { sourceLocks.current.delete(id); if (mounted.current) setPendingSources([...sourceLocks.current]) }
  }
  const saveSource = async (event: React.FormEvent) => {
    event.preventDefault()
    if (sourceSaveLock.current) return
    const input = { name: sourceDraft.name.trim(), url: sourceDraft.url.trim(), platform: sourceDraft.platform, active: sourceDraft.active }
    if (!input.name || !input.url) { setError('Укажите название и ссылку источника.'); return }
    sourceSaveLock.current = true; setSourceSaving(true); setError('')
    try {
      const saved = await withTimeout(sourceDraft.id ? api.updateSource(sourceDraft.id, input) : api.createSource(input))
      if (!mounted.current) return
      setSources(current => sourceDraft.id ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved])
      if (!sourceDraft.id && saved.active) setSourceSelection(saved.id, true)
      setShowSourceForm(false); setSourceDraft(blankSource); notifySuccess('Источник сохранён.')
    } catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    finally { sourceSaveLock.current = false; if (mounted.current) setSourceSaving(false) }
  }
  const toggleSource = (source: ApiSource) => sourceAction(source.id, async () => {
    const updated = await withTimeout(api.updateSource(source.id, { name: source.name, url: source.url, platform: source.platform, active: !source.active }))
    if (!mounted.current) return
    setSources(current => current.map(item => item.id === updated.id ? updated : item)); notifySuccess(updated.active ? 'Источник включён.' : 'Источник выключен.')
  })
  const deleteSource = (source: ApiSource) => sourceAction(source.id, async () => {
    await withTimeout(api.deleteSource(source.id))
    if (!mounted.current) return
    setSources(current => current.filter(item => item.id !== source.id)); setSelectedIds(current => current.filter(id => id !== source.id)); notifySuccess('Источник удалён.')
    if (sourceDraft.id === source.id) setShowSourceForm(false)
  })
  const removeQuery = async (id: number) => {
    if (pendingDeletes.current.has(id)) return
    pendingDeletes.current.add(id); setDeletingQueries([...pendingDeletes.current]); setError('')
    try {
      await withTimeout(api.deleteSearch(id))
      if (!mounted.current) return
      setHistory(current => current.filter(item => item.id !== id))
      if (currentSearchRef.current?.id === id) { gate.cancel(); setBusy(false); setCurrentSearch(null); setResults([]); setCoverage([]); setLoadedSearchId(null); setResultsPhase('idle'); setSearchError('') }
      notifySuccess('Запрос удалён из истории.')
    } catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    finally { pendingDeletes.current.delete(id); if (mounted.current) setDeletingQueries([...pendingDeletes.current]) }
  }
  const exportReport = async () => {
    if (!currentSearch || loadedSearchId !== currentSearch.id || results.length === 0 || gate.busy || exportLock.current) return
    exportLock.current = true; setExportBusy(true); setError('')
    const reportId = currentSearch.id
    const attempt = async () => {
      const expires = Number(localStorage.getItem(coolKey) || 0)
      if (expires > Date.now()) throw new Error(`Экспорт доступен через ${Math.ceil((expires - Date.now()) / 60000)} мин.`)
      const reserved = String(Date.now() + 20 * 60_000)
      localStorage.setItem(coolKey, reserved)
      try {
        if (settings.format === 'docx') {
          const controller = new AbortController()
          const timer = window.setTimeout(() => controller.abort(), 20_000)
          try {
            const response = await fetch(`${API_BASE_URL}/api/search/${reportId}/export?format=docx`, { signal: controller.signal })
            if (!response.ok) throw new Error(`Ошибка экспорта (${response.status})`)
            const type = response.headers.get('content-type') || ''
            if (type.includes('json') || type.startsWith('text/')) throw new Error('Сервис вернул сообщение вместо файла отчёта.')
            const blob = await response.blob()
            if (!blob.size) throw new Error('Сервис вернул пустой файл отчёта.')
            downloadBlob(blob, `krasnopars-${reportId}.docx`)
          } finally { window.clearTimeout(timer) }
        } else {
          const headers = ['Источник', 'Площадка', 'Заголовок', 'Выдержка', 'Дата публикации', ...(settings.includeLinks ? ['Ссылка'] : []), 'Релевантность']
          const rows = results.map(item => [item.sourceName, platformNames[item.platform], item.title, item.excerpt, item.hasDate && item.publishedAt || 'Дата недоступна', ...(settings.includeLinks ? [item.url] : []), item.aiRelevance ?? item.relevance])
          if (settings.format === 'xlsx') {
            const XLSX = await import('xlsx')
            const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Подборка'); XLSX.writeFile(book, `krasnopars-${reportId}.xlsx`)
          } else {
            const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
            downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `krasnopars-${reportId}.csv`)
          }
        }
      } catch (reason) { if (localStorage.getItem(coolKey) === reserved) localStorage.removeItem(coolKey); throw reason }
    }
    try {
      if ('locks' in navigator) await navigator.locks.request(coolKey, attempt)
      else await attempt()
      if (mounted.current) notifySuccess('Файл отчёта подготовлен.')
    } catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    finally { exportLock.current = false; if (mounted.current) setExportBusy(false) }
  }
  const checkConnection = async () => {
    if (connectionLock.current) return
    connectionLock.current = true; setConnectionBusy(true); setError('')
    try { await withTimeout(api.health()); if (mounted.current) notifySuccess('Соединение установлено.') }
    catch (reason) { if (mounted.current) setError(messageOf(reason)) }
    finally { connectionLock.current = false; if (mounted.current) setConnectionBusy(false) }
  }

  const exportCollection = async (items: SavedPublication[]) => {
    if (!items.length || exportLock.current) return
    exportLock.current = true; setExportBusy(true); setError('')
    const attempt = async () => {
      const expires = Number(localStorage.getItem(coolKey) || 0)
      if (expires > Date.now()) throw new Error(`Экспорт доступен через ${Math.ceil((expires - Date.now()) / 60000)} мин.`)
      downloadBlob(new Blob([collectionCsv(items)], { type: 'text/csv;charset=utf-8' }), `krasnopars-collection-${localDateInput()}.csv`)
      localStorage.setItem(coolKey, String(Date.now() + 20 * 60_000))
    }
    try {
      if ('locks' in navigator) await navigator.locks.request(coolKey, attempt)
      else await attempt()
      notifySuccess('Подборка выгружена с заметками и отметками.')
    } catch (reason) { setError(messageOf(reason)) }
    finally { exportLock.current = false; setExportBusy(false) }
  }
  const saveAllResults = async () => {
    if (savingAll || !results.length) return
    setSavingAll(true)
    try { await libraryStore.change({ type: 'save', folderId: targetFolder, publications: results, searchId: currentSearch?.id }); notifySuccess('Материалы сохранены. Уже сохранённые записи не дублируются.') }
    catch { /* Library error is displayed next to the save controls. */ }
    finally { setSavingAll(false) }
  }

  return <main className="popup-shell" ref={shellRef}>
    <div className="ambient-scene" aria-hidden="true"/>
    <div className="success-wave-stage" aria-hidden="true">{successWave !== null && <span className="success-wave" key={successWave}/>}</div>
    <div className="popup-chrome">
    <header className="topbar"><div className="brand-mark"><img src="./icons/icon-128.png" alt="" width="38" height="38"/></div><div className="brand"><strong>Краснопарс</strong><span>Медиамониторинг</span></div><button className="connection-button" aria-label="Проверить соединение" title="Проверить соединение" disabled={connectionBusy} aria-busy={connectionBusy} onClick={() => void checkConnection()}>{connectionBusy ? <span className="button-spinner"/> : <Radio size={19}/>}</button></header>

    </div>
    <nav className="tabs" aria-label="Разделы">{(['search', 'history', 'collections', 'sources', 'settings'] as Section[]).map(item => <button key={item} aria-current={section === item ? 'page' : undefined} className={section === item ? 'active' : ''} onClick={() => selectSection(item)}>{item === 'search' ? <Search size={19}/> : item === 'history' ? <History size={19}/> : item === 'collections' ? <Bookmark size={19}/> : item === 'sources' ? <Database size={19}/> : <SlidersHorizontal size={19}/>}<span>{({ search: 'Поиск', history: 'История', collections: 'Подборки', sources: 'Источники', settings: 'Настройки' } as Record<Section, string>)[item]}</span></button>)}</nav>
    <div className="feedback-stack" aria-live="polite">
    {error && <div className="message error"><span>{error}</span><button aria-label="Закрыть сообщение об ошибке" onClick={() => setError('')}><X size={17}/></button></div>}
    {notice && <div className="message success"><span>{notice}</span><button aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={17}/></button></div>}
    </div>
    <div className="section-content" key={section}>
    {section === 'search' && <>
      {searchView === 'form' && <form id="search-form" noValidate className="search-form" onSubmit={event => void runSearch(event)}>
        <div className="form-heading"><h1>Поиск публикаций</h1><p>Тема, событие или исходная новость</p></div>{selectionSource && <p className="selection-origin">Текст со страницы: <a href={selectionSource} target="_blank" rel="noreferrer">открыть источник</a></p>}
        {currentSearch && <button type="button" className="subtle last-results" disabled={busy} onClick={showLastResults}><History size={16}/>{currentSearch.status === 'RUNNING' ? 'Открыть текущий поиск' : 'Последняя подборка'}</button>}
        <label className="field"><span>Запрос</span>{searchType === 'NEWS_TEXT' ? <textarea required maxLength={2000} value={query} onChange={event => setQuery(event.target.value)} placeholder="Вставьте исходный текст новости" rows={3}/> : <input maxLength={2000} value={query} onChange={event => setQuery(event.target.value)} placeholder="Тема, событие или человек" required/>}</label>
        <div className="grid-two"><label className="field"><span>Тип запроса</span><select value={searchType} onChange={event => setSearchType(event.target.value as SearchType)}>{Object.entries(typeNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label className="field"><span>Область поиска</span><select value={mode} onChange={event => setMode(event.target.value as SearchMode)}><option value="BY_SOURCES">Выбранные</option><option value="ALL_PLATFORMS">Все активные</option></select></label></div>
        <details className="advanced-filters"><summary>Период и другие фильтры</summary><div className="advanced-filter-fields">
        <label className="field"><span>Уточнение <small>необязательно</small></span><input value={additionalInfo} onChange={event => setAdditionalInfo(event.target.value)} placeholder="Место, дата, отличительные детали"/></label>
        <div className="grid-two"><label className="field"><span>Дата от</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)}/></label><label className="field"><span>Дата до</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)}/></label></div>
        <label className="field"><span>Регион</span><select value={settings.region} onChange={event => setSettings(current => ({ ...current, region: event.target.value }))}><option value="">Все регионы</option>{regionOptions.map(region => <option key={region}>{region}</option>)}</select></label>
        <fieldset className="platform-field"><legend>Площадки</legend><div className="platforms">{(['VK', 'OK', 'MAX'] as Platform[]).map(platform => <button type="button" title={platformNames[platform]} disabled={mode === 'ALL_PLATFORMS'} aria-pressed={platforms.includes(platform)} className={platforms.includes(platform) ? 'selected' : ''} key={platform} onClick={() => setPlatforms(current => current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform])}>{platform}</button>)}</div></fieldset>
        </div></details>
        {mode === 'BY_SOURCES' && sourcesError && <div className="inline-feedback" role="alert"><p>Источники недоступны: {sourcesError}</p><button type="button" className="subtle" disabled={sourcesLoading} onClick={() => void loadSources()}>Обновить источники</button></div>}
        {mode === 'BY_SOURCES' && <details className="source-checks"><summary>{sourcesLoading ? 'Загружаем источники…' : sourcesError ? 'Не удалось загрузить источники' : `Источники: ${selectedIds.filter(id => activeSources.some(source => source.id === id)).length} выбрано`}</summary><div>{activeSources.map(source => <label key={source.id}><input type="checkbox" checked={selectedIds.includes(source.id)} onChange={event => setSourceSelection(source.id, event.target.checked)}/><span>{source.name}</span><small>{platformNames[source.platform]}</small></label>)}{!sourcesLoading && !sourcesError && activeSources.length === 0 && <p>Нет активных источников на выбранных площадках.</p>}</div></details>}
        <button type="submit" className="primary search-submit" disabled={busy || (sourcesLoading && mode === 'BY_SOURCES')} aria-busy={busy}>{busy ? <span className="button-spinner"/> : <Search size={18}/>}<span>{busy ? 'Поиск выполняется…' : sourcesLoading && mode === 'BY_SOURCES' ? 'Загружаем источники…' : 'Найти публикации'}</span></button>
      </form>}
      {searchView === 'results' && <section className="results"><div className="section-title"><div><h2>Результаты</h2><p>«{currentSearch?.query || query}»{resultsPhase === 'ready' ? ` · ${countLabel(results.length, 'размещение', 'размещения', 'размещений')}` : ''}</p></div></div>
        <div className="result-actions"><button className="subtle" onClick={showSearchForm}><ArrowLeft size={17}/>Новый поиск</button><button className="primary export" onClick={() => void exportReport()} disabled={busy || !results.length || exportBusy || loadedSearchId !== currentSearch?.id} aria-busy={exportBusy}>{exportBusy ? <span className="button-spinner"/> : <Download size={17}/>}<span>{exportBusy ? 'Готовим…' : 'Скачать'}</span></button></div>
        {currentSearch && !busy && <button className="subtle reuse-query" onClick={useSearchConditions}>Использовать этот запрос</button>}
        {searchError && <div className="inline-feedback" role="alert"><p>{searchError}</p>{currentSearch && <button className="subtle" onClick={() => void executeSearch(currentSearch)}>Повторить загрузку</button>}</div>}
        {coverage.length > 0 && <details className="coverage" open={coverage.some(source => source.status === 'ERROR' || source.status === 'UNAVAILABLE')}><summary>Источники: {coverage.filter(item => item.status === 'OK').length} успешно · {coverage.filter(item => item.status === 'ERROR' || item.status === 'UNAVAILABLE').length} с ошибкой</summary>{coverage.map(item => <div className="coverage-row" key={item.id}><span className={`dot ${item.status === 'OK' ? 'ok' : item.status === 'PENDING' ? 'pending' : 'bad'}`}/><span>{item.sourceName}</span><small>{item.status === 'OK' ? countLabel(item.foundCount, 'публикация', 'публикации', 'публикаций') : item.message || item.status}</small></div>)}</details>}
        {results.some(item => !item.hasDate || !item.publishedAt) && <p className="unknown-date">Для {results.filter(item => !item.hasDate || !item.publishedAt).length} публикаций дата неизвестна; их соответствие периоду не подтверждено.</p>}
        {busy ? <div className="empty loading-state"><span className="button-spinner" aria-hidden="true"/>Ищем публикации…</div> : !searchError && resultsPhase === 'ready' && results.length === 0 && <div className="empty">{currentSearch?.status === 'FAILED' ? 'Поиск не выполнен' : 'Подходящих материалов нет в успешно обработанных источниках.'}</div>}
        {results.length > 0 && <div className="save-toolbar">
          {libraryStore.error && <div className="inline-feedback" role="alert"><p>{libraryStore.error}</p><button onClick={() => void libraryStore.load()}>Повторить загрузку подборок</button></div>}
          <label className="field"><span>Сохранять материалы в папку</span><select value={targetFolder} disabled={!libraryStore.library} onChange={event => setSaveFolder(event.target.value)}>{(libraryStore.library?.folders || [{ id: INBOX, name: 'Без папки' }]).map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
          <button className="subtle" disabled={savingAll || !libraryStore.library} onClick={() => void saveAllResults()}><Bookmark size={16}/>{savingAll ? 'Сохраняем…' : 'Сохранить все материалы'}</button>
        </div>}
        {results.map(item => <article className="publication" key={`${item.sourceId}:${item.url}`}><div className="publication-meta"><strong>{item.sourceName}</strong><span>{item.hasDate && item.publishedAt ? publicationDate(item.publishedAt) : 'Дата неизвестна'}</span></div><h3>{item.title || 'Публикация без заголовка'}</h3><p>{item.excerpt || 'Текст публикации отсутствует.'}</p><a href={item.url} target="_blank" rel="noreferrer">Открыть публикацию<ArrowUpRight size={15}/></a><SavePublication item={item} folderId={targetFolder} searchId={currentSearch?.id} store={libraryStore} onSaved={notifySuccess} onOpen={() => selectSection('collections')}/></article>)}
      </section>}
    </>}
    {section === 'collections' && <Collections store={libraryStore} onChanged={notifySuccess} onExport={exportCollection} exportBusy={exportBusy}/>}
    {section === 'history' && <section className="panel"><div className="section-title"><div><h2>История запросов</h2><p>Открывайте и повторяйте сохранённые поиски</p></div><button className="subtle" disabled={historyLoading} onClick={() => void loadHistory(true)}>Обновить</button></div>{historyError && <div className="inline-feedback" role="alert"><p>{historyError}</p></div>}{historyLoading && <div className="empty loading-state"><span className="button-spinner"/>Загружаем историю…</div>}{history.length ? history.map(search => <article className="history-item" key={search.id}><button className="history-open" disabled={busy || deletingQueries.includes(search.id)} onClick={() => void openHistory(search)}><strong>{search.query}</strong><span>{search.dateFrom || '—'} — {search.dateTo || '—'} · {countLabel(search.totalFound, 'материал', 'материала', 'материалов')}</span></button><span className={`status ${search.status.toLowerCase()}`}>{statusLabel(search.status)}</span><button className="delete" title="Удалить запрос" aria-label="Удалить запрос" disabled={deletingQueries.includes(search.id)} onClick={() => void removeQuery(search.id)}><Trash2 size={17}/></button></article>) : !historyLoading && !historyError && <div className="empty">История пока пуста.</div>}</section>}
    {section === 'sources' && <section className="panel"><div className="section-title"><div><h2>Источники</h2><p>Управляйте площадками мониторинга</p></div><button className="primary compact" disabled={sourceSaving || sourcesLoading} onClick={() => { setSourceDraft(blankSource); setShowSourceForm(value => !value) }}><Plus size={17}/>Добавить</button></div>{sourcesError && <div className="inline-feedback" role="alert"><p>{sourcesError}</p><button className="subtle" disabled={sourcesLoading} onClick={() => void loadSources()}>Повторить загрузку</button></div>}{sourcesLoading && <div className="empty loading-state"><span className="button-spinner"/>Загружаем источники…</div>}{!sourcesLoading && !sourcesError && sources.length === 0 && <div className="empty">Источников пока нет. Добавьте первый источник.</div>}{showSourceForm && <form ref={sourceFormRef} className="source-form" onSubmit={event => void saveSource(event)}><input required maxLength={200} disabled={sourceSaving} aria-label="Название источника" value={sourceDraft.name} onChange={event => setSourceDraft(current => ({ ...current, name: event.target.value }))} placeholder="Название источника"/><input required maxLength={500} disabled={sourceSaving} type="url" aria-label="Ссылка на источник" value={sourceDraft.url} onChange={event => setSourceDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://…"/><select disabled={sourceSaving} aria-label="Площадка источника" value={sourceDraft.platform} onChange={event => setSourceDraft(current => ({ ...current, platform: event.target.value as Platform }))}>{(['VK', 'OK', 'MAX'] as Platform[]).map(platform => <option value={platform} key={platform}>{platformNames[platform]}</option>)}</select><div><button type="button" className="subtle" disabled={sourceSaving} onClick={() => setShowSourceForm(false)}>Отмена</button><button className="primary compact" disabled={sourceSaving}>{sourceSaving ? 'Сохраняем…' : 'Сохранить'}</button></div></form>}{sources.map(source => <article className="source-item" key={source.id}><div><strong>{source.name}</strong><span>{platformNames[source.platform]} · {source.active ? 'активен' : 'выключен'}</span></div><button className="subtle" disabled={sourceSaving || sourcesLoading || pendingSources.includes(source.id)} onClick={() => void toggleSource(source)}>{source.active ? 'Выключить' : 'Включить'}</button><button className="subtle" disabled={sourceSaving || sourcesLoading || pendingSources.includes(source.id)} onClick={() => { setSourceDraft({ id: source.id, name: source.name, url: source.url, platform: source.platform, active: source.active }); setShowSourceForm(true) }}>Изменить</button><button className="delete" title="Удалить источник" aria-label="Удалить источник" disabled={sourceSaving || sourcesLoading || pendingSources.includes(source.id)} onClick={() => void deleteSource(source)}><Trash2 size={17}/></button></article>)}</section>}
    {section === 'settings' && <section className="panel"><h2>Настройки</h2><p className="muted">Изменения сохраняются автоматически.</p><label className="field"><span>Регион по умолчанию</span><select value={settings.region} onChange={event => setSettings(current => ({ ...current, region: event.target.value }))}><option value="">Все регионы</option>{regionOptions.map(region => <option key={region}>{region}</option>)}</select></label><label className="field"><span>Формат выгрузки</span><select value={settings.format} onChange={event => setSettings(current => ({ ...current, format: event.target.value as ExportFormat }))}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option><option value="docx">Word (.docx)</option></select></label><label className="check-setting"><input type="checkbox" checked={settings.includeLinks} onChange={event => setSettings(current => ({ ...current, includeLinks: event.target.checked }))}/>Добавлять исходные ссылки в таблицу</label><label className="field"><span>Оформление</span><select value={settings.theme} onChange={event => setSettings(current => ({ ...current, theme: event.target.value as Settings['theme'] }))}><option value="system">Как в системе</option><option value="light">Светлое</option><option value="dark">Тёмное</option></select></label></section>}
    </div>
  </main>
}

function statusLabel(status: ApiSearch['status']) { return ({ RUNNING: 'В процессе', COMPLETED: 'Готово', COMPLETED_PARTIAL: 'Частично', FAILED: 'Ошибка' })[status] }
function publicationDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU') : 'Дата неизвестна' }
function messageOf(reason: unknown) { return reason instanceof Error ? reason.message : 'Не удалось выполнить запрос.' }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }

const isExtension = ['chrome-extension:', 'moz-extension:'].includes(window.location.protocol)
createRoot(document.getElementById('root')!).render(isExtension ? <Popup /> : <main className="extension-launch"><img src="./icons/icon-128.png" width="56" height="56" alt=""/><h1>Краснопарс</h1><p>Откройте мини-приложение через значок расширения на панели браузера.</p><p>Для установки выберите папку extension/build на странице управления расширениями.</p></main>)

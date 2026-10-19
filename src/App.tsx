import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Download, ExternalLink, Heart, MapPin, Newspaper, Plus, Search, Settings, Share2, Users, X } from 'lucide-react'
import { api } from './api'
import type { AiStatus, PageResponse, Platform, PlatformDto, PublicationDto, PublicationSort, SearchDetail, SearchMode, SearchSummary, SearchType, SourceDto, SourceInput } from './api'

type Page = 'search' | 'results' | 'publication' | 'sources' | 'history' | 'analytics' | 'settings'
const platformNames: Record<Platform, string> = { VK: 'ВКонтакте', OK: 'Одноклассники', MAX: 'MAX' }
const statusNames: Record<SearchDetail['status'], string> = { RUNNING: 'Идёт поиск', COMPLETED: 'Поиск завершён', COMPLETED_PARTIAL: 'Результаты неполные', FAILED: 'Ошибка поиска' }
const searchTypes: Record<SearchType, string> = { TOPIC: 'Тема', EVENT: 'Событие', PERSON: 'Человек', NEWS_TEXT: 'Текст новости' }
const exampleTopics = ['ледовый дворец Красноярск', 'губернатор края', 'наводнение', 'развитие спорта']
const emptyPage: PageResponse<PublicationDto> = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true }

function formatDate(value: string | null | undefined) {
  if (!value) return 'Недоступна'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Произошла неизвестная ошибка' }
function titleOf(item: PublicationDto) { return item.title?.trim() || item.excerpt?.trim() || 'Публикация без заголовка' }
function directUrl(url: string) { try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined } catch { return undefined } }

function App() {
  const [page, setPage] = useState<Page>('search')
  const [query, setQuery] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('TOPIC')
  const [mode, setMode] = useState<SearchMode>('BY_SOURCES')
  const [provider, setProvider] = useState<'real' | 'demo'>('real')
  const [useAi, setUseAi] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [region, setRegion] = useState('Красноярский край')
  const [sources, setSources] = useState<SourceDto[]>([])
  const [platforms, setPlatforms] = useState<PlatformDto[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [history, setHistory] = useState<SearchSummary[]>([])
  const [search, setSearch] = useState<SearchDetail | null>(null)
  const [resultPage, setResultPage] = useState(0)
  const [sort, setSort] = useState<PublicationSort>('relevance')
  const [publicationPage, setPublicationPage] = useState<PageResponse<PublicationDto>>(emptyPage)
  const [selectedPublication, setSelectedPublication] = useState<PublicationDto | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dataError, setDataError] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [notice, setNotice] = useState('')
  const [sourceDialog, setSourceDialog] = useState<SourceDto | 'new' | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)

  const refreshSources = useCallback(async () => {
    const items = await api.sources()
    setSources(items)
    setSelectedIds(current => current.filter(id => items.some(item => item.id === id && item.active)))
  }, [])
  const refreshHistory = useCallback(async () => setHistory(await api.searches()), [])

  useEffect(() => {
    let live = true
    Promise.allSettled([api.platforms(), api.sources(), api.searches(), api.aiStatus()]).then(([platformResult, sourceResult, historyResult, aiResult]) => {
      if (!live) return
      if (platformResult.status === 'fulfilled') setPlatforms(platformResult.value)
      if (sourceResult.status === 'fulfilled') setSources(sourceResult.value)
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value)
      if (aiResult.status === 'fulfilled') setAiStatus(aiResult.value)
      const failed = [platformResult, sourceResult, historyResult].find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') setDataError(message(failed.reason))
    })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!search || search.status !== 'RUNNING') return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const detail = await api.search(search.id)
        if (cancelled) return
        setSearch(detail)
        setResultsError('')
        if (detail.status !== 'RUNNING') void refreshHistory().catch(() => {})
      } catch (error) { if (!cancelled) setResultsError(message(error)) }
    }, 1500)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [search?.id, search?.status, refreshHistory])

  useEffect(() => {
    if (!search) return
    let cancelled = false
    setLoadingResults(true)
    api.publications(search.id, resultPage, 20, sort).then(data => {
      if (!cancelled) { setPublicationPage(data); setResultsError(''); setLoadingResults(false) }
    }).catch(error => { if (!cancelled) { setResultsError(message(error)); setLoadingResults(false) } })
    return () => { cancelled = true }
  }, [search?.id, search?.status, search?.totalFound, resultPage, sort])

  async function runSearch(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) { setDataError('Введите запрос для поиска.'); return }
    if (dateFrom && dateTo && dateFrom > dateTo) { setDataError('Начало периода должно быть раньше окончания.'); return }
    if (mode === 'BY_SOURCES' && selectedIds.length === 0) { setDataError('Выберите хотя бы один активный источник.'); return }
    setBusy(true); setDataError(''); setResultsError(''); setPublicationPage(emptyPage)
    try {
      const detail = await api.createSearch({ query: query.trim(), additionalInfo: additionalInfo.trim() || undefined, searchType, mode, sourceIds: mode === 'BY_SOURCES' ? selectedIds : undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, region: region.trim() || undefined, provider, useAi })
      setSearch(detail); setResultPage(0); setPage('results')
      void refreshHistory().catch(() => {})
    } catch (error) { setDataError(message(error)) }
    finally { setBusy(false) }
  }

  async function openHistory(id: number) {
    setBusy(true); setDataError(''); setResultsError(''); setPublicationPage(emptyPage)
    try { const detail = await api.search(id); setSearch(detail); setResultPage(0); setSort('relevance'); setPage('results') }
    catch (error) { setDataError(message(error)) }
    finally { setBusy(false) }
  }

  async function saveSource(input: SourceInput) {
    if (sourceDialog === null) return
    setBusy(true); setDataError('')
    try {
      const saved = sourceDialog === 'new' ? await api.createSource(input) : await api.updateSource(sourceDialog.id, input)
      await refreshSources(); setSourceDialog(null); setNotice('Источник сохранён.')
      if (saved.active) setSelectedIds(current => current.includes(saved.id) ? current : [...current, saved.id])
    } catch (error) { setDataError(message(error)) }
    finally { setBusy(false) }
  }
  async function toggleSource(item: SourceDto) {
    try { await api.updateSource(item.id, { name: item.name, platform: item.platform, url: item.url, description: item.description, active: !item.active }); await refreshSources() }
    catch (error) { setDataError(message(error)) }
  }
  async function deleteSource(item: SourceDto) {
    if (!window.confirm(`Удалить источник «${item.name}»?`)) return
    try { await api.deleteSource(item.id); await refreshSources(); setNotice('Источник удалён.') }
    catch (error) { setDataError(message(error)) }
  }
  async function restartSearch() {
    if (!search) return
    setBusy(true); setResultsError(''); setPublicationPage(emptyPage)
    try { setSearch(await api.restartSearch(search.id)); setResultPage(0); void refreshHistory().catch(() => {}) }
    catch (error) { setResultsError(message(error)) }
    finally { setBusy(false) }
  }
  async function exportSearch() {
    if (!search) return
    try { await api.exportSearch(search.id) } catch (error) { setResultsError(message(error)) }
  }
  async function deleteHistory(id: number) {
    if (!window.confirm('Удалить поиск и все его результаты?')) return
    try { await api.deleteSearch(id); await refreshHistory(); if (search?.id === id) { setSearch(null); setPage('history') } }
    catch (error) { setDataError(message(error)) }
  }

  return <div className="app-shell">
    <aside className="app-sidebar">
      <div className="brand-card"><div className="brand-mark brand-flame" aria-hidden="true"><i/><i/><i/></div><div><b>МЕДИАМОНИТОРИНГ<br/>СОЦСЕТЕЙ</b><span>Красноярский край</span></div></div>
      <nav className="sidebar-nav">
        <NavItem active={page === 'search'} icon={<Search size={18}/>} onClick={() => setPage('search')}>Поиск публикаций</NavItem>
        <NavItem active={page === 'results' || page === 'publication'} icon={<Newspaper size={18}/>} onClick={() => setPage(search ? 'results' : 'history')}>Результаты</NavItem>
        <NavItem active={page === 'sources'} icon={<Users size={18}/>} onClick={() => setPage('sources')}>Источники</NavItem>
        <NavItem active={page === 'history'} icon={<Bookmark size={18}/>} onClick={() => setPage('history')}>История поиска</NavItem>
        <NavItem active={page === 'analytics'} icon={<BarChart3 size={18}/>} onClick={() => setPage('analytics')}>Аналитика</NavItem>
        <NavItem active={page === 'settings'} icon={<Settings size={18}/>} onClick={() => setPage('settings')}>Настройки</NavItem>
      </nav>
    </aside>
    <main className="main-area"><div className={`page-content ${page === 'search' ? 'page-content--flush' : ''}`}>
      {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Закрыть"><X size={15}/></button></div>}
      {dataError && <div className="api-alert" role="alert"><CircleAlert size={17}/><span>{dataError}</span><button onClick={() => setDataError('')} aria-label="Закрыть"><X size={16}/></button></div>}
      {page === 'search' && <SearchPage {...{ query, setQuery, additionalInfo, setAdditionalInfo, searchType, setSearchType, mode, setMode, provider, setProvider, useAi, setUseAi, dateFrom, setDateFrom, dateTo, setDateTo, region, setRegion, sources, selectedIds, setSelectedIds, platforms, aiStatus, busy }} onSubmit={runSearch}/>}
      {page === 'results' && search && <ResultsPage {...{ search, publicationPage, resultPage, sort, loadingResults, resultsError, busy }} onPage={setResultPage} onSort={value => { setResultPage(0); setSort(value) }} onSearch={() => setPage('search')} onOpen={item => { setSelectedPublication(item); setPage('publication') }} onExport={exportSearch} onRestart={restartSearch}/>}
      {page === 'publication' && selectedPublication && <PublicationPage item={selectedPublication} onBack={() => setPage('results')}/>}
      {page === 'sources' && <SourcesPage sources={sources} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onAdd={() => setSourceDialog('new')} onEdit={setSourceDialog} onToggle={toggleSource} onDelete={deleteSource}/>}
      {page === 'history' && <HistoryPage items={history} busy={busy} onOpen={openHistory} onDelete={deleteHistory} onNew={() => setPage('search')}/>}
      {page === 'analytics' && <AnalyticsPage search={search} onExport={exportSearch} onChoose={() => setPage('history')}/>}
      {page === 'settings' && <SettingsPage provider={provider} setProvider={setProvider} aiStatus={aiStatus} onRefresh={async () => { try { await refreshSources(); await refreshHistory(); setDataError(''); setNotice('Данные обновлены.') } catch (error) { setDataError(message(error)) } }}/ >}
    </div></main>
    {sourceDialog && <SourceDialog source={sourceDialog === 'new' ? null : sourceDialog} busy={busy} error={dataError} onClose={() => setSourceDialog(null)} onSave={saveSource}/>}
  </div>
}

function NavItem({ active, icon, onClick, children }: { active: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={`nav-link ${active ? 'nav-active' : ''}`}>{icon}<span>{children}</span></button> }
function PlatformBadge({ platform }: { platform: Platform }) { return <span className={`pl-badge pl-${platform.toLowerCase()}`}>{platform === 'OK' ? 'ОК' : platform}</span> }

interface SearchPageProps {
  query: string; setQuery: (value: string) => void; additionalInfo: string; setAdditionalInfo: (value: string) => void
  searchType: SearchType; setSearchType: (value: SearchType) => void; mode: SearchMode; setMode: (value: SearchMode) => void
  provider: 'real' | 'demo'; setProvider: (value: 'real' | 'demo') => void; useAi: boolean; setUseAi: (value: boolean) => void
  dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void
  region: string; setRegion: (value: string) => void; sources: SourceDto[]; selectedIds: number[]; setSelectedIds: (value: number[] | ((current: number[]) => number[])) => void
  platforms: PlatformDto[]; aiStatus: AiStatus | null; busy: boolean; onSubmit: (event: FormEvent) => void
}
function SearchPage(props: SearchPageProps) {
  const { query, setQuery, additionalInfo, setAdditionalInfo, searchType, setSearchType, mode, setMode, provider, setProvider, useAi, setUseAi, dateFrom, setDateFrom, dateTo, setDateTo, region, setRegion, sources, selectedIds, setSelectedIds, platforms, aiStatus, busy, onSubmit } = props
  const activeSources = sources.filter(source => source.active)
  return <div className="search-page"><div className="search-main">
    <div className="search-heading"><h1>Поиск публикаций</h1><p>Найдите размещения по теме, событию, имени или тексту новости</p></div>
    <form className="search-card" onSubmit={onSubmit}><div className="search-row"><input required maxLength={2000} value={query} onChange={event => setQuery(event.target.value)} placeholder="Тема, событие, имя человека или текст новости..."/><button type="submit" disabled={busy} className="find-button"><Search size={16}/>{busy ? 'Запускаем...' : 'Найти'}</button></div><div className="search-tags"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div></form>
    <div className="parameters-card"><div className="filters-card"><div className="filter-block"><span className="filter-label">Период публикации</span><div className="period-box"><CalendarDays size={17}/><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="Начало периода"/><span className="period-dash">—</span><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label="Конец периода"/></div></div><div className="filter-block"><span className="filter-label">Регион</span><div className="region-box"><MapPin size={17}/><input value={region} onChange={event => setRegion(event.target.value)} aria-label="Регион"/></div></div></div>
      <div className="api-search-options"><label>Тип запроса<select value={searchType} onChange={event => setSearchType(event.target.value as SearchType)}>{Object.entries(searchTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Режим данных<select value={provider} onChange={event => setProvider(event.target.value as 'real' | 'demo')}><option value="real">Реальные данные</option><option value="demo">Демонстрация</option></select></label></div>
      <div className="sources-card"><div className="sources-left"><h3>Охват поиска</h3><div className="scope-row"><label className="radio"><input type="radio" name="search-scope" checked={mode === 'BY_SOURCES'} onChange={() => setMode('BY_SOURCES')}/><i/><span>Только выбранные источники</span></label><label className="radio"><input type="radio" name="search-scope" checked={mode === 'ALL_PLATFORMS'} onChange={() => setMode('ALL_PLATFORMS')}/><i/><span>Все активные источники</span></label></div><p className="api-hint">Широкий режим ищет по всем активным источникам сервера.</p><h3 className="extra-heading">Проверка по смыслу</h3><label className="api-checkbox"><input type="checkbox" checked={useAi} onChange={event => setUseAi(event.target.checked)}/>Дополнительная оценка ИИ</label><p className="api-hint">{aiStatus ? (aiStatus.connected ? `Доступен ${aiStatus.model || 'ИИ'}` : 'ИИ сейчас недоступен; поиск продолжит работу') : 'Состояние ИИ неизвестно'}</p></div><div className="sources-right"><h3>Источники ({selectedIds.length} выбрано)</h3><div className="source-picker">{activeSources.length ? activeSources.map(source => <label key={source.id} className="source-picker-row"><input type="checkbox" disabled={mode === 'ALL_PLATFORMS'} checked={selectedIds.includes(source.id)} onChange={() => setSelectedIds(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])}/><PlatformBadge platform={source.platform}/><span>{source.name}</span></label>) : <p className="api-hint">Активных источников нет или список не загружен.</p>}</div><div className="platform-support">{platforms.map(item => <span key={item.code}><PlatformBadge platform={item.code}/>{item.title}{provider === 'real' && item.code === 'MAX' ? ' · недоступен' : ''}</span>)}</div></div></div>
      <div className="api-extra"><label>Уточнение запроса<textarea value={additionalInfo} onChange={event => setAdditionalInfo(event.target.value)} placeholder="Необязательно: детали события или контекст" rows={2}/></label></div>
    </div>
  </div><aside className="hero-pane"><div className="hero-overlay"><h2>Красноярский край<br/>в медиапространстве</h2><p>Поиск публикаций по выбранным источникам и сохранение результатов.</p></div></aside></div>
}

interface ResultsPageProps { search: SearchDetail; publicationPage: PageResponse<PublicationDto>; resultPage: number; sort: PublicationSort; loadingResults: boolean; resultsError: string; busy: boolean; onPage: (page: number) => void; onSort: (sort: PublicationSort) => void; onSearch: () => void; onOpen: (item: PublicationDto) => void; onExport: () => void; onRestart: () => void }
function ResultsPage({ search, publicationPage, resultPage, sort, loadingResults, resultsError, busy, onPage, onSort, onSearch, onOpen, onExport, onRestart }: ResultsPageProps) {
  const incomplete = search.status === 'COMPLETED_PARTIAL' || search.sourcesFailed > 0
  const failedSources = search.sources.filter(source => source.status === 'UNAVAILABLE' || source.status === 'ERROR')
  return <div className="design-page results-page"><div className="design-page-heading"><div><button onClick={onSearch} className="back-link"><ArrowLeft size={13}/>К поиску</button><h1>Результаты поиска</h1><p>Запрос: «{search.query}»</p></div><div className="heading-actions"><button onClick={onRestart} disabled={busy} className="soft-action">Повторить поиск</button><button onClick={onExport} disabled={search.totalFound === 0} className="primary-action"><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar"><div className="summary-filter"><CalendarDays size={15}/><span>{search.dateFrom || 'Без начала'} — {search.dateTo || 'Без окончания'}</span></div><div className="summary-filter"><MapPin size={15}/><span>{search.region || 'Все регионы'}</span></div><span className="summary-filter">{search.provider === 'demo' ? 'Демонстрационные данные' : 'Реальные данные'}</span><button onClick={onSearch} className="summary-edit">Изменить параметры <ArrowRight size={12}/></button></div>
    <div className={`search-state ${search.status.toLowerCase()}`} role="status"><strong>{statusNames[search.status]}</strong><span>{search.status === 'RUNNING' ? `Обработано ${search.sourcesProcessed} из ${search.sourcesTotal} источников` : search.status === 'FAILED' ? (search.error || 'Ни один источник не обработан') : `Найдено ${search.totalFound} публикаций · пропущено повторов: ${search.duplicatesSkipped}, нерелевантных: ${search.irrelevantSkipped}`}</span>{search.status === 'RUNNING' && <div className="progress-track"><i style={{ width: `${search.sourcesTotal ? search.sourcesProcessed / search.sourcesTotal * 100 : 0}%` }}/></div>}</div>
    {incomplete && <div className="api-alert warning"><CircleAlert size={17}/><span>Результаты неполные: {search.sourcesFailed} источников недоступно или завершились ошибкой.</span></div>}
    {failedSources.length > 0 && <details className="coverage-details"><summary>Проблемы источников ({failedSources.length})</summary>{failedSources.map(source => <p key={source.id}><b>{source.sourceName} ({source.platform})</b> — {source.message || (source.status === 'UNAVAILABLE' ? 'Недоступен' : 'Ошибка')}</p>)}</details>}
    {resultsError && <div className="api-alert" role="alert"><CircleAlert size={17}/>{resultsError}</div>}
    <section className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{search.totalFound}</strong> публикаций</h2><p>Каждое размещение — отдельная запись с прямой ссылкой</p></div><label className="sort-control">Сортировка<select value={sort} onChange={event => onSort(event.target.value as PublicationSort)}><option value="relevance">По релевантности</option><option value="date">Сначала новые</option><option value="found">По обнаружению</option></select></label></div>
      {loadingResults && <div className="empty-state">Загружаем публикации...</div>}
      {!loadingResults && publicationPage.content.length === 0 && <div className="empty-state">{search.status === 'RUNNING' ? 'Поиск продолжается. Найденные публикации появятся здесь.' : search.status === 'FAILED' ? 'Результаты отсутствуют из-за ошибки поиска.' : incomplete ? 'Публикации пока не найдены. Часть источников недоступна.' : 'Подходящие публикации не найдены.'}</div>}
      <div className="result-rows">{publicationPage.content.map(item => <article key={item.id} className="result-row"><button type="button" onClick={() => onOpen(item)} className="result-photo publication-thumb api-thumb" aria-label={`Открыть ${titleOf(item)}`}><PlatformBadge platform={item.platform}/></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{titleOf(item)}</button>{directUrl(item.url) && <a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a>}</div><p>{item.excerpt || 'Выдержка недоступна'}</p><div className="result-metadata"><span><Users size={12}/>{item.sourceName}</span><span>{item.hasDate ? formatDate(item.publishedAt) : 'Дата недоступна'}</span><span>{platformNames[item.platform]}</span></div><div className="result-engagement">{item.likes != null && <span><Heart size={13}/>{item.likes}</span>}{item.reposts != null && <span><Share2 size={13}/>{item.reposts}</span>}{item.views != null && <span>Просмотры: {item.views}</span>}{item.aiRelevance != null && <span className="match-label match-direct">ИИ: {Math.round(item.aiRelevance * 100)}%</span>}</div></div></article>)}</div>
      {publicationPage.totalElements > 0 && <div className="results-pagination"><span>Показано <b>{publicationPage.content.length}</b> из <b>{publicationPage.totalElements}</b> публикаций</span><div><button onClick={() => onPage(Math.max(0, resultPage - 1))} disabled={resultPage === 0}><ChevronLeft size={15}/></button><button className="pagination-current">{resultPage + 1}</button><button onClick={() => onPage(resultPage + 1)} disabled={publicationPage.last}><ChevronRight size={15}/></button></div></div>}
    </section>
  </div>
}

function PublicationPage({ item, onBack }: { item: PublicationDto; onBack: () => void }) {
  return <div className="publication-page"><button type="button" className="publication-back" onClick={onBack}><ArrowLeft size={15}/>Назад к результатам</button><div className="publication-layout"><article className="publication-card"><header className="publication-header"><div className="publication-source-avatar">{item.sourceName.slice(0, 1)}</div><div><strong>{item.sourceName}</strong><span>{item.hasDate ? formatDate(item.publishedAt) : 'Дата недоступна'}</span></div><span className={`publication-platform ${item.platform.toLowerCase()}`}>{platformNames[item.platform]}</span></header><div className="publication-content"><h1>{titleOf(item)}</h1><p>{item.excerpt || 'Выдержка недоступна'}</p>{item.aiComment && <div className="ai-comment"><b>Оценка ИИ</b><p>{item.aiComment}</p></div>}</div><footer className="publication-actions">{item.likes != null && <span><Heart size={16}/>{item.likes}</span>}{item.reposts != null && <span><Share2 size={16}/>{item.reposts}</span>}{item.views != null && <span>Просмотры: {item.views}</span>}{directUrl(item.url) && <a href={item.url} target="_blank" rel="noreferrer">Открыть оригинал <ExternalLink size={14}/></a>}</footer></article><aside className="publication-info"><h2>О публикации</h2><dl><div><dt>Источник</dt><dd>{item.sourceName}</dd></div><div><dt>Площадка</dt><dd>{platformNames[item.platform]}</dd></div><div><dt>Дата публикации</dt><dd>{item.hasDate ? formatDate(item.publishedAt) : 'Недоступна'}</dd></div>{item.relevance != null && <div><dt>Релевантность</dt><dd>{Math.round(item.relevance * 100)}%</dd></div>}{item.aiRelevance != null && <div><dt>Оценка ИИ</dt><dd>{Math.round(item.aiRelevance * 100)}%</dd></div>}</dl></aside></div></div>
}

function SourcesPage({ sources, selectedIds, setSelectedIds, onAdd, onEdit, onToggle, onDelete }: { sources: SourceDto[]; selectedIds: number[]; setSelectedIds: (value: number[] | ((current: number[]) => number[])) => void; onAdd: () => void; onEdit: (source: SourceDto) => void; onToggle: (source: SourceDto) => void; onDelete: (source: SourceDto) => void }) {
  return <section className="repository-sources"><div className="repository-source-heading"><div><div className="repository-kicker"><Users size={13}/>Справочник</div><h1>Источники публикаций</h1><p>Активные сообщества и каналы для поиска</p></div><button onClick={onAdd}><Plus size={15}/>Добавить источник</button></div><div className="panel repository-source-list"><div className="repository-source-list-head"><div><h2>Список источников</h2><p>{sources.length} источников · {selectedIds.length} выбрано для поиска</p></div><button onClick={() => setSelectedIds(sources.filter(item => item.active).map(item => item.id))}>Выбрать все активные</button></div>{sources.length === 0 && <div className="empty-state">Источников пока нет или список не загрузился.</div>}<div>{sources.map(source => <div key={source.id} className="repository-source-row"><button onClick={() => setSelectedIds(current => current.includes(source.id) ? current.filter(id => id !== source.id) : [...current, source.id])} disabled={!source.active} aria-label={`Выбрать ${source.name}`} className={`repository-check ${selectedIds.includes(source.id) ? 'checked' : ''}`}><Check size={12}/></button><button onClick={() => onEdit(source)} className="repository-source-avatar">{source.name.slice(0, 1)}</button><div className="repository-source-copy"><button onClick={() => onEdit(source)}>{source.name}</button>{directUrl(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.url}<ExternalLink size={9}/></a> : <span>{source.url}</span>}</div><span className={`repository-platform ${source.platform.toLowerCase()}`}>{platformNames[source.platform]}</span><button className={`repository-status ${source.active ? '' : 'offline'}`} onClick={() => onToggle(source)}><i/>{source.active ? 'Активен' : 'Отключён'}</button><button onClick={() => onDelete(source)} className="repository-delete" aria-label={`Удалить ${source.name}`}>×</button></div>)}</div><div className="repository-source-note">Выбор источника определяет область поиска в режиме «Только выбранные источники».</div></div></section>
}

function SourceDialog({ source, busy, error, onClose, onSave }: { source: SourceDto | null; busy: boolean; error: string; onClose: () => void; onSave: (input: SourceInput) => void }) {
  const [name, setName] = useState(source?.name || '')
  const [url, setUrl] = useState(source?.url || '')
  const [platform, setPlatform] = useState<Platform>(source?.platform || 'VK')
  const [description, setDescription] = useState(source?.description || '')
  const [active, setActive] = useState(source?.active ?? true)
  return <div className="modal-backdrop" onClick={onClose}><form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); onSave({ name: name.trim(), url: url.trim(), platform, description: description.trim(), active }) }}><div className="modal-heading"><div><h2>{source ? 'Редактировать источник' : 'Добавить источник'}</h2><p>Сведения сохраняются на сервере</p></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>{error && <div className="api-alert" role="alert"><CircleAlert size={16}/>{error}</div>}<label>Название<input required maxLength={200} value={name} onChange={event => setName(event.target.value)}/></label><label>Ссылка<input required maxLength={500} type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://vk.com/community"/></label><label>Площадка<select value={platform} onChange={event => setPlatform(event.target.value as Platform)}><option value="VK">ВКонтакте</option><option value="OK">Одноклассники</option><option value="MAX">MAX</option></select></label><label>Описание<textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} rows={2}/></label><label className="api-checkbox"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)}/>Активен</label><div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Отмена</button><button disabled={busy} className="button-primary"><Check size={16}/>Сохранить</button></div></form></div>
}

function HistoryPage({ items, busy, onOpen, onDelete, onNew }: { items: SearchSummary[]; busy: boolean; onOpen: (id: number) => void; onDelete: (id: number) => void; onNew: () => void }) {
  return <section className="saved-shell"><header className="saved-page-head"><div><h1>История поиска</h1><p>Поиски и результаты, сохранённые на сервере</p></div><button className="button-primary" onClick={onNew}><Plus size={16}/>Новый запрос</button></header><div className="saved-table-wrap"><table className="saved-queries-table"><thead><tr><th>№</th><th>Запрос</th><th>Статус</th><th>Период</th><th>Найдено</th><th>Действия</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.id}</td><td><button className="saved-query-name" disabled={busy} onClick={() => onOpen(item.id)}>{item.query}</button></td><td>{statusNames[item.status]}</td><td>{item.dateFrom || '—'} — {item.dateTo || '—'}</td><td>{item.totalFound}</td><td><div className="history-actions"><button onClick={() => onOpen(item.id)}>Открыть</button><button className="danger-action" onClick={() => onDelete(item.id)}>Удалить</button></div></td></tr>)}</tbody></table>{items.length === 0 && <div className="empty-state">История поиска пуста.</div>}</div></section>
}

function AnalyticsPage({ search, onExport, onChoose }: { search: SearchDetail | null; onExport: () => void; onChoose: () => void }) {
  if (!search) return <div className="design-page analytics-page"><div className="design-page-heading"><div><h1>Аналитика</h1><p>Выберите поиск, чтобы увидеть статистику</p></div></div><div className="empty-state"><button className="button-primary" onClick={onChoose}>Открыть историю поиска</button></div></div>
  const counts = (['VK', 'OK', 'MAX'] as Platform[]).map(platform => ({ platform, count: search.sources.filter(source => source.platform === platform).reduce((sum, source) => sum + source.foundCount, 0) }))
  return <div className="design-page analytics-page"><div className="design-page-heading"><div><h1>Аналитика</h1><p>Поиск №{search.id}: {search.query}</p></div><button className="primary-action" onClick={onExport}><Download size={14}/>Скачать отчёт</button></div><div className="analytics-stats"><div className="analytics-stat total"><span>Найдено публикаций</span><div>{search.totalFound}</div></div>{counts.map(item => <div className="analytics-stat" key={item.platform}><span>{platformNames[item.platform]}</span><div>{item.count}</div><small>по обработанным источникам</small></div>)}</div><div className="analytics-grid"><section className="design-card trend-card"><div className="design-card-heading"><div><h2>Обработка источников</h2><p>Статусы из ответа сервера</p></div></div><div className="analytics-source-list">{search.sources.map(source => <div key={source.id}><span><PlatformBadge platform={source.platform}/>{source.sourceName}</span><b>{source.status === 'OK' ? `${source.foundCount} публикаций` : source.status === 'PENDING' ? 'Ожидает' : source.message || source.status}</b></div>)}</div></section><section className="design-card topics-card"><div className="design-card-heading"><div><h2>Качество отбора</h2><p>Показатели текущего поиска</p></div></div><div className="analytics-source-list"><div><span>Обработано источников</span><b>{search.sourcesProcessed} / {search.sourcesTotal}</b></div><div><span>Успешно</span><b>{search.sourcesOk}</b></div><div><span>Недоступно или ошибка</span><b>{search.sourcesFailed}</b></div><div><span>Пропущено повторов</span><b>{search.duplicatesSkipped}</b></div><div><span>Пропущено нерелевантных</span><b>{search.irrelevantSkipped}</b></div></div><p className="api-hint">Динамика по дням и типы контента не доступны в текущем API.</p></section></div></div>
}

function SettingsPage({ provider, setProvider, aiStatus, onRefresh }: { provider: 'real' | 'demo'; setProvider: (provider: 'real' | 'demo') => void; aiStatus: AiStatus | null; onRefresh: () => void }) {
  return <section className="settings-shell"><header className="settings-page-head"><h1>Настройки</h1><p>Подключение к серверу и режим поиска</p></header><div className="settings-body"><div className="settings-form"><div className="settings-row"><strong>Режим данных</strong><label className="settings-select"><select value={provider} onChange={event => setProvider(event.target.value as 'real' | 'demo')}><option value="real">Реальные данные</option><option value="demo">Демонстрация</option></select></label></div><div className="settings-row"><strong>Оценка ИИ</strong><div>{aiStatus ? (aiStatus.connected ? `${aiStatus.model || 'ИИ'} подключён` : aiStatus.message || 'Недоступна') : 'Состояние неизвестно'}</div></div><div className="settings-row"><strong>Сервер API</strong><div>{import.meta.env.VITE_API_BASE_URL || 'http://109.196.167.225:8080'}</div></div></div></div><footer className="settings-footer"><button className="button-primary" onClick={onRefresh}>Обновить данные</button></footer></section>
}

export default App

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { api, downloadSearchExport, waitForSearch } from './api'
import type { ApiPublication, ApiSearch, ApiSource } from './api'
import {
  ArrowLeft, ArrowRight,
  Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert,
  CircleHelp, Download, ExternalLink, Eye, EyeOff, Heart, Lock, Mail, MapPin,
  Moon, MoreHorizontal, Newspaper, Plus, Search, Settings, Share2, Star, Sun, User, Users, X,
} from 'lucide-react'

type Page = 'login' | 'register' | 'results' | 'publication' | 'sources' | 'saved' | 'settings'
type Platform = 'VK' | 'OK' | 'MAX'
type Source = { id: number; name: string; platform: Platform; url: string; followers: string; region: string; active: boolean; color: string }
type SavedQuery = { id: number; name: string; query: string; period: string; region: string; favorite: boolean }
type Publication = { id: number; source: string; platform: Platform; date: string; title: string; excerpt: string; url: string; kind: string; color: string; image: string; likes: number; reposts: number; views: number; aiRelevance: number | null; aiComment: string | null }
type CityBackground = 'day' | 'evening'
type ThemeMode = 'system' | 'light' | 'dark'

const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem('krasnopars-theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

const getCityBackground = (themeMode: ThemeMode): CityBackground => {
  if (themeMode === 'light') return 'day'
  if (themeMode === 'dark') return 'evening'
  const hour = new Date().getHours()
  return hour >= 5 && hour < 17 ? 'day' : 'evening'
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayInputValue = () => formatDateInput(new Date())
const capToToday = (value: string) => (value && value > todayInputValue() ? todayInputValue() : value)
const openDatePicker = (input: HTMLInputElement) => input.showPicker?.()
const formatCompactDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year.slice(-2)}` : 'дд.мм.гг'
}

const formatCalendarSelection = (value: string) => value
  ? new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T00:00:00`))
  : 'Дата не выбрана'
const monthAgoInputValue = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return formatDateInput(date)
}

const initialSources: Source[] = [
  { id: 1, name: 'Наш Красноярский край', platform: 'VK', url: 'vk.com/krskstate', followers: '245K', region: 'Красноярский край', active: true, color: '#284b83' },
  { id: 2, name: 'Спорт_Красноярск', platform: 'VK', url: 'vk.com/sportkrsk', followers: '128K', region: 'Красноярский край', active: true, color: '#26364e' },
  { id: 3, name: 'Новости Красноярска', platform: 'OK', url: 'ok.ru/news.krsk', followers: '86K', region: 'Красноярский край', active: true, color: '#d5222b' },
  { id: 4, name: 'Культура Красноярья', platform: 'OK', url: 'ok.ru/culturekrsk', followers: '42K', region: 'Красноярский край', active: true, color: '#99820f' },
  { id: 5, name: 'Красноярск. Главное', platform: 'MAX', url: 'max.ru/krasnoyarsk', followers: '38K', region: 'Красноярский край', active: true, color: '#5d4a37' },
  { id: 6, name: 'ЧП Красноярск', platform: 'VK', url: 'vk.com/chp_krsk', followers: '512K', region: 'Красноярский край', active: true, color: '#312c6f' },
]
const initialSaved: SavedQuery[] = [
  { id: 1, name: 'Ледовый дворец', query: 'открытие ледового дворца Красноярск', period: '01.03.2026 — 31.03.2026', region: 'Красноярский край', favorite: true },
  { id: 2, name: 'Наводнение 2026', query: 'наводнение Красноярский край', period: '01.04.2026 — 30.04.2026', region: 'Красноярский край', favorite: true },
  { id: 3, name: 'Губернатор края', query: 'губернатор Красноярского края', period: '01.01.2026 — 31.03.2026', region: 'Красноярский край', favorite: true },
  { id: 4, name: 'Развитие спорта', query: 'развитие спорта Красноярск', period: '01.01.2026 — 31.12.2026', region: 'Красноярский край', favorite: true },
  { id: 5, name: 'Строительство', query: 'строительство Красноярск', period: '01.01.2026 — 31.12.2026', region: 'Красноярский край', favorite: true },
]
const platformLabel: Record<Platform, string> = { VK: 'VK', OK: 'Одноклассники', MAX: 'MAX' }
const exampleTopics = ['ледовый дворец Красноярск', 'губернатор края', 'наводнение 2026', 'развитие спорта']

const platformColor: Record<Platform, string> = { VK: '#5278d9', OK: '#e98a35', MAX: '#7358ce' }
const publicationImages = ['/images/arena-exterior.jpg', '/images/arena-interior.jpg', '/images/hockey-training.jpg', '/images/arena-evening.jpg', '/images/arena-ceremony.jpg']

const mapSource = (source: ApiSource): Source => ({
  id: source.id,
  name: source.name,
  platform: source.platform,
  url: source.url,
  followers: '—',
  region: 'Красноярский край',
  active: source.active,
  color: platformColor[source.platform],
})

const mapPublication = (publication: ApiPublication): Publication => ({
  id: publication.id,
  source: publication.sourceName,
  platform: publication.platform,
  date: publication.hasDate && publication.publishedAt
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(publication.publishedAt))
    : 'Дата недоступна',
  title: publication.title || 'Публикация без заголовка',
  excerpt: publication.excerpt || 'Текст публикации отсутствует.',
  url: publication.url,
  kind: (publication.aiRelevance ?? publication.relevance) >= 0.65 ? 'По теме' : 'Связано',
  color: platformColor[publication.platform],
  image: publicationImages[publication.id % publicationImages.length],
  likes: publication.likes ?? 0,
  reposts: publication.reposts ?? 0,
  views: publication.views ?? 0,
  aiRelevance: publication.aiRelevance,
  aiComment: publication.aiComment,
})

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос к API.'
const formatApiPeriod = (search: ApiSearch) => `${search.dateFrom ?? '—'} — ${search.dateTo ?? '—'}`

function App() {
  const [page, setPage] = useState<Page>('results')
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [periodStart, setPeriodStart] = useState(monthAgoInputValue)
  const [periodEnd, setPeriodEnd] = useState(todayInputValue)
  const [region, setRegion] = useState('Красноярский край')
  const [regions, setRegions] = useState(['Красноярский край', 'Красноярск', 'Ачинск', 'Норильск'])
  const [platforms, setPlatforms] = useState<Platform[]>(['VK', 'OK', 'MAX'])
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [results, setResults] = useState<Publication[]>([])
  const [searchId, setSearchId] = useState<number | null>(null)
  const [, setSearchStatus] = useState<ApiSearch['status'] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [validationSubmitted, setValidationSubmitted] = useState(false)
  const searchRunRef = useRef(0)
  const [apiError, setApiError] = useState('')
  const [saved, setSaved] = useState(initialSaved)
  const [notice, setNotice] = useState('')
  const [settingsTab, setSettingsTab] = useState('Основные')
  const [sourceModal, setSourceModal] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePlatform, setSourcePlatform] = useState<Platform>('VK')
  const [sourceEdit, setSourceEdit] = useState<number | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode)
  const [cityBackground, setCityBackground] = useState<CityBackground>(() => getCityBackground(themeMode))

  useEffect(() => {
    const updateBackground = () => {
      const resolvedBackground = getCityBackground(themeMode)
      setCityBackground(resolvedBackground)
      document.documentElement.dataset.theme = resolvedBackground === 'evening' ? 'dark' : 'light'
    }
    updateBackground()
    window.localStorage.setItem('krasnopars-theme', themeMode)
    document.documentElement.dataset.themeMode = themeMode
    const timer = window.setInterval(updateBackground, 60_000)
    window.addEventListener('focus', updateBackground)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', updateBackground)
    }
  }, [themeMode])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 7_000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let cancelled = false
    const loadApiData = async () => {
      const [sourceResult, historyResult, regionResult] = await Promise.allSettled([api.sources(), api.searches(), api.regions()])
      void Promise.allSettled([api.health(), api.platforms(), api.aiStatus()])

      if (cancelled) return
      if (sourceResult.status === 'fulfilled') setSources(sourceResult.value.map(mapSource))
      else setApiError(`Источники API недоступны: ${getErrorMessage(sourceResult.reason)}`)

      if (historyResult.status === 'fulfilled') {
        setSaved(historyResult.value.map(item => ({
          id: item.id,
          name: item.query || `Поиск №${item.id}`,
          query: item.query,
          period: formatApiPeriod(item),
          region: item.region || 'Все регионы',
          favorite: false,
        })))
      }
      if (regionResult.status === 'fulfilled' && regionResult.value.length) setRegions(regionResult.value)
    }
    void loadApiData()
    return () => { cancelled = true }
  }, [])

  const togglePlatform = (platform: Platform) => setPlatforms(current => current.includes(platform) ? current.filter(value => value !== platform) : [...current, platform])
  const updateQuery = (value: string) => {
    if (value === query) return
    searchRunRef.current += 1
    setQuery(value)
    setHasSearched(false)
    setIsSearching(false)
    setResults([])
    setSearchId(null)
    setSearchStatus(null)
    setNotice('')
    setApiError('')
  }
  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (isSearching) return
    const missing: string[] = []
    if (!query.trim()) missing.push('query')
    if (!periodStart || !periodEnd) missing.push('period')
    if (!region) missing.push('region')
    if (!platforms.length) missing.push('platforms')
    if (missing.length) {
      setValidationSubmitted(true)
      setApiError('Заполните обязательные поля и выберите хотя бы одну соцсеть.')
      return
    }
    setValidationSubmitted(false)
    const sourceIds = sources.filter(source => source.active && platforms.includes(source.platform)).map(source => source.id)
    if (!sourceIds.length) {
      setApiError('Выберите хотя бы одну площадку с активным источником.')
      return
    }

    const runId = ++searchRunRef.current
    setApiError('')
    setNotice('')
    setIsSearching(true)
    setHasSearched(true)
    setPage('results')
    setResults([])
    try {
      const created = await api.createSearch({
        query: query.trim(),
        searchType: 'TOPIC',
        mode: 'BY_SOURCES',
        sourceIds,
        dateFrom: periodStart || undefined,
        dateTo: periodEnd || undefined,
        region: region || undefined,
        provider: 'real',
        useAi: true,
      })
      if (searchRunRef.current !== runId) return
      setSearchId(created.id)
      setSearchStatus(created.status)
      const completed = await waitForSearch(created.id)
      if (searchRunRef.current !== runId) return
      setSearchStatus(completed.status)
      if (completed.status === 'FAILED') throw new Error(completed.error || 'Поиск завершился с ошибкой.')
      const publicationPage = await api.publications(created.id)
      if (searchRunRef.current !== runId) return
      setResults(publicationPage.content.map(mapPublication))
      setNotice(completed.status === 'COMPLETED_PARTIAL'
        ? `Поиск завершён частично: найдено ${publicationPage.totalElements} публикаций, часть источников недоступна.`
        : `Поиск завершён: найдено ${publicationPage.totalElements} публикаций.`)
    } catch (error) {
      if (searchRunRef.current !== runId) return
      setSearchStatus('FAILED')
      setApiError(getErrorMessage(error))
    } finally {
      if (searchRunRef.current === runId) setIsSearching(false)
    }
  }
  const openSaved = async (item: SavedQuery) => {
    searchRunRef.current += 1
    setQuery(item.query)
    if (item.region !== 'Все регионы') setRegion(item.region)
    setPage('results')
    setHasSearched(true)
    setIsSearching(true)
    setApiError('')
    try {
      const [search, publicationPage] = await Promise.all([api.search(item.id), api.publications(item.id)])
      setSearchId(item.id)
      setSearchStatus(search.status)
      setResults(publicationPage.content.map(mapPublication))
      setNotice(`Загружены результаты поиска №${item.id} из истории API.`)
    } catch (error) {
      setApiError(getErrorMessage(error))
    } finally {
      setIsSearching(false)
    }
  }
  const openSourceDialog = (source?: Source) => { setSourceEdit(source?.id ?? null); setSourceName(source?.name ?? ''); setSourceUrl(source?.url ?? ''); setSourcePlatform(source?.platform ?? 'VK'); setSourceModal(true) }
  const submitSource = async (event: FormEvent) => {
    event.preventDefault()
    if (!sourceName.trim() || !sourceUrl.trim()) return
    setApiError('')
    try {
      const url = /^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : `https://${sourceUrl.trim()}`
      const payload = { name: sourceName.trim(), url, platform: sourcePlatform, active: true }
      const savedSource = sourceEdit === null
        ? await api.createSource(payload)
        : await api.updateSource(sourceEdit, { ...payload, active: sources.find(item => item.id === sourceEdit)?.active ?? true })
      const mapped = mapSource(savedSource)
      setSources(current => sourceEdit === null ? [mapped, ...current] : current.map(item => item.id === sourceEdit ? mapped : item))
      setSourceModal(false)
      setNotice(sourceEdit === null ? 'Источник добавлен через API.' : 'Источник обновлён через API.')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const toggleSource = async (id: number) => {
    const source = sources.find(item => item.id === id)
    if (!source) return
    setApiError('')
    try {
      const updated = await api.updateSource(id, { name: source.name, platform: source.platform, url: source.url, active: !source.active })
      setSources(current => current.map(item => item.id === id ? mapSource(updated) : item))
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const deleteSource = async (id: number) => {
    setApiError('')
    try {
      await api.deleteSource(id)
      setSources(current => current.filter(item => item.id !== id))
      setNotice('Источник удалён через API.')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const removeSaved = async (id: number) => {
    setApiError('')
    try {
      await api.deleteSearch(id)
      setSaved(current => current.filter(item => item.id !== id))
      if (searchId === id) {
        setSearchId(null)
        setResults([])
        setHasSearched(false)
      }
      setNotice('Поиск удалён из истории API.')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const exportResults = async () => {
    if (searchId === null) return
    setApiError('')
    try {
      await downloadSearchExport(searchId, 'xlsx')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }

  if (page === 'login' || page === 'register') return <AuthScreen mode={page} cityBackground={cityBackground} onSwitch={mode => setPage(mode)} onDone={() => setPage('results')}/>
  return <div className="app-shell" data-city-background={cityBackground}>
    <video key={cityBackground} className="theme-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src={cityBackground === 'evening' ? '/winter-snow.mp4' : '/winter-day-snow.mp4'} type="video/mp4"/>
    </video>
    <aside className="app-sidebar">
      <div className="brand-card"><img className="brand-emblem" src="/favicon.png" alt="Герб Красноярского края со львом"/><div><b>КрасноПарс</b><span>Красноярский край</span></div></div>
      <nav className="sidebar-nav">
        <NavItem active={page === 'results' || page === 'publication'} icon={<Newspaper size={18}/>} onClick={() => setPage('results')}>Поиск</NavItem>
        <NavItem active={page === 'sources'} icon={<Users size={18}/>} onClick={() => setPage('sources')}>Источники</NavItem>
        <NavItem active={page === 'saved'} icon={<Bookmark size={18}/>} onClick={() => setPage('saved')}>Сохранённые запросы</NavItem>
        <NavItem active={page === 'settings'} icon={<Settings size={18}/>} onClick={() => setPage('settings')}>Настройки</NavItem>
      </nav>
      <div className="nav-user-actions"><button className="nav-theme-toggle" aria-label={cityBackground === 'evening' ? 'Включить светлую тему' : 'Включить тёмную тему'} title="Сменить тему" onClick={() => setThemeMode(cityBackground === 'evening' ? 'light' : 'dark')}>{cityBackground === 'evening' ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="profile-menu-wrap"><div className="nav-profile" role="button" tabIndex={0} aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(open => !open)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setProfileMenuOpen(open => !open) }}><div className="nav-profile-copy"><b>Иван Петров</b></div>{profileMenuOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>{profileMenuOpen && <div className="profile-menu"><button type="button" onClick={() => { setProfileMenuOpen(false); setPage('login') }}>Выйти</button></div>}</div></div>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><div><b>Справка</b><span>Инструкции и ответы<br/>на частые вопросы →</span></div></div><div className="sidebar-user"><div><b>Иван Петров</b></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main-area">
      <div className="page-content">
        {notice && <div className={`notice ${notice.startsWith('Поиск завершён частично') ? 'notice-partial' : 'notice-success'}`} role="status" aria-live="polite">
          <span className="notice-icon" aria-hidden="true">{notice.startsWith('Поиск завершён частично') ? <CircleAlert size={19}/> : <Check size={19}/>}</span>
          <span className="notice-content">
            <span className="notice-heading"><strong>{notice.startsWith('Поиск завершён частично') ? 'Поиск завершён частично' : 'Поиск завершён'}</strong><i>{notice.startsWith('Поиск завершён частично') ? 'Есть ограничения' : 'Готово'}</i></span>
            <span>{notice.replace(/^Поиск завершён(?: частично)?:\s*/, '')}</span>
          </span>
          <button className="notice-close" onClick={() => setNotice('')} aria-label="Закрыть уведомление"><X size={16}/></button>
          <span className="notice-progress" aria-hidden="true"/>
        </div>}
        {apiError && <div className="api-error"><CircleAlert size={16}/><span>{apiError}</span><button onClick={() => setApiError('')} aria-label="Закрыть"><X size={15}/></button></div>}
        {page === 'results' && <ResultsPage
          results={results} query={query} setQuery={updateQuery} hasSearched={hasSearched} isSearching={isSearching}
          periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
          region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform}
          onSubmit={runSearch} onExport={exportResults} onOpen={item => { setSelectedPublication(item); setPage('publication') }} validationSubmitted={validationSubmitted}
        />}
        {page === 'publication' && selectedPublication && <PublicationPage item={selectedPublication} onBack={() => setPage('results')}/>} 
        {page === 'sources' && <SourcesPage sources={sources} onAdd={() => openSourceDialog()} onEdit={openSourceDialog} onToggle={toggleSource} onDelete={deleteSource}/>}
        {page === 'saved' && <SavedPage
          items={saved} onOpen={openSaved} onRemove={removeSaved}
          onNew={() => { setQuery(''); setHasSearched(false); setPage('results') }}
          onFavorite={id => setSaved(current => current.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item))}
        />}
        {page === 'settings' && <SettingsPage tab={settingsTab} setTab={setSettingsTab} region={region} setRegion={setRegion} themeMode={themeMode} setThemeMode={setThemeMode} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }} saved={settingsSaved}/>}
      </div>
    </main>
    {sourceModal && <div className="modal-backdrop" onClick={() => setSourceModal(false)}><form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={submitSource}><div className="modal-heading"><div><h2>{sourceEdit === null ? 'Добавить источник' : 'Редактировать источник'}</h2><p>Укажите страницу или сообщество для мониторинга</p></div><button type="button" className="icon-button" onClick={() => setSourceModal(false)}><X size={18}/></button></div><label>Название<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Например, Новости города"/></label><label>Ссылка<input required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="vk.com/community"/></label><label>Площадка<select value={sourcePlatform} onChange={event => setSourcePlatform(event.target.value as Platform)}><option>VK</option><option>OK</option><option>MAX</option></select></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setSourceModal(false)}>Отмена</button><button className="button-primary"><Check size={16}/>Сохранить</button></div></form></div>}
  </div>
}

function AuthScreen({ mode, cityBackground, onSwitch, onDone }: { mode: 'login' | 'register'; cityBackground: CityBackground; onSwitch: (mode: 'login' | 'register') => void; onDone: () => void }) {
  return <div className={`auth-screen auth-screen--${mode}`} data-city-background={cityBackground}>
    <video key={cityBackground} className="theme-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src={cityBackground === 'evening' ? '/winter-snow.mp4' : '/winter-day-snow.mp4'} type="video/mp4"/>
    </video>
    <div className="auth-logo"><img className="auth-emblem" src="/favicon.png" alt="Герб Красноярского края со львом"/><div className="auth-logo-text"><b>КрасноПарс</b><span>Красноярский край</span></div></div>
    {mode === 'login' ? <AuthLoginForm onSwitch={onSwitch} onDone={onDone}/> : <AuthRegisterForm onSwitch={onSwitch} onDone={onDone}/>}
  </div>
}

function AuthPasswordInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return <span className="auth-input">
    <Lock size={18}/>
    <input type={show ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required/>
    <button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>{show ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
  </span>
}

function AuthCheck({ checked, onChange, label, variant }: { checked: boolean; onChange: () => void; label: string; variant: 'solid' | 'outline' }) {
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={`auth-check auth-check-${variant} ${checked ? 'auth-check-on' : ''}`} onClick={onChange}><Check size={14} strokeWidth={3.2}/></button>
}

function AuthLoginForm({ onSwitch, onDone }: { onSwitch: (mode: 'login' | 'register') => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) { setError('Введите электронную почту и пароль'); return }
    setError('')
    onDone()
  }
  return <form className="auth-card" onSubmit={submit}>
    <h1>Вход в систему</h1>
    <p className="auth-subtitle">Войдите, чтобы начать работу в системе «КрасноПарс»</p>
    <label className="auth-field">Электронная почта
      <span className="auth-input"><Mail size={18}/><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="example@krsk.ru" required/></span>
    </label>
    <label className="auth-field">Пароль
      <AuthPasswordInput value={password} onChange={setPassword} placeholder="Введите пароль"/>
    </label>
    <div className="auth-row"><AuthCheck checked={remember} onChange={() => setRemember(!remember)} label="Запомнить меня" variant="solid"/><span>Запомнить меня</span></div>
    {error && <p className="auth-error">{error}</p>}
    <button className="auth-submit">Войти</button>
    <p className="auth-alt">Нет аккаунта? <button type="button" onClick={() => onSwitch('register')}>Зарегистрироваться</button></p>
  </form>
}

function AuthRegisterForm({ onSwitch, onDone }: { onSwitch: (mode: 'login' | 'register') => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) { setError('Пароль должен содержать не менее 6 символов'); return }
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    if (!agree) { setError('Согласитесь с политикой обработки персональных данных'); return }
    setError('')
    onDone()
  }
  return <form className="auth-card" onSubmit={submit}>
    <h1>Регистрация</h1>
    <p className="auth-subtitle">Создайте аккаунт для работы в системе «КрасноПарс»</p>
    <label className="auth-field">ФИО
      <span className="auth-input"><User size={18}/><input value={name} onChange={event => setName(event.target.value)} placeholder="Иванов Иван Иванович" required/></span>
    </label>
    <label className="auth-field">Электронная почта
      <span className="auth-input"><Mail size={18}/><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="example@krsk.ru" required/></span>
    </label>
    <label className="auth-field">Пароль
      <AuthPasswordInput value={password} onChange={setPassword} placeholder="Придумайте пароль"/>
    </label>
    <label className="auth-field">Подтверждение пароля
      <AuthPasswordInput value={confirm} onChange={setConfirm} placeholder="Повторите пароль"/>
    </label>
    <div className="auth-row auth-row--top"><AuthCheck checked={agree} onChange={() => setAgree(!agree)} label="Согласие с политикой обработки персональных данных" variant="outline"/><span>Я согласен с <button type="button" className="auth-policy">политикой обработки персональных данных</button></span></div>
    {error && <p className="auth-error">{error}</p>}
    <button className="auth-submit">Зарегистрироваться</button>
    <p className="auth-alt">Уже есть аккаунт? <button type="button" onClick={() => onSwitch('login')}>Войти</button></p>
  </form>
}

function NavItem({ active, icon, onClick, children }: { active: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={`nav-link ${active ? 'nav-active' : ''}`}>{icon}<span>{children}</span></button> }

function PlatformBadge({ platform, size = 44 }: { platform: Platform; size?: number }) {
  if (platform === 'VK') return <span className="pl-badge pl-vk" style={{ width: size, height: size }}><img src="/vk-logo.svg" alt="" aria-hidden="true"/></span>
  if (platform === 'OK') return <span className="pl-badge pl-ok" style={{ width: size, height: size }}>
    <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="18" r="8" fill="#fff"/>
      <path d="M17 34.5c4.4 4.3 9.4 6.4 15 6.4s10.6-2.1 15-6.4" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
      <path d="M27.5 42.5 17 54M36.5 42.5 47 54" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
    </svg>
  </span>
  return <span className="pl-badge pl-max" style={{ width: size, height: size }}>
    <svg width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="33" cy="29" r="19" stroke="#fff" strokeWidth="10"/>
      <path d="M20 43 13.5 54.5" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
}

function Switch({ checked, onChange, blue, large, label }: { checked: boolean; onChange: () => void; blue?: boolean; large?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${blue ? 'switch-blue' : ''} ${large ? 'switch-lg' : ''} ${checked ? 'switch-on' : ''}`} onClick={onChange}><i/></button>
}

function CompactDateInput({ value, min, max, rangeStart, rangeEnd, onChange, label, invalid = false }: { value: string; min?: string; max?: string; rangeStart?: string; rangeEnd?: string; onChange: (value: string) => void; label: string; invalid?: boolean }) {
  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date()
  const [open, setOpen] = useState(false)
  const [periodPicker, setPeriodPicker] = useState<'month' | 'year' | null>(null)
  const [viewMonth, setViewMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const calendarRef = useRef<HTMLDivElement>(null)
  const activeYearRef = useRef<HTMLButtonElement>(null)
  const selectedDayRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!value) return
    const selected = new Date(`${value}T00:00:00`)
    setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!calendarRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setPeriodPicker(null)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  useEffect(() => {
    if (periodPicker !== 'year') return
    window.requestAnimationFrame(() => {
      const option = activeYearRef.current
      if (option?.parentElement) option.parentElement.scrollTop = option.offsetTop - option.parentElement.clientHeight / 2
    })
  }, [periodPicker])

  useEffect(() => {
    if (!open || periodPicker) return
    window.requestAnimationFrame(() => selectedDayRef.current?.focus({ preventScroll: true }))
  }, [open, periodPicker, viewMonth])

  const firstWeekday = (new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay() + 6) % 7
  const calendarStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - firstWeekday)
  const days = Array.from({ length: 42 }, (_, index) => new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index))
  const monthOptions = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(2026, month, 1)))
  const currentYear = new Date().getFullYear()
  const selectedYear = initialDate.getFullYear()
  const firstYear = min ? Number(min.slice(0, 4)) : Math.min(currentYear - 50, selectedYear - 10)
  const lastYear = max ? Number(max.slice(0, 4)) : Math.max(currentYear + 50, selectedYear + 10)
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
  const minMonth = min ? new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, 1) : null
  const maxMonth = max ? new Date(Number(max.slice(0, 4)), Number(max.slice(5, 7)) - 1, 1) : null
  const today = todayInputValue()
  const visibleValues = days.map(formatDateInput)
  const focusValue = visibleValues.includes(value)
    ? value
    : visibleValues.find(dayValue => dayValue === today && (!min || dayValue >= min) && (!max || dayValue <= max))
      ?? visibleValues.find(dayValue => (!min || dayValue >= min) && (!max || dayValue <= max))
  const selectDate = (date: Date) => {
    const nextValue = formatDateInput(date)
    onChange(nextValue)
    setOpen(false)
  }
  const focusDate = (date: Date) => {
    const nextValue = formatDateInput(date)
    if ((min && nextValue < min) || (max && nextValue > max)) return
    setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    window.requestAnimationFrame(() => calendarRef.current?.querySelector<HTMLButtonElement>(`[data-date="${nextValue}"]`)?.focus())
  }
  const moveFocusedDate = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let nextDate: Date | null = null
    if (event.key === 'ArrowLeft') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
    if (event.key === 'ArrowRight') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    if (event.key === 'ArrowUp') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7)
    if (event.key === 'ArrowDown') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
    if (event.key === 'Home') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7))
    if (event.key === 'End') nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (6 - ((date.getDay() + 6) % 7)))
    if (event.key === 'PageUp') nextDate = new Date(date.getFullYear(), date.getMonth() - 1, date.getDate())
    if (event.key === 'PageDown') nextDate = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate())
    if (!nextDate) return
    event.preventDefault()
    focusDate(nextDate)
  }
  const chooseToday = () => {
    if ((min && today < min) || (max && today > max)) return
    onChange(today)
    const current = new Date()
    setViewMonth(new Date(current.getFullYear(), current.getMonth(), 1))
    setOpen(false)
  }

  return <div className={`compact-date-control ${invalid ? 'date-invalid' : ''}`} ref={calendarRef} onKeyDown={event => { if (event.key === 'Escape') { if (periodPicker) setPeriodPicker(null); else setOpen(false) } }}>
    <button type="button" className="compact-date-trigger" aria-label={label} aria-invalid={invalid} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(current => !current); setPeriodPicker(null) }}>
      <span className="compact-date-value">{formatCompactDate(value)}</span>
      <CalendarDays size={15} aria-hidden="true"/>
    </button>
    {open && <div className="date-calendar-popover" role="dialog" aria-label={label}>
      <div className="date-calendar-selection"><span><CalendarDays size={15}/><small>{label}</small></span><strong>{formatCalendarSelection(value)}</strong></div>
      <div className="date-calendar-head">
        <button type="button" aria-label="Предыдущий месяц" disabled={Boolean(minMonth && viewMonth <= minMonth)} onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={17}/></button>
        <div className="date-calendar-period">
          <div className={`date-calendar-select date-calendar-month ${periodPicker === 'month' ? 'open' : ''}`}>
            <button type="button" className="date-calendar-select-trigger" aria-haspopup="listbox" aria-expanded={periodPicker === 'month'} onClick={() => setPeriodPicker(current => current === 'month' ? null : 'month')}><span>{monthOptions[viewMonth.getMonth()]}</span><ChevronDown size={13}/></button>
            {periodPicker === 'month' && <div className="date-calendar-options" role="listbox" aria-label="Выбрать месяц">{monthOptions.map((month, index) => { const monthDate = new Date(viewMonth.getFullYear(), index, 1); const outOfRange = Boolean((minMonth && monthDate < minMonth) || (maxMonth && monthDate > maxMonth)); return <button type="button" role="option" aria-selected={index === viewMonth.getMonth()} className={index === viewMonth.getMonth() ? 'selected' : ''} key={month} disabled={outOfRange} onClick={() => { setViewMonth(monthDate); setPeriodPicker(null) }}>{month}</button> })}</div>}
          </div>
          <div className={`date-calendar-select date-calendar-year ${periodPicker === 'year' ? 'open' : ''}`}>
            <button type="button" className="date-calendar-select-trigger" aria-haspopup="listbox" aria-expanded={periodPicker === 'year'} onClick={() => setPeriodPicker(current => current === 'year' ? null : 'year')}><span>{viewMonth.getFullYear()}</span><ChevronDown size={13}/></button>
            {periodPicker === 'year' && <div className="date-calendar-options" role="listbox" aria-label="Выбрать год">{yearOptions.map(year => <button type="button" role="option" aria-selected={year === viewMonth.getFullYear()} className={year === viewMonth.getFullYear() ? 'selected' : ''} ref={year === viewMonth.getFullYear() ? activeYearRef : undefined} key={year} onClick={() => { setViewMonth(current => new Date(year, current.getMonth(), 1)); setPeriodPicker(null) }}>{year}</button>)}</div>}
          </div>
        </div>
        <button type="button" aria-label="Следующий месяц" disabled={Boolean(maxMonth && viewMonth >= maxMonth)} onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={17}/></button>
      </div>
      <div className="date-calendar-weekdays" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="date-calendar-grid" role="grid">{days.map(date => {
        const dayValue = formatDateInput(date)
        const disabled = Boolean((min && dayValue < min) || (max && dayValue > max))
        const outside = date.getMonth() !== viewMonth.getMonth()
        const inRange = Boolean(rangeStart && rangeEnd && dayValue >= rangeStart && dayValue <= rangeEnd)
        const isSelected = dayValue === value
        const isFocusTarget = dayValue === focusValue
        return <button
          type="button"
          role="gridcell"
          key={dayValue}
          data-date={dayValue}
          ref={isFocusTarget ? selectedDayRef : undefined}
          tabIndex={isFocusTarget ? 0 : -1}
          className={`${isSelected ? 'selected' : ''} ${dayValue === today ? 'today' : ''} ${outside ? 'outside' : ''} ${inRange ? 'in-range' : ''}`}
          disabled={disabled}
          aria-label={new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}
          aria-selected={isSelected}
          onKeyDown={event => moveFocusedDate(event, date)}
          onClick={() => selectDate(date)}
        >{date.getDate()}</button>
      })}</div>
      <div className="date-calendar-footer"><span>← → для выбора</span><div><button type="button" onClick={() => onChange('')} disabled={!value}>Очистить</button><button type="button" onClick={chooseToday} disabled={Boolean((min && today < min) || (max && today > max))}>Сегодня</button></div></div>
    </div>}
  </div>
}

function RegionDropdown({ value, options, onChange, className = '' }: { value: string; options: string[]; onChange: (value: string) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  return <div className={`region-select ${className} ${open ? 'open' : ''}`} ref={dropdownRef} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <button type="button" className="region-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><MapPin size={14}/><span>{value}</span><ChevronDown size={13}/></button>
    {open && <div className="region-select-options" role="listbox" aria-label="Выбрать регион">{options.map(item => <button type="button" role="option" aria-selected={item === value} className={item === value ? 'selected' : ''} key={item} onClick={() => { onChange(item); setOpen(false) }}>{item}</button>)}</div>}
  </div>
}

function SearchPage({ query, setQuery, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, validationSubmitted = false, embedded = false, isSearching = false }: { query: string; setQuery: (v: string) => void; periodStart: string; setPeriodStart: (v: string) => void; periodEnd: string; setPeriodEnd: (v: string) => void; region: string; setRegion: (v: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (p: Platform) => void; onSubmit: (e: FormEvent) => void; validationSubmitted?: boolean; embedded?: boolean; isSearching?: boolean }) {
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [officialOnly, setOfficialOnly] = useState(false)
  const [withMedia, setWithMedia] = useState(false)
  const [excludeReposts, setExcludeReposts] = useState(false)
  if (embedded) return <form className="results-search-panel" onSubmit={onSubmit}>
    <div className="results-search-copy"><h1>Поиск публикаций</h1><p>Введите тему, событие или ключевые слова — найденные публикации появятся ниже.</p></div>
    <div className="results-search-row">
      <div className={`results-query-field ${validationSubmitted && !query.trim() ? 'field-invalid' : ''}`}><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Например, открытие нового ледового дворца в Красноярске"/></div>
      <button type="submit" className="primary-action results-find" disabled={isSearching}><Search size={15}/>{isSearching ? 'Ищем…' : 'Найти'}</button>
    </div>
    <div className="results-search-examples"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
    <div className="results-search-filters">
      <label className={validationSubmitted && !periodStart ? 'field-invalid-label' : ''}><span>Период с</span><CompactDateInput value={periodStart} max={capToToday(periodEnd) || undefined} rangeStart={periodStart} rangeEnd={periodEnd} label="Начало периода" invalid={validationSubmitted && !periodStart} onChange={setPeriodStart}/></label>
      <label className={validationSubmitted && !periodEnd ? 'field-invalid-label' : ''}><span>по</span><CompactDateInput value={periodEnd} min={periodStart} max={todayInputValue()} rangeStart={periodStart} rangeEnd={periodEnd} label="Конец периода" invalid={validationSubmitted && !periodEnd} onChange={setPeriodEnd}/></label>
      <div className={`results-region ${validationSubmitted && !region ? 'field-invalid-label' : ''}`}><span>Регион</span><RegionDropdown value={region} options={regions} onChange={setRegion}/></div>
      <div className={`platform-filter-field ${validationSubmitted && !platforms.length ? 'platform-filter-invalid' : ''}`}><span>Соцсети</span><fieldset className={`platform-filter ${platforms.length === 0 ? 'platform-filter-empty' : ''}`} aria-invalid={platforms.length === 0}><legend>Соцсети</legend>{(['VK', 'OK', 'MAX'] as Platform[]).map(item => <button type="button" key={item} aria-pressed={platforms.includes(item)} className={`${platforms.includes(item) ? 'selected' : 'platform-choice-unselected'} ${platforms.length === 0 ? 'platform-choice-empty' : ''}`} onClick={() => togglePlatform(item)}><PlatformBadge platform={item} size={22}/><span>{item}</span></button>)}{platforms.length === 0 && <small className="platform-filter-hint">Выберите соцсеть для поиска</small>}</fieldset></div>
    </div>
  </form>
  return <div className="search-page">
    <div className="search-main">
      <div className="search-heading"><h1>Поиск публикаций</h1><p>Найдите упоминания, новости и материалы в социальных сетях</p></div>
      <form className="search-card" onSubmit={onSubmit}>
        <div className="search-row">
          <input className={validationSubmitted && !query.trim() ? 'field-invalid' : ''} value={query} onChange={event => setQuery(event.target.value)} placeholder="Опишите тему, событие, укажите ключевые слова или вставьте текст новости..."/>
          <button type="submit" className="find-button"><Search size={16}/>Найти</button>
        </div>
        <div className="search-tags"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
      </form>
      <div className="parameters-card">
        <div className="filters-card">
          <div className="filter-block">
            <span className="filter-label">Период публикации</span>
            <div className={`period-box ${validationSubmitted && (!periodStart || !periodEnd) ? 'field-invalid' : ''}`}>
              <CalendarDays size={17}/>
              <input type="date" value={periodStart} max={capToToday(periodEnd) || undefined} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setPeriodStart(periodEnd && capped > periodEnd ? periodEnd : capped) }} aria-label="Начало периода"/>
              <span className="period-dash">—</span>
              <input type="date" value={periodEnd} min={periodStart} max={todayInputValue()} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setPeriodEnd(periodStart && capped < periodStart ? periodStart : capped) }} aria-label="Конец периода"/>
              <ChevronDown size={15}/>
            </div>
          </div>
          <div className="filter-block">
            <span className="filter-label">Регион</span>
            <RegionDropdown className={`region-box ${validationSubmitted && !region ? 'field-invalid' : ''}`} value={region} options={regions} onChange={setRegion}/>
          </div>
        </div>
        <div className="sources-card">
          <div className="sources-left">
            <h3>Источники поиска</h3>
            <div className="scope-row">
              <label className="radio"><input type="radio" name="search-scope" checked={scope === 'all'} onChange={() => setScope('all')}/><i/><span>Все источники</span></label>
              <label className="radio"><input type="radio" name="search-scope" checked={scope === 'selected'} onChange={() => setScope('selected')}/><i/><span>Только выбранные</span></label>
            </div>
            <div className="mini-toggle"><Switch checked={officialOnly} onChange={() => setOfficialOnly(!officialOnly)} blue label="Только официальные источники"/><span>Только официальные источники</span></div>
            <h3 className="extra-heading">Дополнительные настройки</h3>
            <div className="mini-toggle"><Switch checked={withMedia} onChange={() => setWithMedia(!withMedia)} blue label="Только с медиа"/><span>Только с медиа (фото, видео)</span></div>
            <div className="mini-toggle"><Switch checked={excludeReposts} onChange={() => setExcludeReposts(!excludeReposts)} blue label="Исключить репосты"/><span>Исключить репосты</span></div>
          </div>
          <div className={`sources-right ${validationSubmitted && !platforms.length ? 'platform-filter-invalid' : ''}`}>
            <div className="platforms-heading"><strong>Соцсети</strong><small>Отключите площадки, которые не нужны в поиске</small></div>
            <div className={`tiles-panel ${platforms.length === 0 ? 'platform-tiles-empty' : ''}`}>
              {(['VK', 'OK', 'MAX'] as Platform[]).map(item => <div className={`ptile ${platforms.includes(item) ? 'ptile-selected' : 'ptile-unselected'} ${platforms.length === 0 ? 'platform-choice-empty' : ''}`} key={item} role="button" tabIndex={0} aria-pressed={platforms.includes(item)} onClick={() => togglePlatform(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); togglePlatform(item) } }}>
                <PlatformBadge platform={item}/>
                <span className="ptile-name">{platformLabel[item]}</span>
                <small className="ptile-status">{platforms.includes(item) ? 'Включено' : 'Выключено'}</small>
                <span onClick={event => event.stopPropagation()}><Switch checked={platforms.includes(item)} onChange={() => togglePlatform(item)} blue large label={`${platforms.includes(item) ? 'Выключить' : 'Включить'} ${platformLabel[item]} в поиске`}/></span>
              </div>)}
            </div>{platforms.length === 0 && <div className="platform-tiles-hint" role="status"><CircleAlert size={14}/>Выберите соцсеть для поиска</div>}
            <button type="button" className="adv-link">Расширенные настройки <ArrowRight size={15}/></button>
          </div>
        </div>
      </div>
    </div>
    <aside className="hero-pane">
      <div className="hero-overlay">
        <h2>Красноярский край<br/>в медиапространстве</h2>
        <p>Быстрый и удобный поиск публикаций в социальных сетях по событиям, темам и ключевым словам.</p>
        <div className="hero-stats">
          {([['VK', '12 450'], ['OK', '5 230'], ['MAX', '1 980']] as [Platform, string][]).map(([platform, count]) => <div className="hero-stat" key={platform}>
            <span className="hero-pl"><PlatformBadge platform={platform} size={26}/>{platformLabel[platform]}</span>
            <strong>{count}</strong>
          </div>)}
        </div>
      </div>
    </aside>
  </div>
}
function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: () => void; title: string; description: string }) { return <div className="toggle-row"><div><b>{title}</b><span>{description}</span></div><button type="button" className={`switch ${checked ? 'switch-on' : ''}`} onClick={onChange} role="switch" aria-checked={checked}><i/></button></div> }

function SortDropdown({ value, onChange }: { value: 'relevance' | 'newest'; onChange: (value: 'relevance' | 'newest') => void }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const options = [
    { value: 'relevance' as const, label: 'По релевантности' },
    { value: 'newest' as const, label: 'Сначала новые' },
  ]
  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])
  const selected = options.find(option => option.value === value) ?? options[0]
  return <div className={`sort-dropdown ${open ? 'open' : ''}`} ref={dropdownRef}>
    <button type="button" className="sort-dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{selected.label}</span><ChevronDown size={15}/></button>
    {open && <div className="sort-dropdown-options" role="listbox" aria-label="Выбрать сортировку">{options.map(option => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} key={option.value} onClick={() => { onChange(option.value); setOpen(false) }}>{option.label}{option.value === value && <Check size={14}/>}</button>)}</div>}
  </div>
}

function ResultsPage({ results, query, setQuery, hasSearched, isSearching, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, onExport, onOpen, validationSubmitted = false }: { results: Publication[]; query: string; setQuery: (value: string) => void; hasSearched: boolean; isSearching: boolean; periodStart: string; setPeriodStart: (value: string) => void; periodEnd: string; setPeriodEnd: (value: string) => void; region: string; setRegion: (value: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (platform: Platform) => void; onSubmit: (event: FormEvent) => void; onExport: () => void; onOpen: (item: Publication) => void; validationSubmitted?: boolean }) {
  const [resultPage, setResultPage] = useState(1)
  const [sort, setSort] = useState<'relevance' | 'newest'>('relevance')
  const [savedResult, setSavedResult] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const shown = sort === 'newest' ? [...results].reverse() : results
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const pageStart = (resultPage - 1) * pageSize
  const pageItems = shown.slice(pageStart, pageStart + pageSize)
  const prettyDate = (value: string) => value.split('-').reverse().join('.')
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const resultsCardRef = useRef<HTMLElement>(null)
  useEffect(() => { setResultPage(1) }, [results, sort])
  const goToResultPage = (nextPage: number) => {
    setResultPage(Math.min(pages, Math.max(1, nextPage)))
    window.requestAnimationFrame(() => resultsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  return <div className="design-page results-page">
    <SearchPage embedded query={query} setQuery={setQuery} periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd} region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform} onSubmit={onSubmit} validationSubmitted={validationSubmitted} isSearching={isSearching}/>
    {hasSearched ? isSearching ? <div className="results-empty-state results-loading"><span><Search size={24}/></span><h2>Идёт поиск публикаций</h2><p>Сервер обрабатывает источники.</p></div> : <>
    <div className="design-page-heading results-found-heading"><div><h1>Результаты поиска</h1><p className="results-query-caption">Запрос: «{query}»</p></div><div className="heading-actions"><button onClick={() => setSavedResult(!savedResult)} className={`soft-action ${savedResult ? 'soft-action-saved' : ''}`}><Bookmark size={14}/>{savedResult ? 'Запрос сохранён' : 'Сохранить запрос'}</button><button onClick={onExport} className="primary-action" disabled={!results.length}><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar">
      <div className="summary-filter"><CalendarDays size={15}/><span>{prettyDate(periodStart)} — {prettyDate(periodEnd)}</span></div>
      <div className="summary-filter"><MapPin size={15}/><span>{region}</span></div>
      <span className="results-platform-summary">{platforms.length ? platforms.join(' · ') : 'Площадки не выбраны'}</span>
    </div>
    <section ref={resultsCardRef} className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{results.length}</strong> публикаций</h2><p>Показываем отдельные размещения с прямыми ссылками на источник</p></div><div className="sort-control"><span>Сортировка</span><SortDropdown value={sort} onChange={setSort}/></div></div>
      <div className="result-rows">{pageItems.map(item => <article key={item.id} className="result-row"><input aria-label={`Выбрать публикацию: ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><button type="button" onClick={() => onOpen(item)} className="result-photo publication-thumb has-image"><img className="media-photo" src={item.image} alt=""/><span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform === 'OK' ? '✦' : item.platform === 'MAX' ? '●' : 'ᴠκ'}</span></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{item.title}</button><a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a></div><p>{item.excerpt}</p><div className="result-metadata"><span><Users size={12}/>{item.source}</span><span>{item.date}</span></div><div className="result-engagement"><span><Heart size={13}/>{item.likes}</span><span><Eye size={13}/>{item.views}</span><span><Share2 size={13}/>{item.reposts}</span><span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span></div></div></article>)}</div>
      <div className="results-pagination"><span>Показано <b>{results.length ? pageStart + 1 : 0}–{Math.min(pageStart + pageSize, results.length)}</b> из <b>{results.length}</b> публикаций</span><div className="results-page-navigation"><div className="results-page-controls"><button type="button" aria-label="Предыдущая страница" title="Предыдущая страница" disabled={resultPage === 1} onClick={() => goToResultPage(resultPage - 1)}><ChevronLeft size={16}/></button><span className="results-current-page" aria-label={`Текущая страница ${resultPage}`}>{resultPage}</span><button type="button" aria-label="Следующая страница" title="Следующая страница" disabled={resultPage === pages} onClick={() => goToResultPage(resultPage + 1)}><ChevronRight size={16}/></button></div></div></div>
    </section>
    </> : <div className="results-empty-state"><span><Search size={24}/></span><h2>Введите запрос, чтобы начать поиск</h2><p>Результаты публикаций появятся здесь сразу после нажатия кнопки «Найти».</p></div>}
  </div>
}

function PublicationPage({ item, onBack }: { item: Publication; onBack: () => void }) {
  const [liked, setLiked] = useState(false)

  return <div className="publication-page">
    <button type="button" className="publication-back" onClick={onBack}><ArrowLeft size={15}/>Назад к результатам</button>
    <div className="publication-layout">
      <article className="publication-card">
        <header className="publication-header">
          <div className="publication-source-avatar" style={{ backgroundColor: item.color }}>{item.source.slice(0, 1)}</div>
          <div><strong>{item.source}</strong><span>{item.date}</span></div>
          <span className={`publication-platform ${item.platform.toLowerCase()}`}>{platformLabel[item.platform]}</span>
        </header>
        <img className="publication-cover" src={item.image} alt={item.title}/>
        <div className="publication-content">
          <span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span>
          <h1>{item.title}</h1>
          <p>{item.excerpt.replace(/…$/, '.')}</p>
          {item.aiComment && <p><strong>Комментарий GigaChat:</strong> {item.aiComment}</p>}
          {item.aiRelevance !== null && <div className="publication-tags"><span>Оценка ИИ: {Math.round(item.aiRelevance * 100)}%</span></div>}
        </div>
        <footer className="publication-actions">
          <button type="button" className={liked ? 'liked' : ''} onClick={() => setLiked(!liked)}><Heart size={16} fill={liked ? 'currentColor' : 'none'}/>{item.likes + (liked ? 1 : 0)}</button>
          <span><Eye size={16}/>{item.views}</span><span><Share2 size={16}/>{item.reposts}</span>
          <a href={item.url} target="_blank" rel="noreferrer">Открыть оригинал <ExternalLink size={14}/></a>
        </footer>
      </article>
      <aside className="publication-info">
        <h2>О публикации</h2>
        <dl><div><dt>Источник</dt><dd>{item.source}</dd></div><div><dt>Площадка</dt><dd>{platformLabel[item.platform]}</dd></div><div><dt>Дата публикации</dt><dd>{item.date}</dd></div><div><dt>Соответствие запросу</dt><dd>{item.kind}</dd></div></dl>
        <button type="button"><Bookmark size={15}/>Сохранить публикацию</button>
      </aside>
    </div>
  </div>
}

function SourcesPage({ sources, onAdd, onEdit, onToggle, onDelete }: { sources: Source[]; onAdd: () => void; onEdit: (source: Source) => void; onToggle: (id: number) => void; onDelete: (id: number) => void }) {
  return <section className="repository-sources"><div className="repository-source-heading"><div><div className="repository-kicker"><Users size={13}/>Справочник</div><h1>Источники публикаций</h1><p>Сообщества и каналы для поиска по выбранному списку</p></div><button onClick={onAdd}><Plus size={15}/>Добавить источник</button></div>
    <div className="panel repository-source-list"><div className="repository-source-list-head"><div><h2>Мой список</h2><p>{sources.length} источников · нажмите, чтобы выбрать для поиска</p></div><button onClick={() => sources.filter(item => !item.active).forEach(item => onToggle(item.id))}>Выбрать все</button></div>
      <div>{sources.map(source => <div key={source.id} className="repository-source-row"><button onClick={() => onToggle(source.id)} aria-label={`Выбрать ${source.name}`} className={`repository-check ${source.active ? 'checked' : ''}`}><Check size={12}/></button><button onClick={() => onEdit(source)} style={{backgroundColor:`${source.color}18`,color:source.color}} className="repository-source-avatar">{source.name.slice(0,1)}</button><div className="repository-source-copy"><button onClick={() => onEdit(source)}>{source.name}</button><a href={source.url} target="_blank" rel="noreferrer">{source.url.replace(/^https?:\/\//, '')}<ExternalLink size={9}/></a></div><span className={`repository-platform ${source.platform.toLowerCase()}`}>{source.platform === 'OK' ? 'ОДНОКЛАССНИКИ' : source.platform}</span><span className="repository-followers">{source.followers}</span><span className={`repository-status ${source.active ? '' : 'offline'}`}><i/>{source.active ? 'Доступен' : 'Отключён'}</span><button onClick={() => onDelete(source.id)} className="repository-delete" aria-label={`Удалить ${source.name}`}>×</button></div>)}</div>
      <div className="repository-source-note">Сохранённые источники остаются в списке для следующих поисков. Добавление и доступность показаны в демо-режиме.</div>
    </div>
  </section>
}

function SavedPage({ items, onOpen, onRemove, onNew, onFavorite }: { items: SavedQuery[]; onOpen: (item: SavedQuery) => void; onRemove: (id: number) => void; onNew: () => void; onFavorite: (id: number) => void }) {
  return <section className="saved-shell">
    <header className="saved-page-head"><div><h1>Сохранённые запросы</h1><p>Быстрый доступ к часто используемым темам</p></div><button className="button-primary" onClick={onNew}><Plus size={16}/>Новый запрос</button></header>
    <div className="saved-table-wrap"><table className="saved-queries-table"><thead><tr><th><input type="checkbox" aria-label="Выбрать все запросы"/></th><th>Название</th><th>Запрос</th><th>Период</th><th>Регион</th><th>Действия</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><button className={`favorite-star ${item.favorite ? 'favorite-on' : ''}`} title={item.favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavorite(item.id)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'}/></button></td><td><button className="saved-query-name" onClick={() => onOpen(item)}>{item.name}</button></td><td><span className="saved-query-text">{item.query}</span></td><td>{item.period}</td><td>{item.region}</td><td><details className="saved-actions"><summary aria-label="Действия с запросом"><MoreHorizontal size={17}/></summary><div><button onClick={() => onOpen(item)}>Открыть запрос</button><button onClick={() => onFavorite(item.id)}>{item.favorite ? 'Убрать из избранного' : 'В избранное'}</button><button className="danger-action" onClick={() => onRemove(item.id)}>Удалить</button></div></details></td></tr>)}</tbody></table>{items.length === 0 && <div className="empty-state">Пока нет сохранённых запросов</div>}</div>
  </section>
}

function SettingsPage({ tab, setTab, region, setRegion, themeMode, setThemeMode, onSave, saved }: { tab: string; setTab: (v: string) => void; region: string; setRegion: (v: string) => void; themeMode: ThemeMode; setThemeMode: (v: ThemeMode) => void; onSave: () => void; saved: boolean }) {
  const tabs = ['Основные', 'Уведомления', 'Экспорт', 'Интерфейс']
  const [verify, setVerify] = useState(true)
  const [emailNotices, setEmailNotices] = useState(true)
  const [newMentions, setNewMentions] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)
  return <section className="settings-shell">
    <header className="settings-page-head">
      <h1>Настройки</h1>
      <p>Основные параметры работы приложения</p>
    </header>
    <div className="settings-tabs">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'settings-tab-active' : ''}>{item}</button>)}</div>
    <div className="settings-body">
      {tab === 'Основные' && <div className="settings-form">
        <div className="settings-row settings-region-row">
          <strong>Регион поиска</strong>
          <label className="settings-select"><MapPin size={15}/><select value={region} onChange={event => setRegion(event.target.value)}><option>Красноярский край</option><option>Красноярск</option><option>Ачинск</option><option>Норильск</option></select></label>
          <p>Основной регион для поиска публикаций</p>
        </div>
        <div className="settings-row">
          <strong>Проверка ссылок</strong>
          <div className="settings-option"><Toggle checked={verify} onChange={() => setVerify(!verify)} title="Автоматически проверять ссылку на доступность" description="Система будет проверять, что ссылка ведёт на существующую публикацию"/></div>
        </div>
        <div className="settings-row">
          <strong>Уведомления</strong>
          <div className="settings-option settings-notifications"><Toggle checked={newMentions} onChange={() => setNewMentions(!newMentions)} title="Уведомлять о завершении поиска" description=""/><Toggle checked={emailNotices} onChange={() => setEmailNotices(!emailNotices)} title="Уведомлять о недоступных публикациях" description=""/></div>
        </div>
      </div>}
      {tab === 'Уведомления' && <div className="settings-form"><div className="settings-row"><strong>Уведомления</strong><div className="settings-option settings-notifications"><Toggle checked={emailNotices} onChange={() => setEmailNotices(!emailNotices)} title="Уведомления на электронную почту" description="Важные обновления и системные сообщения"/><Toggle checked={newMentions} onChange={() => setNewMentions(!newMentions)} title="Новые упоминания" description="Сообщать о новых публикациях по активным запросам"/><Toggle checked={weeklyReport} onChange={() => setWeeklyReport(!weeklyReport)} title="Еженедельный отчёт" description="Сводка по активности и динамике упоминаний"/></div></div></div>}
      {tab === 'Экспорт' && <div className="settings-form"><div className="settings-row"><strong>Экспорт данных</strong><div className="settings-option settings-fields"><label>Формат по умолчанию<select><option>Excel (.xlsx)</option><option>CSV (.csv)</option><option>PDF (.pdf)</option></select></label><label>Кодировка CSV<select><option>UTF-8</option><option>Windows-1251</option></select></label><Toggle checked title="Включать ссылки на оригинал" description="Добавлять прямую ссылку на каждую публикацию" onChange={() => {}}/></div></div></div>}
      {tab === 'Интерфейс' && <div className="settings-form"><div className="settings-row"><strong>Интерфейс</strong><div className="settings-option settings-fields"><label>Тема оформления<select value={themeMode} onChange={event => setThemeMode(event.target.value as ThemeMode)}><option value="system">Системная — по времени</option><option value="light">Светлая — дневная фотография</option><option value="dark">Тёмная — вечерняя фотография</option></select></label><label>Плотность таблиц<select><option>Стандартная</option><option>Компактная</option><option>Свободная</option></select></label><label>Язык интерфейса<select><option>Русский</option><option>English</option></select></label></div></div></div>}
    </div>
    <footer className="settings-footer"><button className="button-primary" onClick={onSave}>{saved ? <><Check size={15}/>Сохранено</> : 'Сохранить изменения'}</button></footer>
  </section>
}

export default App

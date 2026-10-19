import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, downloadSearchExport, waitForSearch } from './api'
import type { ApiPublication, ApiSearch, ApiSource } from './api'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell,
  Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CircleHelp, Download, ExternalLink, Eye, EyeOff, Heart, Lock, Mail, MapPin,
  MoreHorizontal, Newspaper, Plus, Search, Settings, Share2, Star, TrendingUp, User, Users, X,
} from 'lucide-react'

type Page = 'login' | 'register' | 'results' | 'publication' | 'sources' | 'saved' | 'analytics' | 'settings'
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

const initialSources: Source[] = [
  { id: 1, name: 'Наш Красноярский край', platform: 'VK', url: 'vk.com/krskstate', followers: '245K', region: 'Красноярский край', active: true, color: '#284b83' },
  { id: 2, name: 'Спорт_Красноярск', platform: 'VK', url: 'vk.com/sportkrsk', followers: '128K', region: 'Красноярский край', active: true, color: '#26364e' },
  { id: 3, name: 'Новости Красноярска', platform: 'OK', url: 'ok.ru/news.krsk', followers: '86K', region: 'Красноярский край', active: true, color: '#d5222b' },
  { id: 4, name: 'Культура Красноярья', platform: 'OK', url: 'ok.ru/culturekrsk', followers: '42K', region: 'Красноярский край', active: true, color: '#99820f' },
  { id: 5, name: 'Красноярск. Главное', platform: 'MAX', url: 'max.ru/krasnoyarsk', followers: '38K', region: 'Красноярский край', active: true, color: '#5d4a37' },
  { id: 6, name: 'ЧП Красноярск', platform: 'VK', url: 'vk.com/chp_krsk', followers: '512K', region: 'Красноярский край', active: true, color: '#312c6f' },
]
const initialSaved: SavedQuery[] = [
  { id: 1, name: 'Ледовый дворец', query: 'открытие ледового дворца Красноярск', period: '01.03.2024 — 31.03.2024', region: 'Красноярский край', favorite: true },
  { id: 2, name: 'Наводнение 2024', query: 'наводнение Красноярский край', period: '01.04.2024 — 30.04.2024', region: 'Красноярский край', favorite: true },
  { id: 3, name: 'Губернатор края', query: 'губернатор Красноярского края', period: '01.01.2024 — 31.03.2024', region: 'Красноярский край', favorite: true },
  { id: 4, name: 'Развитие спорта', query: 'развитие спорта Красноярск', period: '01.01.2024 — 31.12.2024', region: 'Красноярский край', favorite: true },
  { id: 5, name: 'Строительство', query: 'строительство Красноярск', period: '01.01.2024 — 31.12.2024', region: 'Красноярский край', favorite: true },
]
const platformLabel: Record<Platform, string> = { VK: 'VK', OK: 'Одноклассники', MAX: 'MAX' }
const exampleTopics = ['ледовый дворец Красноярск', 'губернатор края', 'наводнение 2024', 'развитие спорта']

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
  const [periodStart, setPeriodStart] = useState('2024-03-01')
  const [periodEnd, setPeriodEnd] = useState('2024-03-31')
  const [region, setRegion] = useState('Красноярский край')
  const [regions, setRegions] = useState(['Красноярский край', 'Красноярск', 'Ачинск', 'Норильск'])
  const [platforms, setPlatforms] = useState<Platform[]>(['VK', 'OK', 'MAX'])
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [results, setResults] = useState<Publication[]>([])
  const [searchId, setSearchId] = useState<number | null>(null)
  const [searchStatus, setSearchStatus] = useState<ApiSearch['status'] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
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
  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || isSearching) return
    const sourceIds = sources.filter(source => source.active && platforms.includes(source.platform)).map(source => source.id)
    if (!sourceIds.length) {
      setApiError('Выберите хотя бы одну площадку с активным источником.')
      return
    }

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
      setSearchId(created.id)
      setSearchStatus(created.status)
      const completed = await waitForSearch(created.id)
      setSearchStatus(completed.status)
      if (completed.status === 'FAILED') throw new Error(completed.error || 'Поиск завершился с ошибкой.')
      const publicationPage = await api.publications(created.id)
      setResults(publicationPage.content.map(mapPublication))
      setNotice(completed.status === 'COMPLETED_PARTIAL'
        ? `Поиск завершён частично: найдено ${publicationPage.totalElements} публикаций, часть источников недоступна.`
        : `Поиск завершён: найдено ${publicationPage.totalElements} публикаций.`)
    } catch (error) {
      setSearchStatus('FAILED')
      setApiError(getErrorMessage(error))
    } finally {
      setIsSearching(false)
    }
  }
  const openSaved = async (item: SavedQuery) => {
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
    <ThemeBackgroundVideo variant={cityBackground}/>
    <aside className="app-sidebar">
      <div className="brand-card"><div className="brand-mark brand-flame" aria-hidden="true"><i/><i/><i/></div><div><b>КрасноПарс</b><span>Красноярский край</span></div></div>
      <nav className="sidebar-nav">
        <NavItem active={page === 'results' || page === 'publication'} icon={<Newspaper size={18}/>} onClick={() => setPage('results')}>Результаты</NavItem>
        <NavItem active={page === 'sources'} icon={<Users size={18}/>} onClick={() => setPage('sources')}>Источники</NavItem>
        <NavItem active={page === 'saved'} icon={<Bookmark size={18}/>} onClick={() => setPage('saved')}>Сохранённые запросы</NavItem>
        <NavItem active={page === 'analytics'} icon={<BarChart3 size={18}/>} onClick={() => setPage('analytics')}>Аналитика</NavItem>
        <NavItem active={page === 'settings'} icon={<Settings size={18}/>} onClick={() => setPage('settings')}>Настройки</NavItem>
      </nav>
      <div className="nav-user-actions"><button className="nav-bell" aria-label="Уведомления"><Bell size={18}/><i/></button><div className="nav-profile"><div className="avatar">ИП</div><div><b>Иван Петров</b><span>Сотрудник агентства</span></div><ChevronDown size={14}/></div></div>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><div><b>Справка</b><span>Инструкции и ответы<br/>на частые вопросы →</span></div></div><div className="sidebar-user"><div className="avatar">ИП</div><div><b>Иван Петров</b><span>Сотрудник агентства</span></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main-area">
      <div className="page-content">
        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Закрыть"><X size={15}/></button></div>}
        {apiError && <div className="api-error"><CircleAlert size={16}/><span>{apiError}</span><button onClick={() => setApiError('')} aria-label="Закрыть"><X size={15}/></button></div>}
        {page === 'results' && <ResultsPage
          results={results} query={query} setQuery={setQuery} hasSearched={hasSearched} isSearching={isSearching} searchStatus={searchStatus}
          periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
          region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform}
          onSubmit={runSearch} onExport={exportResults} onOpen={item => { setSelectedPublication(item); setPage('publication') }}
        />}
        {page === 'publication' && selectedPublication && <PublicationPage item={selectedPublication} onBack={() => setPage('results')}/>} 
        {page === 'sources' && <SourcesPage sources={sources} onAdd={() => openSourceDialog()} onEdit={openSourceDialog} onToggle={toggleSource} onDelete={deleteSource}/>}
        {page === 'saved' && <SavedPage
          items={saved} onOpen={openSaved} onRemove={removeSaved}
          onNew={() => { setQuery(''); setHasSearched(false); setPage('results') }}
          onFavorite={id => setSaved(current => current.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item))}
        />}
        {page === 'analytics' && <AnalyticsPage/>}
        {page === 'settings' && <SettingsPage tab={settingsTab} setTab={setSettingsTab} region={region} setRegion={setRegion} themeMode={themeMode} setThemeMode={setThemeMode} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }} saved={settingsSaved}/>}
      </div>
    </main>
    {sourceModal && <div className="modal-backdrop" onClick={() => setSourceModal(false)}><form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={submitSource}><div className="modal-heading"><div><h2>{sourceEdit === null ? 'Добавить источник' : 'Редактировать источник'}</h2><p>Укажите страницу или сообщество для мониторинга</p></div><button type="button" className="icon-button" onClick={() => setSourceModal(false)}><X size={18}/></button></div><label>Название<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Например, Новости города"/></label><label>Ссылка<input required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="vk.com/community"/></label><label>Площадка<select value={sourcePlatform} onChange={event => setSourcePlatform(event.target.value as Platform)}><option>VK</option><option>OK</option><option>MAX</option></select></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setSourceModal(false)}>Отмена</button><button className="button-primary"><Check size={16}/>Сохранить</button></div></form></div>}
  </div>
}

function ThemeBackgroundVideo({ variant }: { variant: CityBackground }) {
  const videoSrc = variant === 'evening' ? '/video/dark-theme.mp4' : '/video/light-theme.mp4'

  return <video
    key={variant}
    className="theme-background-video"
    src={videoSrc}
    autoPlay
    muted
    loop
    playsInline
    preload="metadata"
    aria-hidden="true"
  />
}

function AuthScreen({ mode, cityBackground, onSwitch, onDone }: { mode: 'login' | 'register'; cityBackground: CityBackground; onSwitch: (mode: 'login' | 'register') => void; onDone: () => void }) {
  return <div className={`auth-screen auth-screen--${mode}`} data-city-background={cityBackground}>
    <ThemeBackgroundVideo variant={cityBackground}/>
    <div className="auth-logo"><span className="auth-flame" aria-hidden="true"><i/><i/><i/></span><div className="auth-logo-text"><b>КрасноПарс</b><span>Красноярский край</span></div></div>
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
  if (platform === 'VK') return <span className="pl-badge pl-vk" style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}>VK</span>
  if (platform === 'OK') return <span className="pl-badge pl-ok" style={{ width: size, height: size }}>
    <svg width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="6.7" r="3.1" fill="#fff"/>
      <path d="M6.6 12.9c1.6 1.6 3.4 2.4 5.4 2.4s3.8-.8 5.4-2.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M9 15.6c-.7 1.9-1.9 3.5-3.6 4.9M15 15.6c.7 1.9 1.9 3.5 3.6 4.9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  </span>
  return <span className="pl-badge pl-max" style={{ width: size, height: size }}>
    <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.4a8.6 8.6 0 1 0 5 15.6l3.7 1-1-3.5a8.6 8.6 0 0 0-7.7-13.1Z" fill="#fff"/>
      <circle cx="12" cy="12" r="2.9" fill="#6c3bf5"/>
    </svg>
  </span>
}

function Switch({ checked, onChange, blue, large, label }: { checked: boolean; onChange: () => void; blue?: boolean; large?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${blue ? 'switch-blue' : ''} ${large ? 'switch-lg' : ''} ${checked ? 'switch-on' : ''}`} onClick={onChange}><i/></button>
}

function SearchPage({ query, setQuery, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, embedded = false, isSearching = false }: { query: string; setQuery: (v: string) => void; periodStart: string; setPeriodStart: (v: string) => void; periodEnd: string; setPeriodEnd: (v: string) => void; region: string; setRegion: (v: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (p: Platform) => void; onSubmit: (e: FormEvent) => void; embedded?: boolean; isSearching?: boolean }) {
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [officialOnly, setOfficialOnly] = useState(false)
  const [withMedia, setWithMedia] = useState(false)
  const [excludeReposts, setExcludeReposts] = useState(false)
  if (embedded) return <form className="results-search-panel" onSubmit={onSubmit}>
    <div className="results-search-copy"><h1>Результаты</h1><p>Введите тему, событие или ключевые слова — найденные публикации появятся ниже.</p></div>
    <div className="results-search-row">
      <div className="results-query-field"><Search size={17}/><input required value={query} onChange={event => setQuery(event.target.value)} placeholder="Например, открытие нового ледового дворца в Красноярске"/></div>
      <button type="submit" className="primary-action results-find" disabled={isSearching}><Search size={15}/>{isSearching ? 'Ищем…' : 'Найти'}</button>
    </div>
    <div className="results-search-examples"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
    <div className="results-search-filters">
      <label><span>Период с</span><div><CalendarDays size={14}/><input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)}/></div></label>
      <label><span>по</span><div><CalendarDays size={14}/><input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)}/></div></label>
      <label className="results-region"><span>Регион</span><div><MapPin size={14}/><select value={region} onChange={event => setRegion(event.target.value)}>{regions.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></div></label>
      <fieldset><legend>Площадки</legend>{(['VK', 'OK', 'MAX'] as Platform[]).map(item => <button type="button" key={item} className={platforms.includes(item) ? 'selected' : ''} onClick={() => togglePlatform(item)}><PlatformBadge platform={item} size={20}/>{item}</button>)}</fieldset>
    </div>
  </form>
  return <div className="search-page">
    <div className="search-main">
      <div className="search-heading"><h1>Поиск публикаций</h1><p>Найдите упоминания, новости и материалы в социальных сетях</p></div>
      <form className="search-card" onSubmit={onSubmit}>
        <div className="search-row">
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Опишите тему, событие, укажите ключевые слова или вставьте текст новости..."/>
          <button type="submit" className="find-button"><Search size={16}/>Найти</button>
        </div>
        <div className="search-tags"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
      </form>
      <div className="parameters-card">
        <div className="filters-card">
          <div className="filter-block">
            <span className="filter-label">Период публикации</span>
            <div className="period-box">
              <CalendarDays size={17}/>
              <input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} aria-label="Начало периода"/>
              <span className="period-dash">—</span>
              <input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} aria-label="Конец периода"/>
              <ChevronDown size={15}/>
            </div>
          </div>
          <div className="filter-block">
            <span className="filter-label">Регион</span>
            <div className="region-box">
              <MapPin size={17}/>
              <select value={region} onChange={event => setRegion(event.target.value)} aria-label="Регион">
                {regions.map(item => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={16}/>
            </div>
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
          <div className="sources-right">
            <div className="tiles-panel">
              {(['VK', 'OK', 'MAX'] as Platform[]).map(item => <div className="ptile" key={item}>
                <PlatformBadge platform={item}/>
                <span className="ptile-name">{platformLabel[item]}</span>
                <Switch checked={platforms.includes(item)} onChange={() => togglePlatform(item)} blue large label={`Искать в ${platformLabel[item]}`}/>
              </div>)}
            </div>
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

function ResultsPage({ results, query, setQuery, hasSearched, isSearching, searchStatus, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, onExport, onOpen }: { results: Publication[]; query: string; setQuery: (value: string) => void; hasSearched: boolean; isSearching: boolean; searchStatus: ApiSearch['status'] | null; periodStart: string; setPeriodStart: (value: string) => void; periodEnd: string; setPeriodEnd: (value: string) => void; region: string; setRegion: (value: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (platform: Platform) => void; onSubmit: (event: FormEvent) => void; onExport: () => void; onOpen: (item: Publication) => void }) {
  const [resultPage, setResultPage] = useState(1)
  const [sort, setSort] = useState<'relevance' | 'newest'>('relevance')
  const [savedResult, setSavedResult] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const shown = sort === 'newest' ? [...results].reverse() : results
  const pageSize = 4
  const pageItems = shown.slice((resultPage - 1) * pageSize, resultPage * pageSize)
  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const prettyDate = (value: string) => value.split('-').reverse().join('.')
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  return <div className="design-page results-page">
    <SearchPage embedded query={query} setQuery={setQuery} periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd} region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform} onSubmit={onSubmit} isSearching={isSearching}/>
    {hasSearched ? isSearching ? <div className="results-empty-state results-loading"><span><Search size={24}/></span><h2>Идёт поиск публикаций</h2><p>Сервер обрабатывает источники. Статус: {searchStatus ?? 'RUNNING'}.</p></div> : <>
    <div className="design-page-heading results-found-heading"><div><h1>Результаты поиска</h1><p>Запрос: «{query}» · статус API: {searchStatus}</p></div><div className="heading-actions"><button onClick={() => setSavedResult(!savedResult)} className={`soft-action ${savedResult ? 'soft-action-saved' : ''}`}><Bookmark size={14}/>{savedResult ? 'Запрос сохранён' : 'Сохранить запрос'}</button><button onClick={onExport} className="primary-action" disabled={!results.length}><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar"><div className="summary-filter"><CalendarDays size={15}/><span>{prettyDate(periodStart)} — {prettyDate(periodEnd)}</span></div><div className="summary-filter"><MapPin size={15}/><span>{region}</span><ChevronDown size={13}/></div><span className="results-platform-summary">{platforms.length ? platforms.join(' · ') : 'Площадки не выбраны'}</span></div>
    <section className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{results.length}</strong> публикаций</h2><p>Показываем отдельные размещения с прямыми ссылками на источник</p></div><label className="sort-control">Сортировка<select value={sort} onChange={event => setSort(event.target.value as 'relevance' | 'newest')}><option value="relevance">По релевантности</option><option value="newest">Сначала новые</option></select><ChevronDown size={12}/></label></div>
      <div className="result-rows">{pageItems.map(item => <article key={item.id} className="result-row"><input aria-label={`Выбрать публикацию: ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><button type="button" onClick={() => onOpen(item)} className="result-photo publication-thumb has-image"><img className="media-photo" src={item.image} alt=""/><span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform === 'OK' ? '✦' : item.platform === 'MAX' ? '●' : 'ᴠκ'}</span></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{item.title}</button><a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a></div><p>{item.excerpt}</p><div className="result-metadata"><span><Users size={12}/>{item.source}</span><span>{item.date}</span></div><div className="result-engagement"><span><Heart size={13}/>{item.likes}</span><span><Eye size={13}/>{item.views}</span><span><Share2 size={13}/>{item.reposts}</span><span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span></div></div></article>)}</div>
      <div className="results-pagination"><span>Показано <b>{pageItems.length}</b> из <b>{results.length}</b> публикаций <i>· данные API</i></span><div><button onClick={() => setResultPage(current => Math.max(1,current-1))} disabled={resultPage <= 1}><ChevronLeft size={15}/></button><button className="pagination-current">{resultPage}</button><button onClick={() => setResultPage(current => Math.min(pages,current+1))} disabled={resultPage >= pages}><ChevronRight size={15}/></button></div></div>
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

function AnalyticsPage() {
  const [range, setRange] = useState('01.03.2024 — 31.03.2024')
  const [platform, setPlatform] = useState<'Все' | Platform>('Все')
  const series = [
    { name: 'ВКонтакте', value: 'VK' as const, color: '#668bfa', points: '0,122 40,115 80,104 120,112 160,93 200,98 240,77 280,88 320,55 360,69 400,50 440,64 480,39 520,50 560,32 600,43' },
    { name: 'Одноклассники', value: 'OK' as const, color: '#f59a35', points: '0,145 40,139 80,132 120,136 160,126 200,130 240,115 280,121 320,107 360,111 400,93 440,105 480,84 520,91 560,75 600,80' },
    { name: 'MAX', value: 'MAX' as const, color: '#db477a', points: '0,158 40,153 80,150 120,143 160,147 200,135 240,139 280,126 320,130 360,117 400,122 440,105 480,114 520,96 560,100 600,86' },
  ]
  return <div className="design-page analytics-page"><div className="design-page-heading"><div><h1>Аналитика</h1><p>Обзор найденных публикаций и активности по теме</p></div><label className="analytics-date"><CalendarDays size={14}/><select value={range} onChange={event => setRange(event.target.value)}><option>01.03.2024 — 31.03.2024</option><option>01.02.2024 — 29.02.2024</option><option>01.01.2024 — 31.01.2024</option></select><ChevronDown size={12}/></label></div><div className="analytics-demo-note"><CircleAlert size={13}/>Демонстрационные данные за выбранный период</div>
    <div className="analytics-stats"><div className="analytics-stat total"><span>Всего публикаций</span><div>248 <small>шт.</small></div><em><TrendingUp size={12}/>+12% к прошлому периоду</em></div><div className="analytics-stat"><span><i className="analytics-platform vk">ᴠκ</i>ВКонтакте</span><div>124</div><em><ArrowUpRight size={12}/>+8%</em></div><div className="analytics-stat"><span><i className="analytics-platform ok">✦</i>Одноклассники</span><div>86</div><em><ArrowUpRight size={12}/>+15%</em></div><div className="analytics-stat"><span><i className="analytics-platform max">●</i>MAX</span><div>38</div><em><ArrowUpRight size={12}/>+6%</em></div></div>
    <div className="analytics-grid"><section className="design-card trend-card"><div className="design-card-heading"><div><h2>Динамика публикаций</h2><p>Количество публикаций по дням</p></div><div className="chart-legend"><button onClick={() => setPlatform('Все')} className={platform === 'Все' ? 'legend-active' : ''}><i style={{background:'#33415d'}}/>Все</button>{series.map(item => <button key={item.name} onClick={() => setPlatform(item.value)} className={platform === item.value ? 'legend-active' : ''}><i style={{background:item.color}}/>{item.name}</button>)}</div></div><div className="chart-wrap"><div className="chart-y-labels"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><svg className="trend-chart" viewBox="0 0 600 180" role="img" aria-label="Динамика публикаций"><g className="chart-grid">{[20,55,90,125,160].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y}/>)}</g>{series.filter(item => platform === 'Все' || item.value === platform).map(item => <polyline key={item.name} points={item.points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}</svg></div><div className="chart-x-labels"><span>1 мар</span><span>6 мар</span><span>11 мар</span><span>16 мар</span><span>21 мар</span><span>26 мар</span><span>31 мар</span></div><div className="chart-footnote"><span><span className="live-dot"/>Пик активности</span><b>17 марта · 48 публикаций</b></div></section>
      <section className="design-card topics-card"><div className="design-card-heading"><div><h2>Типы контента</h2><p>Распределение публикаций</p></div></div><div className="donut-area"><div className="donut-chart"><div><b>248</b><span>публикаций</span></div></div><div className="donut-legend"><span><i className="donut-posts"/>Посты <b>42%</b></span><span><i className="donut-repost"/>Репосты <b>18%</b></span><span><i className="donut-video"/>Видео <b>13%</b></span><span><i className="donut-photo"/>Фото <b>24%</b></span><span><i className="donut-comments"/>Комментарии <b>3%</b></span></div></div><div className="topic-divider"/><h3>Популярные темы</h3><div className="analytics-topics">{([['Ледовый дворец',68],['Открытие',51],['Красноярск',43],['Спорт',35]] as [string,number][]).map(([name,count]) => <div key={name}><span>{name}</span><div><i style={{width:`${count/68*100}%`}}/></div><b>{count}</b></div>)}</div></section></div>
    <div className="analytics-footer"><span>Показатели рассчитаны по результатам поиска</span><button><ArrowDownRight size={13}/>Скачать отчёт</button></div>
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

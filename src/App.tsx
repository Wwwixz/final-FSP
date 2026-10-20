import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api, downloadSearchExport, waitForSearch, ApiError } from './api'
import type { ApiPublication, ApiSearch, ApiSource, AuthResponse } from './api'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert,
  CircleHelp, Download, ExternalLink, Eye, EyeOff, Heart, ImageOff, Link2, Lock, Mail, MapPin,
  Moon, MoreHorizontal, Newspaper, Plus, Search, Settings, Share2, Star, Sun, TrendingUp, User, Users, X,
} from 'lucide-react'
import platformVkIcon from './assets/platform-vk.png'
import platformOkIcon from './assets/platform-ok.png'
import platformMaxIcon from './assets/platform-max.png'
import platformTgIcon from './assets/platform-tg.svg'
import platformDzenIcon from './assets/platform-dzen.svg'

type Page = 'login' | 'register' | 'results' | 'publication' | 'sources' | 'saved' | 'analytics' | 'settings'
type Platform = 'VK' | 'OK' | 'MAX' | 'TG' | 'SITE' | 'DZEN'
type CustomSearchLink = { id: string; url: string }
type Source = { id: number; name: string; platform: Platform; url: string; logoUrl: string | null; followers: string; region: string; active: boolean; color: string }
type SavedQuery = { id: number; name: string; query: string; period: string; region: string; favorite: boolean; createdAt?: string }
type Publication = { id: number; source: string; platform: Platform; date: string; publishedAtMs: number | null; title: string; excerpt: string; url: string; kind: string; color: string; image: string | null; likes: number; reposts: number; views: number; aiRelevance: number | null; aiComment: string | null }
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
  return year && month && day ? `${day}\\${month}\\${year.slice(-2)}` : 'дд\\мм\\гг'
}
const monthAgoInputValue = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return formatDateInput(date)
}
const customSearchLinksStorageKey = 'krasnopars-custom-search-links'
const readCustomSearchLinks = (): CustomSearchLink[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(customSearchLinksStorageKey) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return []
      const link = item as Partial<CustomSearchLink>
      return typeof link.id === 'string' && typeof link.url === 'string' ? [{ id: link.id, url: link.url }] : []
    })
  } catch {
    return []
  }
}

const initialSources: Source[] = [
  { id: 1, name: 'Наш Красноярский край', platform: 'VK', url: 'vk.com/krskstate', logoUrl: null, followers: '245K', region: 'Красноярский край', active: true, color: '#284b83' },
  { id: 2, name: 'Спорт_Красноярск', platform: 'VK', url: 'vk.com/sportkrsk', logoUrl: null, followers: '128K', region: 'Красноярский край', active: true, color: '#26364e' },
  { id: 3, name: 'Новости Красноярска', platform: 'OK', url: 'ok.ru/news.krsk', logoUrl: null, followers: '86K', region: 'Красноярский край', active: true, color: '#d5222b' },
  { id: 4, name: 'Культура Красноярья', platform: 'OK', url: 'ok.ru/culturekrsk', logoUrl: null, followers: '42K', region: 'Красноярский край', active: true, color: '#99820f' },
  { id: 5, name: 'Красноярск. Главное', platform: 'MAX', url: 'max.ru/krasnoyarsk', logoUrl: null, followers: '38K', region: 'Красноярский край', active: true, color: '#5d4a37' },
  { id: 6, name: 'ЧП Красноярск', platform: 'VK', url: 'vk.com/chp_krsk', logoUrl: null, followers: '512K', region: 'Красноярский край', active: true, color: '#312c6f' },
]
const platformLabel: Record<Platform, string> = { VK: 'VK', OK: 'Одноклассники', MAX: 'MAX', TG: 'Telegram', SITE: 'Сайты', DZEN: 'Дзен' }
const sourceUrlPlaceholder: Record<Platform, string> = {
  VK: 'vk.com/community',
  OK: 'ok.ru/group/123456',
  MAX: 'max.ru/channel',
  TG: 't.me/channel',
  SITE: 'https://example.com/',
  DZEN: 'dzen.ru/channel',
}
const platformIcon: Partial<Record<Platform, string>> = { VK: platformVkIcon, OK: platformOkIcon, MAX: platformMaxIcon, TG: platformTgIcon, DZEN: platformDzenIcon }
const exampleTopics = ['ледовый дворец Красноярск', 'губернатор края', 'наводнение 2026', 'развитие спорта']

const platformColor: Record<Platform, string> = { VK: '#5278d9', OK: '#e98a35', MAX: '#7358ce', TG: '#2aabee', SITE: '#4d7cc7', DZEN: '#4a4a4f' }
const mapSource = (source: ApiSource): Source => ({
  id: source.id,
  name: source.name,
  platform: source.platform,
  url: source.url,
  logoUrl: source.logoUrl,
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
  publishedAtMs: publication.hasDate && publication.publishedAt ? new Date(publication.publishedAt).getTime() : null,
  title: publication.title || 'Публикация без заголовка',
  excerpt: publication.excerpt || 'Текст публикации отсутствует.',
  url: publication.url,
  kind: (publication.aiRelevance ?? publication.relevance) >= 0.65 ? 'По теме' : 'Связано',
  color: platformColor[publication.platform],
  image: publication.imageUrl ?? null,
  likes: publication.likes ?? 0,
  reposts: publication.reposts ?? 0,
  views: publication.views ?? 0,
  aiRelevance: publication.aiRelevance,
  aiComment: publication.aiComment,
})

const loadSearchPublications = async (searchId: number): Promise<{ items: Publication[]; total: number }> => {
  const firstPage = await api.publications(searchId)
  const items = [...firstPage.content]
  for (let page = 1; page < firstPage.totalPages; page += 1) {
    const nextPage = await api.publications(searchId, page)
    items.push(...nextPage.content)
  }
  return { items: items.map(mapPublication), total: firstPage.totalElements }
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить запрос к API.'

const hasStoredToken = () => typeof window !== 'undefined' && Boolean(window.localStorage.getItem('krasnopars-token'))
const guestSessionKey = 'krasnopars-guest'
const hasGuestSession = () => typeof window !== 'undefined' && window.localStorage.getItem(guestSessionKey) === 'true'

function App() {
  const [isAuthChecking, setIsAuthChecking] = useState(hasStoredToken())
  const [page, setPage] = useState<Page>(() => (hasStoredToken() || hasGuestSession() ? 'results' : 'login'))
  const [user, setUser] = useState<AuthResponse['user'] | null>(null)
  const [guestMode, setGuestMode] = useState(() => !hasStoredToken() && hasGuestSession())
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [periodStart, setPeriodStart] = useState('2001-01-01')
  const [periodEnd, setPeriodEnd] = useState(todayInputValue)
  const [region, setRegion] = useState('Красноярский край')
  const [regions, setRegions] = useState(['Красноярский край', 'Красноярск', 'Ачинск', 'Норильск'])
  const [platforms, setPlatforms] = useState<Platform[]>(['VK', 'OK', 'MAX'])
  const [searchMode, setSearchMode] = useState<'BY_SOURCES' | 'ALL_PLATFORMS'>('BY_SOURCES')
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [deselectedSourceIds, setDeselectedSourceIds] = useState<number[]>([])
  const [results, setResults] = useState<Publication[]>([])
  const [searchId, setSearchId] = useState<number | null>(null)
  const [, setSearchStatus] = useState<ApiSearch['status'] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchRunRef = useRef(0)
  const [apiError, setApiError] = useState('')
  const [saved, setSaved] = useState<SavedQuery[]>([])
  const [notice, setNotice] = useState('')
  const [settingsTab, setSettingsTab] = useState('Основные')
  const [sourceModal, setSourceModal] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePlatform, setSourcePlatform] = useState<Platform>('VK')
  const [sourceEdit, setSourceEdit] = useState<number | null>(null)
  const [sourceError, setSourceError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode)
  const [cityBackground, setCityBackground] = useState<CityBackground>(() => getCityBackground(themeMode))

  const handleLogout = async () => {
    if (!guestMode) {
      try {
        await api.auth.logout()
      } catch (e) {
        console.error('Logout failed', e)
      }
    }
    window.localStorage.removeItem('krasnopars-token')
    window.localStorage.removeItem(guestSessionKey)
    setUser(null)
    setGuestMode(false)
    setSaved([])
    setResults([])
    setSearchId(null)
    setHasSearched(false)
    setPage('login')
    setProfileMenuOpen(false)
  }

  const handleGuestLogin = () => {
    window.localStorage.removeItem('krasnopars-token')
    window.localStorage.setItem(guestSessionKey, 'true')
    setUser(null)
    setGuestMode(true)
    setSaved([])
    setResults([])
    setSearchId(null)
    setHasSearched(false)
    setPage('results')
  }

  const handleAuthDone = (userData: AuthResponse) => {
    window.localStorage.setItem('krasnopars-token', userData.token)
    window.localStorage.removeItem(guestSessionKey)
    setUser(userData.user)
    setGuestMode(false)
    setPage('results')
  }

  useEffect(() => {
    const checkAuth = async () => {
      const token = window.localStorage.getItem('krasnopars-token')
      if (!token) {
        setIsAuthChecking(false)
        return
      }
      try {
        const userData = await api.auth.me()
        setUser(userData)
      } catch (e) {
        window.localStorage.removeItem('krasnopars-token')
        window.localStorage.removeItem(guestSessionKey)
        setUser(null)
        setGuestMode(false)
        setPage('login')
      } finally {
        setIsAuthChecking(false)
      }
    }
    void checkAuth()
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setGuestMode(false)
      setPage('login')
    }
    window.addEventListener('krasnopars-unauthorized', onUnauthorized)
    return () => window.removeEventListener('krasnopars-unauthorized', onUnauthorized)
  }, [])

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
    const timeout = window.setTimeout(() => setNotice(''), 5_000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (isAuthChecking || (!user && !guestMode)) return
    let cancelled = false
    const loadApiData = async () => {
      try {
        const [sourceResult, savedResult, regionResult] = await Promise.allSettled([api.sources(), guestMode ? Promise.resolve([]) : api.savedQueries(), api.regions()])
        void Promise.allSettled([api.health(), api.platforms(), api.aiStatus()])

        if (cancelled) return
        if (sourceResult.status === 'fulfilled') setSources(sourceResult.value.map(mapSource))
        else {
          if (!(sourceResult.reason instanceof ApiError && sourceResult.reason.status === 401)) {
            setApiError(`Источники API недоступны: ${getErrorMessage(sourceResult.reason)}`)
          }
        }

        if (savedResult.status === 'fulfilled') {
          setSaved(savedResult.value.map(item => ({
            id: item.id,
            name: item.name || item.query || `Запрос №${item.id}`,
            query: item.query,
            period: item.period || '—',
            region: item.region || 'Все регионы',
            favorite: item.favorite,
            createdAt: item.createdAt,
          })))
        }
        if (regionResult.status === 'fulfilled' && regionResult.value.length) setRegions(regionResult.value)
      } catch (e) {
        console.error('Failed to load initial data', e)
      }
    }
    void loadApiData()
    return () => { cancelled = true }
  }, [user, guestMode, isAuthChecking])

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
  const executeSearch = async (params: { query: string; dateFrom?: string; dateTo?: string; region?: string }) => {
    if (searchMode === 'BY_SOURCES' && platforms.length === 0) {
      setApiError('Выберите хотя бы одну площадку для поиска.')
      return
    }

    const runId = ++searchRunRef.current
    setApiError('')
    setNotice('')
    setIsSearching(true)
    setHasSearched(true)
    setPage('results')
    try {
      // Источники могли измениться после открытия страницы, поэтому берём актуальные ID перед поиском.
      let sourceIds: number[] = []
      if (searchMode === 'BY_SOURCES') {
        const currentSources = await api.sources()
        if (searchRunRef.current !== runId) return
        setSources(currentSources.map(mapSource))
        sourceIds = currentSources
          .filter(source => source.active && platforms.includes(source.platform) && !deselectedSourceIds.includes(source.id))
          .map(source => source.id)
        if (sourceIds.length === 0) {
          setApiError('Для выбранных площадок нет отмеченных активных источников. Отметьте источники на вкладке «Источники» или выберите другую площадку.')
          return
        }
      }
      const created = await api.createSearch({
        query: params.query,
        searchType: 'TOPIC',
        mode: searchMode,
        sourceIds,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        region: params.region,
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
      const publicationPage = await loadSearchPublications(created.id)
      if (searchRunRef.current !== runId) return
      setResults(publicationPage.items)
      setNotice(completed.status === 'COMPLETED_PARTIAL'
        ? `Поиск завершён частично: найдено ${publicationPage.total} публикаций, часть источников недоступна.`
        : `Поиск завершён: найдено ${publicationPage.total} публикаций.`)
    } catch (error) {
      if (searchRunRef.current !== runId) return
      setSearchStatus('FAILED')
      setApiError(getErrorMessage(error))
    } finally {
      if (searchRunRef.current === runId) setIsSearching(false)
    }
  }
  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || isSearching) return
    await executeSearch({ query: query.trim(), dateFrom: periodStart || undefined, dateTo: periodEnd || undefined, region: region || undefined })
  }
  const openSaved = async (item: SavedQuery) => {
    const [from, to] = (item.period || '').split('—').map(part => part.trim())
    const savedRegion = item.region && item.region !== 'Все регионы' ? item.region : ''
    setQuery(item.query)
    if (savedRegion) setRegion(savedRegion)
    if (from || to) {
      setPeriodStart(from || periodStart)
      setPeriodEnd(to || periodEnd)
    }

    setPage('results')
    setIsSearching(true)
    setHasSearched(true)
    setApiError('')
    setNotice('')
    setResults([])

    try {
      // Пытаемся найти уже выполненный поиск с таким же запросом в истории
      const history = await api.searches()
      const existing = history.find(s =>
        s.query === item.query &&
        (s.status === 'COMPLETED' || s.status === 'COMPLETED_PARTIAL')
      )

      if (existing) {
        setSearchId(existing.id)
        setSearchStatus(existing.status)
        const publicationPage = await loadSearchPublications(existing.id)
        setResults(publicationPage.items)
        setNotice(`Загружены результаты последнего поиска по этому запросу (№${existing.id})`)
        setIsSearching(false)
        return
      }

      // Если не нашли готового — запускаем новый
      await executeSearch({
        query: item.query,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        region: savedRegion || undefined,
      })
    } catch (e) {
      setApiError(getErrorMessage(e))
      setIsSearching(false)
    }
  }
  const openSourceDialog = (source?: Source) => { setSourceEdit(source?.id ?? null); setSourceName(source?.name ?? ''); setSourceUrl(source?.url ?? ''); setSourcePlatform(source?.platform ?? 'VK'); setSourceError(''); setSourceModal(true) }
  const submitSource = async (event: FormEvent) => {
    event.preventDefault()
    if (!sourceName.trim() || !sourceUrl.trim()) return
    setApiError('')
    setSourceError('')
    try {
      const url = /^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : `https://${sourceUrl.trim()}`
      const payload = { name: sourceName.trim(), url, platform: sourcePlatform, active: true }
      const savedSource = sourceEdit === null
        ? await api.createSource(payload)
        : await api.updateSource(sourceEdit, { ...payload, active: sources.find(item => item.id === sourceEdit)?.active ?? true })
      const mapped = mapSource(savedSource)
      setSources(current => sourceEdit === null ? [mapped, ...current] : current.map(item => item.id === sourceEdit ? mapped : item))
      if (sourceEdit === null) setDeselectedSourceIds(current => current.filter(id => id !== mapped.id))
      setSourceModal(false)
      setNotice(sourceEdit === null ? 'Источник добавлен через API.' : 'Источник обновлён через API.')
    } catch (error) {
      setSourceError(getErrorMessage(error))
    }
  }
  const toggleSourceSelection = (id: number) => {
    setDeselectedSourceIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }
  const toggleAllSourceSelection = (selected: boolean) => {
    const activeIds = sources.filter(source => source.active).map(source => source.id)
    setDeselectedSourceIds(current => selected
      ? current.filter(id => !activeIds.includes(id))
      : [...new Set([...current, ...activeIds])])
  }
  const toggleSourceActive = async (id: number) => {
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
      setDeselectedSourceIds(current => current.filter(value => value !== id))
      setNotice('Источник удалён через API.')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const deleteAllSources = async () => {
    if (!sources.length || !window.confirm(`Удалить все источники (${sources.length})?`)) return
    const deletedIds: number[] = []
    let failures = 0
    for (const source of sources) {
      try {
        await api.deleteSource(source.id)
        deletedIds.push(source.id)
      } catch {
        failures += 1
      }
    }
    setSources(current => current.filter(source => !deletedIds.includes(source.id)))
    setDeselectedSourceIds(current => current.filter(id => !deletedIds.includes(id)))
    if (failures) setApiError(`Не удалось удалить ${failures} источн${failures === 1 ? 'ик' : 'иков'}.`)
    else setNotice('Все источники удалены.')
  }
  const removeSaved = async (id: number) => {
    setApiError('')
    try {
      await api.deleteSavedQuery(id)
      setSaved(current => current.filter(item => item.id !== id))
      setNotice('Запрос удалён.')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }
  const removeAllSaved = async () => {
    const outcomes = await Promise.allSettled(saved.map(item => api.deleteSavedQuery(item.id)))
    const removedIds = new Set(saved.filter((_, index) => outcomes[index].status === 'fulfilled').map(item => item.id))
    setSaved(current => current.filter(item => !removedIds.has(item.id)))
    if (outcomes.some(outcome => outcome.status === 'rejected')) setApiError('Не все запросы удалось удалить.')
  }
  const clearAllFavorites = async () => {
    const favorites = saved.filter(item => item.favorite)
    const outcomes = await Promise.allSettled(favorites.map(item => api.toggleFavoriteQuery(item.id, false)))
    const updatedIds = new Set(favorites.filter((_, index) => outcomes[index].status === 'fulfilled').map(item => item.id))
    setSaved(current => current.map(item => updatedIds.has(item.id) ? { ...item, favorite: false } : item))
    if (outcomes.some(outcome => outcome.status === 'rejected')) setApiError('Не все запросы удалось убрать из избранного.')
  }
  const toggleFavorite = async (id: number) => {
    const current = saved.find(item => item.id === id)
    if (!current) return
    try {
      const updated = await api.toggleFavoriteQuery(id, !current.favorite)
      setSaved(items => items.map(item => item.id === id ? { ...item, favorite: updated.favorite } : item))
    } catch (e) {
      setApiError(getErrorMessage(e))
    }
  }
  const saveCurrentSearch = async () => {
    if (!query.trim()) return
    try {
      const created = await api.saveQuery({
        name: query.trim(),
        query: query.trim(),
        period: `${periodStart} — ${periodEnd}`,
        region,
        favorite: false
      })
      setSaved(current => [...current, {
        id: created.id,
        name: created.name,
        query: created.query,
        period: created.period || '—',
        region: created.region || 'Все регионы',
        favorite: created.favorite,
        createdAt: created.createdAt,
      }])
      setNotice('Запрос сохранён в список')
    } catch (e) {
      setApiError(getErrorMessage(e))
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

  if (isAuthChecking) return <div className="auth-screen" data-city-background={cityBackground}>
    <video key={cityBackground} className="theme-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src={cityBackground === 'evening' ? '/winter-snow.mp4' : '/winter-day-snow.mp4'} type="video/mp4"/>
    </video>
    <div className="auth-logo"><img className="auth-emblem" src="/favicon.png" alt="Герб Красноярского края со львом"/><div className="auth-logo-text"><b>КрасноПарс</b><span>Красноярский край</span></div></div>
    <div className="auth-card" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
      <div className="results-loading"><span><Search size={40} color="#df2943"/></span></div>
      <p style={{ marginTop: '20px', color: '#667085' }}>Загрузка профиля...</p>
    </div>
  </div>

  if (page === 'login' || page === 'register') return <AuthScreen mode={page} cityBackground={cityBackground} onSwitch={mode => setPage(mode)} onDone={handleAuthDone} onGuest={handleGuestLogin}/>
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
      <div className="nav-user-actions"><button className="nav-theme-toggle" aria-label={cityBackground === 'evening' ? 'Включить светлую тему' : 'Включить тёмную тему'} title="Сменить тему" onClick={() => setThemeMode(cityBackground === 'evening' ? 'light' : 'dark')}>{cityBackground === 'evening' ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="profile-menu-wrap"><div className="nav-profile" role="button" tabIndex={0} aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen(open => !open)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setProfileMenuOpen(open => !open) }}><div className="nav-profile-copy"><b>{user?.name || 'Гость'}</b></div>{profileMenuOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>{profileMenuOpen && <div className="profile-menu"><button type="button" onClick={handleLogout}>Выйти</button></div>}</div></div>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><div><b>Справка</b><span>Инструкции и ответы<br/>на частые вопросы →</span></div></div><div className="sidebar-user"><div><b>{user?.name || 'Гость'}</b></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main-area">
      <div className="page-content">
        {notice && <div className="notice" role="status" aria-live="polite">
          <span className="notice-icon" aria-hidden="true"><Check size={17}/></span>
          <span className="notice-content">
            <strong>{notice.startsWith('Поиск завершён частично') ? 'Поиск завершён частично' : 'Поиск завершён'}</strong>
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
          onSubmit={runSearch} onExport={exportResults} searchMode={searchMode} setSearchMode={setSearchMode} onOpen={item => { setSelectedPublication(item); setPage('publication'); window.scrollTo(0, 0) }}
          onSave={saveCurrentSearch}
        />}
        {page === 'publication' && selectedPublication && <PublicationPage
          item={selectedPublication}
          position={results.findIndex(result => result.id === selectedPublication.id)}
          total={results.length}
          onNavigate={offset => {
            const index = results.findIndex(result => result.id === selectedPublication.id)
            const next = results[index + offset]
            if (next) { setSelectedPublication(next); window.scrollTo(0, 0) }
          }}
          onBack={() => setPage('results')}
        />}
        {page === 'sources' && <SourcesPage sources={sources} deselectedSourceIds={deselectedSourceIds} onAdd={() => openSourceDialog()} onEdit={openSourceDialog} onToggleSelection={toggleSourceSelection} onToggleAllSelection={toggleAllSourceSelection} onToggleActive={toggleSourceActive} onDelete={deleteSource} onDeleteAll={deleteAllSources}/>}
        {page === 'saved' && <SavedPage
          items={saved} onOpen={openSaved} onRemove={removeSaved} onRemoveAll={removeAllSaved} onClearFavorites={clearAllFavorites}
          onNew={() => { setQuery(''); setHasSearched(false); setPage('results') }}
          onFavorite={toggleFavorite}
        />}
        {page === 'analytics' && <AnalyticsPage/>}
        {page === 'settings' && <SettingsPage tab={settingsTab} setTab={setSettingsTab} region={region} setRegion={setRegion} themeMode={themeMode} setThemeMode={setThemeMode} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }} saved={settingsSaved}/>}
      </div>
    </main>
    {sourceModal && <div className="modal-backdrop" onClick={() => setSourceModal(false)}><form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={submitSource}>
      <div className="modal-heading"><div><h2>{sourceEdit === null ? 'Добавить источник' : 'Редактировать источник'}</h2><p>Укажите страницу или сообщество для мониторинга</p></div><button type="button" className="icon-button" onClick={() => setSourceModal(false)}><X size={18}/></button></div>
      <label>Название<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Например, Новости города"/></label>
      <label>Ссылка<input required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder={sourceUrlPlaceholder[sourcePlatform]}/></label>
      <div className="source-platform-field"><span>Площадка</span><SourcePlatformPicker value={sourcePlatform} onChange={setSourcePlatform}/></div>
      {sourceError && <p className="source-modal-error" role="alert">{sourceError}</p>}
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setSourceModal(false)}>Отмена</button><button className="button-primary"><Check size={16}/>Сохранить</button></div>
    </form></div>}
  </div>
}

function SourcePlatformPicker({ value, onChange }: { value: Platform; onChange: (platform: Platform) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const options: Platform[] = ['VK', 'OK', 'MAX', 'TG', 'SITE', 'DZEN']

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [open])

  return <span ref={rootRef} className={`source-platform-select ${open ? 'is-open' : ''}`}>
    <button ref={triggerRef} type="button" className="source-platform-trigger" aria-label="Выбрать площадку" aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }}>
      <PlatformBadge platform={value} size={28}/><span>{platformLabel[value]}</span><ChevronDown className="source-platform-chevron" size={18} aria-hidden="true"/>
    </button>
    {open && <div className="source-platform-options" aria-label="Площадки">
      {options.map(platform => <button key={platform} type="button" className={platform === value ? 'selected' : ''} onClick={() => { onChange(platform); setOpen(false); triggerRef.current?.focus() }}><PlatformBadge platform={platform} size={25}/><span>{platformLabel[platform]}</span>{platform === value && <Check size={17} aria-hidden="true"/>}</button>)}
    </div>}
  </span>
}

function AuthScreen({ mode, cityBackground, onSwitch, onDone, onGuest }: { mode: 'login' | 'register'; cityBackground: CityBackground; onSwitch: (mode: 'login' | 'register') => void; onDone: (data: AuthResponse) => void; onGuest: () => void }) {
  return <div className={`auth-screen auth-screen--${mode}`} data-city-background={cityBackground}>
    <video key={cityBackground} className="theme-background-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src={cityBackground === 'evening' ? '/winter-snow.mp4' : '/winter-day-snow.mp4'} type="video/mp4"/>
    </video>
    <div className="auth-logo"><img className="auth-emblem" src="/favicon.png" alt="Герб Красноярского края со львом"/><div className="auth-logo-text"><b>КрасноПарс</b><span>Красноярский край</span></div></div>
    {mode === 'login' ? <AuthLoginForm onSwitch={onSwitch} onDone={onDone} onGuest={onGuest}/> : <AuthRegisterForm onSwitch={onSwitch} onDone={onDone}/>}
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

function AuthLoginForm({ onSwitch, onDone, onGuest }: { onSwitch: (mode: 'login' | 'register') => void; onDone: (data: AuthResponse) => void; onGuest: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) { setError('Введите электронную почту и пароль'); return }
    setError('')
    setLoading(true)
    try {
      const data = await api.auth.login({ email: email.trim(), password })
      onDone(data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
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
    <button className="auth-submit" disabled={loading}>{loading ? 'Вход...' : 'Войти'}</button>
    <button type="button" className="auth-guest" onClick={onGuest}>Войти как гость</button>
    <p className="auth-alt">Нет аккаунта? <button type="button" onClick={() => onSwitch('register')}>Зарегистрироваться</button></p>
  </form>
}

function AuthRegisterForm({ onSwitch, onDone }: { onSwitch: (mode: 'login' | 'register') => void; onDone: (data: AuthResponse) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) { setError('Пароль должен содержать не менее 6 символов'); return }
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    if (!agree) { setError('Согласитесь с политикой обработки персональных данных'); return }
    setError('')
    setLoading(true)
    try {
      const data = await api.auth.register({ name: name.trim(), email: email.trim(), password })
      onDone(data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
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
    <button className="auth-submit" disabled={loading}>{loading ? 'Регистрация...' : 'Зарегистрироваться'}</button>
    <p className="auth-alt">Уже есть аккаунт? <button type="button" onClick={() => onSwitch('login')}>Войти</button></p>
  </form>
}

function NavItem({ active, icon, onClick, children }: { active: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={`nav-link ${active ? 'nav-active' : ''}`}>{icon}<span>{children}</span></button> }

function PlatformBadge({ platform, size = 44 }: { platform: Platform; size?: number }) {
  const icon = platformIcon[platform]
  if (icon) {
    return <img className="pl-logo" src={icon} width={size} height={size} alt="" loading="lazy" draggable={false}/>
  }
  const short = platform === 'TG' ? 'TG' : platform === 'SITE' ? 'WWW' : platform === 'DZEN' ? 'Д' : platform
  return <span className={`pl-badge pl-${platform.toLowerCase()}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}>{short}</span>
}

function Switch({ checked, onChange, blue, large, label }: { checked: boolean; onChange: () => void; blue?: boolean; large?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${blue ? 'switch-blue' : ''} ${large ? 'switch-lg' : ''} ${checked ? 'switch-on' : ''}`} onClick={onChange}><i/></button>
}

function CompactDateInput({ value, min, max, onChange, label }: { value: string; min?: string; max?: string; onChange: (value: string) => void; label: string }) {
  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date()
  const [open, setOpen] = useState(false)
  const [periodPicker, setPeriodPicker] = useState<'month' | 'year' | null>(null)
  const [viewMonth, setViewMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const calendarRef = useRef<HTMLDivElement>(null)
  const activeYearRef = useRef<HTMLButtonElement>(null)

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

  const firstWeekday = (new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1)
  const monthOptions = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(2026, month, 1)))
  const currentYear = new Date().getFullYear()
  const selectedYear = initialDate.getFullYear()
  const firstYear = min ? Number(min.slice(0, 4)) : Math.min(currentYear - 50, selectedYear - 10)
  const lastYear = max ? Number(max.slice(0, 4)) : Math.max(currentYear + 50, selectedYear + 10)
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
  const minMonth = min ? new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, 1) : null
  const maxMonth = max ? new Date(Number(max.slice(0, 4)), Number(max.slice(5, 7)) - 1, 1) : null
  const today = todayInputValue()
  const selectDate = (day: number) => {
    const nextValue = formatDateInput(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))
    onChange(nextValue)
    setOpen(false)
  }
  const chooseToday = () => {
    if ((min && today < min) || (max && today > max)) return
    onChange(today)
    const current = new Date()
    setViewMonth(new Date(current.getFullYear(), current.getMonth(), 1))
    setOpen(false)
  }

  return <div className="compact-date-control" ref={calendarRef} onKeyDown={event => { if (event.key === 'Escape') { if (periodPicker) setPeriodPicker(null); else setOpen(false) } }}>
    <button type="button" className="compact-date-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(current => !current); setPeriodPicker(null) }}>
      <span className="compact-date-value">{formatCompactDate(value)}</span>
      <CalendarDays size={15} aria-hidden="true"/>
    </button>
    {open && <div className="date-calendar-popover" role="dialog" aria-label={label}>
      <div className="date-calendar-head">
        <button type="button" aria-label="Предыдущий месяц" disabled={Boolean(minMonth && viewMonth <= minMonth)} onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={17}/></button>
        <div className="date-calendar-period">
          <div className={`date-calendar-select ${periodPicker === 'month' ? 'open' : ''}`}>
            <button type="button" className="date-calendar-select-trigger" aria-haspopup="listbox" aria-expanded={periodPicker === 'month'} onClick={() => setPeriodPicker(current => current === 'month' ? null : 'month')}><span>{monthOptions[viewMonth.getMonth()]}</span></button>
            {periodPicker === 'month' && <div className="date-calendar-options" role="listbox" aria-label="Выбрать месяц">{monthOptions.map((month, index) => { const monthDate = new Date(viewMonth.getFullYear(), index, 1); const outOfRange = Boolean((minMonth && monthDate < minMonth) || (maxMonth && monthDate > maxMonth)); return <button type="button" role="option" aria-selected={index === viewMonth.getMonth()} className={index === viewMonth.getMonth() ? 'selected' : ''} key={month} disabled={outOfRange} onClick={() => { setViewMonth(monthDate); setPeriodPicker(null) }}>{month}</button> })}</div>}
          </div>
          <div className={`date-calendar-select date-calendar-year ${periodPicker === 'year' ? 'open' : ''}`}>
            <button type="button" className="date-calendar-select-trigger" aria-haspopup="listbox" aria-expanded={periodPicker === 'year'} onClick={() => setPeriodPicker(current => current === 'year' ? null : 'year')}><span>{viewMonth.getFullYear()}</span></button>
            {periodPicker === 'year' && <div className="date-calendar-options" role="listbox" aria-label="Выбрать год">{yearOptions.map(year => <button type="button" role="option" aria-selected={year === viewMonth.getFullYear()} className={year === viewMonth.getFullYear() ? 'selected' : ''} ref={year === viewMonth.getFullYear() ? activeYearRef : undefined} key={year} onClick={() => { setViewMonth(current => new Date(year, current.getMonth(), 1)); setPeriodPicker(null) }}>{year}</button>)}</div>}
          </div>
        </div>
        <button type="button" aria-label="Следующий месяц" disabled={Boolean(maxMonth && viewMonth >= maxMonth)} onClick={() => setViewMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={17}/></button>
      </div>
      <div className="date-calendar-weekdays" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="date-calendar-grid">{days.map((day, index) => {
        if (day === null) return <span key={`empty-${index}`}/>
        const dayValue = formatDateInput(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))
        const disabled = Boolean((min && dayValue < min) || (max && dayValue > max))
        return <button type="button" key={dayValue} className={`${dayValue === value ? 'selected' : ''} ${dayValue === today ? 'today' : ''}`} disabled={disabled} aria-label={dayValue} aria-pressed={dayValue === value} onClick={() => selectDate(day)}>{day}</button>
      })}</div>
      <div className="date-calendar-footer"><button type="button" onClick={chooseToday} disabled={Boolean((min && today < min) || (max && today > max))}>Сегодня</button></div>
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
    <button type="button" className="region-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><MapPin size={14}/><span>{value}</span></button>
    {open && <div className="region-select-options" role="listbox" aria-label="Выбрать регион">{options.map(item => <button type="button" role="option" aria-selected={item === value} className={item === value ? 'selected' : ''} key={item} onClick={() => { onChange(item); setOpen(false) }}>{item}</button>)}</div>}
  </div>
}

function SearchPage({ query, setQuery, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, embedded = false, isSearching = false, searchMode, setSearchMode }: { query: string; setQuery: (v: string) => void; periodStart: string; setPeriodStart: (v: string) => void; periodEnd: string; setPeriodEnd: (v: string) => void; region: string; setRegion: (v: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (p: Platform) => void; onSubmit: (e: FormEvent) => void; embedded?: boolean; isSearching?: boolean; searchMode: 'BY_SOURCES' | 'ALL_PLATFORMS'; setSearchMode: (mode: 'BY_SOURCES' | 'ALL_PLATFORMS') => void }) {
  const [officialOnly, setOfficialOnly] = useState(false)
  const [withMedia, setWithMedia] = useState(false)
  const [excludeReposts, setExcludeReposts] = useState(false)
  const [customLinks, setCustomLinks] = useState<CustomSearchLink[]>(readCustomSearchLinks)
  const focusCustomLinkRef = useRef<string | null>(null)
  useEffect(() => {
    try { window.localStorage.setItem(customSearchLinksStorageKey, JSON.stringify(customLinks)) } catch { /* Browser storage may be unavailable. */ }
    if (focusCustomLinkRef.current) {
      document.getElementById(`custom-search-link-${focusCustomLinkRef.current}`)?.focus()
      focusCustomLinkRef.current = null
    }
  }, [customLinks])
  const addCustomLink = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    focusCustomLinkRef.current = id
    setCustomLinks(current => [...current, { id, url: '' }])
  }
  const renderCustomLink = (link: CustomSearchLink, index: number) => <div className="platform-custom-link" key={link.id}><Link2 size={16}/><input id={`custom-search-link-${link.id}`} type="text" inputMode="url" autoComplete="url" aria-label={`Ссылка на сайт ${index + 1}`} placeholder="https://avangardkray.ru/" value={link.url} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} onChange={event => setCustomLinks(current => current.map(item => item.id === link.id ? { ...item, url: event.target.value } : item))}/><button type="button" aria-label={`Удалить ссылку ${index + 1}`} onClick={() => setCustomLinks(current => current.filter(item => item.id !== link.id))}><X size={15}/></button></div>
  if (embedded) return <form className="results-search-panel" onSubmit={onSubmit}>
    <div className="results-search-copy"><h1>Поиск публикаций</h1><p>Введите тему, событие или ключевые слова — найденные публикации появятся ниже.</p></div>
    <div className="results-search-row">
      <div className="results-query-field"><Search size={17}/><input required value={query} onChange={event => setQuery(event.target.value)} placeholder="Например, открытие нового ледового дворца в Красноярске"/></div>
      <button type="submit" className="primary-action results-find" disabled={isSearching}><Search size={15}/>{isSearching ? 'Ищем…' : 'Найти'}</button>
    </div>
    <div className="results-search-examples"><span>Например:</span>{exampleTopics.map(topic => <button type="button" key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
    <div className="results-search-filters">
      <label><span>Период с</span><CompactDateInput value={periodStart} max={capToToday(periodEnd) || undefined} label="Начало периода" onChange={setPeriodStart}/></label>
      <label><span>по</span><CompactDateInput value={periodEnd} min={periodStart} max={todayInputValue()} label="Конец периода" onChange={setPeriodEnd}/></label>
      <div className="results-region"><span>Регион</span><RegionDropdown value={region} options={regions} onChange={setRegion}/></div>
      <div className="platform-switch-container">
        <span>Площадки</span>
        <div className="platform-picker-row">
          <div className={`platform-switch platform-switch-with-links ${customLinks.length > 0 ? 'platform-switch-with-link-rows' : ''}`}>
            {(['VK', 'OK', 'MAX', 'TG', 'SITE', 'DZEN'] as Platform[]).map(item => (
              <button
                type="button"
                key={item}
                className={`platform-switch-item ${platforms.includes(item) ? 'active' : ''}`}
                onClick={() => togglePlatform(item)}
              >
                <PlatformBadge platform={item} size={20}/>
                <span>{item}</span>
              </button>
            ))}
            {customLinks.length > 0 && <div className="platform-custom-link-grid">{customLinks.map(renderCustomLink)}</div>}
          </div>
          <button type="button" className="platform-add-link" aria-label="Добавить ссылку на сайт" title="Добавить ссылку на сайт" onClick={addCustomLink}><Plus size={19}/></button>
        </div>
      </div>
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
              <input type="date" value={periodStart} max={capToToday(periodEnd) || undefined} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setPeriodStart(periodEnd && capped > periodEnd ? periodEnd : capped) }} aria-label="Начало периода"/>
              <span className="period-dash">—</span>
              <input type="date" value={periodEnd} min={periodStart} max={todayInputValue()} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setPeriodEnd(periodStart && capped < periodStart ? periodStart : capped) }} aria-label="Конец периода"/>
            </div>
          </div>
          <div className="filter-block">
            <span className="filter-label">Регион</span>
            <RegionDropdown className="region-box" value={region} options={regions} onChange={setRegion}/>
          </div>
        </div>
        <div className="sources-card">
          <div className="sources-left">
            <h3>Источники поиска</h3>
            <div className="scope-row">
              <label className="radio"><input type="radio" name="search-mode" checked={searchMode === 'ALL_PLATFORMS'} onChange={() => setSearchMode('ALL_PLATFORMS')}/><i/><span>Все источники края</span></label>
              <label className="radio"><input type="radio" name="search-mode" checked={searchMode === 'BY_SOURCES'} onChange={() => setSearchMode('BY_SOURCES')}/><i/><span>По выбранным площадкам</span></label>
            </div>
            <div className="mini-toggle"><Switch checked={officialOnly} onChange={() => setOfficialOnly(!officialOnly)} blue label="Только официальные источники"/><span>Только официальные источники</span></div>
            <h3 className="extra-heading">Дополнительные настройки</h3>
            <div className="mini-toggle"><Switch checked={withMedia} onChange={() => setWithMedia(!withMedia)} blue label="Только с медиа"/><span>Только с медиа (фото, видео)</span></div>
            <div className="mini-toggle"><Switch checked={excludeReposts} onChange={() => setExcludeReposts(!excludeReposts)} blue label="Исключить репосты"/><span>Исключить репосты</span></div>
          </div>
          <div className="sources-right">
            <span className="filter-label">Площадки поиска</span>
            <div className="platform-switch">
              {(['VK', 'OK', 'MAX', 'TG', 'SITE', 'DZEN'] as Platform[]).map(item => (
                <button
                  type="button"
                  key={item}
                  className={`platform-switch-item ${platforms.includes(item) ? 'active' : ''}`}
                  onClick={() => togglePlatform(item)}
                >
                  <PlatformBadge platform={item} size={20}/>
                  <span>{item}</span>
                </button>
              ))}
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

function ResultsPage({ results, query, setQuery, hasSearched, isSearching, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, onExport, onOpen, onSave, searchMode, setSearchMode }: { results: Publication[]; query: string; setQuery: (value: string) => void; hasSearched: boolean; isSearching: boolean; periodStart: string; setPeriodStart: (value: string) => void; periodEnd: string; setPeriodEnd: (value: string) => void; region: string; setRegion: (value: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (platform: Platform) => void; onSubmit: (event: FormEvent) => void; onExport: () => void; onOpen: (item: Publication) => void; onSave: () => void; searchMode: 'BY_SOURCES' | 'ALL_PLATFORMS'; setSearchMode: (mode: 'BY_SOURCES' | 'ALL_PLATFORMS') => void }) {
  const [resultPage, setResultPage] = useState(1)
  const [sort, setSort] = useState<'relevance' | 'newest'>('relevance')
  const [savedResult, setSavedResult] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const shown = sort === 'newest'
    ? [...results].sort((a, b) => (b.publishedAtMs ?? Number.NEGATIVE_INFINITY) - (a.publishedAtMs ?? Number.NEGATIVE_INFINITY))
    : results
  const pageSize = 4
  const pageItems = shown.slice(0, resultPage * pageSize)
  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const prettyDate = (value: string) => value.split('-').reverse().join('.')
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const loadMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setResultPage(1) }, [results])
  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || resultPage >= pages) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setResultPage(current => Math.min(pages, current + 1))
    }, { rootMargin: '240px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [resultPage, pages])
  return <div className="design-page results-page">
    <SearchPage embedded query={query} setQuery={setQuery} periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd} region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform} onSubmit={onSubmit} searchMode={searchMode} setSearchMode={setSearchMode} isSearching={isSearching}/>
    {hasSearched ? isSearching ? <div className="results-empty-state results-loading"><span><Search size={24}/></span><h2>Идёт поиск публикаций</h2><p>Сервер обрабатывает источники.</p></div> : <>
    <div className="design-page-heading results-found-heading"><div><h1>Результаты поиска</h1><p className="results-query-caption">Запрос: «{query}»</p></div><div className="heading-actions"><button onClick={() => { onSave(); setSavedResult(true) }} className={`soft-action ${savedResult ? 'soft-action-saved' : ''}`}><Bookmark size={14}/>{savedResult ? 'Запрос сохранён' : 'Сохранить запрос'}</button><button onClick={onExport} className="primary-action" disabled={!results.length}><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar">
      <div className="summary-filter"><CalendarDays size={15}/><span>{prettyDate(periodStart)} — {prettyDate(periodEnd)}</span></div>
      <div className="summary-filter"><MapPin size={15}/><span>{region}</span></div>
      <span className="results-platform-summary">{platforms.length ? platforms.join(' · ') : 'Площадки не выбраны'}</span>
    </div>
    <section className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{results.length}</strong> публикаций</h2><p>Показываем отдельные размещения с прямыми ссылками на источник</p></div><label className="sort-control">Сортировка<select value={sort} onChange={event => setSort(event.target.value as 'relevance' | 'newest')}><option value="relevance">По релевантности</option><option value="newest">Сначала новые</option></select></label></div>
      <div className="result-rows">{pageItems.map(item => <article key={item.id} className="result-row"><input aria-label={`Выбрать публикацию: ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><button type="button" onClick={() => onOpen(item)} className={`result-photo publication-thumb ${item.image ? 'has-image' : 'no-image'}`}>{item.image ? <img className="media-photo" src={item.image} alt="" loading="lazy"/> : <span className="publication-thumb-empty"><ImageOff size={18}/></span>}<span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform === 'OK' ? '✦' : item.platform === 'MAX' ? '●' : 'ᴠκ'}</span></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{item.title}</button><a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a></div><p>{item.excerpt}</p><div className="result-metadata"><span><Users size={12}/>{item.source}</span><span>{item.date}</span></div><div className="result-engagement"><span><Heart size={13}/>{item.likes}</span><span><Eye size={13}/>{item.views}</span><span><Share2 size={13}/>{item.reposts}</span><span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span></div></div></article>)}</div>
      <div className="results-pagination"><span>Показано <b>{pageItems.length}</b> из <b>{results.length}</b> публикаций</span>{resultPage < pages && <span className="results-scroll-hint">Листайте вниз — покажем ещё</span>}</div>
      <div ref={loadMoreRef} aria-hidden="true" className="results-load-sentinel"/>
    </section>
    </> : <div className="results-empty-state"><span><Search size={24}/></span><h2>Введите запрос, чтобы начать поиск</h2><p>Результаты публикаций появятся здесь сразу после нажатия кнопки «Найти».</p></div>}
  </div>
}

function PublicationPage({ item, position, total, onNavigate, onBack }: { item: Publication; position: number; total: number; onNavigate: (offset: number) => void; onBack: () => void }) {
  const [liked, setLiked] = useState(false)
  useEffect(() => { setLiked(false) }, [item.id])
  const [savedIds, setSavedIds] = useState<number[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem('krasnopars-saved-publications') || '[]')
      return Array.isArray(stored) ? stored.filter((id): id is number => typeof id === 'number') : []
    } catch {
      return []
    }
  })
  const saved = savedIds.includes(item.id)
  const toggleSaved = () => setSavedIds(current => {
    const next = current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]
    try { window.localStorage.setItem('krasnopars-saved-publications', JSON.stringify(next)) } catch { /* Storage may be unavailable. */ }
    return next
  })

  return <div className="publication-page">
    <div className="publication-toolbar">
      <button type="button" className="publication-back" onClick={onBack}><ArrowLeft size={15}/>Назад к результатам</button>
      <div className="publication-navigation" aria-label="Навигация по публикациям">
        <button type="button" aria-label="Предыдущая публикация" disabled={position <= 0} onClick={() => onNavigate(-1)}><ChevronLeft size={18}/></button>
        <span>{position >= 0 ? position + 1 : '—'} из {total}</span>
        <button type="button" aria-label="Следующая публикация" disabled={position < 0 || position >= total - 1} onClick={() => onNavigate(1)}><ChevronRight size={18}/></button>
      </div>
    </div>
    <div className="publication-layout">
      <article className="publication-card">
        <header className="publication-header">
          <div className="publication-source-avatar" style={{ backgroundColor: item.color }}>{position >= 0 ? position + 1 : item.source.slice(0, 1)}</div>
          <div><strong>{item.source}</strong><span>{item.date}</span></div>
        </header>
        {item.image
          ? <img className="publication-cover" src={item.image} alt={item.title}/>
          : <div className="publication-cover publication-cover--empty"><ImageOff size={26}/><span>В публикации нет изображения</span></div>}
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
      <aside className="publication-aside-column">
        <section className="publication-info">
          <div className="publication-info-heading"><span><Newspaper size={20}/></span><div><h2>О публикации</h2><p>Основные сведения</p></div></div>
          <dl>
            <div className="publication-info-row"><span className="publication-info-icon"><Users size={17}/></span><div className="publication-info-copy"><dt>Источник</dt><dd>{item.source}</dd></div></div>
            <div className="publication-info-row"><span className="publication-info-icon"><PlatformBadge platform={item.platform} size={20}/></span><div className="publication-info-copy"><dt>Площадка</dt><dd><span className={`publication-info-platform ${item.platform.toLowerCase()}`}>{platformLabel[item.platform]}</span></dd></div></div>
            <div className="publication-info-row"><span className="publication-info-icon"><CalendarDays size={17}/></span><div className="publication-info-copy"><dt>Дата публикации</dt><dd>{item.date}</dd></div></div>
            <div className="publication-info-row"><span className="publication-info-icon"><Check size={17}/></span><div className="publication-info-copy"><dt>Соответствие запросу</dt><dd><span className="publication-info-match">{item.kind}</span></dd></div></div>
          </dl>
          <button type="button" className={`publication-primary-action ${saved ? 'publication-saved' : ''}`} onClick={toggleSaved}><Bookmark size={16}/>{saved ? 'Сохранено в браузере' : 'Сохранить публикацию'}</button>
        </section>
        <section className="publication-sentiment" aria-label="Эмоциональность публикации">
          <div className="publication-sentiment-command">
            <div className="publication-sentiment-heading"><span><TrendingUp size={20}/></span><div><h2>Эмоциональность</h2><p>Анализ тональности текста</p></div></div>
            <div className="publication-sentiment-summary"><span><CircleHelp size={17}/></span><div><small>Общий тон</small><strong>Нет данных</strong></div></div>
          </div>
          <div className="publication-sentiment-bars">
            {(['Позитивная', 'Нейтральная', 'Негативная'] as const).map(tone => <div className="sentiment-row" key={tone}><div><span>{tone}</span><b>—</b></div><i aria-hidden="true"/></div>)}
            <p className="publication-sentiment-unavailable">Сервер пока не передаёт оценку тональности.</p>
          </div>
        </section>
      </aside>
    </div>
  </div>
}

function AnalyticsPage() {
  const [analyticsStart, setAnalyticsStart] = useState(monthAgoInputValue)
  const [analyticsEnd, setAnalyticsEnd] = useState(todayInputValue)
  const [platform, setPlatform] = useState<'Все' | Platform>('Все')
  const startTime = new Date(`${analyticsStart || monthAgoInputValue()}T00:00:00`).getTime()
  const endTime = new Date(`${analyticsEnd || todayInputValue()}T00:00:00`).getTime()
  const chartLabels = Array.from({ length: 7 }, (_, index) => {
    const timestamp = startTime + ((endTime - startTime) * index) / 6
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(timestamp))
  })
  const series = [
    { name: 'ВКонтакте', value: 'VK' as const, color: '#668bfa', points: '0,122 40,115 80,104 120,112 160,93 200,98 240,77 280,88 320,55 360,69 400,50 440,64 480,39 520,50 560,32 600,43' },
    { name: 'Одноклассники', value: 'OK' as const, color: '#f59a35', points: '0,145 40,139 80,132 120,136 160,126 200,130 240,115 280,121 320,107 360,111 400,93 440,105 480,84 520,91 560,75 600,80' },
    { name: 'MAX', value: 'MAX' as const, color: '#db477a', points: '0,158 40,153 80,150 120,143 160,147 200,135 240,139 280,126 320,130 360,117 400,122 440,105 480,114 520,96 560,100 600,86' },
  ]
  return <div className="design-page analytics-page"><div className="design-page-heading"><div><h1>Аналитика</h1><p>Обзор найденных публикаций и активности по теме</p></div><div className="analytics-date"><CalendarDays size={14}/><input type="date" value={analyticsStart} max={analyticsEnd || todayInputValue()} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setAnalyticsStart(analyticsEnd && capped > analyticsEnd ? analyticsEnd : capped) }} aria-label="Начало периода аналитики"/><span>—</span><input type="date" value={analyticsEnd} min={analyticsStart} max={todayInputValue()} onMouseDown={event => event.preventDefault()} onClick={event => openDatePicker(event.currentTarget)} onChange={event => { const capped = capToToday(event.target.value); setAnalyticsEnd(analyticsStart && capped < analyticsStart ? analyticsStart : capped) }} aria-label="Конец периода аналитики"/></div></div><div className="analytics-demo-note"><CircleAlert size={13}/>Демонстрационные данные за выбранный период</div>
    <div className="analytics-stats"><div className="analytics-stat total"><span>Всего публикаций</span><div>248 <small>шт.</small></div><em><TrendingUp size={12}/>+12% к прошлому периоду</em></div><div className="analytics-stat"><span><i className="analytics-platform vk">ᴠκ</i>ВКонтакте</span><div>124</div><em><ArrowUpRight size={12}/>+8%</em></div><div className="analytics-stat"><span><i className="analytics-platform ok">✦</i>Одноклассники</span><div>86</div><em><ArrowUpRight size={12}/>+15%</em></div><div className="analytics-stat"><span><i className="analytics-platform max">●</i>MAX</span><div>38</div><em><ArrowUpRight size={12}/>+6%</em></div></div>
    <div className="analytics-grid"><section className="design-card trend-card"><div className="design-card-heading"><div><h2>Динамика публикаций</h2><p>Количество публикаций по дням</p></div><div className="chart-legend"><button onClick={() => setPlatform('Все')} className={platform === 'Все' ? 'legend-active' : ''}><i style={{background:'#33415d'}}/>Все</button>{series.map(item => <button key={item.name} onClick={() => setPlatform(item.value)} className={platform === item.value ? 'legend-active' : ''}><i style={{background:item.color}}/>{item.name}</button>)}</div></div><div className="chart-wrap"><div className="chart-y-labels"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><svg className="trend-chart" viewBox="0 0 600 180" role="img" aria-label="Динамика публикаций"><g className="chart-grid">{[20,55,90,125,160].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y}/>)}</g>{series.filter(item => platform === 'Все' || item.value === platform).map(item => <polyline key={item.name} points={item.points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}</svg></div><div className="chart-x-labels">{chartLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div><div className="chart-footnote"><span><span className="live-dot"/>Пик активности</span><b>{chartLabels[3]} · 48 публикаций</b></div></section>
      <section className="design-card topics-card"><div className="design-card-heading"><div><h2>Типы контента</h2><p>Распределение публикаций</p></div></div><div className="donut-area"><div className="donut-chart"><div><b>248</b><span>публикаций</span></div></div><div className="donut-legend"><span><i className="donut-posts"/>Посты <b>42%</b></span><span><i className="donut-repost"/>Репосты <b>18%</b></span><span><i className="donut-video"/>Видео <b>13%</b></span><span><i className="donut-photo"/>Фото <b>24%</b></span><span><i className="donut-comments"/>Комментарии <b>3%</b></span></div></div><div className="topic-divider"/><h3>Популярные темы</h3><div className="analytics-topics">{([['Ледовый дворец',68],['Открытие',51],['Красноярск',43],['Спорт',35]] as [string,number][]).map(([name,count]) => <div key={name}><span>{name}</span><div><i style={{width:`${count/68*100}%`}}/></div><b>{count}</b></div>)}</div></section></div>
    <div className="analytics-footer"><span>Показатели рассчитаны по результатам поиска</span><button><ArrowDownRight size={13}/>Скачать отчёт</button></div>
  </div>
}

function SourcesPage({ sources, deselectedSourceIds, onAdd, onEdit, onToggleSelection, onToggleAllSelection, onToggleActive, onDelete, onDeleteAll }: { sources: Source[]; deselectedSourceIds: number[]; onAdd: () => void; onEdit: (source: Source) => void; onToggleSelection: (id: number) => void; onToggleAllSelection: (selected: boolean) => void; onToggleActive: (id: number) => void; onDelete: (id: number) => void; onDeleteAll: () => void }) {
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const searchLabelRef = useRef<HTMLLabelElement>(null)
  const activeSources = sources.filter(source => source.active)
  const selectedCount = activeSources.filter(source => !deselectedSourceIds.includes(source.id)).length
  const allSelected = activeSources.length > 0 && selectedCount === activeSources.length
  const visibleSources = sources.filter(source => `${source.name} ${source.url} ${platformLabel[source.platform]}`.toLocaleLowerCase('ru').includes(searchQuery.trim().toLocaleLowerCase('ru')))
  const showSearchGlint = () => {
    const label = searchLabelRef.current
    if (label) {
      label.classList.remove('is-shining')
      void label.offsetWidth
      label.classList.add('is-shining')
    }
  }
  const runSourceSearch = (event: FormEvent) => {
    event.preventDefault()
    showSearchGlint()
    setSearchQuery(searchDraft)
  }

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('.source-directory-menu'))) setOpenMenuId(null)
    }
    const closeEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpenMenuId(null) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [])

  return <section className="repository-sources sources-reference-page">
    <form className="source-directory-search" onSubmit={runSourceSearch}>
      <label ref={searchLabelRef} onPointerDown={showSearchGlint}><Search size={24}/><input value={searchDraft} onChange={event => { setSearchDraft(event.target.value); if (!event.target.value) setSearchQuery('') }} placeholder="Введите название источника" aria-label="Название источника"/></label>
      <button type="submit"><Search size={20}/>Найти</button>
    </form>
    <div className="source-directory-list">
      <header className="source-directory-header">
        <label className="source-directory-select-all"><input type="checkbox" aria-label="Выбрать все источники для поиска" checked={allSelected} disabled={!activeSources.length} onChange={() => onToggleAllSelection(!allSelected)}/><span><strong>Мой список</strong><small>{sources.length} источников · {selectedCount} выбраны для поиска</small></span></label>
        <div className="source-directory-header-actions"><button type="button" className="source-directory-remove-all" onClick={onDeleteAll} disabled={!sources.length}><X size={17}/>Удалить все</button><button type="button" className="source-directory-add" onClick={onAdd}><Plus size={20}/>Добавить</button></div>
      </header>
      <div className="source-directory-rows">
        {visibleSources.map(source => <div key={source.id} className="source-directory-row">
          <button type="button" className={`source-directory-check ${source.active && !deselectedSourceIds.includes(source.id) ? 'checked' : ''}`} onClick={() => onToggleSelection(source.id)} disabled={!source.active} aria-label={`${deselectedSourceIds.includes(source.id) ? 'Выбрать' : 'Убрать из поиска'} ${source.name}`} aria-pressed={source.active && !deselectedSourceIds.includes(source.id)}><Check size={14}/></button>
          <div className="source-directory-avatar">{source.logoUrl ? <img src={source.logoUrl} alt=""/> : <PlatformBadge platform={source.platform} size={34}/>}</div>
          <div className="source-directory-copy"><strong>{source.name}</strong></div>
          <div className="source-directory-state"><PlatformBadge platform={source.platform} size={34}/><span className={source.active ? 'active' : ''}><i/>{source.active ? 'Доступен' : 'Отключён'}</span></div>
          <div className="source-directory-actions">
            <div className="source-directory-menu"><button type="button" aria-label={`Действия с ${source.name}`} aria-expanded={openMenuId === source.id} onClick={() => setOpenMenuId(current => current === source.id ? null : source.id)}><MoreHorizontal size={20}/></button>{openMenuId === source.id && <div className="source-directory-dropdown"><button type="button" onClick={() => { setOpenMenuId(null); onEdit(source) }}>Изменить</button><button type="button" onClick={() => { setOpenMenuId(null); onToggleActive(source.id) }}>{source.active ? 'Отключить' : 'Включить'}</button><button type="button" className="danger-action" onClick={() => { setOpenMenuId(null); onDelete(source.id) }}>Удалить</button></div>}</div>
            <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Открыть ${source.name}`}><ExternalLink size={19}/></a>
            <button type="button" className="source-directory-delete" onClick={() => onDelete(source.id)} aria-label={`Удалить ${source.name}`}><X size={20}/></button>
          </div>
        </div>)}
        {visibleSources.length === 0 && <div className="source-directory-empty">{sources.length ? 'По этому названию источники не найдены.' : 'Пока нет источников. Добавьте первый источник.'}</div>}
      </div>
    </div>
  </section>
}

function SavedPage({ items, onOpen, onRemove, onRemoveAll, onClearFavorites, onNew, onFavorite }: { items: SavedQuery[]; onOpen: (item: SavedQuery) => void; onRemove: (id: number) => void; onRemoveAll: () => void; onClearFavorites: () => void; onNew: () => void; onFavorite: (id: number) => void }) {
  const [openActionsId, setOpenActionsId] = useState<number | null>(null)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [queryFilter, setQueryFilter] = useState('')
  const [queryDraft, setQueryDraft] = useState('')
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.saved-actions, .saved-bulk-actions')) return
      setOpenActionsId(null)
      setBulkMenuOpen(false)
    }
    const closeEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setOpenActionsId(null); setBulkMenuOpen(false) }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [])
  const filteredItems = items.filter(item => {
    const needle = queryFilter.trim().toLocaleLowerCase('ru')
    return (!needle || `${item.name} ${item.query}`.toLocaleLowerCase('ru').includes(needle)) && (!favoriteFilter || item.favorite)
  }).sort((a, b) => sortBy === 'newest' ? Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') : Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? ''))
  const favoriteCount = items.filter(item => item.favorite).length
  return <section className="saved-shell">
    <header className="saved-page-head"><div><h1>Сохранённые запросы</h1><p>История поисков и быстрый доступ к результатам</p></div><button className="button-primary" onClick={onNew}><Plus size={16}/>Новый запрос</button></header>
    <div className="saved-toolbar">
      <form className="saved-filter-search" onSubmit={event => { event.preventDefault(); setQueryFilter(queryDraft) }}><Search size={15}/><input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Найти запрос…" aria-label="Найти сохранённый запрос"/><button type="submit" className="saved-filter-submit" aria-label="Найти"><Search size={16}/></button></form>
      <div className="saved-filter-tabs"><button className={!favoriteFilter ? 'active' : ''} onClick={() => setFavoriteFilter(false)}>Все <span>{items.length}</span></button><button className={favoriteFilter ? 'active' : ''} onClick={() => setFavoriteFilter(true)}><Star size={12}/>Избранное <span>{favoriteCount}</span></button></div>
      <label className="saved-select-filter saved-sort-filter"><span>Сортировка</span><select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select></label>
    </div>
    <div className="saved-table-wrap"><table className="saved-queries-table"><thead><tr><th><div className="saved-bulk-actions"><input type="checkbox" aria-label="Массовые действия с запросами" checked={bulkMenuOpen} disabled={!items.length} onChange={() => { setOpenActionsId(null); setBulkMenuOpen(open => !open) }}/>{bulkMenuOpen && <div className="saved-bulk-menu"><button type="button" onClick={() => { setBulkMenuOpen(false); onClearFavorites() }}>Убрать все из избранного</button><button type="button" className="danger-action" onClick={() => { setBulkMenuOpen(false); onRemoveAll() }}>Удалить все запросы</button></div>}</div></th><th>Название</th><th>Запрос</th><th>Период</th><th>Регион</th><th>Действия</th></tr></thead><tbody>{filteredItems.map(item => <tr key={item.id}><td><button className={`favorite-star ${item.favorite ? 'favorite-on' : ''}`} title={item.favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavorite(item.id)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'}/></button></td><td className="saved-name-cell"><button className="saved-query-name" onClick={() => onOpen(item)}>{item.name}</button>{item.createdAt && <small className="saved-last-opened">Создан: {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.createdAt))}</small>}</td><td><span className="saved-query-text">{item.query}</span></td><td>{item.period}</td><td>{item.region}</td><td><details className="saved-actions" open={openActionsId === item.id}><summary aria-label="Действия с запросом" onClick={event => { event.preventDefault(); setBulkMenuOpen(false); setOpenActionsId(current => current === item.id ? null : item.id) }}><MoreHorizontal size={17}/></summary><div><button onClick={() => { setOpenActionsId(null); onOpen(item) }}>Открыть результаты</button><button onClick={() => { setOpenActionsId(null); onFavorite(item.id) }}>{item.favorite ? 'Убрать из избранного' : 'В избранное'}</button><button className="danger-action" onClick={() => { setOpenActionsId(null); onRemove(item.id) }}>Удалить</button></div></details></td></tr>)}</tbody></table>{items.length === 0 ? <div className="saved-empty-state"><Bookmark size={24}/><strong>Пока нет сохранённых запросов</strong><span>Создайте запрос, чтобы быстро возвращаться к его результатам.</span><button className="button-primary" onClick={onNew}><Plus size={15}/>Создать первый запрос</button></div> : filteredItems.length === 0 && <div className="saved-empty-state"><Search size={22}/><strong>По этим фильтрам ничего нет</strong><span>Измените запрос или сбросьте фильтры.</span><button className="soft-action" onClick={() => { setQueryFilter(''); setFavoriteFilter(false) }}>Сбросить фильтры</button></div>}</div>
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

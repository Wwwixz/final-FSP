import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { api, downloadSearchExport, waitForSearch } from './api'
import type { ApiPublication, ApiSearch, ApiSource } from './api'
import {
  ArrowLeft, ArrowRight,
  BarChart3, Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert,
  CircleHelp, Download, ExternalLink, Eye, EyeOff, Frown, Heart, Lock, Mail, MapPin, Meh,
  Moon, MoreHorizontal, Newspaper, Plus, Search, Settings, Share2, Smile, Star, Sun, User, Users, X,
} from 'lucide-react'
type Page = 'login' | 'register' | 'results' | 'publication' | 'sources' | 'saved' | 'settings'
type Platform = 'VK' | 'OK' | 'MAX'
type LocalSourcePlatform = 'TG' | 'DZEN'
type SourcePlatform = Platform | LocalSourcePlatform
type Source = { id: number; name: string; platform: SourcePlatform; url: string; followers: string; region: string; active: boolean; color: string }
type SavedQuery = { id: number; name: string; query: string; period: string; region: string; favorite: boolean; status?: ApiSearch['status']; totalFound?: number; createdAt?: string; platforms?: Platform[] }
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
const localSourcesStorageKey = 'krasnopars-local-sources'
const isLocalSourcePlatform = (platform: SourcePlatform): platform is LocalSourcePlatform => platform === 'TG' || platform === 'DZEN'
const isApiSource = (source: Source): source is Source & { platform: Platform } => !isLocalSourcePlatform(source.platform)
const localPlatformColor: Record<LocalSourcePlatform, string> = { TG: '#229ed9', DZEN: '#202022' }
const localPlatformIcon: Record<LocalSourcePlatform, string> = { TG: '/telegram-logo.svg', DZEN: '/dzen-logo.svg' }
const readLocalSources = (): Source[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(localSourcesStorageKey) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return []
      const source = item as Partial<Source>
      const platform = source.platform
      if (typeof source.id !== 'number' || source.id >= 0 || typeof source.name !== 'string' || typeof source.url !== 'string' || (platform !== 'TG' && platform !== 'DZEN')) return []
      return [{ id: source.id, name: source.name, platform, url: source.url, followers: '—', region: 'Красноярский край', active: false, color: localPlatformColor[platform] }]
    })
  } catch {
    return []
  }
}
const initialSaved: SavedQuery[] = [
  { id: 1, name: 'Ледовый дворец', query: 'открытие ледового дворца Красноярск', period: '01.03.2026 — 31.03.2026', region: 'Красноярский край', favorite: true },
  { id: 2, name: 'Наводнение 2026', query: 'наводнение Красноярский край', period: '01.04.2026 — 30.04.2026', region: 'Красноярский край', favorite: true },
  { id: 3, name: 'Губернатор края', query: 'губернатор Красноярского края', period: '01.01.2026 — 31.03.2026', region: 'Красноярский край', favorite: true },
  { id: 4, name: 'Развитие спорта', query: 'развитие спорта Красноярск', period: '01.01.2026 — 31.12.2026', region: 'Красноярский край', favorite: true },
  { id: 5, name: 'Строительство', query: 'строительство Красноярск', period: '01.01.2026 — 31.12.2026', region: 'Красноярский край', favorite: true },
]
const platformLabel: Record<Platform, string> = { VK: 'VK', OK: 'Одноклассники', MAX: 'MAX' }
const sourcePlatformLabel: Record<SourcePlatform, string> = { ...platformLabel, TG: 'Telegram', DZEN: 'Дзен' }
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

// The API may cap the requested page size. Load every server page once so the
// results view can reliably split publications into its own pages of ten.
async function loadAllPublications(searchId: number) {
  const firstPage = await api.publications(searchId, 0, 100, 'relevance')
  const all = [...firstPage.content]
  let page = 1
  while (!firstPage.last && all.length < firstPage.totalElements) {
    const nextPage = await api.publications(searchId, page, firstPage.size || 100, 'relevance')
    if (!nextPage.content.length) break
    all.push(...nextPage.content)
    if (nextPage.last) break
    page += 1
  }
  return { ...firstPage, content: all, totalElements: Math.max(firstPage.totalElements, all.length) }
}

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
  const [sources, setSources] = useState<Source[]>(() => [...initialSources, ...readLocalSources()])
  const [results, setResults] = useState<Publication[]>([])
  const [searchId, setSearchId] = useState<number | null>(null)
  const [, setSearchStatus] = useState<ApiSearch['status'] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [validationSubmitted, setValidationSubmitted] = useState(false)
  const [isOpeningSavedSearch, setIsOpeningSavedSearch] = useState(false)
  const searchRunRef = useRef(0)
  const sourceBulkRunRef = useRef(0)
  const sourceBulkQueueRef = useRef<Promise<void>>(Promise.resolve())
  const [apiError, setApiError] = useState('')
  const [saved, setSaved] = useState(initialSaved)
  const [recentlyOpened, setRecentlyOpened] = useState<Record<number, number>>({})
  const [notice, setNotice] = useState('')
  const [settingsTab, setSettingsTab] = useState('Основные')
  const [sourceModal, setSourceModal] = useState(false)
  const [sourceModalError, setSourceModalError] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourcePlatform, setSourcePlatform] = useState<SourcePlatform>('VK')
  const [sourceEdit, setSourceEdit] = useState<number | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null)
  const [selectedPublicationIndex, setSelectedPublicationIndex] = useState(-1)
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
      if (sourceResult.status === 'fulfilled') setSources(current => [...sourceResult.value.map(mapSource), ...current.filter(source => isLocalSourcePlatform(source.platform))])
      else setApiError(`Источники API недоступны: ${getErrorMessage(sourceResult.reason)}`)

      if (historyResult.status === 'fulfilled') {
        setSaved(historyResult.value.map(item => ({
          id: item.id,
          name: item.query || `Поиск №${item.id}`,
          query: item.query,
          period: formatApiPeriod(item),
          region: item.region || 'Все регионы',
          favorite: false,
          status: item.status,
          totalFound: item.totalFound,
          createdAt: item.createdAt,
          platforms: item.mode === 'ALL_PLATFORMS' ? ['VK', 'OK', 'MAX'] : item.sources?.map(source => source.platform),
        })))
      }
      if (regionResult.status === 'fulfilled' && regionResult.value.length) setRegions(regionResult.value)
    }
    void loadApiData()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(localSourcesStorageKey, JSON.stringify(sources.filter(source => isLocalSourcePlatform(source.platform))))
    } catch {
      setApiError('Не удалось сохранить локальные источники в этом браузере.')
    }
  }, [sources])

  const togglePlatform = (platform: Platform) => setPlatforms(current => current.includes(platform) ? current.filter(value => value !== platform) : [...current, platform])
  const startNewSearch = () => {
    searchRunRef.current += 1
    setPage('results')
    setQuery('')
    setHasSearched(false)
    setIsSearching(false)
    setIsOpeningSavedSearch(false)
    setValidationSubmitted(false)
    setResults([])
    setSearchId(null)
    setSearchStatus(null)
    setNotice('')
    setApiError('')
  }
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
    const sourceIds = sources.filter(source => isApiSource(source) && source.active && platforms.includes(source.platform)).map(source => source.id)
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
      setIsOpeningSavedSearch(false)
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
      const publicationPage = await loadAllPublications(created.id)
      if (searchRunRef.current !== runId) return
      setResults(publicationPage.content.map(mapPublication))
      setSaved(current => [{
        id: completed.id,
        name: completed.query || `Поиск №${completed.id}`,
        query: completed.query,
        period: formatApiPeriod(completed),
        region: completed.region || 'Все регионы',
        favorite: current.find(item => item.id === completed.id)?.favorite ?? false,
        status: completed.status,
        totalFound: publicationPage.totalElements,
        createdAt: completed.createdAt,
        platforms: completed.mode === 'ALL_PLATFORMS' ? ['VK', 'OK', 'MAX'] : completed.sources?.map(source => source.platform) ?? platforms,
      }, ...current.filter(item => item.id !== completed.id)])
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
    const runId = ++searchRunRef.current
    setRecentlyOpened(current => ({ ...current, [item.id]: Date.now() }))
    setQuery(item.query)
    if (item.region !== 'Все регионы') setRegion(item.region)
    setPage('results')
    setHasSearched(true)
    setIsSearching(true)
    setIsOpeningSavedSearch(true)
    setApiError('')
    setNotice('')
    try {
      const [search, publicationPage] = await Promise.all([api.search(item.id), loadAllPublications(item.id)])
      if (searchRunRef.current !== runId) return
      setSearchId(item.id)
      setSearchStatus(search.status)
      const mappedResults = publicationPage.content.map(mapPublication)
      setResults(mappedResults)
      const resultPlatforms = [...new Set(mappedResults.map(publication => publication.platform))]
      if (resultPlatforms.length) setPlatforms(resultPlatforms)
      setPeriodStart(search.dateFrom ?? '')
      setPeriodEnd(search.dateTo ?? '')
      if (search.region) setRegion(search.region)
      setSaved(current => current.map(savedItem => savedItem.id === item.id ? {
        ...savedItem,
        status: search.status,
        totalFound: search.totalFound,
        createdAt: search.createdAt,
        platforms: search.mode === 'ALL_PLATFORMS' ? ['VK', 'OK', 'MAX'] : search.sources?.map(source => source.platform) ?? savedItem.platforms,
      } : savedItem))
      setNotice(`Загружены результаты поиска №${item.id} из истории API.`)
    } catch (error) {
      if (searchRunRef.current === runId) setApiError(getErrorMessage(error))
    } finally {
      if (searchRunRef.current === runId) {
        setIsSearching(false)
        setIsOpeningSavedSearch(false)
      }
    }
  }
  const restartSavedSearch = async (item: SavedQuery) => {
    const runId = ++searchRunRef.current
    setQuery(item.query)
    setPage('results')
    setHasSearched(true)
    setIsSearching(true)
    setIsOpeningSavedSearch(false)
    setResults([])
    setApiError('')
    setNotice('')
    try {
      const restarted = await api.restartSearch(item.id)
      if (searchRunRef.current !== runId) return
      setSearchId(restarted.id)
      setSearchStatus(restarted.status)
      const completed = await waitForSearch(restarted.id)
      if (searchRunRef.current !== runId) return
      setSearchStatus(completed.status)
      if (completed.status === 'FAILED') throw new Error(completed.error || 'Повторный поиск завершился с ошибкой.')
      const publicationPage = await api.publications(restarted.id)
      if (searchRunRef.current !== runId) return
      setResults(publicationPage.content.map(mapPublication))
      setSaved(current => current.map(savedItem => savedItem.id === item.id ? {
        ...savedItem,
        status: completed.status,
        totalFound: publicationPage.totalElements,
        createdAt: completed.createdAt,
      } : savedItem))
      setNotice(`Повторный поиск завершён: найдено ${publicationPage.totalElements} публикаций.`)
    } catch (error) {
      if (searchRunRef.current === runId) setApiError(getErrorMessage(error))
    } finally {
      if (searchRunRef.current === runId) setIsSearching(false)
    }
  }
  const openSourceDialog = (source?: Source) => { setApiError(''); setSourceModalError(''); setSourceEdit(source?.id ?? null); setSourceName(source?.name ?? ''); setSourceUrl(source?.url ?? ''); setSourcePlatform(source?.platform ?? 'VK'); setSourceModal(true) }
  const submitSource = async (event: FormEvent) => {
    event.preventDefault()
    if (!sourceName.trim() || !sourceUrl.trim()) return
    setApiError('')
    setSourceModalError('')
    try {
      const url = /^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : `https://${sourceUrl.trim()}`
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Укажите ссылку с адресом сайта.')
      if (isLocalSourcePlatform(sourcePlatform)) {
        const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase()
        const validHost = sourcePlatform === 'TG'
          ? host === 't.me' || host === 'telegram.me'
          : host === 'dzen.ru' || host === 'zen.yandex.ru'
        if (!validHost || parsedUrl.pathname === '/') throw new Error(sourcePlatform === 'TG' ? 'Укажите ссылку на канал Telegram (t.me/...).' : 'Укажите ссылку на канал Дзена (dzen.ru/...).')
        if (sources.some(source => source.id !== sourceEdit && source.url.replace(/\/$/, '').toLowerCase() === parsedUrl.href.replace(/\/$/, '').toLowerCase())) throw new Error('Источник с такой ссылкой уже есть в списке.')
        const localSource: Source = {
          id: sourceEdit ?? Math.min(0, ...sources.map(source => source.id)) - 1,
          name: sourceName.trim(),
          url: parsedUrl.href,
          platform: sourcePlatform,
          followers: '—',
          region: 'Красноярский край',
          active: false,
          color: localPlatformColor[sourcePlatform],
        }
        setSources(current => sourceEdit === null ? [localSource, ...current] : current.map(source => source.id === sourceEdit ? localSource : source))
        setSourceModal(false)
        return
      }
      const payload = { name: sourceName.trim(), url, platform: sourcePlatform, active: true }
      const savedSource = sourceEdit === null
        ? await api.createSource(payload)
        : await api.updateSource(sourceEdit, { ...payload, active: sources.find(item => item.id === sourceEdit)?.active ?? true })
      const mapped = mapSource(savedSource)
      setSources(current => sourceEdit === null ? [mapped, ...current] : current.map(item => item.id === sourceEdit ? mapped : item))
      setSourceModal(false)
      setNotice(sourceEdit === null ? 'Источник добавлен через API.' : 'Источник обновлён через API.')
    } catch (error) {
      setSourceModalError(getErrorMessage(error))
    }
  }
  const toggleSource = (id: number) => {
    const source = sources.find(item => item.id === id)
    if (!source || !isApiSource(source)) return
    const active = !source.active
    setApiError('')
    setSources(current => current.map(item => item.id === id ? { ...item, active } : item))
    const update = async () => {
      try {
        const updated = await api.updateSource(id, { name: source.name, platform: source.platform, url: source.url, active })
        setSources(current => current.map(item => item.id === id && item.active === active ? { ...mapSource(updated), active } : item))
      } catch (error) {
        setSources(current => current.map(item => item.id === id && item.active === active ? source : item))
        setApiError(`Не удалось ${active ? 'включить' : 'выключить'} источник «${source.name}». ${getErrorMessage(error)}`)
      }
    }
    sourceBulkQueueRef.current = sourceBulkQueueRef.current.then(update, update)
  }
  const setAllSourcesActive = (active: boolean) => {
    const changedSources = sources.filter(isApiSource).filter(source => source.active !== active)
    if (!changedSources.length) return Promise.resolve()
    const runId = ++sourceBulkRunRef.current
    setApiError('')
    setSources(current => current.map(source => isLocalSourcePlatform(source.platform) ? source : { ...source, active }))
    const update = async () => {
      const updates = await Promise.allSettled(changedSources.map(async source => {
        const updated = await api.updateSource(source.id, { name: source.name, platform: source.platform, url: source.url, active })
        return { id: source.id, updated: { ...mapSource(updated), active } }
      }))
      if (runId !== sourceBulkRunRef.current) return
      const successful = new Map<number, Source>()
      const failed = new Set<number>()
      updates.forEach((result, index) => {
        if (result.status === 'fulfilled') successful.set(result.value.id, result.value.updated)
        else failed.add(changedSources[index].id)
      })
      if (failed.size) {
        try {
          const refreshed = await api.sources()
          if (runId === sourceBulkRunRef.current) {
            const refreshedById = new Map(refreshed.map(source => [source.id, mapSource(source)]))
            setSources(current => current.map(source => source.active === active ? refreshedById.get(source.id) ?? source : source))
          }
        } catch {
          const previous = new Map(changedSources.filter(source => failed.has(source.id)).map(source => [source.id, source]))
          if (runId === sourceBulkRunRef.current) setSources(current => current.map(source => source.active === active ? successful.get(source.id) ?? previous.get(source.id) ?? source : source))
        }
        if (runId !== sourceBulkRunRef.current) return
        const firstFailure = updates.find(result => result.status === 'rejected')
        const reason = firstFailure?.status === 'rejected' ? ` ${getErrorMessage(firstFailure.reason)}` : ''
        setApiError(`Не удалось ${active ? 'включить' : 'выключить'} ${failed.size} из ${changedSources.length} источников.${reason}`)
      } else {
        setSources(current => current.map(source => source.active === active ? successful.get(source.id) ?? source : source))
      }
    }
    sourceBulkQueueRef.current = sourceBulkQueueRef.current.then(update, update)
    return sourceBulkQueueRef.current
  }
  const deleteSource = async (id: number) => {
    if (sources.some(source => source.id === id && isLocalSourcePlatform(source.platform))) {
      setSources(current => current.filter(source => source.id !== id))
      return
    }
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
  const removeAllSaved = async () => {
    if (!saved.length) return
    setApiError('')
    const outcomes = await Promise.allSettled(saved.map(item => api.deleteSearch(item.id)))
    const removedIds = new Set(saved.filter((_, index) => outcomes[index].status === 'fulfilled').map(item => item.id))
    setSaved(current => current.filter(item => !removedIds.has(item.id)))
    if (searchId !== null && removedIds.has(searchId)) {
      setSearchId(null)
      setResults([])
      setHasSearched(false)
    }
    const failedCount = outcomes.length - removedIds.size
    if (failedCount) setApiError(`Удалось удалить ${removedIds.size} из ${outcomes.length} запросов. Остальные не удалось удалить через API.`)
    else setNotice(`Удалено запросов: ${removedIds.size}.`)
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
        <NavItem active={page === 'results' || page === 'publication'} icon={<Newspaper size={18}/>} onClick={startNewSearch}>Поиск</NavItem>
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
          results={results} query={query} setQuery={updateQuery} hasSearched={hasSearched} isSearching={isSearching} isOpeningSavedSearch={isOpeningSavedSearch}
          onNewSearch={startNewSearch}
          periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
          region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform}
          onSubmit={runSearch} onExport={exportResults} onOpen={item => { setSelectedPublication(item); setSelectedPublicationIndex(results.findIndex(result => result.id === item.id)); setPage('publication') }} validationSubmitted={validationSubmitted}
        />}
        {page === 'publication' && selectedPublication && <PublicationPage item={selectedPublication} position={selectedPublicationIndex + 1} total={results.length} onPrevious={() => { const next = results[selectedPublicationIndex - 1]; if (next) { setSelectedPublication(next); setSelectedPublicationIndex(selectedPublicationIndex - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) } }} onNext={() => { const next = results[selectedPublicationIndex + 1]; if (next) { setSelectedPublication(next); setSelectedPublicationIndex(selectedPublicationIndex + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) } }} onBack={() => setPage('results')}/>}
        {page === 'sources' && <SourcesPage sources={sources} onAdd={() => openSourceDialog()} onEdit={openSourceDialog} onToggle={toggleSource} onToggleAll={setAllSourcesActive} onDelete={deleteSource}/>}
        {page === 'saved' && <SavedPage
          items={saved} recentlyOpened={recentlyOpened} onOpen={openSaved} onRestart={restartSavedSearch} onRemove={removeSaved}
          onRemoveAll={removeAllSaved}
          onClearFavorites={() => setSaved(current => current.map(item => ({ ...item, favorite: false })))}
          onNew={startNewSearch}
          onFavorite={id => setSaved(current => current.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item))}
        />}
        {page === 'settings' && <SettingsPage tab={settingsTab} setTab={setSettingsTab} region={region} setRegion={setRegion} themeMode={themeMode} setThemeMode={setThemeMode} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }} saved={settingsSaved}/>}
      </div>
    </main>
    {sourceModal && <div className="modal-backdrop" onClick={() => setSourceModal(false)}>
      <form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={submitSource}>
        <div className="modal-heading"><div><h2>{sourceEdit === null ? 'Добавить источник' : 'Редактировать источник'}</h2><p>Укажите страницу или сообщество для мониторинга</p></div><button type="button" className="icon-button" onClick={() => setSourceModal(false)}><X size={18}/></button></div>
        {sourceModalError && <div className="source-modal-error" role="alert"><CircleAlert size={16}/><span>{sourceModalError}</span><button type="button" onClick={() => setSourceModalError('')} aria-label="Закрыть"><X size={15}/></button></div>}
        <label>Название<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Например, Новости города"/></label>
        <label>Ссылка<input required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder={sourcePlatform === 'TG' ? 't.me/channel' : sourcePlatform === 'DZEN' ? 'dzen.ru/channel' : 'vk.com/community'}/></label>
        <label>Площадка<div className="source-platform-control">
          {isLocalSourcePlatform(sourcePlatform) && <img src={localPlatformIcon[sourcePlatform]} alt=""/>}
          <select value={sourcePlatform} disabled={sourceEdit !== null} onChange={event => setSourcePlatform(event.target.value as SourcePlatform)}>
            <option value="VK">VK</option><option value="OK">Одноклассники</option><option value="MAX">MAX</option><option value="TG">Telegram</option><option value="DZEN">Дзен</option>
          </select>
        </div></label>
        {isLocalSourcePlatform(sourcePlatform) && <p className="source-local-hint">Канал сохранится в этом браузере. Поиск по этой площадке подключим позже.</p>}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setSourceModal(false)}>Отмена</button><button className="button-primary"><Check size={16}/>Сохранить</button></div>
      </form>
    </div>}
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
      <label className={validationSubmitted && !periodStart ? 'field-invalid-label' : ''}><span>Период с</span><CompactDateInput value={periodStart} min="2000-01-01" max={capToToday(periodEnd) || undefined} rangeStart={periodStart} rangeEnd={periodEnd} label="Начало периода" invalid={validationSubmitted && !periodStart} onChange={setPeriodStart}/></label>
      <label className={validationSubmitted && !periodEnd ? 'field-invalid-label' : ''}><span>по</span><CompactDateInput value={periodEnd} min={periodStart || '2000-01-01'} max={todayInputValue()} rangeStart={periodStart} rangeEnd={periodEnd} label="Конец периода" invalid={validationSubmitted && !periodEnd} onChange={setPeriodEnd}/></label>
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

function ResultsPage({ results, query, setQuery, hasSearched, isSearching, isOpeningSavedSearch, onNewSearch, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, regions, platforms, togglePlatform, onSubmit, onExport, onOpen, validationSubmitted = false }: { results: Publication[]; query: string; setQuery: (value: string) => void; hasSearched: boolean; isSearching: boolean; isOpeningSavedSearch: boolean; onNewSearch: () => void; periodStart: string; setPeriodStart: (value: string) => void; periodEnd: string; setPeriodEnd: (value: string) => void; region: string; setRegion: (value: string) => void; regions: string[]; platforms: Platform[]; togglePlatform: (platform: Platform) => void; onSubmit: (event: FormEvent) => void; onExport: () => void; onOpen: (item: Publication) => void; validationSubmitted?: boolean }) {
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
    {!hasSearched && <SearchPage embedded query={query} setQuery={setQuery} periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd} region={region} setRegion={setRegion} regions={regions} platforms={platforms} togglePlatform={togglePlatform} onSubmit={onSubmit} validationSubmitted={validationSubmitted} isSearching={isSearching}/>}
    {hasSearched ? isSearching ? <div className="results-empty-state results-loading"><span><Search size={24}/></span><h2>{isOpeningSavedSearch ? 'Открываю сохранённый запрос' : 'Идёт поиск публикаций'}</h2><p>{isOpeningSavedSearch ? 'Загружаю уже сохранённые результаты из истории.' : 'Сервер обрабатывает источники.'}</p></div> : <>
    <div className="design-page-heading results-found-heading"><div><h1>Результаты поиска</h1><p className="results-query-caption">Запрос: «{query}»</p></div><div className="heading-actions"><button onClick={onNewSearch} className="soft-action"><Search size={14}/>Новый поиск</button><button onClick={() => setSavedResult(!savedResult)} className={`soft-action ${savedResult ? 'soft-action-saved' : ''}`}><Bookmark size={14}/>{savedResult ? 'Запрос сохранён' : 'Сохранить запрос'}</button><button onClick={onExport} className="primary-action" disabled={!results.length}><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar">
      <div className="summary-filter"><CalendarDays size={15}/><span>{prettyDate(periodStart)} — {prettyDate(periodEnd)}</span></div>
      <div className="summary-filter"><MapPin size={15}/><span>{region}</span></div>
      <span className="results-platform-summary">{platforms.length ? platforms.join(' · ') : 'Площадки не выбраны'}</span>
    </div>
    <section ref={resultsCardRef} className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{results.length}</strong> публикаций</h2><p>Показываем отдельные размещения с прямыми ссылками на источник</p></div><div className="sort-control"><span>Сортировка</span><SortDropdown value={sort} onChange={setSort}/></div></div>
      <div className="result-rows">{pageItems.map(item => <article key={item.id} className="result-row"><input aria-label={`Выбрать публикацию: ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><button type="button" onClick={() => onOpen(item)} className="result-photo publication-thumb has-image"><img className="media-photo" src={item.image} alt=""/><span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform === 'OK' ? '✦' : item.platform === 'MAX' ? '●' : 'ᴠκ'}</span></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{item.title}</button><a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a></div><p>{item.excerpt}</p><div className="result-metadata"><span><Users size={12}/>{item.source}</span><span>{item.date}</span></div><div className="result-engagement"><span><Heart size={13}/>{item.likes}</span><span><Eye size={13}/>{item.views}</span><span><Share2 size={13}/>{item.reposts}</span><span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span></div></div></article>)}</div>
      <div className="results-pagination"><span>Показано <b>{results.length ? pageStart + 1 : 0}–{Math.min(pageStart + pageSize, results.length)}</b> из <b>{results.length}</b> публикаций</span><div className="results-page-navigation"><span className="results-page-count">Страница <b>{resultPage}</b> из <b>{pages}</b></span><div className="results-page-controls"><button type="button" aria-label="Предыдущая страница" title="Предыдущая страница" disabled={resultPage === 1} onClick={() => goToResultPage(resultPage - 1)}><ChevronLeft size={16}/></button><span className="results-current-page" aria-label={`Текущая страница ${resultPage} из ${pages}`}>{resultPage}</span><button type="button" aria-label="Следующая страница" title="Следующая страница" disabled={resultPage === pages} onClick={() => goToResultPage(resultPage + 1)}><ChevronRight size={16}/></button></div></div></div>
    </section>
    </> : <div className="results-empty-state"><span><Search size={24}/></span><h2>Введите запрос, чтобы начать поиск</h2><p>Результаты публикаций появятся здесь сразу после нажатия кнопки «Найти».</p></div>}
  </div>
}

function PublicationPage({ item, position, total, onPrevious, onNext, onBack }: { item: Publication; position: number; total: number; onPrevious: () => void; onNext: () => void; onBack: () => void }) {
  const [liked, setLiked] = useState(false)
  const [savedPublications, setSavedPublications] = useState<number[]>([])
  const publicationSaved = savedPublications.includes(item.id)
  const sentimentText = `${item.title} ${item.excerpt}`.toLowerCase()
  const positiveSignals = ['побед', 'успех', 'празд', 'подар', 'открыт', 'развит', 'улучш', 'удач'].filter(word => sentimentText.includes(word)).length
  const negativeSignals = ['авари', 'опас', 'жалоб', 'наруш', 'проблем', 'погиб', 'критик', 'ущерб'].filter(word => sentimentText.includes(word)).length
  const positiveSentiment = Math.min(50, 20 + positiveSignals * 9)
  const negativeSentiment = Math.min(35, 9 + negativeSignals * 9)
  const neutralSentiment = 100 - positiveSentiment - negativeSentiment
  const dominantSentiment = positiveSentiment > neutralSentiment && positiveSentiment > negativeSentiment
    ? { label: 'Позитивная', className: 'positive', icon: <Smile size={17}/> }
    : negativeSentiment > neutralSentiment
      ? { label: 'Негативная', className: 'negative', icon: <Frown size={17}/> }
      : { label: 'Нейтральная', className: 'neutral', icon: <Meh size={17}/> }

  return <div className="publication-page">
    <div className="publication-toolbar"><button type="button" className="publication-back" onClick={onBack}><ArrowLeft size={15}/>Назад к результатам</button><div className="publication-navigation" aria-label="Навигация по публикациям"><button type="button" aria-label="Предыдущая публикация" title="Предыдущая публикация" disabled={position <= 1} onClick={onPrevious}><ChevronLeft size={17}/></button><span>{position > 0 ? `${position} из ${total}` : 'Публикация'}</span><button type="button" aria-label="Следующая публикация" title="Следующая публикация" disabled={position <= 0 || position >= total} onClick={onNext}><ChevronRight size={17}/></button></div></div>
    <div className="publication-layout">
      <article className="publication-card">
        <header className="publication-header">
          <div className="publication-source-avatar" style={{ backgroundColor: item.color }}>{item.source.slice(0, 1)}</div>
          <div><strong>{item.source}</strong><span>{item.date}</span></div>
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
          <a className="primary-action publication-primary-action" href={item.url} target="_blank" rel="noreferrer">Открыть оригинал <ExternalLink size={14}/></a>
        </footer>
      </article>
      <div className="publication-aside-column"><aside className="publication-info">
        <div className="publication-info-heading"><span><Newspaper size={18}/></span><div><h2>О публикации</h2><p>Основные сведения</p></div></div>
        <dl>
          <div className="publication-info-row"><span className="publication-info-icon"><Users size={15}/></span><div className="publication-info-copy"><dt>Источник</dt><dd>{item.source}</dd></div></div>
          <div className="publication-info-row"><span className="publication-info-icon"><PlatformBadge platform={item.platform} size={20}/></span><div className="publication-info-copy"><dt>Площадка</dt><dd><span className={`publication-info-platform ${item.platform.toLowerCase()}`}>{platformLabel[item.platform]}</span></dd></div></div>
          <div className="publication-info-row"><span className="publication-info-icon"><CalendarDays size={15}/></span><div className="publication-info-copy"><dt>Дата публикации</dt><dd>{item.date}</dd></div></div>
          <div className="publication-info-row"><span className="publication-info-icon"><Check size={15}/></span><div className="publication-info-copy"><dt>Соответствие запросу</dt><dd><span className="publication-info-match">{item.kind}</span></dd></div></div>
        </dl>
        <button type="button" aria-pressed={publicationSaved} className={`primary-action publication-primary-action ${publicationSaved ? 'publication-saved' : ''}`} onClick={() => setSavedPublications(current => publicationSaved ? current.filter(id => id !== item.id) : [...current, item.id])}><Bookmark size={15} fill={publicationSaved ? 'currentColor' : 'none'}/>{publicationSaved ? 'Публикация сохранена' : 'Сохранить публикацию'}</button>
      </aside>
      <section className="publication-sentiment" aria-labelledby="publication-sentiment-title">
        <div className="publication-sentiment-command"><div className="publication-sentiment-heading"><span><BarChart3 size={18}/></span><div><h2 id="publication-sentiment-title">Эмоциональность</h2><p>Анализ тональности текста</p></div></div><div className={`publication-sentiment-summary ${dominantSentiment.className}`}><span>{dominantSentiment.icon}</span><div><small>Общий тон</small><strong>{dominantSentiment.label}</strong></div></div></div>
        <div className="publication-sentiment-bars">
          <div className="sentiment-row positive"><div><span>Позитивная</span><span className="sentiment-row-actions"><b>{positiveSentiment}%</b><MoreHorizontal size={14}/><ArrowRight size={14}/></span></div><i><span style={{ width: `${positiveSentiment}%` }}/></i></div>
          <div className="sentiment-row neutral"><div><span>Нейтральная</span><span className="sentiment-row-actions"><b>{neutralSentiment}%</b><MoreHorizontal size={14}/><ArrowRight size={14}/></span></div><i><span style={{ width: `${neutralSentiment}%` }}/></i></div>
          <div className="sentiment-row negative"><div><span>Негативная</span><span className="sentiment-row-actions"><b>{negativeSentiment}%</b><MoreHorizontal size={14}/><ArrowRight size={14}/></span></div><i><span style={{ width: `${negativeSentiment}%` }}/></i></div>
        </div>
      </section></div>
    </div>
  </div>
}

function SourcesPage({ sources, onAdd, onEdit, onToggle, onToggleAll, onDelete }: { sources: Source[]; onAdd: () => void; onEdit: (source: Source) => void; onToggle: (id: number) => void; onToggleAll: (active: boolean) => Promise<void>; onDelete: (id: number) => void }) {
  const searchableSources = sources.filter(source => !isLocalSourcePlatform(source.platform))
  const allSourcesActive = searchableSources.length > 0 && searchableSources.every(source => source.active)
  return <section className="repository-sources"><div className="repository-source-heading"><div><div className="repository-kicker"><Users size={13}/>Справочник</div><h1>Источники публикаций</h1><p>Сообщества и каналы для поиска по выбранному списку</p></div><button onClick={onAdd}><Plus size={15}/>Добавить источник</button></div>
    <div className="panel repository-source-list"><div className="repository-source-list-head"><input className="repository-select-all" type="checkbox" aria-label="Выбрать все подключённые источники" checked={allSourcesActive} disabled={!searchableSources.length} onChange={() => void onToggleAll(!allSourcesActive)}/><div><h2>Мой список</h2><p>{sources.length} источников · {searchableSources.length} доступны для выбора в поиске</p></div></div>
      <div>{sources.map(source => {
        const local = isLocalSourcePlatform(source.platform)
        return <div key={source.id} className="repository-source-row">
          <button type="button" onClick={() => onToggle(source.id)} disabled={local} title={local ? 'Поиск по этой площадке пока не подключён' : undefined} aria-label={`Выбрать ${source.name}`} className={`repository-check ${source.active ? 'checked' : ''}`}><Check size={12}/></button>
          <button type="button" onClick={() => onEdit(source)} aria-label={`Редактировать ${source.name}`} style={{backgroundColor:local ? 'transparent' : `${source.color}18`,color:source.color}} className="repository-source-avatar">{isLocalSourcePlatform(source.platform) ? <img src={localPlatformIcon[source.platform]} alt=""/> : source.name.slice(0,1)}</button>
          <div className="repository-source-copy"><button type="button" onClick={() => onEdit(source)}>{source.name}</button><a href={/^https?:\/\//i.test(source.url) ? source.url : `https://${source.url}`} target="_blank" rel="noreferrer">{source.url.replace(/^https?:\/\//, '')}<ExternalLink size={9}/></a></div>
          <span className={`repository-platform ${source.platform.toLowerCase()}`}>{sourcePlatformLabel[source.platform]}</span>
          <span className="repository-followers">{source.followers}</span>
          <span className={`repository-status ${local ? 'pending' : source.active ? '' : 'offline'}`}><i/>{local ? 'Ожидает подключения' : source.active ? 'Доступен' : 'Отключён'}</span>
          <button type="button" onClick={() => onDelete(source.id)} className="repository-delete" aria-label={`Удалить ${source.name}`}>×</button>
        </div>
      })}</div>
      <div className="repository-source-note">Telegram и Дзен сохраняются в этом браузере. Поиск по ним станет доступен после подключения API.</div>
    </div>
  </section>
}

function SavedPage({ items, recentlyOpened, onOpen, onRestart, onRemove, onRemoveAll, onClearFavorites, onNew, onFavorite }: { items: SavedQuery[]; recentlyOpened: Record<number, number>; onOpen: (item: SavedQuery) => void; onRestart: (item: SavedQuery) => void; onRemove: (id: number) => void; onRemoveAll: () => void; onClearFavorites: () => void; onNew: () => void; onFavorite: (id: number) => void }) {
  const [openActionsId, setOpenActionsId] = useState<number | null>(null)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [queryFilter, setQueryFilter] = useState('')
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ApiSearch['status']>('all')
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'results' | 'opened'>('newest')
  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.saved-actions, .saved-bulk-actions')) return
      setOpenActionsId(null)
      setBulkMenuOpen(false)
    }
    const closeMenusOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenActionsId(null)
        setBulkMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeMenusOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeMenusOnEscape)
    }
  }, [])

  const availablePlatforms = [...new Set(items.flatMap(item => item.platforms ?? []))]
  const filteredItems = items.filter(item => {
    const needle = queryFilter.trim().toLocaleLowerCase('ru')
    const matchesText = !needle || `${item.name} ${item.query}`.toLocaleLowerCase('ru').includes(needle)
    return matchesText
      && (!favoriteFilter || item.favorite)
      && (statusFilter === 'all' || item.status === statusFilter)
      && (platformFilter === 'all' || item.platforms?.includes(platformFilter))
  }).sort((a, b) => {
    if (sortBy === 'results') return (b.totalFound ?? -1) - (a.totalFound ?? -1)
    if (sortBy === 'opened') return (recentlyOpened[b.id] ?? 0) - (recentlyOpened[a.id] ?? 0)
    return Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '')
  })
  const favoriteCount = items.filter(item => item.favorite).length
  const formatDate = (value?: string | number) => {
    if (!value) return '—'
    const date = typeof value === 'number' ? new Date(value) : new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', ...(typeof value === 'string' ? { year: 'numeric' as const } : {}), hour: typeof value === 'number' ? '2-digit' as const : undefined, minute: typeof value === 'number' ? '2-digit' as const : undefined }).format(date)
  }
  const statusLabel: Record<ApiSearch['status'], string> = { RUNNING: 'Выполняется', COMPLETED: 'Завершён', COMPLETED_PARTIAL: 'Частично', FAILED: 'Ошибка' }

  return <section className="saved-shell">
    <header className="saved-page-head"><div><h1>Сохранённые запросы</h1><p>История поисков и быстрый доступ к результатам</p></div><button className="button-primary" onClick={onNew}><Plus size={16}/>Новый запрос</button></header>
    <div className="saved-toolbar">
      <label className="saved-filter-search"><Search size={15}/><input value={queryFilter} onChange={event => setQueryFilter(event.target.value)} placeholder="Найти запрос…" aria-label="Найти сохранённый запрос"/></label>
      <div className="saved-filter-tabs"><button className={!favoriteFilter ? 'active' : ''} onClick={() => setFavoriteFilter(false)}>Все <span>{items.length}</span></button><button className={favoriteFilter ? 'active' : ''} onClick={() => setFavoriteFilter(true)}><Star size={12}/>Избранное <span>{favoriteCount}</span></button></div>
      <label className="saved-select-filter"><span>Статус</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Все статусы</option><option value="COMPLETED">Завершён</option><option value="COMPLETED_PARTIAL">Частично</option><option value="RUNNING">Выполняется</option><option value="FAILED">Ошибка</option></select></label>
      <label className="saved-select-filter"><span>Площадка</span><select value={platformFilter} onChange={event => setPlatformFilter(event.target.value as typeof platformFilter)} disabled={!availablePlatforms.length}><option value="all">Все площадки</option>{availablePlatforms.map(platform => <option key={platform} value={platform}>{platformLabel[platform]}</option>)}</select></label>
      <label className="saved-select-filter saved-sort-filter"><span>Сортировка</span><select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}><option value="newest">Сначала новые</option><option value="results">Больше результатов</option><option value="opened">Недавно открытые</option></select></label>
    </div>
    <div className="saved-table-wrap"><table className="saved-queries-table"><thead><tr><th><div className="saved-bulk-actions"><input type="checkbox" aria-label="Массовые действия с запросами" title="Массовые действия" checked={bulkMenuOpen} disabled={items.length === 0} onChange={() => { setOpenActionsId(null); setBulkMenuOpen(open => !open) }}/>{bulkMenuOpen && <div className="saved-bulk-menu"><button type="button" onClick={() => { setBulkMenuOpen(false); onClearFavorites() }}>Убрать все из избранного</button><button type="button" className="danger-action" onClick={() => { setBulkMenuOpen(false); onRemoveAll() }}>Удалить все запросы</button></div>}</div></th><th>Название</th><th>Запрос</th><th>Период</th><th>Регион</th><th>Действия</th></tr></thead><tbody>{filteredItems.map(item => <tr key={item.id}><td><button className={`favorite-star ${item.favorite ? 'favorite-on' : ''}`} title={item.favorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavorite(item.id)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'}/></button></td><td className="saved-name-cell"><button className="saved-query-name" onClick={() => onOpen(item)}>{item.name}</button><div className="saved-row-meta">{item.status && <span className={`saved-status saved-status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span>}<span>{item.totalFound === undefined ? 'Число публикаций не указано' : `${item.totalFound} публ.`}</span>{item.createdAt && <span>{formatDate(item.createdAt)}</span>}</div>{recentlyOpened[item.id] && <small className="saved-last-opened">Открыт: {formatDate(recentlyOpened[item.id])}</small>}{item.platforms?.length ? <div className="saved-platform-tags">{[...new Set(item.platforms)].map(platform => <i key={platform} className={`saved-platform-tag ${platform.toLowerCase()}`}>{platform}</i>)}</div> : null}</td><td><span className="saved-query-text">{item.query}</span></td><td>{item.period}</td><td>{item.region}</td><td><details className="saved-actions" open={openActionsId === item.id}><summary aria-label="Действия с запросом" onClick={event => { event.preventDefault(); setBulkMenuOpen(false); setOpenActionsId(current => current === item.id ? null : item.id) }}><MoreHorizontal size={17}/></summary><div><button onClick={() => { setOpenActionsId(null); onOpen(item) }}>Открыть результаты</button><button onClick={() => { setOpenActionsId(null); onRestart(item) }}>Запустить заново</button><button onClick={() => { setOpenActionsId(null); onFavorite(item.id) }}>{item.favorite ? 'Убрать из избранного' : 'В избранное'}</button><button className="danger-action" onClick={() => { setOpenActionsId(null); onRemove(item.id) }}>Удалить</button></div></details></td></tr>)}</tbody></table>{items.length === 0 ? <div className="saved-empty-state"><Bookmark size={24}/><strong>Пока нет сохранённых запросов</strong><span>Создайте запрос, чтобы быстро возвращаться к его результатам.</span><button className="button-primary" onClick={onNew}><Plus size={15}/>Создать первый запрос</button></div> : filteredItems.length === 0 && <div className="saved-empty-state"><Search size={22}/><strong>По этим фильтрам ничего нет</strong><span>Измените запрос или сбросьте фильтры.</span><button className="soft-action" onClick={() => { setQueryFilter(''); setFavoriteFilter(false); setStatusFilter('all'); setPlatformFilter('all') }}>Сбросить фильтры</button></div>}</div>
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

export type ApiPlatform = 'VK' | 'OK' | 'MAX' | 'TG' | 'SITE' | 'DZEN' | 'TG' | 'SITE' | 'DZEN' | 'TG' | 'SITE' | 'DZEN'
export type SearchType = 'TOPIC' | 'EVENT' | 'PERSON' | 'NEWS_TEXT'
export type SearchMode = 'BY_SOURCES' | 'ALL_PLATFORMS'
export type SearchStatus = 'RUNNING' | 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED'

export type ApiSource = {
  id: number
  name: string
  platform: ApiPlatform
  url: string
  logoUrl: string | null
  description: string | null
  active: boolean
  createdAt: string
}

export type SourceInput = Pick<ApiSource, 'name' | 'platform' | 'url'> & {
  description?: string
  active?: boolean
}

export type SearchInput = {
  query: string
  additionalInfo?: string
  searchType: SearchType
  mode: SearchMode
  sourceIds?: number[]
  dateFrom?: string
  dateTo?: string
  region?: string
  provider?: 'demo' | 'real'
  useAi?: boolean
}

export type SourceSearchStatus = {
  id: number
  sourceId: number
  sourceName: string
  platform: ApiPlatform
  status: 'PENDING' | 'OK' | 'UNAVAILABLE' | 'ERROR'
  foundCount: number
  message: string | null
}

export type ApiSearch = {
  id: number
  query: string
  additionalInfo?: string | null
  searchType: SearchType
  mode: SearchMode
  dateFrom: string | null
  dateTo: string | null
  region: string | null
  status: SearchStatus
  provider?: string
  useAi?: boolean
  totalFound: number
  duplicatesSkipped?: number
  irrelevantSkipped?: number
  sourcesTotal: number
  sourcesProcessed: number
  sourcesOk?: number
  sourcesFailed: number
  error?: string | null
  createdAt: string
  startedAt?: string | null
  finishedAt: string | null
  sources?: SourceSearchStatus[]
}

export type ApiPublication = {
  id: number
  sourceId: number
  sourceName: string
  platform: ApiPlatform
  url: string
  title: string
  excerpt: string
  imageUrl: string | null
  publishedAt: string | null
  hasDate: boolean
  relevance: number
  aiRelevance: number | null
  aiComment: string | null
  likes: number | null
  reposts: number | null
  views: number | null
  foundAt: string
}

export type PublicationPage = {
  content: ApiPublication[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type PlatformInfo = { code: ApiPlatform; title: string; realApiSupported: boolean }
export type AiStatus = { enabled: boolean; configured: boolean; connected: boolean; model: string; scope: string; message: string }
export type AiRelevance = { checked: boolean; relevance: number | null; comment: string | null; model: string; message: string }
export type AuthResponse = { token: string; expiresAt: string; user: { id: number; name: string; email: string } }
export type SavedQuery = { id: number; name: string; query: string; period: string | null; region: string | null; favorite: boolean; createdAt: string }
export type SavedQueryInput = { name: string; query: string; period?: string; region?: string; favorite?: boolean }

const configuredBaseUrl = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
export const API_BASE_URL = (configuredBaseUrl || (isLocal ? 'http://109.196.167.225:8080' : 'https://krasnoyarsk.calonders.ru')).replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getToken() {
  return typeof window !== 'undefined' ? window.localStorage.getItem('krasnopars-token') : null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  const rawBody = await response.text()

  if (!response.ok) {
    // Истёкший или отозванный токен: сбрасываем сессию и просим войти заново.
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.localStorage.removeItem('krasnopars-token')
      window.dispatchEvent(new Event('krasnopars-unauthorized'))
    }
    let message = `Ошибка API (${response.status})`
    try {
      const body = JSON.parse(rawBody) as { message?: string; error?: string; detail?: string }
      message = body.message || body.error || body.detail || message
    } catch {
      if (rawBody) message = rawBody
    }
    throw new ApiError(message, response.status)
  }

  if (!rawBody) return undefined as T
  return JSON.parse(rawBody) as T
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  platforms: () => request<PlatformInfo[]>('/api/platforms'),
  regions: () => request<string[]>('/api/regions'),
  aiStatus: () => request<AiStatus>('/api/ai/status'),
  checkRelevance: (input: { query: string; text: string; additionalInfo?: string; searchType?: SearchType }) =>
    request<AiRelevance>('/api/ai/relevance', { method: 'POST', body: JSON.stringify(input) }),

  auth: {
    login: (input: any) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    register: (input: any) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    me: () => request<AuthResponse['user']>('/api/auth/me'),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },

  sources: (filters?: { platform?: ApiPlatform; active?: boolean; q?: string }) => {
    const params = new URLSearchParams()
    if (filters?.platform) params.set('platform', filters.platform)
    if (filters?.active !== undefined) params.set('active', String(filters.active))
    if (filters?.q) params.set('q', filters.q)
    const query = params.size ? `?${params}` : ''
    return request<ApiSource[]>(`/api/sources${query}`)
  },
  source: (id: number) => request<ApiSource>(`/api/sources/${id}`),
  createSource: (input: SourceInput) => request<ApiSource>('/api/sources', { method: 'POST', body: JSON.stringify(input) }),
  updateSource: (id: number, input: SourceInput) => request<ApiSource>(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteSource: (id: number) => request<void>(`/api/sources/${id}`, { method: 'DELETE' }),

  searches: () => request<ApiSearch[]>('/api/search'),
  createSearch: (input: SearchInput) => request<ApiSearch>('/api/search', { method: 'POST', body: JSON.stringify(input) }),
  search: (id: number) => request<ApiSearch>(`/api/search/${id}`),
  restartSearch: (id: number) => request<ApiSearch>(`/api/search/${id}/restart`, { method: 'POST' }),
  deleteSearch: (id: number) => request<void>(`/api/search/${id}`, { method: 'DELETE' }),
  publications: (id: number, page = 0, size = 100, sort: 'relevance' | 'date' | 'found' = 'relevance') =>
    request<PublicationPage>(`/api/search/${id}/publications?page=${page}&size=${size}&sort=${sort}`),

  savedQueries: () => request<SavedQuery[]>('/api/saved-queries'),
  saveQuery: (input: SavedQueryInput) => request<SavedQuery>('/api/saved-queries', { method: 'POST', body: JSON.stringify(input) }),
  deleteSavedQuery: (id: number) => request<void>(`/api/saved-queries/${id}`, { method: 'DELETE' }),
  toggleFavoriteQuery: (id: number, favorite: boolean) => request<SavedQuery>(`/api/saved-queries/${id}/favorite?favorite=${favorite}`, { method: 'PUT' }),
}

export async function waitForSearch(id: number, signal?: AbortSignal): Promise<ApiSearch> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Поиск отменён', 'AbortError')
    const search = await api.search(id)
    if (search.status !== 'RUNNING') return search
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1_000)
      signal?.addEventListener('abort', () => {
        window.clearTimeout(timer)
        reject(new DOMException('Поиск отменён', 'AbortError'))
      }, { once: true })
    })
  }
  throw new Error('Поиск выполняется дольше 90 секунд. Попробуйте открыть его позже.')
}

export async function downloadSearchExport(id: number, format: 'xlsx' | 'docx' = 'xlsx') {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}/api/search/${id}/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    let message = `Не удалось выгрузить отчёт (${response.status})`
    try { const body = await response.json() as { message?: string }; if (body?.message) message = body.message } catch { /* не-json ответ */ }
    throw new ApiError(message, response.status)
  }
  const blob = await response.blob()
  if (!blob || blob.size === 0) throw new ApiError('Выгрузился пустой файл — попробуйте повторить поиск и выгрузку.', response.status)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `media-monitoring-${id}.${format}`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

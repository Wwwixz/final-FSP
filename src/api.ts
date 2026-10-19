export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://109.196.167.225:8080').replace(/\/$/, '')

export type Platform = 'VK' | 'OK' | 'MAX'
export type SearchType = 'TOPIC' | 'EVENT' | 'PERSON' | 'NEWS_TEXT'
export type SearchMode = 'BY_SOURCES' | 'ALL_PLATFORMS'
export type SearchStatus = 'RUNNING' | 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED'
export type PublicationSort = 'relevance' | 'date' | 'found'

export interface PlatformDto { code: Platform; title: string; realApiSupported: boolean }
export interface SourceDto { id: number; name: string; platform: Platform; url: string; description: string | null; active: boolean; createdAt: string }
export type SourceInput = Pick<SourceDto, 'name' | 'platform' | 'url' | 'description' | 'active'>
export interface SearchInput {
  query: string
  additionalInfo?: string
  searchType: SearchType
  mode: SearchMode
  sourceIds?: number[]
  dateFrom?: string
  dateTo?: string
  region?: string
  provider: 'demo' | 'real'
  useAi: boolean
}
export interface SearchSummary {
  id: number; query: string; searchType: SearchType; mode: SearchMode
  dateFrom: string | null; dateTo: string | null; region: string | null
  status: SearchStatus; totalFound: number; sourcesTotal: number
  sourcesProcessed: number; sourcesFailed: number; createdAt: string; finishedAt: string | null
}
export interface SearchSource {
  id: number; sourceId: number; sourceName: string; platform: Platform
  status: 'PENDING' | 'OK' | 'UNAVAILABLE' | 'ERROR'; foundCount: number; message: string | null
}
export interface SearchDetail extends SearchSummary {
  additionalInfo: string | null; provider: 'demo' | 'real'; useAi: boolean
  duplicatesSkipped: number; irrelevantSkipped: number; sourcesOk: number
  error: string | null; startedAt: string | null; sources: SearchSource[]
}
export interface PublicationDto {
  id: number; sourceId: number; sourceName: string; platform: Platform; url: string
  title: string | null; excerpt: string | null; publishedAt: string | null; hasDate: boolean
  relevance: number | null; aiRelevance: number | null; aiComment: string | null
  likes: number | null; reposts: number | null; views: number | null; foundAt: string
}
export interface PageResponse<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean }
export interface AiStatus { enabled: boolean; configured: boolean; connected: boolean; model: string | null; message: string | null }

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...(init?.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError('Не удалось связаться с сервером. Проверьте адрес API и подключение к сети.')
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; title?: string } | null
    throw new ApiError(problem?.detail || problem?.title || `Ошибка сервера: ${response.status}`, response.status)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

export const api = {
  platforms: () => request<PlatformDto[]>('/api/platforms'),
  sources: () => request<SourceDto[]>('/api/sources'),
  createSource: (input: SourceInput) => request<SourceDto>('/api/sources', { method: 'POST', body: JSON.stringify(input) }),
  updateSource: (id: number, input: SourceInput) => request<SourceDto>(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteSource: (id: number) => request<void>(`/api/sources/${id}`, { method: 'DELETE' }),
  searches: () => request<SearchSummary[]>('/api/search'),
  createSearch: (input: SearchInput) => request<SearchDetail>('/api/search', { method: 'POST', body: JSON.stringify(input) }),
  search: (id: number) => request<SearchDetail>(`/api/search/${id}`),
  publications: (id: number, page: number, size: number, sort: PublicationSort) => request<PageResponse<PublicationDto>>(`/api/search/${id}/publications?${new URLSearchParams({ page: String(page), size: String(size), sort })}`),
  restartSearch: (id: number) => request<SearchDetail>(`/api/search/${id}/restart`, { method: 'POST' }),
  deleteSearch: (id: number) => request<void>(`/api/search/${id}`, { method: 'DELETE' }),
  aiStatus: () => request<AiStatus>('/api/ai/status'),
  async exportSearch(id: number, format: 'xlsx' | 'docx' = 'xlsx') {
    let response: Response
    try { response = await fetch(`${API_BASE_URL}/api/search/${id}/export?format=${format}`) }
    catch { throw new ApiError('Не удалось скачать отчёт: нет соединения с сервером.') }
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as { detail?: string } | null
      throw new ApiError(problem?.detail || `Ошибка выгрузки: ${response.status}`, response.status)
    }
    const blobUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `otchet-poiska-${id}.${format}`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  },
}

import type { ApiPlatform, ApiSearch, SearchMode, SearchType } from '../src/api'

export type Section = 'search' | 'history' | 'sources' | 'settings' | 'collections'
export type Navigation = { section: Section; view: 'form' | 'results' }
export type NavigationAction = { type: 'tab'; section: Section } | { type: 'form' | 'results' }
export const initialNavigation: Navigation = { section: 'search', view: 'form' }
export function navigate(state: Navigation, action: NavigationAction): Navigation {
  if (action.type === 'tab') return { section: action.section, view: action.section === 'search' ? 'form' : state.view }
  return { section: 'search', view: action.type }
}

export type PopupSession = {
  query?: string; additionalInfo?: string; searchType?: SearchType; mode?: SearchMode;
  selectedIds?: number[]; sourceSelectionReady?: boolean; platforms?: ApiPlatform[];
  dateFrom?: string; dateTo?: string; search?: ApiSearch | null;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
export function isDateInput(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function localDateInput(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseSession(raw: string | null): PopupSession {
  try {
    const data: unknown = JSON.parse(raw || '{}')
    if (!isRecord(data)) return {}
    const value: PopupSession = {}
    if (typeof data.query === 'string') value.query = data.query
    if (typeof data.additionalInfo === 'string') value.additionalInfo = data.additionalInfo
    if (['TOPIC', 'EVENT', 'PERSON', 'NEWS_TEXT'].includes(String(data.searchType))) value.searchType = data.searchType as SearchType
    if (['BY_SOURCES', 'ALL_PLATFORMS'].includes(String(data.mode))) value.mode = data.mode as SearchMode
    if (Array.isArray(data.selectedIds)) value.selectedIds = [...new Set(data.selectedIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
    value.sourceSelectionReady = data.sourceSelectionReady === true
    if (Array.isArray(data.platforms)) value.platforms = [...new Set(data.platforms.filter((item): item is ApiPlatform => ['VK', 'OK', 'MAX'].includes(item)))]
    for (const key of ['dateFrom', 'dateTo'] as const) if (data[key] === '' || isDateInput(data[key])) value[key] = data[key] as string
    if (isRecord(data.search) && Number.isInteger(data.search.id) && Number(data.search.id) > 0 && typeof data.search.query === 'string'
      && ['RUNNING', 'COMPLETED', 'COMPLETED_PARTIAL', 'FAILED'].includes(String(data.search.status))
      && ['BY_SOURCES', 'ALL_PLATFORMS'].includes(String(data.search.mode))
      && ['TOPIC', 'EVENT', 'PERSON', 'NEWS_TEXT'].includes(String(data.search.searchType))) value.search = data.search as ApiSearch
    return value
  } catch { return {} }
}

/** Invalidates earlier responses without relying on React render timing. */
export class RequestGate {
  private generation = 0
  private controller: AbortController | null = null
  get busy() { return this.controller !== null }
  begin() {
    this.cancel()
    this.controller = new AbortController()
    return { token: this.generation, signal: this.controller.signal }
  }
  current(token: number) { return this.controller !== null && token === this.generation }
  finish(token: number) {
    if (!this.current(token)) return false
    this.controller?.abort()
    this.controller = null
    return true
  }
  cancel() { this.controller?.abort(); this.controller = null; this.generation += 1 }
}

export function withTimeout<T>(operation: Promise<T>, { signal, timeoutMs = 20_000 }: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { if (timer) clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); reject(new DOMException('Ожидание отменено', 'AbortError')) }
    if (signal?.aborted) { operation.catch(() => undefined); abort(); return }
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => { cleanup(); reject(new Error('Сервис не ответил вовремя. Повторите попытку.')) }, timeoutMs)
    operation.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}

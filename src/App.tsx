import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity, BarChart3, Bell, Bookmark, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, Download, ExternalLink,
  Heart, LoaderCircle, MapPin, MessageCircle, Newspaper,
  Plus, Search, Share2, Trash2, Users, X,
} from 'lucide-react'
import * as XLSX from 'xlsx'

type Platform = 'VK' | 'OK' | 'MAX'
type Source = { id: number; name: string; platform: Platform; url: string; followers: string; color: string; initials: string }
type Publication = { id: number; source: string; platform: Platform; date: string; title: string; excerpt: string; url: string; kind: string; color: string; initials: string }

const initialSources: Source[] = [
  { id: 1, name: 'МВД 24', platform: 'VK', url: 'vk.com/mvd24', followers: '42,8 тыс.', color: '#5278d9', initials: 'М' },
  { id: 2, name: 'Город Красноярск', platform: 'VK', url: 'vk.com/krasnoyarskrf', followers: '118 тыс.', color: '#36a281', initials: 'Г' },
  { id: 3, name: 'Наш Красноярский край', platform: 'OK', url: 'ok.ru/krasnoyarsk', followers: '26,4 тыс.', color: '#e98a35', initials: 'Н' },
  { id: 4, name: 'Краевая администрация', platform: 'MAX', url: 'max.ru/krskstate', followers: '8,2 тыс.', color: '#7358ce', initials: 'К' },
]

const sampleResults: Publication[] = [
  { id: 1, source: 'МВД 24', platform: 'VK', date: '12 мар 2024, 14:27', title: 'В Красноярске открылся новый ледовый дворец', excerpt: 'Сегодня состоялось долгожданное открытие ледового дворца на левом берегу. Это современный комплекс с двумя аренами, зоной для зрителей и комфортной инфраструктурой…', url: 'https://vk.com/wall-120000_8451', kind: 'По теме', color: '#5278d9', initials: 'М' },
  { id: 2, source: 'Наш Красноярский край', platform: 'OK', date: '13 мар 2024, 10:05', title: 'Фоторепортаж: как выглядит новый ледовый дворец изнутри', excerpt: 'Показываем, как устроен новый ледовый дворец в Красноярске. Просторные раздевалки, современный тренировочный лёд и две игровые арены…', url: 'https://ok.ru/group/70000000000001/topic/159001', kind: 'По теме', color: '#e98a35', initials: 'Н' },
  { id: 3, source: 'МВД 24', platform: 'VK', date: '14 мар 2024, 18:40', title: 'Первые тренировки в новом ледовом дворце', excerpt: 'Юные хоккеисты уже оценили новую арену. Тренеры отмечают отличное качество льда и удобные раздевалки.', url: 'https://vk.com/wall-391123_18204', kind: 'По теме', color: '#5278d9', initials: 'М' },
  { id: 4, source: 'Краевая администрация', platform: 'MAX', date: '14 мар 2024, 16:12', title: 'Губернатор о значении нового ледового дворца для края', excerpt: 'Новый ледовый дворец — это важный шаг в развитии спортивной инфраструктуры региона. Здесь будут проходить соревнования краевого уровня…', url: 'https://max.ru/krskstate/AZabc123', kind: 'Связано', color: '#7358ce', initials: 'К' },
  { id: 5, source: 'Город Красноярск', platform: 'VK', date: '15 мар 2024, 09:30', title: 'Красноярцы делятся впечатлениями от открытия', excerpt: 'Горожане активно обсуждают новый ледовый дворец в социальных сетях. Собрали первые отзывы посетителей комплекса.', url: 'https://vk.com/wall-120000_8410', kind: 'Связано', color: '#36a281', initials: 'Г' },
]

const platformStyle: Record<Platform, string> = { VK: 'bg-[#eaf0ff] text-[#4266b0]', OK: 'bg-[#fff1e3] text-[#bd7026]', MAX: 'bg-[#f0eaff] text-[#7254bd]' }

function App() {
  const [view, setView] = useState<'monitor' | 'sources'>('monitor')
  const [query, setQuery] = useState('Открытие нового ледового дворца в Красноярске, отзывы и репортажи')
  const [periodStart, setPeriodStart] = useState('2024-03-01')
  const [periodEnd, setPeriodEnd] = useState('2024-03-31')
  const [platforms, setPlatforms] = useState<Platform[]>(['VK', 'OK', 'MAX'])
  const [mode, setMode] = useState<'selected' | 'broad'>('broad')
  const [sources, setSources] = useState(initialSources)
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSources.map(s => s.id))
  const [results, setResults] = useState(sampleResults)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(true)
  const [sourceModal, setSourceModal] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourcePlatform, setNewSourcePlatform] = useState<Platform>('VK')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('Все публикации')
  const [sortOrder, setSortOrder] = useState<'relevance' | 'newest'>('relevance')
  const [page, setPage] = useState(1)

  const visibleResults = useMemo(() => {
    const filtered = results.filter(result => platforms.includes(result.platform) && (filter === 'Все публикации' || result.kind === filter))
    return sortOrder === 'newest' ? [...filtered].reverse() : filtered
  }, [filter, platforms, results, sortOrder])
  const togglePlatform = (p: Platform) => setPlatforms(current => current.includes(p) ? current.filter(x => x !== p) : [...current, p])
  const toggleSource = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])

  const runSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || platforms.length === 0 || (mode === 'selected' && selectedIds.length === 0)) return
    setIsSearching(true)
    setHasSearched(false)
    setNotice('')
    window.setTimeout(() => {
      const queryResults = ['двор', 'лед', 'спорт', 'губернатор', 'открытие', 'красноярск', 'школ'].some(term => query.toLocaleLowerCase().includes(term))
        ? sampleResults.filter(result => platforms.includes(result.platform) && (mode === 'broad' || selectedIds.some(id => sources.find(source => source.id === id)?.name === result.source)))
        : []
      setResults(queryResults)
      setIsSearching(false)
      setHasSearched(true)
    }, 1300)
  }

  const exportXlsx = () => {
    const rows = visibleResults.map((r, index) => ({
      '№': index + 1, 'Площадка': r.platform, 'Источник': r.source, 'Заголовок': r.title,
      'Дата публикации': r.date, 'Выдержка': r.excerpt, 'Ссылка': r.url,
      'Запрос': query, 'Период': `${periodStart} — ${periodEnd}`,
    }))
    const book = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '№': '', 'Площадка': '', 'Источник': '', 'Заголовок': '', 'Дата публикации': '', 'Выдержка': '', 'Ссылка': '', 'Запрос': query, 'Период': `${periodStart} — ${periodEnd}` }])
    XLSX.utils.book_append_sheet(book, sheet, 'Публикации')
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Запрос', query], ['Период', `${periodStart} — ${periodEnd}`], ['Регион', 'Красноярский край'], ['Режим', mode === 'broad' ? 'Широкий поиск' : 'По списку источников'], ['Публикаций', visibleResults.length], ['Демо-данные', 'Да — результаты примера, не живой поиск']]), 'Параметры поиска')
    XLSX.writeFile(book, 'medi sled-podborka.xlsx'.replace(' ', ''))
    setNotice('Таблица Excel скачана')
    window.setTimeout(() => setNotice(''), 2800)
  }

  const addSource = (event: FormEvent) => {
    event.preventDefault()
    if (!newSourceName.trim() || !newSourceUrl.trim()) return
    const source: Source = { id: Date.now(), name: newSourceName.trim(), platform: newSourcePlatform, url: newSourceUrl.trim().replace(/^https?:\/\//, ''), followers: '—', color: newSourcePlatform === 'VK' ? '#5278d9' : newSourcePlatform === 'OK' ? '#e98a35' : '#7358ce', initials: newSourceName.trim().slice(0, 1).toUpperCase() }
    setSources(current => [...current, source])
    setSelectedIds(current => [...current, source.id])
    setNewSourceName('')
    setNewSourceUrl('')
    setSourceModal(false)
  }

  return (
    <div className="app-shell min-h-screen bg-[#f5f7fa] text-[#202943]">
      <aside className="app-sidebar fixed inset-y-0 left-0 z-20 flex w-[206px] flex-col border-r border-[#e9edf2] bg-white px-3 py-3">
        <div className="brand-card mb-4 flex min-h-[88px] items-center gap-3 rounded-b-[17px] rounded-t-[5px] px-4 py-3 text-white">
          <div className="brand-mark"><Activity size={23} strokeWidth={2.4} /></div>
          <div><div className="font-display text-[13px] font-extrabold leading-[1.15] tracking-[-.25px]">МЕДИАМОНИТОРИНГ<br />СОЦСЕТЕЙ</div><div className="mt-1.5 text-[9px] font-medium text-white/80">Красноярский край</div></div>
        </div>
        <nav className="space-y-1">
          <button onClick={() => setView('monitor')} className={`nav-link ${view === 'monitor' ? 'nav-active' : ''}`}><Search size={17} /> Новый поиск</button>
          <button onClick={() => setView('monitor')} className="nav-link"><Newspaper size={16} /> Результаты</button>
          <button onClick={() => setView('sources')} className={`nav-link ${view === 'sources' ? 'nav-active' : ''}`}><Users size={16} /> Источники</button>
          <button onClick={() => setNotice('Сохранённые запросы появятся после подключения сервера')} className="nav-link"><Bookmark size={16} /> Сохранённые запросы</button>
        </nav>
        <div className="quick-search-note mt-auto rounded-xl p-3.5">
          <div className="mb-2 text-[#e41e3a]"><BarChart3 size={17} fill="currentColor" /></div>
          <div className="text-[10px] font-bold text-[#263657]">Быстрый поиск</div>
          <p className="mt-1 text-[10px] leading-[1.5] text-[#69758b]">Публикаций в соцсетях о событиях и темах, важных для Красноярского края.</p>
        </div>
      </aside>

      <main className="min-h-screen pl-[206px]">
        <header className="app-header sticky top-0 z-10 flex h-[42px] items-center justify-end border-b border-[#e9edf2] bg-white/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button aria-label="Уведомления" className="rounded-full p-2 text-[#394867] hover:bg-[#f4f6f9]"><Bell size={15} /></button><div className="hidden h-6 border-l border-[#edf0f4] sm:block" /><div className="grid size-7 place-items-center rounded-full bg-[#e8ebf1] text-[#707b8f]"><Users size={15} /></div><div className="hidden sm:block"><div className="text-[10px] font-bold leading-tight text-[#293651]">Иван Петров</div><div className="text-[8px] leading-tight text-[#8490a3]">Сотрудник агентства</div></div><ChevronDown size={12} className="text-[#58657b]" /></div>
        </header>

        <div className="app-content mx-auto max-w-[1480px] px-5 pb-10 pt-3 md:px-6">
          {view === 'monitor' ? <div className="monitor-home">
            <div className="page-heading mb-3"><h1 className="font-display text-[24px] font-extrabold tracking-[-.8px] md:text-[26px]">Поиск публикаций</h1><p className="mt-0.5 text-[11px] text-[#75829a] md:text-[12px]">Найдите упоминания, новости и публикации в социальных сетях</p></div>

            <form onSubmit={runSearch} className="search-query-card mb-2.5 rounded-xl border border-[#edf0f4] bg-white px-3.5 py-3 shadow-[0_3px_15px_rgba(39,57,86,.035)]">
              <label htmlFor="query" className="mb-1 block text-[10px] font-bold text-[#283550]">Ваш запрос</label>
              <div className="relative"><input id="query" value={query} onChange={e => setQuery(e.target.value)} placeholder="Введите тему, событие, человека или текст новости" className="query-input w-full rounded-lg border border-[#dce2eb] bg-white py-2.5 pl-2.5 pr-9 text-[11px] text-[#25314a] outline-none focus:border-[#9ba9c2] focus:ring-2 focus:ring-[#eff2f7]" /><button type="button" aria-label="Очистить запрос" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#a7afbd] hover:bg-[#f0f2f6]"><X size={15} /></button></div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] text-[#7b879b]"><span className="mr-1">Например:</span>{['открытие школы', 'губернатор Красноярского края', 'наводнение 2024', 'скопировать текст новости'].map(example => <button type="button" key={example} onClick={() => setQuery(example)} className="rounded-full bg-[#f0f2f6] px-2 py-1 text-[#586781] transition hover:bg-[#e7ebf3]">{example}</button>)}</div>
            </form>

            <form onSubmit={runSearch} className="search-options mb-3 grid items-center gap-2 rounded-xl border border-[#edf0f4] bg-white p-2.5 shadow-[0_3px_15px_rgba(39,57,86,.035)] xl:grid-cols-[1.15fr_1.15fr_1fr_auto_auto]">
              <label className="min-w-0"><span className="mb-1 block px-0.5 text-[9px] font-bold text-[#303c55]">Период публикации</span><span className="flex h-[32px] items-center gap-1.5 rounded-md border border-[#dce2eb] px-2"><input aria-label="Дата начала" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[9px] text-[#4e5c74] outline-none" /><span className="text-[#9da7b7]">—</span><input aria-label="Дата окончания" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[9px] text-[#4e5c74] outline-none" /></span></label>
              <div><div className="mb-1 px-0.5 text-[9px] font-bold text-[#303c55]">Регион</div><button type="button" className="flex h-[32px] w-full items-center gap-2 rounded-md border border-[#dce2eb] px-2 text-[9px] text-[#4e5c74]"><MapPin size={13} /> Красноярский край <ChevronDown size={12} className="ml-auto" /></button></div>
              <div><div className="mb-1 flex items-center gap-1 px-0.5 text-[9px] font-bold text-[#303c55]">Источники <CircleAlert size={10} className="text-[#8d99ad]" /></div><button type="button" onClick={() => { setMode('selected'); setSourceModal(true) }} className="flex h-[32px] w-full items-center gap-2 rounded-md border border-[#dce2eb] px-2 text-[9px] text-[#4e5c74]"><Users size={13} /> Выбрано: {selectedIds.length} <ChevronDown size={12} className="ml-auto" /></button></div>
              <button type="button" onClick={() => setMode(mode === 'selected' ? 'broad' : 'selected')} role="switch" aria-checked={mode === 'selected'} className="flex items-center gap-2 pt-3 text-left text-[8px] leading-[1.25] text-[#728099]"><span className={`toggle-track ${mode === 'selected' ? 'toggle-on' : ''}`}><span /></span>Искать только<br />в выбранных источниках</button>
              <button type="submit" disabled={isSearching || !query.trim()} className="mt-3 flex h-[38px] items-center justify-center gap-2 rounded-lg bg-[#e51d3b] px-3.5 text-[10px] font-bold text-white shadow-[0_4px_12px_rgba(229,29,59,.16)] transition hover:bg-[#cf1834] disabled:opacity-60"><Search size={16} /> Найти публикации</button>
            </form>

            <div className="results-layout grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_168px]">
            <section className="panel monitor-results overflow-hidden">
              <div className="results-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] px-3 py-2.5 md:px-4">
                <div className="flex items-baseline gap-2"><h2 className="font-display text-[13px] font-extrabold tracking-[-.2px] text-[#263552]">Найдено <span className="text-[#e51d3b]">{isSearching ? '…' : visibleResults.length}</span> публикаций</h2><span className="hidden text-[8px] text-[#8590a3] sm:inline">за 2 мин 14 сек · демо</span>{isSearching && <span className="flex items-center gap-1 text-[9px] font-bold text-[#aa782c]"><LoaderCircle size={11} className="animate-spin" /> Идёт поиск</span>}</div>
                <div className="flex items-center gap-2"><label className="hidden items-center gap-1 text-[8px] text-[#7e899d] sm:flex">Сортировка: <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'relevance' | 'newest')} className="rounded-md border border-[#e5e9ef] bg-white px-2 py-1 text-[8px] font-medium text-[#53617b] outline-none"><option value="relevance">По релевантности</option><option value="newest">Сначала новые</option></select></label><button onClick={exportXlsx} disabled={isSearching} className="flex items-center gap-1 rounded-md border border-[#e1e6ed] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#596984] transition hover:bg-[#f3f5f8] disabled:opacity-50"><Download size={12} /> XLSX</button></div>
              </div>
              {notice && <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-[#edf5ed] px-3 py-2 text-[10px] font-medium text-[#47704e]"><Check size={13} />{notice}</div>}
              {isSearching ? <div className="flex min-h-[310px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#edf4ed] text-[#4f7b59]"><LoaderCircle size={23} className="animate-spin" /></div><div className="text-[13px] font-semibold text-[#455349]">Проверяем источники</div><p className="mt-1 max-w-[290px] text-[11px] leading-5 text-[#929c94]">Ищем публикации по смыслу и собираем отдельные размещения</p><div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-[#edf0ec]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#78a481]" /></div></div> : !hasSearched || visibleResults.length === 0 ? <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#f1f3f0] text-[#87938a]"><Search size={20} /></div><div className="text-[13px] font-semibold text-[#47534a]">Подходящих публикаций не найдено</div><p className="mt-1 max-w-[320px] text-[11px] leading-5 text-[#929c94]">Измените запрос, период или выберите другие площадки, затем повторите поиск.</p></div> : <div>
                <div>{visibleResults.map((result, index) => <article key={result.id} className="publication-card group grid gap-2.5 border-b border-[#edf0f4] p-2.5 transition hover:bg-[#fbfcfe] sm:grid-cols-[116px_minmax(0,1fr)]">
                  <div className={`publication-thumb thumb-${index % 5}`} aria-label="Иллюстрация к публикации"><span className={`platform-badge ${result.platform.toLowerCase()}`}>{result.platform === 'OK' ? '✦' : result.platform === 'MAX' ? '●' : 'ᴠκ'}</span>{index === 2 && <span className="thumb-play">▶</span>}</div>
                  <div className="min-w-0 py-0.5"><div className="mb-1 flex items-start justify-between gap-2"><a href={result.url} target="_blank" rel="noreferrer" className="publication-title group-hover:text-[#dd1f3b]">{result.title}</a><a href={result.url} target="_blank" rel="noreferrer" aria-label="Открыть публикацию" className="shrink-0 text-[#8390a6] hover:text-[#e51d3b]"><ExternalLink size={13} /></a></div><p className="line-clamp-2 text-[9px] leading-[1.45] text-[#7e8aa0]">{result.excerpt}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-[#61708a]"><span className="flex items-center gap-1 font-medium"><Users size={10} />{result.source}</span><span className="text-[#b2bac7]">{result.date}</span><span className="rounded-full bg-[#f0f2f6] px-1.5 py-0.5 text-[#68758b]">#Красноярск</span><span className="rounded-full bg-[#f0f2f6] px-1.5 py-0.5 text-[#68758b]">#{index === 2 ? 'тренировка' : 'ледовыйдворец'}</span></div><div className="mt-1.5 flex items-center gap-3 text-[8px] text-[#7e8aa0]"><span className="inline-flex items-center gap-1"><Heart size={11} />{[1200, 980, 756, 540, 432][index]}</span><span className="inline-flex items-center gap-1"><MessageCircle size={11} />{[86, 42, 31, 28, 19][index]}</span><span className="inline-flex items-center gap-1"><Share2 size={11} />{[124, 67, 54, 21, 16][index]}</span><span className={`ml-auto rounded-full px-1.5 py-0.5 font-semibold ${result.kind === 'По теме' ? 'bg-[#fff0f2] text-[#d92b45]' : 'bg-[#f1f3f6] text-[#77839a]'}`}>{result.kind}</span></div></div>
                </article>)}</div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"><div className="text-[9px] text-[#8792a5]">Показано <span className="font-bold text-[#4c5a74]">{visibleResults.length}</span> из <span className="font-bold text-[#4c5a74]">{visibleResults.length}</span> публикаций <span className="ml-1 text-[#b1b8b2]">· демо-данные</span></div><div className="flex items-center gap-1"><button onClick={() => setPage(Math.max(1, page - 1))} aria-label="Предыдущая страница" className="page-button"><ChevronLeft size={13} /></button><button className="page-button page-current">{page}</button><button onClick={() => setPage(page + 1)} aria-label="Следующая страница" className="page-button"><ChevronRight size={13} /></button></div></div>
              </div>}
              <div className="flex items-start gap-2 border-t border-[#edf0f4] bg-[#fcfcfd] px-3 py-2 text-[8px] leading-4 text-[#8b95a6]"><CircleAlert size={12} className="mt-0.5 shrink-0 text-[#9eaa9e]" /><span>Публикации показаны как демонстрационный пример. Живой поиск подключается к серверу и источникам данных.</span></div>
            </section>
            <aside className="filters-sidebar hidden space-y-2 lg:block">
              <section className="rounded-xl border border-[#edf0f4] bg-white p-3 shadow-[0_3px_15px_rgba(39,57,86,.035)]"><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-extrabold text-[#293651]">Источники</h3><button onClick={() => setSourceModal(true)} className="text-[8px] font-medium text-[#e51d3b]">Изменить</button></div>{(['VK', 'OK', 'MAX'] as Platform[]).map(platform => <label key={platform} className="flex cursor-pointer items-center gap-2 py-1 text-[8px] text-[#53617a]"><input type="checkbox" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} className="accent-[#e51d3b]" /><span className={`source-platform-mark ${platform.toLowerCase()}`}>{platform === 'OK' ? '✦' : platform === 'MAX' ? '●' : 'ᴠκ'}</span><span className="truncate">{platform === 'VK' ? 'ВКонтакте' : platform === 'OK' ? 'Одноклассники' : 'MAX'}</span><span className="ml-auto text-[#9aa4b4]">{sources.filter(source => source.platform === platform).length}</span></label>)}<div className="mt-1 border-t border-[#eff1f5] pt-2 text-[8px] text-[#68758c]"><Users size={11} className="mr-1 inline" />Другие источники <span className="float-right text-[#9aa4b4]">0</span></div></section>
              <section className="rounded-xl border border-[#edf0f4] bg-white p-3 shadow-[0_3px_15px_rgba(39,57,86,.035)]"><h3 className="mb-2 text-[10px] font-extrabold text-[#293651]">Тип совпадения</h3>{[['Все публикации', visibleResults.length], ['По теме', results.filter(item => item.kind === 'По теме').length], ['Связано', results.filter(item => item.kind === 'Связано').length]].map(([label, count]) => <label key={label} className="flex cursor-pointer items-center gap-1.5 py-1 text-[8px] text-[#53617a]"><input type="radio" name="result-kind" checked={filter === label} onChange={() => setFilter(String(label))} className="accent-[#e51d3b]" /><span>{label}</span><span className="ml-auto text-[#9aa4b4]">{count}</span></label>)}</section>
              <section className="rounded-xl border border-[#edf0f4] bg-white p-3 shadow-[0_3px_15px_rgba(39,57,86,.035)]"><h3 className="mb-2 text-[10px] font-extrabold text-[#293651]">Ключевые темы</h3>{[['Открытие', 4], ['Ледовый дворец', 5], ['Красноярск', 5], ['Спорт', 3], ['Инфраструктура', 2]].map(([topic, count]) => <button key={topic} onClick={() => setQuery(String(topic))} className="topic-filter flex w-full items-center justify-between border-b border-[#f0f2f6] py-1.5 text-left text-[8px] text-[#53617a] last:border-0 hover:text-[#e51d3b]"><span>{topic}<i /></span><span className="text-[#9aa4b4]">{count}</span></button>)}</section>
            </aside>
            </div>
          </div> : <>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.7px] text-[#8b978d]"><Users size={13} /> Справочник</div><h1 className="font-display text-[27px] font-bold tracking-[-1.15px] md:text-[32px]">Источники публикаций</h1><p className="mt-1.5 text-[12px] text-[#8a948d]">Сообщества и каналы для поиска по выбранному списку</p></div><button onClick={() => setSourceModal(true)} className="flex items-center gap-2 rounded-lg bg-[#204b39] px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-[#173b2d]"><Plus size={15} /> Добавить источник</button></div>
            <div className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4 md:px-6"><div><h2 className="font-display text-[14px] font-bold">Мой список</h2><p className="mt-1 text-[10px] text-[#98a199]">{sources.length} источника · нажмите, чтобы выбрать для поиска</p></div><button onClick={() => setSelectedIds(sources.map(s => s.id))} className="text-[10px] font-semibold text-[#57745e]">Выбрать все</button></div><div>{sources.map(source => <div key={source.id} className="flex flex-wrap items-center gap-3 border-b border-[#f0f2ef] px-5 py-4 last:border-0 md:px-6"><button onClick={() => toggleSource(source.id)} aria-label={`Выбрать ${source.name}`} className={`grid size-[18px] shrink-0 place-items-center rounded border ${selectedIds.includes(source.id) ? 'border-[#527b5b] bg-[#527b5b] text-white' : 'border-[#d7ded7] bg-white text-transparent'}`}><Check size={12} /></button><div style={{ backgroundColor: `${source.color}18`, color: source.color }} className="grid size-9 shrink-0 place-items-center rounded-[11px] text-[12px] font-bold">{source.initials}</div><div className="min-w-[130px] flex-1"><div className="text-[11px] font-semibold text-[#455148]">{source.name}</div><a href={`https://${source.url}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9px] text-[#98a39a] hover:text-[#55765c]">{source.url} <ExternalLink size={9} /></a></div><span className={`rounded px-2 py-1 text-[9px] font-bold ${platformStyle[source.platform]}`}>{source.platform === 'OK' ? 'ОДНОКЛАССНИКИ' : source.platform}</span><span className="hidden w-20 text-right text-[10px] text-[#7d8980] sm:block">{source.followers}</span><span className="flex items-center gap-1.5 text-[9px] font-medium text-[#699371]"><span className="size-1.5 rounded-full bg-[#79a984]" /> Доступен</span><button onClick={() => { setSources(list => list.filter(s => s.id !== source.id)); setSelectedIds(ids => ids.filter(id => id !== source.id)) }} aria-label={`Удалить ${source.name}`} className="ml-1 rounded-md p-2 text-[#b0b8b1] hover:bg-[#fff0ee] hover:text-[#bd6555]"><Trash2 size={14} /></button></div>)}</div><div className="bg-[#fafbf9] px-5 py-3 text-[10px] text-[#929c94] md:px-6">Сохранённые источники остаются в списке для следующих поисков. Добавление и доступность показаны в демо-режиме.</div></div>
          </>}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 text-[9px] text-[#abb3ac]"><span>Медиаслед · Красноярский край</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#83a98a]" /> Демо-версия интерфейса</span></footer>
        </div>
      </main>

      {sourceModal && <div className="fixed inset-0 z-40 grid place-items-center bg-[#18221b]/35 p-4 backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) setSourceModal(false) }}><div className="w-full max-w-[440px] rounded-2xl border border-[#eaeeea] bg-white p-6 shadow-[0_20px_70px_rgba(25,49,32,.18)]"><div className="mb-5 flex items-start justify-between"><div><div className="mb-1 grid size-9 place-items-center rounded-xl bg-[#edf4ed] text-[#587d60]"><Plus size={17} /></div><h3 className="mt-3 font-display text-[17px] font-bold">Новый источник</h3><p className="mt-1 text-[10px] text-[#909a92]">Добавьте публичное сообщество или канал</p></div><button onClick={() => setSourceModal(false)} aria-label="Закрыть" className="rounded-lg p-2 text-[#98a29a] hover:bg-[#f3f5f2]"><X size={16} /></button></div><form onSubmit={addSource} className="space-y-4"><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#58645b]">Название источника</span><input required value={newSourceName} onChange={e => setNewSourceName(e.target.value)} placeholder="Например, Новости района" className="form-input" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#58645b]">Ссылка на сообщество</span><input required value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} placeholder="https://vk.com/community" className="form-input" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#58645b]">Площадка</span><select value={newSourcePlatform} onChange={e => setNewSourcePlatform(e.target.value as Platform)} className="form-input"><option value="VK">ВКонтакте</option><option value="OK">Одноклассники</option><option value="MAX">MAX</option></select></label><div className="flex justify-end gap-2 border-t border-[#eef0ed] pt-4"><button type="button" onClick={() => setSourceModal(false)} className="rounded-lg px-4 py-2.5 text-[10px] font-semibold text-[#7b867e] hover:bg-[#f5f6f4]">Отмена</button><button className="rounded-lg bg-[#204b39] px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-[#173b2d]">Добавить источник</button></div></form></div></div>}
    </div>
  )
}

export default App

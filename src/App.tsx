import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, Clock3, Download, ExternalLink, FileSpreadsheet,
  Filter, Globe2, LayoutDashboard, Link2, ListFilter, LoaderCircle, MapPin, Newspaper,
  Plus, Radio, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, Users, X,
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
  { id: 1, source: 'МВД 24', platform: 'VK', date: '19 окт, 10:42', title: 'В Красноярске проверили безопасность пешеходных переходов возле школ', excerpt: 'Сотрудники Госавтоинспекции провели рейд у образовательных учреждений. Особое внимание уделили освещённости переходов и соблюдению правил водителями…', url: 'https://vk.com/wall-120000_8451', kind: 'По теме', color: '#5278d9', initials: 'М' },
  { id: 2, source: 'Город Красноярск', platform: 'VK', date: '18 окт, 16:18', title: 'На дорогах краевого центра обновили разметку у 12 школ', excerpt: 'Работы провели в рамках подготовки к учебному году. На наиболее оживлённых участках появились дополнительные знаки и обновлённая пешеходная разметка…', url: 'https://vk.com/wall-391123_18204', kind: 'По теме', color: '#36a281', initials: 'Г' },
  { id: 3, source: 'Наш Красноярский край', platform: 'OK', date: '17 окт, 09:06', title: 'Дорожные службы усилили контроль возле образовательных учреждений', excerpt: 'В крае продолжается профилактическая работа по снижению аварийности. Водителям напоминают о необходимости снижать скорость при подъезде к переходам…', url: 'https://ok.ru/group/70000000000001/topic/159001', kind: 'Связано', color: '#e98a35', initials: 'Н' },
  { id: 4, source: 'Краевая администрация', platform: 'MAX', date: '16 окт, 14:30', title: 'В Красноярском крае стартовала неделя дорожной безопасности', excerpt: 'Профилактические мероприятия пройдут в школах и колледжах региона. В программе — встречи с инспекторами, разбор дорожных ситуаций и практические занятия…', url: 'https://max.ru/krskstate/AZabc123', kind: 'По теме', color: '#7358ce', initials: 'К' },
  { id: 5, source: 'МВД 24', platform: 'VK', date: '15 окт, 11:24', title: 'Инспекторы напомнили красноярцам о правилах перевозки детей', excerpt: 'Во время профилактического мероприятия полицейские проверили наличие детских удерживающих устройств и провели беседы с водителями…', url: 'https://vk.com/wall-120000_8410', kind: 'Связано', color: '#5278d9', initials: 'М' },
]

const platformStyle: Record<Platform, string> = { VK: 'bg-[#eaf0ff] text-[#4266b0]', OK: 'bg-[#fff1e3] text-[#bd7026]', MAX: 'bg-[#f0eaff] text-[#7254bd]' }

function App() {
  const [view, setView] = useState<'monitor' | 'sources'>('monitor')
  const [query, setQuery] = useState('Безопасность дорожного движения в Красноярском крае')
  const [periodStart, setPeriodStart] = useState('2026-10-01')
  const [periodEnd, setPeriodEnd] = useState('2026-10-19')
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
  const [page, setPage] = useState(1)

  const visibleResults = useMemo(() => filter === 'Все публикации' ? results : results.filter(r => r.kind === filter), [filter, results])
  const togglePlatform = (p: Platform) => setPlatforms(current => current.includes(p) ? current.filter(x => x !== p) : [...current, p])
  const toggleSource = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])

  const runSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || platforms.length === 0 || (mode === 'selected' && selectedIds.length === 0)) return
    setIsSearching(true)
    setHasSearched(false)
    setNotice('')
    window.setTimeout(() => {
      const queryResults = query.toLocaleLowerCase().includes('школ') || query.toLocaleLowerCase().includes('дорог') || query.toLocaleLowerCase().includes('безопас')
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
    <div className="min-h-screen bg-[#f6f7f5] text-[#202622]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#e9ece8] bg-white px-4 py-5 lg:flex">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-[12px] bg-[#193e32] text-white"><Activity size={19} strokeWidth={2.2} /></div>
          <div><div className="font-display text-[17px] font-extrabold tracking-[-.6px]">медиаслед</div><div className="text-[10px] font-semibold uppercase tracking-[1.35px] text-[#909991]">краевой мониторинг</div></div>
        </div>
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[1.3px] text-[#a0a8a2]">Рабочее пространство</div>
        <button onClick={() => setView('monitor')} className={`nav-link ${view === 'monitor' ? 'nav-active' : ''}`}><LayoutDashboard size={17} /> Мониторинг <span className="ml-auto rounded-md bg-[#e9f1eb] px-1.5 py-0.5 text-[10px] font-bold text-[#527b61]">LIVE</span></button>
        <button onClick={() => setView('sources')} className={`nav-link ${view === 'sources' ? 'nav-active' : ''}`}><Radio size={17} /> Источники <span className="ml-auto text-[11px] text-[#909991]">{sources.length}</span></button>
        <button onClick={() => setNotice('Аналитика появится после подключения серверного API')} className="nav-link"><BarChart3 size={17} /> Аналитика</button>
        <div className="my-6 border-t border-[#edf0ed]" />
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[1.3px] text-[#a0a8a2]">Сейчас отслеживается</div>
        <div className="space-y-1 px-2 py-2">
          {(['VK', 'OK', 'MAX'] as Platform[]).map(p => <div key={p} className="flex items-center gap-2.5 py-2 text-[12px] font-medium text-[#5e6861]"><span className={`platform-dot platform-${p.toLowerCase()}`} />{p === 'OK' ? 'Одноклассники' : p}<span className="ml-auto text-[10px] text-[#9aa29c]">{platforms.includes(p) ? 'Вкл.' : 'Выкл.'}</span></div>)}
        </div>
        <div className="mt-auto rounded-[14px] bg-[#f4f7f4] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#45544a]"><span className="size-1.5 rounded-full bg-[#6ba67b]" /> Демо-режим</div>
          <p className="text-[10px] leading-[1.6] text-[#8a948d]">Поиск показывает пример данных. Подключите API, чтобы получать живые публикации.</p>
        </div>
        <button className="mt-4 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-[#69736c] hover:bg-[#f6f7f5]"><Settings2 size={16} /> Настройки</button>
      </aside>

      <main className="min-h-screen lg:ml-[232px]">
        <header className="sticky top-0 z-10 flex h-[62px] items-center justify-between border-b border-[#e9ece8] bg-[#f9faf8]/95 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-2 text-[11px] text-[#9aa29c]"><span>Рабочее пространство</span><ChevronRight size={13} /><span className="font-semibold text-[#4e5b52]">{view === 'monitor' ? 'Мониторинг' : 'Источники'}</span></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#e7ebe7] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#758078] sm:flex"><span className="size-1.5 rounded-full bg-[#77ab83]" /> Красноярский край</div><div className="grid size-8 place-items-center rounded-full bg-[#e2ede4] text-[11px] font-bold text-[#3c674c]">АП</div></div>
        </header>

        <div className="mx-auto max-w-[1320px] px-5 pb-12 pt-8 md:px-9 md:pt-9">
          {view === 'monitor' ? <>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.7px] text-[#8b978d]"><span className="size-1.5 rounded-full bg-[#5d9c70]" /> Центр мониторинга</div><h1 className="font-display text-[27px] font-bold tracking-[-1.15px] md:text-[32px]">Публикации и события</h1><p className="mt-1.5 text-[12px] text-[#8a948d]">Поиск по смыслу в открытых сообществах региона</p></div>
              <div className="flex items-center gap-2 rounded-lg border border-[#e8ebe7] bg-white px-3 py-2 text-[10px] font-semibold text-[#748078]"><Clock3 size={13} /> Последнее обновление сегодня, 10:42</div>
            </div>

            <form onSubmit={runSearch} className="panel mb-5 overflow-hidden p-5 md:p-6">
              <div className="mb-3 flex items-center justify-between"><label htmlFor="query" className="text-[11px] font-bold text-[#59655d]">Что ищем?</label><span className="flex items-center gap-1 text-[10px] text-[#96a098]"><Sparkles size={12} className="text-[#709c78]" /> Тема, событие, человек или текст новости</span></div>
              <div className="flex gap-2 rounded-[11px] border border-[#dfe6df] bg-[#fcfdfb] p-2 pl-3 transition focus-within:border-[#8eac94] focus-within:ring-3 focus-within:ring-[#e4eee5]">
                <Search className="mt-[9px] shrink-0 text-[#859188]" size={17} /><input id="query" value={query} onChange={e => setQuery(e.target.value)} placeholder="Например, открытие новой школы в Красноярске…" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#354038] outline-none placeholder:text-[#afb7b0]" /><button type="submit" disabled={isSearching || !query.trim()} className="flex shrink-0 items-center gap-2 rounded-[8px] bg-[#204b39] px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#173b2d] disabled:opacity-60">{isSearching ? <><LoaderCircle size={14} className="animate-spin" /> Ищем</> : <>Найти публикации <ArrowRight size={14} /></>}</button>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-4 border-t border-[#eff1ee] pt-4 md:grid-cols-[1fr_1.1fr_1fr]">
                <div><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#77827a]"><Clock3 size={12} /> Период публикации</div><div className="flex items-center gap-2"><input aria-label="Дата начала" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="date-input" /><span className="text-[#b0b7b1]">—</span><input aria-label="Дата окончания" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="date-input" /></div></div>
                <div><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#77827a]"><Globe2 size={12} /> Площадки</div><div className="flex gap-1.5">{(['VK', 'OK', 'MAX'] as Platform[]).map(p => <button type="button" key={p} onClick={() => togglePlatform(p)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition ${platforms.includes(p) ? `${platformStyle[p]} border-transparent` : 'border-[#e8ece8] bg-white text-[#a1aaa2]'}`}>{p === 'OK' ? 'Одноклассники' : p}</button>)}</div></div>
                <div><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#77827a]"><MapPin size={12} /> Регион</div><div className="flex items-center gap-2 text-[11px] font-medium text-[#4e5b52]"><span className="grid size-6 place-items-center rounded-md bg-[#e9f2ea] text-[#4e7859]"><MapPin size={13} /></span> Красноярский край <Check size={13} className="text-[#78a17d]" /></div></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eff1ee] pt-4">
                <div className="flex gap-1 rounded-lg bg-[#f3f5f2] p-1"><button type="button" onClick={() => setMode('selected')} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition ${mode === 'selected' ? 'bg-white text-[#34483a] shadow-sm' : 'text-[#879188]'}`}>По выбранным источникам</button><button type="button" onClick={() => setMode('broad')} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition ${mode === 'broad' ? 'bg-white text-[#34483a] shadow-sm' : 'text-[#879188]'}`}>Широкий поиск</button></div>
                {mode === 'selected' ? <button type="button" onClick={() => setSourceModal(true)} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#55745d] hover:text-[#264c35]"><ListFilter size={13} /> Источники ({selectedIds.length}) <ChevronDown size={12} /></button> : <div className="flex items-center gap-1.5 text-[10px] text-[#89948b]"><Globe2 size={13} /> Поиск за пределами вашего списка</div>}
              </div>
            </form>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="stat-card"><div className="flex items-center justify-between"><span className="stat-label">Найдено публикаций</span><div className="stat-icon bg-[#e8f1e9] text-[#527c5d]"><Newspaper size={16} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-display text-[27px] font-bold tracking-[-1px]">{isSearching ? '…' : hasSearched ? visibleResults.length : results.length}</span><span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[#66a074]"><ArrowUpRight size={12} /> за период</span></div><div className="mt-1 text-[10px] text-[#9aa39c]">Отдельные размещения, без повторов</div></div>
              <div className="stat-card"><div className="flex items-center justify-between"><span className="stat-label">Проверено источников</span><div className="stat-icon bg-[#edf0fa] text-[#6577ad]"><Radio size={16} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-display text-[27px] font-bold tracking-[-1px]">{String(platforms.length).padStart(2, '0')} <span className="text-[15px] font-medium text-[#9ba49d]">/ 03</span></span><span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[#6685a7]"><ArrowUpRight size={12} /> площадки</span></div><div className="mt-1 text-[10px] text-[#9aa39c]">VK · Одноклассники · MAX</div></div>
              <div className="stat-card"><div className="flex items-center justify-between"><span className="stat-label">Время обработки</span><div className="stat-icon bg-[#faf0e4] text-[#bd8a4a]"><Clock3 size={16} /></div></div><div className="mt-3 flex items-end gap-2"><span className="font-display text-[27px] font-bold tracking-[-1px]">{isSearching ? '00:01' : '00:24'}</span><span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[#6c9d75]"><ArrowDownRight size={12} /> демо</span></div><div className="mt-1 text-[10px] text-[#9aa39c]">Примерное время поиска</div></div>
            </div>

            <section className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] px-5 py-4 md:px-6">
                <div><div className="flex items-center gap-2"><h2 className="font-display text-[14px] font-bold tracking-[-.25px]">Результаты поиска</h2>{isSearching ? <span className="flex items-center gap-1.5 rounded-full bg-[#fff4df] px-2 py-1 text-[9px] font-bold text-[#aa782c]"><LoaderCircle size={11} className="animate-spin" /> Идёт поиск</span> : hasSearched && <span className="rounded-full bg-[#edf4ed] px-2 py-1 text-[9px] font-bold text-[#578061]">По смыслу</span>}</div><div className="mt-1 text-[10px] text-[#98a199]">Запрос: «{query || '—'}»</div></div>
                <div className="flex items-center gap-2"><div className="flex items-center gap-1 rounded-lg border border-[#e9ece9] bg-white px-2.5 py-2"><Filter size={12} className="text-[#8c978e]" /><select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }} className="bg-transparent text-[10px] font-medium text-[#657068] outline-none"><option>Все публикации</option><option>По теме</option><option>Связано</option></select></div><button onClick={exportXlsx} disabled={isSearching} className="flex items-center gap-1.5 rounded-lg border border-[#dfe7df] bg-white px-3 py-2 text-[10px] font-semibold text-[#46674e] transition hover:bg-[#f3f8f3] disabled:opacity-50"><Download size={13} /> <span className="hidden sm:inline">Выгрузить</span> XLSX</button></div>
              </div>
              {notice && <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-[#edf5ed] px-3 py-2 text-[10px] font-medium text-[#47704e]"><Check size={13} />{notice}</div>}
              {isSearching ? <div className="flex min-h-[310px] flex-col items-center justify-center px-6 text-center"><div className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#edf4ed] text-[#4f7b59]"><LoaderCircle size={23} className="animate-spin" /></div><div className="text-[13px] font-semibold text-[#455349]">Проверяем источники</div><p className="mt-1 max-w-[290px] text-[11px] leading-5 text-[#929c94]">Ищем публикации по смыслу и собираем отдельные размещения</p><div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-[#edf0ec]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#78a481]" /></div></div> : !hasSearched || visibleResults.length === 0 ? <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#f1f3f0] text-[#87938a]"><Search size={20} /></div><div className="text-[13px] font-semibold text-[#47534a]">Подходящих публикаций не найдено</div><p className="mt-1 max-w-[320px] text-[11px] leading-5 text-[#929c94]">Измените запрос, период или выберите другие площадки, затем повторите поиск.</p></div> : <div>
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_116px_92px] gap-4 border-b border-[#f0f2ef] bg-[#fbfcfa] px-6 py-2.5 text-[9px] font-bold uppercase tracking-[.9px] text-[#9ca59e] md:grid"><div>Публикация</div><div>Источник</div><div>Дата</div><div>Связь</div></div>
                <div>{visibleResults.map(result => <article key={result.id} className="grid gap-3 border-b border-[#f0f2ef] px-5 py-4 transition hover:bg-[#fcfdfb] md:grid-cols-[minmax(0,1fr)_120px_116px_92px] md:items-start md:gap-4 md:px-6">
                  <div className="min-w-0"><div className="mb-1.5 flex items-center gap-2 md:hidden"><span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${platformStyle[result.platform]}`}>{result.platform}</span><span className="text-[10px] font-medium text-[#748078]">{result.source}</span><span className="ml-auto text-[9px] text-[#929c94]">{result.date}</span></div><a href={result.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1.5 text-[11px] font-semibold leading-[1.55] text-[#35443a] hover:text-[#39744b]">{result.title}<ExternalLink size={11} className="mt-[3px] shrink-0 text-[#a0aaa1] opacity-0 transition group-hover:opacity-100" /></a><p className="mt-1.5 line-clamp-2 text-[10px] leading-[1.65] text-[#89938b]">{result.excerpt}</p><a href={result.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-[#87a08b] hover:text-[#4c7953]"><Link2 size={10} /> Открыть публикацию <ArrowRight size={9} /></a></div>
                  <div className="hidden items-center gap-2 md:flex"><div style={{ backgroundColor: `${result.color}18`, color: result.color }} className="grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold">{result.initials}</div><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-[#59655d]">{result.source}</div><div className="mt-0.5 text-[9px] text-[#a1aaa3]">{result.platform === 'OK' ? 'Одноклассники' : result.platform}</div></div></div>
                  <div className="hidden items-center gap-1.5 pt-1 text-[10px] text-[#79847c] md:flex"><Clock3 size={11} className="text-[#a3aca4]" />{result.date}</div>
                  <div className="hidden pt-0.5 md:block"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${result.kind === 'По теме' ? 'bg-[#edf4ed] text-[#608269]' : 'bg-[#f2f0e9] text-[#94835a]'}`}>{result.kind}</span></div>
                </article>)}</div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-6"><div className="text-[10px] text-[#919b93]">Показано <span className="font-semibold text-[#556259]">{visibleResults.length}</span> из <span className="font-semibold text-[#556259]">{visibleResults.length}</span> публикаций <span className="ml-1 text-[#b1b8b2]">· демо-данные</span></div><div className="flex items-center gap-1"><button onClick={() => setPage(Math.max(1, page - 1))} aria-label="Предыдущая страница" className="page-button"><ChevronLeft size={14} /></button><button className="page-button page-current">{page}</button><button onClick={() => setPage(page + 1)} aria-label="Следующая страница" className="page-button"><ChevronRight size={14} /></button></div></div>
              </div>}
            </section>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e9ede8] bg-white/65 px-4 py-3 text-[10px] leading-5 text-[#8f9991]"><CircleAlert size={13} className="mt-0.5 shrink-0 text-[#9eaa9e]" /><span>Показанные публикации — демонстрационные примеры интерфейса. Реальный поиск, охват площадок и доступность ссылок появятся после подключения сервера и источников данных.</span></div>
          </> : <>
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

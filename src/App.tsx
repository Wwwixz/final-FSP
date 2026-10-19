import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell,
  Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  CircleHelp, Download, ExternalLink, Heart, MapPin, MessageCircle,
  MoreHorizontal, Newspaper, Plus, Search, Settings, Share2, Star, TrendingUp, Users, X,
} from 'lucide-react'

type Page = 'search' | 'results' | 'publication' | 'sources' | 'saved' | 'analytics' | 'settings'
type Platform = 'VK' | 'OK' | 'MAX'
type Source = { id: number; name: string; platform: Platform; url: string; followers: string; region: string; active: boolean; color: string }
type SavedQuery = { id: number; name: string; query: string; period: string; region: string; favorite: boolean }
type Publication = { id: number; source: string; platform: Platform; date: string; title: string; excerpt: string; url: string; kind: string; color: string; image: string }

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
const repositoryResults: Publication[] = [
  { id: 1, source: 'МВД 24', platform: 'VK', date: '12 мар 2024, 14:27', title: 'В Красноярске открылся новый ледовый дворец', excerpt: 'Сегодня состоялось долгожданное открытие ледового дворца на левом берегу. Это современный комплекс с двумя аренами, зоной для зрителей и комфортной инфраструктурой…', url: 'https://vk.com/wall-120000_8451', kind: 'По теме', color: '#5278d9', image: '/images/arena-exterior.jpg' },
  { id: 2, source: 'Наш Красноярский край', platform: 'OK', date: '13 мар 2024, 10:05', title: 'Фоторепортаж: как выглядит новый ледовый дворец изнутри', excerpt: 'Показываем, как устроен новый ледовый дворец в Красноярске. Просторные раздевалки, современный тренировочный лёд и две игровые арены…', url: 'https://ok.ru/group/70000000000001/topic/159001', kind: 'По теме', color: '#e98a35', image: '/images/arena-interior.jpg' },
  { id: 3, source: 'МВД 24', platform: 'VK', date: '14 мар 2024, 18:40', title: 'Первые тренировки в новом ледовом дворце', excerpt: 'Юные хоккеисты уже оценили новую арену. Тренеры отмечают отличное качество льда и удобные раздевалки.', url: 'https://vk.com/wall-391123_18204', kind: 'По теме', color: '#5278d9', image: '/images/hockey-training.jpg' },
  { id: 4, source: 'Краевая администрация', platform: 'MAX', date: '14 мар 2024, 16:12', title: 'Губернатор о значении нового ледового дворца для края', excerpt: 'Новый ледовый дворец — это важный шаг в развитии спортивной инфраструктуры региона. Здесь будут проходить соревнования краевого уровня…', url: 'https://max.ru/krskstate/AZabc123', kind: 'Связано', color: '#7358ce', image: '/images/arena-evening.jpg' },
  { id: 5, source: 'Город Красноярск', platform: 'VK', date: '15 мар 2024, 09:30', title: 'Красноярцы делятся впечатлениями от открытия', excerpt: 'Горожане активно обсуждают новый ледовый дворец в социальных сетях. Собрали первые отзывы посетителей комплекса.', url: 'https://vk.com/wall-120000_8410', kind: 'Связано', color: '#36a281', image: '/images/arena-ceremony.jpg' },
]
const platformLabel: Record<Platform, string> = { VK: 'VK', OK: 'Одноклассники', MAX: 'MAX' }
const exampleTopics = ['ледовый дворец Красноярск', 'губернатор края', 'наводнение 2024', 'развитие спорта']

function App() {
  const [page, setPage] = useState<Page>('search')
  const [query, setQuery] = useState('')
  const [periodStart, setPeriodStart] = useState('2024-03-01')
  const [periodEnd, setPeriodEnd] = useState('2024-03-31')
  const [region, setRegion] = useState('Красноярский край')
  const [platforms, setPlatforms] = useState<Platform[]>(['VK', 'OK', 'MAX'])
  const [sources, setSources] = useState(initialSources)
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

  const togglePlatform = (platform: Platform) => setPlatforms(current => current.includes(platform) ? current.filter(value => value !== platform) : [...current, platform])
  const runSearch = (event: FormEvent) => { event.preventDefault(); setNotice(''); setPage('results') }
  const openSaved = (item: SavedQuery) => { setQuery(item.query); setRegion(item.region); setPage('search'); setNotice('Запрос загружен. Нажмите «Найти», чтобы обновить результаты.') }
  const openSourceDialog = (source?: Source) => { setSourceEdit(source?.id ?? null); setSourceName(source?.name ?? ''); setSourceUrl(source?.url ?? ''); setSourcePlatform(source?.platform ?? 'VK'); setSourceModal(true) }
  const submitSource = (event: FormEvent) => {
    event.preventDefault()
    if (!sourceName.trim() || !sourceUrl.trim()) return
    if (sourceEdit !== null) setSources(current => current.map(item => item.id === sourceEdit ? { ...item, name: sourceName.trim(), url: sourceUrl.trim(), platform: sourcePlatform } : item))
    else setSources(current => [{ id: Date.now(), name: sourceName.trim(), url: sourceUrl.trim(), platform: sourcePlatform, followers: '—', region, active: true, color: sourcePlatform === 'VK' ? '#5278d9' : sourcePlatform === 'OK' ? '#e98a35' : '#7358ce' }, ...current])
    setSourceModal(false); setNotice(sourceEdit === null ? 'Источник добавлен.' : 'Источник обновлён.')
  }
  const toggleSource = (id: number) => setSources(current => current.map(item => item.id === id ? { ...item, active: !item.active } : item))
  const removeSaved = (id: number) => setSaved(current => current.filter(item => item.id !== id))
  const exportResults = async () => {
    const XLSX = await import('xlsx')
    const rows = repositoryResults.map((item, index) => ({ '№': index + 1, 'Площадка': item.platform, 'Источник': item.source, 'Заголовок': item.title, 'Дата': item.date, 'Ссылка': item.url }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Публикации')
    XLSX.writeFile(book, 'media-monitoring-results.xlsx')
  }

  return <div className="app-shell">
    <aside className="app-sidebar">
      <div className="brand-card"><div className="brand-mark brand-flame" aria-hidden="true"><i/><i/><i/></div><div><b>МЕДИАМОНИТОРИНГ<br/>СОЦСЕТЕЙ</b><span>Красноярский край</span></div></div>
      <nav className="sidebar-nav">
        <NavItem active={page === 'search'} icon={<Search size={18}/>} onClick={() => setPage('search')}>Поиск публикаций</NavItem>
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
      <div className={`page-content ${page === 'search' ? 'page-content--flush' : ''}`}>
        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Закрыть"><X size={15}/></button></div>}
        {page === 'search' && <SearchPage query={query} setQuery={setQuery} periodStart={periodStart} setPeriodStart={setPeriodStart} periodEnd={periodEnd} setPeriodEnd={setPeriodEnd} region={region} setRegion={setRegion} platforms={platforms} togglePlatform={togglePlatform} onSubmit={runSearch}/>} 
        {page === 'results' && <ResultsPage results={repositoryResults} query={query || 'Открытие нового ледового дворца в Красноярске'} periodStart={periodStart} periodEnd={periodEnd} onExport={exportResults} onSearch={() => setPage('search')} onOpen={item => { setSelectedPublication(item); setPage('publication') }}/>} 
        {page === 'publication' && selectedPublication && <PublicationPage item={selectedPublication} onBack={() => setPage('results')}/>} 
        {page === 'sources' && <SourcesPage sources={sources} onAdd={() => openSourceDialog()} onEdit={openSourceDialog} onToggle={toggleSource} onDelete={id => setSources(current => current.filter(item => item.id !== id))}/>}
        {page === 'saved' && <SavedPage items={saved} onOpen={openSaved} onRemove={removeSaved} onNew={() => setPage('search')} onFavorite={id => setSaved(current => current.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item))}/>} 
        {page === 'analytics' && <AnalyticsPage/>}
        {page === 'settings' && <SettingsPage tab={settingsTab} setTab={setSettingsTab} region={region} setRegion={setRegion} onSave={() => { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }} saved={settingsSaved}/>}
      </div>
    </main>
    {sourceModal && <div className="modal-backdrop" onClick={() => setSourceModal(false)}><form className="source-modal" onClick={event => event.stopPropagation()} onSubmit={submitSource}><div className="modal-heading"><div><h2>{sourceEdit === null ? 'Добавить источник' : 'Редактировать источник'}</h2><p>Укажите страницу или сообщество для мониторинга</p></div><button type="button" className="icon-button" onClick={() => setSourceModal(false)}><X size={18}/></button></div><label>Название<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Например, Новости города"/></label><label>Ссылка<input required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="vk.com/community"/></label><label>Площадка<select value={sourcePlatform} onChange={event => setSourcePlatform(event.target.value as Platform)}><option>VK</option><option>OK</option><option>MAX</option></select></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setSourceModal(false)}>Отмена</button><button className="button-primary"><Check size={16}/>Сохранить</button></div></form></div>}
  </div>
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

function SearchPage({ query, setQuery, periodStart, setPeriodStart, periodEnd, setPeriodEnd, region, setRegion, platforms, togglePlatform, onSubmit }: { query: string; setQuery: (v: string) => void; periodStart: string; setPeriodStart: (v: string) => void; periodEnd: string; setPeriodEnd: (v: string) => void; region: string; setRegion: (v: string) => void; platforms: Platform[]; togglePlatform: (p: Platform) => void; onSubmit: (e: FormEvent) => void }) {
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [officialOnly, setOfficialOnly] = useState(false)
  const [withMedia, setWithMedia] = useState(false)
  const [excludeReposts, setExcludeReposts] = useState(false)
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
                <option>Красноярский край</option><option>Красноярск</option><option>Ачинск</option><option>Норильск</option>
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

function ResultsPage({ results, query, periodStart, periodEnd, onExport, onSearch, onOpen }: { results: Publication[]; query: string; periodStart: string; periodEnd: string; onExport: () => void; onSearch: () => void; onOpen: (item: Publication) => void }) {
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
    <div className="design-page-heading"><div><button onClick={onSearch} className="back-link"><ArrowLeft size={13}/>К поиску</button><h1>Результаты поиска</h1><p>Запрос: «{query}»</p></div><div className="heading-actions"><button onClick={() => setSavedResult(!savedResult)} className={`soft-action ${savedResult ? 'soft-action-saved' : ''}`}><Bookmark size={14}/>{savedResult ? 'Запрос сохранён' : 'Сохранить запрос'}</button><button onClick={onExport} className="primary-action"><Download size={14}/>Выгрузить в Excel</button></div></div>
    <div className="results-summary-bar"><div className="summary-filter"><CalendarDays size={15}/><span>{prettyDate(periodStart)} — {prettyDate(periodEnd)}</span></div><div className="summary-filter"><MapPin size={15}/><span>Красноярский край</span><ChevronDown size={13}/></div><button onClick={onSearch} className="summary-edit">Изменить параметры <ArrowRight size={12}/></button></div>
    <section className="design-card results-design-card"><div className="design-card-heading"><div><h2>Найдено <strong>{results.length}</strong> публикаций</h2><p>Показываем отдельные размещения с прямыми ссылками на источник</p></div><label className="sort-control">Сортировка<select value={sort} onChange={event => setSort(event.target.value as 'relevance' | 'newest')}><option value="relevance">По релевантности</option><option value="newest">Сначала новые</option></select><ChevronDown size={12}/></label></div>
      <div className="result-rows">{pageItems.map(item => <article key={item.id} className="result-row"><input aria-label={`Выбрать публикацию: ${item.title}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)}/><button type="button" onClick={() => onOpen(item)} className="result-photo publication-thumb has-image"><img className="media-photo" src={item.image} alt=""/><span className={`platform-badge ${item.platform.toLowerCase()}`}>{item.platform === 'OK' ? '✦' : item.platform === 'MAX' ? '●' : 'ᴠκ'}</span></button><div className="result-copy"><div className="result-title-line"><button type="button" onClick={() => onOpen(item)} className="result-title">{item.title}</button><a href={item.url} target="_blank" rel="noreferrer" className="original-link" title="Открыть оригинал"><ExternalLink size={15}/></a></div><p>{item.excerpt}</p><div className="result-metadata"><span><Users size={12}/>{item.source}</span><span>{item.date}</span><span className="result-topic">#Красноярск</span><span className="result-topic">#ледовыйдворец</span></div><div className="result-engagement"><span><Heart size={13}/>{[1200,980,756,540,432][item.id-1]}</span><span><MessageCircle size={13}/>{[86,42,31,28,19][item.id-1]}</span><span><Share2 size={13}/>{[124,67,54,21,16][item.id-1]}</span><span className={`match-label ${item.kind === 'По теме' ? 'match-direct' : ''}`}>{item.kind}</span></div></div></article>)}</div>
      <div className="results-pagination"><span>Показано <b>{pageItems.length}</b> из <b>{results.length}</b> публикаций <i>· демонстрационная выборка</i></span><div><button onClick={() => setResultPage(current => Math.max(1,current-1))} disabled={resultPage <= 1}><ChevronLeft size={15}/></button><button className="pagination-current">{resultPage}</button><button onClick={() => setResultPage(current => Math.min(pages,current+1))} disabled={resultPage >= pages}><ChevronRight size={15}/></button></div></div>
    </section>
  </div>
}

function PublicationPage({ item, onBack }: { item: Publication; onBack: () => void }) {
  const [liked, setLiked] = useState(false)
  const likes = [1200, 980, 756, 540, 432][item.id - 1] ?? 0
  const comments = [86, 42, 31, 28, 19][item.id - 1] ?? 0
  const shares = [124, 67, 54, 21, 16][item.id - 1] ?? 0

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
          <p>Материал найден системой медиамониторинга по выбранной теме. В публикации рассказывается о событии, его участниках и значении для жителей Красноярского края.</p>
          <div className="publication-tags"><span>#Красноярск</span><span>#ледовыйдворец</span><span>#спорт</span></div>
        </div>
        <footer className="publication-actions">
          <button type="button" className={liked ? 'liked' : ''} onClick={() => setLiked(!liked)}><Heart size={16} fill={liked ? 'currentColor' : 'none'}/>{likes + (liked ? 1 : 0)}</button>
          <span><MessageCircle size={16}/>{comments}</span><span><Share2 size={16}/>{shares}</span>
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
      <div>{sources.map(source => <div key={source.id} className="repository-source-row"><button onClick={() => onToggle(source.id)} aria-label={`Выбрать ${source.name}`} className={`repository-check ${source.active ? 'checked' : ''}`}><Check size={12}/></button><button onClick={() => onEdit(source)} style={{backgroundColor:`${source.color}18`,color:source.color}} className="repository-source-avatar">{source.name.slice(0,1)}</button><div className="repository-source-copy"><button onClick={() => onEdit(source)}>{source.name}</button><a href={`https://${source.url}`} target="_blank" rel="noreferrer">{source.url}<ExternalLink size={9}/></a></div><span className={`repository-platform ${source.platform.toLowerCase()}`}>{source.platform === 'OK' ? 'ОДНОКЛАССНИКИ' : source.platform}</span><span className="repository-followers">{source.followers}</span><span className={`repository-status ${source.active ? '' : 'offline'}`}><i/>{source.active ? 'Доступен' : 'Отключён'}</span><button onClick={() => onDelete(source.id)} className="repository-delete" aria-label={`Удалить ${source.name}`}>×</button></div>)}</div>
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

function SettingsPage({ tab, setTab, region, setRegion, onSave, saved }: { tab: string; setTab: (v: string) => void; region: string; setRegion: (v: string) => void; onSave: () => void; saved: boolean }) {
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
      {tab === 'Интерфейс' && <div className="settings-form"><div className="settings-row"><strong>Интерфейс</strong><div className="settings-option settings-fields"><label>Плотность таблиц<select><option>Стандартная</option><option>Компактная</option><option>Свободная</option></select></label><label>Язык интерфейса<select><option>Русский</option><option>English</option></select></label></div></div></div>}
    </div>
    <footer className="settings-footer"><button className="button-primary" onClick={onSave}>{saved ? <><Check size={15}/>Сохранено</> : 'Сохранить изменения'}</button></footer>
  </section>
}

export default App

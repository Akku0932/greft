import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getImage, pickImage, parseIdTitle, sanitizeTitleId } from '../lib/api.js'
import { useLibrary } from '../hooks/useLibrary'

export default function Info() {
  const { id, titleId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [page, setPage] = useState(0)
  const [showMeta, setShowMeta] = useState(false)

  // Determine source based on query or ID format (support mp)
  const srcParam = (searchParams.get('src') || '').toLowerCase()
  const isMP = srcParam === 'mp'
  const isMF = !isMP && id && id.includes('.') && !id.includes('/')
  const source = isMP ? 'mp' : (isMF ? 'mf' : 'gf')
  const { user, add, remove, isSaved, items, setStatus } = useLibrary()
  const [statusValue, setStatusValue] = useState('planning')

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const parsed = parseIdTitle(id, '')
        
        // For MP, only fetch info first for instant loading
        if (source === 'mp') {
          const infoData = await api.info(parsed.id, parsed.titleId, source)
          if (mounted) {
            setData(infoData)
            setLoading(false)
          }
          
          // Fetch recommendations in background after info loads
          if (mounted) {
            try {
              const recData = await api.recommendations(parsed.id, source)
              if (mounted && recData && (recData.items || Array.isArray(recData))) {
                setData(prev => ({
                  ...prev,
                  recommendations: Array.isArray(recData) ? recData : recData.items || []
                }))
              }
            } catch {}
          }
        } else {
          // For GF/MF, fetch both in parallel as before
          const [infoRes, recRes] = await Promise.allSettled([
            api.info(parsed.id, parsed.titleId, source),
            api.recommendations(parsed.id, source).catch(() => ({ items: [] }))
          ])
          
          if (mounted) {
            const infoData = infoRes.status === 'fulfilled' ? infoRes.value : null
            const recData = recRes.status === 'fulfilled' ? recRes.value : null
            
            if (infoData) {
              if (recData && (recData.items || Array.isArray(recData))) {
                infoData.recommendations = Array.isArray(recData) ? recData : recData.items || []
              }
              setData(infoData)
            }
            setLoading(false)
          }
        }
      } catch (e) { if (mounted) setError(e) } finally { if (mounted) setLoading(false) }
    }
    run();
    return () => { mounted = false }
  }, [id, titleId, source])

  // Sync local statusValue with saved item if present
  useEffect(() => {
    const parsed = parseIdTitle(id, titleId)
    const row = items.find(it => it.series_id === parsed.id && it.source === source)
    if (row && row.status && row.status !== statusValue) setStatusValue(row.status)
  }, [items, id, titleId, source])

  // no-op

  if (loading) return <div className="max-w-[95vw] mx-auto px-4 sm:px-6 py-10 text-stone-800 dark:text-gray-200">Loading…</div>
  if (error) return <div className="max-w-[95vw] mx-auto px-4 sm:px-6 py-10 text-red-600 dark:text-red-400">{String(error)}</div>
  if (!data) return null

  // Map data based on source
  const mappedData = source === 'mf' ? {
    title: data?.name || data?.title,
    description: data?.description,
    img: data?.img,
    status: data?.status,
    type: data?.type,
    author: data?.author || [],
    published: data?.published,
    genres: data?.genres || [],
    otherName: data?.otherName,
    mangazines: data?.mangazines
  } : source === 'mp' ? {
    title: data?.title || data?.name,
    description: data?.description,
    img: data?.img || data?.urlCover600 || data?.urlCoverOri,
    status: data?.mParkUploadStatus || data?.originalPulication,
    type: undefined,
    author: Array.isArray(data?.search) ? data.search : [],
    published: undefined,
    genres: Array.isArray(data?.genres) ? data.genres.map(g => String(g).replace(/,$/, '')) : [],
    otherName: Array.isArray(data?.otherInfo) ? data.otherInfo.join(', ') : undefined,
    mangazines: undefined
  } : {
    title: data?.title || data?.name,
    description: data?.description,
    img: data?.img,
    status: data?.otherInfo?.status,
    type: data?.otherInfo?.type,
    author: (data?.otherInfo?.authors || []).map(a => a.author).filter(Boolean),
    published: data?.otherInfo?.released,
    genres: data?.otherInfo?.tags || [],
    otherName: data?.otherName,
    mangazines: data?.mangazines
  }

  const cover = getImage(pickImage(data) || mappedData.img)
  const bg = cover
  const authors = mappedData.author
  const tags = mappedData.genres
  const meta = {
    Type: mappedData.type,
    Status: mappedData.status,
    Year: mappedData.published,
    Adult: source === 'gf' ? data?.otherInfo?.adultContent : undefined,
  }

  async function onReadFirst() {
    try {
      const parsedSeries = parseIdTitle(id, titleId)
      const series = parsedSeries.id
      const res = await api.chapters(series, source)
      const list = Array.isArray(res) ? res : (res.items || [])
      if (!list.length) return
      const first = list[list.length - 1] || list[0]
      const chapterId = first.id || first.slug || first.urlId
      if (chapterId) {
        const base = source === 'mf' 
          ? `/read/chapter/${chapterId}`
          : `/read/${encodeURIComponent(chapterId)}`
        const extra = source === 'mp' ? `&src=mp` : (source === 'mf' ? `&src=mf` : '')
        const url = `${base}?series=${encodeURIComponent(series)}&title=${encodeURIComponent(parsedSeries.titleId)}${extra}`
        navigate(url)
      }
    } catch {}
  }

  async function onReadLatest() {
    try {
      const parsedSeries = parseIdTitle(id, titleId)
      const res = await api.chapters(parsedSeries.id, source)
      const list = Array.isArray(res) ? res : (res.items || [])
      if (!list.length) return
      const latest = list[0] || list[list.length - 1]
      const chapterId = latest.id || latest.slug || latest.urlId
      if (chapterId) {
        const base = source === 'mf' 
          ? `/read/chapter/${chapterId}`
          : `/read/${encodeURIComponent(chapterId)}`
        const extra = source === 'mp' ? `&src=mp` : (source === 'mf' ? `&src=mf` : '')
        const url = `${base}?series=${encodeURIComponent(parsedSeries.id)}&title=${encodeURIComponent(parsedSeries.titleId)}${extra}`
        navigate(url)
      }
    } catch {}
  }

  return (
    <div>
      <section className="relative">
        {bg && <img src={bg} alt="bg" className="absolute inset-0 w-full h-[260px] sm:h-[320px] md:h-[480px] object-cover" />}
        <div className="absolute inset-0 h-[260px] sm:h-[320px] md:h-[480px] backdrop-blur-sm md:backdrop-blur" />
        <div className="absolute inset-0 h-[260px] sm:h-[320px] md:h-[480px] bg-gradient-to-b from-black/20 via-black/60 to-black/95" />
        <div className="absolute inset-0 h-[260px] sm:h-[320px] md:h-[480px] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_55%,rgba(0,0,0,0.45)_100%)]" />
        <div className="absolute inset-0 h-[260px] sm:h-[320px] md:h-[480px] bg-gradient-to-r from-black/10 via-transparent to-black/10" />
        <div className="relative max-w-[95vw] mx-auto px-4 sm:px-6 pt-6 md:pt-10 pb-24 md:pb-40">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-4 sm:gap-6 md:gap-10 items-start">
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden ring-1 ring-white/15 dark:ring-gray-700/40 shadow-soft dark:shadow-soft-dark bg-white/5 dark:bg-gray-800/20">
              {cover && <img src={cover} alt={mappedData.title} className="w-full h-[240px] sm:h-[300px] object-cover md:h-[360px]" />}
            </div>
            <div className="text-white">
              <div className="md:bg-transparent md:p-0 bg-black/35 backdrop-blur-sm rounded-xl p-3 -mx-2 sm:mx-0">
                <h1 className="text-xl sm:text-3xl md:text-5xl font-extrabold leading-tight">{mappedData.title}</h1>
              {source === 'mf' && mappedData.otherName && (
                <p className="mt-2 text-white/80 text-sm md:text-base italic">{mappedData.otherName}</p>
              )}
              {!!authors.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {authors.slice(0, 12).map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-white/15 ring-1 ring-white/20">{a}</span>
                  ))}
                </div>
              )}
                <div className="mt-2 md:mt-4 flex flex-wrap gap-2">
                  {tags.slice(0, 12).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-white/15">{t}</span>
                  ))}
                </div>
                <p className="mt-2 md:mt-4 max-w-2xl md:max-w-3xl text-white/90 md:text-base text-[13px] sm:text-sm leading-relaxed break-words">{mappedData.description || data.summary}</p>
                <div className="mt-4 md:mt-6 flex flex-wrap gap-2 md:gap-3 items-center">
                  <button onClick={onReadFirst} className="px-3 md:px-5 py-2.5 md:py-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors">Read First</button>
                  {/* Save button - only enabled when logged in */}
                  <button
                  onClick={async () => {
                    const parsed = parseIdTitle(id, titleId)
                    const payload = { seriesId: parsed.id, source, title: mappedData.title, cover, status: 'planning' }
                    try {
                      if (!user) { window.location.href = '/login'; return }
                      if (isSaved(parsed.id, source)) { window.location.href = '/saved'; return }
                      await add(payload)
                    } catch {}
                  }}
                  className="px-3 md:px-5 py-2.5 md:py-3 rounded-lg border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  {isSaved(parseIdTitle(id, titleId).id, source) ? 'In My List' : 'Add to List'}
                </button>
                {user && isSaved(parseIdTitle(id, titleId).id, source) && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/80">Status</label>
                    <select
                      onChange={async (e) => {
                        const next = e.target.value
                        setStatusValue(next)
                        const parsed = parseIdTitle(id, titleId)
                        try { await setStatus({ seriesId: parsed.id, source, status: next }) } catch {}
                      }}
                      value={statusValue}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-white/20 text-stone-900 dark:text-gray-100 shadow-sm"
                    >
                      <option className="text-stone-900 dark:text-gray-100" value="planning">Planning</option>
                      <option className="text-stone-900 dark:text-gray-100" value="reading">Reading</option>
                      <option className="text-stone-900 dark:text-gray-100" value="completed">Completed</option>
                      <option className="text-stone-900 dark:text-gray-100" value="dropped">Dropped</option>
                      <option className="text-stone-900 dark:text-gray-100" value="on_hold">On hold</option>
                    </select>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[95vw] mx-auto px-4 sm:px-6 -mt-10 md:-mt-20 lg:-mt-24 relative">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(360px,520px)_1fr] gap-6 lg:gap-8 items-start">
          <div className="rounded-2xl border border-stone-200 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/60 shadow-soft dark:shadow-soft-dark p-6 md:p-8">
            <button
              onClick={()=>setShowMeta(v=>!v)}
              aria-expanded={showMeta}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 px-4 py-3 text-left"
            >
              <span className="text-base font-semibold text-stone-900 dark:text-white">Metadata</span>
              <svg className={`h-5 w-5 text-stone-500 dark:text-gray-400 transition-transform ${showMeta ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
            </button>
            {showMeta && (() => {
              const other = data?.otherInfo || {}
              const boolText = (val) => {
                const s = String(val ?? '').toLowerCase()
                return s === 'true' || s === 'yes' || s === '1'
              }
              
              // Build entries based on source
              const baseEntries = [
                { label: 'Type', value: mappedData.type },
                { label: 'Status', value: mappedData.status },
                { label: 'Published', value: mappedData.published },
                { label: 'Authors', value: authors.join(', ') },
                { label: 'Genres', value: (tags || []).join(', ') },
              ]
              
              // Add MF-specific fields
              const mfEntries = source === 'mf' ? [
                { label: 'Magazine', value: mappedData.mangazines },
                { label: 'Manga ID', value: data?.syncData?.manga_id },
                { label: 'MAL ID', value: data?.syncData?.mal_id },
                { label: 'AniList ID', value: data?.syncData?.anilist_id },
              ] : []
              
              // Add GF-specific fields
              const gfEntries = source === 'gf' ? [
                { label: 'Adult Content', value: other.adultContent, isBool: true },
                { label: 'Official Translations', value: other.officialTranslations, isBool: true },
                { label: 'Anime Adaptations', value: other.animeAdaptations, isBool: true },
                { label: 'AniList ID', value: data?.anilistId },
                { label: 'Track Count', value: Array.isArray(other.track) ? other.track.length : (other.track ? 1 : 0) },
              ] : []
              
              const entries = [...baseEntries, ...mfEntries, ...gfEntries].filter(item => item.value !== undefined && item.value !== null && item.value !== '')
              return (
                <>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-white/20 dark:ring-gray-700/60 flex items-center justify-center text-blue-500 dark:text-blue-300">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-stone-500 dark:text-gray-400">Overview</div>
                      <div className="text-lg font-bold text-stone-900 dark:text-white">Series Details</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                    {entries.map((item) => (
                      <div key={item.label} className="rounded-xl backdrop-blur-sm bg-white/70 dark:bg-gray-800/50 ring-1 ring-stone-200 dark:ring-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs uppercase tracking-wide text-stone-500 dark:text-gray-400">{item.label}</div>
                      <div className="mt-2">
                        {item.isBool ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${boolText(item.value) ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-600'}`}>
                            {boolText(item.value) ? 'Yes' : 'No'}
                          </span>
                        ) : (item.label === 'Authors' || item.label === 'Tags') && item.value ? (
                          <div className="flex flex-wrap gap-2">
                            {String(item.value)
                              .split(',')
                              .map(v => v.trim())
                              .filter(Boolean)
                              .slice(0, 16)
                              .map(v => (
                                <span key={v} className="px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-700 dark:bg-gray-700/60 dark:text-gray-200">
                                  {v}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-stone-900 dark:text-gray-100 break-words">{String(item.value ?? '—')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
             )})()}
          </div>
          <div className="rounded-2xl border border-stone-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 p-3 md:p-4">
            <ChaptersInline seriesId={parseIdTitle(id, '').id} titleId={parseIdTitle(id, '').titleId} source={source} />
          </div>
        </div>
      </section>

      {!!(data.recommendations && data.recommendations.length) && (
        <section className="max-w-[95vw] mx-auto px-4 sm:px-6 py-8">
          <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {data.recommendations.map((rec) => {
              const parsedRec = parseIdTitle(rec.id, rec.title)
              // Use same URL format logic as Home page
              const href = `/info/${encodeURIComponent(parsedRec.id)}${source==='mp' ? '?src=mp' : ''}`
              return (
                <Link key={rec.id} to={href} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-stone-200 dark:bg-gray-700 shadow-soft dark:shadow-soft-dark">
                    <img src={getImage(rec.img || (rec.imgs && rec.imgs[0]))} alt={rec.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="mt-2 text-sm font-medium line-clamp-2 text-stone-900 dark:text-white group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg,#60a5fa,#a78bfa)' }}>{rec.title}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function ChaptersInline({ seriesId, titleId, source }) {
  const [list, setList] = useState([])
  const [page, setPage] = useState(0)
  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const res = await api.chapters(seriesId, source)
        const arr = Array.isArray(res) ? res : (res.items || [])
        if (mounted) setList(arr)
      } catch {}
    }
    run()
    return () => { mounted = false }
  }, [seriesId, source])
  const pageSize = 25
  const totalCount = list?.length || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = page * pageSize
  const items = (list || []).slice(start, start + pageSize)
  function extractChapterNumber(ch) {
    const candidates = [ch?.chap, ch?.chapter, ch?.title, ch?.name, ch?.no, ch?.number, ch?.index, ch?.chapVol, ch?.chapVol?.chap, ch?.dataNumber]
    for (const c of candidates) {
      if (c == null) continue
      const m = String(c).match(/(\d+(?:\.\d+)?)/)
      if (m) return m[1]
    }
    return null
  }
  function getChapterId(ch) {
    const direct = ch.id || ch.chapterId || ch.cid || ch.urlId || ch.href || ch.url || ch.slug
    if (direct) return String(direct)
    const num = ch.number || ch.no || ch.index
    if (num !== undefined) return `${seriesId}/${num}`
    const title = ch.title || ch.name
    if (title) return `${seriesId}/${encodeURIComponent(String(title).toLowerCase().replace(/\s+/g,'-'))}`
    return seriesId
  }
  return (
    <div>
      <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">Chapters</h2>
      <ol className="space-y-2">
        {items.map((ch, i) => {
          const apiLabel = ch?.chap ?? ch?.chapter ?? (ch?.chapVol && ch?.chapVol?.chap) ?? ch?.no ?? ch?.number
          const displayNum = apiLabel ? String(apiLabel) : Math.max(1, totalCount - (start + i))
          const title = `Chapter ${displayNum}`
          const cid = getChapterId(ch)
          return (
            <li key={cid || i}>
              {cid ? (
                <Link
                  to={source === 'mf' 
                    ? `/read/chapter/${cid}?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId || '')}`
                    : `/read/${encodeURIComponent(cid)}?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId || '')}${source==='mp' ? '&src=mp' : ''}`}
                  className="group block rounded-lg bg-white dark:bg-gray-800 hover:bg-stone-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="h-7 w-auto sm:h-8 rounded-md bg-stone-100 dark:bg-gray-700 text-stone-700 dark:text-gray-200 text-[10px] sm:text-xs font-semibold flex items-center justify-center border border-stone-200 dark:border-gray-600 px-2 whitespace-nowrap">
                        Ch {displayNum}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-stone-900 dark:text-white text-sm sm:text-base truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">{title}</div>
                        <div className="text-[10px] sm:text-xs text-stone-500 dark:text-gray-400">Open chapter</div>
                      </div>
                    </div>
                    <svg className="h-4 w-4 text-stone-400 dark:text-gray-500 group-hover:text-brand-500 dark:group-hover:text-brand-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                  </div>
                </Link>
              ) : (
                <div className="rounded-lg border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 sm:px-4 py-3">
                  <div className="font-medium text-stone-900 dark:text-white text-sm sm:text-base truncate">{title}</div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          <button disabled={page===0} onClick={()=>setPage(0)} className={`px-3 py-1 rounded-full border text-sm ${page===0? 'opacity-50 cursor-not-allowed border-stone-200 dark:border-gray-700 text-stone-500 dark:text-gray-400' : 'border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700'}`}>First</button>
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
            const pageIndex = idx
            if (pageIndex >= totalPages) return null
            return (
              <button key={idx} onClick={()=>setPage(pageIndex)} className={`px-3 py-1 rounded-full border text-sm ${page===pageIndex? 'bg-brand-500 text-white border-brand-500' : 'border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700'}`}>{pageIndex+1}</button>
            )
          })}
          <button disabled={(page+1)>=totalPages} onClick={()=>setPage(totalPages-1)} className={`px-3 py-1 rounded-full border text-sm ${((page+1)>=totalPages)? 'opacity-50 cursor-not-allowed border-stone-200 dark:border-gray-700 text-stone-500 dark:text-gray-400' : 'border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700'}`}>Last</button>
        </div>
      )}
    </div>
  )
}



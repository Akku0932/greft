import { useEffect, useMemo, useState } from 'react'
import { sanitizeTitleId } from '../lib/api'

export default function History() {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState('recent') // recent | title

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recent-reads')
      const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
      // Backfill source for entries missing it using cached series-info
      const fixed = list.map((it) => {
        if (it && !it.source && it.seriesId) {
          try {
            const keys = Object.keys(localStorage)
            const hasMp = keys.some((k) => k.startsWith(`mp:info:${it.seriesId}`) || k === `series-info:${it.seriesId}:${it.titleId || ''}`)
            if (hasMp) return { ...it, source: 'mp' }
          } catch {}
        }
        return it
      })
      setItems(fixed)
      try { localStorage.setItem('recent-reads', JSON.stringify(fixed)) } catch {}
    } catch {
      setItems([])
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (items || []).filter(it => !q || (it.title || '').toLowerCase().includes(q))
    if (sort === 'title') return list.slice(0).sort((a,b) => (a.title||'').localeCompare(b.title||''))
    return list.slice(0).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0))
  }, [items, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [query, pageSize, sort])

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Reading History</h1>
          <p className="text-sm text-stone-600 dark:text-gray-300">Your recently opened series</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search history…" className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-stone-900 dark:text-white" />
          <select value={sort} onChange={(e)=>setSort(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-stone-900 dark:text-white">
            <option value="recent">Most Recent</option>
            <option value="title">Title A–Z</option>
          </select>
          <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-stone-900 dark:text-white">
            <option value="12">12</option>
            <option value="20">20</option>
            <option value="40">40</option>
          </select>
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-stone-300 dark:border-gray-700 p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-stone-200 dark:bg-gray-800 mb-4" />
          <div className="text-lg font-semibold text-stone-900 dark:text-white">No history yet</div>
          <div className="text-stone-600 dark:text-gray-300 text-sm">Start reading to build your history.</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
          {pageItems.map((it, i) => {
            const isMF = it.seriesId && it.seriesId.includes('.') && !it.seriesId.includes('/')
            const isMP = String(it.source || '').toLowerCase() === 'mp'
            const srcParam = isMP ? (isMF ? '&src=mp' : '&src=mp') : ''
            const infoSrc = isMP ? '?src=mp' : ''
            const href = it.lastChapterId
              ? (isMF
                  ? `/read/chapter/${it.lastChapterId}?series=${encodeURIComponent(it.seriesId)}&title=${encodeURIComponent(sanitizeTitleId(it.titleId || 'title'))}${srcParam}`
                  : `/read/${encodeURIComponent(it.lastChapterId)}?series=${encodeURIComponent(it.seriesId)}&title=${encodeURIComponent(sanitizeTitleId(it.titleId || 'title'))}${srcParam}`)
              : (isMF
                  ? `/info/${encodeURIComponent(it.seriesId)}${infoSrc}`
                  : `/info/${encodeURIComponent(it.seriesId)}/${encodeURIComponent(sanitizeTitleId(it.titleId || 'title'))}${infoSrc}`)
            return (
              <a key={(it.seriesId || i) + 'h'} href={href} className="group relative">
                <div className="relative aspect-[3/4] rounded-lg sm:rounded-xl overflow-hidden ring-1 ring-stone-200 dark:ring-gray-800 bg-stone-200">
                  {it.cover && <img src={it.cover} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />
                  {isMP && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-green-500/90 text-white shadow">MP</span>
                  )}
                </div>
                <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-sm font-semibold line-clamp-2">{it.title}</div>
                <div className="text-[9px] sm:text-[10px] text-stone-600 dark:text-gray-400">Last read • {timeAgo(it.updatedAt)}</div>
              </a>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={()=>setPage(p=>Math.max(1,p-1))} className={`px-3 py-1.5 rounded-lg text-sm ${page<=1?'opacity-50 cursor-not-allowed':'hover:bg-stone-100 dark:hover:bg-gray-800'}`}>Prev</button>
          <div className="px-2 text-sm text-stone-700 dark:text-gray-300">Page {page} of {totalPages}</div>
          <button disabled={page >= totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className={`px-3 py-1.5 rounded-lg text-sm ${page>=totalPages?'opacity-50 cursor-not-allowed':'hover:bg-stone-100 dark:hover:bg-gray-800'}`}>Next</button>
        </div>
      )}
    </div>
  )
}

function timeAgo(value) {
  if (!value) return '-'
  const t = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value)
  if (Number.isNaN(t)) return '-'
  const diff = Math.max(0, Date.now() - t)
  const m = Math.floor(diff / 60000)
  if (m < 60) return m <= 1 ? '1m' : `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  const y = Math.floor(mo / 12)
  return `${y}y`
}



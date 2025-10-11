import { useLibrary } from '../hooks/useLibrary'
import { sanitizeTitleId } from '../lib/api'
import { signInWithMagicLink, signInWithGoogle } from '../lib/authApi'
import { useEffect, useMemo, useState } from 'react'
import { fetchProgress } from '../lib/progressApi'
import { api } from '../lib/api'

export default function Saved() {
  const { user, items, loading, remove, setStatus, markHasUpdates } = useLibrary()
  const [prog, setProg] = useState([])
  const [chaptersBySeries, setChaptersBySeries] = useState({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent') // recent | title | progress

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const p = await fetchProgress()
        setProg(p)
        // fetch total chapters per saved series (lightweight)
        const uniqueSeries = Array.from(new Set(items.map(it => `${it.source}:${it.series_id}`)))
        const map = {}
        await Promise.all(uniqueSeries.map(async key => {
          const [source, sid] = key.split(':')
          try {
            const res = await api.chapters(sid, source)
            const arr = Array.isArray(res) ? res : (res.items || [])
            map[key] = arr.length || 0
          } catch { map[key] = 0 }
        }))
        setChaptersBySeries(map)
        // mark has_updates when new chapters are detected (server flag)
        const byKey = Object.fromEntries(items.map(it => [[`${it.source}:${it.series_id}`], it]))
        await Promise.all(uniqueSeries.map(async key => {
          const item = byKey[key]
          if (!item) return
          const pItem = p.find(x => x.source === item.source && x.series_id === item.series_id)
          const total = map[key] || 0
          const lastIdx = Math.max(-1, Number(pItem?.last_chapter_index ?? -1))
          const hasNew = total > 0 && lastIdx + 1 < total
          try { await markHasUpdates({ seriesId: item.series_id, source: item.source, hasUpdates: hasNew }) } catch {}
        }))
      } catch {}
    })()
  }, [user, items])

  const decorate = (it) => {
    const key = `${it.source}:${it.series_id}`
    const p = prog.find(x => x.source === it.source && x.series_id === it.series_id)
    const total = chaptersBySeries[key] || 0
    const idx = Math.max(0, Number(p?.last_chapter_index ?? -1))
    const percent = total > 0 ? Math.min(100, Math.round(((idx + 1) / total) * 100)) : 0
    return { ...it, _p: p, _total: total, _idx: idx, _percent: percent }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter(it => !q || (it.title || '').toLowerCase().includes(q))
      .map(decorate)
  }, [items, query, prog, chaptersBySeries])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'title') {
      arr.sort((a,b) => (a.title||'').localeCompare(b.title||''))
    } else if (sort === 'progress') {
      arr.sort((a,b) => (b._percent||0) - (a._percent||0))
    } // 'recent' assumed by default order from DB
    return arr
  }, [filtered, sort])

  const timeAgo = (value) => {
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

  if (!user) return (
    <div className="px-6 py-10">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-700 text-white mb-4">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Sign in to see your List</h1>
        <p className="text-stone-600 dark:text-gray-300 mt-2">Save series, sync progress across devices, and continue where you left off.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href="/login" className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700 hover:opacity-90">Login</a>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="h-8 w-40 rounded-lg bg-stone-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-10 w-80 rounded-lg bg-stone-200 dark:bg-gray-800 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden bg-stone-200 dark:bg-gray-800 animate-pulse aspect-[3/4]" />
        ))}
      </div>
    </div>
  )

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">My List</h1>
          <p className="text-sm text-stone-600 dark:text-gray-300">Saved series and your reading progress</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search saved…" className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-stone-900 dark:text-white" />
          <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-stone-900 dark:text-white">
            <option value="recent">Recently Added</option>
            <option value="title">Title A–Z</option>
            <option value="progress">Progress %</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-stone-300 dark:border-gray-700 p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-stone-200 dark:bg-gray-800 mb-4" />
          <div className="text-lg font-semibold text-stone-900 dark:text-white">No saved series yet</div>
          <div className="text-stone-600 dark:text-gray-300 text-sm">Find something you like and tap “Add to List” on the Info page.</div>
        </div>
      ) : (
        <>
        {/* Desktop professional table */}
        <div className="hidden lg:block rounded-xl overflow-hidden ring-1 ring-stone-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-[1fr_auto_160px_120px_110px_110px] gap-0 px-5 py-3 text-xs font-semibold text-stone-600 dark:text-gray-300 border-b border-stone-200 dark:border-gray-800">
            <div className="uppercase tracking-wide">Title</div>
            <div className="uppercase tracking-wide text-right pr-2">Continue</div>
            <div className="uppercase tracking-wide text-center">Status</div>
            <div className="uppercase tracking-wide text-center">Last Read</div>
            <div className="uppercase tracking-wide text-center">Updated</div>
            <div className="uppercase tracking-wide text-center">Added</div>
          </div>
          <div>
            {sorted.map(it => {
          const href = it.source === 'mf'
            ? `/info/${encodeURIComponent(it.series_id)}`
            : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
            const p = it._p
            const total = it._total
            const idx = it._idx
            const percent = it._percent
            const continueHref = p?.last_chapter_id
              ? (it.source === 'mf'
                ? `/read/chapter/${p.last_chapter_id}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
                : `/read/${encodeURIComponent(p.last_chapter_id)}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
              : href
              return (
                <div key={`${it.source}:${it.series_id}`} className="grid grid-cols-[1fr_auto_160px_120px_110px_110px] items-center gap-0 px-5 py-4 border-b border-stone-200 dark:border-gray-800 hover:bg-stone-50/70 dark:hover:bg-gray-800/50 transition-colors">
                  <a href={href} className="flex items-center gap-3 min-w-0">
                    <div className="h-14 w-10 rounded-md overflow-hidden bg-stone-200 dark:bg-gray-800 flex-shrink-0">
                      {it.cover && <img src={it.cover} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-900 dark:text-white truncate flex items-center gap-2">
                        <span className="truncate">{it.title}</span>
                        {!!it.has_updates && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                            New
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-gray-400">Ch {Math.max(1, idx + 1)} / {total}</div>
                    </div>
                  </a>
                  <div className="text-right pr-2">
                    <a href={continueHref} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-gray-700 text-sm">
                      Continue
                      <span className="px-1 py-0.5 rounded bg-white/20">{Math.max(1, idx + 1)}</span>
                    </a>
                  </div>
                  <div className="text-center">
                    <select
                      value={it.status || 'planning'}
                      onChange={async (e) => { try { await setStatus({ seriesId: it.series_id, source: it.source, status: e.target.value }) } catch {} }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-stone-300 dark:border-gray-700 text-stone-800 dark:text-gray-200 shadow-sm"
                    >
                      <option value="planning">Planning</option>
                      <option value="reading">Reading</option>
                      <option value="completed">Completed</option>
                      <option value="dropped">Dropped</option>
                      <option value="on_hold">On hold</option>
                    </select>
                  </div>
                  <div className="text-center text-sm text-stone-600 dark:text-gray-300">{timeAgo(p?.updated_at)}</div>
                  <div className="text-center text-sm text-stone-600 dark:text-gray-300">{timeAgo(it.updated_at)}</div>
                  <div className="text-center text-sm text-stone-600 dark:text-gray-300">{timeAgo(it.added_at)}</div>
                </div>
              )
            })}
          </div>
        </div>
        {/* Mobile/Tablet card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:hidden gap-5 mt-6">
          {sorted.map(it => {
            const href = it.source === 'mf'
              ? `/info/${encodeURIComponent(it.series_id)}`
              : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
            const p = it._p
            const total = it._total
            const idx = it._idx
            const percent = it._percent
            const continueHref = p?.last_chapter_id
              ? (it.source === 'mf'
                ? `/read/chapter/${p.last_chapter_id}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
                : `/read/${encodeURIComponent(p.last_chapter_id)}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
              : href
            return (
              <a key={`${it.source}:${it.series_id}`} href={href} className="group relative">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden ring-1 ring-stone-200 dark:ring-gray-800 bg-stone-200">
                  {it.cover && <img src={it.cover} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90" />
                  {total > 0 && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center justify-between text-[10px] text-white/90 mb-1">
                        <span>{`Ch ${idx + 1}/${total}`}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold line-clamp-2">{it.title}</div>
                <div className="mt-2 flex items-center justify-between">
                  <a href={continueHref} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-gray-700 text-xs">Continue</a>
                  <select
                    value={it.status || 'planning'}
                    onChange={async (e) => { try { await setStatus({ seriesId: it.series_id, source: it.source, status: e.target.value }) } catch {} }}
                    className="px-2 py-1 rounded-lg text-[10px] bg-white dark:bg-gray-800 border border-stone-300 dark:border-gray-700 text-stone-800 dark:text-gray-200"
                  >
                    <option value="planning">Planning</option>
                    <option value="reading">Reading</option>
                    <option value="completed">Completed</option>
                    <option value="dropped">Dropped</option>
                    <option value="on_hold">On hold</option>
                  </select>
                </div>
              </a>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}



import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, extractItems, getImage, parseIdTitle, sanitizeTitleId, pickImage } from '../lib/api.js'

export default function SearchResults() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [type, setType] = useState('all') // all | manga | manhwa | manhua
  const [sort, setSort] = useState('relevance') // relevance | latest
  const [pageSize, setPageSize] = useState(24)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const data = await api.search(q)
        if (mounted) setItems(extractItems(data))
      } catch (e) {
        if (mounted) setError(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (q) run()
    return () => { mounted = false }
  }, [q])

  const filtered = useMemo(() => {
    let list = items || []
    if (type !== 'all') list = list.filter(it => String(it.type || it._type || '').toLowerCase() === type)
    if (sort === 'latest') list = list.slice(0)
    return list
  }, [items, type, sort])

  function isAdultTagged(it) {
    const tags = (it?.genres || it?.tags || it?.otherInfo || [])
    const arr = Array.isArray(tags) ? tags : []
    return arr.some(t => /adult|ecchi/i.test(String(t)))
  }
  function adultAllowed() {
    try { const obj = JSON.parse(localStorage.getItem('site:settings')||'{}'); return !!obj.adultAllowed } catch { return false }
  }

  return (
    <div className="max-w-[120rem] mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">Search</div>
          <div className="text-sm text-stone-600 dark:text-gray-400">Results for “{q}”</div>
        </div>
        <form onSubmit={(e)=>{e.preventDefault(); const form=new FormData(e.currentTarget); const nq=String(form.get('q')||'').trim(); if(nq) navigate(`/search?q=${encodeURIComponent(nq)}`)}} className="flex gap-2 w-full sm:w-auto">
          <input name="q" defaultValue={q} placeholder="Search…" className="flex-1 sm:w-80 px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" />
          <button className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700">Search</button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-300 dark:border-gray-700 overflow-hidden text-sm">
          {['all','manga','manhwa','manhua'].map(t => (
            <button key={t} onClick={()=>setType(t)} className={`px-3 py-1.5 ${type===t?'bg-stone-900 dark:bg-gray-700 text-white':'bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300'}`}>{t[0].toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-stone-300 dark:border-gray-700 overflow-hidden text-sm">
          {['relevance','latest'].map(s => (
            <button key={s} onClick={()=>setSort(s)} className={`px-3 py-1.5 ${sort===s?'bg-stone-900 dark:bg-gray-700 text-white':'bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300'}`}>{s[0].toUpperCase()+s.slice(1)}</button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-stone-300 dark:border-gray-700 overflow-hidden text-sm">
          {[24,48,96].map(n => (
            <button key={n} onClick={()=>setPageSize(n)} className={`px-3 py-1.5 ${pageSize===n?'bg-stone-900 dark:bg-gray-700 text-white':'bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300'}`}>{n}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">{String(error)}</div>
      )}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
          {Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-stone-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      )}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
          {filtered.slice(0, pageSize).map((it, i) => {
            const parsed = parseIdTitle(it.seriesId || it.id || it.slug || it.urlId, it.title || it.name)
            const href = `/info/${encodeURIComponent(parsed.id)}?src=mp`
            const img = getImage(pickImage(it) || it.img)
            const title = it.title || it.name || 'Untitled'
            return (
              <a key={(it.id||i)+':res'} href={href} className="group block">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-stone-200 dark:bg-gray-800">
                {img && <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" style={{ filter: (!adultAllowed() && isAdultTagged(it)) ? 'blur(20px)' : 'none' }} />}
                {(!adultAllowed() && isAdultTagged(it)) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-2 py-1 rounded bg-black/70 text-white text-xs">18+ hidden</span>
                  </div>
                )}
                </div>
                <div className="mt-2 text-sm font-medium line-clamp-2 text-stone-900 dark:text-white group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(90deg,#60a5fa,#a78bfa)' }}>{title}</div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}



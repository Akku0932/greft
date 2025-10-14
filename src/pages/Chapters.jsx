import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function Chapters() {
  const { id } = useParams()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Determine source based on series ID format
  const isMF = id && id.includes('.') && !id.includes('/')
  const source = isMF ? 'mf' : 'gf'

  useEffect(() => {
    let mounted = true
    async function run() {
      try { const res = await api.chapters(id, source); if (mounted) setList(res.items || res || []) }
      catch (e) { if (mounted) setError(e) } finally { if (mounted) setLoading(false) }
    }
    run();
    return () => { mounted = false }
  }, [id])

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-2xl font-semibold mb-4">Chapters</h2>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}
      <ul className="space-y-2">
        {list?.map((ch, i) => (
          <li key={ch.id || i} className="bg-white rounded-md border border-stone-200 px-4 py-3 flex items-center justify-between">
            <span>{ch.title || ch.name || `Chapter ${i + 1}`}</span>
            <Link 
              to={isMF 
                ? `/read/chapter/${ch.id || ch.slug || ch.urlId || ''}?series=${encodeURIComponent(id)}&title=title`
                : `/read/${encodeURIComponent(ch.id || ch.slug || ch.urlId || '')}`} 
              className="px-3 py-1 rounded bg-brand-500 text-white"
            >
              Read
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}



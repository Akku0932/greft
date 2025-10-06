import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, extractItems } from '../lib/api.js'
import Section from '../components/Section.jsx'

export default function SearchResults() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return <Section title={`Search: ${q}`} items={items} loading={loading} error={error} />
}



import { useCallback, useEffect, useState } from 'react'
import { fetchLibrary, saveSeries, unsaveSeries } from '../lib/libraryApi'
import { useAuth } from './useAuth'

export function useLibrary() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return }
    setLoading(true)
    try {
      const rows = await fetchLibrary()
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const add = useCallback(async (payload) => {
    if (!user) throw new Error('login-required')
    await saveSeries(payload)
    await refresh()
  }, [user, refresh])

  const remove = useCallback(async (payload) => {
    if (!user) throw new Error('login-required')
    await unsaveSeries(payload)
    await refresh()
  }, [user, refresh])

  const isSaved = useCallback((seriesId, source) => {
    return items.some(it => it.series_id === seriesId && it.source === source)
  }, [items])

  return { user, items, loading, add, remove, isSaved, refresh }
}



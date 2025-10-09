import { useCallback, useEffect, useState } from 'react'
import { fetchLibrary, saveSeries, unsaveSeries, updateSeriesStatus } from '../lib/libraryApi'
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

  const setStatus = useCallback(async ({ seriesId, source, status }) => {
    if (!user) throw new Error('login-required')
    await updateSeriesStatus({ seriesId, source, status })
    await refresh()
  }, [user, refresh])

  return { user, items, loading, add, remove, isSaved, refresh, setStatus }
}



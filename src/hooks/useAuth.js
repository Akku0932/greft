import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(data?.session?.user || null)
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => { sub.subscription.unsubscribe(); mounted = false }
  }, [])

  return { user, loading }
}



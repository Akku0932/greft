import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Function to handle JWT expiration
  const handleJWTExpiration = async () => {
    console.log('JWT expired, signing out user')
    try {
      await supabase.auth.signOut()
      // Clear any cached data
      localStorage.removeItem('supabase.auth.token')
      setUser(null)
    } catch (error) {
      console.error('Error during logout:', error)
    }
  }

  // Function to check if JWT is expired or about to expire
  const checkJWTExpiration = (session) => {
    if (!session?.access_token) return false
    
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      const expirationTime = payload.exp
      
      // If token expires in less than 5 minutes, refresh it
      if (expirationTime - now < 300) {
        console.log('JWT expires soon, attempting refresh')
        return true
      }
      
      // If token is already expired
      if (expirationTime <= now) {
        console.log('JWT is expired')
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error checking JWT expiration:', error)
      return true
    }
  }

  useEffect(() => {
    let mounted = true
    let refreshInterval = null

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          if (error.message?.includes('JWT expired') || error.message?.includes('PGRST303')) {
            await handleJWTExpiration()
          }
        }
        
        if (!mounted) return
        
        if (data?.session) {
          // Check if JWT needs refresh
          if (checkJWTExpiration(data.session)) {
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError) {
                console.error('Refresh error:', refreshError)
                await handleJWTExpiration()
              } else {
                setUser(refreshData?.session?.user || null)
              }
            } catch (refreshError) {
              console.error('Refresh failed:', refreshError)
              await handleJWTExpiration()
            }
          } else {
            setUser(data.session.user)
          }
        } else {
          setUser(null)
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (!mounted) return
        setUser(null)
        setLoading(false)
      }
    }

    initializeAuth()

    // Set up auth state change listener
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null)
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null)
      }
    })

    // Set up periodic JWT check (every 5 minutes)
    refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session && checkJWTExpiration(data.session)) {
          console.log('Periodic JWT check: token needs refresh')
          const { error } = await supabase.auth.refreshSession()
          if (error) {
            console.error('Periodic refresh failed:', error)
            await handleJWTExpiration()
          }
        }
      } catch (error) {
        console.error('Periodic JWT check error:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => { 
      sub.subscription.unsubscribe()
      if (refreshInterval) clearInterval(refreshInterval)
      mounted = false 
    }
  }, [])

  return { user, loading }
}



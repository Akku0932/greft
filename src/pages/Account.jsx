import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/authApi'
import { supabase } from '../lib/supabaseClient'
import { fetchUserComments } from '../lib/commentsApi'

export default function Account() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({ display_name: '', avatar_url: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const needsCompletion = params.get('complete') === '1'
  const [tab, setTab] = useState('profile')

  // Account tab state
  const [newPassword, setNewPassword] = useState('')
  const [accountMsg, setAccountMsg] = useState('')

  // Profile extras stored in auth metadata
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState(['', '', '', ''])

  // Site settings stored locally
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [adultAllowed, setAdultAllowed] = useState(false)

  // User comments state
  const [userComments, setUserComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile({ display_name: data.display_name || '', avatar_url: data.avatar_url || '' })
      // load metadata
      const meta = user?.user_metadata || {}
      setBio(meta.bio || '')
      const mlinks = Array.isArray(meta.links) ? meta.links.slice(0,4) : []
      setLinks([mlinks[0]||'', mlinks[1]||'', mlinks[2]||'', mlinks[3]||''])
      // load site settings (prefer Supabase, fallback to local)
      const sp = meta.preferences || {}
      if (typeof sp.commentsEnabled === 'boolean') setCommentsEnabled(sp.commentsEnabled)
      if (typeof sp.historyEnabled === 'boolean') setHistoryEnabled(sp.historyEnabled)
      if (typeof sp.adultAllowed === 'boolean') setAdultAllowed(sp.adultAllowed)
      if (sp == null || (sp.commentsEnabled == null && sp.historyEnabled == null)) {
        try {
          const s = JSON.parse(localStorage.getItem('site:settings') || '{}')
          if (typeof s.commentsEnabled === 'boolean') setCommentsEnabled(s.commentsEnabled)
          if (typeof s.historyEnabled === 'boolean') setHistoryEnabled(s.historyEnabled)
          if (typeof s.adultAllowed === 'boolean') setAdultAllowed(!!s.adultAllowed)
        } catch {}
      }
    })()
  }, [user])

  // Load user comments
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        setCommentsLoading(true)
        setCommentsError(null)
        const comments = await fetchUserComments(user.id, 10)
        setUserComments(comments)
      } catch (error) {
        console.error('Failed to load user comments:', error)
        setCommentsError('Failed to load comments')
      } finally {
        setCommentsLoading(false)
      }
    })()
  }, [user])

  async function saveProfile(e) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage('')
    const row = { id: user.id, display_name: profile.display_name || null, avatar_url: profile.avatar_url || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('profiles').upsert(row)
    setSaving(false)
    setMessage(error ? String(error.message || error) : 'Saved')
  }
  if (!user) return (
    <div className="p-6">
      <div className="mb-2 font-semibold text-lg">Account</div>
      <div>Please log in. <a className="underline" href="/login">Go to login</a></div>
    </div>
  )
  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Account</h1>
          <p className="text-sm text-stone-600 dark:text-gray-300">Manage your profile, identity and settings</p>
        </div>
        <button onClick={()=>signOut()} className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700">Log out</button>
      </div>

      {needsCompletion && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
          <div className="text-amber-800 dark:text-amber-200 font-medium">Complete your profile</div>
          <div className="text-amber-700 dark:text-amber-300 text-sm">Please set a display name and avatar to finish signing in.</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <aside className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 p-6">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-stone-200 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-700">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : null}
            </div>
            <div>
              <div className="text-lg font-semibold">{profile.display_name || user.email?.split('@')[0]}</div>
              <div className="text-sm text-stone-600 dark:text-gray-400">{user.email}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <a href="/saved" className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 text-center hover:bg-stone-50 dark:hover:bg-gray-800">Saved</a>
            <a href="/history" className="px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 text-center hover:bg-stone-50 dark:hover:bg-gray-800">History</a>
          </div>
          <div className="mt-6 border-t border-stone-200 dark:border-gray-800 pt-4 flex gap-2 text-sm overflow-x-auto">
            <button onClick={()=>setTab('profile')} className={`px-3 py-1.5 rounded-md border transition-colors ${tab==='profile'?'border-stone-900 dark:border-white bg-stone-50 dark:bg-gray-800':'border-stone-300 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-800'}`}>Profile</button>
            <button onClick={()=>setTab('account')} className={`px-3 py-1.5 rounded-md border transition-colors ${tab==='account'?'border-stone-900 dark:border-white bg-stone-50 dark:bg-gray-800':'border-stone-300 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-800'}`}>Account</button>
            <button onClick={()=>setTab('comments')} className={`px-3 py-1.5 rounded-md border transition-colors ${tab==='comments'?'border-stone-900 dark:border-white bg-stone-50 dark:bg-gray-800':'border-stone-300 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-800'}`}>Comments</button>
            <button onClick={()=>setTab('site')} className={`px-3 py-1.5 rounded-md border transition-colors ${tab==='site'?'border-stone-900 dark:border-white bg-stone-50 dark:bg-gray-800':'border-stone-300 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-800'}`}>Settings</button>
          </div>
        </aside>

        <section className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 p-6">
          {tab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">Display name</label>
                <input value={profile.display_name} onChange={(e)=>setProfile(p=>({ ...p, display_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">Avatar URL</label>
                <input value={profile.avatar_url} onChange={(e)=>setProfile(p=>({ ...p, avatar_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" placeholder="https://..." required />
                <p className="text-xs text-stone-500 dark:text-gray-400 mt-1">Paste a direct image URL. Upload support can be added later.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">About me</label>
                <textarea value={bio} onChange={(e)=>setBio(e.target.value)} className="w-full px-3 py-2 min-h-[100px] rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" placeholder="Tell us about yourself..." />
              </div>
              {[0,1,2,3].map((i)=> (
                <div key={i} className="md:col-span-2">
                  <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">Social link {i+1}</label>
                  <input value={links[i]} onChange={(e)=>setLinks((arr)=>{ const x=[...arr]; x[i]=e.target.value; return x })} className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" placeholder="https://..." />
                </div>
              ))}
              <div className="md:col-span-2 flex items-center gap-3">
                <button disabled={saving} onClick={saveProfile} className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
                {message && <span className="text-sm text-stone-600 dark:text-gray-300">{message}</span>}
                <button onClick={async()=>{ await supabase.auth.updateUser({ data: { bio, links } }); setMessage('Profile details updated') }} className="px-4 py-2 rounded-lg border border-stone-300 dark:border-gray-700">Save bio & links</button>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">E-mail</label>
                <input value={user.email || ''} disabled className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-stone-50 dark:bg-gray-800/60 text-stone-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm text-stone-600 dark:text-gray-400 mb-1">Username</label>
                <input value={profile.display_name} onChange={(e)=>setProfile(p=>({ ...p, display_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" />
                <div className="mt-2"><button onClick={saveProfile} className="px-3 py-1.5 rounded-md bg-stone-900 text-white dark:bg-gray-700">Save</button></div>
              </div>
              <div className="pt-2 border-t border-stone-200 dark:border-gray-800">
                <div className="font-medium mb-2">Change Password</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="New password" className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-900 dark:text-white" />
                  <button onClick={async ()=>{ setAccountMsg(''); const { error } = await supabase.auth.updateUser({ password: newPassword }); setAccountMsg(error? String(error.message||error): 'Password updated'); setNewPassword('') }} className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700">Save</button>
                </div>
              </div>
              <div className="pt-2 border-t border-stone-200 dark:border-gray-800">
                <div className="font-medium mb-2">Link Google</div>
                <button onClick={async()=>{ await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/account' } }) }} className="w-full sm:w-auto px-4 py-2 rounded-lg border border-stone-300 dark:border-gray-700">Link Google</button>
              </div>
              {accountMsg && <div className="text-sm text-stone-600 dark:text-gray-300">{accountMsg}</div>}
            </div>
          )}

          {tab === 'comments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900 dark:text-white">Your Comments</h2>
                  <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Recent comments you've posted</p>
                </div>
                <div className="text-sm text-stone-500 dark:text-gray-400">
                  {userComments.length} comments
                </div>
              </div>

              {commentsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-gray-700"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-24 bg-stone-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-3 w-full bg-stone-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-3 w-3/4 bg-stone-200 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : commentsError ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-3">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">Failed to load comments</h3>
                  <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">{commentsError}</p>
                  <button
                    onClick={() => {
                      setCommentsError(null)
                      // Reload comments
                      if (user) {
                        setCommentsLoading(true)
                        fetchUserComments(user.id, 10)
                          .then(setUserComments)
                          .catch(() => setCommentsError('Failed to load comments'))
                          .finally(() => setCommentsLoading(false))
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-gray-700 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                </div>
              ) : userComments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-4">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No comments yet</h3>
                  <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">Start commenting on series and chapters to see them here!</p>
                  <a 
                    href="/" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Browse Series
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {userComments.map((comment) => {
                    const formatTimeAgo = (date) => {
                      const now = new Date()
                      const commentDate = new Date(date)
                      const diffMs = now - commentDate
                      const diffMins = Math.floor(diffMs / 60000)
                      const diffHours = Math.floor(diffMins / 60)
                      const diffDays = Math.floor(diffHours / 24)

                      if (diffMins < 1) return 'just now'
                      if (diffMins < 60) return `${diffMins}m ago`
                      if (diffHours < 24) return `${diffHours}h ago`
                      if (diffDays < 7) return `${diffDays}d ago`
                      return commentDate.toLocaleDateString()
                    }

                    const getSeriesLink = () => {
                      if (comment.chapter_id) {
                        return `/read/${encodeURIComponent(comment.chapter_id)}?series=${encodeURIComponent(comment.series_id)}${comment.source === 'mp' ? '&src=mp' : ''}`
                      }
                      return `/info/${encodeURIComponent(comment.series_id)}${comment.source === 'mp' ? '?src=mp' : ''}`
                    }

                    return (
                      <div key={comment.id} className="bg-stone-50 dark:bg-gray-800/50 rounded-lg p-4 hover:bg-stone-100 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                              {profile.display_name ? profile.display_name[0].toUpperCase() : user.email[0].toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-stone-900 dark:text-white text-sm">
                                {profile.display_name || user.email.split('@')[0]}
                              </span>
                              <span className="text-xs text-stone-500 dark:text-gray-400">
                                {formatTimeAgo(comment.created_at)}
                              </span>
                              {comment.is_edited && (
                                <span className="text-xs text-stone-400 dark:text-gray-500 italic">
                                  (edited)
                                </span>
                              )}
                            </div>
                            <p className="text-stone-700 dark:text-gray-300 text-sm leading-relaxed mb-2">
                              {comment.content}
                            </p>
                            <div className="flex items-center gap-4 text-xs">
                              <div className="flex items-center gap-1 text-stone-500 dark:text-gray-400">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                                {comment.likes?.[0]?.count || 0}
                              </div>
                              <a 
                                href={getSeriesLink()}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {comment.chapter_id ? 'View Chapter' : 'View Series'}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'site' && (
            <div className="grid grid-cols-1 gap-6">
              <div>
                <div className="text-lg font-semibold mb-4">Site Settings</div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-stone-200 dark:border-gray-800">
                    <div>
                      <div className="font-medium">Show 18+ content</div>
                      <div className="text-sm text-stone-600 dark:text-gray-400">When off, covers are blurred and adult/ecchi content is gated.</div>
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={adultAllowed} 
                        onChange={async (e)=>{ 
                          const v=e.target.checked; 
                          setAdultAllowed(v); 
                          localStorage.setItem('site:settings', JSON.stringify({ commentsEnabled, historyEnabled, adultAllowed: v })); 
                          try { 
                            await supabase.auth.updateUser({ data: { preferences: { commentsEnabled, historyEnabled, adultAllowed: v } } }) 
                          } catch {} 
                        }} 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-stone-200 dark:border-gray-800">
                    <div>
                      <div className="font-medium">Show comments by default</div>
                      <div className="text-sm text-stone-600 dark:text-gray-400">Blur or reveal the comment section.</div>
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={commentsEnabled} 
                        onChange={async (e)=>{ 
                          const v=e.target.checked; 
                          setCommentsEnabled(v); 
                          localStorage.setItem('site:settings', JSON.stringify({ commentsEnabled: v, historyEnabled })); 
                          try { 
                            await supabase.auth.updateUser({ data: { preferences: { commentsEnabled: v, historyEnabled } } }) 
                          } catch {} 
                        }} 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">"Reading History" Section</div>
                      <div className="text-sm text-stone-600 dark:text-gray-400">Show or hide the "Reading History" section.</div>
                    </div>
                    <label className="inline-flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={historyEnabled} 
                        onChange={async (e)=>{ 
                          const v=e.target.checked; 
                          setHistoryEnabled(v); 
                          localStorage.setItem('site:settings', JSON.stringify({ commentsEnabled, historyEnabled: v })); 
                          try { 
                            await supabase.auth.updateUser({ data: { preferences: { commentsEnabled, historyEnabled: v } } }) 
                          } catch {} 
                        }} 
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}



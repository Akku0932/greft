import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/authApi'
import { supabase } from '../lib/supabaseClient'

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
      if (sp == null || (sp.commentsEnabled == null && sp.historyEnabled == null)) {
        try {
          const s = JSON.parse(localStorage.getItem('site:settings') || '{}')
          if (typeof s.commentsEnabled === 'boolean') setCommentsEnabled(s.commentsEnabled)
          if (typeof s.historyEnabled === 'boolean') setHistoryEnabled(s.historyEnabled)
        } catch {}
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
            <button onClick={()=>setTab('profile')} className={`px-3 py-1.5 rounded-md border ${tab==='profile'?'border-stone-900 dark:border-white':'border-stone-300 dark:border-gray-700'}`}>Profile</button>
            <button onClick={()=>setTab('account')} className={`px-3 py-1.5 rounded-md border ${tab==='account'?'border-stone-900 dark:border-white':'border-stone-300 dark:border-gray-700'}`}>Account</button>
            <button onClick={()=>setTab('site')} className={`px-3 py-1.5 rounded-md border ${tab==='site'?'border-stone-900 dark:border-white':'border-stone-300 dark:border-gray-700'}`}>Site Settings</button>
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

          {tab === 'site' && (
            <div className="grid grid-cols-1 gap-6">
              <div>
                <div className="text-lg font-semibold mb-2">Other settings</div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">Show comments by default</div>
                    <div className="text-sm text-stone-600 dark:text-gray-400">Blur or reveal the comment section.</div>
                  </div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={commentsEnabled} onChange={async (e)=>{ const v=e.target.checked; setCommentsEnabled(v); localStorage.setItem('site:settings', JSON.stringify({ commentsEnabled: v, historyEnabled })); try { await supabase.auth.updateUser({ data: { preferences: { commentsEnabled: v, historyEnabled } } }) } catch {} }} />
                    <span>Enable</span>
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-stone-200 dark:border-gray-800">
                  <div>
                    <div className="font-medium">"Reading History" Section</div>
                    <div className="text-sm text-stone-600 dark:text-gray-400">Show or hide the "Reading History" section.</div>
                  </div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={historyEnabled} onChange={async (e)=>{ const v=e.target.checked; setHistoryEnabled(v); localStorage.setItem('site:settings', JSON.stringify({ commentsEnabled, historyEnabled: v })); try { await supabase.auth.updateUser({ data: { preferences: { commentsEnabled, historyEnabled: v } } }) } catch {} }} />
                    <span>Enable</span>
                  </label>
                </div>
                <div className="py-3 border-t border-stone-200 dark:border-gray-800">
                  <div className="font-medium mb-2">Reader Settings</div>
                  <button onClick={()=>alert('Reader settings coming soon')} className="px-3 py-1.5 rounded-md border border-stone-300 dark:border-gray-700">Show Settings</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}



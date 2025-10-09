import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../lib/authApi'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Turnstile from '../components/Turnstile'

export default function Login() {
  // All hooks must be called before any conditional return
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaMountId, setCaptchaMountId] = useState(0)
  const { user } = useAuth()
  const navigate = useNavigate()

  if (user) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">You're logged in</h1>
        <p className="text-stone-600 dark:text-gray-300">Go to <a className="underline" href="/saved">Saved</a> to see your list.</p>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      if (!captcha) {
        setErr('Please verify the reCAPTCHA.')
        return
      }
      // Verify Turnstile token server-side before proceeding
      const vr = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captcha })
      })
      let vj
      try { vj = await vr.json() } catch (_) { vj = null }
      if (!vr.ok || !vj?.success) {
        const msg = vj?.error || (Array.isArray(vj?.errorCodes) ? vj.errorCodes.join(', ') : '')
        setErr(`Verification failed${msg ? ': ' + msg : ''}. Please try again.`)
        setCaptcha('')
        // Force remount the widget to avoid timeout-or-duplicate
        setCaptchaMountId((x) => x + 1)
        return
      }
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        if (password !== confirm) {
          setErr('Passwords do not match. Please retype your password.')
          return
        }
        await signUpWithEmail(email, password)
      }
      // After auth, fetch profile and route to completion if needed
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes?.user?.id
      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
        if (!prof) {
          await supabase.from('profiles').upsert({ id: uid })
          navigate('/account?complete=1')
          return
        }
        const needs = !prof.display_name || !prof.avatar_url
        if (needs) {
          navigate('/account?complete=1')
          return
        }
      }
      navigate('/')
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/70 backdrop-blur p-6 shadow-soft">
        <h1 className="text-2xl font-bold mb-2 text-stone-900 dark:text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">Sign {mode === 'login' ? 'in to continue' : 'up to save and sync your library'}</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-gray-400 mb-1">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" required className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-gray-700 bg-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-gray-400 mb-1">Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••" required className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-gray-700 bg-transparent" />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-gray-400 mb-1">Confirm password</label>
              <input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="••••••••" required className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-gray-700 bg-transparent" />
            </div>
          )}
          {err && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">{err}</div>}
          <Turnstile key={captchaMountId} className="mt-1" onChange={setCaptcha} />
          <button type="submit" disabled={loading || !captcha} className="w-full px-4 py-2 rounded-xl bg-stone-900 dark:bg-gray-700 text-white disabled:opacity-60">{loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Sign up')}</button>
        </form>
        <div className="flex items-center gap-2 my-5">
          <div className="h-px bg-stone-200 dark:bg-gray-700 flex-1" />
          <div className="text-xs text-stone-500">or continue with</div>
          <div className="h-px bg-stone-200 dark:bg-gray-700 flex-1" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => signInWithGoogle()} className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-gray-700">Google</button>
        </div>
        <div className="mt-5 text-sm text-center">
          {mode === 'login' ? (
            <button className="underline" onClick={()=>setMode('signup')}>Create an account</button>
          ) : (
            <button className="underline" onClick={()=>setMode('login')}>Already have an account? Sign in</button>
          )}
        </div>
      </div>
    </div>
  )
}



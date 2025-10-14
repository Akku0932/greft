import { supabase } from './supabaseClient'

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) throw error
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}



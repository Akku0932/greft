import { supabase } from './supabaseClient'

export async function fetchLibrary() {
  const { data, error } = await supabase
    .from('library')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveSeries({ seriesId, source, title, cover, status = 'planning' }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  const safeSource = (source || 'mp').toLowerCase()
  const row = { user_id: user.id, series_id: String(seriesId), source: safeSource, title: String(title || ''), cover: String(cover || ''), status: String(status || 'planning'), has_updates: false }
  const { error } = await supabase
    .from('library')
    .upsert(row, { onConflict: 'user_id,series_id' })
  if (error) throw error
}

export async function unsaveSeries({ seriesId, source }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('library')
    .delete()
    .eq('user_id', user.id)
    .eq('series_id', seriesId)
    .eq('source', source)
  if (error) throw error
}

export async function updateSeriesStatus({ seriesId, source, status }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('library')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('series_id', seriesId)
    .eq('source', source)
  if (error) throw error
}

export async function updateSeriesHasUpdates({ seriesId, source, hasUpdates }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('library')
    .update({ has_updates: !!hasUpdates, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('series_id', seriesId)
    .eq('source', source)
  if (error) throw error
}



import { supabase } from './supabaseClient'

export async function upsertProgress({ seriesId, source, lastChapterId, lastChapterIndex }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return
  const row = { user_id: user.id, series_id: seriesId, source, last_chapter_id: lastChapterId, last_chapter_index: lastChapterIndex }
  const { error } = await supabase.from('progress').upsert(row)
  if (error) throw error
}

export async function fetchProgress() {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
  if (error) throw error
  return data || []
}



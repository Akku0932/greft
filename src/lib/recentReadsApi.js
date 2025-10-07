import { supabase } from './supabaseClient'

// Shape used:
// { seriesId, source, title, titleId, cover, lastChapterId, lastChapterIndex, updatedAt }

export async function upsertRecentRead(item) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return
  const row = {
    user_id: user.id,
    series_id: item.seriesId,
    source: item.source,
    title: item.title || null,
    title_id: item.titleId || null,
    cover: item.cover || null,
    last_chapter_id: item.lastChapterId || null,
    last_chapter_index: typeof item.lastChapterIndex === 'number' ? item.lastChapterIndex : null,
    updated_at: new Date().toISOString()
  }
  const { error } = await supabase.from('recent_reads').upsert(row)
  if (error) throw error
}

export async function fetchRecentReads() {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return []
  const { data, error } = await supabase
    .from('recent_reads')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(r => ({
    seriesId: r.series_id,
    source: r.source,
    title: r.title,
    titleId: r.title_id,
    cover: r.cover,
    lastChapterId: r.last_chapter_id,
    lastChapterIndex: typeof r.last_chapter_index === 'number' ? r.last_chapter_index : undefined,
    updatedAt: r.updated_at
  }))
}

export async function deleteRecentRead(seriesId) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return
  const { error } = await supabase
    .from('recent_reads')
    .delete()
    .match({ user_id: user.id, series_id: seriesId })
  if (error) throw error
}



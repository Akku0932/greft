import { supabase } from './supabaseClient'

// Fetch comments for a series or chapter
export async function fetchComments({ seriesId, source, chapterId = null }) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('series_id', seriesId)
    .eq('source', source)
    .eq('chapter_id', chapterId || null)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

// Add a new comment
export async function addComment({ seriesId, source, chapterId, content, parentId = null }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  
  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: user.id,
      series_id: seriesId,
      source,
      chapter_id: chapterId,
      parent_id: parentId,
      content: content.trim(),
      user_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    })
    .select(`
      *,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

// Update a comment
export async function updateComment({ commentId, content }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  
  const { data, error } = await supabase
    .from('comments')
    .update({ 
      content: content.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', commentId)
    .eq('user_id', user.id)
    .select(`
      *,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .single()
  
  if (error) throw error
  return data
}

// Delete a comment
export async function deleteComment({ commentId }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)
  
  if (error) throw error
}

// Like/unlike a comment
export async function toggleCommentLike({ commentId }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('Not authenticated')
  
  // Check if already liked
  const { data: existingLike } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()
  
  if (existingLike) {
    // Unlike
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
    if (error) throw error
    return { liked: false }
  } else {
    // Like
    const { error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: user.id
      })
    if (error) throw error
    return { liked: true }
  }
}

// Get comment likes count
export async function getCommentLikes({ commentId }) {
  const { data, error } = await supabase
    .from('comment_likes')
    .select('user_id')
    .eq('comment_id', commentId)
  
  if (error) throw error
  return data?.length || 0
}

// Check if user liked a comment
export async function isCommentLiked({ commentId }) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return false
  
  const { data } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()
  
  return !!data
}

import { supabase } from './supabaseClient'

// Fetch comments for a series or chapter
export async function fetchComments({ seriesId, source, chapterId = null }) {
  const query = supabase
    .from('comments')
    .select(`
      *,
      comment_likes(count)
    `)
    .eq('series_id', seriesId)
    .eq('source', source)
    .eq('is_deleted', false)
    .is('parent_id', null)
    .order('created_at', { ascending: false })

  if (chapterId) {
    query.eq('chapter_id', chapterId)
  } else {
    query.is('chapter_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  
  // Add placeholder user data until tables are created
  const commentsWithUsers = (data || []).map(comment => ({
    ...comment,
    user: {
      id: comment.user_id,
      email: 'user@example.com',
      user_metadata: {}
    },
    likes: comment.comment_likes || [{ count: 0 }],
    replies: [{ count: 0 }]
  }))
  
  return commentsWithUsers
}

// Fetch replies for a comment
export async function fetchReplies(parentId) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      comment_likes(count)
    `)
    .eq('parent_id', parentId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  
  // Add placeholder user data until tables are created
  const repliesWithUsers = (data || []).map(reply => ({
    ...reply,
    user: {
      id: reply.user_id,
      email: 'user@example.com',
      user_metadata: {}
    },
    likes: reply.comment_likes || [{ count: 0 }]
  }))
  
  return repliesWithUsers
}

// Post a new comment
export async function postComment({ seriesId, source, chapterId, content, parentId = null }) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: auth.user.id,
      series_id: seriesId,
      source,
      chapter_id: chapterId,
      content,
      parent_id: parentId
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update a comment
export async function updateComment({ commentId, content }) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('comments')
    .update({ 
      content, 
      updated_at: new Date().toISOString(),
      is_edited: true 
    })
    .eq('id', commentId)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete a comment (soft delete)
export async function deleteComment(commentId) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', commentId)
    .eq('user_id', auth.user.id)

  if (error) throw error
}

// Like/Unlike a comment
export async function toggleCommentLike(commentId) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) throw new Error('Not authenticated')

  // Check if already liked
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', auth.user.id)
    .single()

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('id', existing.id)
    if (error) throw error
    return false
  } else {
    // Like
    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: auth.user.id })
    if (error) throw error
    return true
  }
}

// Check if user liked a comment
export async function checkUserLiked(commentIds) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return {}

  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .in('comment_id', commentIds)
    .eq('user_id', auth.user.id)

  if (error) return {}
  return Object.fromEntries((data || []).map(d => [d.comment_id, true]))
}

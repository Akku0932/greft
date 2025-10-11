import { supabase } from './supabaseClient'

// Fetch comments for a series or chapter
export async function fetchComments({ seriesId, source, chapterId = null }) {
  // First, try to fetch comments without foreign key joins
  const query = supabase
    .from('comments')
    .select('*')
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

  const { data: comments, error } = await query
  if (error) throw error
  
  if (!comments || comments.length === 0) {
    return []
  }

  // Get current user info
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch likes count for each comment
  const commentIds = comments.map(c => c.id)
  const { data: likesData } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .in('comment_id', commentIds)
  
  // Count likes per comment
  const likesCount = {}
  if (likesData) {
    likesData.forEach(like => {
      likesCount[like.comment_id] = (likesCount[like.comment_id] || 0) + 1
    })
  }

  // Fetch replies count for each comment
  const { data: repliesData } = await supabase
    .from('comments')
    .select('parent_id')
    .in('parent_id', commentIds)
    .eq('is_deleted', false)
  
  // Count replies per comment
  const repliesCount = {}
  if (repliesData) {
    repliesData.forEach(reply => {
      repliesCount[reply.parent_id] = (repliesCount[reply.parent_id] || 0) + 1
    })
  }

  // Format comments with user data and counts
  const formattedComments = comments.map(comment => ({
    ...comment,
    user: {
      id: comment.user_id,
      email: user?.email || 'user@example.com',
      user_metadata: user?.user_metadata || {}
    },
    likes: [{ count: likesCount[comment.id] || 0 }],
    replies: [{ count: repliesCount[comment.id] || 0 }]
  }))

  return formattedComments
}

// Fetch replies for a comment
export async function fetchReplies(parentId) {
  const { data: replies, error } = await supabase
    .from('comments')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  
  if (!replies || replies.length === 0) {
    return []
  }

  // Get current user info
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch likes count for each reply
  const replyIds = replies.map(r => r.id)
  const { data: likesData } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .in('comment_id', replyIds)
  
  // Count likes per reply
  const likesCount = {}
  if (likesData) {
    likesData.forEach(like => {
      likesCount[like.comment_id] = (likesCount[like.comment_id] || 0) + 1
    })
  }

  // Format replies with user data and counts
  const formattedReplies = replies.map(reply => ({
    ...reply,
    user: {
      id: reply.user_id,
      email: user?.email || 'user@example.com',
      user_metadata: user?.user_metadata || {}
    },
    likes: [{ count: likesCount[reply.id] || 0 }]
  }))

  return formattedReplies
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

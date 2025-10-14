import { supabase } from './supabaseClient'

// Fetch comments for a series or chapter - VERSION 2.0
export async function fetchComments({ seriesId, source, chapterId = null }) {
  try {
    console.log('V2.0 FETCH - seriesId:', seriesId, 'source:', source, 'chapterId:', chapterId)
    
    // Simple, clean query
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('series_id', String(seriesId))
      .eq('source', source)
      .order('created_at', { ascending: false })
    
    console.log('V2.0 QUERY RESULT:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching comments:', error)
      return []
    }
    
    // Return the comments with proper user_name
    const result = (data || []).map(comment => ({
      ...comment,
      user_name: comment.user_name || 'User'
    }))
    
    console.log('V2.0 RESULT:', result)
    return result
  } catch (err) {
    console.error('Failed to fetch comments:', err)
    return []
  }
}

// Add a new comment
export async function addComment({ seriesId, source, chapterId, content, parentId = null }) {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) throw new Error('Not authenticated')
    
    // Fetch current display name from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()
    
    const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    
    console.log('Adding comment with data:', {
      user_id: user.id,
      series_id: seriesId,
      source,
      chapter_id: chapterId,
      content: content.trim(),
      user_name: displayName
    })
    
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        series_id: seriesId,
        source,
        chapter_id: chapterId,
        parent_id: parentId,
        content: content.trim(),
        user_name: displayName
      })
      .select('*')
      .single()
    
    if (error) {
      console.error('Error adding comment:', error)
      throw error
    }
    
    // Return the basic comment data
    const transformedData = {
      ...data,
      user_name: data.user_name || 'User'
    }
    
    console.log('Comment added successfully:', transformedData)
    return transformedData
  } catch (err) {
    console.error('Failed to add comment:', err)
    throw err
  }
}

// Update a comment
export async function updateComment({ commentId, content }) {
  try {
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
      .select('*')
      .single()
    
    if (error) {
      console.error('Error updating comment:', error)
      throw error
    }
    
    // Return the basic comment data
    const transformedData = {
      ...data,
      user_name: data.user_name || 'User'
    }
    
    return transformedData
  } catch (err) {
    console.error('Failed to update comment:', err)
    throw err
  }
}

// Delete a comment
export async function deleteComment({ commentId }) {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) throw new Error('Not authenticated')
    
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Error deleting comment:', error)
      throw error
    }
  } catch (err) {
    console.error('Failed to delete comment:', err)
    throw err
  }
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

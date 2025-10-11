import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { 
  fetchComments, 
  addComment, 
  updateComment, 
  deleteComment, 
  toggleCommentLike,
  getCommentLikes,
  isCommentLiked 
} from '../lib/commentsApi'

export default function CommentsSection({ seriesId, source, chapterId = null, title = "Comments" }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingComment, setEditingComment] = useState(null)
  const [editContent, setEditContent] = useState('')
  const textareaRef = useRef(null)

  // Load comments
  useEffect(() => {
    loadComments()
  }, [seriesId, source, chapterId])

  const loadComments = async () => {
    try {
      setLoading(true)
      const data = await fetchComments({ seriesId, source, chapterId })
      setComments(data)
    } catch (err) {
      setError('Failed to load comments')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    try {
      const comment = await addComment({
        seriesId,
        source,
        chapterId,
        content: newComment,
        parentId: replyingTo
      })
      
      setComments(prev => [comment, ...prev])
      setNewComment('')
      setReplyingTo(null)
    } catch (err) {
      setError('Failed to add comment')
      console.error(err)
    }
  }

  const handleEditComment = async (commentId) => {
    if (!editContent.trim()) return

    try {
      const updatedComment = await updateComment({
        commentId,
        content: editContent
      })
      
      setComments(prev => prev.map(c => 
        c.id === commentId ? updatedComment : c
      ))
      setEditingComment(null)
      setEditContent('')
    } catch (err) {
      setError('Failed to update comment')
      console.error(err)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return

    try {
      await deleteComment({ commentId })
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      setError('Failed to delete comment')
      console.error(err)
    }
  }

  const handleLikeComment = async (commentId) => {
    if (!user) return

    try {
      const result = await toggleCommentLike({ commentId })
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, likes_count: c.likes_count + (result.liked ? 1 : -1) }
          : c
      ))
    } catch (err) {
      console.error(err)
    }
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    
    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const getAvatarUrl = (comment) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user_name)}&background=random&color=fff&size=40`
  }

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-white dark:bg-gray-900 rounded-xl border border-stone-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-6 w-32 bg-stone-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-stone-200 dark:bg-gray-700 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-stone-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-full bg-stone-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-stone-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 p-6 bg-white dark:bg-gray-900 rounded-xl border border-stone-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white">{title}</h3>
        <span className="px-2 py-1 bg-stone-100 dark:bg-gray-800 text-stone-600 dark:text-gray-400 text-sm rounded-full">
          {comments.length}
        </span>
      </div>

      {/* Add Comment Form */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
        <div className="flex gap-3">
          <img 
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User')}&background=random&color=fff&size=40`}
            alt="Your avatar"
            className="h-10 w-10 rounded-full object-cover"
          />
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Share your thoughts..."}
                className="w-full p-3 border border-stone-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="3"
                required
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {replyingTo && (
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      Replying to comment
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {replyingTo && (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-sm text-stone-500 hover:text-stone-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {replyingTo ? 'Reply' : 'Comment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-stone-50 dark:bg-gray-800 rounded-lg text-center">
          <p className="text-stone-600 dark:text-gray-400 mb-3">Sign in to join the conversation</p>
          <a 
            href="/login" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-stone-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              user={user}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
              onLike={handleLikeComment}
              onReply={setReplyingTo}
              formatTimeAgo={formatTimeAgo}
              getAvatarUrl={getAvatarUrl}
            />
          ))
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment, user, onEdit, onDelete, onLike, onReply, formatTimeAgo, getAvatarUrl }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [likesCount, setLikesCount] = useState(comment.likes_count || 0)
  const [isLiked, setIsLiked] = useState(false)

  const handleEdit = () => {
    if (editContent.trim()) {
      onEdit(comment.id, editContent)
      setIsEditing(false)
    }
  }

  const handleLike = () => {
    onLike(comment.id)
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1)
    setIsLiked(!isLiked)
  }

  const isOwner = user && user.id === comment.user_id

  return (
    <div className="flex gap-3 group">
      <img 
        src={getAvatarUrl(comment)}
        alt={comment.user_name}
        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        {/* Comment Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-stone-900 dark:text-white">{comment.user_name}</span>
          <span className="text-sm text-stone-500 dark:text-gray-400">{formatTimeAgo(comment.created_at)}</span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-stone-400 dark:text-gray-500">(edited)</span>
          )}
        </div>

        {/* Comment Content */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 border border-stone-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-stone-900 dark:text-white resize-none"
              rows="3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditContent(comment.content)
                }}
                className="px-3 py-1 bg-stone-200 dark:bg-gray-700 text-stone-700 dark:text-gray-300 text-sm rounded hover:bg-stone-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-stone-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
            
            {/* Comment Actions */}
            <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleLike}
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                <svg className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
              
              {user && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-sm text-stone-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  Reply
                </button>
              )}
              
              {isOwner && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-stone-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="text-sm text-stone-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

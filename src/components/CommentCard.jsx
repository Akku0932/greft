import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchReplies, toggleCommentLike, updateComment, deleteComment } from '../lib/commentsApi'
import CommentInput from './CommentInput'

export default function CommentCard({ 
  comment, 
  onUpdate, 
  onDelete, 
  isReply = false,
  level = 0 
}) {
  const { user } = useAuth()
  const [replies, setReplies] = useState([])
  const [showReplies, setShowReplies] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(comment.likes?.[0]?.count || 0)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwnComment = user?.id === comment.user_id
  const canReply = level < 2 // Max 2 levels deep
  const hasReplies = comment.replies?.[0]?.count > 0

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date()
    const commentDate = new Date(date)
    const diffMs = now - commentDate
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return commentDate.toLocaleDateString()
  }

  // Get user display name and avatar
  const getUserInfo = () => {
    const metadata = comment.user?.user_metadata || {}
    const email = comment.user?.email || ''
    const name = metadata.display_name || metadata.name || email.split('@')[0] || 'Anonymous'
    const avatar = metadata.avatar_url || metadata.picture || ''
    
    return { name, avatar, email }
  }

  const { name, avatar, email } = getUserInfo()

  // Generate avatar initials
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Load replies
  const loadReplies = async () => {
    if (replies.length > 0) return
    
    try {
      const repliesData = await fetchReplies(comment.id)
      setReplies(repliesData)
    } catch (error) {
      console.error('Failed to load replies:', error)
    }
  }

  // Handle like/unlike
  const handleLike = async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      const liked = await toggleCommentLike(comment.id)
      setIsLiked(liked)
      setLikeCount(prev => liked ? prev + 1 : Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to toggle like:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle edit
  const handleEdit = async (newContent) => {
    try {
      setIsLoading(true)
      const updatedComment = await updateComment({ 
        commentId: comment.id, 
        content: newContent 
      })
      onUpdate(updatedComment)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update comment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    
    try {
      setIsDeleting(true)
      await deleteComment(comment.id)
      onDelete(comment.id)
    } catch (error) {
      console.error('Failed to delete comment:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle reply
  const handleReply = async (content) => {
    try {
      setIsLoading(true)
      // This will be handled by parent component
      setShowReplyInput(false)
      // Refresh replies
      await loadReplies()
    } catch (error) {
      console.error('Failed to post reply:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle replies visibility
  const toggleReplies = async () => {
    if (!showReplies) {
      await loadReplies()
    }
    setShowReplies(!showReplies)
  }

  return (
    <div className={`group ${isReply ? 'ml-8 border-l-2 border-stone-200 dark:border-gray-700 pl-4' : ''}`}>
      {/* Main Comment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatar ? (
              <img 
                src={avatar} 
                alt={name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {getInitials(name)}
              </div>
            )}
          </div>

          {/* User info and content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-stone-900 dark:text-white text-sm">
                {name}
              </span>
              <span className="text-xs text-stone-500 dark:text-gray-400">
                {formatTimeAgo(comment.created_at)}
              </span>
              {comment.is_edited && (
                <span className="text-xs text-stone-400 dark:text-gray-500 italic">
                  (edited)
                </span>
              )}
            </div>

            {/* Comment content */}
            {isEditing ? (
              <CommentInput
                initialValue={comment.content}
                onSubmit={handleEdit}
                onCancel={() => setIsEditing(false)}
                placeholder="Edit your comment..."
                isLoading={isLoading}
              />
            ) : (
              <p className="text-stone-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-4 text-xs">
            {/* Like button */}
            <button
              onClick={handleLike}
              disabled={!user || isLoading}
              className={`flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200 ${
                isLiked 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                  : 'hover:bg-stone-100 dark:hover:bg-gray-700 text-stone-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-3 h-3" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            {/* Reply button */}
            {canReply && user && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-gray-700 text-stone-600 dark:text-gray-400 transition-all duration-200"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply
              </button>
            )}

            {/* Edit/Delete buttons (own comments only) */}
            {isOwnComment && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-gray-700 text-stone-600 dark:text-gray-400 transition-all duration-200"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2 py-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all duration-200 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Show replies button */}
        {hasReplies && !showReplies && (
          <button
            onClick={toggleReplies}
            className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            View {comment.replies[0].count} {comment.replies[0].count === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Reply input */}
      {showReplyInput && user && (
        <div className="mt-3 ml-11">
          <CommentInput
            onSubmit={handleReply}
            onCancel={() => setShowReplyInput(false)}
            placeholder={`Reply to ${name}...`}
            isReply={true}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isReply={true}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

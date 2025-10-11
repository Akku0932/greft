import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchComments, postComment } from '../lib/commentsApi'
import CommentCard from './CommentCard'
import CommentInput from './CommentInput'

export default function CommentSection({ 
  seriesId, 
  source, 
  chapterId = null, 
  title = "Comments" 
}) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPosting, setIsPosting] = useState(false)

  // Load comments
  const loadComments = async () => {
    try {
      setLoading(true)
      setError(null)
      const commentsData = await fetchComments({ seriesId, source, chapterId })
      setComments(commentsData)
    } catch (err) {
      console.error('Failed to load comments:', err)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [seriesId, source, chapterId])

  // Handle new comment submission
  const handleSubmitComment = async (content) => {
    try {
      setIsPosting(true)
      const newComment = await postComment({
        seriesId,
        source,
        chapterId,
        content
      })
      
      // Add user info to the new comment
      const commentWithUser = {
        ...newComment,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata
        },
        likes: [{ count: 0 }],
        replies: [{ count: 0 }]
      }
      
      setComments(prev => [commentWithUser, ...prev])
    } catch (err) {
      console.error('Failed to post comment:', err)
      throw err
    } finally {
      setIsPosting(false)
    }
  }

  // Handle comment update
  const handleCommentUpdate = (updatedComment) => {
    setComments(prev => 
      prev.map(comment => 
        comment.id === updatedComment.id ? updatedComment : comment
      )
    )
  }

  // Handle comment deletion
  const handleCommentDelete = (commentId) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId))
  }

  // Empty state
  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-4">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">No comments yet</h3>
      <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">
        Be the first to share your thoughts about this {chapterId ? 'chapter' : 'series'}!
      </p>
      {!user && (
        <a 
          href="/login" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          Sign in to comment
        </a>
      )}
    </div>
  )

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-gray-700 animate-pulse"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-stone-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-3 w-16 bg-stone-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="h-20 bg-stone-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-gray-700 animate-pulse"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 w-32 bg-stone-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-3 w-20 bg-stone-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="h-16 bg-stone-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-3">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">Failed to load comments</h3>
        <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadComments}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-gray-700 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">{title}</h2>
          <p className="text-sm text-stone-600 dark:text-gray-400">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </p>
        </div>
      </div>

      {/* Comment input */}
      <CommentInput
        onSubmit={handleSubmitComment}
        placeholder={`Share your thoughts about this ${chapterId ? 'chapter' : 'series'}...`}
        isLoading={isPosting}
      />

      {/* Comments list */}
      {comments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onUpdate={handleCommentUpdate}
              onDelete={handleCommentDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

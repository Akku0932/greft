import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function CommentInput({ 
  onSubmit, 
  onCancel, 
  placeholder = "Write a comment...", 
  initialValue = "",
  isReply = false,
  isLoading = false 
}) {
  const { user } = useAuth()
  const [content, setContent] = useState(initialValue)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef(null)
  const maxLength = 500

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim() || isLoading) return
    
    try {
      await onSubmit(content.trim())
      setContent('')
      setIsFocused(false)
    } catch (error) {
      console.error('Failed to submit comment:', error)
    }
  }

  const handleCancel = () => {
    setContent('')
    setIsFocused(false)
    if (onCancel) onCancel()
  }

  if (!user) {
    return (
      <div className="bg-stone-50 dark:bg-gray-800 rounded-lg p-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-3">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">Sign in to comment</h3>
        <p className="text-sm text-stone-600 dark:text-gray-400 mb-4">Join the discussion and share your thoughts</p>
        <a 
          href="/login" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign In
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className={`relative transition-all duration-200 ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-gray-400"
          rows={isReply ? 2 : 3}
          disabled={isLoading}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-2 right-2 text-xs text-stone-400 dark:text-gray-500">
          {content.length}/{maxLength}
        </div>
      </div>

      {/* Action buttons */}
      {(isFocused || content.trim()) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-stone-600 dark:text-gray-400 hover:text-stone-800 dark:hover:text-gray-200 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
            )}
          </div>
          
          <button
            type="submit"
            disabled={!content.trim() || isLoading || content.length > maxLength}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Posting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {isReply ? 'Reply' : 'Comment'}
              </>
            )}
          </button>
        </div>
      )}
    </form>
  )
}

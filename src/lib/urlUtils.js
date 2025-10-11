// Universal URL utilities for consistent routing across all sources

/**
 * Generate a universal Info page URL
 * @param {string} seriesId - The series ID
 * @param {string} titleId - The title ID (optional)
 * @param {string} source - The source ('mf', 'gf', 'mp')
 * @returns {string} - Universal Info URL
 */
export function getInfoUrl(seriesId, titleId = '', source = 'gf') {
  if (!seriesId) return '/'
  
  const encodedSeriesId = encodeURIComponent(seriesId)
  const encodedTitleId = titleId ? encodeURIComponent(titleId) : ''
  
  // Always use the format: /info/seriesId/titleId?src=source
  // If no titleId, use: /info/seriesId?src=source
  if (encodedTitleId) {
    return `/info/${encodedSeriesId}/${encodedTitleId}?src=${source}`
  } else {
    return `/info/${encodedSeriesId}?src=${source}`
  }
}

/**
 * Generate a universal Read page URL
 * @param {string} chapterId - The chapter ID
 * @param {string} seriesId - The series ID (optional)
 * @param {string} titleId - The title ID (optional)
 * @param {string} source - The source ('mf', 'gf', 'mp')
 * @returns {string} - Universal Read URL
 */
export function getReadUrl(chapterId, seriesId = '', titleId = '', source = 'gf') {
  if (!chapterId) return '/'
  
  const encodedChapterId = encodeURIComponent(chapterId)
  const encodedSeriesId = seriesId ? encodeURIComponent(seriesId) : ''
  const encodedTitleId = titleId ? encodeURIComponent(titleId) : ''
  
  // Build query parameters
  const params = new URLSearchParams()
  if (encodedSeriesId) params.set('series', encodedSeriesId)
  if (encodedTitleId) params.set('title', encodedTitleId)
  params.set('src', source)
  
  const queryString = params.toString()
  
  // Always use the format: /read/chapterId?series=seriesId&title=titleId&src=source
  return `/read/${encodedChapterId}${queryString ? `?${queryString}` : ''}`
}

/**
 * Parse URL parameters to extract series info
 * @param {string} url - The current URL
 * @returns {object} - Parsed parameters
 */
export function parseUrlParams(url = '') {
  try {
    const urlObj = new URL(url, window.location.origin)
    const params = urlObj.searchParams
    
    return {
      seriesId: params.get('series') || '',
      titleId: params.get('title') || '',
      source: params.get('src') || 'gf',
      chapterId: urlObj.pathname.split('/').pop() || ''
    }
  } catch {
    return {
      seriesId: '',
      titleId: '',
      source: 'gf',
      chapterId: ''
    }
  }
}

/**
 * Normalize a URL to the universal format
 * @param {string} url - The URL to normalize
 * @param {string} source - The source ('mf', 'gf', 'mp')
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url, source = 'gf') {
  try {
    const urlObj = new URL(url, window.location.origin)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    
    if (pathParts[0] === 'info') {
      const seriesId = pathParts[1] || ''
      const titleId = pathParts[2] || ''
      return getInfoUrl(seriesId, titleId, source)
    } else if (pathParts[0] === 'read') {
      const chapterId = pathParts[1] || ''
      const seriesId = urlObj.searchParams.get('series') || ''
      const titleId = urlObj.searchParams.get('title') || ''
      return getReadUrl(chapterId, seriesId, titleId, source)
    }
    
    return url
  } catch {
    return url
  }
}

/**
 * Get the canonical URL for a series (for sharing/bookmarking)
 * @param {string} seriesId - The series ID
 * @param {string} titleId - The title ID (optional)
 * @param {string} source - The source ('mf', 'gf', 'mp')
 * @returns {string} - Canonical URL
 */
export function getCanonicalUrl(seriesId, titleId = '', source = 'gf') {
  return getInfoUrl(seriesId, titleId, source)
}

/**
 * Get the canonical URL for a chapter (for sharing/bookmarking)
 * @param {string} chapterId - The chapter ID
 * @param {string} seriesId - The series ID
 * @param {string} titleId - The title ID (optional)
 * @param {string} source - The source ('mf', 'gf', 'mp')
 * @returns {string} - Canonical URL
 */
export function getCanonicalChapterUrl(chapterId, seriesId, titleId = '', source = 'gf') {
  return getReadUrl(chapterId, seriesId, titleId, source)
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, getImage, parseIdTitle, sanitizeTitleId, pickImage } from '../lib/api.js'
import { upsertProgress } from '../lib/progressApi'
import { upsertRecentRead } from '../lib/recentReadsApi'
import { getReadUrl, getInfoUrl } from '../lib/urlUtils'

export default function Read() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Read Page Test - React Hooks Import Added
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          ID: {id}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          Source: {searchParams.get('src') || 'none'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          Series: {searchParams.get('series') || 'none'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          Title: {searchParams.get('title') || 'none'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          API imported: {api ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          ProgressAPI imported: {upsertProgress ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          RecentReadsAPI imported: {upsertRecentRead ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          URLUtils imported: {getReadUrl && getInfoUrl ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          API Functions imported: {getImage && parseIdTitle && sanitizeTitleId && pickImage ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-600 dark:text-gray-300">
          React Hooks imported: {useCallback && useEffect && useMemo && useRef && useState ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  )
}

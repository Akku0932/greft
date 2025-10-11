import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { upsertProgress } from '../lib/progressApi'
import { upsertRecentRead } from '../lib/recentReadsApi'

export default function Read() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Read Page Test - RecentReadsAPI Import Added
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
      </div>
    </div>
  )
}

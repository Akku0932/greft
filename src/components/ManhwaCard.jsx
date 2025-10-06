import { Link } from 'react-router-dom'
import { getImage, pickImage, sanitizeTitleId, parseIdTitle } from '../lib/api.js'

export default function ManhwaCard({ item }) {
  const cover = getImage(pickImage(item))
  const title = item?.title || item?.name || 'Untitled'
  const combined = item?.id || item?._id || item?.slug || item?.urlId
  const parsed = parseIdTitle(combined, item?.titleId || item?.slug)
  const id = parsed.id
  const titleId = sanitizeTitleId(parsed.titleId || 'title')

  return (
    <Link to={`/info/${encodeURIComponent(id)}/${encodeURIComponent(titleId)}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-stone-200 shadow-soft">
        {cover && (
          <img src={cover} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}
      </div>
      <div className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-brand-600">{title}</div>
    </Link>
  )
}



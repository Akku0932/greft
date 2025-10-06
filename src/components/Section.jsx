import ManhwaCard from './ManhwaCard.jsx'

export default function Section({ title, items, loading, error }) {
  if (error) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
        <div className="text-red-600">{String(error)}</div>
      </section>
    )
  }
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {loading ? Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse aspect-[3/4] rounded-lg bg-stone-200" />
        )) : items?.map((item) => (
          <ManhwaCard key={item.id || item.slug || item.title} item={item} />
        ))}
      </div>
    </section>
  )
}



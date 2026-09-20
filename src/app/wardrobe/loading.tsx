export default function Loading() {
  return (
    <div className="pt-8">
      <div className="shimmer h-9 w-56 rounded-soft" />
      <div className="shimmer mt-6 h-12 w-full rounded-full" />
      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="shimmer aspect-[3/4] rounded-card" />
        ))}
      </ul>
    </div>
  )
}

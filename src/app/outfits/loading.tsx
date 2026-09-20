export default function Loading() {
  return (
    <div className="pt-8">
      <div className="shimmer h-9 w-44 rounded-soft" />
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="shimmer h-40 rounded-card" />
        ))}
      </ul>
    </div>
  )
}

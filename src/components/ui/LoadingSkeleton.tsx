export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse">
          <div className="h-4 bg-elevated rounded w-3/4 mb-3" />
          <div className="h-3 bg-elevated rounded w-1/2 mb-2" />
          <div className="h-3 bg-elevated rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-surface border border-border rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

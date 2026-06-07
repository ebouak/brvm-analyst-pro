export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-40 bg-surface border border-border rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl h-24 animate-pulse" />
        ))}
      </div>
      <div className="bg-surface border border-border rounded-xl h-64 animate-pulse" />
    </div>
  );
}

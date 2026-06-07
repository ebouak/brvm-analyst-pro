export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-surface border border-border rounded-xl animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

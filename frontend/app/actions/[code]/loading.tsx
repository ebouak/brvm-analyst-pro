export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto">
      <div className="h-8 w-64 bg-surface border border-border rounded-xl animate-pulse" />
      <div className="bg-surface border border-border rounded-xl p-5 h-40 animate-pulse" />
      <div className="bg-surface border border-border rounded-xl h-[420px] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl h-32 animate-pulse" />
        <div className="bg-surface border border-border rounded-xl h-32 animate-pulse" />
      </div>
    </div>
  );
}

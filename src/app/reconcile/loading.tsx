export default function ReconcileLoading() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      <div className="pb-4 border-b border-[#d4af37]/20">
        <div className="h-6 w-48 bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-96 gold-glass-panel rounded-2xl" />
        <div className="h-96 gold-glass-panel rounded-2xl" />
      </div>
    </div>
  );
}

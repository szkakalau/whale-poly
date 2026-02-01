export default function Loading() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-32 pb-24">
        <div className="mb-8 animate-pulse">
          <div className="h-4 w-24 bg-white/10 rounded-full mb-3" />
          <div className="h-8 w-64 bg-white/10 rounded-full mb-2" />
          <div className="h-6 w-40 bg-white/10 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
            >
              <div className="h-3 w-16 bg-white/10 rounded-full" />
              <div className="h-6 w-24 bg-white/20 rounded-full" />
              <div className="h-3 w-20 bg-white/10 rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 h-40" />
          <div className="rounded-2xl border border-white/10 bg-white/5 h-40" />
        </div>
      </div>
    </div>
  );
}


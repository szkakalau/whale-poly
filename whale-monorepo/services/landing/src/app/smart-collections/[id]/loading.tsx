export default function Loading() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>
      <div className="mx-auto max-w-5xl px-6 pt-32 pb-24 space-y-8">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-32 rounded-full bg-white/10" />
          <div className="h-9 w-80 rounded bg-white/10" />
          <div className="h-4 w-[28rem] rounded bg-white/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="h-6 w-28 rounded bg-white/10" />
              <div className="h-3 w-24 rounded bg-white/10" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse space-y-4">
          <div className="h-4 w-52 rounded bg-white/10" />
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="h-4 w-44 rounded bg-white/10" />
              <div className="h-4 w-20 rounded bg-white/10" />
              <div className="h-4 w-20 rounded bg-white/10" />
              <div className="h-4 w-16 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


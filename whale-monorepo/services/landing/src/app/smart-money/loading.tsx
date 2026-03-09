export default function Loading() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-15%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-32 pb-24 space-y-8">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded-full bg-white/10" />
          <div className="h-8 w-72 rounded-full bg-white/10" />
          <div className="h-4 w-96 rounded-full bg-white/10" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="h-3 w-64 rounded bg-white/10" />
            </div>
            <div className="h-8 w-44 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4 animate-pulse">
            <div className="h-4 w-64 rounded bg-white/10" />
          </div>
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="h-4 w-44 rounded bg-white/10" />
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-4 w-16 rounded bg-white/10" />
                <div className="h-4 w-24 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


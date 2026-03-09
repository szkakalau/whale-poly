'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error;
  }, [error]);

  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-6">
          <div className="text-lg font-semibold text-white">Failed to load Smart Money</div>
          <div className="text-sm text-gray-300 mt-2">
            Please refresh or try again in a moment.
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-gray-100 hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}


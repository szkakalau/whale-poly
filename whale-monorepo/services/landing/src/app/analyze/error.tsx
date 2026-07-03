'use client';

export default function AnalyzeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-lg font-semibold text-neutral-800">
        Something went wrong
      </h2>
      <p className="text-sm text-neutral-500">
        {error.message || 'An unexpected error occurred while loading the analysis page.'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

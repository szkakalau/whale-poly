'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-6xl font-bold font-display text-accent/20 mb-4">!</p>
      <h1 className="text-2xl sm:text-3xl font-semibold font-display mb-3">
        Something went wrong
      </h1>
      <p className="text-muted max-w-md mb-8">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="btn-primary text-sm px-6 py-3"
      >
        Try again
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

export default function FullAccessGating({
  children,
  hasFullAccess,
  title = 'Detailed Analysis Restricted',
  description = 'Upgrade to Pro or Elite to access advanced 30D performance metrics, top markets, and behavioral patterns.',
}: {
  children: React.ReactNode;
  hasFullAccess: boolean;
  title?: string;
  description?: string;
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (hasFullAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-md pointer-events-none select-none opacity-50 overflow-hidden">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/5 rounded-2xl">
        <div className="text-center p-8 rounded-2xl bg-surface/95 border border-accent-primary/30 shadow-2xl backdrop-blur-sm mx-4">
          <div className="w-12 h-12 bg-accent-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent-primary/50">
            <Lock className="w-6 h-6 text-accent-secondary" aria-hidden />
          </div>
          <h3 className="font-display text-xl font-bold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted mb-6 max-w-xs mx-auto">{description}</p>
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="px-8 py-3 rounded-full bg-accent-primary hover:bg-accent-hover text-white text-sm font-semibold transition-all shadow-[0_8px_28px_oklch(0.62_0.17_220_/_0.35)]"
          >
            Upgrade to Unlock
          </button>
        </div>
      </div>
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Unlock Polymarket Whale Intelligence"
        description="Get deep insights into whale behavior, performance, and real-time alerts. Upgrade to Pro for full access."
        feature="Polymarket Whale Intelligence"
      />
    </div>
  );
}

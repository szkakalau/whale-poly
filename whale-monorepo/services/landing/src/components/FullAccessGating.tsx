'use client';

import { useState } from 'react';
import UpgradeModal from './UpgradeModal';

export default function FullAccessGating({ 
  children, 
  hasFullAccess,
  title = 'Detailed Analysis Restricted',
  description = 'Upgrade to Pro or Elite to access advanced 30D performance metrics, top markets, and behavioral patterns.'
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
      <div className="blur-md pointer-events-none select-none opacity-50 overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/5 rounded-2xl">
        <div className="text-center p-8 rounded-2xl bg-[#0a0a0a]/90 border border-violet-500/30 shadow-2xl backdrop-blur-sm mx-4">
          <div className="w-12 h-12 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-500/50">
            <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            {description}
          </p>
          <button 
            onClick={() => setShowUpgrade(true)}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/20"
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

'use client';

import React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: string;
}

export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  title = "Upgrade to Unlock", 
  description = "This feature is only available on Pro and Elite plans.",
  feature
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md glass rounded-[2rem] border border-white/10 p-8 shadow-2xl animate-scale-in overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -z-10"></div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-gray-500 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-white mb-3 tracking-tight">{title}</h2>
          
          {feature && (
            <div className="inline-block px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-4">
              {feature}
            </div>
          )}

          <p className="text-gray-400 font-light leading-relaxed mb-8">
            {description}
          </p>

          <div className="grid gap-3">
            <Link 
              href="/subscribe?plan=pro"
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-violet-600 text-white font-black text-center shadow-[0_10px_30px_rgba(139,92,246,0.3)] hover:bg-violet-500 transition-all hover:-translate-y-1 active:scale-95"
            >
              Upgrade to Pro — $29/mo
            </Link>
            
            <Link 
              href="/subscribe?plan=elite"
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-center hover:bg-white/10 transition-all"
            >
              Go Elite — $59/mo
            </Link>
          </div>

          <button 
            onClick={onClose}
            className="mt-6 text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

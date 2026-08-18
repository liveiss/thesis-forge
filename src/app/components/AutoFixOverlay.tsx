'use client';

import { RefreshCw, Wand2 } from 'lucide-react';

interface AutoFixOverlayProps {
  stage: string;
}

export default function AutoFixOverlay({ stage }: AutoFixOverlayProps) {
  if (!stage) return null;

  return (
    <div className="fixed inset-0 z-40 bg-theme-backdrop backdrop-blur-sm flex items-center justify-center">
      <div className="bg-theme-overlay border border-theme-medium rounded-2xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <Wand2 size={22} className="text-cyan-400" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-theme-secondary mb-1">自动修正闭环</p>
          <p className="text-xs text-theme-dim flex items-center gap-2 justify-center">
            <RefreshCw size={12} className="animate-spin text-cyan-400" />
            {stage}
          </p>
        </div>
      </div>
    </div>
  );
}

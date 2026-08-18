'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">出错了</h1>
        <p className="text-sm text-theme-muted mb-2">
          页面加载时遇到了问题，请尝试刷新。
        </p>
        {error.digest && (
          <p className="text-xs text-theme-dim font-mono mb-8">错误 ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} />
            重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-theme-surface-3 hover:bg-theme-surface-5 border border-theme-subtle text-theme-secondary text-sm font-medium transition-colors"
          >
            <Home size={16} />
            回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

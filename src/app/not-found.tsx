'use client';

import { FileQuestion, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-theme-base flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-theme-surface-3 border border-theme-subtle flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-8 h-8 text-theme-muted" />
        </div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">页面不存在</h1>
        <p className="text-sm text-theme-muted mb-8">
          你访问的页面可能被删除、移动，或者本来就不存在。
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          返回首页
        </Link>
      </div>
    </div>
  );
}

'use client';

import { RefreshCw, Wand2 } from 'lucide-react';
import type { ThesisIssue } from '../../types';

interface IssueCardProps {
  issue: ThesisIssue;
  fixing: boolean;
  fixStage: string;
  onFix: () => void;
}

const severityMeta: Record<string, { label: string; dot: string; border: string; bg: string }> = {
  high: {
    label: '严重',
    dot: 'bg-red-500',
    border: 'border-red-500/15',
    bg: 'bg-red-500/[0.03]',
  },
  medium: {
    label: '中等',
    dot: 'bg-amber-500',
    border: 'border-amber-500/15',
    bg: 'bg-amber-500/[0.03]',
  },
  low: {
    label: '轻微',
    dot: 'bg-green-500',
    border: 'border-green-500/15',
    bg: 'bg-green-500/[0.03]',
  },
};

export default function IssueCard({
  issue,
  fixing,
  fixStage,
  onFix,
}: IssueCardProps) {
  const meta = severityMeta[issue.severity] || severityMeta.low;

  return (
    <div
      className={`rounded-xl border ${meta.border} ${meta.bg} p-3.5 mb-2 transition-all hover:border-opacity-30`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        <span className="text-[11px] font-semibold text-theme-tertiary">
          {meta.label}
        </span>
        <span className="text-[11px] text-theme-dim">·</span>
        <span className="text-[11px] text-theme-muted">{issue.category}</span>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="text-xs text-theme-tertiary leading-relaxed">
          <span className="text-theme-dim mr-1">证据：</span>
          {issue.evidence}
        </div>
        <div className="text-xs text-theme-muted leading-relaxed">
          <span className="text-theme-dim mr-1">建议：</span>
          {issue.suggestion}
        </div>
      </div>

      {issue.startSnippet && (
        <button
          onClick={onFix}
          disabled={fixing}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
          {fixing ? (
            <>
              <RefreshCw size={10} className="animate-spin" />
              {fixStage || '修正中...'}
            </>
          ) : (
            <>
              <Wand2 size={10} />
              一键修正
            </>
          )}
        </button>
      )}
    </div>
  );
}

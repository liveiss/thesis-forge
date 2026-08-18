'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Wand2, CheckCircle2 } from 'lucide-react';
import type { DiagnosticDimension, ThesisDiagnostic } from '../../types';
import { DIMENSION_CONFIG } from '../../types';
import IssueCard from './IssueCard';
import ScoreRing from './ScoreRing';

interface DimensionPanelProps {
  diagnostic: ThesisDiagnostic;
  dimensionLabels: Record<DiagnosticDimension, string>;
  fixingIssueId: string | null;
  fixStage: string;
  onFixIssue: (dim: DiagnosticDimension, issueIndex: number, issue: ThesisDiagnostic[DiagnosticDimension]['issues'][number]) => void;
  onFixAll: (dim: DiagnosticDimension) => void;
}

const dimOrder: DiagnosticDimension[] = ['aiTrace', 'consistency', 'logic', 'format', 'academic'];

const dimIcons: Record<DiagnosticDimension, string> = {
  aiTrace: '🤖',
  consistency: '🔗',
  logic: '🧠',
  format: '📐',
  academic: '🎓',
};

export default function DimensionPanel({
  diagnostic,
  dimensionLabels,
  fixingIssueId,
  fixStage,
  onFixIssue,
  onFixAll,
}: DimensionPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (dim: string) => {
    setExpanded(prev => ({ ...prev, [dim]: !prev[dim] }));
  };

  return (
    <div className="space-y-2">
      {dimOrder.map(dim => {
        const d = diagnostic[dim];
        const cfg = DIMENSION_CONFIG[dim];
        const isOpen = expanded[dim] ?? true;
        const hasIssues = d.issues.length > 0;
        const isBatchFixing = fixingIssueId === `batch-${dim}`;

        return (
          <div
            key={dim}
            className="rounded-xl border border-theme-subtle bg-theme-panel overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggle(dim)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-theme-surface-2 transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={14} className="text-theme-dim shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-theme-dim shrink-0" />
              )}

              <span className="text-sm shrink-0">{dimIcons[dim]}</span>
              <span className="text-sm font-medium text-theme-secondary shrink-0">
                {dimensionLabels[dim] || cfg.label}
              </span>

              <div className="ml-1">
                <ScoreRing score={d.score} size={28} strokeWidth={3} showLabel={false} />
              </div>

              {!hasIssues && (
                <span className="flex items-center gap-1 text-[11px] text-green-400 ml-auto">
                  <CheckCircle2 size={12} />
                  未发现问题
                </span>
              )}

              {hasIssues && d.issues.length >= 2 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onFixAll(dim);
                  }}
                  disabled={!!fixingIssueId}
                  className="ml-auto text-[11px] px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 flex items-center gap-1 transition-colors shrink-0"
                >
                  {isBatchFixing ? (
                    <>
                      <RefreshCw size={10} className="animate-spin" />
                      {fixStage || '修正中...'}
                    </>
                  ) : (
                    <>
                      <Wand2 size={10} />
                      全部修正 ({d.issues.length})
                    </>
                  )}
                </button>
              )}

              {hasIssues && d.issues.length === 1 && (
                <span className="ml-auto text-[11px] text-theme-dim">
                  1 个问题
                </span>
              )}
            </button>

            {/* Issues */}
            {isOpen && hasIssues && (
              <div className="px-4 pb-3 pt-1 space-y-1">
                {d.issues.map((issue, i) => (
                  <IssueCard
                    key={`${dim}-${i}`}
                    issue={issue}
                    fixing={fixingIssueId === `${dim}-${i}`}
                    fixStage={fixStage}
                    onFix={() => onFixIssue(dim, i, issue)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { Search, RefreshCw, Eye, EyeOff, FileText } from 'lucide-react';
import type { ThesisSection, ThesisDiagnostic, ThesisReport, DiagnosticDimension } from '../../types';
import { highlightCitationSentences } from '../../lib/citations';
import DimensionPanel from './DimensionPanel';
import ScoreRing from './ScoreRing';

interface EditorViewProps {
  section: ThesisSection;
  diagnostic: ThesisDiagnostic | null;
  diagnosticLoading: boolean;
  dimensionLabels: Record<DiagnosticDimension, string>;
  thesisReport: ThesisReport | null;
  thesisDetectLoading: boolean;
  autoFixStage: string;
  highlightMode: boolean;
  showDiagnostics: boolean;
  fixingIssueId: string | null;
  fixStage: string;
  onDetect: () => void;
  onDetectAll: () => void;
  onShowReport: () => void;
  onToggleHighlight: () => void;
  onToggleDiagnostics: () => void;
  onFixIssue: (dim: DiagnosticDimension, issueIndex: number, issue: ThesisDiagnostic[DiagnosticDimension]['issues'][number]) => void;
  onFixAll: (dim: DiagnosticDimension) => void;
}

const scoreColorClass = (score: number) => {
  if (score >= 85) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
};

const dimLabels: Record<string, string> = {
  aiTrace: 'AI痕迹',
  consistency: '一致性',
  logic: '逻辑',
  format: '格式',
  academic: '规范',
};

export default function EditorView({
  section,
  diagnostic,
  diagnosticLoading,
  dimensionLabels,
  thesisReport,
  thesisDetectLoading,
  autoFixStage,
  highlightMode,
  showDiagnostics,
  fixingIssueId,
  fixStage,
  onDetect,
  onDetectAll,
  onShowReport,
  onToggleHighlight,
  onToggleDiagnostics,
  onFixIssue,
  onFixAll,
}: EditorViewProps) {
  const isBusy = diagnosticLoading || !!autoFixStage;
  const contentRef = useRef<HTMLDivElement>(null);

  const baseHtml = section.content
    .split('\n\n')
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      if (/<img[^>]*>/i.test(trimmed)) {
        return `<p class="my-4 text-center">${trimmed}</p>`;
      }
      return `<p class="mb-4">${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    container.querySelectorAll('mark.citation-sentence').forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });

    if (!highlightMode) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    for (const node of textNodes) {
      const highlighted = highlightCitationSentences(node.data);
      if (highlighted === node.data) continue;

      const wrapper = document.createElement('span');
      wrapper.innerHTML = highlighted;
      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
      node.parentNode?.replaceChild(fragment, node);
    }
  }, [section.content, highlightMode]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-theme-page">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-theme-subtle flex items-center gap-3 shrink-0">
        <button
          onClick={onDetect}
          disabled={isBusy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 disabled:opacity-30 text-cyan-200 text-xs font-semibold border border-cyan-500/15 transition-all"
        >
          {isBusy ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              {autoFixStage || '检测中...'}
            </>
          ) : (
            <>
              <Search size={13} />
              五维度检测
            </>
          )}
        </button>

        <button
          onClick={onDetectAll}
          disabled={isBusy || thesisDetectLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-surface-3 hover:bg-theme-surface-5 disabled:opacity-30 text-theme-tertiary text-xs font-semibold border border-theme-subtle transition-all"
        >
          {thesisDetectLoading ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              全文检测中...
            </>
          ) : (
            <>
              <FileText size={13} />
              全文检测
            </>
          )}
        </button>

        {thesisReport && !isBusy && !thesisDetectLoading && (
          <button
            onClick={onShowReport}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg text-cyan-300 bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-colors"
          >
            <FileText size={12} />
            全文报告 {thesisReport.overallScore}分
          </button>
        )}

        <button
          onClick={onToggleHighlight}
          disabled={isBusy || thesisDetectLoading}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg text-theme-muted hover:text-cyan-300 hover:bg-cyan-500/5 disabled:opacity-40 transition-colors"
        >
          {highlightMode ? <EyeOff size={12} /> : <Eye size={12} />}
          {highlightMode ? '关闭引用高亮' : '开启引用高亮'}
        </button>

        {diagnostic && !isBusy && (
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-theme-dim">综合</span>
              <span className={`text-sm font-bold ${scoreColorClass(diagnostic.overallScore)}`}>
                {diagnostic.overallScore}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(['aiTrace', 'consistency', 'logic', 'format', 'academic'] as const).map(dim => (
                <ScoreRing
                  key={dim}
                  score={diagnostic[dim].score}
                  size={32}
                  strokeWidth={3}
                  label={dimensionLabels[dim] || dimLabels[dim]}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Diagnostic Summary Bar */}
      {diagnostic && !isBusy && (
        <button
          onClick={onToggleDiagnostics}
          className="px-5 py-2.5 bg-theme-panel border-b border-theme-subtle flex items-center gap-2 hover:bg-theme-surface-1 transition-colors"
        >
          <Search size={12} className="text-cyan-400" />
          <span className="text-xs text-theme-muted">
            检测报告 — 综合
            <span className={`font-bold ml-1 ${scoreColorClass(diagnostic.overallScore)}`}>
              {diagnostic.overallScore}分
            </span>
          </span>
          <span className="text-[11px] text-theme-faint ml-2">
            {diagnostic.aiTrace.issues.length + diagnostic.consistency.issues.length + diagnostic.logic.issues.length + diagnostic.format.issues.length + diagnostic.academic.issues.length} 个问题
          </span>
          <span className="ml-auto text-theme-faint text-xs">
            {showDiagnostics ? '收起' : '展开'}
          </span>
        </button>
      )}

      {/* Diagnostic Panel */}
      {showDiagnostics && diagnostic && !isBusy && (
        <div className="px-5 py-3 bg-theme-panel border-b border-theme-subtle max-h-[320px] overflow-y-auto shrink-0">
          <DimensionPanel
            diagnostic={diagnostic}
            dimensionLabels={dimensionLabels}
            fixingIssueId={fixingIssueId}
            fixStage={fixStage}
            onFixIssue={onFixIssue}
            onFixAll={onFixAll}
          />
        </div>
      )}

      {/* Loading State */}
      {isBusy && !diagnostic && (
        <div className="px-5 py-3 bg-theme-panel border-b border-theme-subtle flex items-center gap-2 shrink-0">
          <RefreshCw size={12} className="animate-spin text-cyan-400" />
          <span className="text-xs text-theme-muted">{autoFixStage || '正在检测...'}</span>
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-6">
            <span className="text-[10px] uppercase tracking-wider text-theme-faint font-medium">
              {section.type}
            </span>
            <h2 className="text-xl font-bold text-theme-primary mt-1 font-sans">
              {section.title}
            </h2>
          </div>
          {/* Content with image support */}
          <div
            ref={contentRef}
            className="text-sm text-theme-tertiary leading-[1.8]"
            style={{ fontFamily: 'serif' }}
            dangerouslySetInnerHTML={{
              __html: baseHtml,
            }}
          />
        </div>
      </div>
    </div>
  );
}

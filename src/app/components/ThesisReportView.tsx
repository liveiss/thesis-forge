'use client';

import { X } from 'lucide-react';
import type { ThesisReport, ThesisSection, ThesisIssue, DiagnosticDimension } from '../../types';
import { getMaterialTemplate } from '../../lib/templates';
import ScoreRing from './ScoreRing';

interface ThesisReportViewProps {
  report: ThesisReport;
  sections: ThesisSection[];
  onClose: () => void;
}

const dimOrder: DiagnosticDimension[] = ['aiTrace', 'consistency', 'logic', 'format', 'academic'];

const scoreColorClass = (score: number) => {
  if (score >= 85) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
};

const severityMeta: Record<string, { label: string; dot: string; border: string }> = {
  high: { label: '严重', dot: 'bg-red-500', border: 'border-red-500/15' },
  medium: { label: '中等', dot: 'bg-amber-500', border: 'border-amber-500/15' },
  low: { label: '轻微', dot: 'bg-green-500', border: 'border-green-500/15' },
};

function IssueSection({
  title,
  issues,
  emptyText,
}: {
  title: string;
  issues: ThesisIssue[];
  emptyText: string;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-secondary">{title}</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-theme-surface-4 text-theme-dim">
          {issues.length} 个
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="text-xs text-theme-faint bg-theme-surface-2 border border-theme-subtle rounded-xl px-4 py-3">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, i) => {
            const meta = severityMeta[issue.severity] || severityMeta.low;
            return (
              <div
                key={i}
                className={`border ${meta.border} bg-theme-surface-2 rounded-xl p-4`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span className="text-[11px] font-semibold text-theme-tertiary">
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-theme-dim">·</span>
                  <span className="text-[11px] text-theme-muted">
                    {issue.category || '未分类'}
                  </span>
                </div>
                <p className="text-xs text-theme-tertiary leading-relaxed mb-1.5">
                  {issue.evidence}
                </p>
                <p className="text-xs text-theme-muted leading-relaxed">
                  {issue.suggestion}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ThesisReportView({
  report,
  sections,
  onClose,
}: ThesisReportViewProps) {
  const hasSectionScores = Object.keys(report.sectionScores).length > 0;
  const template = getMaterialTemplate(report.materialType);

  return (
    <div
      className="fixed inset-0 z-50 bg-theme-backdrop backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-card border border-theme-medium rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-theme-card/95 backdrop-blur border-b border-theme-subtle px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-theme-primary">全文检测报告</h2>
            <p className="text-[11px] text-theme-faint mt-0.5">
              {new Date(report.timestamp).toLocaleString('zh-CN')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-theme-dim hover:text-theme-tertiary hover:bg-theme-surface-4 transition-colors"
            title="关闭报告"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center gap-5">
            <ScoreRing score={report.overallScore} size={72} strokeWidth={6} showLabel={false} />
            <div className="flex-1 min-w-0">
              <div className={`text-2xl font-bold ${scoreColorClass(report.overallScore)}`}>
                {report.overallScore}
                <span className="text-xs text-theme-faint ml-1">/ 100</span>
              </div>
              <p className="text-xs text-theme-muted leading-relaxed mt-1.5">
                {report.summary || '本次全文检测未生成总结。'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-7">
            {dimOrder.map(dim => {
              const d = report[dim];
              return (
                <div
                  key={dim}
                  className="bg-theme-surface-2 border border-theme-subtle rounded-xl p-3 flex flex-col items-center gap-1"
                >
                  <ScoreRing score={d.score} size={44} strokeWidth={4} showLabel={false} />
                  <span className="text-[11px] text-theme-dim font-medium mt-1">
                    {template.dimensions[dim].label}
                  </span>
                  <span className="text-[10px] text-theme-faint">
                    {d.issues.length} 个问题
                  </span>
                </div>
              );
            })}
          </div>

          <section className="mt-7">
            <h3 className="text-sm font-semibold text-theme-secondary mb-3">章节评分</h3>
            {!hasSectionScores ? (
              <p className="text-xs text-theme-faint bg-theme-surface-2 border border-theme-subtle rounded-xl px-4 py-3">
                全文检测未返回章节评分。
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map(s => {
                  const score = report.sectionScores[s.id];
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-theme-surface-2 border border-theme-subtle rounded-xl px-4 py-2.5"
                    >
                      <span className="text-xs text-theme-muted truncate mr-3">{s.title}</span>
                      <span className={`text-xs font-bold shrink-0 ${score === undefined ? 'text-theme-faint' : scoreColorClass(score)}`}>
                        {score === undefined ? '未评分' : `${score}分`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <IssueSection
            title="跨章节问题"
            issues={report.crossSectionIssues}
            emptyText="未发现明显的跨章节矛盾或数据不一致。"
          />

          <IssueSection
            title="引用与编号问题"
            issues={report.referenceIssues}
            emptyText="未发现明显的引用格式或编号问题。"
          />
        </div>
      </div>
    </div>
  );
}

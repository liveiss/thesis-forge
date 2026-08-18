'use client';

import { ArrowLeft, RotateCcw, FileText, ChevronRight, FileType, FileSpreadsheet, CreditCard } from 'lucide-react';
import type { ThesisProject, ThesisDiagnostic } from '../../types';

interface SectionSidebarProps {
  project: ThesisProject;
  selectedSectionId: string;
  diagnostics: Record<string, ThesisDiagnostic>;
  userPhone?: string;
  userPlan?: string;
  detectCount?: number;
  onSelectSection: (id: string) => void;
  onExportTxt: () => void;
  onExportDocx: () => void;
  onBackToHome: () => void;
  onReset: () => void;
  onOpenPricing: () => void;
}

const typeLabels: Record<string, string> = {
  abstract: '摘要',
  intro: '引言',
  lit_review: '综述',
  method: '方法',
  result: '结果',
  discussion: '讨论',
  conclusion: '结论',
  reference: '参考文献',
  other: '其他',
};

const scoreColorClass = (score?: number) => {
  if (score === undefined) return 'text-theme-faint';
  if (score >= 85) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
};

export default function SectionSidebar({
  project,
  selectedSectionId,
  diagnostics,
  userPhone,
  userPlan,
  detectCount,
  onSelectSection,
  onExportTxt,
  onExportDocx,
  onBackToHome,
  onReset,
  onOpenPricing,
}: SectionSidebarProps) {
  const totalWords = project.sections.reduce((s, sec) => s + sec.wordCount, 0);

  return (
    <aside className="w-64 border-r border-theme-subtle bg-theme-card flex flex-col shrink-0">
      {/* Back to Home */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-xs text-theme-dim hover:text-cyan-300 transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          返回首页
        </button>
      </div>

      {/* Project Header */}
      <div className="px-4 pb-4 border-b border-theme-subtle">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <FileText size={14} className="text-cyan-400" />
          </div>
          <h2 className="text-sm font-bold text-theme-primary truncate flex-1">
            {project.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-theme-dim">
          <span>{project.sections.length} 节</span>
          <span>·</span>
          <span>{totalWords.toLocaleString()} 字</span>
        </div>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto py-2">
        {project.sections.map((s, i) => {
          const diag = diagnostics[s.id];
          const isActive = s.id === selectedSectionId;

          return (
            <button
              key={s.id}
              onClick={() => onSelectSection(s.id)}
              className={`w-full text-left px-4 py-2.5 group transition-all border-l-2 ${
                isActive
                  ? 'border-cyan-500 bg-cyan-500/[0.05]'
                  : 'border-transparent hover:bg-theme-surface-2'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono w-5 text-center ${
                    isActive ? 'text-cyan-400' : 'text-theme-faint'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-medium truncate ${
                      isActive ? 'text-theme-primary' : 'text-theme-muted group-hover:text-theme-tertiary'
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-theme-faint">
                      {typeLabels[s.type] || '其他'} · {s.wordCount} 字
                    </span>
                    {diag && (
                      <span className={`text-[10px] font-medium ${scoreColorClass(diag.overallScore)}`}>
                        {diag.overallScore}分
                      </span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <ChevronRight size={12} className="text-cyan-500 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="px-3 py-3 border-t border-theme-subtle space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportDocx}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/10 text-cyan-300 transition-colors"
          >
            <FileSpreadsheet size={13} />
            Word
          </button>
          <button
            onClick={onExportTxt}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-theme-surface-4 hover:bg-theme-surface-8 text-theme-tertiary transition-colors"
          >
            <FileType size={13} />
            文本
          </button>
        </div>
        <button
          onClick={onOpenPricing}
          className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/10 text-cyan-300 transition-colors"
        >
          <CreditCard size={13} />
          {userPlan === 'season' ? '查看套餐' : '升级套餐'}
        </button>
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-theme-surface-4 hover:bg-theme-surface-8 text-theme-muted transition-colors"
        >
          <RotateCcw size={13} />
          重置项目
        </button>

        {userPhone && (
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-[10px] text-theme-faint">{userPhone}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-surface-4 text-theme-dim">
              {userPlan === 'free'
                ? `免费(${detectCount}/1)`
                : userPlan === 'season'
                  ? '通行证'
                  : userPlan}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Clock,
  FileText,
  Trash2,
  History,
  Loader2,
} from 'lucide-react';
import type { ProjectMeta } from '../../lib/db';
import { useTheme } from './ThemeProvider';

interface ProjectSidebarProps {
  projects: ProjectMeta[];
  loading: boolean;
  currentProjectTitle?: string;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function ProjectSidebar({
  projects,
  loading,
  currentProjectTitle,
  onLoadProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDeleteProject(id);
    setDeletingId(null);
  };

  return (
    <aside className="w-72 border-r border-theme-subtle bg-theme-card flex flex-col shrink-0 h-screen sticky top-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-theme-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <History size={15} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-theme-primary">你的项目</h2>
            <p className="text-[10px] text-theme-faint mt-0.5">
              {loading ? '加载中...' : `${projects.length} 个项目`}
            </p>
          </div>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="text-theme-faint animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${resolvedTheme === 'light' ? 'bg-slate-100 border border-slate-200' : 'bg-theme-surface-2 border border-theme-subtle'}`}>
              <FolderOpen size={20} className="text-theme-ghost" />
            </div>
            <p className="text-xs text-theme-faint mb-1">暂无历史项目</p>
            <p className="text-[11px] text-theme-ghost leading-relaxed">
              导入或检测论文后，项目会自动保存到这里
            </p>
          </div>
        ) : (
          projects.map((proj) => {
            const isActive = proj.title === currentProjectTitle;
            const isHovered = hoveredId === proj.id;
            const isDeleting = deletingId === proj.id;

            return (
              <button
                key={proj.id}
                onClick={() => onLoadProject(proj.id)}
                onMouseEnter={() => setHoveredId(proj.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={isDeleting}
                className={`w-full text-left px-4 py-3 mx-2 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-cyan-500/10 border border-cyan-500/15'
                    : 'hover:bg-theme-surface-3 border border-transparent'
                }`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-cyan-400" />
                )}

                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-cyan-500/15'
                        : 'bg-theme-surface-3 group-hover:bg-theme-surface-5'
                    }`}
                  >
                    <FileText
                      size={13}
                      className={isActive ? 'text-cyan-400' : 'text-theme-dim'}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-theme-secondary truncate pr-5">
                      {proj.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-theme-faint flex items-center gap-1">
                        <Clock size={9} />
                        {formatTimeAgo(proj.updatedAt)}
                      </span>
                      <span className="text-[10px] text-theme-ghost">
                        {proj.sectionCount} 节 · {proj.wordCount.toLocaleString()} 字
                      </span>
                    </div>
                  </div>

                  {/* Delete button on hover */}
                  {(isHovered || isActive) && (
                    <button
                      onClick={(e) => handleDelete(proj.id, e)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-theme-faint hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="删除项目"
                    >
                      {isDeleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-theme-subtle">
        <p className="text-[10px] text-theme-ghost leading-relaxed">
          项目数据存储在本地，登录后可同步到云端
        </p>
      </div>
    </aside>
  );
}

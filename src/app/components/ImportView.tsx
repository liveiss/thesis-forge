'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  Settings,
  Sparkles,
  Shield,
  Brain,
  FileCheck,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight,
  Lock,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import type { ApiConfig } from '../../types';
import { extractDocxText, extractDocxSections } from '../../lib/utils';
import { MATERIAL_TEMPLATES } from '../../lib/templates';
import ProjectSidebar from './ProjectSidebar';
import type { ProjectMeta } from '../../lib/db';
import { useTheme } from './ThemeProvider';

interface ImportViewProps {
  user: { phone: string; plan: string } | null;
  apiConfig: ApiConfig;
  projectTitle: string;
  selectedMaterialType: string;
  inputText: string;
  showSettings: boolean;
  showLogin: boolean;
  projectHistory: ProjectMeta[];
  historyLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onToggleSettings: () => void;
  onApiChange: (cfg: ApiConfig) => void;
  onTitleChange: (title: string) => void;
  onMaterialTypeChange: (id: string) => void;
  onTextChange: (text: string) => void;
  onImport: () => void;
  onFileSelect: (text: string) => void;
  onDocxSectionsSelect?: (sections: { title: string; content: string; type: string }[]) => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenPricing: () => void;
}

const features = [
  {
    icon: Brain,
    title: 'AI 痕迹检测',
    desc: '识别套路化表达、机械句式与术语堆砌',
    light: { iconColor: 'text-cyan-600', bg: 'from-cyan-100 to-teal-100', border: 'border-cyan-200' },
    dark: { iconColor: 'text-cyan-400', bg: 'from-cyan-500/15 to-teal-500/15', border: 'border-cyan-500/20' },
  },
  {
    icon: Shield,
    title: '一致性审查',
    desc: '发现前后矛盾、数据冲突与定义偏差',
    light: { iconColor: 'text-amber-600', bg: 'from-amber-100 to-orange-100', border: 'border-amber-200' },
    dark: { iconColor: 'text-amber-400', bg: 'from-amber-500/15 to-orange-500/15', border: 'border-amber-500/20' },
  },
  {
    icon: Sparkles,
    title: '论证逻辑',
    desc: '排查因果断裂、循环论证与逻辑跳跃',
    light: { iconColor: 'text-rose-600', bg: 'from-rose-100 to-red-100', border: 'border-rose-200' },
    dark: { iconColor: 'text-rose-400', bg: 'from-rose-500/15 to-red-500/15', border: 'border-rose-500/20' },
  },
  {
    icon: FileCheck,
    title: '格式与规范',
    desc: '检查引用格式、学术表达与段落规范',
    light: { iconColor: 'text-blue-600', bg: 'from-blue-100 to-indigo-100', border: 'border-blue-200' },
    dark: { iconColor: 'text-blue-400', bg: 'from-blue-500/15 to-indigo-500/15', border: 'border-blue-500/20' },
  },
];

export default function ImportView({
  user,
  apiConfig,
  projectTitle,
  selectedMaterialType,
  inputText,
  showSettings,
  projectHistory,
  historyLoading,
  onLogin,
  onLogout,
  onToggleSettings,
  onApiChange,
  onTitleChange,
  onMaterialTypeChange,
  onTextChange,
  onImport,
  onFileSelect,
  onDocxSectionsSelect,
  onLoadProject,
  onDeleteProject,
  onOpenPricing,
}: ImportViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsingDocx, setParsingDocx] = useState(false);
  const dragCounter = useRef(0);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isDocx = (file: File) =>
    file.name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // ========== 全局阻止浏览器默认拖拽行为 ==========
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      // 只有 drop 到非 dropZone 区域时才阻止默认行为
      const dropZone = dropZoneRef.current;
      if (dropZone && !dropZone.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // ========== 文件处理 ==========
  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    if (isDocx(file)) {
      setParsingDocx(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (onDocxSectionsSelect) {
          const sections = await extractDocxSections(arrayBuffer);
          onDocxSectionsSelect(sections);
        } else {
          const text = await extractDocxText(arrayBuffer);
          onFileSelect(text);
        }
      } catch (err) {
        console.warn('[docx 解析失败]', err);
        alert('无法解析该 .docx 文件，请尝试另存为 .txt 后上传');
      } finally {
        setParsingDocx(false);
      }
      return;
    }

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        onFileSelect(text);
      };
      reader.readAsText(file, 'utf-8');
      return;
    }

    alert('不支持的文件格式，请上传 .txt 或 .docx 文件');
  }, [onFileSelect, onDocxSectionsSelect]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    // 重置 input 允许重复选择同一文件
    e.target.value = '';
  };

  // ========== Drop Zone 事件（用 counter 解决闪烁）==========
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const hasContent = inputText.trim().length > 0;
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-theme-base text-theme-primary relative overflow-hidden flex">
      {/* ===== Project Sidebar ===== */}
      <div className="w-72 shrink-0">
        <ProjectSidebar
          projects={projectHistory}
          loading={historyLoading}
          currentProjectTitle={projectTitle}
          onLoadProject={onLoadProject}
          onDeleteProject={onDeleteProject}
        />
      </div>

      {/* ===== Main Area ===== */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* ===== Background Effects ===== */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-500/[0.03] rounded-full blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute top-[45%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>

        {/* ===== Top Nav ===== */}
        <nav className="relative flex items-center justify-between px-8 py-5 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <FileText size={17} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-theme-primary">论文工坊</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-surface-4 text-theme-dim border border-theme-subtle">
            Beta
          </span>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-theme-dim hover:text-theme-muted hover:bg-theme-surface-4 transition-colors"
              title={resolvedTheme === 'dark' ? '切换到亮色' : '切换到暗色'}
            >
              {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className="text-xs text-theme-dim">{user.phone}</span>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/15 font-medium">
              {user.plan === 'free' ? '免费版' : user.plan === 'season' ? '通行证' : user.plan}
            </span>
            {user.plan !== 'season' && (
              <button
                onClick={onOpenPricing}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/15 transition-colors"
              >
                升级套餐
              </button>
            )}
            <button onClick={onLogout} className="text-theme-dim hover:text-theme-tertiary transition-colors p-1.5 rounded-lg hover:bg-theme-surface-4">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-theme-dim hover:text-theme-muted hover:bg-theme-surface-4 transition-colors"
              title={resolvedTheme === 'dark' ? '切换到亮色' : '切换到暗色'}
            >
              {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 text-sm text-theme-muted hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-theme-surface-4"
            >
              <UserIcon size={15} />
              登录
            </button>
            <button
              onClick={onOpenPricing}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/15 transition-colors"
            >
              开通套餐
            </button>
          </div>
        )}
      </nav>

        {/* ===== Main Content ===== */}
        <div className="relative z-10 flex-1 overflow-auto">
          <div className="max-w-6xl xl:max-w-7xl mx-auto px-8 pt-8 pb-20">

        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 ${resolvedTheme === 'light' ? 'bg-cyan-50 border border-cyan-200' : 'bg-theme-surface-3 border border-theme-subtle'}`}>
            <Zap size={12} className="text-cyan-400" />
            <span className="text-[11px] text-theme-muted">AI 驱动的论文质量检测与修正工具</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight mb-5">
            <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
              论文工坊
            </span>
          </h1>

          <p className="text-base text-theme-dim max-w-lg mx-auto leading-relaxed mb-2">
            五维度智能检测，一键修正闭环
          </p>
          <p className="text-sm text-theme-faint max-w-md mx-auto leading-relaxed">
            降 AI 率 · 逻辑审查 · 一致性检查 · 学术润色
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {features.map((f) => {
            const theme = resolvedTheme === 'light' ? f.light : f.dark;
            return (
              <div
                key={f.title}
                className={`group relative p-5 rounded-2xl bg-theme-card border ${theme.border} hover:bg-theme-surface-1 transition-all duration-300 hover:-translate-y-0.5 shadow-sm`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon size={18} className={theme.iconColor} />
                </div>
                <div className="text-sm font-semibold text-theme-secondary mb-1.5">{f.title}</div>
                <div className="text-[11px] text-theme-dim leading-relaxed">{f.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Upload Area */}
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-theme-surface-2 border border-theme-subtle">
              {MATERIAL_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => onMaterialTypeChange(template.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedMaterialType === template.id
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/15'
                      : 'text-theme-muted hover:text-theme-tertiary hover:bg-theme-surface-3 border border-transparent'
                  }`}
                >
                  <span>{template.label}</span>
                  <span className="text-[10px] opacity-70">{template.shortLabel}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-theme-faint mt-2">
              {MATERIAL_TEMPLATES.find(template => template.id === selectedMaterialType)?.description}
            </p>
          </div>

          {/* Title Input */}
          <div className="mb-4">
            <input
              value={projectTitle}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="输入论文标题（可选）"
              className={`w-full rounded-2xl px-5 py-3.5 text-sm outline-none transition-all placeholder:text-theme-faint ${resolvedTheme === 'light' ? 'bg-slate-50 border border-slate-200 focus:border-cyan-400 focus:bg-white' : 'bg-theme-card border border-theme-subtle focus:border-cyan-500/30 focus:bg-theme-surface-1'}`}
            />
          </div>

          {/* Text Area / Drop Zone */}
          <div
            ref={dropZoneRef}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${
              isDragging
                ? 'border-cyan-500/50 bg-cyan-500/[0.04] scale-[1.01]'
                : hasContent
                  ? 'border-theme-medium bg-theme-card'
                  : 'border-theme-medium bg-theme-card hover:border-theme-strong hover:bg-theme-surface-1'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <textarea
              value={inputText}
              onChange={e => onTextChange(e.target.value)}
              placeholder={isDragging ? '释放以上传文件' : parsingDocx ? '正在解析 Word 文档...' : '粘贴论文全文到此处，或拖拽 .txt / .docx 文件到上方'}
              className="w-full min-h-[240px] bg-transparent rounded-2xl px-6 py-5 text-sm outline-none resize-none placeholder:text-theme-faint leading-[1.8]"
            ></textarea>

            {/* Empty state hint */}
            {!hasContent && !isDragging && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${resolvedTheme === 'light' ? 'bg-cyan-50 border border-cyan-200' : 'bg-theme-surface-2 border border-theme-subtle'}`}>
                  <Upload size={24} className="text-theme-faint" />
                </div>
                <p className="text-sm text-theme-dim mb-1">拖拽文件到此处，或粘贴文本</p>
                <p className="text-xs text-theme-ghost">支持 .txt、.docx（Word / WPS）格式</p>
              </div>
            )}

            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-theme-base/50 rounded-2xl backdrop-blur-sm z-10">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
                    <Upload size={28} className="text-cyan-400" />
                  </div>
                  <span className="text-sm text-cyan-300 font-medium">释放以上传文件</span>
                </div>
              </div>
            )}
          </div>

          {/* Word Count */}
          {hasContent && (
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-xs text-theme-faint">
                {inputText.length.toLocaleString()} 字符
              </span>
              <button
                onClick={() => onTextChange('')}
                className="text-xs text-theme-faint hover:text-theme-muted transition-colors"
              >
                清空
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`px-5 py-3 rounded-xl text-sm flex items-center gap-2 transition-all ${resolvedTheme === 'light' ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 hover:border-cyan-300' : 'bg-theme-surface-3 hover:bg-theme-surface-6 text-theme-tertiary border border-theme-subtle hover:border-theme-medium'}`}
            >
              <Upload size={15} />
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={onImport}
              disabled={!hasContent}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-20 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/30 hover:brightness-110 disabled:hover:brightness-100"
            >
              <FileText size={15} />
              开始检测
              <ArrowRight size={14} className="opacity-70" />
            </button>
          </div>

          {/* API Config Toggle */}
          <div className="mt-8 pt-6 border-t border-theme-subtle">
            <button
              onClick={onToggleSettings}
              className="flex items-center gap-2 text-xs text-theme-faint hover:text-theme-muted transition-colors"
            >
              <Settings size={13} />
              <span>{showSettings ? '收起 API 配置' : '配置 API'}</span>
              {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showSettings && (
              <div className={`mt-4 rounded-2xl p-5 space-y-3 ${resolvedTheme === 'light' ? 'bg-slate-50 border border-slate-200' : 'bg-theme-surface-2 border border-theme-subtle'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={14} className="text-theme-dim" />
                  <span className="text-xs font-medium text-theme-muted">API 配置</span>
                </div>
                <input
                  value={apiConfig.baseUrl}
                  onChange={e => onApiChange({ ...apiConfig, baseUrl: e.target.value })}
                  placeholder="API Base URL（如 https://api.deepseek.com/v1）"
                  className="w-full bg-theme-surface-2 rounded-xl px-4 py-3 text-xs border border-theme-subtle focus:border-cyan-500/30 outline-none transition-colors placeholder:text-theme-ghost"
                />
                <input
                  value={apiConfig.apiKey}
                  onChange={e => onApiChange({ ...apiConfig, apiKey: e.target.value })}
                  placeholder="API Key（留空使用服务端密钥）"
                  type="password"
                  className="w-full bg-theme-surface-2 rounded-xl px-4 py-3 text-xs border border-theme-subtle focus:border-cyan-500/30 outline-none transition-colors placeholder:text-theme-ghost"
                />
                <input
                  value={apiConfig.model}
                  onChange={e => onApiChange({ ...apiConfig, model: e.target.value })}
                  placeholder="模型名（如 deepseek-chat）"
                  className="w-full bg-theme-surface-2 rounded-xl px-4 py-3 text-xs border border-theme-subtle focus:border-cyan-500/30 outline-none transition-colors placeholder:text-theme-ghost"
                />
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="mt-10 flex items-center justify-center gap-6 text-[11px] text-theme-ghost">
            <span className="flex items-center gap-1.5">
              <Lock size={11} />
              本地处理，数据安全
            </span>
            <span>·</span>
            <span>五维度智能检测</span>
            <span>·</span>
            <span>一键修正闭环</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  );
}

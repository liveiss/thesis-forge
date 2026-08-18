'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ApiConfig, ThesisProject, ThesisSection, ThesisDiagnostic, ThesisIssue, ThesisReport, DiagnosticDimension } from '../types';
import { fuzzyFindRange, countWords, generateDocx } from '../lib/utils';
import { getMaterialTemplate, getDimensionLabels, splitByTemplate, DEFAULT_MATERIAL_TEMPLATE_ID } from '../lib/templates';
import { maskCitations, restoreCitations } from '../lib/citations';
import { useAuth } from '../lib/auth';
import { saveProject, listProjects, deleteProject, getProject, restoreProject, type ProjectMeta } from '../lib/db';
import { useToast } from './components/ToastProvider';

import LoginModal from './components/LoginModal';
import ImportView from './components/ImportView';
import SectionSidebar from './components/SectionSidebar';
import EditorView from './components/EditorView';
import AutoFixOverlay from './components/AutoFixOverlay';
import ThesisReportView from './components/ThesisReportView';
import PricingModal, { type PlanId } from './components/PricingModal';

interface ThesisReportPayload {
  overallScore?: unknown;
  summary?: unknown;
  aiTrace?: { score?: unknown; issues?: unknown };
  consistency?: { score?: unknown; issues?: unknown };
  logic?: { score?: unknown; issues?: unknown };
  format?: { score?: unknown; issues?: unknown };
  academic?: { score?: unknown; issues?: unknown };
  sectionScores?: unknown;
  crossSectionIssues?: unknown;
  referenceIssues?: unknown;
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 100;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeIssues(value: unknown): ThesisIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(item => ({
      severity: item.severity === 'high' || item.severity === 'medium' || item.severity === 'low'
        ? item.severity
        : 'low',
      category: typeof item.category === 'string' ? item.category : '未分类',
      evidence: typeof item.evidence === 'string' ? item.evidence : '',
      suggestion: typeof item.suggestion === 'string' ? item.suggestion : '',
      startSnippet: typeof item.startSnippet === 'string' ? item.startSnippet : '',
    }));
}

function normalizeReportDimension(value: unknown): { score: number; issues: ThesisIssue[] } {
  const dim = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    score: clampScore(dim.score),
    issues: normalizeIssues(dim.issues),
  };
}

function normalizeSectionScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const scores: Record<string, number> = {};
  for (const [key, score] of Object.entries(value as Record<string, unknown>)) {
    scores[key] = clampScore(score);
  }
  return scores;
}

export default function Home() {
  const { error: toastError, warning: toastWarning } = useToast();

  // ========== 用户系统 ==========
  const { user, logout, canUse, recordUsage, updateUser } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // ========== API 配置 ==========
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
    apiKey: '',
    model: process.env.NEXT_PUBLIC_API_MODEL || '',
  });
  const [showSettings, setShowSettings] = useState(false);

  const callAi = useCallback(async (prompt: string, type: string): Promise<string | null> => {
    if (!apiConfig.baseUrl && !apiConfig.model) {
      toastWarning('请先配置 API Base URL 或模型');
      return null;
    }
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...apiConfig, prompt, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || `AI 请求失败（${res.status}）`;
        console.warn('[AI 请求失败]', message);
        toastError(message);
        return null;
      }
      const response = data.response?.trim();
      if (!response) {
        const message = data.error || 'AI 返回了空内容';
        console.warn('[AI 返回空内容]', message);
        toastError(message);
        return null;
      }
      return response;
    } catch (err) {
      console.warn('[AI 请求异常]', err);
      toastError('AI 请求失败，请检查网络或 API 配置');
      return null;
    }
  }, [apiConfig]);

  // ========== 论文数据 ==========
  const [project, setProject] = useState<ThesisProject | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [materialTemplateId, setMaterialTemplateId] = useState(DEFAULT_MATERIAL_TEMPLATE_ID);
  const materialTemplate = getMaterialTemplate(materialTemplateId);
  const dimensionLabels = getDimensionLabels(materialTemplate);

  // ========== 检测状态 ==========
  const [diagnostics, setDiagnostics] = useState<Record<string, ThesisDiagnostic>>({});
  const [thesisReport, setThesisReport] = useState<ThesisReport | null>(null);
  const [thesisDetectLoading, setThesisDetectLoading] = useState(false);
  const [showThesisReport, setShowThesisReport] = useState(false);
  const [showMobileSectionSidebar, setShowMobileSectionSidebar] = useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);
  const [fixStage, setFixStage] = useState('');
  const [autoFixStage, setAutoFixStage] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [highlightMode, setHighlightMode] = useState(true);
  const [rawText, setRawText] = useState('');

  // ========== 项目历史 ==========
  const [projectHistory, setProjectHistory] = useState<ProjectMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedSection = project?.sections.find(s => s.id === selectedSectionId);
  const currentDiagnostic = selectedSectionId ? diagnostics[selectedSectionId] : null;

  // ========== 加载历史项目列表 ==========
  const refreshHistory = useCallback(async () => {
    if (!user) {
      setProjectHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const list = await listProjects(user.id);
      setProjectHistory(list);
    } catch (e) {
      console.warn('[加载历史] 失败', e);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshHistory]);

  // ========== 自动保存 ==========
  const autoSave = useCallback(async () => {
    if (!project || !user) return;
    try {
      await saveProject(user.id, project, diagnostics, thesisReport);
      // 静默刷新历史列表（不触发 loading）
      const list = await listProjects(user.id);
      setProjectHistory(list);
    } catch (e) {
      console.warn('[自动保存] 失败', e);
    }
  }, [project, diagnostics, thesisReport, user]);

  // 防抖自动保存：project 或 diagnostics 变化后 2 秒保存
  useEffect(() => {
    if (!project) return;
    const timer = setTimeout(() => {
      autoSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [project, diagnostics, thesisReport, autoSave]);

  // ========== 加载历史项目 ==========
  const handleLoadProject = useCallback(async (projectId: string) => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const stored = await getProject(user.id, projectId);
      if (!stored) return;
      const { project: restoredProj, diagnostics: restoredDiag, report: restoredReport } = restoreProject(stored);
      setMaterialTemplateId(restoredProj.materialType || DEFAULT_MATERIAL_TEMPLATE_ID);
      setProject(restoredProj);
      setDiagnostics(restoredDiag);
      setThesisReport(restoredReport);
      if (restoredProj.sections.length > 0) {
        setSelectedSectionId(restoredProj.sections[0].id);
      }
      // 恢复输入区数据（方便再次导入）
      const fullText = restoredProj.sections.map(s => s.title + '\n' + s.content).join('\n\n');
      setInputText(fullText);
      setRawText(fullText);
      setProjectTitle(restoredProj.title);
    } catch (e) {
      console.warn('[加载项目] 失败', e);
      toastError('加载项目失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  // ========== 删除历史项目 ==========
  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!user) return;
    try {
      await deleteProject(user.id, projectId);
      setProjectHistory(prev => prev.filter(p => p.id !== projectId));
      // 如果当前打开的是被删除的项目，清空当前项目
      if (project?.title === projectHistory.find(p => p.id === projectId)?.title) {
        setProject(null);
        setSelectedSectionId('');
        setThesisReport(null);
        setShowThesisReport(false);
      }
    } catch (e) {
      console.warn('[删除项目] 失败', e);
      toastError('删除失败');
    }
  }, [user, project, projectHistory]);

  const handleSelectPlan = (plan: PlanId) => {
    if (!user) {
      setShowPricing(false);
      setShowLogin(true);
      return;
    }
    updateUser({ plan });
    setShowPricing(false);
  };

  // ========== 导入材料 ==========
  const handleImport = () => {
    if (!inputText.trim() && !rawText.trim()) return;
    const text = rawText || inputText;
    const sections = splitByTemplate(materialTemplateId, text);
    const thesisSections: ThesisSection[] = sections.map((s, i) => ({
      id: `sec_${i}_${Date.now()}`,
      title: s.title,
      type: s.type as ThesisSection['type'],
      content: s.content,
      wordCount: countWords(s.content),
    }));

    const newProject: ThesisProject = {
      materialType: materialTemplateId,
      title: projectTitle || (materialTemplateId === 'personal_statement' ? '个人陈述' : '未命名论文'),
      type: materialTemplate.defaultProject.type,
      major: materialTemplate.defaultProject.major,
      citationStyle: materialTemplate.defaultProject.citationStyle,
      wordLimit: materialTemplate.defaultProject.wordLimit,
      sections: thesisSections,
      references: [],
    };
    setProject(newProject);
    setDiagnostics({});
    setThesisReport(null);
    setShowThesisReport(false);
    if (thesisSections.length > 0) setSelectedSectionId(thesisSections[0].id);
  };

  // ========== 检测 ==========
  const runDiagnostic = async (section: ThesisSection): Promise<ThesisDiagnostic | null> => {
    if (!section.content || section.content.length < 100) return null;

    const prompt = `你是材料审阅专家。请对以下${materialTemplate.label}板块进行五维度检测，输出结构化诊断报告。

【板块标题】${section.title}
【板块内容】
${section.content.substring(0, 8000)}

=== 五维度检测要求 ===

${materialTemplate.dimensions.aiTrace.promptSection}

${materialTemplate.dimensions.consistency.promptSection}

${materialTemplate.dimensions.logic.promptSection}

${materialTemplate.dimensions.format.promptSection}

${materialTemplate.dimensions.academic.promptSection}

=== 输出格式 ===
请输出纯JSON（不要代码块标记）：
{
  "aiTrace": { "score": 0-100, "issues": [{ "severity": "high|medium|low", "category": "", "evidence": "原文片段", "suggestion": "修改建议", "startSnippet": "问题段落前15字" }] },
  "consistency": { "score": 0-100, "issues": [] },
  "logic": { "score": 0-100, "issues": [] },
  "format": { "score": 0-100, "issues": [] },
  "academic": { "score": 0-100, "issues": [] }
}
如果某维度没有问题，issues返回空数组，score给90-100。只输出纯JSON。`;

    try {
      const raw = await callAi(prompt, 'review');
      if (!raw) return null;
      const s = raw.indexOf('{');
      const e = raw.lastIndexOf('}');
      if (s === -1 || e === -1) return null;

      const parsed = JSON.parse(raw.substring(s, e + 1));
      const diag: ThesisDiagnostic = {
        id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sectionId: section.id,
        timestamp: Date.now(),
        aiTrace: { score: parsed.aiTrace?.score ?? 100, issues: parsed.aiTrace?.issues || [] },
        consistency: { score: parsed.consistency?.score ?? 100, issues: parsed.consistency?.issues || [] },
        logic: { score: parsed.logic?.score ?? 100, issues: parsed.logic?.issues || [] },
        format: { score: parsed.format?.score ?? 100, issues: parsed.format?.issues || [] },
        academic: { score: parsed.academic?.score ?? 100, issues: parsed.academic?.issues || [] },
        overallScore: Math.round([
          parsed.aiTrace?.score ?? 100,
          parsed.consistency?.score ?? 100,
          parsed.logic?.score ?? 100,
          parsed.format?.score ?? 100,
          parsed.academic?.score ?? 100,
        ].reduce((a, b) => a + b, 0) / 5),
      };

      setDiagnostics(prev => ({ ...prev, [section.id]: diag }));
      return diag;
    } catch (err) {
      console.warn('[检测] 失败', err);
      return null;
    }
  };

  // ========== 整篇检测 ==========
  const runThesisDiagnostic = async (): Promise<ThesisReport | null> => {
    if (!project || project.sections.length === 0) return null;

    const MAX_SECTION_CHARS = 4000;
    const MAX_TOTAL_CHARS = 35000;
    const sectionBlocks = project.sections.map((s, i) => {
      const content = s.content.length > MAX_SECTION_CHARS
        ? `${s.content.slice(0, MAX_SECTION_CHARS)}\n[该章节内容过长，已截断]`
        : s.content;
      return `【章节${i + 1}】${s.title}\n${content}`;
    }).join('\n\n').slice(0, MAX_TOTAL_CHARS);

    const structure = project.sections
      .map((s, i) => `${i + 1}. ${s.title} (${s.id})`)
      .join('\n');

    const prompt = `你是材料审阅专家。请对整篇${materialTemplate.label}做全文审查，${materialTemplate.fullReviewFocus}

【材料信息】
标题：${project.title}
材料类型：${materialTemplate.label}
专业：${project.major || '未填写'}
引用格式：${project.citationStyle}
字数限制：${project.wordLimit}

【材料结构】
${structure}

【材料全文】
${sectionBlocks}

=== 全文检测要求 ===
1. 对五个维度分别给出全文综合评分：
- ${materialTemplate.dimensions.aiTrace.label}：${materialTemplate.dimensions.aiTrace.promptSection}
- ${materialTemplate.dimensions.consistency.label}：${materialTemplate.dimensions.consistency.promptSection}
- ${materialTemplate.dimensions.logic.label}：${materialTemplate.dimensions.logic.promptSection}
- ${materialTemplate.dimensions.format.label}：${materialTemplate.dimensions.format.promptSection}
- ${materialTemplate.dimensions.academic.label}：${materialTemplate.dimensions.academic.promptSection}
2. sectionScores 为每个板块ID给出 0-100 评分。
3. crossSectionIssues 只放跨板块问题，包括前后矛盾、定义冲突、数据不一致。
4. referenceIssues 只放引用、参考文献、编号、附件清单相关的问题。
5. summary 用 2-4 句话概括全文最需要处理的问题。

=== 输出格式 ===
请输出纯JSON（不要代码块标记）：
{
  "overallScore": 0-100,
  "summary": "2-4句话",
  "aiTrace": { "score": 0-100, "issues": [{ "severity": "high|medium|low", "category": "", "evidence": "原文片段", "suggestion": "修改建议", "startSnippet": "问题段落前15字" }] },
  "consistency": { "score": 0-100, "issues": [] },
  "logic": { "score": 0-100, "issues": [] },
  "format": { "score": 0-100, "issues": [] },
  "academic": { "score": 0-100, "issues": [] },
  "sectionScores": { "章节ID": 0-100 },
  "crossSectionIssues": [],
  "referenceIssues": []
}
如果某维度没有问题，issues返回空数组，score给90-100。只输出纯JSON。`;

    try {
      const raw = await callAi(prompt, 'thesis');
      if (!raw) return null;
      const s = raw.indexOf('{');
      const e = raw.lastIndexOf('}');
      if (s === -1 || e === -1) return null;

      const parsed = JSON.parse(raw.substring(s, e + 1)) as Partial<ThesisReportPayload>;
      const report: ThesisReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        materialType: materialTemplateId,
        timestamp: Date.now(),
        overallScore: clampScore(parsed.overallScore),
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        aiTrace: normalizeReportDimension(parsed.aiTrace),
        consistency: normalizeReportDimension(parsed.consistency),
        logic: normalizeReportDimension(parsed.logic),
        format: normalizeReportDimension(parsed.format),
        academic: normalizeReportDimension(parsed.academic),
        sectionScores: normalizeSectionScores(parsed.sectionScores),
        crossSectionIssues: normalizeIssues(parsed.crossSectionIssues),
        referenceIssues: normalizeIssues(parsed.referenceIssues),
      };

      setThesisReport(report);
      setShowThesisReport(true);
      return report;
    } catch (err) {
      console.warn('[整篇检测] 失败', err);
      return null;
    }
  };

  const handleDetectAll = async () => {
    if (!project || thesisDetectLoading) return;
    if (user && !canUse('detect')) {
      toastWarning('免费检测次数已用完，请升级套餐');
      setShowPricing(true);
      return;
    }
    setThesisDetectLoading(true);
    try {
      const report = await runThesisDiagnostic();
      if (report) recordUsage('detect');
    } finally {
      setThesisDetectLoading(false);
    }
  };

  // ========== 单维度重新检测 ==========
  const runSingleDimension = async (
    dim: DiagnosticDimension, text: string, sectionId: string, existing?: ThesisDiagnostic | null
  ): Promise<ThesisDiagnostic | null> => {
    if (!text || text.length < 100) return null;
    const dimCfg = materialTemplate.dimensions[dim];
    const section = project?.sections.find(s => s.id === sectionId);
    const sectionTitle = section?.title || '';

    const prompt = `你是材料审阅专家。请对以下${materialTemplate.label}板块进行【单维度】检测，只检测「${dimCfg.label}」这一维度。

【板块标题】${sectionTitle}
【板块内容】
${text.substring(0, 8000)}

=== 检测要求 ===
${dimCfg.promptSection}

=== 输出格式 ===
请输出纯JSON（不要代码块标记）：
{
  "${dim}": {
    "score": 0-100,
    "issues": [{ "severity": "high|medium|low", "category": "", "evidence": "原文片段", "suggestion": "修改建议", "startSnippet": "问题段落前15字" }]
  }
}
如果没有问题，issues返回空数组，score给90-100。只输出纯JSON。`;

    try {
      const raw = await callAi(prompt, 'review');
      if (!raw) return null;
      const s = raw.indexOf('{');
      const e = raw.lastIndexOf('}');
      if (s === -1 || e === -1) return null;

      const parsed = JSON.parse(raw.substring(s, e + 1));
      const dimResult = parsed[dim];
      if (!dimResult) return null;

      const base = existing || diagnostics[sectionId];
      if (!base) return null;

      const updated: ThesisDiagnostic = {
        ...base,
        [dim]: { score: dimResult.score ?? 100, issues: dimResult.issues || [] },
        timestamp: Date.now(),
      };
      updated.overallScore = Math.round([
        updated.aiTrace.score, updated.consistency.score, updated.logic.score,
        updated.format.score, updated.academic.score,
      ].reduce((a, b) => a + b, 0) / 5);

      setDiagnostics(prev => ({ ...prev, [sectionId]: updated }));
      return updated;
    } catch (err) {
      console.warn(`[单维度检测: ${dim}] 失败`, err);
      return null;
    }
  };

  // ========== 修正段落 ==========
  const fixIssue = async (sectionId: string, text: string, issue: ThesisIssue): Promise<string | null> => {
    if (!text) return null;
    const anchor = issue.startSnippet || issue.evidence;
    if (!anchor) return null;

    let snipIdx = text.indexOf(anchor);
    if (snipIdx === -1) {
      const fuzzy = fuzzyFindRange(text, anchor);
      if (!fuzzy) return null;
      snipIdx = fuzzy.start;
    }

    let fixStart = 0;
    for (let i = snipIdx - 1; i >= 1; i--) {
      if (text[i] === '\n' && text[i - 1] === '\n') { fixStart = i + 1; break; }
    }
    let fixEnd = text.length;
    for (let i = snipIdx + anchor.length; i < text.length - 1; i++) {
      if (text[i] === '\n' && text[i + 1] === '\n') { fixEnd = i + 2; break; }
    }
    if (fixEnd - fixStart < 200) fixEnd = Math.min(text.length, fixStart + 400);

    const originalPassage = text.substring(fixStart, fixEnd);
    const { maskedText: maskedPassage, citations } = maskCitations(originalPassage);

    const fixPrompt = `你是学术润色编辑。以下段落存在问题，请重写修正。

【问题类型】${issue.category}
【问题描述】${issue.evidence}
【修改建议】${issue.suggestion}

【待修正段落】
${maskedPassage}

要求：
1. 保持原文的论点和核心内容不变
2. 重点修正上述问题，使表达更学术、更自然
3. 保持与上下文一致的学术风格
4. 只输出修正后的段落文本，不要加说明、不要代码块标记
5. 文中以【引用标记1】等形式出现的引用占位符必须原样保留，不能删除、改写或合并`;

    try {
      const response = await callAi(fixPrompt, 'content');
      if (!response) return null;

      let fixed = response;
      fixed = fixed.replace(/^[\s\n]*```[a-zA-Z]*\n?/, '').replace(/\n?```[\s\n]*$/, '');
      if (!fixed || fixed.length < 10) return null;
      fixed = restoreCitations(fixed, citations);
      if (!citations.every(citation => fixed.includes(citation))) {
        console.warn('[引用保护] AI 输出丢失引用标记，保留原段落');
        fixed = originalPassage;
      }

      const newText = text.substring(0, fixStart) + fixed + text.substring(fixEnd);
      setProject(prev => {
        if (!prev) return prev;
        const sections = prev.sections.map(s => s.id === sectionId ? { ...s, content: newText, wordCount: countWords(newText) } : s);
        return { ...prev, sections };
      });
      recordUsage('fix');
      return newText;
    } catch (err) {
      console.warn('[修正] 失败', err);
      return null;
    }
  };

  // ========== 批量修正 ==========
  const fixMultiple = async (sectionId: string, text: string, issues: ThesisIssue[], dim: DiagnosticDimension): Promise<string | null> => {
    if (!text || issues.length === 0) return null;

    let earliestStart = text.length;
    let latestEnd = 0;
    let matched = false;

    for (const issue of issues) {
      let idx = -1;
      if (issue.startSnippet) idx = text.indexOf(issue.startSnippet);
      if (idx === -1 && issue.evidence) idx = text.indexOf(issue.evidence);
      if (idx === -1) {
        const fuzzy = fuzzyFindRange(text, issue.startSnippet || issue.evidence);
        if (fuzzy) idx = fuzzy.start;
      }
      if (idx === -1) continue;
      matched = true;
      earliestStart = Math.min(earliestStart, idx);
      latestEnd = Math.max(latestEnd, idx + (issue.evidence?.length || 300));
    }

    if (!matched) { earliestStart = 0; latestEnd = text.length; }
    if (latestEnd - earliestStart < 400) latestEnd = Math.min(text.length, earliestStart + 600);

    const originalPassage = text.substring(earliestStart, latestEnd);
    const { maskedText: maskedPassage, citations } = maskCitations(originalPassage);
    const issueList = issues.map((iss, i) => `${i + 1}. [${iss.severity}/${iss.category}] ${iss.evidence}\n   建议：${iss.suggestion}`).join('\n');

    const fixPrompt = `你是学术润色编辑。以下段落存在${issues.length}个问题（${materialTemplate.dimensions[dim].label}），请通盘考虑后一次性重写修正。

${issueList}

【待修正段落】
${maskedPassage}

要求：
1. 保持原文论点和核心内容不变
2. 通盘考虑所有问题，确保修正后逻辑自洽
3. 使表达更学术、更自然，消除AI痕迹
4. 只输出修正后的段落文本，不要加说明、不要代码块标记
5. 文中以【引用标记1】等形式出现的引用占位符必须原样保留，不能删除、改写或合并`;

    try {
      const response = await callAi(fixPrompt, 'content');
      if (!response) return null;

      let fixed = response;
      fixed = fixed.replace(/^[\s\n]*```[a-zA-Z]*\n?/, '').replace(/\n?```[\s\n]*$/, '');
      if (!fixed || fixed.length < 10) return null;
      fixed = restoreCitations(fixed, citations);
      if (!citations.every(citation => fixed.includes(citation))) {
        console.warn('[引用保护] AI 输出丢失引用标记，保留原段落');
        fixed = originalPassage;
      }

      const newText = text.substring(0, earliestStart) + fixed + text.substring(latestEnd);
      setProject(prev => {
        if (!prev) return prev;
        const sections = prev.sections.map(s => s.id === sectionId ? { ...s, content: newText, wordCount: countWords(newText) } : s);
        return { ...prev, sections };
      });
      recordUsage('fix');
      return newText;
    } catch (err) {
      console.warn('[批量修正] 失败', err);
      return null;
    }
  };

  // ========== 自动修正闭环 ==========
  const autoFixLoop = async (section: ThesisSection, initialDiag: ThesisDiagnostic | null) => {
    let currentText = section.content;
    let currentDiag = initialDiag;

    try {
      for (let round = 1; round <= 10; round++) {
        if (!currentDiag) break;

        const dims: DiagnosticDimension[] = ['aiTrace', 'consistency', 'logic', 'format', 'academic'];
        const toFix: Array<{ dim: DiagnosticDimension; issues: ThesisIssue[] }> = [];
        for (const dim of dims) {
          const issues = (currentDiag[dim].issues || []).filter(i => i.severity === 'high' || i.severity === 'medium');
          if (issues.length > 0) toFix.push({ dim, issues });
        }

        if (toFix.length === 0) break;

        setAutoFixStage(`第${round}轮修正中...`);

        for (const { dim, issues } of toFix) {
          setAutoFixStage(`第${round}轮修正 ${materialTemplate.dimensions[dim].label}(${issues.length}个问题)...`);
          const newText = await fixMultiple(section.id, currentText, issues, dim);
          if (newText) currentText = newText;
        }

        // 重新检测全部维度
        for (const dim of dims) {
          setAutoFixStage(`第${round}轮重新检测 ${materialTemplate.dimensions[dim].label}...`);
          const result = await runSingleDimension(dim, currentText, section.id, currentDiag);
          if (result) currentDiag = result;
        }
      }
    } finally {
      setAutoFixStage('');
    }
  };

  // ========== 检测按钮 ==========
  const handleDetect = async () => {
    if (!selectedSection) return;
    if (user && !canUse('detect')) {
      toastWarning('免费检测次数已用完，请升级套餐');
      setShowPricing(true);
      return;
    }
    setDiagnosticLoading(true);
    setAutoFixStage('检测中...');
    try {
      const diag = await runDiagnostic(selectedSection);
      if (diag) recordUsage('detect');
      setDiagnosticLoading(false);
      setAutoFixStage('');
      if (diag && diag.overallScore < 85) {
        const shouldFix = window.confirm(`检测完成，综合 ${diag.overallScore} 分。是否进入自动修正闭环？修正会改写当前章节。`);
        if (!shouldFix) return;
        if (!user) {
          toastWarning('请先登录后使用自动修正');
          setShowLogin(true);
          return;
        }
        if (!canUse('fix')) {
          toastWarning('当前套餐不包含自动修正，请升级套餐');
          setShowPricing(true);
          return;
        }
        setAutoFixStage('准备自动修正...');
        await autoFixLoop(selectedSection, diag);
      }
    } catch (e) {
      console.warn('[检测] 失败', e);
      setDiagnosticLoading(false);
      setAutoFixStage('');
    }
  };

  // ========== 导出 .txt ==========
  const handleExportTxt = () => {
    if (!project) return;
    let text = `${project.title}\n\n`;
    for (const s of project.sections) {
      text += `${s.title}\n${s.content}\n\n`;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ========== 导出 .docx ==========
  const handleExportDocx = async () => {
    if (!project) return;
    try {
      const blob = await generateDocx(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[导出 docx 失败]', err);
      toastWarning('导出 Word 失败，已自动切换为纯文本导出');
      handleExportTxt();
    }
  };

  // ========== 单问题修正处理器 ==========
  const handleFixIssue = async (
    dim: DiagnosticDimension,
    issueIndex: number,
    issue: ThesisIssue
  ) => {
    if (!selectedSectionId || !selectedSection) return;
    if (!user) {
      toastWarning('请先登录后使用修改功能');
      setShowLogin(true);
      return;
    }
    if (!canUse('fix')) {
      toastWarning('当前套餐不包含修改功能，请升级套餐');
      setShowPricing(true);
      return;
    }
    setFixingIssueId(`${dim}-${issueIndex}`);
    setFixStage('修正中...');
    try {
      const newText = await fixIssue(selectedSectionId, selectedSection.content, issue);
      if (newText) {
        setFixStage('重新检测中...');
        await runSingleDimension(dim, newText, selectedSectionId, currentDiagnostic);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setFixingIssueId(null);
      setFixStage('');
    }
  };

  // ========== 批量修正处理器 ==========
  const handleFixAll = async (dim: DiagnosticDimension) => {
    if (!selectedSectionId || !selectedSection || !currentDiagnostic) return;
    const d = currentDiagnostic[dim];
    if (!d.issues.length) return;
    if (!user) {
      toastWarning('请先登录后使用修改功能');
      setShowLogin(true);
      return;
    }
    if (!canUse('fix')) {
      toastWarning('当前套餐不包含修改功能，请升级套餐');
      setShowPricing(true);
      return;
    }

    setFixingIssueId(`batch-${dim}`);
    setFixStage('修正中...');
    try {
      const newText = await fixMultiple(selectedSectionId, selectedSection.content, d.issues, dim);
      if (newText) {
        setFixStage('重新检测中...');
        await runSingleDimension(dim, newText, selectedSectionId, currentDiagnostic);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setFixingIssueId(null);
      setFixStage('');
    }
  };

  // ========== 返回首页（保留输入数据）==========
  const handleBackToHome = () => {
    setProject(null);
    setSelectedSectionId('');
    setThesisReport(null);
    setShowThesisReport(false);
    // 保留 inputText / rawText / projectTitle，方便用户再次导入
  };

  // ========== 重置项目（清空所有数据）==========
  const handleReset = () => {
    setProject(null);
    setInputText('');
    setRawText('');
    setDiagnostics({});
    setThesisReport(null);
    setShowThesisReport(false);
    setSelectedSectionId('');
    setProjectTitle('');
  };

  // ========== 文件选择处理器 ==========
  const handleFileSelect = (text: string) => {
    setRawText(text);
    setInputText(text);
  };

  // ========== docx 结构化导入处理器 ==========
  const handleDocxSectionsSelect = (sections: { title: string; content: string; type: string }[]) => {
    if (!sections.length) return;

    // 拼接全文保留在 textarea
    const fullText = sections.map(s => s.title + '\n' + s.content).join('\n\n');
    setRawText(fullText);
    setInputText(fullText);

    // 直接创建项目
    const thesisSections: ThesisSection[] = sections.map((s, i) => ({
      id: `sec_${i}_${Date.now()}`,
      title: s.title,
      type: s.type as ThesisSection['type'],
      content: s.content,
      wordCount: countWords(s.content),
    }));

    const newProject: ThesisProject = {
      materialType: materialTemplateId,
      title: projectTitle || (materialTemplateId === 'personal_statement' ? '个人陈述' : '未命名论文'),
      type: materialTemplate.defaultProject.type,
      major: materialTemplate.defaultProject.major,
      citationStyle: materialTemplate.defaultProject.citationStyle,
      wordLimit: materialTemplate.defaultProject.wordLimit,
      sections: thesisSections,
      references: [],
    };
    setProject(newProject);
    setDiagnostics({});
    setThesisReport(null);
    setShowThesisReport(false);
    if (thesisSections.length > 0) setSelectedSectionId(thesisSections[0].id);
  };

  // ========== 导入界面 ==========
  if (!project) {
    return (
      <div className="min-h-screen bg-theme-base">
        <ImportView
          user={user}
          apiConfig={apiConfig}
          projectTitle={projectTitle}
          selectedMaterialType={materialTemplateId}
          inputText={inputText}
          showSettings={showSettings}
          showLogin={showLogin}
          projectHistory={projectHistory}
          historyLoading={historyLoading}
          onLogin={() => setShowLogin(true)}
          onLogout={logout}
          onToggleSettings={() => setShowSettings(!showSettings)}
          onApiChange={setApiConfig}
          onTitleChange={setProjectTitle}
          onMaterialTypeChange={setMaterialTemplateId}
          onTextChange={setInputText}
          onImport={handleImport}
          onFileSelect={handleFileSelect}
          onDocxSectionsSelect={handleDocxSectionsSelect}
          onLoadProject={handleLoadProject}
          onDeleteProject={handleDeleteProject}
          onOpenPricing={() => setShowPricing(true)}
        />
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} />
        )}
        {showPricing && (
          <PricingModal
            currentPlan={user?.plan || 'free'}
            onSelectPlan={handleSelectPlan}
            onClose={() => setShowPricing(false)}
          />
        )}
      </div>
    );
  }

  // ========== 主界面 ==========
  return (
    <div className="min-h-screen text-theme-primary flex">
      {/* Desktop Section Sidebar */}
      <div className="hidden md:flex">
        <SectionSidebar
          project={project}
          selectedSectionId={selectedSectionId}
          diagnostics={diagnostics}
          userPhone={user?.phone}
          userPlan={user?.plan}
          detectCount={user?.detectCount}
          onSelectSection={setSelectedSectionId}
          onExportTxt={handleExportTxt}
          onExportDocx={handleExportDocx}
          onBackToHome={handleBackToHome}
          onReset={handleReset}
          onOpenPricing={() => setShowPricing(true)}
        />
      </div>

      {/* Mobile Section Sidebar Drawer */}
      {showMobileSectionSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setShowMobileSectionSidebar(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-64 z-50 md:hidden">
            <SectionSidebar
              project={project}
              selectedSectionId={selectedSectionId}
              diagnostics={diagnostics}
              userPhone={user?.phone}
              userPlan={user?.plan}
              detectCount={user?.detectCount}
              onSelectSection={(id) => {
                setSelectedSectionId(id);
                setShowMobileSectionSidebar(false);
              }}
              onExportTxt={handleExportTxt}
              onExportDocx={handleExportDocx}
              onBackToHome={() => {
                handleBackToHome();
                setShowMobileSectionSidebar(false);
              }}
              onReset={handleReset}
              onOpenPricing={() => {
                setShowPricing(true);
                setShowMobileSectionSidebar(false);
              }}
            />
          </div>
        </>
      )}

      {selectedSection && (
        <EditorView
          section={selectedSection}
          diagnostic={currentDiagnostic}
          diagnosticLoading={diagnosticLoading}
          dimensionLabels={dimensionLabels}
          thesisReport={thesisReport}
          thesisDetectLoading={thesisDetectLoading}
          autoFixStage={autoFixStage}
          highlightMode={highlightMode}
          showDiagnostics={showDiagnostics}
          fixingIssueId={fixingIssueId}
          fixStage={fixStage}
          onOpenSectionSidebar={() => setShowMobileSectionSidebar(true)}
          onDetect={handleDetect}
          onDetectAll={handleDetectAll}
          onShowReport={() => setShowThesisReport(true)}
          onToggleHighlight={() => setHighlightMode(!highlightMode)}
          onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
          onFixIssue={handleFixIssue}
          onFixAll={handleFixAll}
        />
      )}

      <AutoFixOverlay stage={autoFixStage} />

      {showThesisReport && thesisReport && (
        <ThesisReportView
          report={thesisReport}
          sections={project.sections}
          onClose={() => setShowThesisReport(false)}
        />
      )}

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} />
      )}

      {showPricing && (
        <PricingModal
          currentPlan={user?.plan || 'free'}
          onSelectPlan={handleSelectPlan}
          onClose={() => setShowPricing(false)}
        />
      )}
    </div>
  );
}

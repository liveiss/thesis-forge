// ==============================================
// 论文工坊 - 数据持久化层
// 通过 Next.js API Routes 与 Supabase 交互，避免前端直连 Supabase
// ==============================================

import type { ThesisProject, ThesisDiagnostic, ThesisReport } from '../types';

// ========== 类型定义 ==========

export interface StoredProject {
  id: string;
  userId: string;
  materialType?: string;
  title: string;
  type: string;
  major: string;
  citationStyle: string;
  wordLimit: number;
  sections: ThesisSectionData[];
  diagnostics: Record<string, ThesisDiagnostic>;
  report?: ThesisReport | null;
  createdAt: string;
  updatedAt: string;
}

interface ThesisSectionData {
  id: string;
  title: string;
  type: string;
  content: string;
  wordCount: number;
}

export interface ProjectMeta {
  id: string;
  title: string;
  sectionCount: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

// ========== localStorage 降级 ==========

const LS_KEY_PREFIX = 'thesis_forge_projects_';

function lsGetProjects(userId: string): StoredProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSetProjects(userId: string, projects: StoredProject[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${LS_KEY_PREFIX}${userId}`, JSON.stringify(projects));
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return data as T;
}

// ========== 核心 API ==========

/** 保存项目 */
export async function saveProject(
  _userId: string,
  project: ThesisProject,
  diagnostics: Record<string, ThesisDiagnostic>,
  report?: ThesisReport | null
): Promise<StoredProject> {
  const now = new Date().toISOString();

  try {
    await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ project, diagnostics, report }),
    });
  } catch (err) {
    console.warn('[Supabase 保存失败，回退到 localStorage]', err);
    const projects = lsGetProjects(_userId);
    const stored = buildStoredProject(_userId, project, diagnostics, report);
    const idx = projects.findIndex(p => p.title === stored.title);
    if (idx >= 0) {
      projects[idx] = stored;
    } else {
      projects.unshift(stored);
    }
    lsSetProjects(_userId, projects);
    return stored;
  }

  return buildStoredProject(_userId, project, diagnostics, report);
}

/** 获取单个项目 */
export async function getProject(userId: string, projectId: string): Promise<StoredProject | null> {
  try {
    const data = await apiFetch<{ project: StoredProject }>(`/api/projects/${encodeURIComponent(projectId)}`);
    if (data.project) return data.project;
  } catch (err) {
    console.warn('[Supabase 获取失败，回退到 localStorage]', err);
  }

  const projects = lsGetProjects(userId);
  return projects.find(p => p.id === projectId || p.title === projectId) || null;
}

/** 列出用户所有项目 */
export async function listProjects(userId: string): Promise<ProjectMeta[]> {
  try {
    const data = await apiFetch<{ projects: ProjectMeta[] }>('/api/projects');
    if (data.projects) return data.projects;
  } catch (err) {
    console.warn('[Supabase 列表失败，回退到 localStorage]', err);
  }

  const projects = lsGetProjects(userId);
  return projects.map(p => ({
    id: p.id,
    title: p.title,
    sectionCount: p.sections.length,
    wordCount: p.sections.reduce((sum, s) => sum + s.wordCount, 0),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/** 删除项目 */
export async function deleteProject(userId: string, projectId: string): Promise<void> {
  try {
    await apiFetch(`/api/projects?id=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    return;
  } catch (err) {
    console.warn('[Supabase 删除失败，回退到 localStorage]', err);
  }

  const projects = lsGetProjects(userId).filter(p => p.id !== projectId);
  lsSetProjects(userId, projects);
}

/** 将 StoredProject 恢复为 ThesisProject */
export function restoreProject(stored: StoredProject): {
  project: ThesisProject;
  diagnostics: Record<string, ThesisDiagnostic>;
  report: ThesisReport | null;
} {
  const project: ThesisProject = {
    materialType: stored.materialType || 'thesis',
    title: stored.title,
    type: stored.type as ThesisProject['type'],
    major: stored.major,
    citationStyle: stored.citationStyle as ThesisProject['citationStyle'],
    wordLimit: stored.wordLimit,
    sections: stored.sections.map((s, i) => ({
      id: s.id || `sec_${i}_${Date.now()}`,
      title: s.title,
      type: s.type as ThesisProject['sections'][0]['type'],
      content: s.content,
      wordCount: s.wordCount,
    })),
    references: [],
  };

  return { project, diagnostics: stored.diagnostics || {}, report: stored.report || null };
}

/** 从 ThesisProject 构建存储对象 */
export function buildStoredProject(
  userId: string,
  project: ThesisProject,
  diagnostics: Record<string, ThesisDiagnostic>,
  report?: ThesisReport | null
): StoredProject {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    materialType: project.materialType || 'thesis',
    title: project.title,
    type: project.type,
    major: project.major,
    citationStyle: project.citationStyle,
    wordLimit: project.wordLimit,
    sections: project.sections.map(s => ({
      id: s.id,
      title: s.title,
      type: s.type,
      content: s.content,
      wordCount: s.wordCount,
    })),
    diagnostics,
    report: report ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

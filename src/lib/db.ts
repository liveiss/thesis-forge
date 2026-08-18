// ==============================================
// 论文工坊 - 数据持久化层
// 生产环境强制 Supabase；未配置时降级到 localStorage（仅开发/测试）
// ==============================================

import { supabase } from './supabase';
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

// ========== 配置检测 ==========

const hasSupabaseConfig = (): boolean => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
};

const isSupabaseReady = (): boolean => {
  return hasSupabaseConfig();
};

// ========== localStorage 实现（降级） ==========

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

// ========== 核心 API ==========

/** 保存项目（新增或更新） */
export async function saveProject(
  userId: string,
  project: ThesisProject,
  diagnostics: Record<string, ThesisDiagnostic>,
  report?: ThesisReport | null
): Promise<StoredProject> {
  const now = new Date().toISOString();
  const existing = await getProject(userId, project.title);

  const stored: StoredProject = {
    id: existing?.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (isSupabaseReady()) {
    const { error } = await supabase.from('projects').upsert({
      id: stored.id,
      user_id: userId,
      title: stored.title,
      type: stored.type,
      major: stored.major,
      citation_style: stored.citationStyle,
      word_limit: stored.wordLimit,
      data: stored as unknown as Record<string, unknown>,
      created_at: stored.createdAt,
      updated_at: stored.updatedAt,
    }, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase 保存失败，回退到 localStorage]', error);
      // fallthrough to localStorage
    } else {
      return stored;
    }
  }

  // localStorage 回退
  const projects = lsGetProjects(userId);
  const idx = projects.findIndex(p => p.id === stored.id);
  if (idx >= 0) {
    projects[idx] = stored;
  } else {
    const sameTitleIdx = projects.findIndex(p => p.title === stored.title);
    if (sameTitleIdx >= 0) {
      projects[sameTitleIdx] = stored;
    } else {
      projects.unshift(stored);
    }
  }
  lsSetProjects(userId, projects);
  return stored;
}

/** 获取单个项目（按 id 或标题） */
export async function getProject(userId: string, projectId: string): Promise<StoredProject | null> {
  if (isSupabaseReady()) {
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('user_id', userId)
      .or(`id.eq.${projectId},title.eq.${projectId}`)
      .single();

    if (!error && data?.data) {
      return data.data as StoredProject;
    }
  }

  const projects = lsGetProjects(userId);
  return projects.find(p => p.id === projectId || p.title === projectId) || null;
}

/** 列出用户所有项目 */
export async function listProjects(userId: string): Promise<ProjectMeta[]> {
  if (isSupabaseReady()) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, data, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map(row => {
        const proj = row.data as StoredProject;
        return {
          id: row.id,
          title: row.title || proj.title,
          sectionCount: proj.sections?.length || 0,
          wordCount: proj.sections?.reduce((sum, s) => sum + (s.wordCount || 0), 0) || 0,
          createdAt: row.created_at || proj.createdAt,
          updatedAt: row.updated_at || proj.updatedAt,
        };
      });
    }
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
  if (isSupabaseReady()) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', userId);
    if (!error) {
      // 同时清理本地缓存，避免重新登录后看到旧数据
      const projects = lsGetProjects(userId).filter(p => p.id !== projectId);
      lsSetProjects(userId, projects);
      return;
    }
    console.warn('[Supabase 删除失败，回退到 localStorage]', error);
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

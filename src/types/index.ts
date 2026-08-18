// ==============================================
// 论文工坊 - 类型定义
// ==============================================

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ==============================================
// 论文结构
// ==============================================

export interface ThesisProject {
  materialType?: string;
  title: string;
  type: 'bachelor' | 'master' | 'phd' | 'journal';
  major: string;
  citationStyle: 'APA' | 'MLA' | 'GBT' | 'Chicago';
  wordLimit: number;
  sections: ThesisSection[];
  references: Reference[];
}

export interface ThesisSection {
  id: string;
  title: string;
  type: 'abstract' | 'intro' | 'lit_review' | 'method' | 'result' | 'discussion' | 'conclusion' | 'reference' | 'other';
  content: string;
  wordCount: number;
}

export interface Reference {
  id: string;
  raw: string;
  type: 'journal' | 'book' | 'web' | 'conference';
  citedIn: string[];
}

// ==============================================
// 检测器
// ==============================================

export type DiagnosticDimension = 'aiTrace' | 'consistency' | 'logic' | 'format' | 'academic';

export interface ThesisDiagnostic {
  id: string;
  sectionId: string;
  timestamp: number;
  aiTrace: { score: number; issues: ThesisIssue[] };
  consistency: { score: number; issues: ThesisIssue[] };
  logic: { score: number; issues: ThesisIssue[] };
  format: { score: number; issues: ThesisIssue[] };
  academic: { score: number; issues: ThesisIssue[] };
  overallScore: number;
}

export interface ThesisIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  evidence: string;
  suggestion: string;
  startSnippet: string;
}

export interface ThesisReport {
  id: string;
  materialType: string;
  timestamp: number;
  overallScore: number;
  summary: string;
  aiTrace: { score: number; issues: ThesisIssue[] };
  consistency: { score: number; issues: ThesisIssue[] };
  logic: { score: number; issues: ThesisIssue[] };
  format: { score: number; issues: ThesisIssue[] };
  academic: { score: number; issues: ThesisIssue[] };
  sectionScores: Record<string, number>;
  crossSectionIssues: ThesisIssue[];
  referenceIssues: ThesisIssue[];
}

// ==============================================
// 维度配置
// ==============================================

export const DIMENSION_CONFIG: Record<DiagnosticDimension, { label: string; jsonKey: string; color: string; promptSection: string }> = {
  aiTrace: {
    label: 'AI痕迹',
    jsonKey: 'aiTrace',
    color: 'cyan',
    promptSection: `【AI痕迹检测】
检查本节是否存在以下AI写作痕迹：
1. 套路化表达："不是……，而是……"、"与其说……，不如说……"、"不仅仅是……，更是……"、"某种程度上"、"仿佛在诉说着"
2. 模糊暗示装深沉："眼神里闪过一丝……"、"仿佛有什么正在苏醒"、"这一切才刚刚开始"、"莫名的……"
3. 机械表达：过度对称的句式、模板化转折（"然而"、"但是"高频出现）
4. 学术术语堆砌：不必要的术语替代日常表达
5. 重复修辞：同一段落内多次使用"仿佛"、"宛如"、"似乎"
6. 说教旁白："这意味着"、"这背后反映"、"这不仅仅是"`,
  },
  consistency: {
    label: '一致性',
    jsonKey: 'consistency',
    color: 'amber',
    promptSection: `【一致性检测】
检查本节与其他章节/段落是否存在：
1. 前后结论矛盾：本节结论与摘要、引言或结论部分不一致
2. 数据引用不一致：正文数据与图表/表格数据不符
3. 定义前后冲突：同一概念在不同位置定义不同
4. 术语使用不统一：同一概念用了多个不同名称
5. 引用编号错误：引用标注与参考文献列表不对应`,
  },
  logic: {
    label: '论证逻辑',
    jsonKey: 'logic',
    color: 'red',
    promptSection: `【论证逻辑检测】
检查本节内部是否存在：
1. 因果链断裂：论据与论点之间缺乏逻辑联系
2. 论据不支持论点：数据/引用无法推导出当前结论
3. 循环论证：用结论本身作为论据
4. 概念偷换：论证过程中核心概念发生偏移
5. 以偏概全：用个别案例推出普遍结论
6. 逻辑跳跃：推理过程缺少中间环节`,
  },
  format: {
    label: '格式规范',
    jsonKey: 'format',
    color: 'blue',
    promptSection: `【格式规范检测】
检查本节是否存在：
1. 引用格式不规范：不符合 APA/MLA/GB-T 标准
2. 图表编号不连续：图/表编号跳跃或重复
3. 标题层级混乱：一级/二级/三级标题混用
4. 段落格式问题：缩进、行距、字号不统一`,
  },
  academic: {
    label: '学术规范',
    jsonKey: 'academic',
    color: 'purple',
    promptSection: `【学术规范检测】
检查本节是否存在：
1. 口语化表达：使用了非学术书面语
2. 主观断言：缺少依据的个人判断
3. 过度绝对化：使用"完全"、"绝对"、"必然"等词
4. 缺少出处：提出数据/观点但未标注引用
5. 第一人称滥用：过度使用"我认为"、"我觉得"`,
  },
};

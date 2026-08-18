import type { DiagnosticDimension, ThesisProject } from '../types';
import { DIMENSION_CONFIG } from '../types';
import { autoSplitSections, type SplitSection } from './utils';

export interface DimensionPrompt {
  label: string;
  promptSection: string;
}

export interface MaterialTemplate {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  defaultProject: Pick<ThesisProject, 'type' | 'major' | 'citationStyle' | 'wordLimit'>;
  dimensions: Record<DiagnosticDimension, DimensionPrompt>;
  fullReviewFocus: string;
  splitText: (text: string) => SplitSection[];
}

const thesisDimensions = (Object.keys(DIMENSION_CONFIG) as DiagnosticDimension[]).reduce(
  (acc, dim) => {
    acc[dim] = {
      label: DIMENSION_CONFIG[dim].label,
      promptSection: DIMENSION_CONFIG[dim].promptSection,
    };
    return acc;
  },
  {} as Record<DiagnosticDimension, DimensionPrompt>
);

const personalStatementDimensions: Record<DiagnosticDimension, DimensionPrompt> = {
  aiTrace: {
    label: 'AI痕迹',
    promptSection: `【AI痕迹与模板感检测】检查是否存在明显AI写作痕迹、模板化开头、机械排比、过度对称、空泛套话和重复表达。`,
  },
  consistency: {
    label: '材料一致性',
    promptSection: `【动机与材料一致性】检查申请动机、学术或实习经历、职业目标与申请方向是否一致；是否存在前后矛盾、时间线错乱、经历描述与目标不匹配。`,
  },
  logic: {
    label: '叙事逻辑',
    promptSection: `【叙事逻辑与证据链】检查经历是否支撑申请动机，论证是否完整，有无因果断裂、以偏概全、空泛结论、缺少具体事例。`,
  },
  format: {
    label: '结构与篇幅',
    promptSection: `【结构与篇幅规范】检查段落结构是否清晰，小标题层级是否合理，篇幅是否适合目标学校或项目要求，有无重复或遗漏必要信息。`,
  },
  academic: {
    label: '表达质量',
    promptSection: `【表达质量与学术规范】检查语言是否自然、书面化，是否存在口语化、过度绝对化、第一人称滥用、主观断言缺乏依据。`,
  },
};

const PS_HEADING_RE = /^(个人简介|自我介绍|学术背景|教育背景|研究兴趣|科研经历|项目经历|实习经历|工作经历|实践活动|未来规划|职业目标|申请动机|为什么选择|结语)$/;

function splitPersonalStatement(text: string): SplitSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const hasHeading = trimmed
    .split('\n')
    .some(line => PS_HEADING_RE.test(line.trim().replace(/\s+/g, '')));

  if (hasHeading) return autoSplitSections(trimmed);
  return [{ title: '个人陈述正文', content: trimmed, type: 'other' }];
}

export const MATERIAL_TEMPLATES: MaterialTemplate[] = [
  {
    id: 'thesis',
    label: '毕业论文',
    shortLabel: '论文',
    description: '五维度论文审阅：AI痕迹、一致性、论证逻辑、格式规范、学术规范。',
    defaultProject: {
      type: 'bachelor',
      major: '',
      citationStyle: 'GBT',
      wordLimit: 10000,
    },
    dimensions: thesisDimensions,
    fullReviewFocus: '重点检查跨章节一致性、引用编号和全文级论证问题。',
    splitText: autoSplitSections,
  },
  {
    id: 'personal_statement',
    label: '个人陈述',
    shortLabel: 'PS',
    description: '保研/留学个人陈述审阅：申请动机、经历证据、叙事逻辑、表达与篇幅。',
    defaultProject: {
      type: 'master',
      major: '',
      citationStyle: 'APA',
      wordLimit: 1500,
    },
    dimensions: personalStatementDimensions,
    fullReviewFocus: '重点检查申请动机、个人经历、职业目标与申请项目的匹配度，以及材料是否有模板感、空泛表达和事实一致性风险。',
    splitText: splitPersonalStatement,
  },
];

export const DEFAULT_MATERIAL_TEMPLATE_ID = 'thesis';

export function getMaterialTemplate(id?: string): MaterialTemplate {
  return MATERIAL_TEMPLATES.find(template => template.id === id) || MATERIAL_TEMPLATES[0];
}

export function splitByTemplate(templateId: string, text: string): SplitSection[] {
  return getMaterialTemplate(templateId).splitText(text);
}

export function getDimensionLabels(template: MaterialTemplate): Record<DiagnosticDimension, string> {
  return {
    aiTrace: template.dimensions.aiTrace.label,
    consistency: template.dimensions.consistency.label,
    logic: template.dimensions.logic.label,
    format: template.dimensions.format.label,
    academic: template.dimensions.academic.label,
  };
}

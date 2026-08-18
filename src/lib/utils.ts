// ==============================================
// 论文工坊 - 工具函数
// ==============================================

import type { ThesisProject } from '../types';

// ==============================================
// .docx 导入：提取纯文本（兼容旧代码）
// ==============================================

export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// ==============================================
// .docx 结构化导入：保留标题层级信息
// ==============================================

interface DocxParagraph {
  text: string;
  isHeading1: boolean;
  isHeading2: boolean;
}

/** 保留内联格式（字体、加粗、斜体、图片），去除块级标签 */
function processInlineHtml(html: string): string {
  // 1. 保留 img 标签
  const imgPlaceholders: string[] = [];
  let s = html.replace(/<img[^>]*>/gi, (m) => {
    imgPlaceholders.push(m);
    return `\x00IMG${imgPlaceholders.length - 1}\x00`;
  });

  // 2. 保留带字体样式的 span（font-family / font-size / color / font-weight / font-style）
  s = s.replace(/<span\b[^>]*>/gi, (m) => {
    const styleMatch = m.match(/style=["']([^"']*)["']/i);
    if (!styleMatch) return '';
    const cleanStyle = styleMatch[1]
      .split(';')
      .map((x: string) => x.trim())
      .filter((x: string) => /^(font-family|font-size|color|font-weight|font-style)/i.test(x))
      .join('; ');
    return cleanStyle ? `<span style="${cleanStyle}">` : '';
  });

  // 3. 保留其他安全内联标签
  s = s.replace(/<\/?(b|strong|i|em|u|sub|sup|br\b|a\b[^>]*|\/a)>/gi, (m) => m);

  // 4. 去除所有剩余标签（块级标签等）
  s = s.replace(/<[^>]+>/g, '');

  // 5. 恢复 img 标签
  imgPlaceholders.forEach((img, i) => {
    s = s.replace(`\x00IMG${i}\x00`, img);
  });

  // 6. 解码 HTML 实体
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

/** 从 docx 中提取带样式的段落列表（含图片） */
export async function extractDocxParagraphs(arrayBuffer: ArrayBuffer): Promise<DocxParagraph[]> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: [
      'p[style-name="Heading 1"] => h1',
      'p[style-name="Heading 2"] => h2',
      'p[style-name="Heading 3"] => h3',
    ],
    convertImage: mammoth.images.imgElement(async (image) => ({
      src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
    })),
  });

  const html = result.value;
  const paragraphs: DocxParagraph[] = [];

  // 用正则提取 h1/h2/h3/p/li 标签内容
  const tagRegex = /<(h1|h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = processInlineHtml(m[2]);
    if (!text) continue;
    paragraphs.push({
      text,
      isHeading1: tag === 'h1',
      isHeading2: tag === 'h2' || tag === 'h3',
    });
  }

  return paragraphs;
}

/** 从 docx 中直接提取分好章节的段落 */
export async function extractDocxSections(arrayBuffer: ArrayBuffer): Promise<{ title: string; content: string; type: string }[]> {
  const paragraphs = await extractDocxParagraphs(arrayBuffer);
  return smartSplitSections(paragraphs);
}

// ==============================================
// .docx 导出：生成 Word 文件
// ==============================================

export async function generateDocx(project: ThesisProject): Promise<Blob> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

  const children: InstanceType<typeof Paragraph>[] = [];

  // 标题
  children.push(
    new Paragraph({
      text: project.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // 各章节
  for (const section of project.sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // 将内容按段落拆分
    const paragraphs = section.content.split(/\n{2,}/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: 24, // 12pt
              font: 'Times New Roman',
            }),
          ],
          spacing: { after: 160, line: 360 },
          indent: { firstLine: 480 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,    // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}

/** 模糊搜索：在 text 中找到最接近 query 的片段位置 */
export function fuzzyFindRange(text: string, query: string): { start: number; end: number } | null {
  if (!query || query.length < 5) return null;

  // 1. 精确匹配
  const exact = text.indexOf(query);
  if (exact >= 0) return { start: exact, end: exact + query.length };

  // 2. 去除空白后匹配
  const normalize = (s: string) => s.replace(/\s+/g, '');
  const normQuery = normalize(query);
  const normText = normalize(text);
  const normPos = normText.indexOf(normQuery);
  if (normPos >= 0) {
    let start = -1, end = -1, normIdx = 0;
    for (let i = 0; i < text.length && normIdx <= normPos + normQuery.length; i++) {
      if (/\s/.test(text[i])) continue;
      if (normIdx === normPos) start = i;
      if (normIdx === normPos + normQuery.length - 1) end = i + 1;
      normIdx++;
    }
    if (start >= 0 && end >= 0) return { start, end };
  }

  // 3. 用 query 前30字定位
  const shortQuery = query.substring(0, Math.min(30, query.length));
  const shortPos = text.indexOf(shortQuery);
  if (shortPos >= 0) {
    let endPos = shortPos + shortQuery.length;
    const tail = query.substring(query.length - 20);
    if (tail.length > 5) {
      const tailPos = text.indexOf(tail, shortPos);
      if (tailPos >= 0 && tailPos + tail.length > endPos) {
        endPos = tailPos + tail.length;
      }
    }
    return { start: shortPos, end: Math.min(endPos, text.length) };
  }

  return null;
}

/** 统计字数 */
export function countWords(text: string): number {
  if (!text) return 0;
  // 中文按字符算，英文按单词算
  const chinese = text.match(/[\u4e00-\u9fa5]/g);
  const english = text.match(/[a-zA-Z]+/g);
  return (chinese?.length || 0) + (english?.length || 0);
}

// ==============================================
// 标题检测与章节拆分
// ==============================================

/** 明确的英文章节标题关键词 */
const ENGLISH_TITLE_RE = /^(abstract|introduction|conclusion|references?|acknowledgements?|acknowledgments?|appendix|appendices|methodology|experiments?|results?|discussion|literature review|related work|background|future work)$/i;

/** 序号标题：一、 或 1. 或 1.1 或 第X章 或 （一） */
const NUMBER_TITLE_RE = /^([一二三四五六七八九十百千万]+、|\d+[.．]\s*\S|\d+[.．]\d+\s*\S|第[一二三四五六七八九十\d]+章|\（[一二三四五六七八九十]+\）)/;

/** 图片/表格说明：图1、表2、Figure 3、Table 4 等 — 不是章节标题 */
const CAPTION_RE = /^(图|表|Figure|Table)\s*\d+/i;

function isTitleLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 80) return false; // 标题不会太长

  // 排除图片/表格说明
  if (CAPTION_RE.test(t)) return false;

  // 去除空格后匹配中文标题（支持"结 论"、"前 言"等）
  const clean = t.replace(/\s+/g, '');
  if (/^(摘要|前言|引言|绪论|结论|总结|参考文献|致谢|附录|关键词|目录)/.test(clean)) return true;

  return NUMBER_TITLE_RE.test(t) || ENGLISH_TITLE_RE.test(t);
}

/** 启发式标题检测：针对无关键词、无数序号的短标题 */
function looksLikeTitle(line: string, nextLine?: string): boolean {
  const t = line.trim();
  if (t.length < 5 || t.length > 50) return false;

  // 排除图片/表格说明
  if (CAPTION_RE.test(t)) return false;

  // 不包含句末标点
  if (/[。！？.!?]$/.test(t)) return false;
  // 如果包含逗号/分号且较长，不像标题
  if (/[，；,;]/.test(t) && t.length > 25) return false;
  // 下一行比较长且包含句末标点，像正文
  if (nextLine) {
    const nt = nextLine.trim();
    if (nt.length > 80 && /[。！？.!?]/.test(nt)) return true;
  }
  return false;
}

/** 判断两个标题是否高度相似（同一章节的重复标题） */
function isSimilarTitle(a: string, b: string): boolean {
  const sa = a.replace(/\s+/g, '').toLowerCase();
  const sb = b.replace(/\s+/g, '').toLowerCase();
  if (sa === sb) return true;
  if (sa.includes(sb) || sb.includes(sa)) return true;

  // 编辑距离
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(sa, sb);
  return dist / maxLen < 0.25; // 75% 以上相似
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // 滚动数组优化
  let prev = Array(n + 1).fill(0);
  let curr = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : Math.min(prev[j], curr[j - 1], prev[j - 1]) + 1;
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 章节类型推断 */
function detectSectionType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('摘要') || lower.includes('abstract')) return 'abstract';
  if (lower.includes('引言') || lower.includes('introduction') || lower.includes('绪论') || lower.includes('前言')) return 'intro';
  if (lower.includes('文献综述') || lower.includes('literature') || lower.includes('related work')) return 'lit_review';
  if (lower.includes('方法') || lower.includes('method') || lower.includes('实验') || lower.includes('设计') || lower.includes('methodology')) return 'method';
  if (lower.includes('结果') || lower.includes('result')) return 'result';
  if (lower.includes('讨论') || lower.includes('discussion')) return 'discussion';
  if (lower.includes('结论') || lower.includes('conclusion') || lower.includes('总结')) return 'conclusion';
  if (lower.includes('参考') || lower.includes('reference')) return 'reference';
  if (lower.includes('致谢') || lower.includes('acknowledgement') || lower.includes('acknowledgment')) return 'other';
  if (lower.includes('附录') || lower.includes('appendix')) return 'other';
  return 'other';
}

// ==============================================
// 封面 / 承诺书 / 目录 剥离
// ==============================================

/** 检测是否为目录行（以页码结尾） */
function isTocLine(text: string): boolean {
  return /\t\s*\d+\s*$/.test(text) || /\s{2,}\d+\s*$/.test(text);
}

/** 封面与承诺书剥离：找到正文起点 */
function stripFrontMatter(paras: DocxParagraph[]): DocxParagraph[] {
  const tocRe = /^目\s*录|Contents/i;
  const strictChapterRe = /^(摘\s*要|Abstract|前\s*言|引\s*言|绪\s*论|Introduction)$/i;
  const looseChapterRe = /^(第[一二三四五六七八九十\d]+章|[一二三四五六七八九十]+、)/;

  for (let i = 0; i < Math.min(paras.length, 400); i++) {
    const t = paras[i].text.trim().replace(/\s+/g, ' ');

    // 如果这是明确的 h1 标题且不是目录，直接从这儿开始
    if (paras[i].isHeading1 && !tocRe.test(t)) {
      return paras.slice(i);
    }

    // 严格匹配章节标题（不带页码）
    if (strictChapterRe.test(t) && !isTocLine(paras[i].text)) {
      return paras.slice(i);
    }

    // 序号标题（一、/第X章 等）也要避免目录行
    if (looseChapterRe.test(t) && !isTocLine(paras[i].text)) {
      return paras.slice(i);
    }
  }

  return paras;
}

// ==============================================
// 智能章节拆分（统一入口）
// ==============================================

export interface SplitSection {
  title: string;
  content: string;
  type: string;
}

/** 智能章节拆分：支持带样式信息的段落或纯文本段落 */
export function smartSplitSections(paras: DocxParagraph[]): SplitSection[] {
  let effective = stripFrontMatter(paras);
  if (effective.length === 0) return [];

  // 过滤目录区域：遇到"目录"后，跳过所有带页码的目录行
  const filtered: DocxParagraph[] = [];
  let inToc = false;
  for (const para of effective) {
    const t = para.text.trim();
    if (/^目\s*录|Contents/i.test(t)) {
      inToc = true;
      continue;
    }
    if (inToc && isTocLine(para.text)) {
      continue;
    }
    inToc = false;
    filtered.push(para);
  }
  effective = filtered;

  const sections: SplitSection[] = [];
  let currentTitle = '未命名';
  let currentContent: string[] = [];
  let prevWasH1 = false;

  for (let i = 0; i < effective.length; i++) {
    const para = effective[i];
    const t = para.text.trim();
    if (!t) continue;

    const nextText = effective[i + 1]?.text.trim() || '';
    const isTitle = para.isHeading1 || para.isHeading2 || isTitleLine(t) || looksLikeTitle(t, nextText);

    if (isTitle) {
      const content = currentContent.join('\n').trim();
      const wasParentLike = prevWasH1 || /^[一二三四五六七八九十百千万]+、/.test(currentTitle);
      if (content || wasParentLike) {
        sections.push({
          title: currentTitle,
          content,
          type: detectSectionType(currentTitle),
        });
      } else if (sections.length > 0 && isSimilarTitle(sections[sections.length - 1].title, t)) {
        // 重复标题，重置当前章节
        currentTitle = t;
        currentContent = [];
        prevWasH1 = para.isHeading1;
        continue;
      }
      currentTitle = t;
      currentContent = [];
      prevWasH1 = para.isHeading1;
    } else {
      currentContent.push(para.text);
    }
  }

  // 保存最后一个章节
  const lastContent = currentContent.join('\n').trim();
  const lastIsParent = prevWasH1 || /^[一二三四五六七八九十百千万]+、/.test(currentTitle);
  if (lastContent || lastIsParent) {
    sections.push({
      title: currentTitle,
      content: lastContent,
      type: detectSectionType(currentTitle),
    });
  }

  // 后处理
  return postProcessSections(sections);
}

/** 后处理：合并空/短章节、丢弃目录等 */
function postProcessSections(sections: SplitSection[]): SplitSection[] {
  if (sections.length <= 1) return sections;

  const merged: SplitSection[] = [];

  for (const sec of sections) {
    // 跳过作为第一个章节的目录
    if (merged.length === 0 && /^目\s*录|Contents/i.test(sec.title)) {
      continue;
    }

    // 保护父级章节与结构性标题不被合并
    const isParentChapter = /^[一二三四五六七八九十百千万]+、/.test(sec.title)
      || /^第[一二三四五六七八九十\d]+章/.test(sec.title)
      || /^(摘\s*要|Abstract|前\s*言|引\s*言|绪\s*论|Introduction|结\s*论|总结|Conclusion|参考文献|References?|致\s*谢|Acknowledgements?|Acknowledgments?|附\s*录|Appendix)$/i.test(sec.title);

    // 图片/表格说明 → 合并到上一个章节（兜底保护）
    const isCaption = CAPTION_RE.test(sec.title);

    // 内容少于 60 字 → 可能是目录行、关键词行或错误拆分，合并到上一个
    if (sec.content.length < 60 && merged.length > 0 && !isParentChapter && !isCaption) {
      const prev = merged[merged.length - 1];
      prev.content += '\n\n' + sec.title + '\n' + sec.content;
      continue;
    }

    // 图片/表格说明章节 → 合并到上一个章节
    if (isCaption && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.content += '\n\n' + sec.title + '\n' + sec.content;
      continue;
    }

    // 标题与上一个高度相似 → 重复标题，合并内容
    if (merged.length > 0 && isSimilarTitle(merged[merged.length - 1].title, sec.title)) {
      merged[merged.length - 1].content += '\n\n' + sec.content;
      continue;
    }

    merged.push(sec);
  }

  return merged;
}

/** docx 章节自动拆分（纯文本兼容入口） */
export function autoSplitSections(text: string): SplitSection[] {
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const paras: DocxParagraph[] = lines.map(text => ({ text, isHeading1: false, isHeading2: false }));
  return smartSplitSections(paras);
}

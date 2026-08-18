export const CITATION_PATTERN = /\[(\d+(?:\s*[-–—,，、]\s*\d+)*)\]/g;

export function maskCitations(text: string): { maskedText: string; citations: string[] } {
  const citations: string[] = [];
  const maskedText = text.replace(CITATION_PATTERN, (match) => {
    citations.push(match);
    return `【引用标记${citations.length}】`;
  });
  return { maskedText, citations };
}

export function restoreCitations(text: string, citations: string[]): string {
  let restored = text;
  citations.forEach((citation, index) => {
    restored = restored.replaceAll(`【引用标记${index + 1}】`, citation);
  });
  return restored;
}

export function highlightCitationSentences(html: string): string {
  const matches = Array.from(html.matchAll(new RegExp(CITATION_PATTERN.source, 'g')));
  if (matches.length === 0) return html;

  const sentenceEndChars = '。！？!?\n';
  let result = '';
  let cursor = 0;

  for (const match of matches) {
    const citationStart = match.index ?? 0;
    const citationEnd = citationStart + match[0].length;

    let sentenceStart = citationStart;
    while (sentenceStart > cursor) {
      const previous = html[sentenceStart - 1];
      if (sentenceEndChars.includes(previous)) break;
      sentenceStart -= 1;
    }

    let sentenceEnd = citationEnd;
    while (sentenceEnd < html.length && !sentenceEndChars.includes(html[sentenceEnd])) {
      sentenceEnd += 1;
    }
    if (sentenceEnd < html.length && html[sentenceEnd] !== '\n') {
      sentenceEnd += 1;
    }

    if (sentenceStart < cursor) continue;

    result += html.slice(cursor, sentenceStart);
    result += `<mark class="citation-sentence">${html.slice(sentenceStart, sentenceEnd)}</mark>`;
    cursor = sentenceEnd;
  }

  result += html.slice(cursor);
  return result;
}

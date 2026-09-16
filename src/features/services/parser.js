import { normalizeForMatch } from './sitemap.js';

/* ------------------------------------------------------------------ *
 * Title-line detection
 * ------------------------------------------------------------------ */

/** Document-level headings that are never part of the service content. */
const DOCUMENT_TITLE_PATTERNS = [
  /^all services content$/i,
  /^services? content$/i,
  /^html$/i,
  /^markdown$/i,
  /^text$/i,
];

/** Explicitly labelled title lines, e.g. "Page Title: Residential Pest Control". */
const LABELLED_TITLE =
  /^\**\s*(page\s*title|page\s*name|service\s*page|page|title|url|slug)\s*\**\s*[:\-\u2013\u2014]\s*(.+)$/i;

function stripMarkdownHeading(line) {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

/**
 * Decide whether a single line is a page-title line rather than real content.
 *
 * A line is only treated as a title when we can be certain:
 *   - it is a document heading ("All Services Content", a code-fence label), or
 *   - it is explicitly labelled ("Page Title: ..."), or
 *   - it is prefixed with ">" (sitemap formatting pasted into the content), or
 *   - it matches one of the page names from the Page Auto Adjustment list.
 *
 * Short heading text is otherwise left alone, because real section headers
 * inside the content are short too.
 */
function classifyLine(line, pageNameKeys) {
  const bare = stripMarkdownHeading(line);

  if (!bare) return { drop: true };
  if (/^```/.test(bare)) return { drop: true };
  if (DOCUMENT_TITLE_PATTERNS.some((pattern) => pattern.test(bare))) return { drop: true };

  // ">" prefixed lines are sitemap formatting, never service content.
  if (/^>+\s*/.test(bare)) {
    return { drop: true, titleCandidate: bare.replace(/^[\s>]*>+\s*/, '') };
  }

  const labelled = bare.match(LABELLED_TITLE);
  if (labelled) return { drop: true, titleCandidate: labelled[2].trim() };

  if (pageNameKeys.size > 0 && pageNameKeys.has(normalizeForMatch(bare))) {
    return { drop: true, titleCandidate: bare };
  }

  return { drop: false, text: bare };
}

/**
 * Normalise pasted content into clean content lines, removing page-title lines.
 * Returns the kept lines plus the titles that were removed, in order.
 */
export function normalizeLines(text, pageNames = []) {
  const pageNameKeys = new Set(
    pageNames.map((name) => normalizeForMatch(name)).filter(Boolean)
  );

  const lines = [];
  const removedTitles = [];

  String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, '').trim())
    .forEach((line) => {
      if (!line) return;
      const result = classifyLine(line, pageNameKeys);
      if (result.drop) {
        if (result.titleCandidate) removedTitles.push(result.titleCandidate);
        return;
      }
      lines.push(result.text);
    });

  return { lines, removedTitles };
}

/* ------------------------------------------------------------------ *
 * Marker based parsing ("Section Type A / B / C")
 * ------------------------------------------------------------------ */

function getSectionType(line) {
  const match = line.match(/^section\s*type\s*([abc])$/i);
  return match ? match[1].toUpperCase() : null;
}

function cleanBullet(line) {
  return String(line ?? '')
    .replace(/^[-*\u2022\u25e6]\s*/, '')
    .replace(/^\d+\s*[.)]\s*/, '')
    .trim();
}

function readChunk(lines, startIndex, count) {
  const out = [];
  let i = startIndex;

  while (i < lines.length && out.length < count) {
    if (getSectionType(lines[i])) break;
    out.push(lines[i]);
    i += 1;
  }

  return { items: out, nextIndex: i };
}

function parseSectionA(lines, startIndex) {
  const chunk = readChunk(lines, startIndex, 5);
  const [mainHeader = '', subHeader = '', ...paragraphs] = chunk.items;
  return {
    section: { type: 'A', mainHeader, subHeader, paragraphs },
    nextIndex: chunk.nextIndex,
  };
}

function parseSectionB(lines, startIndex) {
  const chunk = readChunk(lines, startIndex, 4);
  const [header = '', ...paragraphs] = chunk.items;
  return {
    section: { type: 'B', header, paragraphs },
    nextIndex: chunk.nextIndex,
  };
}

function parseSectionC(lines, startIndex) {
  const chunk = readChunk(lines, startIndex, 8);
  const [header = '', openingSentence = '', ...rest] = chunk.items;
  const bullets = rest.slice(0, 5).map(cleanBullet).filter(Boolean);
  const closingSentence = rest[5] || '';

  return {
    section: { type: 'C', header, openingSentence, bullets, closingSentence },
    nextIndex: chunk.nextIndex,
  };
}

function parseMarkerBasedSections(lines) {
  const pages = [];

  let i = 0;
  let headlineLines = [];
  let currentSections = [];

  const flush = () => {
    if (currentSections.length === 0) return;
    pages.push({ sections: currentSections, headlineLines });
    currentSections = [];
    headlineLines = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const sectionType = getSectionType(line);

    if (!sectionType) {
      // Free text before the first marker of a page is treated as headline text.
      if (currentSections.length === 0) headlineLines.push(line);
      i += 1;
      continue;
    }

    if (sectionType === 'A' && currentSections.length > 0) flush();

    i += 1;

    let parsed;
    if (sectionType === 'A') parsed = parseSectionA(lines, i);
    else if (sectionType === 'B') parsed = parseSectionB(lines, i);
    else parsed = parseSectionC(lines, i);

    currentSections.push(parsed.section);
    i = parsed.nextIndex;
  }

  flush();

  return pages.map((page) => {
    const sectionA = page.sections.find((section) => section.type === 'A');
    return {
      headline: sectionA?.mainHeader || page.headlineLines[0] || '',
      subheadline: sectionA?.subHeader || page.headlineLines[1] || '',
      sections: page.sections,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Fixed pattern parsing (17 content lines per page)
 * ------------------------------------------------------------------ */

const PAGE_LINE_COUNT = 17;

function isLikelyHeadline(line) {
  if (!line) return false;
  if (line.includes('?')) return false;
  if (line.length < 10 || line.length > 120) return false;
  return /^["'A-Z0-9]/.test(line);
}

function isLikelySubheadline(line) {
  if (!line) return false;
  if (line.includes('?')) return false;
  return line.length >= 10 && line.length <= 200;
}

function parseFixedPatternSections(lines) {
  const pages = [];
  let i = 0;

  while (i + PAGE_LINE_COUNT - 1 < lines.length) {
    const headline = lines[i];
    const subheadline = lines[i + 1];

    if (!isLikelyHeadline(headline) || !isLikelySubheadline(subheadline)) {
      i += 1;
      continue;
    }

    const bullets = [11, 12, 13, 14, 15].map((offset) => lines[i + offset]);
    const questionLike = bullets.filter((line) => line.includes('?')).length;
    if (questionLike < 3) {
      i += 1;
      continue;
    }

    pages.push({
      headline,
      subheadline,
      sections: [
        {
          type: 'A',
          mainHeader: headline,
          subHeader: subheadline,
          paragraphs: [lines[i + 2], lines[i + 3], lines[i + 4]].filter(Boolean),
        },
        {
          type: 'B',
          header: lines[i + 5],
          paragraphs: [lines[i + 6], lines[i + 7], lines[i + 8]].filter(Boolean),
        },
        {
          type: 'C',
          header: lines[i + 9],
          openingSentence: lines[i + 10],
          bullets: bullets.map(cleanBullet).filter(Boolean),
          closingSentence: lines[i + 16] || '',
        },
      ],
    });

    i += PAGE_LINE_COUNT;
  }

  return pages;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

function runParsers(lines) {
  const markerPages = parseMarkerBasedSections(lines);
  if (markerPages.length > 0) return { parsed: markerPages, pattern: 'markers' };
  return { parsed: parseFixedPatternSections(lines), pattern: 'fixed' };
}

/**
 * Parse pasted service content into ordered page objects.
 *
 * @param {string} rawText      Pasted service content.
 * @param {string[]} pageNames  Ordered page names from Page Auto Adjustment.
 * @returns {{pages: Array, removedTitles: string[], pattern: string}}
 */
export function parseServicesContent(rawText, pageNames = []) {
  const names = Array.isArray(pageNames) ? pageNames : [];

  // Pass 1: strip page-title lines, including lines matching the page list.
  const stripped = normalizeLines(rawText, names);
  let best = { ...runParsers(stripped.lines), removedTitles: stripped.removedTitles };

  // Pass 2 (safety net): a real section header can coincide with a page name.
  // If removing those lines broke the page structure, keep the unstripped read.
  if (names.length > 0 && stripped.removedTitles.length > 0) {
    const kept = normalizeLines(rawText, []);
    const alternative = { ...runParsers(kept.lines), removedTitles: kept.removedTitles };
    if (alternative.parsed.length > best.parsed.length) best = alternative;
  }

  const { parsed, pattern, removedTitles } = best;

  // Page names are applied strictly by position, so the generated sequence
  // matches the pasted list exactly. Nothing is sorted or reordered.
  const pages = parsed.map((page, index) => {
    const name = names[index] || '';
    return {
      id: `page-${index + 1}`,
      index: index + 1,
      name: name || page.headline || `Page ${index + 1}`,
      isNamedFromSitemap: Boolean(name),
      headline: page.headline,
      subheadline: page.subheadline,
      sections: page.sections,
    };
  });

  return { pages, removedTitles, pattern };
}

/**
 * Flatten a page back into plain copyable text.
 * The page name is deliberately excluded - it is a label, not service content.
 */
export function buildPageCopyText(page) {
  const chunks = [];

  page.sections.forEach((section) => {
    if (section.type === 'A') {
      if (section.mainHeader) chunks.push(section.mainHeader);
      if (section.subHeader) chunks.push(section.subHeader);
      (section.paragraphs || []).filter(Boolean).forEach((p) => chunks.push(p));
      return;
    }

    if (section.type === 'B') {
      if (section.header) chunks.push(section.header);
      (section.paragraphs || []).filter(Boolean).forEach((p) => chunks.push(p));
      return;
    }

    if (section.type === 'C') {
      if (section.header) chunks.push(section.header);
      if (section.openingSentence) chunks.push(section.openingSentence);
      (section.bullets || [])
        .filter(Boolean)
        .forEach((bullet) => {
          const { question, answer } = splitQuestionAnswer(bullet);
          // Line break after the question mark, not a blank-line paragraph break,
          // so the Q and its A stay together as one copied unit.
          chunks.push(answer ? `${question}\n${answer}` : question);
        });
      if (section.closingSentence) chunks.push(section.closingSentence);
    }
  });

  return chunks.join('\n\n');
}

export function splitQuestionAnswer(text) {
  const trimmed = String(text ?? '').trim();
  const match = trimmed.match(/^(.+?\?)\s*(.+)$/);
  if (!match) return { question: trimmed, answer: '' };
  return { question: match[1].trim(), answer: match[2].trim() };
}

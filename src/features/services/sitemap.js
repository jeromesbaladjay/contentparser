/**
 * Sitemap / page-list parsing.
 *
 * Accepts either format:
 *
 *   >Residential Pest Control      (Format 1 - ">" prefixed)
 *   Residential Pest Control       (Format 2 - plain lines)
 *
 * Both are recognised automatically, mixed input is fine, and the order of the
 * pasted list is always preserved exactly. The ">" character is treated purely
 * as a formatting indicator and never becomes part of a page name.
 */

const DECORATION_ONLY = /^[>\-*\u2022\u25e6\s|=_.#]+$/;

/** Strip the formatting characters a page name may be pasted with. */
export function cleanPageName(line) {
  return String(line ?? '')
    // leading ">" markers (">", ">>", "> > ") used as depth/format indicators
    .replace(/^[\s>]*>+\s*/, '')
    // leading bullet characters
    .replace(/^\s*[-*\u2022\u25e6]\s+/, '')
    // leading "1." / "1)" numbering
    .replace(/^\s*\d+\s*[.)]\s+/, '')
    // markdown emphasis wrappers and stray pipes from table pastes
    .replace(/^\s*[|]\s*/, '')
    .replace(/\s*[|]\s*$/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a pasted sitemap / service list into an ordered array of page names.
 * Order is preserved exactly as pasted. Blank and decoration-only lines are
 * dropped; nothing is sorted, deduplicated or reordered.
 */
export function parseSitemap(rawText) {
  if (!rawText) return [];

  return String(rawText)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, ''))
    .filter((line) => !/^\s*```/.test(line))
    .filter((line) => !DECORATION_ONLY.test(line))
    .map(cleanPageName)
    .filter(Boolean);
}

/** Normalised key used to compare a content line against a page name. */
export function normalizeForMatch(value) {
  return cleanPageName(value)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9'"]+/g, ' ')
    .trim();
}

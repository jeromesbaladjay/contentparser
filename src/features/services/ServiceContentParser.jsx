import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { parseServicesContent, buildPageCopyText, splitQuestionAnswer } from './parser.js';

const CONTENT_PLACEHOLDER = `Paste the service content here.

Page title lines are removed automatically, so titles never end up inside the content.`;

/** Strip bullet/number decoration before putting text on the clipboard. */
function toPlainCopyText(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[-*\u2022\u25e6]\s+/, '')
        .replace(/^\s*\d+\s*[.)]\s+/, '')
    )
    .join('\n')
    .trim();
}

/** One click-to-copy block of text. */
function CopyBlock({ id, text, className = '', copiedId, copiedIds, onCopy, as: Tag = 'p' }) {
  const value = String(text ?? '').trim();
  if (!value) return null;

  const justCopied = copiedId === id;
  const wasCopied = copiedIds.has(id);

  const copy = () => onCopy(value, id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={copy}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          copy();
        }
      }}
      title="Click to copy"
      className={[
        'group relative cursor-pointer rounded-md border px-3 py-2 pr-24 transition-all duration-200',
        wasCopied
          ? 'border-emerald-500/70 bg-emerald-500/10 shadow-[inset_3px_0_0_0_rgb(16_185_129)] hover:bg-emerald-500/15'
          : 'border-transparent hover:border-line hover:bg-wash',
        justCopied ? 'ring-2 ring-emerald-400/60' : '',
      ].join(' ')}
    >
      <Tag className={className}>{value}</Tag>
      <span
        className={[
          'pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-all',
          wasCopied
            ? 'bg-emerald-400/15 text-emerald-300 opacity-100'
            : 'bg-wash text-faint opacity-0 group-hover:opacity-100',
        ].join(' ')}
      >
        {wasCopied ? <><Check className="h-3 w-3" /> Copied</> : 'Copy'}
      </span>
    </div>
  );
}

function SectionBlock({ page, section, sectionIndex, copiedId, copiedIds, onCopy }) {
  const key = (suffix) => `${page.id}-${sectionIndex}-${suffix}`;
  const paragraphs = (section.paragraphs || []).filter(Boolean);

  if (section.type === 'A' || section.type === 'B') {
    const heading = section.type === 'A' ? section.subHeader : section.header;

    return (
      <div className="space-y-1">
        <CopyBlock
          as="h4"
          id={key('heading')}
          text={heading}
          className="text-base font-semibold text-ink"
          copiedId={copiedId}
          copiedIds={copiedIds}
          onCopy={onCopy}
        />

        <CopyBlock
          id={key('body')}
          text={paragraphs.join('\n\n')}
          className="whitespace-pre-line text-[15px] leading-7 text-ink-soft"
          copiedId={copiedId}
          copiedIds={copiedIds}
          onCopy={onCopy}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <CopyBlock
        as="h4"
        id={key('heading')}
        text={section.header}
        className="text-base font-semibold text-ink"
        copiedId={copiedId}
        copiedIds={copiedIds}
        onCopy={onCopy}
      />

      <CopyBlock
        id={key('opening')}
        text={section.openingSentence}
        className="text-[15px] leading-7 text-ink-soft"
        copiedId={copiedId}
        copiedIds={copiedIds}
        onCopy={onCopy}
      />

      <ul className="space-y-1 border-l border-line pl-3">
        {(section.bullets || []).map((bullet, index) => {
          const { question, answer } = splitQuestionAnswer(bullet);

          return (
            <li key={index}>
              <CopyBlock
                id={key(`q-${index}`)}
                text={question}
                className="text-[15px] font-medium leading-7 text-ink"
                copiedId={copiedId}
                copiedIds={copiedIds}
                onCopy={onCopy}
              />

              <CopyBlock
                id={key(`a-${index}`)}
                text={answer}
                className="text-[15px] leading-7 text-muted"
                copiedId={copiedId}
                copiedIds={copiedIds}
                onCopy={onCopy}
              />
            </li>
          );
        })}
      </ul>

      <CopyBlock
        id={key('closing')}
        text={section.closingSentence}
        className="text-[15px] leading-7 text-ink-soft"
        copiedId={copiedId}
        copiedIds={copiedIds}
        onCopy={onCopy}
      />
    </div>
  );
}

function PageCard({ page, isOpen, onToggle, copiedId, copiedIds, onCopy }) {
  const pageCopyId = `${page.id}-all`;
  const preview =
    page.subheadline ||
    page.headline ||
    page.sections[0]?.paragraphs?.[0] ||
    '';

  return (
    <article className="rounded-xl border border-line bg-paper">
      <div className="flex items-start gap-4 p-5">
        <span className="mt-0.5 w-6 shrink-0 text-sm tabular-nums text-faint">
          {page.index}
        </span>

        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle();
            }
          }}
          aria-expanded={isOpen}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <h3
            className="truncate text-[17px] font-semibold tracking-tight text-ink"
            title={page.name}
          >
            {page.name}
          </h3>

          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
            {preview}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(buildPageCopyText(page), pageCopyId)}
            className="btn-quiet"
            aria-label={`Copy content for ${page.name}`}
          >
            {copiedId === pageCopyId ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}

            <span className="hidden sm:inline">
              {copiedId === pageCopyId ? 'Copied' : 'Copy page'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${page.name}` : `Expand ${page.name}`}
            className="btn-quiet px-2"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-5 border-t border-line px-5 pb-5 pt-4">
          <CopyBlock
            as="h4"
            id={`${page.id}-headline`}
            text={page.headline}
            className="text-lg font-semibold tracking-tight text-ink"
            copiedId={copiedId}
            copiedIds={copiedIds}
            onCopy={onCopy}
          />

          {page.sections.map((section, sectionIndex) => (
            <SectionBlock
              key={`${page.id}-${section.type}-${sectionIndex}`}
              page={page}
              section={section}
              sectionIndex={sectionIndex}
              copiedId={copiedId}
              copiedIds={copiedIds}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function ServiceContentParser() {
  const [contentText, setContentText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [openPages, setOpenPages] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [copiedIds, setCopiedIds] = useState(() => new Set());
  const copyTimer = useRef(null);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current);
      }
    },
    []
  );

  const handleCopy = useCallback(async (text, id) => {
    const value = toPlainCopyText(text);
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
    } catch {
      setError(
        'Copying is blocked by the browser. Select the text manually instead.'
      );
      return;
    }

    setCopiedId(id);
    setCopiedIds((prev) => new Set(prev).add(id));

    if (copyTimer.current) {
      window.clearTimeout(copyTimer.current);
    }

    copyTimer.current = window.setTimeout(() => {
      setCopiedId(null);
    }, 1800);
  }, []);

  const handleGenerate = () => {
    // Service content is required.
    if (!contentText.trim()) {
      setError('Please enter the service content before generating pages.');
      return;
    }

    let parsed;

    try {
      parsed = parseServicesContent(contentText);
    } catch (err) {
      setError(`The content could not be read: ${err.message}`);
      return;
    }

    if (parsed.pages.length === 0) {
      setError(
        'No page structure was found in that content. Check that full pages were pasted.'
      );
      setResult(null);
      return;
    }

    setError('');
    setResult(parsed);
    setOpenPages(new Set());
    setCopiedIds(new Set());
    setCopiedId(null);
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setOpenPages(new Set());
    setCopiedIds(new Set());
    setCopiedId(null);
  };

  const togglePage = (pageId) => {
    setOpenPages((prev) => {
      const next = new Set(prev);

      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }

      return next;
    });
  };

  const allOpen =
    Boolean(result) && openPages.size === result.pages.length;

  const toggleAll = () => {
    if (!result) return;

    setOpenPages(
      allOpen
        ? new Set()
        : new Set(result.pages.map((page) => page.id))
    );
  };

  return (
    <div className="space-y-8">
      {!result ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Turn pasted content into ordered pages
            </h2>

            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">
              Paste the service content before generating. Pages are generated
              in the order they appear in the content, and any page title line
              found in the content is removed.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor="service-content"
                className="text-sm font-medium text-ink"
              >
                Service content <span className="text-red-600">*</span>
              </label>

              <span className="text-xs text-faint">
                {contentText.trim()
                  ? `${contentText.trim().length.toLocaleString()} characters`
                  : 'Required'}
              </span>
            </div>

            <textarea
              id="service-content"
              value={contentText}
              onChange={(event) => {
                setContentText(event.target.value);
                if (error) setError('');
              }}
              placeholder={CONTENT_PLACEHOLDER}
              spellCheck={false}
              className="field min-h-[380px] p-4 text-[15px] leading-7"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              className="btn-primary"
            >
              Generate pages
            </button>

            {contentText && (
              <button
                type="button"
                onClick={() => {
                  setContentText('');
                  setError('');
                }}
                className="btn-quiet"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {result.pages.length}{' '}
                {result.pages.length === 1 ? 'page' : 'pages'} generated
              </h2>

              <p className="mt-1 text-sm text-muted">
                Listed in the order you pasted them. Click any line to copy
                it.

                {result.removedTitles.length > 0 &&
                  ` ${result.removedTitles.length} title ${
                    result.removedTitles.length === 1 ? 'line was' : 'lines were'
                  } removed from the content.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="btn-quiet"
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    result.pages.map(buildPageCopyText).join('\n\n\n'),
                    'all-pages'
                  )
                }
                className="btn-quiet"
              >
                {copiedId === 'all-pages' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}

                {copiedId === 'all-pages' ? 'Copied' : 'Copy all'}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="btn-primary"
              >
                Edit input
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {result.pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                isOpen={openPages.has(page.id)}
                onToggle={() => togglePage(page.id)}
                copiedId={copiedId}
                copiedIds={copiedIds}
                onCopy={handleCopy}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-ink bg-wash px-4 py-3 text-sm leading-6 text-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}

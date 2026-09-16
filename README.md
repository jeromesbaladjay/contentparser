# Service Content Parser

A single-purpose browser tool: paste service content, paste your page list, and get
structured, click-to-copy pages in the exact order of your list.

## Run it

```bash
npm install
npm run dev
```

Build for production with `npm run build`, preview with `npm run preview`.

## How it works

**Service content** — paste the raw content for all pages. The parser recognises two
layouts:

1. Explicit markers (`Section Type A` / `Section Type B` / `Section Type C`).
2. The fixed 17-line page pattern: headline, sub-headline, three paragraphs, a section
   header with three paragraphs, then an FAQ header, opening line, five question/answer
   lines and a closing line.

Page title lines are stripped automatically so they never end up inside the content. A
line is treated as a title when it is a document heading (`All Services Content`, a code
fence label), a labelled title (`Page Title: ...`), a `>`-prefixed line, or an exact match
for one of the names in your page list. If removing those lines would break the page
structure, the parser falls back to the unstripped reading, so a genuine section header
that happens to share a page name is never lost.

**Page auto adjustment** — paste your sitemap or service list in either format:

```text
>Residential Pest Control      Residential Pest Control
>Commercial Pest Control   or  Commercial Pest Control
>Lawn and Ornamental Services  Lawn and Ornamental Services
```

Both are detected automatically. The `>` is a formatting indicator only and never appears
in a page name. Bullets (`-`, `*`) and numbering (`1.`) are stripped the same way.

Names are applied **strictly by position**: list item 1 names page 1, item 2 names page 2,
and so on. Nothing is alphabetised, reordered or deduplicated. If the list is shorter than
the content, the remaining pages keep their own headline as the name and a note says so.

The page list is optional — without it, each page is named after its own headline.

## Copying

Click any block to copy it. All paragraphs under a heading are one block, so a
multi-paragraph body copies in a single click with its blank lines intact. "Copy page"
copies one full page, "Copy all" copies everything. The page name is a label, so it is
never included in the copied content.

## Theme

Dark is the default. The sun/moon button in the header switches to light, and the choice
is remembered in `localStorage`. Colours live as CSS variables in `src/index.css`: the
`:root` block holds the dark values and `:root[data-theme="light"]` holds the light ones.

## Project layout

```
src/
  App.jsx                                  app shell and theme toggle
  index.css                                dark/light colour tokens, component classes
  features/services/
    ServiceContentParser.jsx               the tool UI
    parser.js                              content parsing, title removal, page mapping
    sitemap.js                             page-list parsing ("> " and plain formats)
  useTheme.js                              dark/light theme state
```

`All Services Content.txt` is a sample input you can paste to try the tool.

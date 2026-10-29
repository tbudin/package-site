# package-site

The documentation site every package gets. One shared chrome, one set of form
controls, static pages with real URLs, and the SEO and AIO files emitted from
the package's own metadata.

```bash
node ../package-site/bin/package-site.mjs build   # write docs/
node ../package-site/bin/package-site.mjs check   # build, then read it back
node ../package-site/bin/package-site.mjs serve   # build, then serve it
```

## Why it generates files

The sites it replaces were one `index.html` with every screen drawn by
JavaScript from a `PAGES` array. That is one URL, one title, one description
and an empty `<body>` to anything that does not run a script — which includes
most AI crawlers. No amount of meta tags fixes that.

So each page is written to its own file, with its content already in it. The
browser then only has to make the controls work.

## What a package provides

```
site/
  site.config.js     tokens, fonts, URLs, credit — everything package-specific
  pages.js           the pages; imported by the generator AND by the browser
  <anything>.js      other modules pages.js imports
  static/            files served as they are: og.png, screenshots
```

Everything in `site/` ending in `.js` is copied to `docs/assets/`, and the
generator imports `pages.js` **from there** — so Node and the browser load the
same file by the same relative paths, and the prerendered HTML cannot drift
from what a visitor sees.

### A page

```js
{
  id: 'kpi',                    // the URL: /kpi/ — the first page is the root
  group: 'Variants',            // sidebar heading
  title: 'KPI',                 // the <h1>
  nav: 'KPI',                   // the sidebar label, when the title is long
  description: '…',             // its own, 40+ characters; check fails without one
  keywords: 'tile dashboard',   // only for the sidebar's find box
  lead: '…',                    // HTML
  state: { h: 40 },             // initial control values
  controls: [ … ],              // declared, never written as markup
  render: (state, data, ctx) => '…',   // the preview; data may be null
  code:   (state, data, ctx) => '…',   // the code box
  after:  (state, data, ctx) => '…',   // anything below it
  ref: [[ 'prop', 'default', 'what it does' ]],
  faq: [{ q: '…', a: '…' }],    // visible, and FAQPage structured data
}
```

`ctx.link('kpi')` builds a link to another page from whatever depth this one
is at. Never hardcode `../`: the first page is the site root and the rest are
a folder each.

`render` must return something useful when `data` is `null`. Export
`prefetch()` and the generator calls it once, so a page that needs the network
still states real figures in the HTML a crawler is handed.

### Controls

Declared, so a select in the header and a select in a playground are the same
object. `type` is one of `select`, `range`, `toggle`, `text`, `textarea`,
`segment`, `colour`; with `unit`, `note`, `wide`, and `when(state)` to hide one
that does not apply.

Site-wide settings go in `export const globals`, with `setGlobals(g)` to
receive them. They sit in the header on a desktop, move into the drawer on a
phone, and survive a page load. One may depend on another — `when(globals)`
hides a free-text field until a select says `other`.

A global `select` may carry `icons`: a map from option value to a standalone
SVG document, or to `{ light, dark }` where the mark needs a different ink in
each theme. The select then draws the mark for its current value inside the
box. That is done in CSS alone — `:has(option[value="…"]:checked)` — so it is
right on the first paint, right after a change, and right with scripting off.
Nothing swaps it at runtime, and the slot is reserved whether or not a value
has a mark, so the box never resizes under the pointer.

A dark-mode switch is added to that row by the template. Until it is pressed
nothing is stored and the page follows the system; after that the choice is
kept per viewer and applied before the first paint, so the page never flashes
the other theme.

### What the config can also turn on

None of these are needed to build a site; each is off until the config says
otherwise.

| Key | What it does |
|---|---|
| `changelog` | A path to a changelog, `CHANGELOG.md` by default. Parsed as changesets writes it and appended as a real page, so the nav, the pager, the sitemap and `llms.txt` pick it up. An Atom `feed.xml` is written beside it and linked from every page. Release dates come from `git log`, falling back to the file's own timestamp. |
| `changelogGroup`, `changelogTitle` | Where that page sits in the nav, and what it is called. |
| `editBranch` | Turns on the footer's Edit link, pointing at the file the pages are written in. Off by default: guessing a branch name gives a 404. |
| `latestVersion`, `latestUrl` | When the version being documented is not the current one, every page says so above the breadcrumbs. |

Search needs no configuration. The generator writes `assets/search.json` from
the markdown it already produces, and the find box reads it on the first
keystroke — the title filter answers before that, and goes on answering if the
index never arrives.

### Look

A package sets tokens. It does not restyle the chrome — out-specifying
`chrome.css` is how two sites drift apart.

```js
theme: {
  tokens: { '--accent': '#9a4a1e', '--f-head': '"Newsreader", serif' },
  dark:   { '--accent': '#e09b6a' },
  extra:  '.kpi-n { font-variant-numeric: tabular-nums; }',
}
```

Colour, type, shape, stage and nav tokens are listed at the top of
`assets/chrome.css`.

## What gets written

| | |
|---|---|
| `<slug>/index.html` | the page, content already in it |
| `<slug>/index.md` | the same page as markdown, linked with `rel="alternate"` |
| `sitemap.xml` | every page |
| `robots.txt` | allow all, with the AI crawlers named explicitly |
| `llms.txt` | the [llmstxt.org](https://llmstxt.org) index |
| `llms-full.txt` | the whole documentation in one file |
| `404.html`, `.nojekyll` | |

Per page: canonical, own title and description, `rel=prev/next`, Open Graph,
Twitter card, theme-color, and JSON-LD — `BreadcrumbList` everywhere,
`SoftwareSourceCode` + `SoftwareApplication` + `WebSite` on the front page,
`TechArticle` elsewhere, `FAQPage` where a page declares `faq`.

## The credit

The footer is [`@nodsto/credit`](https://github.com/tbudin/nods), built from a
record describing the site: the project, who made it, and the fonts and hosts
it was made with. The package is optional — without it the footer falls back
to plain markup and the build says so.

nods is not published yet, so it is resolved through a link:

```bash
mkdir -p node_modules/@nodsto
ln -s ../../../nods/packages/credit node_modules/@nodsto/credit
ln -s ../../../nods/packages/record node_modules/@nodsto/record
```

## check

`check` builds and then reads the result back off disk. It fails on a missing
or repeated canonical, a page with no description of its own, a page whose
`<article>` holds almost no text (so it was never really prerendered), JSON-LD
that does not parse, a local link or asset pointing at nothing, a sitemap that
disagrees with the pages, and navigation left as a fragment.

Every one of those rules has been made to fail on purpose. A check that has
never failed is not a check.

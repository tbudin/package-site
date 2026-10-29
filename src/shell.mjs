/* One page, start to finish.

   Everything a reader or a crawler needs is written here, at build time: the
   nav, the breadcrumbs, the prose, the preview as it looks before anyone
   touches a control, the code, the parameters, the questions and the credit.
   chrome.js then makes the controls work. Nothing of substance waits for it.
*/

import { esc, playground, codeBox, refTable, faqBlock, initialState, context } from '../assets/ui.js';
import { head, breadcrumbs, pageTitle } from './head.mjs';

const href = (rel, page) => (page.slug ? `${rel}${page.slug}/` : rel || './');

function sidebar(site, pages, page, rel) {
  const groups = [...new Set(pages.map((p) => p.group).filter(Boolean))];
  const order = site.groups?.length ? site.groups.filter((g) => groups.includes(g)).concat(groups.filter((g) => !site.groups.includes(g))) : groups;
  /* The group labels are not document headings: they sit before the page's
     own <h1>, so as headings they put eight h4s ahead of the page title for
     anyone moving through the document by heading. A named group says the
     same thing to a screen reader without entering the outline. */
  return order.map((g, i) =>
    `<div class="nav-group" role="group" aria-labelledby="nav-g${i}">` +
    `<p class="nav-group-label" id="nav-g${i}">${esc(g)}</p>` +
    pages.filter((p) => p.group === g).map((p) => {
      const words = [p.title, p.nav || '', p.group, p.keywords || ''].join(' ').toLowerCase();
      /* The sidebar wants a label, not a headline: a page may carry a long
         title for its <h1> and a short one for the nav. */
      return `<a href="${esc(href(rel, p))}" data-id="${esc(p.id)}" data-words="${esc(words)}"` +
        `${p === page ? ' aria-current="page"' : ''}>${esc(p.nav || p.title)}</a>`;
    }).join('') + `</div>`).join('');
}

/* Light and dark both exist in the stylesheet; this is the control that picks
   between them.

   role="switch" rather than a checkbox dressed up as one: it is on or off and
   nothing is submitted. Until it is pressed no theme is written down and the
   page keeps following the system, so an OS that turns dark at sunset takes
   the page with it. The visible word sits inside the accessible name, so the
   label and the name agree. */
const THEME_SWITCH =
  `<button class="switch" type="button" role="switch" id="g-theme" aria-checked="false" aria-label="Dark mode">` +
  `<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>` +
  `<span class="switch-text">Dark</span></button>`;

function globalSettings(site, mod) {
  const g = Object.fromEntries((mod?.globals || []).map((c) => [c.k, c.v]));
  return `<div class="top-ctl" id="settings" role="group" aria-label="Site settings">` +
    (mod?.globals || []).map((c) => {
      const id = `g-${c.k}`;
      /* A header setting may depend on another — a free-text field behind an
         "other" option — so it is written out and hidden, not left out. */
      const off = c.when && !c.when(g) ? ' hidden' : '';
      if (c.type === 'select') {
        /* A select that declares icons draws its own value's mark inside the
           box, from CSS alone — nothing to write here, and nothing to keep in
           step at runtime. selectMarkCss in theme.mjs writes those rules. */
        return `<label for="${id}"${off}>${esc(c.label)} <select id="${id}" data-k="${esc(c.k)}">` +
          c.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(v)}"${String(v) === String(g[c.k]) ? ' selected' : ''}>${esc(l)}</option>`; }).join('') +
          `</select></label>`;
      }
      if (c.type === 'toggle') {
        return `<label for="${id}"${off}><input type="checkbox" id="${id}" data-k="${esc(c.k)}"${g[c.k] ? ' checked' : ''}> ${esc(c.label)}</label>`;
      }
      return `<label for="${id}"${off}>${esc(c.label)} <input type="text" id="${id}" data-k="${esc(c.k)}" value="${esc(g[c.k])}" size="12" autocomplete="off" spellcheck="false"></label>`;
    }).join('') + THEME_SWITCH + `</div>`;
}

function footer(site, credit, rel) {
  const links = [
    site.repo && { href: site.repo, label: 'GitHub' },
    site.npm && { href: site.npm, label: 'npm' },
    /* Every page is also written as markdown beside its HTML. The <head> says
       so to a machine; this says so to a reader who wants to paste the page
       somewhere clean. It is relative to the page, so one href covers both the
       root and a folder. */
    { href: 'index.md', label: 'Markdown' },
    /* Every page of a site like this one is written in the same file, so the
       honest link is to that file rather than a per-page fiction. Off unless
       the config names a branch, because guessing one gives a 404. */
    site.editBranch && site.repo && {
      href: `${site.repo}/edit/${site.editBranch}/${site.siteDir || 'site'}/pages.js`,
      label: 'Edit',
    },
    { href: `${rel}llms.txt`, label: 'llms.txt' },
  ].filter(Boolean);
  return `<footer class="colophon">` +
    credit.html +
    `<span class="spacer"></span>` +
    `<nav aria-label="Elsewhere">${links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</nav>` +
    `</footer>`;
}

export function renderPage({ site, pages, page, mod, credit, data = null }) {
  const rel = page.slug ? '../' : '';
  const state = initialState(page);
  const ctx = context({ site, page, rel: rel || './' });
  const i = pages.indexOf(page);
  const prev = pages[i - 1];
  const next = pages[i + 1];

  /* Built with whatever prefetch returned, or nothing. Either way the page
     must draw something now: this is the HTML everything but a browser sees. */
  const content = [
    `<h1 class="title">${esc(page.title)}</h1>`,
    page.lead ? `<p class="lead">${page.lead}</p>` : '',
    page.before ? page.before(state, data, ctx) : '',
    page.render && !page.hidePlay
      ? playground({
          stage: page.render(state, data, ctx),
          controls: page.controls || [],
          state,
          tools: page.tools || '',
          heading: page.controlsHeading || 'Settings',
        })
      : '',
    page.code ? `<p class="code-label">${esc(page.codeLabel || 'The code for what is on screen')}</p>${codeBox(page.code(state, data, ctx), 'code')}` : '',
    page.after ? page.after(state, data, ctx) : '',
    refTable(page.ref, page.refHeaders, page.refTitle),
    faqBlock(page.faq),
  ].filter(Boolean).join('\n');

  /* The content is its own element so that a check for "is this page actually
     prerendered" measures the page and not the nav, the pager and the credit
     that surround every one of them. */
  /* Docs for a version that is no longer the one people install are worse
     than no docs, because nothing on the page says so. Off unless the config
     names a newer version, so a package with one line of history shows
     nothing. */
  const old = site.latestVersion && site.latestVersion !== site.version
    ? `<p class="stale" role="note">You are reading ${esc(site.name)} <b>${esc(site.version)}</b>. ` +
      `The current version is <a href="${esc(site.latestUrl || site.baseUrl)}">${esc(site.latestVersion)}</a>.</p>`
    : '';

  const body = [
    old,
    breadcrumbs(site, page, rel || './'),
    /* Changing a site-wide setting redraws the page under the reader with no
       warning at all. role="status" is the polite way to say what happened:
       announced once it settles, never interrupting. Empty until then. */
    `<p class="sr" id="say" role="status"></p>`,
    `<article>\n${content}\n</article>`,
    `<nav class="pager" aria-label="Previous and next page">` +
      (prev ? `<a href="${esc(href(rel, prev))}"><small>Previous</small>${esc(prev.nav || prev.title)}</a>` : '<span></span>') +
      (next ? `<a href="${esc(href(rel, next))}" style="text-align:right"><small>Next</small>${esc(next.nav || next.title)}</a>` : '') +
    `</nav>`,
    footer(site, credit, rel),
  ].filter(Boolean).join('\n');

  return `<!doctype html>
<html lang="${esc(site.lang || 'en')}">
<head>
${head(site, page, pages, rel)}
</head>
<script>/* before paint, or the page flashes the other theme */try{var t=localStorage.getItem('package-site:theme');if(t&&t!=='system')document.documentElement.dataset.theme=t;}catch(e){}</script>
<body data-page="${esc(page.id)}">
<a class="skip" href="#page">Skip to the page</a>
${site.beforeHeader || ''}
<header class="top">
  <button class="btn menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="side">
    ${site.menuIcon || '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'}<span>Menu</span>
  </button>
  <a class="brand" href="${esc(rel || './')}"><b>${esc(site.name)}</b><span>v${esc(site.version)}</span></a>
  <span class="here" id="here">${esc(page.home ? '' : page.title)}</span>
${globalSettings(site, mod)}
${(site.topLinks || []).map((l) => `  <a class="top-link" href="${esc(l.href)}">${esc(l.label)}</a>`).join('\n')}
</header>

<div class="scrim" id="scrim" hidden></div>
<div class="wrap">
  <nav class="side" id="side" aria-label="Pages">
    <div class="side-head"><b>${esc(site.name)}</b><button class="btn" type="button" id="side-close">Close</button></div>
    <div class="side-settings" id="side-settings"></div>
    <label class="find" for="find"><span class="sr">${esc(site.findLabel || 'Find a page')}</span><input type="search" id="find" placeholder="${esc(site.findLabel || 'Find a page')}" autocomplete="off"><kbd>/</kbd></label>
    <div id="nav-list">
${sidebar(site, pages, page, rel)}
    </div>
    <div id="results" class="results" hidden></div>
    <p class="nothing" id="nothing" hidden>${esc(site.noMatch || 'Nothing matches.')}</p>
  </nav>
  <main id="page" class="page" tabindex="-1">
${body}
  </main>
</div>
<script type="module" src="${esc(rel)}assets/chrome.js"></script>
</body>
</html>
`;
}

export { pageTitle };

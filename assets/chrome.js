/* package-site hydration.
   The HTML is already complete when this runs: every page is a real file with
   its content written in, so this script only has to make the moving parts
   move. Navigation is left to the browser — real links between real pages,
   which is both the fastest thing and the only thing a crawler can follow.

   It expects, on <body>:
     data-page   the page id, matching an entry in pages.js
   and, next to itself in the same folder, the package's pages.js.
*/

import { initialState, control, controlPanel, playground, highlight, esc, context } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NARROW = matchMedia('(max-width: 860px)');

/* ---------- drawer ---------- */

const side = $('#side');
const scrim = $('#scrim');
const menuBtn = $('#menu-btn');

/* Everything that is not the drawer, while the drawer is over it. Without
   this the page behind stays in the tab order and the focus walks off into
   content nobody can see. */
const behind = () => [$('.top'), $('#page')].filter(Boolean);

function setMenu(open) {
  if (!side) return;
  side.classList.toggle('open', open);
  if (scrim) scrim.hidden = !open;
  if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  for (const el of behind()) el.inert = open && NARROW.matches;
  if (open) {
    const cur = $('a[aria-current]', side);
    if (cur) cur.scrollIntoView({ block: 'center' });
    ($('#side-close') || side).focus();
  }
}

menuBtn?.addEventListener('click', () => setMenu(!side.classList.contains('open')));
scrim?.addEventListener('click', () => setMenu(false));
$('#side-close')?.addEventListener('click', () => { setMenu(false); menuBtn?.focus(); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && side?.classList.contains('open')) { setMenu(false); menuBtn?.focus(); }
});
NARROW.addEventListener('change', () => { if (!NARROW.matches) setMenu(false); });

/* The site-wide settings live in the header on a desktop and in the drawer on
   a phone, where there is room for them. Same element, moved. */
const settings = $('#settings');
const sideSettings = $('#side-settings');
const header = $('.top');
function placeSettings() {
  if (!settings) return;
  const home = NARROW.matches ? sideSettings : header;
  if (home && settings.parentElement !== home) home.appendChild(settings);
}
placeSettings();
NARROW.addEventListener('change', placeSettings);

/* ---------- find a page ---------- */

/* Two searches, one box. Filtering the nav by title answers instantly and
   works before anything is fetched; the index behind it reads the pages
   themselves and is pulled in on the first keystroke, because most visits
   never type here at all. Until it arrives, and if it never does, the title
   filter is the whole feature rather than a broken half of one. */

const find = $('#find');
const navList = $('#nav-list');
const nothing = $('#nothing');
const results = $('#results');

let index = null;
let indexing = false;

async function loadIndex() {
  if (index || indexing) return;
  indexing = true;
  try {
    const r = await fetch(new URL('./search.json', import.meta.url));
    index = await r.json();
  } catch { index = null; /* offline, or no index: the title filter stands */ }
  indexing = false;
}

const snippet = (text, term) => {
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return text.slice(0, 110);
  const from = Math.max(0, at - 50);
  return (from ? '…' : '') + text.slice(from, at + term.length + 70);
};

/* Every term has to appear somewhere, and where it appears decides the rank:
   a page called "Bands" beats one that mentions bands in passing. */
function rank(terms) {
  const out = [];
  for (const page of index) {
    const head = `${page.t} ${page.n} ${page.g}`.toLowerCase();
    const body = `${page.d} ${page.x}`.toLowerCase();
    let score = 0;
    let every = true;
    for (const term of terms) {
      if (head.includes(term)) score += head.startsWith(term) ? 10 : 6;
      else if (page.d.toLowerCase().includes(term)) score += 3;
      else if (body.includes(term)) score += 1;
      else { every = false; break; }
    }
    if (every && score > 0) out.push({ page, score, where: page.x && page.x.toLowerCase().includes(terms[0]) ? page.x : page.d });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

function showResults(hits, terms, depth) {
  results.innerHTML = hits.map(({ page, where }) => {
    const text = esc(snippet(where, terms[0]));
    const marked = text.replace(new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<mark>$1</mark>');
    return `<a href="${depth}${page.u}"><b>${esc(page.n)}</b><span>${marked}</span></a>`;
  }).join('');
  results.hidden = !hits.length;
  navList.hidden = hits.length > 0;
}

function restoreNav() {
  results.hidden = true;
  results.innerHTML = '';
  navList.hidden = false;
}

if (find && navList) {
  /* The brand already points at the site root from wherever this page sits,
     so the depth is read off the page rather than worked out a second way. */
  const depth = $('.brand')?.getAttribute('href') || './';

  find.addEventListener('input', () => {
    const q = find.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);

    let hits = 0;
    for (const a of $$('a', navList)) {
      const on = !q || (a.dataset.words || '').includes(q);
      a.hidden = !on;
      if (on) hits++;
    }
    for (const g of $$('.nav-group', navList)) {
      g.hidden = !$$('a', g).some((a) => !a.hidden);
    }

    if (!results || terms.length === 0 || q.length < 2) {
      if (results) restoreNav();
      if (nothing) nothing.hidden = hits > 0;
      return;
    }

    if (!index) {
      loadIndex().then(() => { if (find.value.trim().toLowerCase() === q) find.dispatchEvent(new Event('input')); });
      if (nothing) nothing.hidden = hits > 0;
      return;
    }

    const found = rank(terms);
    showResults(found, terms, depth);
    if (nothing) nothing.hidden = found.length > 0;
  });

  addEventListener('keydown', (e) => {
    if (e.key === '/' && e.target === document.body) { e.preventDefault(); setMenu(NARROW.matches); find.focus(); }
    if (e.key === 'Escape' && e.target === find) { find.value = ''; find.dispatchEvent(new Event('input')); }
  });
}

/* ---------- theme ---------- */

/* The stylesheet has both themes and follows the system until this switch is
   touched; after that the choice is written down and followed instead. A
   failed read of the store is nothing to handle beyond carrying on with what
   the system says. */
const TKEY = 'package-site:theme';
const DARK = matchMedia('(prefers-color-scheme: dark)');
const stored = () => { try { return localStorage.getItem(TKEY); } catch { return null; } };
const isDark = () => (stored() ? stored() === 'dark' : DARK.matches);

const themeSwitch = $('#g-theme');
if (themeSwitch) {
  const paint = () => themeSwitch.setAttribute('aria-checked', String(isDark()));
  paint();
  themeSwitch.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(TKEY, next); } catch { /* private window */ }
    paint();
  });
  /* Still untouched, so the system is still in charge of it. */
  DARK.addEventListener('change', () => { if (!stored()) paint(); });
}

/* ---------- copy buttons, anywhere on the page ---------- */

document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy');
  if (!b) return;
  /* :not([hidden]) because a box with several panes holds them all, and
     the one worth copying is the one being read. */
  const pre = b.parentElement.querySelector('pre:not([hidden]), textarea');
  if (!pre) return;
  const label = b.querySelector('.copy-label') || b;
  const text = pre.value ?? pre.textContent;
  let said = 'Copied';
  try { await navigator.clipboard.writeText(text); b.dataset.done = ''; }
  catch { getSelection().selectAllChildren(pre); said = 'Select it'; }
  label.textContent = said;
  setTimeout(() => { label.textContent = 'Copy'; delete b.dataset.done; }, 1400);
});

/* ---------- code panes: npm or pnpm, ESM or CJS ---------- */

/* Which pane a reader picked is a convenience, not state: it lives in this
   browser, it is re-read on the next page, and a box that has never heard of
   the remembered name simply keeps the one the page was built with. */
const PKEY = 'package-site:pane:';

function showPane(box, name, remember) {
  const panes = [...box.querySelectorAll('pre[data-pane]')];
  if (!panes.some((p) => p.dataset.pane === name)) return;
  for (const p of panes) p.hidden = p.dataset.pane !== name;
  for (const b of box.querySelectorAll('.code-head button[data-pane]')) {
    b.setAttribute('aria-pressed', String(b.dataset.pane === name));
  }
  if (remember && box.dataset.remember) {
    try { localStorage.setItem(PKEY + box.dataset.remember, name); } catch { /* private window */ }
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('.code-tabs .code-head button[data-pane]');
  if (!b) return;
  /* Every box on the page that remembers the same thing moves together, so a
     pnpm reader is not told npm again further down. */
  const box = b.closest('.code-tabs');
  const key = box.dataset.remember;
  showPane(box, b.dataset.pane, true);
  if (key) for (const other of $$(`.code-tabs[data-remember="${key}"]`)) showPane(other, b.dataset.pane, false);
});

for (const box of $$('.code-tabs[data-remember]')) {
  let picked = null;
  try { picked = localStorage.getItem(PKEY + box.dataset.remember); } catch { /* private window */ }
  if (picked) showPane(box, picked, false);
}

/* ---------- preview / settings, on a phone ---------- */

document.addEventListener('click', (e) => {
  const b = e.target.closest('.play-tabs button[data-view]');
  if (!b) return;
  const tabs = b.closest('.play-tabs');
  const box = tabs.nextElementSibling;
  box.dataset.view = b.dataset.view;
  $$('button', tabs).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  if (b.dataset.view === 'preview') page?.onShow?.(state, box);
});

/* ---------- the page ---------- */

const main = $('#page');
const pageId = document.body.dataset.page;
let page = null;
let state = {};
let data = null;
let mod = null;
let ctx = null;

/* Site-wide settings survive a page load: they are a per-viewer convenience,
   so a failed read is nothing to handle beyond carrying on with the default. */
const GKEY = 'package-site:globals';
const readGlobals = () => { try { return JSON.parse(sessionStorage.getItem(GKEY)) || {}; } catch { return {}; } };
const writeGlobals = (g) => { try { sessionStorage.setItem(GKEY, JSON.stringify(g)); } catch { /* private window */ } };

function stageInner() {
  return page.render(state, data, ctx);
}

function redraw() {
  const stage = $('#stage', main);
  if (stage) {
    const tools = stage.querySelector('.stage-tools');
    stage.innerHTML = (tools ? tools.outerHTML : '') + stageInner();
  }
  const pre = $('.code pre', main);
  if (pre && page.code) pre.innerHTML = highlight(page.code(state, data, ctx));
  for (const c of page.controls || []) {
    if (!c.when) continue;
    const box = main.querySelector(`.ctl[data-k="${c.k}"]`);
    if (box) box.hidden = !c.when(state);
  }
  page.onShow?.(state, main);
}

function bindControls() {
  for (const el of $$('[data-k]', main)) {
    if (el.classList.contains('ctl') || el.classList.contains('seg')) continue;
    const c = (page.controls || []).find((x) => x.k === el.dataset.k);
    if (!c) continue;
    if (el.tagName === 'BUTTON') {
      el.addEventListener('click', () => {
        state[c.k] = el.dataset.v;
        $$(`.seg[data-k="${c.k}"] button`, main).forEach((o) => o.setAttribute('aria-pressed', String(o === el)));
        page.onChange?.(state, c.k);
        redraw();
      });
      continue;
    }
    const evt = el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'text' ? 'input' : 'change';
    el.addEventListener(evt, () => {
      state[c.k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      if (el.type === 'range') {
        const out = main.querySelector(`#c-${c.k}-o`);
        if (out) out.textContent = `${state[c.k]}${c.unit || ''}`;
      }
      page.onChange?.(state, c.k);
      redraw();
    });
  }
}

/* The site-wide controls in the header: whatever they change, the open page
   is redrawn against it. */
function bindGlobals() {
  if (!settings || !mod?.globals) return;
  const g = { ...Object.fromEntries(mod.globals.map((c) => [c.k, c.v])), ...readGlobals() };

  /* A setting behind another one — the free-text field under "other" — is in
     the markup from the start and only shown when its condition holds. */
  const showHide = () => {
    for (const c of mod.globals) {
      if (!c.when) continue;
      const el = $(`#g-${c.k}`, settings);
      const box = el?.closest('label');
      if (box) box.hidden = !c.when(g);
    }
  };

  for (const c of mod.globals) {
    const el = $(`#g-${c.k}`, settings);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!g[c.k]; else el.value = g[c.k];
    el.addEventListener('change', async () => {
      g[c.k] = el.type === 'checkbox' ? el.checked : el.value;
      writeGlobals(g);
      mod.setGlobals?.(g);
      showHide();
      /* loadData rethrows after the stage has said so on screen; the throw is
         caught here because the reader needs telling as well. */
      try {
        await loadData(g);
        redraw();
        say(mod.announce?.(g, page, data) || `${settingsSentence(g)}. Updated.`);
      } catch (error) {
        say(`${settingsSentence(g)}. ${page.loadError ? page.loadError(error) : error.message}`);
      }
    });
  }
  mod.setGlobals?.(g);
  showHide();
  return g;
}

/* What the site-wide settings now say, in words. The controls are the only
   description of the data that the template and the reader share, so the
   announcement is read off them rather than guessed at. */
function settingsSentence(g) {
  return (mod.globals || [])
    .filter((c) => !c.when || c.when(g))
    .map((c) => {
      const v = g[c.k];
      if (c.type === 'toggle') return `${c.label} ${v ? 'on' : 'off'}`;
      if (c.type === 'select') {
        const o = (c.options || []).find((x) => String(Array.isArray(x) ? x[0] : x) === String(v));
        return `${c.label} ${Array.isArray(o) ? o[1] : (o ?? v)}`;
      }
      return `${c.label} ${v}`;
    })
    .join(', ');
}

/* Repeating the same sentence into a live region says nothing, so it is
   cleared first and set on the next frame. */
function say(text) {
  const box = $('#say', main);
  if (!box) return;
  box.textContent = '';
  setTimeout(() => { box.textContent = text; }, 60);
}

async function loadData(g) {
  if (!mod.load) return;
  const stage = $('#stage', main);
  try {
    data = await mod.load(g, page);
  } catch (error) {
    data = null;
    if (stage) stage.innerHTML = `<p class="err">${esc(page.loadError ? page.loadError(error) : error.message)}</p>`;
    throw error;
  }
}

async function start() {
  try {
    mod = await import(new URL('./pages.js', import.meta.url));
  } catch { return; /* a site with no playgrounds needs none of this */ }
  page = mod.pages.find((p) => p.id === pageId);
  if (!page || !main) return;

  state = initialState(page);
  /* The first page is the site root and the rest are a folder each — the same
     rule the generator uses to lay them out. The page objects here have no
     slug on them, so the depth comes from the position. */
  const depth = mod.pages.indexOf(page) === 0 ? './' : '../';
  ctx = context({ site: mod.site || {}, page, rel: depth });
  const g = bindGlobals();
  bindControls();
  page.mount?.(state, main);
  page.onShow?.(state, main);

  if (mod.load) {
    try { await loadData(g); redraw(); } catch { /* the stage already says so */ }
  }
}

start();

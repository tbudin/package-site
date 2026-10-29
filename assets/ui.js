/* package-site UI primitives.
   Plain ESM with no platform calls, because both halves of the site use it:
   the generator imports it in Node to write the HTML a crawler is served, and
   the browser imports the same file to redraw a control's output. One source
   for the markup is the only way a select in the header and a select in a
   playground stay the same object.

   A control is declared, never written by hand:
     { k, label, type, options, min, max, step, unit, note, wide, when, v }
   type: select | range | toggle | text | textarea | segment | colour
*/

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* An options list takes either a bare value or a [value, label] pair. */
export const pairs = (options = []) => options.map((o) => (Array.isArray(o) ? o : [o, o]));

/* The initial state of a page: each control's default, with the page's own
   state object laid over it. */
export const initialState = (page) => ({
  ...Object.fromEntries((page.controls || []).map((c) => [c.k, c.v])),
  ...(page.state || {}),
});

/* Pages sit at different depths — the first one is the site root, the rest are
   a folder each — so a page cannot write a link to a sibling as a constant.
   Every render is handed this, and `link('kpi')` is right from anywhere. */
export const context = ({ site, page, rel }) => ({
  site, page, rel,
  link: (id) => (id ? `${rel}${id}/` : rel || './'),
  asset: (file) => `${rel}assets/${file}`,
});

export function control(c, v) {
  const id = `c-${c.k}`;
  const box = `ctl${c.wide ? ' wide' : ''}`;
  const note = c.note ? `<small>${c.note}</small>` : '';

  if (c.type === 'select') {
    return `<div class="${box}" data-k="${esc(c.k)}"><label for="${id}"><span>${esc(c.label)}</span></label>` +
      `<select id="${id}" data-k="${esc(c.k)}">${pairs(c.options).map(([val, lab]) =>
        `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>${note}</div>`;
  }
  if (c.type === 'range') {
    return `<div class="${box}" data-k="${esc(c.k)}"><label for="${id}"><span>${esc(c.label)}` +
      `<output id="${id}-o">${esc(v)}${esc(c.unit || '')}</output></span></label>` +
      `<input type="range" id="${id}" data-k="${esc(c.k)}" min="${esc(c.min)}" max="${esc(c.max)}" step="${esc(c.step ?? 1)}" value="${esc(v)}">${note}</div>`;
  }
  if (c.type === 'toggle') {
    /* The note goes inside the box, not after it. Both halves of the site
       hide a control by its first element — controlPanel writes `hidden` on
       it, chrome.js sets .hidden on it — so a note left outside stays on
       screen describing a control that is not there, and `.ctl small` is
       what gives it its size and colour in the first place. */
    return `<div class="${box}" data-k="${esc(c.k)}"><label class="check" for="${id}">` +
      `<input type="checkbox" id="${id}" data-k="${esc(c.k)}"${v ? ' checked' : ''}><span>${esc(c.label)}</span></label>${note}</div>`;
  }
  if (c.type === 'textarea') {
    return `<div class="${box} wide" data-k="${esc(c.k)}"><label for="${id}"><span>${esc(c.label)}</span></label>` +
      `<textarea id="${id}" data-k="${esc(c.k)}" spellcheck="false" rows="${esc(c.rows ?? 8)}">${esc(v)}</textarea>${note}</div>`;
  }
  if (c.type === 'segment') {
    return `<div class="${box}" data-k="${esc(c.k)}"><span id="${id}-l">${esc(c.label)}</span>` +
      segment(c.k, c.options, v, `${id}-l`) + note + `</div>`;
  }
  if (c.type === 'colour') {
    return `<div class="${box}" data-k="${esc(c.k)}"><label for="${id}"><span>${esc(c.label)}</span></label>` +
      `<input type="color" id="${id}" data-k="${esc(c.k)}" value="${esc(v)}">${note}</div>`;
  }
  return `<div class="${box}" data-k="${esc(c.k)}"><label for="${id}"><span>${esc(c.label)}</span></label>` +
    `<input type="text" id="${id}" data-k="${esc(c.k)}" value="${esc(v)}" autocomplete="off" spellcheck="false">${note}</div>`;
}

/* A run of buttons that behave as one choice. Used in the header for a
   site-wide setting and inside a playground for a short list. */
export function segment(k, options, v, labelledBy) {
  return `<span class="seg" role="group" data-k="${esc(k)}"${labelledBy ? ` aria-labelledby="${esc(labelledBy)}"` : ''}>` +
    pairs(options).map(([val, lab]) =>
      `<button type="button" data-k="${esc(k)}" data-v="${esc(val)}" aria-pressed="${String(val) === String(v)}">${esc(lab)}</button>`).join('') +
    `</span>`;
}

export function controlPanel(list = [], state = {}, heading = 'Settings') {
  if (!list.length) return '';
  const visible = list.filter((c) => !c.when || c.when(state));
  /* A group with a name, not a heading: the panel sits before the page's own
     <h2>s, so making it one would take the outline h1 → h3 → h2. */
  return `<div class="ctls" role="group" aria-label="${esc(heading)}"><p class="ctls-head" aria-hidden="true">${esc(heading)}</p>` +
    list.map((c) => {
      const html = control(c, state[c.k]);
      return visible.includes(c) ? html : html.replace(/^<(div|label)/, '<$1 hidden');
    }).join('') + `</div>`;
}

/* Comments are picked out after escaping, never before: the samples are JSX
   and an unescaped <Component> is parsed as an unknown element, rendering as
   nothing at all. */
export const highlight = (text) => esc(text).replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|^\s*#[^\n]*)/gm, '<span class="c">$1</span>');

/* Two sheets of paper, and a tick for the moment after the click. Both are in
   the button from the start so the swap needs no markup at press time. */
const COPY_ICON =
  `<svg class="sheets" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">` +
  `<rect x="5.6" y="1.6" width="8.8" height="10.8" rx="1.5"/><path d="M11 14.4H3.1a1.5 1.5 0 0 1-1.5-1.5V4.4"/></svg>` +
  `<svg class="tick" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M2.5 8.5 6 12l7.5-8"/></svg>`;

export const codeBox = (text, id) =>
  `<div class="code"><pre${id ? ` id="${esc(id)}"` : ''}>${highlight(text)}</pre>` +
  `<button class="btn copy" type="button">${COPY_ICON}<span class="copy-label">Copy</span></button></div>`;

/* One box, several ways of saying the same thing: npm or pnpm, ESM or CJS.
   Every pane is written into the page and all but one hidden, so a crawler
   reads all of them and a reader with no script still gets the first.

   `remember` names a key: the choice is a per-viewer convenience, so it is
   kept in localStorage and re-applied on the next page rather than asked
   again. Nothing depends on it surviving. */
export function codeTabs(panes, { label = 'Variant', remember = '' } = {}) {
  const list = pairs(panes);
  if (list.length < 2) return codeBox(list[0]?.[1] ?? '');
  const seg = `<div class="seg" role="group" aria-label="${esc(label)}">` +
    list.map(([name], i) =>
      `<button type="button" data-pane="${esc(name)}" aria-pressed="${i === 0}">${esc(name)}</button>`).join('') +
    `</div>`;
  return `<div class="code code-tabs"${remember ? ` data-remember="${esc(remember)}"` : ''}>` +
    `<div class="code-head">${seg}</div>` +
    list.map(([name, code], i) =>
      `<pre data-pane="${esc(name)}"${i ? ' hidden' : ''}>${highlight(code)}</pre>`).join('') +
    `<button class="btn copy" type="button">${COPY_ICON}<span class="copy-label">Copy</span></button></div>`;
}

/* The install line in each manager's own words. Getting this wrong is the
   fastest way to look careless, so the verbs are spelled out rather than
   derived: npm installs, everyone else adds, deno needs the npm: prefix. */
const INSTALL = {
  npm: (p, d) => `npm install ${d ? '--save-dev ' : ''}${p}`,
  pnpm: (p, d) => `pnpm add ${d ? '-D ' : ''}${p}`,
  yarn: (p, d) => `yarn add ${d ? '--dev ' : ''}${p}`,
  bun: (p, d) => `bun add ${d ? '-d ' : ''}${p}`,
  deno: (p) => `deno add npm:${p}`,
};

export const installTabs = (pkg, { managers = ['npm', 'pnpm', 'yarn', 'bun'], dev = false } = {}) =>
  codeTabs(managers.map((m) => {
    const line = INSTALL[m];
    if (!line) throw new Error(`no install line for ${m}`);
    return [m, line(pkg, dev)];
  }), { label: 'Package manager', remember: 'manager' });

export function playground({ stage, controls: list = [], state = {}, tools = '', heading = 'Settings' }) {
  const solo = !list.length;
  /* Not a tablist: there are no tab panels and nothing to point aria-controls
     at — the two buttons show and hide parts of one box. Pressed states say
     that honestly, where tab roles would promise a widget that is not here. */
  const tabs = solo ? '' : `<div class="seg play-tabs" role="group" aria-label="Show">` +
    `<button type="button" data-view="preview" aria-pressed="true">Preview</button>` +
    `<button type="button" data-view="settings" aria-pressed="false">${esc(heading)}</button></div>`;
  return `${tabs}<div class="play${solo ? ' solo' : ''}" data-view="preview">` +
    `<div class="stage" id="stage">${tools ? `<div class="stage-tools">${tools}</div>` : ''}${stage}</div>` +
    controlPanel(list, state, heading) + `</div>`;
}

export function refTable(rows, headers = ['Setting', 'Default', 'Values'], title = 'Parameters') {
  if (!rows || !rows.length) return '';
  return (title ? `<h2 id="parameters">${esc(title)}</h2>` : '') +
    `<div class="ref-wrap"><table class="ref"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((cell, i) => `<td>${i === 0 ? `<code>${esc(cell)}</code>` : esc(cell)}</td>`).join('')}</tr>`).join('') +
    `</tbody></table></div>`;
}

/* Questions and answers, open by default. They are the page's FAQPage data
   and they have to be readable with no JavaScript and present in the HTML a
   crawler is handed, so nothing here is built at runtime. */
export function faqBlock(faq = [], title = 'Questions') {
  if (!faq.length) return '';
  return `<h2 id="questions">${esc(title)}</h2><div class="faq">` +
    faq.map(({ q, a }) => `<details open><summary>${esc(q)}</summary><p>${a}</p></details>`).join('') +
    `</div>`;
}

export const gridLinks = (items = []) =>
  !items.length ? '' : `<div class="grid-links">` +
    items.map(({ href, title, note }) => `<a href="${esc(href)}"><b>${esc(title)}</b><span>${esc(note || '')}</span></a>`).join('') +
    `</div>`;

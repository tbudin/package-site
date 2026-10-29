/* Tokens to CSS.

   A package's look is a list of tokens, not a stylesheet. The dark set is
   written twice on purpose: once behind the system preference, guarded so an
   explicit light choice still wins, and once for an explicit dark choice.
   Equal specificity means source order decides, so the explicit rule goes
   last — the usual way these two fight.
*/

const block = (tokens) => Object.entries(tokens).map(([k, v]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${v};`).join('\n');

export function themeCss({ tokens = {}, dark = {}, light = {}, extra = '' } = {}) {
  const out = [];
  if (Object.keys(tokens).length) out.push(`:root {\n${block(tokens)}\n}`);
  if (Object.keys(light).length) out.push(`:root[data-theme="light"] {\n${block(light)}\n}`);
  if (Object.keys(dark).length) {
    out.push(`@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${block(dark).replace(/^/gm, '  ')}\n  }\n}`);
    out.push(`:root[data-theme="dark"] {\n${block(dark)}\n}`);
  }
  if (extra) out.push(extra.trim());
  return out.join('\n');
}

/* The mark for a select's current value, inside the box.

   :checked matches the selected option, so :has() lets a select draw its own
   value's mark with no script at all: right on the first paint, right after a
   change, right with scripting off. The mark is a background layer, and a
   background layer cannot take currentColor, so a brand mark that is nearly
   black or nearly white is baked twice and swapped with the theme.

   The arrow is already a background layer, so the mark is added in front of it
   rather than replacing it: chrome.css reserves the slot and this only fills
   it in. */
const dataUri = (svg) =>
  `url("data:image/svg+xml,${svg
    .replace(/"/g, "'")
    .replace(/[<>#%{}|\\^`[\]]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\s+/g, ' ')
    .trim()}")`;

const marks = (icons, theme) =>
  Object.entries(icons)
    .map(([v, icon]) => [v, typeof icon === 'string' ? icon : icon?.[theme]])
    .filter(([, svg]) => svg);

export function selectMarkCss(globals = []) {
  const light = [];
  const dark = [];
  for (const c of globals) {
    if (c.type !== 'select' || !c.icons) continue;
    const sel = `#g-${c.k}`;
    /* Reserved whether or not this value has a mark, so picking a value that
       has none does not resize the box under the pointer. */
    light.push(`${sel} { --mark-size: 15px; --mark-gap: 7px; }`);
    const l = new Map(marks(c.icons, 'light'));
    for (const [v, svg] of l) light.push(`${sel}:has(option[value="${v}"]:checked) { --mark-img: ${dataUri(svg)}; }`);
    /* Only the marks the theme actually changes are written twice. The dark
       selectors are spelled out rather than nested, and lead with :root, so
       they outrank the light rule above without relying on source order. */
    for (const [v, svg] of marks(c.icons, 'dark')) {
      if (svg === l.get(v)) continue;
      dark.push([`${sel}:has(option[value="${v}"]:checked)`, `--mark-img: ${dataUri(svg)};`]);
    }
  }
  if (!light.length) return '';
  const out = [light.join('\n')];
  if (dark.length) {
    const under = (root, indent) => dark.map(([s, d]) => `${indent}${root} ${s} { ${d} }`).join('\n');
    out.push(`@media (prefers-color-scheme: dark) {\n${under(':root:not([data-theme="light"])', '  ')}\n}`);
    out.push(under(':root[data-theme="dark"]', ''));
  }
  return out.join('\n');
}

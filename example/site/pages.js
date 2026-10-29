/* The pages. Imported by the generator in Node and by the browser, so nothing
   in here may touch either platform's own globals. */

import { esc, refTable } from './ui.js';

export const globals = [
  { k: 'unit', label: 'Unit', type: 'select', options: [['px', 'pixels'], ['rem', 'rem']], v: 'px' },
];

export const pages = [
  {
    id: 'intro',
    group: 'Start',
    title: 'A package site, in two pages',
    description: 'What the template gives a package: one shared chrome, a page per screen with its own URL, and the metadata every reader and crawler needs.',
    keywords: 'start install intro',
    lead: 'Every screen is a file. The preview below is written into that file before anyone loads it, which is what makes it readable by something that does not run JavaScript.',
    controls: [
      { k: 'size', label: 'Size', type: 'range', min: 12, max: 48, step: 2, unit: 'px', v: 24 },
      { k: 'weight', label: 'Weight', type: 'select', options: [['400', 'regular'], ['600', 'bold']], v: '400' },
      { k: 'quiet', label: 'Quiet', type: 'toggle', v: false },
    ],
    render: (s) => `<p style="font-size:${s.size}px;font-weight:${s.weight};opacity:${s.quiet ? 0.5 : 1};margin:0">The quick brown fox</p>`,
    code: (s) => `<p style="font-size: ${s.size}px; font-weight: ${s.weight}">\n  The quick brown fox\n</p>`,
    ref: [['size', '24px', 'Any length'], ['weight', '400', '400, 600'], ['quiet', 'off', 'Halves the opacity']],
    faq: [
      { q: 'Does the preview work without JavaScript?', a: 'The first state of it does, because it is written into the HTML. The controls need the script.' },
      { q: 'Where do the pages come from?', a: 'One <code>pages.js</code>, imported by the generator and by the browser, so the two cannot disagree.' },
    ],
  },
  {
    id: 'tokens',
    group: 'Reference',
    title: 'Tokens',
    description: 'The per-package design tokens: colour, type, shape and stage, set once in site.config.js and never by restyling the shared chrome.',
    keywords: 'theme colour design tokens css',
    lead: 'A package changes how its site looks by setting tokens. Out-specifying the shared stylesheet is how two sites drift apart.',
    after: () => refTable(
      [['--accent', 'warm brown', 'Links, the brand, focus rings'], ['--mark', 'sand', 'The current page, a pressed button'], ['--f-head', 'Georgia', 'Headings'], ['--stage-bg', '--panel', 'Behind a preview']],
      ['Token', 'Default', 'Used for'], 'The tokens'),
  },
];

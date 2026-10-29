/* The files read by something other than a browser.

   toText gets most of the attention because it is the one piece of this
   generator that rewrites prose, and because every bug it has had so far was
   a tag name matching the start of a longer tag name.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { llmsFull, llmsTxt, notFound, pageMarkdown, robots, sitemap, toText } from '../src/seo.mjs';

const site = {
  name: 'example-package',
  packageName: 'example-package',
  version: '1.2.0',
  description: 'A package that does one thing.',
  license: 'MIT',
  owner: 'Plain Matter Pte Ltd',
  baseUrl: 'https://example.com/pkg/',
  basePath: '/pkg/',
  repo: 'https://github.com/tbudin/example-package',
  npm: true,
  author: { name: 'Thomas Budin' },
};

const pages = [
  { id: 'intro', slug: '', home: true, title: 'Start', description: 'The front page, which may speak for the package itself.' },
  { id: 'kpi', slug: 'kpi', title: 'KPI', group: 'Charts', description: 'A single number, and whether it is going the right way.' },
];

test('a paragraph comes out as a sentence, not as tags', () => {
  assert.equal(toText('<p>Hello <b>there</b>.</p>'), 'Hello **there**.');
});

test('a heading keeps its level', () => {
  assert.equal(toText('<h2>Big</h2><h3>Small</h3>'), '## Big\n\n### Small');
});

test('a list is a list', () => {
  assert.equal(toText('<ul><li>one</li><li>two</li></ul>'), '- one\n- two');
});

test('a link keeps its address', () => {
  assert.equal(toText('<p>See <a href="./kpi/">the KPI page</a>.</p>'), 'See [the KPI page](./kpi/).');
});

test('inline code keeps its backticks', () => {
  assert.equal(toText('<p>Call <code>trend()</code>.</p>'), 'Call `trend()`.');
});

test('a tag name never swallows a longer tag name', () => {
  /* <b> once matched <button>, so a row of install panes came out as one
     bold run of manager names; <li> once matched <link>. */
  assert.equal(toText('<p>a</p><button type="button">Copy</button><p>b</p>'), 'a\n\nb');
  assert.equal(toText('<link rel="stylesheet" href="x.css"><p>a</p>'), 'a');
  assert.equal(toText('<p><b>bold</b></p><blockquote><p>quoted</p></blockquote>'), '**bold**\n\nquoted');
});

test('a hidden pane is not read, because the page does not mean it', () => {
  const html = '<pre data-pane="npm">npm i x</pre><pre data-pane="pnpm" hidden>pnpm add x</pre>';
  const text = toText(html);
  assert.ok(text.includes('npm i x'));
  assert.ok(!text.includes('pnpm add x'));
});

test('a code block keeps its indentation and comes out fenced', () => {
  const text = toText('<pre>const a = {\n  b: 1,\n};</pre>');
  assert.equal(text, '```\nconst a = {\n  b: 1,\n};\n```');
});

test('prose around a code block still collapses', () => {
  const text = toText('<p>Like    this:</p><pre>  a\n  b</pre><p>Done.</p>');
  assert.equal(text, 'Like this:\n\n```\n  a\n  b\n```\n\nDone.');
});

test('entities come back as characters, once', () => {
  assert.equal(toText('<p>a &amp; b &lt;c&gt; &quot;d&quot;</p>'), 'a & b <c> "d"');
  /* A literal &lt; in the page means the reader should see &lt;, not <. */
  assert.equal(toText('<p>&amp;lt;</p>'), '&lt;');
});

test('a table becomes a markdown table with its separator', () => {
  const html = '<table><thead><tr><th>Setting</th><th>Default</th></tr></thead>'
    + '<tbody><tr><td><code>width</code></td><td>640</td></tr></tbody></table>';
  assert.equal(toText(html), '| Setting | Default |\n|---|---|\n| `width` | 640 |');
});

test('script, style and svg leave nothing behind', () => {
  assert.equal(toText('<p>a</p><script>var x = "<b>"</script><style>p{}</style><svg><path d="M0 0"/></svg>'), 'a');
});

test('markdown of a page carries the title, the prose and the source line', () => {
  const md = pageMarkdown(site, pages[1], { state: {}, data: null });
  assert.ok(md.startsWith('# KPI'));
  assert.ok(md.includes('*example-package · Charts*'));
  assert.ok(md.trimEnd().endsWith('https://example.com/pkg/kpi/ · example-package 1.2.0 · MIT'));
});

test('a page whose body is in `before` reaches the markdown', () => {
  /* The HTML renders lead, before, the playground, code, after, the reference
     table and the questions. Anything the markdown does not read is a page
     that exists for a browser and is blank for everything else — which is
     what happened to the changelog, whose whole body is `before`. */
  const page = {
    ...pages[1],
    before: () => '<section class="release"><h2>0.2.0</h2><ul><li>a calendar heatmap</li></ul></section>',
  };
  const md = pageMarkdown(site, page, { state: {} });
  assert.ok(md.includes('a calendar heatmap'), 'the body of the page is missing from its markdown');
});

test('two paragraphs stay two paragraphs', () => {
  /* Markup built by joining a list has no whitespace between the elements,
     and a single newline between two paragraphs is one paragraph in markdown. */
  assert.equal(toText('<p>one</p><p>two</p>'), 'one\n\ntwo');
  assert.equal(toText('<details><summary>Q</summary><p>A</p></details><details><summary>Q2</summary><p>A2</p></details>'),
    '**Q**\n\nA\n\n**Q2**\n\nA2');
});

test('markdown links are absolute, because it is read away from the site', () => {
  const page = { ...pages[1], after: (s, d, ctx) => `<p>See <a href="${ctx.link('intro')}">intro</a>.</p>` };
  assert.ok(pageMarkdown(site, page, { state: {} }).includes('(https://example.com/pkg/intro/)'));
});

test('a reference table reaches the markdown as a table', () => {
  const page = { ...pages[1], ref: [['width', '640', 'number']] };
  const md = pageMarkdown(site, page, { state: {} });
  assert.ok(md.includes('| `width` | 640 | number |'));
  assert.ok(md.includes('|---|---|---|'));
});

test('the sitemap lists every page once, and the home page first', () => {
  const xml = sitemap(site, pages);
  assert.equal([...xml.matchAll(/<loc>/g)].length, 2);
  assert.ok(xml.includes('<loc>https://example.com/pkg/</loc>'));
  assert.ok(xml.includes('<loc>https://example.com/pkg/kpi/</loc>'));
  assert.ok(xml.indexOf('1.0') < xml.indexOf('0.7'), 'the home page is the one with priority 1.0');
});

test('robots names the AI crawlers explicitly and points at the sitemap', () => {
  const txt = robots(site);
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Googlebot']) {
    assert.ok(new RegExp(`User-agent: ${bot}\\nAllow: /`).test(txt), `${bot} is not answered`);
  }
  assert.ok(txt.includes('Sitemap: https://example.com/pkg/sitemap.xml'));
});

test('llms.txt groups the pages and points at the markdown, not the HTML', () => {
  const txt = llmsTxt(site, pages);
  assert.ok(txt.startsWith('# example-package'));
  assert.ok(txt.includes('> A package that does one thing.'));
  assert.ok(txt.includes('## Start'), 'the home page is its own group');
  assert.ok(txt.includes('## Charts'));
  assert.ok(txt.includes('(https://example.com/pkg/kpi/index.md)'));
  assert.ok(!/\(https:\/\/example\.com\/pkg\/kpi\/\)/.test(txt));
});

test('llms.txt leaves out the lines the config did not fill', () => {
  const txt = llmsTxt({ ...site, npm: false, repo: '' }, pages);
  assert.ok(!txt.includes('Install:'));
  assert.ok(!txt.includes('Source:'));
  assert.ok(!txt.includes('null'));
});

test('llms-full.txt is every page, separated', () => {
  const markdowns = new Map([['intro', '# Start\n\nfront'], ['kpi', '# KPI\n\nnumber']]);
  const txt = llmsFull(site, pages, markdowns);
  assert.ok(txt.includes('# Start'));
  assert.ok(txt.includes('# KPI'));
  assert.equal([...txt.matchAll(/\n---\n/g)].length, 2);
});

test('the 404 page is not indexed and can get back to the site', () => {
  const html = notFound(site);
  assert.ok(html.includes('<meta name="robots" content="noindex, follow">'));
  assert.ok(html.includes('href="/pkg/"'), 'the way back is the base path, not a relative hop');
  assert.ok(html.includes('href="/pkg/assets/chrome.css"'));
});

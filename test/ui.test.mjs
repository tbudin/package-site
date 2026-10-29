/* The markup primitives.

   These run in Node and in the browser from the same file, so every assertion
   here is also an assertion about what the browser redraws. They are written
   against what the markup is *for* — a label that points at its control, a
   pressed state that matches the value, a hidden pane that stays hidden —
   rather than against the exact string, which would make a reformat look like
   a regression.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  context, control, controlPanel, codeBox, codeTabs, esc, faqBlock, gridLinks,
  highlight, initialState, installTabs, pairs, playground, refTable, segment,
} from '../assets/ui.js';

const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1];

test('esc closes every hole an attribute or a text node has', () => {
  assert.equal(esc('a & b'), 'a &amp; b');
  assert.equal(esc('<script>'), '&lt;script&gt;');
  assert.equal(esc('say "hi"'), 'say &quot;hi&quot;');
  assert.equal(esc(null), '');
  assert.equal(esc(0), '0', 'a falsy number is a value, not a missing one');
  /* & first, or the escapes escape each other. */
  assert.equal(esc('&lt;'), '&amp;lt;');
});

test('pairs takes a bare value or a value and a label', () => {
  assert.deepEqual(pairs(['a', ['b', 'Bee']]), [['a', 'a'], ['b', 'Bee']]);
  assert.deepEqual(pairs(), []);
});

test('initialState is the controls defaults with the page state over them', () => {
  const page = { controls: [{ k: 'n', v: 3 }, { k: 'mode', v: 'line' }], state: { mode: 'bar' } };
  assert.deepEqual(initialState(page), { n: 3, mode: 'bar' });
  assert.deepEqual(initialState({}), {});
});

test('context links from the depth the page is at', () => {
  const deep = context({ site: {}, page: {}, rel: '../' });
  assert.equal(deep.link('kpi'), '../kpi/');
  assert.equal(deep.asset('chrome.css'), '../assets/chrome.css');
  assert.equal(deep.link(), '../', 'no id is the site root');
  assert.equal(context({ site: {}, page: {}, rel: '' }).link(), './', 'the home page still needs a href');
});

test('every control type labels its input', () => {
  const types = ['select', 'range', 'toggle', 'textarea', 'segment', 'colour', 'text'];
  for (const type of types) {
    const html = control({ k: 'thing', label: 'Thing', type, options: ['a', 'b'], min: 0, max: 10 }, 'a');
    if (type === 'segment') {
      /* A group of buttons has no single control to point `for` at, so it is
         named by aria-labelledby instead. */
      const by = attr(html, 'aria-labelledby');
      assert.ok(by, `${type}: no aria-labelledby`);
      assert.ok(html.includes(`id="${by}"`), `${type}: aria-labelledby points at nothing`);
    } else {
      const forId = attr(html, 'for');
      assert.ok(forId, `${type}: no label`);
      assert.ok(html.includes(`id="${forId}"`), `${type}: the label points at nothing`);
    }
    assert.ok(html.includes('Thing'), `${type}: the label text is missing`);
  }
});

test('a control escapes a hostile label, value and key', () => {
  const html = control({ k: 'k"x', label: '<b>L</b>', type: 'text' }, 'v"&');
  assert.ok(!html.includes('<b>L</b>'), 'the label was written as markup');
  assert.equal(attr(html, 'value'), 'v&quot;&amp;');
});

test('a select marks the current option and only that one', () => {
  const html = control({ k: 'm', label: 'Mode', type: 'select', options: ['line', 'bar'] }, 'bar');
  assert.match(html, /<option value="bar" selected>/);
  assert.equal(html.match(/selected/g).length, 1);
});

test('a select compares loosely, so a number value still selects', () => {
  const html = control({ k: 'n', label: 'N', type: 'select', options: [[7, 'seven']] }, 7);
  assert.match(html, /<option value="7" selected>/);
});

test('a segment presses exactly the current value', () => {
  const html = segment('m', ['line', 'bar'], 'bar');
  assert.match(html, /data-v="bar" aria-pressed="true"/);
  assert.match(html, /data-v="line" aria-pressed="false"/);
});

test('a control is one element, because that is what the panel hides', () => {
  /* controlPanel hides an inapplicable control by putting `hidden` on the
     first tag. Anything the control leaves outside that tag — a note, most
     obviously — stays on screen describing something that is not there. */
  for (const type of ['select', 'range', 'toggle', 'textarea', 'segment', 'colour', 'text']) {
    const html = control({ k: 'thing', label: 'Thing', type, options: ['a'], min: 0, max: 1, note: 'a note' }, 'a');
    const open = html.match(/^<([a-z]+)/)[1];
    const close = html.match(/<\/([a-z]+)>$/)[1];
    assert.equal(close, open, `${type}: the markup opens <${open}> and ends </${close}>, so part of it cannot be hidden`);
  }
});

test('a control hidden by `when` takes its note with it', () => {
  const list = [{ k: 'b', label: 'B', type: 'toggle', note: 'only for A', when: () => false }];
  const html = controlPanel(list, {});
  const root = html.match(/<(div|label) hidden[\s\S]*$/);
  assert.ok(root, 'the control was not hidden at all');
  assert.ok(root[0].includes('only for A'), 'the note is outside the element that gets hidden');
});

test('a control panel keeps every control in the HTML and hides the inapplicable ones', () => {
  const list = [
    { k: 'a', label: 'A', type: 'text' },
    { k: 'b', label: 'B', type: 'text', when: (s) => s.a === 'yes' },
  ];
  const html = controlPanel(list, { a: 'no' });
  assert.ok(html.includes('data-k="b"'), 'the hidden control must still be in the page for the browser to reveal');
  assert.match(html, /<div hidden[^>]*data-k="b"/);
  assert.ok(!controlPanel([], {}), 'no controls is no panel, not an empty box');
});

test('highlight escapes first and comments second', () => {
  /* The samples are JSX. Escaping after the comment pass would leave
     <Component> as an unknown element, which renders as nothing. */
  const html = highlight('<Chart /> // like this');
  assert.ok(html.includes('&lt;Chart /&gt;'));
  assert.match(html, /<span class="c">\/\/ like this<\/span>/);
});

test('highlight marks block, line and hash comments', () => {
  assert.match(highlight('/* a */'), /<span class="c">\/\* a \*\/<\/span>/);
  assert.match(highlight('# shell'), /<span class="c"># shell<\/span>/);
});

test('a code box carries its own copy button', () => {
  const html = codeBox('npm i x');
  assert.match(html, /<pre>npm i x<\/pre>/);
  assert.match(html, /class="btn copy"/);
});

test('one pane is a plain box, not a tab strip with one tab', () => {
  const html = codeTabs([['npm', 'npm i x']]);
  assert.ok(!html.includes('role="group"'));
  assert.ok(!html.includes('data-pane'));
});

test('several panes are all written out, with one shown', () => {
  const html = codeTabs([['npm', 'npm i x'], ['pnpm', 'pnpm add x'], ['bun', 'bun add x']]);
  const panes = [...html.matchAll(/<pre data-pane="([^"]+)"( hidden)?>/g)];
  assert.equal(panes.length, 3, 'a crawler should be handed every pane');
  assert.deepEqual(panes.map((m) => Boolean(m[2])), [false, true, true]);
  assert.equal(html.match(/aria-pressed="true"/g).length, 1);
});

test('the pressed button and the shown pane are the same pane', () => {
  const html = codeTabs([['npm', 'a'], ['pnpm', 'b']]);
  const pressed = html.match(/data-pane="([^"]+)" aria-pressed="true"/)[1];
  const shown = html.match(/<pre data-pane="([^"]+)">/)[1];
  assert.equal(pressed, shown);
});

test('install lines are each manager own words', () => {
  const html = installTabs('package-trends', { managers: ['npm', 'pnpm', 'yarn', 'bun', 'deno'] });
  for (const line of ['npm install package-trends', 'pnpm add package-trends', 'yarn add package-trends',
    'bun add package-trends', 'deno add npm:package-trends']) {
    assert.ok(html.includes(line), `missing: ${line}`);
  }
});

test('a dev install says so in each manager own flag', () => {
  const html = installTabs('x', { managers: ['npm', 'pnpm', 'yarn', 'bun'], dev: true });
  for (const line of ['npm install --save-dev x', 'pnpm add -D x', 'yarn add --dev x', 'bun add -d x']) {
    assert.ok(html.includes(line), `missing: ${line}`);
  }
});

test('an unknown package manager is a build error, not a wrong command', () => {
  assert.throws(() => installTabs('x', { managers: ['npm', 'rye'] }), /rye/);
});

test('install tabs remember the choice across pages', () => {
  assert.match(installTabs('x'), /data-remember="manager"/);
});

test('a reference table is a table, with the first cell as code', () => {
  const html = refTable([['width', '640', 'number']]);
  assert.match(html, /<th>Setting<\/th>/);
  assert.match(html, /<td><code>width<\/code><\/td>/);
  assert.ok(!refTable([]), 'no rows is no table');
});

test('a reference table escapes a cell', () => {
  const html = refTable([['<b>', 'a & b', 'x']]);
  assert.ok(!html.includes('<b>'), 'a cell was written as markup');
  assert.ok(html.includes('a &amp; b'));
});

test('questions are open and in the HTML', () => {
  const html = faqBlock([{ q: 'Why?', a: 'Because.' }]);
  assert.match(html, /<details open>/);
  assert.match(html, /<summary>Why\?<\/summary>/);
  assert.ok(!faqBlock([]));
});

test('grid links survive a missing note', () => {
  const html = gridLinks([{ href: './a/', title: 'A' }]);
  assert.match(html, /href="\.\/a\/"/);
  assert.ok(!html.includes('undefined'));
});

test('a playground with no controls says so in the markup', () => {
  const solo = playground({ stage: '<svg/>' });
  assert.match(solo, /class="play solo"/);
  assert.ok(!solo.includes('play-tabs'), 'nothing to switch between');
  const withCtls = playground({ stage: '<svg/>', controls: [{ k: 'a', label: 'A', type: 'text' }], state: { a: '' } });
  assert.match(withCtls, /play-tabs/);
});

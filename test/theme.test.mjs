/* Tokens to CSS, and the marks a select draws for its own value.

   The dark rules are written twice on purpose, and the order they come out in
   is the whole behaviour: an explicit light choice has to beat the system
   preference, and an explicit dark choice has to beat the light default.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectMarkCss, themeCss } from '../src/theme.mjs';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#61DAFB"><path d="M12 2z"/></svg>';
const DARKMARK = MARK.replace('#61DAFB', '#eceae4');

test('tokens come out on :root, with the dashes added', () => {
  const css = themeCss({ tokens: { '--bg': '#fff', fg: '#111' } });
  assert.match(css, /:root \{[\s\S]*--bg: #fff;[\s\S]*--fg: #111;[\s\S]*\}/);
});

test('an empty theme is no CSS at all, not an empty rule', () => {
  assert.equal(themeCss(), '');
  assert.equal(themeCss({ tokens: {} }), '');
});

test('the dark set is written for the preference and for the explicit choice', () => {
  const css = themeCss({ tokens: { '--bg': '#fff' }, dark: { '--bg': '#111' } });
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /:root:not\(\[data-theme="light"\]\)/, 'a chosen light theme must beat the system preference');
  assert.match(css, /:root\[data-theme="dark"\]/);
});

test('the explicit dark rule comes last, because ties go to source order', () => {
  const css = themeCss({ tokens: { '--bg': '#fff' }, light: { '--bg': '#fff' }, dark: { '--bg': '#111' } });
  assert.ok(css.lastIndexOf(':root[data-theme="dark"]') > css.indexOf(':root[data-theme="light"]'));
  assert.ok(css.lastIndexOf(':root[data-theme="dark"]') > css.indexOf('@media (prefers-color-scheme: dark)'));
});

test('extra CSS is appended as written', () => {
  assert.ok(themeCss({ extra: '.x { color: red; }' }).endsWith('.x { color: red; }'));
});

test('a select with no icons generates nothing', () => {
  assert.equal(selectMarkCss([{ k: 'pick', type: 'select' }]), '');
  assert.equal(selectMarkCss([]), '');
  assert.equal(selectMarkCss(), '');
});

test('a select with icons reserves the slot whatever the value is', () => {
  /* Reserved even for a value that has no mark: otherwise picking one resizes
     the box under the pointer. */
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { react: MARK } }]);
  assert.match(css, /#g-pick \{ --mark-size: 15px; --mark-gap: 7px; \}/);
});

test('the mark is keyed off the checked option, so no script is involved', () => {
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { react: MARK } }]);
  assert.match(css, /#g-pick:has\(option\[value="react"\]:checked\) \{ --mark-img: url\("data:image\/svg\+xml,/);
});

test('a data URI escapes what a URI cannot carry', () => {
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { react: MARK } }]);
  const uri = css.match(/url\("(data:[^"]+)"\)/)[1];
  assert.ok(!uri.includes('"'), 'a double quote would close the url()');
  assert.ok(!uri.includes('<'), '< must be percent-encoded');
  assert.ok(!uri.includes('#'), 'a # would be read as a fragment and drop the fill colour');
  assert.ok(uri.includes('%23'), 'the fill colour survived as %23');
  assert.ok(decodeURIComponent(uri.slice('data:image/svg+xml,'.length)).includes('<svg'));
});

test('only a mark the theme changes is written twice', () => {
  const one = selectMarkCss([{ k: 'pick', type: 'select', icons: { react: MARK } }]);
  assert.ok(!one.includes('prefers-color-scheme'), 'a mark that does not change needs no second copy');

  const two = selectMarkCss([{ k: 'pick', type: 'select', icons: { next: { light: MARK, dark: DARKMARK } } }]);
  assert.match(two, /@media \(prefers-color-scheme: dark\)/);
  assert.equal([...two.matchAll(/#g-pick:has\(option\[value="next"\]:checked\)/g)].length, 3,
    'light, the preference, and the explicit choice');
});

test('a mark given as light and dark that are the same is written once', () => {
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { x: { light: MARK, dark: MARK } } }]);
  assert.ok(!css.includes('prefers-color-scheme'));
});

test('the dark selectors are spelled out, not nested', () => {
  /* Nesting would make the output depend on the browser supporting it, and
     these rules have to win on specificity regardless. */
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { next: { light: MARK, dark: DARKMARK } } }]);
  assert.match(css, /:root:not\(\[data-theme="light"\]\) #g-pick:has\(/);
  assert.match(css, /:root\[data-theme="dark"\] #g-pick:has\(/);
  assert.ok(!/&/.test(css), 'the nesting selector is in the output');
});

test('a value with no mark gets no rule', () => {
  const css = selectMarkCss([{ k: 'pick', type: 'select', icons: { react: MARK, other: null } }]);
  assert.ok(!css.includes('value="other"'));
});

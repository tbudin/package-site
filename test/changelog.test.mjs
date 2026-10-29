/* The releases page and the feed.

   The input is CHANGELOG.md as changesets writes it. The cases that matter are
   the ones a hand-edited changelog adds: prose above the first bullet, a
   continuation paragraph under a bullet, and a heading between them.
*/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { atomFeed, changelogPage, parseChangelog } from '../src/changelog.mjs';

const site = {
  name: 'example-package',
  description: 'A package that does one thing.',
  baseUrl: 'https://example.com/pkg/',
  author: { name: 'Thomas Budin' },
};

test('each version heading starts a release, newest first', () => {
  const releases = parseChangelog('# Changelog\n\n## 0.2.0\n\n- second\n\n## 0.1.0\n\n- first\n');
  assert.deepEqual(releases.map((r) => r.version), ['0.2.0', '0.1.0']);
  assert.ok(releases[0].html.includes('second'));
});

test('a version id is usable as a fragment', () => {
  const [r] = parseChangelog('## 1.2.0-rc.1\n\n- a\n');
  assert.equal(r.id, 'v1-2-0-rc-1');
  assert.ok(!/[^\w-]/.test(r.id));
});

test('a kind heading stays a heading', () => {
  const [r] = parseChangelog('## 0.2.0\n\n### Minor changes\n\n- a thing\n');
  assert.ok(r.html.includes('<h3>Minor changes</h3>'));
  assert.ok(r.html.indexOf('<h3>') < r.html.indexOf('<ul'));
});

test('the bullets are a list of changes', () => {
  const [r] = parseChangelog('## 0.2.0\n\n- one\n- two\n');
  assert.ok(r.html.includes('<ul class="release-changes">'));
  assert.equal([...r.html.matchAll(/<li>/g)].length, 2);
});

test('the changeset hash is provenance, not news', () => {
  const [r] = parseChangelog('## 0.2.0\n\n- a1b2c3d: a calendar heatmap\n');
  assert.ok(r.html.includes('a calendar heatmap'));
  assert.ok(!r.html.includes('a1b2c3d'));
});

test('an indented continuation stays with its bullet, and keeps a space', () => {
  /* The words either side of the line break are two words, not one. */
  const [r] = parseChangelog('## 0.2.0\n\n- point marks,\n  settable per series\n');
  assert.ok(r.html.includes('point marks, settable per series'), r.html);
  assert.equal([...r.html.matchAll(/<li>/g)].length, 1);
});

test('a blank line inside a bullet starts a second paragraph of it', () => {
  const [r] = parseChangelog('## 0.2.0\n\n- the change\n\n  why it was made\n');
  const li = r.html.match(/<li>([\s\S]*?)<\/li>/)[1];
  assert.equal([...li.matchAll(/<p>/g)].length, 2, li);
});

test('prose above the bullets is kept as prose', () => {
  const [r] = parseChangelog('## 0.2.0\n\nThis release is mostly about the feed.\n\n- a change\n');
  assert.ok(r.html.indexOf('<p>This release is mostly about the feed.</p>') < r.html.indexOf('<ul'));
});

test('a flush-left line after a bullet ends the list', () => {
  const [r] = parseChangelog('## 0.2.0\n\n- a change\n\nAnd a closing note.\n');
  assert.ok(r.html.indexOf('</ul>') < r.html.indexOf('And a closing note'));
});

test('inline markdown inside a bullet is rendered, and the rest escaped', () => {
  const [r] = parseChangelog('## 0.2.0\n\n- `trend()` is now **async** & faster, see [docs](./x/)\n');
  assert.ok(r.html.includes('<code>trend()</code>'));
  assert.ok(r.html.includes('<strong>async</strong>'));
  assert.ok(r.html.includes('<a href="./x/">docs</a>'));
  assert.ok(r.html.includes('&amp;'), 'an ampersand must not reach the page raw');
});

test('a release with nothing in it is not a release', () => {
  const releases = parseChangelog('## 0.2.0\n\n## 0.1.0\n\n- first\n');
  assert.equal(releases.find((r) => r.version === '0.2.0').html, '');
});

test('the changelog page describes itself and hides the playground', () => {
  const page = changelogPage(site, [{ version: '0.2.0', id: 'v0-2-0', html: '<p>x</p>', date: '2026-10-28T00:00:00Z' }]);
  assert.equal(page.id, 'changelog');
  assert.ok(page.description.length >= 40, 'check rejects a description under 40 characters');
  assert.equal(page.hidePlay, true);
  const body = page.before();
  assert.ok(body.includes('<section class="release" id="v0-2-0">'));
  assert.ok(body.includes('<time datetime="2026-10-28">28 October 2026</time>'));
});

test('a release with no date gets no time element rather than an empty one', () => {
  const body = changelogPage(site, [{ version: '0.2.0', id: 'v0-2-0', html: '<p>x</p>' }]).before();
  assert.ok(!body.includes('<time'));
});

test('the feed is one entry per release, each linking to its own section', () => {
  const releases = [
    { version: '0.2.0', id: 'v0-2-0', html: '<p>new</p>', date: '2026-10-28T00:00:00Z' },
    { version: '0.1.0', id: 'v0-1-0', html: '<p>old</p>', date: '2026-10-01T00:00:00Z' },
  ];
  const xml = atomFeed(site, releases);
  assert.equal([...xml.matchAll(/<entry>/g)].length, 2);
  assert.ok(xml.includes('<link href="https://example.com/pkg/changelog/#v0-2-0"/>'));
  assert.ok(xml.includes('<updated>2026-10-28T00:00:00Z</updated>'));
  assert.ok(xml.includes('rel="self" href="https://example.com/pkg/feed.xml"'));
});

test('the feed is dated by its newest release, not by the build', () => {
  const xml = atomFeed(site, [{ version: '0.2.0', id: 'v0-2-0', html: '<p>x</p>', date: '2026-10-28T00:00:00Z' }]);
  assert.equal(xml.match(/<feed[\s\S]*?<updated>([^<]+)</)[1], '2026-10-28T00:00:00Z');
});

test('a release body that closes the CDATA block cannot break the feed', () => {
  const xml = atomFeed(site, [{ version: '0.2.0', id: 'v0-2-0', html: '<p>a ]]> b</p>', date: '2026-10-28T00:00:00Z' }]);
  const content = xml.match(/<content type="html"><!\[CDATA\[([\s\S]*?)\]\]><\/content>/);
  assert.ok(content, 'the CDATA block was closed early');
  assert.ok(!content[1].includes(']]>'));
});

test('the feed escapes the title and the author', () => {
  const xml = atomFeed({ ...site, name: 'a & b', author: { name: '<script>' } }, []);
  assert.ok(xml.includes('<title>a &amp; b releases</title>'));
  assert.ok(!xml.includes('<script>'));
});

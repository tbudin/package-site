/* The build, end to end, and the checker that is supposed to catch a bad one.

   Every rule in check.mjs is broken on purpose here. A checker that has only
   ever been seen passing is not a checker: it is a line of output that says
   the word "check".
*/

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { build } from '../src/build.mjs';
import { check } from '../src/check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, '..', 'example');

const roots = [];

/* A throwaway copy of the example, so a test may edit the built site and the
   repository's own example/docs is never touched. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'package-site-'));
  await cp(EXAMPLE, root, { recursive: true });
  await rm(join(root, 'docs'), { recursive: true, force: true });
  roots.push(root);
  const built = await build({ root, quiet: true });
  return { root, ...built };
}

/* The one shared build for every read-only assertion; the breakages each take
   their own copy. */
let site;
before(async () => { site = await fixture(); });
after(async () => { for (const r of roots) await rm(r, { recursive: true, force: true }); });

const page = (name) => readFile(join(site.out, name, 'index.html'), 'utf8');

test('every page is written as a folder with an index.html', async () => {
  for (const p of site.pages) {
    assert.ok(existsSync(join(site.out, p.slug, 'index.html')), `${p.id} has no index.html`);
    assert.ok(existsSync(join(site.out, p.slug, 'index.md')), `${p.id} has no markdown twin`);
  }
  assert.ok(site.pages[0].slug === '', 'the first page is the site root');
});

test('the files that are read by something other than a browser are all there', async () => {
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', '404.html', '.nojekyll']) {
    assert.ok(existsSync(join(site.out, f)), `${f} was not written`);
  }
});

test('the browser is served the same modules the generator imported', async () => {
  const assets = await readdir(join(site.out, 'assets'));
  for (const f of ['chrome.css', 'chrome.js', 'ui.js', 'pages.js']) {
    assert.ok(assets.includes(f), `assets/${f} is missing`);
  }
});

test('the page is in the file, not in a promise', async () => {
  const html = await page('');
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/)[1];
  const text = article.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(text.length > 400, `only ${text.length} characters of prerendered text`);
  assert.ok(!/loading|skeleton|spinner/i.test(article));
});

test('the markdown twin says what the page says', async () => {
  for (const p of site.pages) {
    const md = await readFile(join(site.out, p.slug, 'index.md'), 'utf8');
    const body = md
      .replace(/^#[^\n]*\n/, '')
      .replace(/^\*[^\n]*\*\n/m, '')
      .replace(/\n---\n[\s\S]*$/, '')
      .trim();
    assert.ok(body.length > 120, `${p.id}: the markdown twin is ${body.length} characters — the page did not reach it`);
  }
});

test('the search index is one entry per page, with text to search', async () => {
  const index = JSON.parse(await readFile(join(site.out, 'assets', 'search.json'), 'utf8'));
  assert.equal(index.length, site.pages.length);
  for (const row of index) {
    assert.ok(row.t, 'an entry with no title');
    assert.ok(row.x.length > 80, `${row.u}: nothing to search`);
    assert.ok(!/[`|#]/.test(row.x), `${row.u}: markdown punctuation is in the snippet text`);
  }
});

test('the select marks reach the stylesheet only when a select declares icons', async () => {
  /* The example has a global select with no icons, so there should be no
     mark rules at all — and no empty --mark-img slot left behind. */
  const html = await page('');
  assert.ok(!html.includes('--mark-img:'), 'mark rules were written for a select with no icons');
});

test('a fresh build passes its own checker', async () => {
  assert.equal(await check(site), true);
});

/* --- and now the same checker, broken on purpose --- */

const broken = async (fn) => {
  const f = await fixture();
  await fn(f);
  return check(f);
};

const quiet = (t) => {
  /* check() reports to stderr; the failures below are expected, so they are
     not also printed as noise. */
  const was = console.error;
  console.error = () => {};
  return Promise.resolve(t()).finally(() => { console.error = was; });
};

test('a page that was not written fails the check', async () => {
  assert.equal(await quiet(() => broken((f) => rm(join(f.out, f.pages[1].slug, 'index.html')))), false);
});

test('a wrong canonical fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, f.pages[1].slug, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace(/<link rel="canonical" href="[^"]+"/, '<link rel="canonical" href="https://elsewhere.example/"'));
  })), false);
});

test('two pages with the same canonical fail the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const home = await readFile(join(f.out, 'index.html'), 'utf8');
    const canonical = home.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const file = join(f.out, f.pages[1].slug, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace(/<link rel="canonical" href="[^"]+"/, `<link rel="canonical" href="${canonical}"`));
  })), false);
});

test('a missing description fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, f.pages[1].slug, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content=""'));
  })), false);
});

test('a page emptied of its content fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, f.pages[1].slug, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace(/<article[^>]*>[\s\S]*?<\/article>/, '<article></article>'));
  })), false);
});

test('JSON-LD that does not parse fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, 'index.html');
    const html = await readFile(file, 'utf8');
    await writeFile(file, html.replace(/<script type="application\/ld\+json">/, '<script type="application/ld+json">{oops '));
  })), false);
});

test('a local link that points at nothing fails the check', async () => {
  assert.equal(await quiet(() => broken((f) => rm(join(f.out, 'assets', 'chrome.css')))), false);
});

test('a page that is complete in HTML and empty in markdown fails the check', async () => {
  /* The failure the changelog page shipped with: whole body in `before`,
     rendered in the HTML, nothing in the markdown twin, and a check that
     only ever read the HTML. */
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, f.pages[1].slug, 'index.md');
    const md = await readFile(file, 'utf8');
    await writeFile(file, md.split('\n').filter((l) => l.startsWith('#') || l.startsWith('---') || l.includes(' · ')).join('\n'));
  })), false);
});

test('a page missing from the sitemap fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, 'sitemap.xml');
    const xml = await readFile(file, 'utf8');
    await writeFile(file, xml.replace(/ *<url>[\s\S]*?<\/url>\n/, ''));
  })), false);
});

test('a page missing from llms.txt fails the check', async () => {
  assert.equal(await quiet(() => broken(async (f) => {
    const file = join(f.out, 'llms.txt');
    const txt = await readFile(file, 'utf8');
    await writeFile(file, txt.replace(/^- \[.*index\.md\).*$/m, ''));
  })), false);
});

test('a build with no pages is an error, not an empty site', async () => {
  const root = await mkdtemp(join(tmpdir(), 'package-site-empty-'));
  roots.push(root);
  await cp(EXAMPLE, root, { recursive: true });
  await writeFile(join(root, 'site', 'pages.js'), 'export const pages = [];\n');
  await assert.rejects(build({ root, quiet: true }), /exported no pages/);
});

test('a site with no baseUrl is an error, because every canonical is built from it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'package-site-nobase-'));
  roots.push(root);
  await cp(EXAMPLE, root, { recursive: true });
  const config = await readFile(join(root, 'site', 'site.config.js'), 'utf8');
  await writeFile(join(root, 'site', 'site.config.js'), config.replace(/baseUrl:[^,]+,/, ''));
  await assert.rejects(build({ root, quiet: true }), /baseUrl/);
});

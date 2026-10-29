/* Reads the built site back off disk and fails on what is easy to ship broken.

   It parses nothing cleverly — it greps the written files — but it does read
   them, and every rule below has been made to fail on purpose at least once.
*/

import { readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { pageUrl, pageDescription, pageTitle } from './head.mjs';

const exists = (p) => stat(p).then(() => true, () => false);

export async function check({ site, pages, out }) {
  const problems = [];
  const fail = (where, what) => problems.push(`${where}: ${what}`);
  const seen = { canonical: new Map(), title: new Map(), description: new Map() };

  for (const page of pages) {
    const file = join(out, page.slug, 'index.html');
    const where = `${page.slug || '/'}`;
    if (!(await exists(file))) { fail(where, 'index.html was not written'); continue; }
    const html = await readFile(file, 'utf8');

    const one = (re, name) => {
      const m = html.match(re);
      if (!m) { fail(where, `no ${name}`); return null; }
      return m[1];
    };

    const canonical = one(/<link rel="canonical" href="([^"]+)"/, 'canonical');
    if (canonical && canonical !== pageUrl(site, page)) fail(where, `canonical is ${canonical}, expected ${pageUrl(site, page)}`);
    if (canonical && seen.canonical.has(canonical)) fail(where, `canonical repeats ${seen.canonical.get(canonical)}`);
    seen.canonical.set(canonical, where);

    const title = one(/<title>([^<]+)<\/title>/, 'title');
    if (title && seen.title.has(title)) fail(where, `title repeats ${seen.title.get(title)}`);
    seen.title.set(title, where);

    const desc = one(/<meta name="description" content="([^"]*)"/, 'description');
    /* Inheriting the package blurb is not having a description: it gives every
       page the same thing to say, which is the defect this whole build exists
       to avoid. The front page is the one that may speak for the package. */
    if (!page.home && !page.description) fail(where, 'no description of its own — it is falling back to the site description');
    if (desc !== null && desc.trim().length < 40) fail(where, `description is ${desc.trim().length} characters, want 40+`);
    if (desc && seen.description.has(desc)) fail(where, `description repeats ${seen.description.get(desc)}`);
    seen.description.set(desc, where);

    one(/<meta name="viewport" content="([^"]+)"/, 'viewport');
    one(/<meta name="robots" content="([^"]+)"/, 'robots');
    one(/<meta property="og:title" content="([^"]+)"/, 'og:title');

    /* The whole point of the generator: content in the file, not in a promise.
       Measured on <article>, which holds the page and none of the chrome —
       breadcrumbs, pager and credit between them clear 200 characters on an
       empty page, which is how this rule passed a blank one the first time. */
    const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (!article) fail(where, 'no <article>');
    else {
      const text = article[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length < 200) fail(where, `only ${text.length} characters of text in <article> — the page is not prerendered`);
    }

    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch (e) { fail(where, `JSON-LD does not parse: ${e.message}`); }
    }

    /* Every local reference has to be a file. A broken asset path is the one
       mistake that looks fine until the page is served from its real URL. */
    const dir = join(out, page.slug);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const v = m[1];
      if (/^(https?:|data:|mailto:|#|\/)/.test(v)) continue;
      const target = normalize(join(dir, v));
      const probe = v.endsWith('/') || !v.includes('.') ? join(target, 'index.html') : target;
      if (!(await exists(probe))) fail(where, `${v} points at nothing`);
    }
    if (/href="#[a-z]/i.test(html.replace(/href="#(parameters|questions)"/g, ''))) {
      const hashes = [...html.matchAll(/href="(#[^"]+)"/g)].map((m) => m[1]).filter((h) => !['#parameters', '#questions', '#page'].includes(h));
      if (hashes.length) fail(where, `navigation by fragment is left in: ${hashes.join(' ')}`);
    }
  }

  const map = await readFile(join(out, 'sitemap.xml'), 'utf8');
  for (const page of pages) if (!map.includes(pageUrl(site, page))) fail('sitemap.xml', `${pageUrl(site, page)} is missing`);
  const listed = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].length;
  if (listed !== pages.length) fail('sitemap.xml', `lists ${listed} URLs for ${pages.length} pages`);

  const llms = await readFile(join(out, 'llms.txt'), 'utf8');
  for (const page of pages) if (!llms.includes(`${pageUrl(site, page)}index.md`)) fail('llms.txt', `${page.id} is missing`);
  if (!(await exists(join(out, 'llms-full.txt')))) fail('llms-full.txt', 'was not written');
  if (!(await exists(join(out, 'robots.txt')))) fail('robots.txt', 'was not written');

  if (site.og?.image && !(await exists(join(out, site.og.image)))) fail('og', `${site.og.image} is referenced but not served`);

  if (problems.length) {
    console.error(`package-site check: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    for (const p of problems) console.error(`  ${p}`);
    return false;
  }
  console.log(`  check: ${pages.length} pages, canonicals unique, descriptions present, every local link resolves`);
  return true;
}

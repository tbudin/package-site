/* The build.

   Assets are copied before the page modules are imported, and the modules are
   imported from the output folder. That is the one trick in here, and it is
   the reason the prerendered HTML cannot drift from what the browser draws:
   Node and the browser load the same file, by the same relative paths.
*/

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { renderPage } from './shell.mjs';
import { selectMarkCss, themeCss } from './theme.mjs';
import { creditBlock } from './credit.mjs';
import { atomFeed, changelogPage, readChangelog } from './changelog.mjs';
import { llmsFull, llmsTxt, notFound, pageMarkdown, robots, sitemap } from './seo.mjs';
import { initialState } from '../assets/ui.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OWN = resolve(HERE, '..');

function normalise(config, pkg) {
  const site = { ...config };
  site.name ||= pkg.name;
  site.packageName ||= pkg.name;
  site.version ||= pkg.version;
  site.description ||= pkg.description;
  site.license ||= pkg.license || 'MIT';
  site.author = typeof site.author === 'string' ? { name: site.author } : (site.author || { name: pkg.author });
  site.owner ||= 'Plain Matter Pte Ltd';
  site.keywords ||= pkg.keywords || [];
  if (!site.baseUrl) throw new Error('site.config.js needs a baseUrl (every canonical URL is built from it)');
  if (!site.baseUrl.endsWith('/')) site.baseUrl += '/';
  site.basePath = new URL(site.baseUrl).pathname;
  site.themeCss = themeCss(site.theme || {});
  site.out ||= 'docs';
  return site;
}

async function copyAssets(root, out, site) {
  const assetDir = join(out, 'assets');
  await mkdir(assetDir, { recursive: true });

  for (const f of ['chrome.css', 'chrome.js', 'ui.js']) {
    await cp(join(OWN, 'assets', f), join(assetDir, f));
  }

  /* The package's own site modules. They have to be .js, because the browser
     imports the very same files. */
  const siteDir = join(root, site.siteDir || 'site');
  if (existsSync(siteDir)) {
    for (const f of await readdir(siteDir)) {
      if (f.endsWith('.js') && f !== 'site.config.js') await cp(join(siteDir, f), join(assetDir, f));
    }
  }

  /* Built library files the pages import, named as the pages import them. */
  for (const [to, from] of Object.entries(site.assets || {})) {
    await cp(join(root, from), join(assetDir, to), { recursive: true });
  }

  /* Anything that is just served: og.png, screenshots, a minified stylesheet. */
  for (const entry of site.static || []) {
    const [from, to] = Array.isArray(entry) ? entry : [entry, entry];
    await cp(join(root, from), join(out, to), { recursive: true });
  }
  return assetDir;
}

export async function build({ root = process.cwd(), clean = true, quiet = false } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const configPath = join(root, 'site', 'site.config.js');
  if (!existsSync(configPath)) throw new Error(`no site/site.config.js in ${root}`);
  const config = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)).default;
  const site = normalise(config, pkg);
  const out = join(root, site.out);

  if (clean) await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await copyAssets(root, out, site);

  const credit = await creditBlock(site);
  if (credit.css) await writeFile(join(out, 'assets', 'credit.css'), credit.css);
  if (credit.css) site.stylesheets = [...(site.stylesheets || []), 'assets/credit.css'];
  if (!credit.real) log('  ! @nodsto/credit is not installed — the footer falls back to plain markup');

  const modPath = join(out, 'assets', 'pages.js');
  const mod = existsSync(modPath) ? await import(`${pathToFileURL(modPath).href}?t=${Date.now()}`) : { pages: [] };
  /* The releases are not written by hand like the rest of the site: they are
     read out of CHANGELOG.md and appended as one more page, so the nav, the
     pager, the sitemap and llms.txt pick them up without being told. */
  const releases = await readChangelog(root, site);
  const declared = mod.pages.concat(releases.length ? [changelogPage(site, releases)] : []);
  const pages = declared.map((p, i) => ({ ...p, slug: p.slug ?? (i === 0 ? '' : p.id), home: i === 0 }));
  if (!pages.length) throw new Error('site/pages.js exported no pages');
  if (releases.length) site.feed = 'feed.xml';

  /* The marks a select draws are declared on the globals, so they are only
     known once pages.js has been imported — after normalise() built the rest
     of the theme. */
  const markCss = selectMarkCss(mod.globals);
  if (markCss) site.themeCss += `\n${markCss}`;

  /* Data taken once, here, so a page that needs the network still states real
     figures in the HTML a crawler is handed. A failed fetch is not a failed
     build: the pages fall back to their sample series. */
  let data = null;
  if (mod.prefetch) {
    try { data = await mod.prefetch(pages); }
    catch (error) { log(`  ! prefetch failed (${error.message}) — pages fall back to their sample data`); }
  }

  const markdowns = new Map();
  for (const page of pages) {
    const dir = page.slug ? join(out, page.slug) : out;
    await mkdir(dir, { recursive: true });
    const html = renderPage({ site, pages, page, mod, credit, data });
    await writeFile(join(dir, 'index.html'), html);
    const md = pageMarkdown(site, page, { state: initialState(page), data });
    markdowns.set(page.id, md);
    await writeFile(join(dir, 'index.md'), md + '\n');
  }

  /* The search index is the markdown the site already writes, with the title
     line and the footer taken off: one more read of the same text, rather
     than a second description of the pages that could disagree with it. */
  await writeFile(join(out, 'assets', 'search.json'), JSON.stringify(pages.map((page) => ({
    u: page.slug ? `${page.slug}/` : '',
    t: page.title,
    n: page.nav || page.title,
    g: page.group || '',
    d: page.description || '',
    /* Markdown punctuation is for a markdown reader. A search snippet is
       read as a sentence, so the fences, pipes and backticks come out. */
    x: (markdowns.get(page.id) || '')
      .replace(/^#[^\n]*\n/, '')
      .replace(/\n---\n[\s\S]*$/, '')
      .replace(/^```.*$/gm, '')
      .replace(/^\|[-|\s]+\|$/gm, '')
      .replace(/\|/g, ' ')
      .replace(/[`*#>]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim(),
  }))));

  if (releases.length) await writeFile(join(out, 'feed.xml'), atomFeed(site, releases));
  await writeFile(join(out, 'sitemap.xml'), sitemap(site, pages));
  await writeFile(join(out, 'robots.txt'), robots(site));
  await writeFile(join(out, 'llms.txt'), llmsTxt(site, pages) + '\n');
  await writeFile(join(out, 'llms-full.txt'), llmsFull(site, pages, markdowns));
  await writeFile(join(out, '404.html'), notFound(site));
  await writeFile(join(out, '.nojekyll'), '');

  log(`  ${site.name} ${site.version} → ${relative(root, out) || '.'}/`);
  log(`  ${pages.length} pages, ${pages.length} markdown files, sitemap, robots, llms.txt, llms-full.txt${releases.length ? `, feed.xml (${releases.length} releases)` : ''}`);
  return { site, pages, out };
}

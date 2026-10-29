/* The releases page and the feed people subscribe to.

   The source is CHANGELOG.md as changesets writes it, so this parses the
   subset that actually appears there — version headings, a kind heading, a
   bullet per change with indented paragraphs under it — rather than pretending
   to be a markdown renderer. Anything it does not recognise is kept as a
   paragraph, which is the failure a reader can still read.
*/

import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { esc } from '../assets/ui.js';

const run = promisify(execFile);

const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

const paras = (text) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${inline(p.replace(/\s*\n\s*/g, ' '))}</p>`).join('');

/* One release's body. The bullets are the changes; everything above the first
   bullet is the release's own prose, which changesets does not write but a
   hand-edited changelog often does. */
function renderBody(lines) {
  const out = [];
  let items = [];
  let item = null;
  let loose = [];

  const closeList = () => {
    if (item !== null) { items.push(item); item = null; }
    if (items.length) {
      out.push(`<ul class="release-changes">${items.map((t) => `<li>${paras(t)}</li>`).join('')}</ul>`);
      items = [];
    }
  };
  const closeLoose = () => {
    const t = loose.join('\n').trim();
    if (t) out.push(paras(t));
    loose = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const head = /^###\s+(.*)$/.exec(line);
    if (head) {
      closeList(); closeLoose();
      out.push(`<h3>${inline(head[1])}</h3>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      closeLoose();
      if (item !== null) items.push(item);
      /* changesets prefixes each bullet with the commit it came from. That is
         provenance for the repository, not news for a reader. */
      item = `${bullet[1].replace(/^[0-9a-f]{7,40}:\s*/, '')}\n`;
      continue;
    }
    if (item !== null) {
      /* Indented, or blank: still inside the bullet. Anything flush left ends
         the list. */
      if (!line.trim()) { item += '\n\n'; continue; }
      if (/^\s{2,}/.test(raw)) { item += `${line.replace(/^\s{2}/, '')}\n`; continue; }
      closeList();
    }
    loose.push(line);
  }
  closeList(); closeLoose();
  return out.join('\n');
}

export function parseChangelog(md) {
  const lines = String(md).split('\n');
  const releases = [];
  let current = null;
  for (const line of lines) {
    const v = /^##\s+(?!#)(.*)$/.exec(line);
    if (v) {
      current = { version: v[1].trim(), lines: [] };
      releases.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return releases.map((r) => ({
    version: r.version,
    id: `v${r.version.replace(/[^\w.]+/g, '-').replace(/\./g, '-')}`,
    html: renderBody(r.lines),
  }));
}

/* When a version first appeared, asked of git. No tags in a young repository
   and no git at all in a tarball, so this is allowed to fail: the file's own
   timestamp is a worse answer than a tag and a better one than nothing. */
async function dateFor(root, file, version, fallback) {
  try {
    const { stdout } = await run('git', ['log', '--format=%aI', '-S', `## ${version}`, '--', file], { cwd: root });
    const dates = stdout.trim().split('\n').filter(Boolean);
    if (dates.length) return dates[dates.length - 1];
  } catch { /* no git, or not a repository */ }
  return fallback;
}

export async function readChangelog(root, site) {
  const name = site.changelog === true || site.changelog === undefined ? 'CHANGELOG.md' : site.changelog;
  if (!name) return [];
  const file = join(root, name);
  if (!existsSync(file)) return [];
  const md = await readFile(file, 'utf8');
  const fallback = (await stat(file)).mtime.toISOString();
  const releases = parseChangelog(md);
  for (const r of releases) r.date = await dateFor(root, name, r.version, fallback);
  return releases.filter((r) => r.html);
}

const human = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export function changelogPage(site, releases) {
  const body = releases.map((r) =>
    `<section class="release" id="${r.id}">` +
    `<h2>${esc(r.version)}` +
    (r.date ? ` <time datetime="${esc(r.date.slice(0, 10))}">${esc(human(r.date))}</time>` : '') +
    `</h2>${r.html}</section>`).join('\n');

  return {
    id: 'changelog',
    group: site.changelogGroup || 'Releases',
    title: site.changelogTitle || 'Changelog',
    nav: 'Changelog',
    keywords: 'changelog releases versions history news feed',
    description: `Every released version of ${site.name}, newest first, with what changed in each — and an Atom feed to follow new ones.`,
    hidePlay: true,
    before: () => `<p class="lead">Newest first. <a href="../feed.xml">Follow by feed</a>.</p>${body}`,
  };
}

export function atomFeed(site, releases) {
  const self = `${site.baseUrl}feed.xml`;
  const page = `${site.baseUrl}changelog/`;
  const updated = releases[0]?.date || new Date().toISOString();
  const entries = releases.map((r) => `  <entry>
    <title>${esc(site.name)} ${esc(r.version)}</title>
    <link href="${esc(`${page}#${r.id}`)}"/>
    <id>${esc(`${page}#${r.id}`)}</id>
    <updated>${esc(r.date || updated)}</updated>
    <content type="html"><![CDATA[${r.html.replace(/]]>/g, ']]&gt;')}]]></content>
  </entry>`).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.name)} releases</title>
  <subtitle>${esc(site.description || '')}</subtitle>
  <link rel="self" href="${esc(self)}"/>
  <link href="${esc(page)}"/>
  <id>${esc(page)}</id>
  <updated>${esc(updated)}</updated>
  <author><name>${esc(site.author?.name || site.owner || site.name)}</name></author>
${entries}
</feed>
`;
}

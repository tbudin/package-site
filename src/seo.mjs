/* The files that are read by something other than a browser.

   sitemap.xml and robots.txt are for search engines. llms.txt, llms-full.txt
   and the per-page markdown are for everything that summarises a page without
   running its JavaScript, which is most of what now sits between a developer
   and a package they have not heard of.
*/

import { context } from '../assets/ui.js';
import { pageUrl, pageDescription, pageTitle } from './head.mjs';

/* A deliberately small HTML-to-text pass over the subset these pages use.
   Not a markdown library and not trying to be: it turns the page a browser is
   served into the same page as prose, so the two can never disagree. */
/* A table becomes a markdown table, header separator and all. Left to the
   generic pass below it comes out as rows of cells with no leading pipe and
   no separator, which renders as a paragraph everywhere. */
function tables(html) {
  return String(html).replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, inner) => {
    const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => {
      const head = /<th[\s>]/i.test(m[1]);
      const cells = [...m[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) =>
        c[2].replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      return { head, cells };
    });
    if (!rows.length) return '';
    const out = [];
    for (const [i, r] of rows.entries()) {
      out.push(`| ${r.cells.join(' | ')} |`);
      if (r.head && !rows[i + 1]?.head) out.push(`|${r.cells.map(() => '---').join('|')}|`);
    }
    return `\n\n${out.join('\n')}\n\n`;
  });
}

export function toText(html) {
  /* Code is pulled out first and put back last. Everything between those two
     points flattens whitespace, which is right for prose and ruins a code
     block: indentation is the only thing holding some of it together. */
  const code = [];
  const entities = (t) => t
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

  const text = tables(String(html))
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, '')
    /* A button is a control, never content: in a page read as text it is at
       best noise ("Copy") and at worst a list of panes run together. */
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    /* A hidden pane is one of several ways of saying the same thing, and the
       page only means the one on show. */
    .replace(/<(pre|p|li|span|label)\b[^>]*?\shidden(?:\s[^>]*?)?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (m, body) => {
      code.push(entities(body.replace(/<[^>]+>/g, '')).replace(/^\n+|\s+$/g, ''));
      return `\n\n\u0000${code.length - 1}\u0000\n\n`;
    })
    /* \b on every name, or <b> swallows <button> and <li> swallows <link>. */
    .replace(/<\/?(h2|h3)\b[^>]*>/gi, (m) => (m.startsWith('</') ? '\n\n' : m.includes('h3') ? '\n\n### ' : '\n\n## '))
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|details|summary|ul|ol|nav|footer|aside|figure|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(span|dt|dd)\b[^>]*>/gi, ' ')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<(b|strong|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '');

  return entities(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +| +$/gm, '')
    .replace(/ +([\])])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/\u0000(\d+)\u0000/g, (m, i) => `\`\`\`\n${code[i]}\n\`\`\``);
}

/* One page as markdown: the prose and the code, without the chrome. */
export function pageMarkdown(site, page, built) {
  const data = built.data ?? null;
  /* Markdown is read away from the site, so its links are absolute. */
  const ctx = { ...context({ site, page, rel: site.baseUrl }), link: (id) => (id ? `${site.baseUrl}${id}/` : site.baseUrl) };
  const parts = [`# ${page.title}`, ''];
  if (page.group && !page.home) parts.push(`*${site.name} · ${page.group}*`, '');
  if (page.lead) parts.push(toText(page.lead), '');
  if (page.code) parts.push('```' + (site.codeLang || 'ts'), page.code(built.state, data, ctx), '```', '');
  if (page.after) parts.push(toText(page.after(built.state, data, ctx)), '');
  if (page.ref?.length) {
    const heads = page.refHeaders || ['Setting', 'Default', 'Values'];
    parts.push(`## ${page.refTitle || 'Parameters'}`, '',
      `| ${heads.join(' | ')} |`, `|${heads.map(() => '---').join('|')}|`,
      ...page.ref.map((r) => `| ${r.map((c, i) => (i === 0 ? '`' + c + '`' : c)).join(' | ')} |`), '');
  }
  if (page.faq?.length) {
    parts.push('## Questions', '');
    for (const { q, a } of page.faq) parts.push(`**${q}**`, '', toText(a), '');
  }
  parts.push(`---`, `${pageUrl(site, page)} · ${site.name} ${site.version} · ${site.license || 'MIT'}`);
  return parts.join('\n');
}

export function sitemap(site, pages) {
  const date = site.updated || new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${pageUrl(site, p)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${p.home ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p.home ? '1.0' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

/* Every crawler worth naming is named. The AI ones are listed explicitly
   because a bare "Allow: /" is read by some of them as an absence of a
   decision, and the decision here is yes. */
const BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Googlebot', 'Bingbot', 'Applebot', 'Applebot-Extended',
  'DuckDuckBot', 'CCBot', 'Amazonbot', 'meta-externalagent', 'cohere-ai', 'YouBot', 'Bytespider'];

export function robots(site) {
  return `# ${site.name} — documentation. Everything here may be read, indexed and quoted.
User-agent: *
Allow: /

${BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}

Sitemap: ${site.baseUrl}sitemap.xml
`;
}

/* llmstxt.org: the index an assistant reads first. */
export function llmsTxt(site, pages) {
  const byGroup = new Map();
  for (const p of pages) {
    const g = p.home ? 'Start' : (p.group || 'Pages');
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(p);
  }
  return [
    `# ${site.name}`,
    ``,
    `> ${site.description}`,
    ``,
    site.about || '',
    site.about ? '' : null,
    `- Version ${site.version}, ${site.license || 'MIT'}, © ${site.owner}.`,
    site.npm ? `- Install: \`npm i ${site.packageName || site.name}\`` : null,
    site.repo ? `- Source: ${site.repo}` : null,
    `- Every page below is also available as markdown at its URL plus \`index.md\`.`,
    `- The whole documentation as one file: ${site.baseUrl}llms-full.txt`,
    ``,
    ...[...byGroup].flatMap(([g, ps]) => [
      `## ${g}`,
      ``,
      ...ps.map((p) => `- [${pageTitle(site, p).replace(/ · .*$/, '')}](${pageUrl(site, p)}index.md): ${pageDescription(site, p)}`),
      ``,
    ]),
  ].filter((l) => l !== null).join('\n');
}

export function llmsFull(site, pages, markdowns) {
  return [
    `# ${site.name} ${site.version} — complete documentation`,
    ``,
    `> ${site.description}`,
    ``,
    `${site.license || 'MIT'} · © ${site.owner} · ${site.baseUrl}`,
    ``,
    ...pages.map((p) => `\n\n---\n\n${markdowns.get(p.id)}`),
    ``,
  ].join('\n');
}

export function notFound(site) {
  return `<!doctype html>
<html lang="${site.lang || 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not here · ${site.name}</title>
<meta name="robots" content="noindex, follow">
<link rel="stylesheet" href="${site.basePath}assets/chrome.css">
${site.themeCss ? `<style>\n${site.themeCss}\n</style>` : ''}
</head>
<body>
<main id="page" class="page" style="max-width:40rem;margin:0 auto;padding:12vh 24px">
  <p class="crumb">404</p>
  <h1 class="title">That page is not here</h1>
  <p class="lead">It may have been renamed. The contents are on the front page.</p>
  <p><a href="${site.basePath}">Back to ${site.name}</a></p>
</main>
</body>
</html>
`;
}

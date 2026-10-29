/* The <head> of every page, and the structured data under it.

   Each page is a file with its own URL, so each one gets its own title,
   description and canonical. That is the whole reason this generator exists:
   meta tags on a single hash-routed page describe one page to a crawler, no
   matter how many screens the JavaScript can draw.
*/

import { esc } from '../assets/ui.js';

const json = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;

export const pageUrl = (site, page) => (page.slug ? `${site.baseUrl}${page.slug}/` : site.baseUrl);

export const pageTitle = (site, page) =>
  page.metaTitle || (page.home ? `${site.name}: ${site.tagline}` : `${page.title} · ${site.name}`);

export const pageDescription = (site, page) =>
  page.description || site.description;

/* Breadcrumbs, as data and as something a reader can click. A page in a group
   names its group, but a group is not a URL of its own, so the trail is
   home → page and the group stays a label. */
export function breadcrumbs(site, page, rel) {
  if (page.home) return '';
  return `<ol class="crumb">` +
    `<li><a href="${esc(rel)}">${esc(site.name)}</a></li>` +
    (page.group ? `<li>${esc(page.group)}</li>` : '') +
    `<li aria-current="page">${esc(page.title)}</li></ol>`;
}

function structuredData(site, page, pages) {
  const url = pageUrl(site, page);
  const blocks = [];

  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.name, item: site.baseUrl },
      ...(page.home ? [] : [{ '@type': 'ListItem', position: 2, name: page.title, item: url }]),
    ],
  });

  if (page.home) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: site.name,
      description: site.description,
      url: site.baseUrl,
      codeRepository: site.repo,
      programmingLanguage: site.programmingLanguage || 'TypeScript',
      runtimePlatform: site.runtimePlatform || 'Node.js',
      license: site.licenseUrl || 'https://opensource.org/licenses/MIT',
      version: site.version,
      keywords: (site.keywords || []).join(', '),
      author: { '@type': 'Person', name: site.author.name, ...(site.author.url ? { url: site.author.url } : {}) },
      copyrightHolder: { '@type': 'Organization', name: site.owner },
      ...(site.og?.image ? { image: site.baseUrl + site.og.image } : {}),
    });
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: site.name,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      description: site.description,
      url: site.baseUrl,
      softwareVersion: site.version,
      downloadUrl: site.npm,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Person', name: site.author.name },
    });
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      url: site.baseUrl,
      description: site.description,
      inLanguage: site.lang || 'en',
      publisher: { '@type': 'Organization', name: site.owner },
    });
  } else {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: page.title,
      description: pageDescription(site, page),
      url,
      inLanguage: site.lang || 'en',
      isPartOf: { '@type': 'WebSite', name: site.name, url: site.baseUrl },
      about: { '@type': 'SoftwareSourceCode', name: site.name, codeRepository: site.repo },
      author: { '@type': 'Person', name: site.author.name },
      ...(site.updated ? { dateModified: site.updated } : {}),
    });
  }

  if (page.faq?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: String(a).replace(/<[^>]+>/g, '') },
      })),
    });
  }

  return blocks.map(json).join('\n');
}

export function head(site, page, pages, rel) {
  const url = pageUrl(site, page);
  const title = pageTitle(site, page);
  const desc = pageDescription(site, page);
  const i = pages.indexOf(page);
  const prev = pages[i - 1];
  const next = pages[i + 1];
  const img = site.og?.image ? site.baseUrl + site.og.image : null;

  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta name="author" content="${esc(site.author.name)}">`,
    `<meta name="generator" content="package-site">`,
    /* An explicit grant: the default snippet length is short, and a docs page
       is worth more than a sentence to anything summarising it. */
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`,
    site.themeColor?.light ? `<meta name="theme-color" content="${esc(site.themeColor.light)}" media="(prefers-color-scheme: light)">` : '',
    site.themeColor?.dark ? `<meta name="theme-color" content="${esc(site.themeColor.dark)}" media="(prefers-color-scheme: dark)">` : '',
    prev ? `<link rel="prev" href="${esc(pageUrl(site, prev))}">` : '',
    next ? `<link rel="next" href="${esc(pageUrl(site, next))}">` : '',
    /* The same page as plain markdown, for anything that would rather read
       that than parse the HTML. */
    `<link rel="alternate" type="text/markdown" href="${esc(url)}index.md" title="${esc(page.title)} as markdown">`,
    `<link rel="alternate" type="text/plain" href="${esc(site.baseUrl)}llms.txt" title="llms.txt">`,
    /* So a reader subscribes from any page, not only the changelog. */
    site.feed ? `<link rel="alternate" type="application/atom+xml" href="${esc(site.baseUrl)}${esc(site.feed)}" title="${esc(site.name)} releases">` : null,
    ``,
    `<meta property="og:type" content="${page.home ? 'website' : 'article'}">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(page.ogTitle || title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:locale" content="${esc(site.locale || 'en_US')}">`,
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    img ? `<meta property="og:image:width" content="${esc(site.og.width || 1200)}">` : '',
    img ? `<meta property="og:image:height" content="${esc(site.og.height || 630)}">` : '',
    img && site.og.alt ? `<meta property="og:image:alt" content="${esc(site.og.alt)}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    img ? `<meta name="twitter:image" content="${esc(img)}">` : '',
    img && site.og.alt ? `<meta name="twitter:image:alt" content="${esc(site.og.alt)}">` : '',
    ``,
    site.icon ? `<link rel="icon" href="${esc(site.icon)}">` : '',
    ...(site.fonts || []).flatMap((href) => [
      `<link rel="preconnect" href="https://fonts.googleapis.com">`,
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
      `<link rel="stylesheet" href="${esc(href)}">`,
    ]).filter((v, j, a) => a.indexOf(v) === j),
    ...(site.preconnect || []).map((h) => `<link rel="preconnect" href="${esc(h)}">`),
    `<link rel="stylesheet" href="${esc(rel)}assets/chrome.css">`,
    ...(site.stylesheets || []).map((h) => `<link rel="stylesheet" href="${esc(rel)}${esc(h)}">`),
    site.themeCss ? `<style>\n${site.themeCss}\n</style>` : '',
    ``,
    structuredData(site, page, pages),
  ].filter(Boolean).join('\n');
}

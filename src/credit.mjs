/* The credit in the footer, from @nodsto/credit.

   The package is optional on purpose: nods is unpublished, and a site should
   still build without it. When it is missing the footer states the same facts
   in plain markup, so nothing disappears — it just stops being a record.
*/

export async function loadCredit() {
  try {
    const m = await import('@nodsto/credit');
    return { creditHTML: m.creditHTML, CSS: m.CSS, real: true };
  } catch {
    return { real: false };
  }
}

/* The record describes this site: the project, who made it, and what it was
   made with. Materials are facts about the build, which is exactly what a
   package's own site should be able to state. */
export function siteRecord(site) {
  return {
    project: {
      title: site.name,
      year: site.year || new Date().getUTCFullYear(),
      url: site.baseUrl,
      ...(site.credit?.shortUrl ? { shortUrl: site.credit.shortUrl } : {}),
    },
    statement: site.credit?.statement || '{title}, made by {creators}',
    creators: site.credit?.creators || [{
      name: site.author.name,
      url: site.author.url || site.repo,
      kind: 'person',
      role: 'development',
      degree: 'lead',
      state: 'embedded',
    }],
    ...(site.credit?.materials ? { materials: site.credit.materials } : {}),
  };
}

export function fallbackCredit(site) {
  const bits = [
    `${site.license || 'MIT'} · © ${site.owner}`,
    `Made by <b>${site.author.name}</b>`,
  ];
  return `<span class="nods">${bits.join(' · ')}</span>`;
}

export async function creditBlock(site) {
  const lib = await loadCredit();
  if (!lib.real) return { html: fallbackCredit(site), css: null, real: false };
  const leading = site.credit?.leading ?? [
    { text: site.license || 'MIT', href: site.licenseUrl || `${site.repo}/blob/main/LICENSE` },
    `© ${site.owner}`,
  ];
  return { html: lib.creditHTML(siteRecord(site), { leading, ...(site.credit?.options || {}) }), css: lib.CSS, real: true };
}

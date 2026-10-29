/* Everything a package has to say about its own site. */
export default {
  tagline: 'the shape of a package site',
  baseUrl: 'https://tbudin.github.io/example-package/',
  repo: 'https://github.com/tbudin/example-package',
  npm: 'https://www.npmjs.com/package/example-package',
  author: { name: 'Thomas Budin', url: 'https://plainmatter.com' },
  owner: 'Plain Matter Pte Ltd',
  about: 'A reference site: it exists so the template can be checked without touching a real package.',
  findLabel: 'Find a page',
  themeColor: { light: '#fbfaf7', dark: '#16161a' },
  theme: {
    tokens: { '--accent': '#2d5d4f', '--mark': '#cfe3d4' },
    dark: { '--accent': '#86c7b0', '--mark': '#1f3b33' },
  },
  credit: {
    statement: '{title}, made by {creators}',
    materials: [{ kind: 'host', name: 'GitHub Pages', url: 'https://pages.github.com' }],
  },
};

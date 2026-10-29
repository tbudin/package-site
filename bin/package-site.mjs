#!/usr/bin/env node
/* package-site build — writes the site into the package's docs/ folder.
   package-site check — builds and then reads the result back, failing on the
   things that are easy to ship broken: a missing canonical, a page with no
   description, an asset nothing serves.
   package-site serve [port] — builds, then serves it for a look. */

import { build } from '../src/build.mjs';
import { check } from '../src/check.mjs';
import { serve } from '../src/serve.mjs';

const [cmd = 'build'] = process.argv.slice(2);

try {
  if (cmd === 'build') { console.log('package-site'); await build({}); }
  else if (cmd === 'check') { console.log('package-site'); const r = await build({ quiet: true }); process.exit(await check(r) ? 0 : 1); }
  else if (cmd === 'serve') { const r = await build({ quiet: true }); serve({ root: r.out, port: Number(process.argv[3]) || 4321 }); }
  else { console.error(`package-site: unknown command "${cmd}" (build | check | serve)`); process.exit(2); }
} catch (error) {
  console.error(`package-site: ${error.message}`);
  process.exit(1);
}

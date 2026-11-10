// From pocket-quartermaster scripts/sim/build.mjs, trimmed for the POC.
// Bundles the balance sim for plain node, with the `@/` alias and the content's image requires.
import * as path from 'node:path';

import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '../..');

await build({
  entryPoints: { sim: path.join(root, 'scripts/sim/index.ts') },
  outdir: path.join(root, 'sim-output/.build'),
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  alias: { '@': path.join(root, 'src') },
  logLevel: 'warning',
  plugins: [
    {
      // Content files require() their icons and portraits; each one becomes its path.
      name: 'assets',
      setup(b) {
        b.onLoad({ filter: /\.(png|jpe?g|gif|webp)$/ }, (args) => ({ contents: `module.exports = ${JSON.stringify(args.path)};`, loader: 'js' }));
      },
    },
  ],
});

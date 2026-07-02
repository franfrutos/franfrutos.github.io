#!/usr/bin/env node
/* Post-render: strip render-blocking assets Quarto injects but this site never uses.
 * Currently: bootstrap-icons.css (~96 KB) — the site uses zero `bi-*` glyphs (its own
 * icons are the self-hosted FA/Academicons subset). Removing the <link> drops a blocking
 * stylesheet from every page. Runs on the built _site, so it's safe and CI-friendly. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, '_site');
const DROP = /\s*<link[^>]*bootstrap-icons\.css[^>]*>/g;

let changed = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      const html = fs.readFileSync(p, 'utf8');
      const out = html.replace(DROP, '');
      if (out !== html) { fs.writeFileSync(p, out); changed++; }
    }
  }
}
if (fs.existsSync(site)) walk(site);
console.log('strip-assets: removed bootstrap-icons.css link from ' + changed + ' pages');

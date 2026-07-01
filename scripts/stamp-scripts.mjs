#!/usr/bin/env node
/* Pre-render (runs last): write _includes/scripts.html with content-hash cache
 * busters (?v=xxxxxxxx) on each local <script src>.
 *
 * The scripts are served from fixed paths (/assets/js/site.js, …). Browsers
 * cache those hard, so without a version query a change to site.js / paper.js
 * or to the generated data bundles (research.js, …) wouldn't reach a returning
 * visitor until their HTTP cache expired — which is exactly the "my edit didn't
 * show up" surprise. The hash is derived from the file's bytes, so the URL only
 * changes when the file actually changes → no churn when nothing changed.
 *
 * This script is the source of truth for the list; its output is gitignored.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Grouped exactly as before: [section comment, [src, …]].
const GROUPS = [
  ['Map dependencies (vendored, no build step)', [
    '/assets/d3-array.min.js',
    '/assets/d3-geo.min.js',
    '/assets/topojson-client.min.js',
  ]],
  ['Data', [
    '/assets/data/research.js',
    '/assets/data/journey.js',
    '/assets/data/city-coords.js',
  ]],
  ['Runtime', [
    '/assets/js/site.js',
    '/assets/js/paper.js',
  ]],
];
// Data + runtime load deferred (as before); the vendored d3 libs load eagerly.
const DEFER = new Set([
  '/assets/data/research.js', '/assets/data/journey.js', '/assets/data/city-coords.js',
  '/assets/js/site.js', '/assets/js/paper.js',
]);

function versioned(src) {
  const file = path.join(root, src.replace(/^\//, ''));
  try {
    const hash = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    return src + '?v=' + hash;
  } catch {
    return src; // not generated yet on this pass — ship it unversioned
  }
}

const lines = [];
for (const [comment, srcs] of GROUPS) {
  lines.push('<!-- ' + comment + ' -->');
  for (const src of srcs) {
    lines.push('<script src="' + versioned(src) + '"' + (DEFER.has(src) ? ' defer' : '') + '></script>');
  }
  lines.push('');
}

fs.writeFileSync(path.join(root, '_includes', 'scripts.html'), lines.join('\n').trimEnd() + '\n');
console.log('stamped _includes/scripts.html');

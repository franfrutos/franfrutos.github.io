#!/usr/bin/env node
/* Post-render: make sitemap.xml list the same URLs as each page's <link rel="canonical">.
 * Quarto writes every page as .../index.html, while canonical-url gives .../ — so Google
 * crawled the sitemap copy, followed the canonical, and filed the sitemap URL under
 * "Alternate page with proper canonical tag". A sitemap should only list canonical URLs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '_site', 'sitemap.xml');

if (fs.existsSync(file)) {
  const xml = fs.readFileSync(file, 'utf8');
  let n = 0;
  const out = xml.replace(/(<loc>[^<]*\/)index\.html(<\/loc>)/g, (_, a, b) => { n++; return a + b; });
  if (out !== xml) fs.writeFileSync(file, out);
  console.log('fix-sitemap: ' + n + ' URLs now match their canonical');
}

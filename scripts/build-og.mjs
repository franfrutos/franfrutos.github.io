#!/usr/bin/env node
/* Pre-render: generate a per-paper Open Graph share card (assets/og/<slug>.png)
 * for every publication, using Typst — already a dependency via the CV, so there
 * are no new npm deps and it runs identically on GitHub Actions. build-papers
 * points each paper's `image:` at its card; the home/CV use the generic og-image.
 *
 * Output is gitignored and regenerated on render, but a small content-hash
 * manifest means only new/changed cards are recompiled (fast incremental renders).
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from './vendor/js-yaml.mjs';
import { SITE, paperSlug } from './_shared.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fonts = path.join(root, 'cv/_extensions/fgf-cv/fonts');
const outDir = path.join(root, 'assets/og');
const { papers } = yaml.load(fs.readFileSync(path.join(root, 'data/papers.yml'), 'utf8'));

fs.mkdirSync(outDir, { recursive: true });

// Escape a string for a Typst content block [...].
const escTyp = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/([#$*_`\[\]@<>~])/g, '\\$1');

// The title font shrinks as the title grows so it always fits the card.
function titleSize(t) {
  const n = t.length;
  if (n <= 45) return 52;
  if (n <= 75) return 46;
  if (n <= 110) return 40;
  if (n <= 150) return 34;
  return 30;
}
function statusLabel(p) {
  if (p.preprint) return 'PREPRINT';
  if (p.osf && p.osf.production) return 'IN PRESS';
  return 'PAPER';
}
function venueLine(p) {
  const yr = /^\d/.test(String(p.year)) ? ' · ' + p.year : '';
  return (p.venue || '') + yr;
}

// Hills motif (same mark as the logo/favicon), dark palette, semi-transparent —
// embedded as an SVG so Typst renders the overlapping shapes correctly.
const HILLS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 26">'
  + '<path d="M3,23.5 C6.8,23.5 6.8,14.5 10.5,14.5 C14.2,14.5 14.2,23.5 18,23.5 Z" fill="#6c7382" opacity="0.5"/>'
  + '<path d="M9,23.5 C12.8,23.5 12.8,8.5 16.5,8.5 C20.2,8.5 20.2,23.5 24,23.5 Z" fill="#c79a5e" opacity="0.55"/>'
  + '<path d="M15,23.5 C18.8,23.5 18.8,15.5 22.5,15.5 C26.2,15.5 26.2,23.5 30,23.5 Z" fill="#ff5a3c" opacity="0.5"/>'
  + '</svg>';
const HILLS_TYP = 'image(bytes("' + HILLS_SVG.replace(/"/g, '\\"') + '"), format: "svg", width: 5.6in)';

// The card: brand-dark background, coral status label + name up top, the title
// centred, venue · year at the bottom, a coral rule, and the hills motif bleeding
// off the bottom-right corner.
function cardTyp(p) {
  return [
    '#set page(width: 12.5in, height: 6.5625in, margin: (x: 0.95in, y: 0.8in), fill: rgb("#1b1e26"))',
    '#set text(font: "IBM Plex Mono", fill: rgb("#e9ebef"))',
    '#place(bottom + right, dx: 0.9in, dy: 1.35in, ' + HILLS_TYP + ')',
    '#place(top + left, text(size: 20pt, fill: rgb("#ff5a3c"), weight: "bold", tracking: 4pt)[' + statusLabel(p) + '])',
    '#place(top + right, text(size: 15pt, fill: rgb("#6c7382"), tracking: 2pt)[' + escTyp(SITE.name.toUpperCase()) + '])',
    '#place(horizon + left, dy: -0.15in, box(width: 10.4in, text(size: ' + titleSize(p.title) + 'pt, weight: "bold", fill: rgb("#e9ebef"))[' + escTyp(p.title) + ']))',
    '#place(bottom + left, text(size: 23pt, style: "italic", fill: rgb("#ff5a3c"))[' + escTyp(venueLine(p)) + '])',
    '#place(bottom + left, dx: -0.95in, dy: 0.8in, rect(width: 12.5in, height: 9pt, fill: rgb("#ff5a3c")))',
  ].join('\n');
}

const manifestPath = path.join(outDir, '.manifest.json');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
const next = {};
const tmp = path.join(outDir, '_card.typ');
let built = 0, skipped = 0, failed = 0;

for (const p of papers) {
  const slug = paperSlug(p);
  const out = path.join(outDir, slug + '.png');
  const typ = cardTyp(p);
  const hash = crypto.createHash('md5').update(typ).digest('hex');
  next[slug] = hash;
  if (manifest[slug] === hash && fs.existsSync(out)) { skipped++; continue; }
  fs.writeFileSync(tmp, typ);
  const r = spawnSync('quarto typst compile "' + tmp + '" "' + out + '" --font-path "' + fonts + '" --ppi 96', { stdio: 'pipe', shell: true });
  if (r.status === 0) built++;
  else { failed++; delete next[slug]; console.error('build-og: failed for ' + slug + (r.stderr ? '\n' + r.stderr.toString() : '')); }
}
try { fs.unlinkSync(tmp); } catch {}
fs.writeFileSync(manifestPath, JSON.stringify(next, null, 0));
console.log('og cards: ' + built + ' built, ' + skipped + ' cached' + (failed ? ', ' + failed + ' failed' : '') + ' → assets/og/');

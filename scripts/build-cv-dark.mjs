#!/usr/bin/env node
/* Post-render: compile the extra CV PDFs that Quarto doesn't produce itself.
 *
 *  - Dark public PDF: recompile Quarto's kept cv/cv.typ with `--input fgfdark=1`
 *    (flips the template palette) → _site/cv/Garre-Frutos-CV-dark.pdf
 *  - Private PDFs (light + dark): if .private/cv-private.typ exists (built by
 *    build-cv.mjs from the gitignored .private/private.yml overlay), compile it
 *    → .private/. Local-only — .private/ never exists on CI, so this is skipped.
 *
 * Uses Quarto's bundled Typst so it works locally and on CI.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fonts = path.join(root, 'cv/_extensions/fgf-cv/fonts');
const outDir = process.env.QUARTO_PROJECT_OUTPUT_DIR
  ? path.resolve(root, process.env.QUARTO_PROJECT_OUTPUT_DIR)
  : path.join(root, '_site');

const q = (s) => '"' + s + '"';
function compile(typ, out, dark) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // --root = repo root so the private .typ may import ../cv/... (typst sandboxes to the input's dir otherwise).
  const args = ['quarto', 'typst', 'compile', q(typ), q(out), '--root', q(root), '--font-path', q(fonts)];
  if (dark) args.push('--input', 'fgfdark=1');
  const r = spawnSync(args.join(' '), { stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error('build-cv-dark: compile failed for ' + out + ' (continuing)'); return; }
  console.log('built ' + path.relative(root, out).replace(/\\/g, '/'));
}

// Dark public PDF.
const pubTyp = path.join(root, 'cv/cv.typ');
if (fs.existsSync(pubTyp)) compile(pubTyp, path.join(outDir, 'cv', 'Garre-Frutos-CV-dark.pdf'), true);
else console.log('build-cv-dark: cv/cv.typ not found (cv not rendered this pass) — skipping dark PDF');

// Private PDFs (local only).
const privTyp = path.join(root, '.private/cv-private.typ');
if (fs.existsSync(privTyp)) {
  compile(privTyp, path.join(root, '.private', 'Garre-Frutos-CV-private.pdf'), false);
  compile(privTyp, path.join(root, '.private', 'Garre-Frutos-CV-private-dark.pdf'), true);
}

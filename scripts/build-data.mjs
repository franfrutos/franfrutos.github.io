#!/usr/bin/env node
/* Convert the human-friendly YAML sources into the JS the site loads.
 *
 *   data/papers.yml   →  assets/data/research.js   (window.FGF_THEMES)
 *   data/journey.yml  →  assets/data/journey.js    (window.FGF_JOURNEY)
 *
 * You only edit the YAML. These JS files are generated on every render (see
 * _quarto.yml pre-render) and are git-ignored. No npm install — the YAML parser
 * is vendored at scripts/vendor/js-yaml.mjs.
 */
import { byDateDesc, preprintServer, paperSlug } from './_shared.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from './vendor/js-yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readYaml = (f) => yaml.load(fs.readFileSync(path.join(root, f), 'utf8'));
const str = (v) => (v == null ? v : String(v));

// Packages with a website card (a `name:` in cv.yml `software:`), each with the
// paper that introduces it (papers.yml `software: <id>`).
function softwareList() {
  const { software = [] } = readYaml('data/cv.yml');
  const { papers } = readYaml('data/papers.yml');
  return software.filter((s) => s.name).map((s) => {
    const p = papers.find((x) => x.software === s.id);
    return { id: s.id, name: s.name, tagline: s.tagline, about: s.about, logo: s.logo, cran: s.cran, install: s.install,
      website: s.url, code: s.code, paper: p ? '/research/' + paperSlug(p) + '/' : null };
  });
}

function buildSoftware() {
  const { software_section: sec } = readYaml('data/papers.yml');
  return sec ? { num: str(sec.num), short: sec.short, title: sec.title, blurb: sec.blurb, packages: softwareList() } : null;
}

function buildResearch() {
  const { threads, papers: all } = readYaml('data/papers.yml');
  // `cvOnly: true` keeps a manuscript in the CV (build-cv reads papers.yml
  // directly) but off the website — for work with no preprint to link to yet.
  const papers = all.filter((p) => !p.cvOnly);
  const sw = Object.fromEntries(softwareList().map((s) => [s.id, s]));
  const ids = new Set(threads.map((t) => t.id));
  papers.forEach((p) => { if (!ids.has(p.thread)) console.error('  ✗ paper "' + p.title + '" has unknown thread: "' + p.thread + '"'); });
  // Newest first within each section; a non-numeric year ("in press") ranks above all.
  return threads.map((t) => ({
    num: str(t.num), short: t.short, title: t.title, blurb: t.blurb,
    pubs: papers.filter((p) => p.thread === t.id).map((p) => {
      const pub = { year: str(p.year), title: p.title, authors: p.authors, venue: p.venue, isPreprint: !!p.preprint, server: preprintServer(p).name };
      ['url', 'doi', 'slug', 'osf', 'tags', 'keywords', 'abstract', 'bibtex', 'ris',
       'volume', 'issue', 'pages', 'articleno', 'status', 'date', 'aliases'].forEach((k) => { if (p[k] != null) pub[k] = p[k]; });
      if (sw[p.software]) pub.software = sw[p.software];
      return pub;
    }).sort(byDateDesc),
  }));
}

function buildJourney() {
  const { journey } = readYaml('data/journey.yml');
  return journey.map((j) => {
    const o = Object.assign({}, j);
    if (o.year != null) o.year = str(o.year);
    if (o.from != null) o.from = str(o.from);
    return o;
  });
}

const header = (name) => '/* AUTO-GENERATED from data/' + name + ' by scripts/build-data.mjs — do not edit.\n * Edit the YAML; this file is rebuilt on every render. */\n';
fs.mkdirSync(path.join(root, 'assets/data'), { recursive: true }); // may not exist on a fresh checkout
fs.writeFileSync(path.join(root, 'assets/data/research.js'), header('papers.yml') + 'window.FGF_SOFTWARE = ' + JSON.stringify(buildSoftware(), null, 2) + ';\nwindow.FGF_THEMES = ' + JSON.stringify(buildResearch(), null, 2) + ';\n');
fs.writeFileSync(path.join(root, 'assets/data/journey.js'), header('journey.yml') + 'window.FGF_JOURNEY = ' + JSON.stringify(buildJourney(), null, 2) + ';\n');
console.log('built assets/data/research.js + journey.js from YAML');

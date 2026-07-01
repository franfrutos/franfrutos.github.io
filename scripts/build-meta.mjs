#!/usr/bin/env node
/* Pre-render (first): generate _includes/head.html from data/site.yml.
 *
 * This is the single source of truth for site identity & SEO — edit site.yml
 * and everything in every page's <head> updates: og:title/description defaults,
 * the Twitter card, and the JSON-LD Person entity. Per-page bits (the share
 * image via `image:` front-matter, and og:type) are set by each page, so they
 * are intentionally NOT here.
 *
 * Output is gitignored; the static boilerplate (theme script, fonts, favicons)
 * lives in this generator.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './_shared.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Content-hash query so browsers refetch a favicon when it actually changes
// (they cache favicons very aggressively otherwise).
const fav = (rel) => {
  try { return rel + '?v=' + crypto.createHash('md5').update(fs.readFileSync(path.join(root, rel.replace(/^\//, '')))).digest('hex').slice(0, 8); }
  catch { return rel; }
};

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: SITE.name,
  url: SITE.url + '/',
  image: SITE.url + SITE.ogImage,
  jobTitle: SITE.role,
  affiliation: { '@type': 'Organization', name: SITE.affiliation },
  knowsAbout: SITE.keywords || [],
  sameAs: Object.values(SITE.profiles || {}),
};
// Escape "<" so nothing can close the <script> early (still valid JSON).
const jsonLd = JSON.stringify(person).replace(/</g, '\\u003c');

const head = `<!-- GENERATED from data/site.yml by scripts/build-meta.mjs — do not edit. -->

<!-- Pre-paint theme: set before first paint to avoid a light flash. Default dark. -->
<script>
  (function () {
    try {
      var t = localStorage.getItem('fgf-theme');
      var dark = (t == null) ? true : (t === 'dark');
      document.documentElement.classList.toggle('fgf-dark', dark);
    } catch (e) {
      document.documentElement.classList.add('fgf-dark');
    }
  })();
</script>

<!-- Fonts: IBM Plex Mono everywhere (400/500/600/700) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Icon fonts -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/academicons/1.9.4/css/academicons.min.css">

<!-- Favicons -->
<link rel="icon" href="${fav('/assets/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${fav('/assets/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${fav('/assets/favicon-180.png')}">

<!-- og:site_name + Twitter @site (Quarto generates og:title/description/image and
     twitter:title/description/image/card from each page's front matter). -->
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta name="twitter:site" content="${esc(SITE.twitter || '')}">

<!-- Structured data: who this site is about -->
<script type="application/ld+json">${jsonLd}</script>
`;

fs.mkdirSync(path.join(root, '_includes'), { recursive: true }); // may not exist on a fresh checkout
fs.writeFileSync(path.join(root, '_includes', 'head.html'), head);
console.log('generated _includes/head.html from data/site.yml');

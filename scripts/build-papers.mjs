#!/usr/bin/env node
/* Generate a detail page (research/<slug>/index.qmd) for every publication in
 * assets/data/research.js, from a single shared template. Runs in pre-render.
 * Add `abstract`/`keywords`/`bibtex`/`ris` to a paper in data/papers.yml to enrich it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGO, BADGES, SITE, paperSlug } from './_shared.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const RESEARCH = path.join(root, 'assets/data/research.js');
const OUTDIR = path.join(root, 'research');
const PDFDIR = path.join(root, 'assets/pdf');
// A self-hosted full-text PDF (final version-of-record or accepted postprint) that
// lives next to the page, so Google Scholar can index the full text (citation_pdf_url
// must be same-directory). Returns the filename if one is committed, else null.
// Only stable finals are hosted — preprints stay on PsyArXiv (see the OA/Scholar plan).
function pdfName(p) { const f = paperSlug(p) + '.pdf'; return fs.existsSync(path.join(PDFDIR, f)) ? f : null; }

const ME = 'Garre-Frutos, F.', DAG = '†';
const DAG_TITLE = 'Shared first authorship — these authors contributed equally';
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function authorPartsHTML(s) {
  const out = [];
  const pushText = (text) => { text.split(DAG).forEach((b, j, arr) => { if (b) out.push('<span>' + esc(b) + '</span>'); if (j < arr.length - 1) out.push('<span class="shared-dagger" title="' + esc(DAG_TITLE) + '">' + DAG + '</span>'); }); };
  s.split(ME).forEach((seg, i, arr) => { if (seg) pushText(seg); if (i < arr.length - 1) out.push('<span class="au-me">' + esc(ME) + '</span>'); });
  return out.join('');
}
function doiOf(p) { const m = (p.url || '').match(/doi\.org\/(.+)$/); return m ? m[1] : ''; }
// True when `url` points at a PsyArXiv preprint (its DOI is 10.31234/…).
const isPreprintUrl = (p) => /(?:^|\/)10\.31234\/|psyarxiv/i.test(p.url || '');
// The DOI to *cite*: a PsyArXiv preprint DOI belongs to the preprint, so only cite
// it when the venue is the preprint itself — for an in-press/published paper the
// PsyArXiv url is just a convenience read-link, not the article's DOI.
function citeDoi(p) { const d = doiOf(p); return (/^10\.31234\//.test(d) && !/psyarxiv/i.test(p.venue || '')) ? '' : d; }
function readThemes() { const win = {}; new Function('window', fs.readFileSync(RESEARCH, 'utf8'))(win); return win.FGF_THEMES || []; }


function badgesHTML(p) {
  const o = p.osf || {};
  // Icon-only badges (label in the tooltip) — compact and consistent with the
  // home listing; 5 small badges read far cleaner than 5 labelled pills.
  return BADGES.map((b) => {
    let { icon, tip, off } = b;
    // A badge is "on" when its value is a string URL (link there) or `true` (link to the paper/preprint URL).
    let v = o[b.key];
    // The open-access slot adapts to how the paper is available:
    //   preprint → PsyArXiv "Preprint" · published OA → open-access · shared
    //   postprint → PsyArXiv "Postprint" · accepted/in press → gear · else greyed.
    if (b.key === 'oa') {
      if (p.isPreprint) { icon = 'ai ai-psyarxiv'; tip = 'Preprint — publicly available on PsyArXiv'; v = p.url; }
      else if (!o.oa) {
        if (o.postprint) { icon = 'ai ai-psyarxiv'; tip = 'Postprint — author-accepted manuscript, free to read'; v = o.postprint; }
        else if (o.production) return '<span class="osf-badge" title="In production — final version not yet available"><i class="fa-solid fa-gear" style="font-size:16px;"></i></span>';
      }
    }
    const href = typeof v === 'string' ? v : p.url;
    if (v && href) {
      return '<a href="' + esc(href) + '" target="_blank" title="' + esc(tip) + '" class="osf-badge"><i class="' + icon + '" style="font-size:16px;"></i></a>'; }
    return '<span class="osf-badge off" title="' + esc(off) + '"><i class="' + icon + '" style="font-size:16px;"></i></span>';
  }).join('');
}
function bibTail(p) {
  let t = '';
  if (p.volume != null) t += ', ' + p.volume;
  if (p.issue != null) t += '(' + p.issue + ')';
  if (p.pages != null) t += ', ' + p.pages;
  else if (p.articleno != null) t += ', ' + (/^\d+$/.test(String(p.articleno)) ? 'Article ' + p.articleno : p.articleno);
  return t;
}
function apaCite(p) { const authors = p.authors.replace(new RegExp(DAG, 'g'), ''); const doi = citeDoi(p); return authors + ' (' + p.year + '). ' + p.title + '. ' + p.venue + bibTail(p) + '.' + (doi ? ' https://doi.org/' + doi : ''); }
// APA 7 italics: journal name and volume number are italicized (issue and pages are not).
// Returns safe HTML (user text escaped, only our <em> tags injected) for display; the plain
// `apa` string is what gets copied to the clipboard.
function bibTailHtml(p) {
  let t = '';
  if (p.volume != null) t += ', <em>' + esc(p.volume) + '</em>';
  if (p.issue != null) t += '(' + esc(p.issue) + ')';
  if (p.pages != null) t += ', ' + esc(p.pages);
  else if (p.articleno != null) t += ', ' + esc(/^\d+$/.test(String(p.articleno)) ? 'Article ' + p.articleno : p.articleno);
  return t;
}
function apaCiteHtml(p) { const authors = esc(p.authors.replace(new RegExp(DAG, 'g'), '')); const doi = citeDoi(p); return authors + ' (' + p.year + '). ' + esc(p.title) + '. <em>' + esc(p.venue) + '</em>' + bibTailHtml(p) + '.' + (doi ? ' https://doi.org/' + esc(doi) : ''); }
// Always offer all three cite formats; hand-written bibtex/ris (in papers.yml)
// win, otherwise they're generated from the paper's fields.
function citeData(p) { return { apa: apaCite(p), apaHtml: apaCiteHtml(p), bibtex: p.bibtex || genBibtex(p), ris: p.ris || genRis(p) }; }
// Abstracts are plain text; escape everything, then allow only [label](https://url)
// markdown links (rendered as anchors) so a paper can point at a live demo/tool.
function abstractHtml(s) {
  return esc(s).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
}

// Split the author string into individual "Family, Initials" entries (best effort).
function splitAuthors(s) {
  s = String(s || '').replace(new RegExp(DAG, 'g'), '').replace(/,?\s*…\s*/g, ', ').replace(/,?\s*et al\.?/gi, '').replace(/\s*&\s*/g, ', ');
  const out = []; const re = /([^,]+?,\s*(?:[A-ZÀ-Ý]\.?\s*)+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1].trim().replace(/,$/, ''));
  return out;
}

// Auto-generated BibTeX / RIS (fallback when none is hand-written in papers.yml).
const isJournal = (p) => p.venue && p.venue.toLowerCase() !== 'under review';
function citeKey(p) {
  const fam = (splitAuthors(p.authors)[0] || 'anon').split(',')[0]
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const word = (String(p.title).match(/[A-Za-z]{4,}/) || ['ref'])[0].toLowerCase();
  const yr = String(p.year).replace(/[^a-z0-9]/gi, ''); // "in press" → "inpress" (no spaces in the key)
  return (fam || 'ref') + yr + word;
}
function genBibtex(p) {
  const doi = citeDoi(p);
  const L = ['@article{' + citeKey(p) + ',', '  title   = {' + p.title + '},', '  author  = {' + splitAuthors(p.authors).join(' and ') + '},'];
  if (isJournal(p)) L.push('  journal = {' + p.venue + '},');
  if (p.volume != null) L.push('  volume  = {' + p.volume + '},');
  if (p.issue != null) L.push('  number  = {' + p.issue + '},');
  if (p.pages != null) L.push('  pages   = {' + String(p.pages).replace(/–/g, '--') + '},');
  L.push('  year    = {' + p.year + '},');
  if (doi) L.push('  doi     = {' + doi + '},');
  L.push('}');
  return L.join('\n');
}
function genRis(p) {
  const doi = citeDoi(p);
  const L = ['TY  - JOUR'];
  splitAuthors(p.authors).forEach((a) => L.push('AU  - ' + a));
  L.push('TI  - ' + p.title);
  if (isJournal(p)) L.push('JO  - ' + p.venue);
  if (p.volume != null) L.push('VL  - ' + p.volume);
  if (p.issue != null) L.push('IS  - ' + p.issue);
  if (p.pages != null) { const parts = String(p.pages).split(/[–-]/); L.push('SP  - ' + parts[0].trim()); if (parts[1]) L.push('EP  - ' + parts[1].trim()); }
  L.push('PY  - ' + p.year);
  if (doi) L.push('DO  - ' + doi);
  L.push('ER  - ');
  return L.join('\n');
}
// Highwire citation_* meta tags → Zotero Connector + Google Scholar can detect the paper.
function citationMeta(p) {
  const L = []; const add = (n, c) => { if (c != null && c !== '') L.push('  <meta name="' + n + '" content="' + esc(c) + '">'); };
  add('citation_title', p.title);
  splitAuthors(p.authors).forEach((a) => add('citation_author', a));
  // Prefer a full publication date (YYYY/MM/DD from Crossref, stored in papers.yml)
  // over the bare year; an in-press paper (year "in press") has neither → omitted.
  add('citation_publication_date', p.date || (/^\d/.test(String(p.year)) ? p.year : ''));
  if (p.venue && p.venue.toLowerCase() !== 'under review') add('citation_journal_title', p.venue);
  add('citation_volume', p.volume);
  add('citation_issue', p.issue);
  // A page range → first/last; a single page or an article e-locator → first page only.
  if (p.pages != null) { const [sp, ep] = String(p.pages).split(/\s*[–-]\s*/); add('citation_firstpage', sp); if (ep) add('citation_lastpage', ep); }
  else if (p.articleno != null) add('citation_firstpage', p.articleno);
  const doi = citeDoi(p);
  if (doi) {
    add('citation_doi', doi);
    // Belt-and-suspenders: the same DOI in the DC and PRISM formats some crawlers
    // (incl. Altmetric) look for, in case they don't read Highwire citation_doi.
    add('dc.identifier', 'doi:' + doi);
    add('prism.doi', doi);
  }
  const pdf = pdfName(p); if (pdf) add('citation_pdf_url', SITE.url + '/research/' + paperSlug(p) + '/' + pdf);
  add('citation_abstract_html_url', SITE.url + '/research/' + paperSlug(p) + '/');
  add('citation_language', 'en');
  return L.join('\n');
}
// Share/description card text: the abstract opening (~160 chars), links stripped to
// plain text; falls back to the APA citation when there's no abstract.
function shareDescription(p) {
  let s = p.abstract ? p.abstract.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') : apaCite(p);
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 160) s = s.slice(0, 157).replace(/\s+\S*$/, '') + '…';
  return s;
}
// schema.org ScholarlyArticle JSON-LD so Google/Scholar read a paper as an entity.
function jsonLd(p) {
  const o = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: p.title,
    author: splitAuthors(p.authors).map((a) => ({ '@type': 'Person', name: a })),
    url: SITE.url + '/research/' + paperSlug(p) + '/',
    inLanguage: 'en',
  };
  if (p.year && /^\d/.test(String(p.year))) o.datePublished = String(p.year);
  if (isJournal(p)) o.isPartOf = { '@type': 'Periodical', name: p.venue };
  const doi = citeDoi(p);
  if (doi) { o.sameAs = 'https://doi.org/' + doi; o.identifier = 'https://doi.org/' + doi; }
  else if (p.url) o.sameAs = p.url;
  if (p.abstract) o.abstract = p.abstract.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  if (p.keywords && p.keywords.length) o.keywords = p.keywords.join(', ');
  // Escape "<" so an abstract can never close the <script> early (still valid JSON).
  return '  <script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';
}
// Everything injected into a paper page's <head>: Highwire citation meta (Scholar/
// Zotero), og:type=article, and the JSON-LD entity.
function paperHead(p) {
  return citationMeta(p) + '\n  <meta property="og:type" content="article">\n' + jsonLd(p);
}

function renderPaper(p, threadTitle, prev, next) {
  const cd = citeData(p), tabs = ['apa', 'bibtex', 'ris'];
  // Label the primary button by where its link actually goes: a PsyArXiv url is a
  // preprint read-link (true even for an accepted/in-press paper whose final DOI
  // isn't out yet); anything else is the published version.
  const preprintLink = isPreprintUrl(p);
  const primary = p.url
    ? '<a href="' + esc(p.url) + '" target="_blank" class="h-btn h-btn-primary"><i class="' + (preprintLink ? 'ai ai-psyarxiv' : 'fa-solid fa-up-right-from-square') + '"></i> ' + (preprintLink ? 'Preprint (PsyArXiv)' : 'Published version') + '</a>'
    : '<span class="h-btn h-btn-ghost off"><i class="fa-solid fa-hourglass-half"></i> ' + esc(p.venue) + '</span>';
  // Direct link to the self-hosted full text (when we host one) so visitors — not
  // just Scholar's crawler — can read the PDF without leaving the site.
  const pdfFile = pdfName(p);
  const pdfBtn = pdfFile ? '<a href="' + esc(pdfFile) + '" target="_blank" class="h-btn h-btn-ghost"><i class="fa-solid fa-file-pdf"></i> PDF</a>' : '';
  // "Add to Zotero", hybrid: if the paper has a citable article DOI, hand it to
  // Zotero's save-by-DOI service (rich CrossRef metadata). Otherwise (in press, or
  // a paper whose only DOI is a preprint we keep out of the citation) offer a .ris
  // download built from the exact on-page citation — the Zotero Connector picks up
  // RIS downloads automatically, so it still lands in the library.
  const citableDoi = citeDoi(p);
  const zotero = citableDoi
    ? '<a href="https://www.zotero.org/save?type=doi&q=' + esc(citableDoi) + '" target="_blank" class="h-btn h-btn-ghost"><i class="ai ai-zotero"></i> Add to Zotero</a>'
    : '<a href="data:application/x-research-info-systems;charset=utf-8,' + encodeURIComponent(cd.ris) + '" download="' + esc(paperSlug(p)) + '.ris" class="h-btn h-btn-ghost"><i class="ai ai-zotero"></i> Add to Zotero</a>';
  const preprintTag = p.isPreprint ? '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ink3); background:var(--chip); padding:3px 8px; border-radius:100px;">Preprint</span>' : '';
  const abstractSection = p.abstract
    ? '<section style="padding:52px 0 8px;"><div class="sec-label"><span></span><h2>Abstract</h2></div><div class="abstract-panel"><p class="abstract-body" style="font-size:18px; color:var(--ink2); margin:0; line-height:1.72; max-width:700px; font-family:\'IBM Plex Mono\',monospace;">' + abstractHtml(p.abstract) + '</p>' + (p.keywords && p.keywords.length ? ('<div style="display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:28px; padding-top:24px; border-top:1px solid var(--line);"><span style="font-family:\'IBM Plex Mono\',monospace; font-size:10.5px; letter-spacing:0.07em; text-transform:uppercase; color:var(--ink3); margin-right:4px;">Keywords</span>' + p.keywords.map((k) => '<span class="kw"><span class="kw-dot"></span>' + esc(k) + '</span>').join('') + '</div>') : '') + '</div></section>'
    : '<section style="padding:48px 0 8px;"><div class="sec-label"><span></span><h2>Abstract</h2></div><p style="font-size:15px; color:var(--ink3); font-family:\'IBM Plex Mono\',monospace; font-style:italic;">Abstract coming soon — read the full text via the link above.</p></section>';
  const tabBtns = tabs.map((t, i) => '<button class="cite-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + t + '">' + ({ apa: 'APA', bibtex: 'BibTeX', ris: 'RIS' }[t]) + '</button>').join('');

  const body =
'```{=html}\n' +
'<nav style="position:sticky; top:0; z-index:20; background:var(--nav); backdrop-filter:blur(10px); border-bottom:1px solid var(--line);">\n' +
'  <div class="page-nav-inner" style="max-width:820px; margin:0 auto; padding:0 40px; height:64px; display:flex; align-items:center; justify-content:space-between;">\n' +
'    <a href="/" style="display:flex; align-items:center; gap:13px;">' + LOGO + '<span class="nav-wordmark" style="font-family:\'IBM Plex Mono\',monospace; font-size:15px; font-weight:500; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink); white-space:nowrap;"><span class="nav-fname">Francisco </span><span style="color:var(--accent);">Garre-Frutos</span></span></a>\n' +
'    <div style="display:flex; gap:26px; align-items:center;"><a href="/#research" class="nav-link">← All research</a><button data-theme-toggle aria-label="Toggle dark mode" class="theme-toggle"><i data-theme-icon class="fa-solid fa-sun" style="font-size:15px;"></i></button></div>\n' +
'  </div>\n</nav>\n\n' +
'<article class="paper-article" style="max-width:820px; margin:0 auto; padding:44px 40px 96px;">\n' +
'  <header class="paper-hero"><div style="position:relative;">\n' +
'    <div style="display:flex; align-items:center; gap:12px; margin-bottom:22px; flex-wrap:wrap;"><span class="thread-pill">' + esc(threadTitle) + '</span><span style="font-family:\'IBM Plex Mono\',monospace; font-size:12px; letter-spacing:0.06em; color:var(--ink3);">' + esc(p.year) + '</span></div>\n' +
'    <h1 style="font-family:\'IBM Plex Mono\', monospace; font-weight:600; font-size:33px; line-height:1.2; letter-spacing:0; margin:0 0 24px; color:var(--ink); text-wrap:balance;">' + esc(p.title) + '</h1>\n' +
'    <p style="font-family:\'IBM Plex Mono\',monospace; font-size:14.5px; color:var(--ink2); margin:0 0 10px; line-height:1.6; letter-spacing:-0.01em;">' + authorPartsHTML(p.authors) + '</p>\n' +
'    <p style="margin:0; display:flex; align-items:center; gap:12px; flex-wrap:wrap;"><span style="font-style:italic; font-family:\'IBM Plex Mono\',monospace; font-size:20px; color:var(--accent);">' + esc(p.venue) + '</span>' + preprintTag + '</p>\n' +
'    <div class="h-actions">' + primary + pdfBtn + zotero + '<a href="#cite" class="h-btn h-btn-ghost"><i class="fa-solid fa-quote-right"></i> Cite</a></div>\n' +
'    <div class="h-badges">' + badgesHTML(p) + '</div>\n' +
'  </div></header>\n\n  ' + abstractSection + '\n\n' +
'  <section id="cite" style="padding:48px 0 0;"><div class="sec-label"><span></span><h2>How to cite</h2></div>\n' +
'    <div class="cite-card" id="fgf-cite-card"><div class="cite-head"><div class="cite-tabs">' + tabBtns + '</div><button class="cite-copy"><i class="fa-regular fa-copy"></i> <span>Copy</span></button></div><div id="fgf-cite-body"></div></div>\n  </section>\n\n' +
'  <nav class="paper-foot"><a class="foot-link" href="/research/' + paperSlug(prev) + '/"><span class="foot-dir">← Previous</span><span class="foot-title">' + esc(prev.title) + '</span></a><a class="foot-link foot-next" href="/research/' + paperSlug(next) + '/"><span class="foot-dir">Next →</span><span class="foot-title">' + esc(next.title) + '</span></a></nav>\n' +
'  <div style="text-align:center; margin-top:28px;"><a href="/#research" class="nav-link" style="color:var(--ink3);">← Back to all research</a></div>\n</article>\n\n' +
'<script type="application/json" id="fgf-cite">\n' + JSON.stringify(cd, null, 2) + '\n</script>\n```\n';

  // pagetitle is just the paper title; Quarto appends the site title (" – Francisco
  // Garre-Frutos") once — adding it here too would double the suffix in <title>.
  // When a full-text PDF is hosted, list it as a page resource so Quarto copies it
  // into _site/research/<slug>/ next to index.html (main() drops the file there).
  const pdf = pdfName(p);
  const resLine = pdf ? 'resources:\n  - ' + pdf + '\n' : '';
  return '---\npagetitle: ' + JSON.stringify(p.title) + '\ndescription: ' + JSON.stringify(shareDescription(p)) + '\nimage: ' + JSON.stringify(SITE.url + '/assets/og/' + paperSlug(p) + '.png') + '\n' + resLine + 'header-includes: |\n' + paperHead(p) + '\n---\n\n::: {data-site=""}\n\n' + body + '\n:::\n';
}

function main() {
  const themes = readThemes();
  const flat = [];
  themes.forEach((t) => t.pubs.forEach((p) => flat.push({ p, threadTitle: t.title })));
  if (fs.existsSync(OUTDIR)) for (const e of fs.readdirSync(OUTDIR, { withFileTypes: true })) if (e.isDirectory()) fs.rmSync(path.join(OUTDIR, e.name), { recursive: true, force: true });
  const seen = new Set();
  flat.forEach(({ p, threadTitle }, i) => {
    const slug = paperSlug(p);
    if (seen.has(slug)) { console.error('  ✗ duplicate slug: ' + slug); return; }
    seen.add(slug);
    const prev = flat[(i - 1 + flat.length) % flat.length].p, next = flat[(i + 1) % flat.length].p;
    const dir = path.join(OUTDIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    const pdf = pdfName(p);
    if (pdf) fs.copyFileSync(path.join(PDFDIR, pdf), path.join(dir, pdf));
    fs.writeFileSync(path.join(dir, 'index.qmd'), renderPaper(p, threadTitle, prev, next));
  });
  console.log('built ' + seen.size + ' paper detail pages → research/<slug>/');
}
main();

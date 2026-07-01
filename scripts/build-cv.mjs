#!/usr/bin/env node
/* Generate the CV body from the shared YAML data.
 *
 *   data/cv.yml + data/papers.yml  →  cv/_cv-body.qmd   (a raw {=typst} block)
 *
 * The publications + ongoing-work sections are pulled from papers.yml so the
 * CV and the website never drift apart; everything else lives in cv.yml. The
 * generated file is git-ignored and rebuilt on every render (see _quarto.yml
 * pre-render). The Typst helper functions it calls (cvheader, cvsection,
 * entry, kv, methodrow, pubitem, subhead) are defined in
 * cv/_extensions/fgf-cv/typst-template.typ.
 *
 * No npm install — the YAML parser is vendored at scripts/vendor/js-yaml.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from './vendor/js-yaml.mjs';
import { LOGO, BADGES } from './_shared.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readYaml = (f) => yaml.load(fs.readFileSync(path.join(root, f), 'utf8'));

const ME = 'Garre-Frutos, F.';
const ACCENT = '#e8421d';

// --- Typst escaping ---------------------------------------------------------
// Escape the characters that carry meaning in Typst *markup* so arbitrary text
// can sit safely inside a `[...]` content block.
const escTyp = (s) => String(s == null ? '' : s).replace(/[\\#\[\]*_$<>@`]/g, (m) => '\\' + m);
// Escape for a Typst *string literal* ("...").
const escStr = (s) => String(s == null ? '' : s).replace(/[\\"]/g, (m) => '\\' + m);
const lcfirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// Convert our light markdown (only *italics*) into Typst content, escaping the
// rest. Used for every human-authored string from the YAML.
function inlineMd(s) {
  s = String(s == null ? '' : s);
  let out = '', last = 0, m;
  const re = /\*([^*]+)\*/g;
  while ((m = re.exec(s))) {
    out += escTyp(s.slice(last, m.index));
    out += '#emph[' + escTyp(m[1]) + ']';
    last = re.lastIndex;
  }
  return out + escTyp(s.slice(last));
}

// Author lists: bold every "Garre-Frutos, F." and raise any † to a coral
// superscript (shared-first-authorship marker), mirroring the website.
function authorsTyp(s) {
  const dagger = (t) => t.replace(/†/g, '#super[#text(fill: rgb("' + ACCENT + '"))[†]]');
  return String(s)
    .split(ME)
    .map((seg) => dagger(escTyp(seg)))
    .join('#text(weight: "semibold")[' + escTyp(ME) + ']');
}

// --- Publication formatting -------------------------------------------------
const isPublished = (p) => !p.preprint && String(p.venue || '').toLowerCase() !== 'under review';

function venueTyp(p) {
  if (isPublished(p)) {
    let tail = '';
    if (p.volume != null) tail += ', ' + escTyp(p.volume);
    if (p.issue != null) tail += '(' + escTyp(p.issue) + ')';
    if (p.pages != null) tail += ', ' + escTyp(p.pages);
    else if (p.articleno != null)
      tail += ', ' + (/^\d+$/.test(String(p.articleno)) ? 'Article ' + escTyp(p.articleno) : escTyp(p.articleno));
    return '#emph[' + escTyp(p.venue) + ']' + tail + '.';
  }
  if (p.preprint) {
    let s = '#emph[' + escTyp(p.venue || 'PsyArXiv') + ']';
    if (p.status) s += '; ' + escTyp(lcfirst(p.status));
    return s + '.';
  }
  // e.g. "Under review" with a submission status
  if (p.status) return escTyp(p.status) + '.';
  return '#emph[' + escTyp(p.venue) + '].';
}

// Always return all badges as [key, on] so missing practices render greyed-off.
function pubBadges(p) {
  const o = p.osf || {};
  return BADGE_KEYS.map((k) => {
    // The open-access slot adapts to how the paper is available: a preprint shows
    // the PsyArXiv glyph, a shared postprint likewise, and an accepted/in-press
    // paper whose final access status is unknown shows a gear ("in production") —
    // each instead of a greyed OA.
    if (k === 'oa') {
      if (p.preprint) return ['preprint', true];
      if (!o.oa && o.postprint) return ['postprint', true];
      if (!o.oa && o.production) return ['production', true];
    }
    return [k, !!o[k]];
  });
}

function pubItem(p) {
  // The title links to the paper/preprint (clickable in the PDF) when there's a url.
  const title = '#emph[' + escTyp(p.title) + '.]';
  const linked = p.url ? '#link("' + escStr(p.url) + '")[' + title + ']' : title;
  const body =
    authorsTyp(p.authors) + ' (' + escTyp(p.year) + '). ' +
    linked + ' ' + venueTyp(p);
  const badges = pubBadges(p)
    .map(([k, on]) => '("' + k + '", ' + (on ? 'true' : 'false') + ')')
    .join(', ');
  return '#pubitem([' + body + '], badges: (' + badges + ',))\n';
}

function talkItem(t) {
  const body =
    authorsTyp(t.authors) + ' (' + escTyp(t.year) + '). ' +
    '#emph[' + escTyp(t.title) + '] ' + escTyp(t.venue);
  return '#pubitem([' + body + '])\n';
}

// --- Generic entry emitter --------------------------------------------------
function emitEntry(e) {
  const args = [];
  const add = (k, v) => { if (v != null && v !== '') args.push(k + ': [' + inlineMd(v) + ']'); };
  add('title', e.title);
  add('right', e.right);
  add('org', e.org);
  add('dates', e.dates);
  const body = [];
  (e.fields || []).forEach(([label, val]) => body.push('#kv("' + escStr(label) + '", [' + inlineMd(val) + '])'));
  if (e.body) body.push(inlineMd(e.body));
  if (body.length) args.push('body: [\n    ' + body.join('\n    ') + '\n  ]');
  return '#entry(\n  ' + args.join(',\n  ') + ',\n)\n';
}

const section = (title) => '\n#cvsection("' + escStr(title) + '")\n\n';

// --- Assemble the raw Typst body from a cv object + papers ------------------
function typstBody(cv, papers) {
  // Non-numeric years ("in press") rank as the most recent so they sort to the top.
  const yr = (p) => { const n = Number(p.year); return Number.isFinite(n) ? n : Infinity; };
  const byYearDesc = (a, b) => yr(b) - yr(a);
  const published = papers.filter(isPublished).slice().sort(byYearDesc);
  const ongoing = papers.filter((p) => !isPublished(p)).slice().sort(byYearDesc);

  let out = '';

  // Masthead
  const h = cv.header;
  const contacts = (h.contacts || [])
    .map((c) => '    (icon: "' + escStr(c.icon || 'web') + '", label: "' + escStr(c.label) + '", url: ' + (c.url ? '"' + escStr(c.url) + '"' : 'none') + ')')
    .join(',\n');
  out += '#cvheader(\n' +
    '  name: "' + escStr(h.name) + '",\n' +
    '  surname: "' + escStr(h.surname) + '",\n' +
    '  role: "' + escStr(h.role) + '",\n' +
    '  field: "' + escStr(h.field) + '",\n' +
    '  location: "' + escStr(h.location) + '",\n' +
    '  tagline: "' + escStr(h.tagline) + '",\n' +
    '  contacts: (\n' + contacts + ',\n  ),\n' +
    ')\n';

  out += section('Education');
  cv.education.forEach((e) => { out += emitEntry(e); });

  out += section('Research Experience');
  cv.experience.forEach((e) => { out += emitEntry(e); });

  out += section('Methods & Technical Expertise');
  (cv.methods || []).forEach(([label, value]) => {
    out += '#methodrow([' + inlineMd(label) + '], [' + inlineMd(value) + '])\n';
  });

  out += section('Specialized Training');
  (cv.training || []).forEach((t) => { out += emitEntry({ title: t.title, right: t.dates, org: t.org }); });

  out += section('Publications');
  published.forEach((p) => { out += pubItem(p); });
  if ((cv.outreach_publications || []).length) {
    out += '\n#subhead("Outreach publication")\n\n';
    cv.outreach_publications.forEach((p) => { out += talkItem(p); });
  }

  out += section('Ongoing Work');
  ongoing.forEach((p) => { out += pubItem(p); });

  out += section('Funded Projects');
  cv.funded.forEach((e) => { out += emitEntry(e); });

  out += section('Conference Presentations');
  out += '#subhead("Oral presentations")\n\n';
  cv.conferences.oral.forEach((t) => { out += talkItem(t); });
  out += '\n#subhead("Poster presentations")\n\n';
  cv.conferences.poster.forEach((t) => { out += talkItem(t); });

  out += section('Teaching');
  cv.teaching.forEach((e) => { out += emitEntry(e); });

  out += section('Student Supervision');
  cv.supervision.forEach((e) => { out += emitEntry(e); });

  out += section('Academic Events Organized');
  cv.events.forEach((e) => { out += emitEntry(e); });

  out += section('Academic Service & Professional Memberships');
  cv.service.forEach((e) => { out += emitEntry(e); });

  out += section('Outreach Activities');
  cv.outreach.forEach((e) => { out += emitEntry(e); });

  return out;
}

function build() {
  const cv = readYaml('data/cv.yml');
  const { papers } = readYaml('data/papers.yml');
  // Generate the WHOLE cv/cv.qmd (front matter + inlined Typst body). It used to
  // be a committed cv.qmd with `{{< include _cv-body.qmd >}}`, but Quarto resolves
  // that include during its initial project scan — before pre-render runs — so on
  // a fresh checkout (CI) the generated _cv-body.qmd doesn't exist yet and the
  // render aborts. Generating the whole file (like the research pages) avoids it.
  fs.writeFileSync(path.join(root, 'cv/cv.qmd'),
    '---\n' +
    '# AUTO-GENERATED from data/cv.yml + data/papers.yml by scripts/build-cv.mjs — do not edit.\n' +
    'format: fgf-cv-typst\n' +
    'output-file: Garre-Frutos-CV\n' +
    'keep-typ: true\n' +                                  // kept so build-cv-dark.mjs can recompile the dark PDF
    'font-paths:\n' +
    '  - cv/_extensions/fgf-cv/fonts\n' +                 // base = project root (full render / CI)
    '  - _extensions/fgf-cv/fonts\n' +                    // base = cv/ (single-file render)
    '---\n\n' +
    '```{=typst}\n' + typstBody(cv, papers) + '```\n');
  console.log('built cv/cv.qmd');

  // Private variant: if .private/private.yml exists (gitignored, local-only),
  // merge it and emit a standalone Typst so build-cv-dark.mjs can compile a
  // private PDF with the extra info (e.g. phone). Absent on CI → never built.
  const privYaml = path.join(root, '.private/private.yml');
  if (fs.existsSync(privYaml)) {
    const priv = yaml.load(fs.readFileSync(privYaml, 'utf8')) || {};
    const cvPriv = JSON.parse(JSON.stringify(cv));
    const prepend = (priv.header && priv.header.contacts_prepend) || [];
    cvPriv.header.contacts = prepend.concat(cvPriv.header.contacts || []);
    fs.writeFileSync(path.join(root, '.private/cv-private.typ'),
      '#import "../cv/_extensions/fgf-cv/typst-template.typ": *\n#show: cv\n\n' + typstBody(cvPriv, papers));
    console.log('built .private/cv-private.typ (private CV, +' + prepend.length + ' contact)');
  }
}

// =============================================================================
// HTML companion page (cv/index.qmd) — the same data, themed like the website
// (follows light/dark), with a Download-PDF action. Styles live in theme.scss
// under the ".cv-*" block. (LOGO + BADGES come from ./_shared.mjs.)
// =============================================================================

const htmlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inlineHtml(s) {
  s = String(s == null ? '' : s);
  let out = '', last = 0, m;
  const re = /\*([^*]+)\*/g;
  while ((m = re.exec(s))) { out += htmlEsc(s.slice(last, m.index)); out += '<em>' + htmlEsc(m[1]) + '</em>'; last = re.lastIndex; }
  return out + htmlEsc(s.slice(last));
}
function authorsHtml(s) {
  const dag = (t) => t.replace(/†/g, '<sup class="shared-dagger">†</sup>');
  return String(s).split(ME).map((seg) => dag(htmlEsc(seg))).join('<span class="au-me">' + htmlEsc(ME) + '</span>');
}
function venueHtml(p) {
  if (isPublished(p)) {
    let tail = '';
    if (p.volume != null) tail += ', ' + htmlEsc(p.volume);
    if (p.issue != null) tail += '(' + htmlEsc(p.issue) + ')';
    if (p.pages != null) tail += ', ' + htmlEsc(p.pages);
    else if (p.articleno != null) tail += ', ' + (/^\d+$/.test(String(p.articleno)) ? 'Article ' + htmlEsc(p.articleno) : htmlEsc(p.articleno));
    return '<em>' + htmlEsc(p.venue) + '</em>' + tail + '.';
  }
  if (p.preprint) { let s = '<em>' + htmlEsc(p.venue || 'PsyArXiv') + '</em>'; if (p.status) s += '; ' + htmlEsc(lcfirst(p.status)); return s + '.'; }
  if (p.status) return htmlEsc(p.status) + '.';
  return '<em>' + htmlEsc(p.venue) + '</em>.';
}
// Badge keys (in order) + icon/label lookup, derived from the shared list.
const BADGE_KEYS = BADGES.map((b) => b.key);
const BADGE_META = Object.fromEntries(BADGES.map((b) => [b.key, [b.icon, b.label]]));
// Same icon set as the PDF masthead, using the Font Awesome + Academicons the site already loads.
const CONTACT_ICON = {
  phone: 'fa-solid fa-phone', email: 'fa-solid fa-envelope', web: 'fa-solid fa-globe',
  github: 'fa-brands fa-github', bluesky: 'fa-brands fa-bluesky',
  scholar: 'ai ai-google-scholar', orcid: 'ai ai-orcid', osf: 'ai ai-osf',
};
function badgesHtml(p) {
  const o = p.osf || {};
  const items = BADGE_KEYS.map((k) => {
    let [ic, lab] = BADGE_META[k];
    let v = o[k];
    // The open-access slot adapts to how the paper is available (see build-papers).
    if (k === 'oa') {
      if (p.preprint) { ic = 'ai ai-psyarxiv'; lab = 'Preprint'; v = p.url; }
      else if (!o.oa) {
        if (o.postprint) { ic = 'ai ai-psyarxiv'; lab = 'Postprint'; v = o.postprint; }
        else if (o.production) return '<span class="osf-badge" title="In production — final version not yet available"><i class="fa-solid fa-gear"></i></span>';
      }
    }
    const href = typeof v === 'string' ? v : p.url;
    return (v && href)
      ? '<a class="osf-badge" target="_blank" title="' + lab + '" href="' + htmlEsc(href) + '"><i class="' + ic + '"></i></a>'
      : '<span class="osf-badge off" title="' + lab + ' — not available"><i class="' + ic + '"></i></span>';
  });
  return '<span class="cv-badges">' + items.join('') + '</span>';
}
function pubHtml(p) {
  const title = p.url
    ? '<a class="pub-title-link" target="_blank" href="' + htmlEsc(p.url) + '"><em>' + htmlEsc(p.title) + '.</em></a>'
    : '<em>' + htmlEsc(p.title) + '.</em>';
  return '<li class="cv-pub">' + authorsHtml(p.authors) + ' (' + htmlEsc(p.year) + '). ' + title + ' ' + venueHtml(p) + ' ' + badgesHtml(p) + '</li>';
}
function talkHtml(t) {
  return '<li class="cv-pub">' + authorsHtml(t.authors) + ' (' + htmlEsc(t.year) + '). <em>' + htmlEsc(t.title) + '</em> ' + htmlEsc(t.venue) + '</li>';
}
function entryHtml(e) {
  let h = '<div class="cv-entry"><div class="t">' + inlineHtml(e.title) + '</div><div class="r">' + inlineHtml(e.right) + '</div>';
  if (e.org != null || e.dates != null) h += '<div class="o">' + inlineHtml(e.org) + '</div><div class="d">' + inlineHtml(e.dates) + '</div>';
  const body = [];
  (e.fields || []).forEach(([l, v]) => body.push('<div class="cv-kv"><b>' + htmlEsc(l) + ':</b> ' + inlineHtml(v) + '</div>'));
  if (e.body) body.push('<p>' + inlineHtml(e.body) + '</p>');
  if (body.length) h += '<div class="b">' + body.join('') + '</div>';
  return h + '</div>';
}
const secHtml = (title, inner) => '<section class="cv-sec"><div class="sec-label"><span></span><h2>' + htmlEsc(title) + '</h2></div>' + inner + '</section>';

function buildHtml() {
  const cv = readYaml('data/cv.yml');
  const { papers } = readYaml('data/papers.yml');
  // Non-numeric years ("in press") rank as the most recent so they sort to the top.
  const yr = (p) => { const n = Number(p.year); return Number.isFinite(n) ? n : Infinity; };
  const byYearDesc = (a, b) => yr(b) - yr(a);
  const published = papers.filter(isPublished).slice().sort(byYearDesc);
  const ongoing = papers.filter((p) => !isPublished(p)).slice().sort(byYearDesc);
  const h = cv.header;

  const contacts = (h.contacts || []).map((c) => {
    const ic = CONTACT_ICON[c.icon] ? '<i class="' + CONTACT_ICON[c.icon] + '"></i>' : '';
    const inner = ic + htmlEsc(c.label);
    return c.url
      ? '<a href="' + htmlEsc(c.url) + '"' + (/^mailto:/.test(c.url) ? '' : ' target="_blank"') + '>' + inner + '</a>'
      : '<span>' + inner + '</span>';
  }).join('<span class="dot">·</span>');

  const masthead =
    '<header class="cv-masthead">' +
    '<h1 class="cv-name">' + htmlEsc(h.name) + ' <span class="sur">' + htmlEsc(h.surname) + '</span></h1>' +
    '<p class="cv-role">' + htmlEsc((h.role || '').toUpperCase()) + '<span class="sep">·</span>' + htmlEsc((h.field || '').toUpperCase()) + '</p>' +
    '<p class="cv-loc">' + htmlEsc(h.location) + '</p>' +
    '<p class="cv-contacts">' + contacts + '</p>' +
    (h.tagline ? '<p class="cv-tagline">' + htmlEsc(h.tagline) + '</p>' : '') +
    '<div class="cv-rule"></div>' +
    '</header>';

  let body = '';
  body += secHtml('Education', cv.education.map(entryHtml).join(''));
  body += secHtml('Research Experience', cv.experience.map(entryHtml).join(''));
  body += secHtml('Methods & Technical Expertise',
    '<div class="cv-methods">' + (cv.methods || []).map(([l, v]) => '<div class="ml">' + htmlEsc(l) + '</div><div class="mv">' + inlineHtml(v) + '</div>').join('') + '</div>');
  body += secHtml('Specialized Training', cv.training.map((t) => entryHtml({ title: t.title, right: t.dates, org: t.org })).join(''));

  let pubs = '<ul class="cv-publist">' + published.map(pubHtml).join('') + '</ul>';
  if ((cv.outreach_publications || []).length)
    pubs += '<div class="cv-subhead">Outreach publication</div><ul class="cv-publist">' + cv.outreach_publications.map(talkHtml).join('') + '</ul>';
  body += secHtml('Publications', pubs);
  body += secHtml('Ongoing Work', '<ul class="cv-publist">' + ongoing.map(pubHtml).join('') + '</ul>');
  body += secHtml('Funded Projects', cv.funded.map(entryHtml).join(''));
  body += secHtml('Conference Presentations',
    '<div class="cv-subhead">Oral presentations</div><ul class="cv-publist">' + cv.conferences.oral.map(talkHtml).join('') + '</ul>' +
    '<div class="cv-subhead">Poster presentations</div><ul class="cv-publist">' + cv.conferences.poster.map(talkHtml).join('') + '</ul>');
  body += secHtml('Teaching', cv.teaching.map(entryHtml).join(''));
  body += secHtml('Student Supervision', cv.supervision.map(entryHtml).join(''));
  body += secHtml('Academic Events Organized', cv.events.map(entryHtml).join(''));
  body += secHtml('Academic Service & Professional Memberships', cv.service.map(entryHtml).join(''));
  body += secHtml('Outreach Activities', cv.outreach.map(entryHtml).join(''));

  const nav =
    '<nav style="position:sticky; top:0; z-index:20; background:var(--nav); backdrop-filter:blur(10px); border-bottom:1px solid var(--line);">' +
    '<div class="page-nav-inner" style="max-width:880px; margin:0 auto; padding:0 40px; height:64px; display:flex; align-items:center; justify-content:space-between;">' +
    '<a href="/" style="display:flex; align-items:center; gap:13px;">' + LOGO + '<span class="nav-wordmark" style="font-family:\'IBM Plex Mono\',monospace; font-size:15px; font-weight:500; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink); white-space:nowrap;"><span class="nav-fname">Francisco </span><span style="color:var(--accent);">Garre-Frutos</span></span></a>' +
    '<div style="display:flex; gap:22px; align-items:center;">' +
    '<a href="/" class="nav-link nav-home">← Home</a>' +
    // Two links; theme.scss shows the one matching the current theme (html.fgf-dark).
    '<a href="Garre-Frutos-CV.pdf" target="_blank" class="detail-link cv-dl cv-dl-light"><i class="fa-solid fa-file-arrow-down"></i> <span class="dl-text">Download PDF</span></a>' +
    '<a href="Garre-Frutos-CV-dark.pdf" target="_blank" class="detail-link cv-dl cv-dl-dark"><i class="fa-solid fa-file-arrow-down"></i> <span class="dl-text">Download PDF</span></a>' +
    '<button data-theme-toggle aria-label="Toggle dark mode" class="theme-toggle"><i data-theme-icon class="fa-solid fa-sun" style="font-size:15px;"></i></button>' +
    '</div></div></nav>';

  // The Download button switches between the light/dark PDF based on the page
  // theme — wired in assets/js/site.js (apply()), which targets #cv-dl.
  const page =
    '---\n' +
    // Full tab title set here + empty title-prefix suppresses Quarto's default
    // " – <site title>" suffix, so the CV tab reads exactly this (not "… – …, PhD").
    'pagetitle: "Curriculum Vitae · Francisco Garre-Frutos"\n' +
    'title-prefix: ""\n' +
    'description: "Academic CV of Francisco Garre-Frutos — postdoctoral researcher in experimental psychology (Autonomous University of Madrid)."\n' +
    'image: "/assets/og-image.png"\n' +
    'header-includes: |\n' +
    '  <meta property="og:type" content="profile">\n' +
    '---\n\n' +
    '::: {data-site=""}\n\n' +
    '```{=html}\n' + nav + '\n<article class="cv-page">' + masthead + body + '</article>\n```\n\n:::\n';
  fs.writeFileSync(path.join(root, 'cv/index.qmd'), page);
  console.log('built cv/index.qmd — on-site HTML CV page');
}

build();
buildHtml();

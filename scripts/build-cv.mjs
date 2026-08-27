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
// *italics* and [text](url) links; link text may itself contain *italics*.
function inlineMd(s) {
  s = String(s == null ? '' : s);
  let out = '', last = 0, m;
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  while ((m = re.exec(s))) {
    out += escTyp(s.slice(last, m.index));
    out += m[1] != null
      ? '#plink("' + escStr(m[2]) + '")[' + inlineMd(m[1]) + ']'
      : m[3] != null
        ? '#text(weight: "semibold")[' + escTyp(m[3]) + ']'
        : '#emph[' + escTyp(m[4]) + ']';
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
    .join('#text(weight: "semibold", fill: ink)[' + escTyp(ME) + ']');
}

// --- Publication formatting -------------------------------------------------
const isPublished = (p) => !p.preprint && String(p.venue || '').toLowerCase() !== 'under review';

function venueTyp(p) {
  if (isPublished(p)) {
    let tail = '';
    // APA 7: the volume number is italicized along with the journal name. The
    // trailing ; ends the code expression so a following "(issue)" isn't parsed
    // as a function call on the emph content.
    if (p.volume != null) tail += ', #emph[' + escTyp(p.volume) + '];';
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

// Always return all badges as [key, on, url] so missing practices render
// greyed-off and lit badges are clickable in the PDF. Same url semantics as the
// website: a string value links there, `true` links to the paper itself.
function pubBadges(p) {
  const o = p.osf || {};
  const urlOf = (v) => (typeof v === 'string' ? v : (v ? p.url || null : null));
  return BADGE_KEYS.map((k) => {
    // The open-access slot adapts to how the paper is available: a preprint shows
    // the PsyArXiv glyph, a shared postprint likewise, and an accepted/in-press
    // paper whose final access status is unknown shows a gear ("in production") —
    // each instead of a greyed OA.
    if (k === 'oa') {
      if (p.preprint) return ['preprint', true, p.url || null];
      if (!o.oa && o.postprint) return ['postprint', true, urlOf(o.postprint)];
      if (!o.oa && o.production) return ['production', true, urlOf(o.production)];
    }
    return [k, !!o[k], urlOf(o[k])];
  });
}

function pubItem(p, opts = {}) {
  // The title links to the paper/preprint (clickable in the PDF) when there's a url.
  // Smart punctuation (both profiles): no trailing period after ? or !
  // opts.badges === false (Short profile): omit the open-science badge row.
  const dot = /[?!]$/.test(String(p.title)) ? '' : '.';
  const title = '#emph[' + escTyp(p.title) + dot + ']';
  const linked = p.url ? '#plink("' + escStr(p.url) + '")[' + title + ']' : title;
  const body =
    authorsTyp(p.authors) + ' (' + escTyp(p.year) + '). ' +
    linked + ' ' + venueTyp(p);
  if (opts.badges === false) return '#pubitem([' + body + '])\n';
  const badges = pubBadges(p)
    .map(([k, on, url]) => '("' + k + '", ' + (on ? 'true' : 'false') + ', ' + (url ? '"' + escStr(url) + '"' : 'none') + ')')
    .join(', ');
  return '#pubitem([' + body + '], badges: (' + badges + ',))\n';
}

function talkItem(t) {
  // venue goes through inlineMd (not escTyp) so *asterisks* italicise symposium names.
  const title = '#emph[' + escTyp(t.title) + ']';
  const body =
    authorsTyp(t.authors) + ' (' + escTyp(t.year) + '). ' +
    (t.url ? '#plink("' + escStr(t.url) + '")[' + title + ']' : title) + ' ' + inlineMd(t.venue);
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
  let out = '#entry(\n  ' + args.join(',\n  ') + ',\n)\n';
  // Nested research stays (entry.stays) render indented under the position.
  (e.stays || []).forEach((s) => {
    const sa = [];
    if (s.title) sa.push('title: [' + inlineMd(s.title) + ']');
    if (s.right) sa.push('place: [' + inlineMd(s.right) + ']');
    if (s.dates) sa.push('dates: [' + inlineMd(s.dates) + ']');
    const sb = (s.fields || []).map(([label, val]) => '#kv("' + escStr(label) + '", [' + inlineMd(val) + '])');
    if (sb.length) sa.push('body: [\n    ' + sb.join('\n    ') + '\n  ]');
    out += '#substay(\n  ' + sa.join(',\n  ') + ',\n)\n';
  });
  return out;
}

const section = (title) => '\n#cvsection("' + escStr(title) + '")\n\n';

// Masthead emitter shared by the full and short bodies. `contactIcons` filters
// (and orders) the contact row; `tagline` overrides the YAML one.
function headerTyp(h, { contactIcons = null, tagline = null } = {}) {
  let list = h.contacts || [];
  if (contactIcons) list = contactIcons.map((ic) => list.find((c) => c.icon === ic)).filter(Boolean);
  const contacts = list
    .map((c) => '    (icon: "' + escStr(c.icon || 'web') + '", label: "' + escStr(c.label) + '", url: ' + (c.url ? '"' + escStr(c.url) + '"' : 'none') + ')')
    .join(',\n');
  return '#cvheader(\n' +
    '  name: "' + escStr(h.name) + '",\n' +
    '  surname: "' + escStr(h.surname) + '",\n' +
    '  role: "' + escStr(h.role) + '",\n' +
    '  field: "' + escStr(h.field) + '",\n' +
    '  location: "' + escStr(h.location) + '",\n' +
    '  tagline: "' + escStr(tagline != null ? tagline : h.tagline) + '",\n' +
    '  contacts: (\n' + contacts + ',\n  ),\n' +
    ')\n';
}

// ============================================================================
// Render profiles: one source of truth (data/cv.yml + data/papers.yml), two
// permanent outputs. FULL is the comprehensive record; SHORT is a reusable
// max-4-page selective CV (fellowships, postdoc applications, grants…).
// Selection is keyed by the stable, non-rendered `id:` fields in the YAML —
// nothing is duplicated: update the data once and both CVs follow. Compact
// typography for SHORT comes from the template's `--input fgfcompact=1`
// branch (see typst-template.typ); every visual component is shared.
//
// Build:  node scripts/build-cv.mjs                 → both profiles
//         node scripts/build-cv.mjs --profile full  → cv/cv.qmd only
//         node scripts/build-cv.mjs --profile short → cv/cv-short.qmd only
// ============================================================================
const SHORT = {
  eduFieldIds: ['phd'],                                     // MSc/BSc render bare
  awards: ['bridging', 'rldm', 'sepex-outreach', 'fpu', 'eebb', 'end-of-degree'],
  preprints: ['explicit-knowledge', 'load-distractors', 'load-facilitation', 'choose-your-own-pas', 'ior-learned-value'],
  // Leadership first (Co-PI), then thematic relevance, then the international
  // collaboration grant (Theeuwes visiting scholarship). Any future PI/Co-PI
  // project should be added here with high priority.
  funded: ['unlearn', 'lets-roc', 'vigilance-decrement', 'new-habits', 'visiting-scholars'],
  training: ['bamb', 'eeg', 'jags', 'smlp-2023', 'cimcyc-modelling'],
  service: ['pci-rr', 'psicologica', 'adhoc'],
  // Curated conference subset (ids live in data/cv.yml conferences.oral/.poster).
  // The second element is a compressed form of the YAML venue string: same
  // conference, city, and presentation type — symposium titles and day ranges
  // dropped. Selection favours first-author, invited/oral, international.
  conferences: [
    ['sepex-baps-explicit',   'Invited talk, XV SEPEX & II Joint Meeting SEPEX–BAPS, Valencia, Spain.'],
    ['sepex-baps-multilevel', 'Invited talk, XV SEPEX & II Joint Meeting SEPEX–BAPS, Valencia, Spain.'],
    ['eam-meta',              'Oral presentation, XI Conference of the European Association of Methodology, Tenerife, Spain.'],
    ['assc28-selective',      'Poster, 28th Annual Meeting of the Association for the Scientific Study of Consciousness, Heraklion, Greece.'],
    ['rldm-modelling',        'Poster, Reinforcement Learning and Decision-Making Conference, Dublin, Ireland.'],
    ['assc27-informational',  'Poster, 27th Annual Meeting of the Association for the Scientific Study of Consciousness, Tokyo, Japan.'],
    ['escop-ior',             'Poster, 23rd Conference of the European Society for Cognitive Psychology, Porto, Portugal.'],
  ],
};

const byId = (list, ids) => ids.map((id) => (list || []).find((e) => e.id === id)).filter(Boolean);

// † legend: emitted automatically after any displayed list that contains a
// dagger-marked author line; omitted when the selection has none.
const daggerLegend = (items) => items.some((p) => /\u2020/.test(String(p.authors || '')))
  ? '#v(5pt)\n#h(18pt)#text(font: mono, size: 8pt, style: "italic", fill: ink3)[#super[\u2020] Equal contribution.]\n'
  : '';

// Compact funded-project entry (BOTH profiles): title + "EUR X · dates"
// (right), agency · ref (org line, AEI shortened), and a single flowing
// role line — no kv rows. PI/Co-PI roles render semibold so leadership reads
// at a glance. FULL keeps every field (PI affiliation, team…); SHORT
// condenses to Role · PI surname.
function fundedEntry(e, { condensed = false } = {}) {
  const f = Object.fromEntries(e.fields || []);
  const strip = (s) => String(s || '').replace(/\.\s*$/, '');
  const role = strip(f.Role);
  const roleTyp = /\bPI\b/.test(role) ? '**' + role + '**' : role;
  const parts = [];
  if (role) parts.push(roleTyp);
  if (condensed) {
    if (f.PI) parts.push('PI: ' + strip(f.PI.split(',')[0].trim()));
    // Visiting Scholars grant: no Role/PI fields — summarise from its own fields.
    else if (!role && f['Visiting scholar']) parts.push('Research team · Visiting scholar: ' + strip(f['Visiting scholar']));
  } else {
    Object.entries(f).forEach(([k, v]) => { if (k !== 'Role') parts.push(k + ': ' + strip(v)); });
  }
  return emitEntry({
    title: e.title,
    right: [e.right, e.dates].filter(Boolean).join(' · '),
    org: String(e.org || '').replace('Agencia Estatal de Investigación (MCIN/AEI)', 'AEI'),
    dates: null,
    body: parts.length ? parts.join(' · ') + '.' : '',
  });
}

// Compact conference item (SHORT): authors (year). Title. Compressed venue.
function shortTalkItem(t, venueShort) {
  const body =
    authorsTyp(t.authors) + ' (' + escTyp(t.year) + '). ' +
    '#emph[' + escTyp(t.title) + '] ' + inlineMd(venueShort);
  return '#pubitem([' + body + '])\n';
}

function typstBodyShort(cv, papers) {
  const yr = (p) => { const n = Number(p.year); return Number.isFinite(n) ? n : Infinity; };
  const published = papers.filter(isPublished).slice().sort((a, b) => yr(b) - yr(a));

  // Masthead: exactly the same as FULL (same contacts, no profile tagline).
  let out = headerTyp(cv.header);

  out += section('Education');
  cv.education.forEach((e) => {
    out += emitEntry(SHORT.eduFieldIds.includes(e.id) ? e : { ...e, fields: null });
  });

  out += section('Research Experience');
  cv.experience.forEach((e) => { out += emitEntry(e); });

  out += section('Selected Fellowships & Awards');
  byId(cv.awards, SHORT.awards).forEach((e) => { out += emitEntry(e); });

  out += section('Peer-Reviewed Publications');
  published.forEach((p) => { out += pubItem(p, { badges: false }); });
  out += daggerLegend(published);

  out += section('Selected Preprints & Ongoing Work');
  const preprints = byId(papers, SHORT.preprints);
  preprints.forEach((p) => { out += pubItem(p, { badges: false }); });
  out += daggerLegend(preprints);

  out += section('Selected Conference Presentations');
  const allTalks = [...(cv.conferences.oral || []), ...(cv.conferences.poster || [])];
  SHORT.conferences.forEach(([id, venueShort]) => {
    const talk = allTalks.find((x) => x.id === id);
    if (talk) out += shortTalkItem(talk, venueShort);
  });

  out += section('Methods & Technical Expertise');
  (cv.methods || []).forEach(([label, value]) => {
    out += '#methodrow([' + inlineMd(label) + '], [' + inlineMd(value) + '])\n';
  });

  out += section('Selected Funded Projects');
  byId(cv.funded, SHORT.funded).forEach((e) => { out += fundedEntry(e, { condensed: true }); });

  out += section('Selected Methodological Training');
  byId(cv.training, SHORT.training).forEach((tr) => {
    out += emitEntry({ title: tr.title, right: tr.dates, org: tr.org });
  });

  out += section('Academic Service');
  byId(cv.service, SHORT.service).forEach((e) => { out += emitEntry(e); });

  return out;
}

// --- Assemble the raw Typst body from a cv object + papers ------------------
function typstBody(cv, papers) {
  // Non-numeric years ("in press") rank as the most recent so they sort to the top.
  const yr = (p) => { const n = Number(p.year); return Number.isFinite(n) ? n : Infinity; };
  const byYearDesc = (a, b) => yr(b) - yr(a);
  const published = papers.filter(isPublished).slice().sort(byYearDesc);
  const ongoing = papers.filter((p) => !isPublished(p)).slice().sort(byYearDesc);

  let out = '';

  // Masthead
  out += headerTyp(cv.header);

  out += section('Education');
  cv.education.forEach((e) => { out += emitEntry(e); });

  out += section('Research Experience');
  cv.experience.forEach((e) => { out += emitEntry(e); });

  out += section('Awards & Fellowships');
  (cv.awards || []).forEach((e) => { out += emitEntry(e); });

  out += section('Publications');
  published.forEach((p) => { out += pubItem(p); });
  out += daggerLegend(published);
  if ((cv.outreach_publications || []).length) {
    out += '\n#subhead("Outreach publication")\n\n';
    cv.outreach_publications.forEach((p) => { out += talkItem(p); });
  }

  out += section('Preprints & Ongoing Work');
  ongoing.forEach((p) => { out += pubItem(p); });
  out += daggerLegend(ongoing);

  out += section('Methods & Technical Expertise');
  (cv.methods || []).forEach(([label, value]) => {
    out += '#methodrow([' + inlineMd(label) + '], [' + inlineMd(value) + '])\n';
  });

  out += section('Funded Projects');
  cv.funded.forEach((e) => { out += fundedEntry(e); });

  out += section('Conference Presentations');
  out += '#subhead("Oral presentations")\n\n';
  cv.conferences.oral.forEach((t) => { out += talkItem(t); });
  out += '\n#subhead("Poster presentations")\n\n';
  cv.conferences.poster.forEach((t) => { out += talkItem(t); });

  out += section('Academic Events Organized');
  cv.events.forEach((e) => { out += emitEntry(e); });

  out += section('Teaching');
  cv.teaching.forEach((e) => { out += emitEntry(e); });

  out += section('Student Supervision');
  cv.supervision.forEach((e) => { out += emitEntry(e); });

  out += section('Specialized Training');
  (cv.training || []).forEach((t) => { out += emitEntry({ title: t.title, right: t.dates, org: t.org }); });

  out += section('Academic Service & Memberships');
  cv.service.forEach((e) => { out += emitEntry(e); });

  out += section('Outreach Activities');
  cv.outreach.forEach((e) => { out += emitEntry(e); });

  return out;
}

function build() {
  const cv = readYaml('data/cv.yml');
  const { papers } = readYaml('data/papers.yml');
  const pIdx = process.argv.indexOf('--profile');
  const profile = pIdx !== -1 ? process.argv[pIdx + 1] : 'all';   // full | short | all
  // Generate the WHOLE cv/cv.qmd (front matter + inlined Typst body). It used to
  // be a committed cv.qmd with `{{< include _cv-body.qmd >}}`, but Quarto resolves
  // that include during its initial project scan — before pre-render runs — so on
  // a fresh checkout (CI) the generated _cv-body.qmd doesn't exist yet and the
  // render aborts. Generating the whole file (like the research pages) avoids it.
  if (profile !== 'short') fs.writeFileSync(path.join(root, 'cv/cv.qmd'),
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
  if (profile !== 'short') console.log('built cv/cv.qmd');

  // SHORT profile — a permanent second output. Generated alongside FULL by
  // default (the pre-render hook runs with no args), so CI builds and deploys
  // _site/cv/Garre-Frutos-CV-Short.pdf on every push. `--profile full|short`
  // builds just one. Compact typography is applied by the post-render
  // recompile with --input fgfcompact=1 (scripts/build-cv-dark.mjs).
  if (profile !== 'full') {
    fs.writeFileSync(path.join(root, 'cv/cv-short.qmd'),
      '---\n' +
      '# AUTO-GENERATED (short profile) from data/cv.yml + data/papers.yml by scripts/build-cv.mjs — do not edit.\n' +
      '# Regenerate with: node scripts/build-cv.mjs --profile short\n' +
      'format: fgf-cv-typst\n' +
      'output-file: Garre-Frutos-CV-Short\n' +
      'keep-typ: true\n' +
      'font-paths:\n' +
      '  - cv/_extensions/fgf-cv/fonts\n' +
      '  - _extensions/fgf-cv/fonts\n' +
      '---\n\n' +
      '```{=typst}\n' + typstBodyShort(cv, papers) + '```\n');
    console.log('built cv/cv-short.qmd (short profile)');
  }

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
// Mirror of inlineMd for the HTML page: *italics* + [text](url) links.
function inlineHtml(s) {
  s = String(s == null ? '' : s);
  let out = '', last = 0, m;
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*/g;
  while ((m = re.exec(s))) {
    out += htmlEsc(s.slice(last, m.index));
    out += m[1] != null
      ? '<a class="pub-title-link" target="_blank" href="' + htmlEsc(m[2]) + '">' + inlineHtml(m[1]) + '</a>'
      : '<em>' + htmlEsc(m[3]) + '</em>';
    last = re.lastIndex;
  }
  return out + htmlEsc(s.slice(last));
}
function authorsHtml(s) {
  const dag = (t) => t.replace(/†/g, '<sup class="shared-dagger">†</sup>');
  return String(s).split(ME).map((seg) => dag(htmlEsc(seg))).join('<span class="au-me">' + htmlEsc(ME) + '</span>');
}
function venueHtml(p) {
  if (isPublished(p)) {
    let tail = '';
    // APA 7: the volume number is italicized along with the journal name.
    if (p.volume != null) tail += ', <em>' + htmlEsc(p.volume) + '</em>';
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
  const dot = /[?!]$/.test(String(p.title)) ? '' : '.';
  const title = p.url
    ? '<a class="pub-title-link" target="_blank" href="' + htmlEsc(p.url) + '"><em>' + htmlEsc(p.title) + dot + '</em></a>'
    : '<em>' + htmlEsc(p.title) + dot + '</em>';
  return '<li class="cv-pub">' + authorsHtml(p.authors) + ' (' + htmlEsc(p.year) + '). ' + title + ' ' + venueHtml(p) + ' ' + badgesHtml(p) + '</li>';
}
function talkHtml(t) {
  const title = '<em>' + htmlEsc(t.title) + '</em>';
  const linked = t.url ? '<a class="pub-title-link" target="_blank" href="' + htmlEsc(t.url) + '">' + title + '</a>' : title;
  return '<li class="cv-pub">' + authorsHtml(t.authors) + ' (' + htmlEsc(t.year) + '). ' + linked + ' ' + inlineHtml(t.venue) + '</li>';
}
function entryHtml(e) {
  let h = '<div class="cv-entry"><div class="t">' + inlineHtml(e.title) + '</div><div class="r">' + inlineHtml(e.right) + '</div>';
  if (e.org != null || e.dates != null) h += '<div class="o">' + inlineHtml(e.org) + '</div><div class="d">' + inlineHtml(e.dates) + '</div>';
  const body = [];
  (e.fields || []).forEach(([l, v]) => body.push('<div class="cv-kv"><b>' + htmlEsc(l) + ':</b> ' + inlineHtml(v) + '</div>'));
  if (e.body) body.push('<p>' + inlineHtml(e.body) + '</p>');
  if (body.length) h += '<div class="b">' + body.join('') + '</div>';
  h += '</div>';
  // Nested research stays, mirroring the PDF's #substay.
  (e.stays || []).forEach((s) => {
    h += '<div class="cv-stay"><div class="stay-label">Research stay</div>' +
      '<div class="cv-entry"><div class="t">' + inlineHtml(s.title) + '</div><div class="r">' + inlineHtml(s.right) + (s.dates ? '<br>' + inlineHtml(s.dates) : '') + '</div>';
    const sb = (s.fields || []).map(([l, v]) => '<div class="cv-kv"><b>' + htmlEsc(l) + ':</b> ' + inlineHtml(v) + '</div>');
    if (sb.length) h += '<div class="b">' + sb.join('') + '</div>';
    h += '</div></div>';
  });
  return h;
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
  body += secHtml('Awards & Fellowships', (cv.awards || []).map(entryHtml).join(''));
  let pubs = '<ul class="cv-publist">' + published.map(pubHtml).join('') + '</ul>';
  if ((cv.outreach_publications || []).length)
    pubs += '<div class="cv-subhead">Outreach publication</div><ul class="cv-publist">' + cv.outreach_publications.map(talkHtml).join('') + '</ul>';
  body += secHtml('Publications', pubs);
  body += secHtml('Preprints & Ongoing Work', '<ul class="cv-publist">' + ongoing.map(pubHtml).join('') + '</ul>');
  body += secHtml('Methods & Technical Expertise',
    '<div class="cv-methods">' + (cv.methods || []).map(([l, v]) => '<div class="ml">' + htmlEsc(l) + '</div><div class="mv">' + inlineHtml(v) + '</div>').join('') + '</div>');
  body += secHtml('Funded Projects', cv.funded.map(entryHtml).join(''));
  body += secHtml('Conference Presentations',
    '<div class="cv-subhead">Oral presentations</div><ul class="cv-publist">' + cv.conferences.oral.map(talkHtml).join('') + '</ul>' +
    '<div class="cv-subhead">Poster presentations</div><ul class="cv-publist">' + cv.conferences.poster.map(talkHtml).join('') + '</ul>');
  body += secHtml('Academic Events Organized', cv.events.map(entryHtml).join(''));
  body += secHtml('Teaching', cv.teaching.map(entryHtml).join(''));
  body += secHtml('Student Supervision', cv.supervision.map(entryHtml).join(''));
  body += secHtml('Specialized Training', cv.training.map((t) => entryHtml({ title: t.title, right: t.dates, org: t.org })).join(''));
  body += secHtml('Academic Service & Memberships', cv.service.map(entryHtml).join(''));
  body += secHtml('Outreach Activities', cv.outreach.map(entryHtml).join(''));

  const nav =
    '<nav style="position:sticky; top:0; z-index:20; background:var(--nav); backdrop-filter:blur(10px); border-bottom:1px solid var(--line);">' +
    '<div class="page-nav-inner" style="max-width:880px; margin:0 auto; padding:0 40px; height:64px; display:flex; align-items:center; justify-content:space-between;">' +
    '<a href="/" style="display:flex; align-items:center; gap:13px;">' + LOGO + '<span class="nav-wordmark" style="font-family:\'IBM Plex Mono\',monospace; font-size:15px; font-weight:500; letter-spacing:0.11em; text-transform:uppercase; color:var(--ink); white-space:nowrap;"><span class="nav-fname">Francisco </span><span style="color:var(--accent);">Garre-Frutos</span></span></a>' +
    '<div style="display:flex; gap:22px; align-items:center;">' +
    '<a href="/" class="nav-link nav-home">← Home</a>' +
    // Version dropdown: Full (default, first) / Short. Each item exists in a
    // light and a dark flavour; theme.scss shows the pair matching the theme
    // and styles the menu (.cv-dl-menu / .cv-dl-list). The ▾ caret signals the
    // dropdown; the inline script below closes it on outside click / choice.
    '<details class="cv-dl-menu">' +
    '<summary class="detail-link"><i class="fa-solid fa-file-arrow-down"></i> <span class="dl-text">Download PDF</span> <span class="dd-caret">▾</span></summary>' +
    '<div class="cv-dl-list">' +
    '<a href="Garre-Frutos-CV.pdf" target="_blank" class="detail-link cv-dl cv-dl-light">Full CV</a>' +
    '<a href="Garre-Frutos-CV-dark.pdf" target="_blank" class="detail-link cv-dl cv-dl-dark">Full CV</a>' +
    '<a href="Garre-Frutos-CV-Short.pdf" target="_blank" class="detail-link cv-dl cv-dl-light">Short CV</a>' +
    '<a href="Garre-Frutos-CV-Short-dark.pdf" target="_blank" class="detail-link cv-dl cv-dl-dark">Short CV</a>' +
    '</div></details>' +
    '<button data-theme-toggle aria-label="Toggle dark mode" class="theme-toggle"><i data-theme-icon class="fa-solid fa-sun" style="font-size:15px;"></i></button>' +
    '</div></div></nav>' +
    // Close the dropdown when clicking anywhere outside it, and after picking
    // an option (native <details> otherwise only closes on a second click).
    '<script>(function(){var m=document.querySelector(".cv-dl-menu");if(!m)return;' +
    'document.addEventListener("click",function(e){if(m.open&&!m.contains(e.target))m.open=false;});' +
    'm.querySelectorAll(".cv-dl-list a").forEach(function(a){a.addEventListener("click",function(){m.open=false;});});' +
    '})();</script>';
  const page =
    '---\n' +
    // Full tab title set here + empty title-prefix suppresses Quarto's default
    // " – <site title>" suffix, so the CV tab reads exactly this (not "… – …, PhD").
    'pagetitle: "Curriculum Vitae · Francisco Garre-Frutos"\n' +
    'title-prefix: ""\n' +
    'description: "Academic CV of Francisco Garre-Frutos — postdoctoral researcher in experimental psychology (Autonomous University of Madrid)."\n' +
    'image: "/assets/og-image.png"\n' +
    // Old site served the CV at /CV.html — alias emits a redirect stub there
    // so pre-redesign links (and Google's index) land on /cv/ instead of a 404.
    'aliases: ["/CV.html"]\n' +
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

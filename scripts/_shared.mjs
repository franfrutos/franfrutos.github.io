/* Shared constants for the pre-render build scripts (build-papers.mjs,
 * build-cv.mjs, build-og.mjs, build-meta.mjs). Keep render-time-only values
 * here so they live in one place.
 *
 * NOTE: assets/js/site.js (browser) keeps its own copy of the badge list AND of
 * slugify — it runs in the browser and can't import this Node module. If you
 * edit BADGES or slugify here, mirror the change in site.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from './vendor/js-yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Site identity & SEO — the single source of truth (data/site.yml).
export const SITE = yaml.load(fs.readFileSync(path.join(here, '../data/site.yml'), 'utf8'));

// Slug from a title: lowercase, ASCII, dash-separated, capped at ~60 chars on a
// word boundary. MUST match site.js's copy so on-site links and og-card
// filenames line up.
export function slugify(s) {
  const b = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (b.length <= 60) return b;
  const c = b.slice(0, 60), h = c.lastIndexOf('-');
  return (h > 20 ? c.slice(0, h) : c).replace(/-+$/, '');
}
export const paperSlug = (p) => p.slug || slugify(p.title);

// The "hills" wordmark mark, shown in the page navs.
export const LOGO = '<svg width="37" height="21" viewBox="0 0 38 22" fill="none" aria-hidden="true" style="display:block; overflow:visible; transform:translateY(-1px);"><path d="M3,17.4 C9,17.4 10,9.2 18,8.2 C25,7.4 30,7.2 35,7" fill="none" style="stroke:var(--ink3); stroke-width:1.3; opacity:.6;" stroke-linecap="round"></path><circle cx="35" cy="7" r="2.9" fill="none" style="stroke:var(--ink3); stroke-width:1; opacity:.55;"></circle><circle cx="35" cy="7" r="1.3" style="fill:var(--ink3); opacity:.6;"></circle><line x1="2" y1="18" x2="34" y2="18" style="stroke:var(--ink3); stroke-width:.9; opacity:.3;"></line><path d="M2,18 C5.5,18 5.5,8.5 9,8.5 C12.5,8.5 12.5,18 16,18 Z" style="fill:var(--ink3); opacity:.42;"></path><path d="M9,18 C13,18 13,5 17,5 C21,5 21,18 25,18 Z" style="fill:var(--logo-ocre); opacity:.52;"></path><path d="M18,18 C21.5,18 21.5,9.5 25,9.5 C28.5,9.5 28.5,18 32,18 Z" style="fill:var(--accent); opacity:.42;"></path></svg>';

// Open-science badges, in display order. `icon` is the full icon class
// (Academicons or Font Awesome); `label` is the visible/tooltip text.
export const BADGES = [
  { key: 'prereg', icon: 'ai ai-preregistered', label: 'Preregistered', tip: 'Preregistered — hypotheses & analysis plan registered before data collection', off: 'Not preregistered' },
  { key: 'materials', icon: 'ai ai-open-materials', label: 'Open materials', tip: 'Open materials — study materials are publicly available', off: 'Open materials not available' },
  { key: 'data', icon: 'ai ai-open-data', label: 'Open data', tip: 'Open data — the data are publicly available', off: 'Open data not available' },
  { key: 'code', icon: 'fa-solid fa-code', label: 'Open code', tip: 'Open code — the analysis code is publicly available', off: 'Analysis code not available' },
  { key: 'oa', icon: 'ai ai-open-access', label: 'Open access', tip: 'Open access — the article is free to read', off: 'Not open access' },
];

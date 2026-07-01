# Editing the site & CV content

Everything on the site and CV is driven by the three YAML files in this folder.
**You only edit YAML here** — the HTML pages, the per-paper detail pages, the
map data and the CV (PDF + web) are all regenerated on every render.

After editing, run **`quarto preview`** (live reload) or **`quarto render`**.
That's it — no manual steps. (Generated files are git-ignored.)

`*asterisks*` around text → _italics_, in all three files.

---

## 1. Add a paper → `papers.yml`

Appears automatically in **3 places**: the home Research list, its own detail
page (`/research/<slug>/`), and the CV (under *Publications* if published, or
*Ongoing Work* if `preprint: true` or `venue: Under review`).

Copy a block under `papers:` and fill it in:

```yaml
  - thread: learning          # learning | distraction | validity (the 3 sections)
    year: 2026
    title: My new paper title
    authors: Garre-Frutos, F., Coauthor, B., & Senior, C.   # your name is auto-bolded
    venue: Journal Name        # or "PsyArXiv" / "Under review"
    url: https://doi.org/10.xxxx/xxxxx   # DOI or preprint link (omit if none yet)
    preprint: true             # set ONLY for preprints (controls the Preprint tag + CV section)
    # status: Manuscript submitted to Journal X     # optional, shown for preprints/under-review
    # --- full citation bits (optional, used in the CV) ---
    volume: 58
    issue: 1
    pages: 335–354             # OR:  articleno: 7   (renders "Article 7")
    tags: [topic, method]
    # slug: custom-url-slug    # optional; otherwise derived from the title
    osf:                       # open-science badges (see below)
      prereg: true
      materials: true
      data: true
      code: true
      oa: true
    keywords: [kw1, kw2]       # shown on the detail page
    abstract: >-
      One paragraph, no line breaks needed (the >- folds it).
    bibtex: |-                 # optional; enables the BibTeX tab on the detail page
      @article{key2026, ... }
    ris: |-                    # optional; enables the RIS tab
      TY  - JOUR ...
```

**Badges (`osf:`)** — five keys: `prereg`, `materials`, `data`, `code`, `oa`.
- `true` → badge lit, links to the paper/preprint `url`.
- `"https://osf.io/abcde"` → badge lit, links to that exact URL.
- omitted → badge shown greyed ("not available").

**Not open access but you have a shareable postprint?** Instead of `oa`, add
`postprint: "https://..."`. The Open Access slot then shows a PsyArXiv icon with
a "Postprint" tooltip, linking to the postprint. (If both `oa` and `postprint`
are set, `oa` wins.)

**Accepted / in press, access status still unknown?** Add `production: true` in
`osf:` — the Open Access slot shows a non-clickable gear ("In production"). For
an in-press paper also set `year: in press` (renders "(in press)" in the
citation and sorts it to the top of the CV) and `venue:` to the accepting
journal; keep `url:` pointing at the PsyArXiv preprint so it stays readable (the
preprint DOI is automatically kept out of the citation). Priority in the OA slot:
`oa` → `postprint` → `production` → greyed.

**Author tricks:** your name `Garre-Frutos, F.` is bolded automatically; add a
`†` right after a name for shared-first-authorship (renders as a coral dagger).

---

## 2. Add a map point → `journey.yml`

The "My journey in science" map. **Coordinates are looked up automatically**
from the city name (GeoNames) — you never enter lat/long.

```yaml
  - city: Lisbon
    country: Portugal
    year: '2026'              # quote years
    from: '2025'             # optional — shows a range (2025–2026)
    type: Talk               # Degree | Appointment | Course | Talk | Poster | Organizer
    title: My talk title
    venue: Conference / institution name
    authors: Garre-Frutos, F., & Coauthor, B.   # optional (talks/posters)
    place: Lisbon, Portugal · May 2026          # optional sub-line
    # note / subtitle / link / distinction / ongoing: true   # all optional
```

---

## 3. Add CV content → `cv.yml`

Everything in the CV **except publications** (those come from `papers.yml`).
Sections: `education`, `experience`, `methods`, `training`, `funded`,
`conferences` (`oral` / `poster`), `teaching`, `supervision`, `events`,
`service`, `outreach`, plus the `header` (name, role, contacts).

Most sections are lists of **entries** with this shape (all keys optional):

```yaml
  - title: Entry title             # bold, left
    right: Granada, Spain          # italic meta, top-right (location / amount / ECTS…)
    org: University of Granada     # small uppercase line under the title
    dates: 2021 – 2025             # italic meta, second row right
    body: A paragraph of prose.    # e.g. for research experience
    fields:                        # "Label: value" lines
      - [Thesis, "*My thesis title.*"]
      - [Supervisors, "Name One and Name Two."]
```

- **Conference talks/posters** (`conferences.oral` / `.poster`) use a simpler
  shape: `{ authors, year, title, venue }` (your name auto-bolded, title italic).
- **Methods** is a list of `[Label, "comma, separated, skills."]` pairs.
- **Contacts** (`header.contacts`): `{ icon, label, url }`, where `icon` is one
  of `phone, email, web, scholar, orcid, osf, github, bluesky`.

To bring the intro **tagline** back, add `tagline: ...` under `header`.

---

### Where the rendering lives (for reference)

`scripts/build-data.mjs` (YAML→site JS), `scripts/build-papers.mjs` (detail
pages), `scripts/build-cv.mjs` (CV PDF body + web page), `scripts/build-cv-dark.mjs`
(dark PDF). Shared bits in `scripts/_shared.mjs`. CV design in
`cv/_extensions/fgf-cv/`. You shouldn't need to touch these to add content.

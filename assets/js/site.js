/* Francisco Garre-Frutos — site runtime
 * Ported from the design-reference prototype logic (vanilla JS, no framework).
 * Step 1: dark/light theme toggle persisted to localStorage['fgf-theme'] (default dark).
 */
(function () {
  'use strict';

  /* ---- Theme toggle ------------------------------------------------------ */
  function initTheme() {
    var wrap = document.querySelector('[data-site]');
    if (!wrap) return;

    var stored;
    try { stored = localStorage.getItem('fgf-theme'); } catch (e) { stored = null; }
    var dark = (stored == null) ? true : (stored === 'dark');

    function apply(isDark) {
      wrap.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('fgf-dark', isDark);
      var icons = wrap.querySelectorAll('[data-theme-icon]');
      icons.forEach(function (ic) {
        ic.classList.toggle('fa-sun', isDark);
        ic.classList.toggle('fa-moon', !isDark);
      });
    }

    apply(dark);

    var buttons = wrap.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        dark = !dark;
        try { localStorage.setItem('fgf-theme', dark ? 'dark' : 'light'); } catch (e) {}
        apply(dark);
      });
    });
  }

  /* ---- Small helpers ----------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ME = 'Garre-Frutos, F.';
  var DAG = '†'; // †
  var DAG_TITLE = 'Shared first authorship — these authors contributed equally';

  // Reusable filter control: shows chips by default, but a compact <select>
  // dropdown when there are many options (>4) or on small screens (CSS). Keeps
  // the chips and the select in sync. `defs` = [{key, label}], `attr` = the
  // data-attribute name, `onPick(key)` runs when either control changes.
  function renderFilter(el, defs, currentKey, attr, onPick) {
    var chips = defs.map(function (d) {
      return '<button class="jchip' + (d.key === currentKey ? ' on' : '') + '" data-' + attr + '="' + d.key + '">' + esc(d.label) + '</button>';
    }).join('');
    var opts = defs.map(function (d) {
      return '<option value="' + esc(d.key) + '"' + (d.key === currentKey ? ' selected' : '') + '>' + esc(d.label) + '</option>';
    }).join('');
    el.classList.add('filter-control');
    el.classList.toggle('many', defs.length > 4);
    el.innerHTML = '<div class="filter-chips">' + chips + '</div>' +
      '<div class="filter-dd"><select class="filter-select" aria-label="Filter">' + opts + '</select></div>';
    el.querySelectorAll('[data-' + attr + ']').forEach(function (b) {
      b.addEventListener('click', function () { onPick(b.getAttribute('data-' + attr)); });
    });
    el.querySelector('.filter-select').addEventListener('change', function (e) { onPick(e.target.value); });
  }

  // Split an author string into spans: bold-coral "me", coral-superscript daggers.
  function authorPartsHTML(s) {
    var out = [];
    var pushText = function (text) {
      var bits = text.split(DAG);
      bits.forEach(function (b, j) {
        if (b) out.push('<span>' + esc(b) + '</span>');
        if (j < bits.length - 1) {
          out.push('<span class="shared-dagger" title="' + esc(DAG_TITLE) + '">' + DAG + '</span>');
        }
      });
    };
    s.split(ME).forEach(function (seg, i) {
      if (seg) pushText(seg);
      if (i < s.split(ME).length - 1) out.push('<span class="au-me">' + esc(ME) + '</span>');
    });
    return out.join('');
  }

  // Open-science badges — every paper shows all four; missing ones render
  // "disabled" (kept in sync with scripts/build-papers.mjs).
  var BADGES = [
    { key: 'prereg', icon: 'ai ai-preregistered', tip: 'Preregistered — hypotheses & analysis plan registered before data collection', off: 'Not preregistered' },
    { key: 'materials', icon: 'ai ai-open-materials', tip: 'Open materials — study materials are publicly available', off: 'Open materials not available' },
    { key: 'data', icon: 'ai ai-open-data', tip: 'Open data — the data are publicly available', off: 'Open data not available' },
    { key: 'code', icon: 'fa-solid fa-code', tip: 'Open code — the analysis code is publicly available', off: 'Analysis code not available' },
    { key: 'oa', icon: 'ai ai-open-access', tip: 'Open access — the article is free to read', off: 'Not open access' },
  ];

  function slugify(s) {
    var base = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (base.length <= 60) return base;
    var cut = base.slice(0, 60), h = cut.lastIndexOf('-');
    return (h > 20 ? cut.slice(0, h) : cut).replace(/-+$/, ''); // don't cut mid-word
  }
  function paperSlug(p) { return p.slug || slugify(p.title); }

  function homeBadgesHTML(p) {
    var o = p.osf || {};
    return BADGES.map(function (b) {
      var icon = b.icon, tip = b.tip, off = b.off, v = o[b.key];
      // The open-access slot adapts to how the paper is available:
      //   preprint → PsyArXiv "Preprint" · published OA → open-access · shared
      //   postprint → PsyArXiv "Postprint" · accepted/in press → gear · else greyed.
      if (b.key === 'oa') {
        if (p.isPreprint) { icon = 'ai ai-psyarxiv'; tip = 'Preprint — publicly available on PsyArXiv'; v = p.url; }
        else if (!o.oa) {
          if (o.postprint) { icon = 'ai ai-psyarxiv'; tip = 'Postprint — author-accepted manuscript, free to read'; v = o.postprint; }
          else if (o.production) { return '<span class="osf-badge" title="In production — final version not yet available"><i class="fa-solid fa-gear" style="font-size:17px;"></i></span>'; }
        }
      }
      var href = (typeof v === 'string') ? v : p.url;
      if (v && href) {
        return '<a href="' + esc(href) + '" target="_blank" title="' + esc(tip) + '" class="osf-badge"><i class="' + icon + '" style="font-size:17px;"></i></a>';
      }
      return '<span class="osf-badge off" title="' + esc(off) + '"><i class="' + icon + '" style="font-size:17px;"></i></span>';
    }).join('');
  }

  function pubRowHTML(p) {
    var titleHref = '/research/' + paperSlug(p) + '/';
    var badgesHTML = homeBadgesHTML(p);
    var detailHTML = '<a href="' + titleHref + '" class="detail-link">Details →</a>';
    var titleInner = '<a href="' + titleHref + '" class="pub-title-link">' + esc(p.title) + '</a>';
    return '' +
      '<article class="pub-row" style="padding:20px 16px; margin:0 -16px; border-top:1px solid var(--line); display:grid; grid-template-columns:54px 1fr; gap:18px; border-radius:8px;">' +
        '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:13px; color:var(--ink3); padding-top:5px;">' + esc(p.year) + '</span>' +
        '<div>' +
          '<h4 style="font-family:\'IBM Plex Mono\', monospace; font-weight:600; font-size:19.5px; line-height:1.34; margin:0 0 6px;">' + titleInner + '</h4>' +
          '<p style="font-size:14.5px; color:var(--ink2); margin:0 0 11px; font-family:\'IBM Plex Mono\',monospace; letter-spacing:-0.01em;">' + authorPartsHTML(p.authors) + '</p>' +
          '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">' +
            '<span class="pub-venue" style="font-style:italic; font-family:\'IBM Plex Mono\',monospace; font-size:15.5px; color:var(--accent); white-space:nowrap;">' + esc(p.venue) + '</span>' +
            '<div style="display:flex; gap:8px; margin-left:auto; align-items:center; flex-wrap:wrap; justify-content:flex-end;">' + badgesHTML + detailHTML + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function threadBlockHTML(t) {
    var rows = t.pubs.map(pubRowHTML).join('');
    var count = t.pubs.length + (t.pubs.length === 1 ? ' entry' : ' entries');
    return '' +
      '<div class="thread-grid" style="display:grid; grid-template-columns:300px 1fr; gap:64px; align-items:start; border-top:1px solid var(--line); padding-top:42px; margin-top:42px;">' +
        '<div class="sticky-side" style="position:sticky; top:88px;">' +
          '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; color:var(--accent);">' + esc(t.num) + '</span>' +
          '<h3 style="font-family:\'IBM Plex Mono\', monospace; font-weight:600; font-size:25px; line-height:1.15; letter-spacing:-0.01em; margin:8px 0 14px; color:var(--ink);">' + esc(t.title) + '</h3>' +
          '<p style="font-size:16px; color:var(--ink2); margin:0; line-height:1.58;">' + esc(t.blurb) + '</p>' +
          '<p style="font-family:\'IBM Plex Mono\',monospace; font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ink3); margin:18px 0 0;">' + esc(count) + '</p>' +
        '</div>' +
        '<div>' + rows + '<div style="height:1px; background:var(--line);"></div></div>' +
      '</div>';
  }

  function initResearch() {
    var themes = window.FGF_THEMES;
    var chipsEl = document.getElementById('research-chips');
    var threadsEl = document.getElementById('research-threads');
    if (!themes || !chipsEl || !threadsEl) return;

    var filter = 'all';
    var chipDefs = [{ key: 'all', label: 'All' }].concat(
      themes.map(function (t, i) { return { key: String(i), label: t.short }; })
    );

    function renderChips() {
      renderFilter(chipsEl, chipDefs, filter, 'filter', function (k) { filter = k; render(); });
    }

    function renderThreads() {
      var visible = filter === 'all' ? themes : [themes[Number(filter)]];
      threadsEl.innerHTML = visible.map(threadBlockHTML).join('');
    }

    function render() { renderChips(); renderThreads(); }
    render();
  }

  /* ---- Singleton dividers ------------------------------------------------ */
  // 9 dots; the coral "singleton" jumps to whichever dot you hover and stays
  // there. Each divider instance is independent.
  function initMotif() {
    document.querySelectorAll('.motif').forEach(function (m) {
      var dots = m.querySelectorAll('.motif-dot');
      if (!dots.length) return;
      dots.forEach(function (d) {
        d.addEventListener('mouseenter', function () {
          dots.forEach(function (x) { x.classList.remove('singleton'); });
          d.classList.add('singleton');
        });
      });
    });
  }

  /* ---- Journey map + list ------------------------------------------------ */
  function initJourney() {
    var journey = window.FGF_JOURNEY;
    var wrap = document.getElementById('fgf-mapwrap');
    var stageEl = document.getElementById('fgf-stage');
    var mapEl = document.getElementById('fgf-worldmap');
    var pinsEl = document.getElementById('fgf-pins');
    var chipsEl = document.getElementById('journey-chips');
    var listEl = document.getElementById('journey-list');
    var countEl = document.getElementById('journey-count');
    var clearEl = document.getElementById('journey-clear');
    if (!journey || !wrap || !stageEl || !mapEl || !pinsEl || !listEl) return;

    var d3 = window.d3, topojson = window.topojson;

    // state
    var zoom = 1, tx = 0, ty = 0, cw = 0, ch = 0;
    var activeCity = null, typeFilter = 'all';
    var _proj = null, MW = 1000, MH = 500, _topo = null, _centered = false;
    var panning = false, dragged = false, start = null, pinch = null, pinchZoom = 1;
    var MAXZOOM = 40; // high enough to separate tightly clustered cities (e.g. Granada/Baeza)

    var typeIcon = { Degree: 'fa-graduation-cap', Appointment: 'fa-briefcase', Course: 'fa-flask', Talk: 'fa-microphone-lines', Poster: 'fa-thumbtack', Organizer: 'fa-people-group' };
    var cityOrder = ['Granada', 'Murcia', 'Amsterdam', 'Madrid'];

    // Coordinates come from the auto-generated GeoNames lookup (city|country → [lon,lat]).
    var COORDS = window.FGF_CITY_COORDS || {};
    var byCity = {};
    journey.forEach(function (j) {
      if (byCity[j.city]) return;
      var ll = COORDS[j.city + '|' + j.country];
      if (!ll) { console.warn('[journey] no coordinates for "' + j.city + ', ' + j.country + '" — run: node scripts/geocode-cities.mjs'); return; }
      byCity[j.city] = { name: j.city, country: j.country, lon: ll[0], lat: ll[1] };
    });
    var order = cityOrder.filter(function (n) { return byCity[n]; })
      .concat(Object.keys(byCity).filter(function (n) { return cityOrder.indexOf(n) === -1; }));

    var chipDefs = [
      { key: 'all', label: 'All', types: null },
      { key: 'education', label: 'Education', types: ['Degree'] },
      { key: 'positions', label: 'Positions', types: ['Appointment'] },
      { key: 'courses', label: 'Courses', types: ['Course'] },
      { key: 'conferences', label: 'Conferences', types: ['Talk', 'Poster'] },
      { key: 'organized', label: 'Organized', types: ['Organizer'] },
    ];

    // Project a city to a percentage position from its true lon/lat.
    function projPt(c) {
      var xy = _proj([c.lon, c.lat]);
      return { left: xy[0] / MW * 100, top: xy[1] / MH * 100 };
    }

    function buildGeoMap() {
      if (!d3 || !d3.geoNaturalEarth1 || !topojson || !_topo) return false;
      var land = topojson.feature(_topo, _topo.objects.countries);
      var projection = d3.geoNaturalEarth1().fitSize([MW, MH], land);
      var pathGen = d3.geoPath(projection);
      var fill = land.features.map(function (f) { return pathGen(f); }).filter(Boolean).join(' ');
      // Coastlines (exterior boundaries) and internal country borders as separate
      // light meshes — cheap to stroke, unlike stroking the full land fill.
      var coast = pathGen(topojson.mesh(_topo, _topo.objects.countries, function (a, b) { return a === b; }));
      var borders = pathGen(topojson.mesh(_topo, _topo.objects.countries, function (a, b) { return a !== b; }));
      // preserveAspectRatio="none": the viewBox maps 1:1 onto the element box, so
      // pins (positioned with the same box) align exactly at every zoom level. The
      // container is ~2:1, so any stretch is sub-1% and imperceptible.
      mapEl.innerHTML = '<svg viewBox="0 0 ' + MW + ' ' + MH + '" preserveAspectRatio="none" style="width:100%;height:100%;display:block">' +
        '<path d="' + fill + '" fill="currentColor" stroke="none"></path>' +
        '<path d="' + borders + '" fill="none" stroke="var(--map-ocean)" stroke-width="0.5" stroke-linejoin="round"></path>' +
        '<path d="' + coast + '" fill="none" stroke="var(--map-coast)" stroke-width="0.6" stroke-linejoin="round"></path>' +
        '</svg>';
      _proj = projection;
      return true;
    }

    function applyTransform() {
      stageEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + zoom + ')';
      positionPins();
    }
    function clampPan(ntx, nty, z) {
      ntx = Math.min(0, Math.max(cw - cw * z, ntx));
      nty = Math.min(0, Math.max(ch - ch * z, nty));
      return [ntx, nty];
    }
    function zoomAt(factor, px, py) {
      var z0 = zoom, z = Math.min(MAXZOOM, Math.max(1, z0 * factor)), k = z / z0;
      var ntx = px - (px - tx) * k, nty = py - (py - ty) * k;
      var c = clampPan(ntx, nty, z);
      zoom = z; tx = c[0]; ty = c[1]; applyTransform();
    }
    function centerOn(lon, lat, z) {
      var xy = _proj([lon, lat]);
      var bx = xy[0] / MW * cw, by = xy[1] / MH * ch;
      var c = clampPan(cw / 2 - bx * z, ch / 2 - by * z, z);
      zoom = z; tx = c[0]; ty = c[1]; applyTransform();
    }
    // Use the content box (clientWidth/Height, excludes the 1px border) — this is
    // exactly the box the SVG fills, so pin math and map rendering share one origin.
    function measure() { if (wrap.clientWidth) { cw = wrap.clientWidth; ch = wrap.clientHeight; } }

    // pins — kept in a screen-space layer so they don't scale with zoom
    var pinEls = [];
    function buildPins() {
      pinsEl.innerHTML = '';
      pinEls = [];
      order.forEach(function (name) {
        var c = byCity[name];
        var btn = document.createElement('button');
        btn.className = 'jpin';
        btn.title = name;
        btn.style.cssText = 'position:absolute; width:26px; height:26px; transform:translate(-50%,-50%); border:none; background:transparent; padding:0; cursor:pointer; pointer-events:auto;';
        var ring = document.createElement('span');
        ring.style.cssText = 'position:absolute; left:50%; top:50%; width:26px; height:26px; transform:translate(-50%,-50%); border-radius:50%; border:1.5px solid var(--accent); opacity:.45; display:none;';
        var dot = document.createElement('span');
        dot.className = 'jpin-dot';
        dot.style.cssText = 'position:absolute; left:50%; top:50%; width:13px; height:13px; transform:translate(-50%,-50%); border-radius:50%; background:var(--accent); border:2px solid var(--card); box-shadow:0 1px 4px rgba(0,0,0,.28); transition:transform .12s ease;';
        btn.appendChild(ring); btn.appendChild(dot);
        btn.addEventListener('mousedown', function (e) { e.stopPropagation(); dragged = false; });
        btn.addEventListener('click', function () {
          if (dragged) return;
          activeCity = (activeCity === name) ? null : name;
          renderList(); updateRings();
        });
        pinsEl.appendChild(btn);
        pinEls.push({ el: btn, ring: ring, name: name, base: projPt(c) });
      });
      positionPins(); updateRings();
    }
    function positionPins() {
      if (!_proj) return;
      pinEls.forEach(function (p) {
        var x = (p.base.left / 100 * cw) * zoom + tx;
        var y = (p.base.top / 100 * ch) * zoom + ty;
        p.el.style.left = x.toFixed(1) + 'px';
        p.el.style.top = y.toFixed(1) + 'px';
      });
    }
    function updateRings() {
      pinEls.forEach(function (p) { p.ring.style.display = (activeCity === p.name) ? 'block' : 'none'; });
    }

    // chips + list
    function renderChips() {
      renderFilter(chipsEl, chipDefs, typeFilter, 'jfilter', function (k) { typeFilter = k; renderChips(); renderList(); });
    }

    function listItemHTML(j) {
      var icon = typeIcon[j.type] || 'fa-location-dot';
      var yearCol = j.from
        ? '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:11.5px; color:var(--ink3); padding-top:4px; white-space:nowrap;">' + esc(j.from) + '<span style="color:var(--accent);">–</span>' + esc(j.ongoing ? 'now' : j.year) + '</span>'
        : '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; color:var(--ink3); padding-top:4px;">' + esc(j.year) + '</span>';
      var distinction = j.distinction
        ? '<span style="display:inline-flex; align-items:center; gap:5px; font-family:\'IBM Plex Mono\',monospace; font-size:9px; letter-spacing:0.05em; text-transform:uppercase; color:#fff; background:var(--accent); border-radius:100px; padding:3px 10px; white-space:nowrap;"><i class="fa-solid fa-star" style="font-size:8px;"></i> ' + esc(j.distinction) + '</span>'
        : '';
      var head = '<div style="display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:9px;">' +
        '<span style="display:inline-flex; align-items:center; gap:5px; font-family:\'IBM Plex Mono\',monospace; font-size:9px; letter-spacing:0.07em; text-transform:uppercase; color:var(--accent); border:1px solid color-mix(in srgb, var(--accent) 32%, transparent); border-radius:100px; padding:3px 10px; white-space:nowrap;"><i class="fa-solid ' + icon + '" style="font-size:9.5px;"></i> ' + esc(j.type) + '</span>' +
        '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:9.5px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ink3);">' + esc(j.city + ', ' + j.country) + '</span>' +
        distinction + '</div>';
      var title = '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:17px; color:var(--ink); line-height:1.4;">' + esc(j.title) + '</div>';
      var subtitle = '';
      if (j.subtitle) {
        var inner = j.link
          ? '<a href="' + esc(j.link) + '" target="_blank" class="thesis-link" style="font-family:\'IBM Plex Mono\',monospace; font-style:italic; font-size:14.5px; color:var(--ink); line-height:1.45;">' + esc(j.subtitle) + ' <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:9px;"></i></a>'
          : '<span style="font-family:\'IBM Plex Mono\',monospace; font-style:italic; font-size:14.5px; color:var(--ink2); line-height:1.45;">' + esc(j.subtitle) + '</span>';
        subtitle = '<div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-top:6px;"><span style="font-family:\'IBM Plex Mono\',monospace; font-size:9px; letter-spacing:0.07em; text-transform:uppercase; color:var(--accent); flex:none;">Thesis</span>' + inner + '</div>';
      }
      var note = j.note ? '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:10.5px; letter-spacing:0.02em; color:var(--ink3); margin-top:7px;">' + esc(j.note) + '</div>' : '';
      var authors = '';
      if (j.authors) {
        var i = j.authors.indexOf(ME);
        authors = (i >= 0)
          ? '<div style="font-size:13px; color:var(--ink3); line-height:1.5; margin-top:7px;">' + esc(j.authors.slice(0, i)) + '<span style="color:var(--accent); font-weight:600;">' + esc(ME) + '</span>' + esc(j.authors.slice(i + ME.length)) + '</div>'
          : '<div style="font-size:13px; color:var(--ink3); line-height:1.5; margin-top:7px;">' + esc(j.authors) + '</div>';
      }
      var venueLine = j.venue ? (j.venue + (j.place ? '   ·   ' + j.place : '')) : (j.place || '');
      var venue = venueLine ? '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:10.5px; letter-spacing:0.02em; color:var(--ink2); margin-top:8px;">' + esc(venueLine) + '</div>' : '';
      return '<div style="display:grid; grid-template-columns:74px 1fr; gap:16px; padding:18px 2px; border-top:1px solid var(--line);">' +
        yearCol + '<div style="min-width:0;">' + head + title + subtitle + note + authors + venue + '</div></div>';
    }

    function renderList() {
      var activeTypes = (chipDefs.filter(function (d) { return d.key === typeFilter; })[0] || {}).types;
      var list = journey.filter(function (j) {
        if (activeTypes && activeTypes.indexOf(j.type) === -1) return false;
        if (activeCity && j.city !== activeCity) return false;
        return true;
      });
      list = list.slice().sort(function (a, b) {
        return ((b.ongoing ? 9999 : parseInt(b.year, 10)) || 0) - ((a.ongoing ? 9999 : parseInt(a.year, 10)) || 0);
      });
      listEl.innerHTML = list.length === 0
        ? '<p style="font-size:15px; color:var(--ink3); font-family:\'IBM Plex Mono\',monospace; font-style:italic; padding:24px 2px;">Nothing here yet for this filter.</p>'
        : list.map(listItemHTML).join('');
      if (countEl) countEl.textContent = list.length + (list.length === 1 ? ' entry' : ' entries');
      // re-mark active chip
      chipsEl.querySelectorAll('[data-jfilter]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-jfilter') === typeFilter);
      });
      if (clearEl) {
        if (activeCity && byCity[activeCity]) {
          clearEl.innerHTML = '<button id="journey-clear-btn" style="display:inline-flex; align-items:center; gap:7px; font-family:\'IBM Plex Mono\',monospace; font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--accent); background:color-mix(in srgb, var(--accent) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius:100px; padding:5px 12px; cursor:pointer;"><i class="fa-solid fa-location-dot" style="font-size:9px;"></i> ' + esc(activeCity) + ' <span style="font-size:13px; line-height:1; margin-left:1px;">×</span></button>';
          clearEl.querySelector('#journey-clear-btn').addEventListener('click', function () { activeCity = null; renderList(); updateRings(); });
        } else {
          clearEl.innerHTML = '';
        }
      }
    }

    // pan / zoom / touch
    function touchDist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    function onPanStart(e) {
      var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
      if (e.touches && e.touches.length === 2) { panning = false; pinch = touchDist(e.touches); pinchZoom = zoom; return; }
      panning = true; dragged = false; start = { x: p.clientX, y: p.clientY, tx: tx, ty: ty };
    }
    function onPanMove(e) {
      if (e.touches && e.touches.length === 2 && pinch) {
        var r = wrap.getBoundingClientRect();
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        var target = Math.min(MAXZOOM, Math.max(1, pinchZoom * (touchDist(e.touches) / pinch)));
        zoomAt(target / zoom, cx, cy); return;
      }
      if (!panning) return;
      var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
      var dx = p.clientX - start.x, dy = p.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
      var c = clampPan(start.tx + dx, start.ty + dy, zoom); tx = c[0]; ty = c[1]; applyTransform();
    }
    function onPanEnd() { panning = false; pinch = null; }

    wrap.addEventListener('mousedown', onPanStart);
    wrap.addEventListener('touchstart', onPanStart, { passive: true });
    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', onPanEnd);
    window.addEventListener('touchmove', function (e) { if (panning || pinch) { e.preventDefault(); onPanMove(e); } }, { passive: false });
    window.addEventListener('touchend', onPanEnd);
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = wrap.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    var zin = document.querySelector('[data-map-zoomin]');
    var zout = document.querySelector('[data-map-zoomout]');
    var zreset = document.querySelector('[data-map-reset]');
    if (zin) zin.addEventListener('click', function () { zoomAt(1.5, cw / 2, ch / 2); });
    if (zout) zout.addEventListener('click', function () { zoomAt(1 / 1.5, cw / 2, ch / 2); });
    if (zreset) zreset.addEventListener('click', function () { zoom = 1; tx = 0; ty = 0; applyTransform(); });
    [zin, zout, zreset].forEach(function (b) { if (b) b.addEventListener('mousedown', function (e) { e.stopPropagation(); }); });

    // boot
    renderChips();
    renderList();
    measure();

    function maybeCenter() {
      if (_centered) return;
      if (!_proj || !(cw > 1)) { setTimeout(maybeCenter, 100); return; }
      _centered = true; centerOn(55, 40, 1.55);
    }

    // Basemap is purely decorative — pins are placed from geocoded coordinates
    // (city-coords.js), so the light 110m basemap is plenty and strokes cheaply.
    fetch('/assets/countries-110m.json').then(function (r) { return r.json(); }).then(function (topo) {
      _topo = topo;
      var tries = 0;
      var tick = function () { if (buildGeoMap()) { buildPins(); maybeCenter(); } else if (tries++ < 80) setTimeout(tick, 80); };
      tick();
    }).catch(function () {});

    var mtries = 0;
    var remeasure = function () { measure(); if (cw < 1 && mtries++ < 30) setTimeout(remeasure, 100); else positionPins(); };
    remeasure();
    window.addEventListener('resize', function () { measure(); positionPins(); });
  }

  /* ---- Mobile dropdown nav ----------------------------------------------- */
  function initNavMenu() {
    var burger = document.querySelector('[data-nav-toggle]');
    var menu = document.querySelector('[data-nav-menu]');
    if (!burger || !menu) return;
    var icon = burger.querySelector('[data-nav-icon]');

    function setOpen(open) {
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (icon) { icon.classList.toggle('fa-bars', !open); icon.classList.toggle('fa-xmark', open); }
    }

    burger.addEventListener('click', function (e) { e.stopPropagation(); setOpen(menu.hidden); });
    // clicks inside the menu don't bubble to the outside-close handler below,
    // so toggling the theme keeps the menu open…
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    // …but navigating to a section closes it
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    // close when clicking anywhere outside
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !burger.contains(e.target)) setOpen(false);
    });
  }

  function init() {
    initTheme();
    initResearch();
    initMotif();
    initJourney();
    initNavMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

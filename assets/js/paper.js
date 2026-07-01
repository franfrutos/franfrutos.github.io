/* Paper detail page — citation tabs (APA / BibTeX / RIS) + copy.
 * No-op on pages without a cite card. Reads citation strings from the
 * <script type="application/json" id="fgf-cite"> blob on the page.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initCite() {
    var card = document.getElementById('fgf-cite-card');
    var dataEl = document.getElementById('fgf-cite');
    var bodyEl = document.getElementById('fgf-cite-body');
    if (!card || !dataEl || !bodyEl) return;

    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var tabs = card.querySelectorAll('.cite-tab');
    var copyBtn = card.querySelector('.cite-copy');
    var copyIcon = copyBtn.querySelector('i');
    var copyLabel = copyBtn.querySelector('span');
    var tab = 'apa';
    var copyTimer = null;

    function isCode(t) { return t !== 'apa'; }

    function render() {
      tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
      var content = data[tab] || '';
      if (isCode(tab)) {
        bodyEl.innerHTML = '<pre style="margin:0; padding:20px; overflow-x:auto; font-family:\'IBM Plex Mono\',monospace; font-size:13px; line-height:1.65; color:var(--ink2); white-space:pre; max-width:100%;">' + esc(content) + '</pre>';
      } else {
        // APA is pre-rendered as safe HTML (data.apaHtml, with <em> italics for journal/volume);
        // fall back to the escaped plain string if it's missing.
        var apaHtml = data.apaHtml || esc(content);
        bodyEl.innerHTML = '<p style="font-size:16px; color:var(--ink2); margin:0; line-height:1.7; padding:22px 20px; max-width:720px; overflow-wrap:anywhere; word-break:break-word;">' + apaHtml + '</p>';
      }
    }

    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        tab = b.getAttribute('data-tab');
        resetCopy();
        render();
      });
    });

    function resetCopy() {
      copyIcon.classList.remove('fa-circle-check');
      copyIcon.classList.add('fa-copy');
      copyLabel.textContent = 'Copy';
    }

    copyBtn.addEventListener('click', function () {
      var content = data[tab] || '';
      try { navigator.clipboard.writeText(content); } catch (e) {}
      copyIcon.classList.remove('fa-copy');
      copyIcon.classList.add('fa-circle-check');
      copyLabel.textContent = 'Copied';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopy, 1800);
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCite);
  } else {
    initCite();
  }
})();

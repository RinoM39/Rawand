/* =====================================================================
   RAWAND — page transition helper
   The transition itself is pure CSS (a cross-document View Transition, css/transition.css).
   This only:
     - notes that the next page is opened from inside the site, so the home page doesn't
       play its loading-screen intro again (read by the inline script in each page's <head>);
     - warms the next page while the pointer is on its link.
   ===================================================================== */
(() => {
  'use strict';

  // same page = same path and query (switching ?lang=… is a navigation, with the transition)
  const samePage = url => url.pathname.replace(/index\.html$/, '') + url.search === location.pathname.replace(/index\.html$/, '') + location.search;
  function destination(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(mailto|tel):/.test(raw)) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || samePage(url)) return null;
    return url;
  }

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!destination(e.target.closest('a[href]'))) return;
    try { sessionStorage.setItem('rw-pt', '1'); } catch (err) { /* private mode: the intro just plays */ }
  });

  const warmed = new Set();
  document.addEventListener('pointerover', e => {
    const url = destination(e.target.closest && e.target.closest('a[href]'));
    if (!url || warmed.has(url.pathname)) return;
    warmed.add(url.pathname);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url.pathname;
    document.head.appendChild(link);
  }, { passive: true });
})();

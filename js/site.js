/* =====================================================================
   RAWAND — shared bits for every page
   - the footer: logo, the full-width روند, and "the curtain comes down" when you reach it
   - on the inner pages (team, contact): the nav logo, the mobile menu, the solid nav on scroll,
     smooth scroll (Lenis, wired to ScrollTrigger) and in-page anchors such as "#top".
     The home page does all of that in js/hero.js together with its intro.
   Needs js/logo-data.js; gsap / ScrollTrigger / Lenis are optional.
   ===================================================================== */
(() => {
  'use strict';

  const LOGO = window.RAWAND_LOGO;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, root = document) => root.querySelector(s);

  // horizontal lockup: mark + روند + RAWAND
  function buildLockup(svg) {
    if (!LOGO || !svg || svg.childElementCount) return;
    const P = LOGO.paths;
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    };
    const x0 = 165.5;
    const sE = 0.952;
    svg.setAttribute('viewBox', '0 0 317 146.5');
    svg.setAttribute('fill-rule', 'evenodd');
    const mark = el('g', { transform: 'translate(-15 -6)' }, svg);
    ['line1', 'line2', 'line3', 'leaf', 'weave'].forEach(k => el('path', { d: P[k] }, mark));
    const ar = el('g', { transform: `translate(${x0 - 10.875} ${30 - 162.125})` }, svg);
    ['ar', 'ar_marks'].forEach(k => el('path', { d: P[k] }, ar));
    const en = el('g', { transform: `translate(${x0 - 7.25 * sE} ${95 - 222 * sE}) scale(${sE})` }, svg);
    ['en0', 'en1', 'en2', 'en3', 'en4', 'en5'].forEach(k => el('path', { d: P[k] }, en));
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------ footer */

  function initFooter() {
    const foot = $('#siteFoot');
    if (!foot) return;
    buildLockup($('#footLogo'));

    // RAWAND across the whole footer: one path per letter (room above them for the hover wave)
    const word = $('#footWord');
    let letters = [];
    if (LOGO && word) {
      letters = ['en0', 'en1', 'en2', 'en3', 'en4', 'en5'].map(k => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', LOGO.paths[k]);
        word.appendChild(p);
        return p;
      });
      const b = word.getBBox();
      word.setAttribute('viewBox', `${b.x - .4} ${b.y - 3.4} ${b.width + .8} ${b.height + 3.6}`);
      word.setAttribute('fill-rule', 'evenodd');
    }
    if (!hasGSAP || reduceMotion) return;

    // the curtain: falls from the top edge; its lower edge sags like a drape, overshoots and settles
    foot.classList.add('is-staged');
    const curtain = $('.foot-curtain path', foot);
    const c = { y: 0, sag: 0 };
    const shape = () => curtain.setAttribute('d', `M0 0H100V${c.y.toFixed(2)}Q50 ${(c.y + c.sag).toFixed(2)} 0 ${c.y.toFixed(2)}Z`);
    shape();
    const q = gsap.utils.selector(foot);
    const tl = gsap.timeline({ paused: true })
      .to(c, { y: 100, duration: 1.15, ease: 'power3.inOut', onUpdate: shape }, 0)
      .to(c, { keyframes: { sag: [0, 26, -8, 0], easeEach: 'sine.inOut' }, duration: 1.55, ease: 'none', onUpdate: shape }, 0)
      .from(q('.foot-paper'), { opacity: 0, duration: .9, ease: 'power1.out' }, .7)
      .from(q('.foot-title, .foot-cta'), { opacity: 0, y: 44, duration: .95, stagger: .1, ease: 'power3.out' }, .72)
      .from(q('.foot-rule'), { scaleX: 0, duration: 1.1, ease: 'power3.inOut' }, .95)
      .from(q('.foot-col > *'), { opacity: 0, y: 20, duration: .7, stagger: .03, ease: 'power3.out' }, 1.05)
      .from(q('.foot-bar'), { opacity: 0, y: 12, duration: .7, ease: 'power2.out' }, 1.35)
      .from(letters, { yPercent: 118, duration: 1.2, stagger: .08, ease: 'expo.out' }, 1.25);
    // the letters near the pointer lift a little, like a wave following it
    if (letters.length && window.matchMedia('(hover: hover)').matches) {
      const lift = letters.map(p => gsap.quickTo(p, 'y', { duration: .6, ease: 'power3.out' }));
      const centers = letters.map(p => { const b = p.getBBox(); return b.x + b.width / 2; });
      word.parentNode.addEventListener('pointermove', e => {
        const pt = word.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const x = pt.matrixTransform(word.getScreenCTM().inverse()).x;
        centers.forEach((cx, i) => lift[i](-2.6 * Math.exp(-(((x - cx) / 16) ** 2))));
      });
      word.parentNode.addEventListener('pointerleave', () => lift.forEach(f => f(0)));
    }

    // rolls back up if you scroll back; created early on some pages, so refresh it after the pins
    ScrollTrigger.create({ trigger: foot, start: 'top 82%', refreshPriority: -1, onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
  }
  initFooter();

  if ($('#hero')) return;          // home page: hero.js owns the nav and the scrolling

  /* ------------------------------------------------------------ inner pages */

  const nav = $('#nav');
  buildLockup($('#navLogo'));
  const toggle = $('#navToggle');
  if (toggle) toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(nav.classList.toggle('is-open'))));
  const solid = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', solid, { passive: true });
  solid();

  let lenis = null;
  if (hasGSAP && typeof window.Lenis !== 'undefined' && !reduceMotion) {
    lenis = new Lenis({ lerp: .1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    nav.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
})();

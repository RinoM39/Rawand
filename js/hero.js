/* =====================================================================
   RAWAND — Intro (three lines draw the logo) + Hero (exploded axonometric, one layer per partner)
   Needs: gsap + ScrollTrigger (+ optional Lenis), js/logo-data.js, js/axo.js
   ===================================================================== */
(() => {
  'use strict';

  const LOGO = window.RAWAND_LOGO;
  const P = LOGO.paths;
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const DEG = Math.PI / 180;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const svgEl = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // The three R lines of the mark, numbered right→left (RTL): ١ inner · ٢ middle · ٣ outer.
  // axisX/axisY = centre of each line's vertical bar / top bar (logo units); d = the pen path the reveal mask follows.
  const LINES = [
    { key: 'line3', axisX: 55.7, axisY: 67.4, d: 'M55.7 126V67.4H71', w: 16 },
    { key: 'line2', axisX: 44.8, axisY: 51.6, d: 'M44.8 162V51.6H80', w: 16 },
    { key: 'line1', axisX: 32.5, axisY: 38, d: 'M26 162V38H96', w: 24 },
  ];
  const MARK_KEYS = ['line1', 'line2', 'line3', 'leaf', 'weave'];
  const EN_KEYS = ['en0', 'en1', 'en2', 'en3', 'en4', 'en5'];

  const nav = $('#nav');
  const hero = $('#hero');
  const layerTags = $$('.layer-tag');
  const intro = $('#intro');
  let lenis = null;

  /* ------------------------------------------------------------ logos */

  // Horizontal lockup for the nav: mark + روند + RAWAND (same traced paths).
  function buildNavLogo(svg) {
    const x0 = 165.5;
    const sE = 0.952;
    svg.setAttribute('viewBox', '0 0 317 146.5');
    svg.setAttribute('fill-rule', 'evenodd');
    const mark = svgEl('g', { transform: 'translate(-15 -6)' }, svg);
    MARK_KEYS.forEach(k => svgEl('path', { d: P[k] }, mark));
    const words = svgEl('g', {}, svg);
    const ar = svgEl('g', { transform: `translate(${x0 - 10.875} ${30 - 162.125})` }, words);
    ['ar', 'ar_marks'].forEach(k => svgEl('path', { d: P[k] }, ar));
    const en = svgEl('g', { transform: `translate(${x0 - 7.25 * sE} ${95 - 222 * sE}) scale(${sE})` }, words);
    EN_KEYS.forEach(k => svgEl('path', { d: P[k] }, en));
    return { mark, words };
  }

  // Full logo with a reveal mask per part, for the intro.
  function buildIntroLogo(svg) {
    svg.setAttribute('viewBox', LOGO.viewBox.full);
    svg.setAttribute('fill-rule', 'evenodd');
    const defs = svgEl('defs', {}, svg);
    const box = { maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: 260, height: 340 };
    const parts = {};

    LINES.forEach(line => {
      const mask = svgEl('mask', { id: `rw-m-${line.key}`, ...box }, defs);
      line.pen = svgEl('path', {
        d: line.d, fill: 'none', stroke: '#fff', 'stroke-width': line.w,
        pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1.001,
      }, mask);
    });

    const grow = svgEl('radialGradient', { id: 'rw-grow' }, defs);
    svgEl('stop', { offset: '0', 'stop-color': '#fff' }, grow);
    svgEl('stop', { offset: '.78', 'stop-color': '#fff' }, grow);
    svgEl('stop', { offset: '1', 'stop-color': '#000' }, grow);
    const growMask = (id, cx, cy) => svgEl('circle', { cx, cy, r: 0, fill: 'url(#rw-grow)' }, svgEl('mask', { id, ...box }, defs));
    parts.leafGrow = growMask('rw-m-leaf', 47, 152);
    parts.weaveGrow = growMask('rw-m-weave', 58, 152);

    // Arabic wordmark is wiped in right → left, the way it is read.
    const wipe = svgEl('linearGradient', { id: 'rw-wipe' }, defs);
    svgEl('stop', { offset: '0', 'stop-color': '#000' }, wipe);
    svgEl('stop', { offset: '.14', 'stop-color': '#fff' }, wipe);
    parts.arWipe = svgEl('rect', { x: 166, y: 155, width: 0, height: 64, fill: 'url(#rw-wipe)' }, svgEl('mask', { id: 'rw-m-ar', ...box }, defs));

    parts.mark = svgEl('g', {}, svg);
    LINES.forEach(line => svgEl('path', { d: P[line.key] }, svgEl('g', { mask: `url(#rw-m-${line.key})` }, parts.mark)));
    parts.leaf = svgEl('g', { mask: 'url(#rw-m-leaf)' }, parts.mark);
    svgEl('path', { d: P.leaf }, parts.leaf);
    parts.weave = svgEl('g', { mask: 'url(#rw-m-weave)' }, parts.mark);
    svgEl('path', { d: P.weave }, parts.weave);

    parts.text = svgEl('g', {}, svg);
    svgEl('path', { d: P.ar }, svgEl('g', { mask: 'url(#rw-m-ar)' }, parts.text));
    parts.arMarks = svgEl('path', { d: P.ar_marks, opacity: 0 }, parts.text);
    parts.en = EN_KEYS.map(k => svgEl('path', { d: P[k], opacity: 0 }, parts.text));
    parts.tag = svgEl('path', { d: P.tag, opacity: 0 }, parts.text);
    return parts;
  }

  /* ------------------------------------------------------------ intro */

  // Structural grid axes ١ ٢ ٣ — one per line, one per partner.
  function buildAxes(svg, host) {
    const ctm = svg.getScreenCTM();
    const pt = svg.createSVGPoint();
    const out = { v: [], h: [] };
    LINES.forEach(line => {
      pt.x = line.axisX;
      pt.y = line.axisY;
      const p = pt.matrixTransform(ctm);
      const v = document.createElement('i');
      v.className = 'axis-v';
      v.style.left = `${p.x}px`;
      const h = document.createElement('i');
      h.className = 'axis-h';
      h.style.top = `${p.y}px`;
      host.append(v, h);
      out.v.push(v);
      out.h.push(h);
    });
    return out;
  }

  function playIntro(parts, axes, onDone) {
    const spread = parts.en.map(p => {
      const b = p.getBBox();
      return (b.x + b.width / 2 - 86.7) * 0.3;
    });
    return gsap.timeline({ onComplete: onDone })
      .from('.intro-paper', { opacity: 0, duration: .8, ease: 'power1.out' }, 0)
      .fromTo(axes.v, { scaleY: 0 }, { scaleY: 1, duration: 1, stagger: .12, ease: 'power3.inOut' }, .1)
      .fromTo(axes.h, { scaleX: 0 }, { scaleX: 1, duration: 1, stagger: .12, ease: 'power3.inOut' }, .25)
      .to(LINES.map(l => l.pen), { attr: { 'stroke-dashoffset': 0 }, duration: 1.05, stagger: .16, ease: 'power2.inOut' }, .75)
      .to(parts.leafGrow, { attr: { r: 250 }, duration: 1.5, ease: 'power2.out' }, 1.55)
      .fromTo(parts.leaf, { rotation: -7, scale: .94, svgOrigin: '47 152' }, { rotation: 0, scale: 1, svgOrigin: '47 152', duration: 1.5, ease: 'power3.out' }, 1.55)
      .to(parts.weaveGrow, { attr: { r: 230 }, duration: 1.3, ease: 'power2.out' }, 1.85)
      .to([...axes.v, ...axes.h], { opacity: 0, duration: .7, ease: 'power1.inOut' }, 2.45)
      .to(parts.arWipe, { attr: { x: -20, width: 186 }, duration: 1, ease: 'power2.inOut' }, 2.35)
      .fromTo(parts.en, { opacity: 0, y: 7, x: i => spread[i] }, { opacity: 1, y: 0, x: 0, duration: .9, stagger: .05, ease: 'power3.out' }, 2.75)
      .fromTo(parts.arMarks, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, 2.95)
      .fromTo(parts.tag, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: .7, ease: 'power2.out' }, 3.15)
      .to({}, { duration: .45 });
  }

  // The mark flies into the nav (FLIP) while the paper dissolves into the hero.
  function exitIntro(parts, navLogo, onReveal) {
    const logo = $('#introLogo');
    const from = parts.mark.getBoundingClientRect();
    const to = navLogo.mark.getBoundingClientRect();
    const box = logo.getBoundingClientRect();
    const fx = from.left + from.width / 2;
    const fy = from.top + from.height / 2;

    gsap.timeline({
      onComplete: () => {
        gsap.set(navLogo.mark, { opacity: 1 });
        intro.remove();
      },
    })
      .to(parts.text, { opacity: 0, y: 6, duration: .4, ease: 'power2.in' }, 0)
      .to(logo, {
        x: to.left + to.width / 2 - fx,
        y: to.top + to.height / 2 - fy,
        scale: to.height / from.height,
        transformOrigin: `${fx - box.left}px ${fy - box.top}px`,
        duration: 1.1,
        ease: 'expo.inOut',
      }, .1)
      .to(intro, { backgroundColor: 'rgba(245, 243, 240, 0)', duration: .8, ease: 'power1.inOut' }, .45)
      .to('.intro-paper', { opacity: 0, duration: .8 }, .45)
      .to(navLogo.words, { opacity: 1, duration: .6, ease: 'power1.out' }, .95)
      .add(onReveal, .5);
  }

  /* ------------------------------------------------------------ hero */

  // Where the drawing sits: centred at rest; when exploded it shifts left a little to make room for the labels.
  const layoutFn = (w, h) => (w < 900
    ? { rest: { cx: w * .5, cy: h * .52, w: w * .84, h: h * .5 }, exp: { cx: w * .31, cy: h * .54, w: w * .56, h: h * .74 } }
    : { rest: { cx: w * .5, cy: h * .53, w: w * .46, h: h * .64 }, exp: { cx: w * .44, cy: h * .53, w: w * .48, h: h * .78 } });

  const axo = window.RawandAxo.create($('#heroCanvas'), layoutFn);
  const st = axo.st;
  const aim = { yaw: 0, pitch: 0, cursor: 0 };
  let heroVisible = true;

  function placeTags(out) {
    layerTags.forEach((tag, i) => {
      const a = out.tagAlpha[i] * (.3 + .7 * st.emph[i]);
      tag.style.opacity = a;
      tag.style.pointerEvents = a > .6 ? 'auto' : 'none';
      if (out.tagAlpha[i] > 0) tag.style.transform = `translate3d(${out.tagX}px, ${out.anchors[i][1]}px, 0) translateY(-50%)`;
    });
  }

  const measureTags = () => { st.tagW = Math.max(...layerTags.map(t => t.offsetWidth)); };

  function renderHero() {
    placeTags(axo.render());
  }

  function tick(time) {
    if (!heroVisible) return;
    st.time = time;
    const sway = Math.sin(time * .22) * 2.6 * DEG;
    st.yaw += (aim.yaw + sway - st.yaw) * .06;
    st.pitch += (aim.pitch - st.pitch) * .06;
    st.cursor += (aim.cursor - st.cursor) * .12;
    renderHero();
  }

  function initPointer() {
    if (!finePointer) return;
    const canvas = $('#heroCanvas');
    hero.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      st.pointer = [x, y];
      aim.yaw = (x / r.width - .5) * 16 * DEG;
      aim.pitch = (y / r.height - .5) * 7 * DEG;
      aim.cursor = e.target.closest('a, button, .layer-tag') ? 0 : 1;
    });
    hero.addEventListener('pointerleave', () => { aim.yaw = 0; aim.pitch = 0; aim.cursor = 0; });
  }

  function setHeroHidden() {
    gsap.set(['.hero-scroll > *', '.nav-links', '.nav-actions'], { opacity: 0 });
  }

  // After the intro: the building is drafted line by line, then the three leaves grow on its roof.
  function heroIn() {
    return gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to(st, { draw: 1, duration: 2.8, ease: 'power1.inOut' }, 0)
      .to(st, { grow: 1, duration: 1.3, ease: 'back.out(1.8)' }, 2.55)
      .to(['.nav-links', '.nav-actions'], { opacity: 1, duration: .8, clearProps: 'opacity' }, .3)
      .to('.hero-scroll > *', { opacity: 1, duration: .8 }, 2.4);
  }

  // Scroll: explode → walk up the building one layer (one partner) at a time → reassemble.
  function initScroll() {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=480%',
        pin: true,
        scrub: 1,
      },
    });
    // bring one layer into focus: the others fade back and the camera glides to it
    const focusOn = (i, at) => tl
      .to(st.emph, { 0: i === 0 ? 1 : .14, 1: i === 1 ? 1 : .14, 2: i === 2 ? 1 : .14, duration: .07, ease: 'power1.inOut' }, at)
      .to(st, { focus: i, duration: .07, ease: 'power2.inOut' }, at);

    tl.to(st, { explode: 1, duration: .14, ease: 'power2.inOut' }, 0)
      .to('.hero-scroll', { opacity: 0, duration: .05, ease: 'none' }, 0)
      .to(st, { tags: 1, duration: .08, ease: 'none' }, .09)
      .to(st, { orbit: 14 * DEG, duration: .62, ease: 'sine.inOut' }, .1)
      .to(st, { follow: .6, zoom: 1.12, duration: .08, ease: 'power2.inOut' }, .17);
    focusOn(0, .17); // ١ الهيكل — الوظيفة
    focusOn(1, .35); // ٢ الواجهة — الجمال
    focusOn(2, .53); // ٣ السطح الأخضر — الاستدامة
    tl.to(st.emph, { 0: 1, 1: 1, 2: 1, duration: .06, ease: 'power1.inOut' }, .7)
      .to(st, { follow: 0, zoom: 1, duration: .08, ease: 'power2.inOut' }, .7)
      .to(st, { tags: 0, duration: .05, ease: 'none' }, .74)
      .to(st, { explode: 0, duration: .12, ease: 'power2.inOut' }, .76)
      .to(st, { orbit: 0, duration: .12, ease: 'sine.inOut' }, .76)
      .to({}, { duration: .1 }, .88);

    // solid nav once past the first half-screen (onUpdate, so it also holds at the very bottom)
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: self => nav.classList.toggle('is-solid', self.scroll() > window.innerHeight * .5),
    });
  }

  function initNav() {
    const toggle = $('#navToggle');
    const close = () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(nav.classList.toggle('is-open'))));
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      close();
      const target = a.getAttribute('href').length > 1 && document.querySelector(a.getAttribute('href'));
      if (!target) return; // sections owned by teammates may not exist yet
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function lockScroll(locked) {
    document.documentElement.classList.toggle('is-locked', locked);
    if (lenis) locked ? lenis.stop() : lenis.start();
  }

  /* ------------------------------------------------------------ boot */

  const navLogo = buildNavLogo($('#navLogo'));
  initNav();
  new ResizeObserver(() => { measureTags(); axo.resize(); renderHero(); }).observe($('#heroCanvas'));
  if (document.fonts) document.fonts.ready.then(() => { measureTags(); renderHero(); });

  if (!hasGSAP || reduceMotion) {
    intro.remove();
    st.draw = 1;
    st.grow = 1;
    renderHero();
    return;
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  gsap.registerPlugin(ScrollTrigger);

  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: .1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  lockScroll(true);
  setHeroHidden();
  gsap.set([navLogo.mark, navLogo.words], { opacity: 0 });
  initScroll();
  initPointer();
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);
  gsap.ticker.add(tick);

  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]);

  // Arriving from another page — through the page transition, or with a #section (team.html → index.html#about):
  // no loading screen again; go straight to the hero or to that section.
  const deepLink = location.hash.length > 1 && $(location.hash);
  const arrived = document.documentElement.dataset.arrive === '1';
  if ((deepLink && deepLink !== hero) || arrived) {
    intro.remove();
    gsap.set([navLogo.mark, navLogo.words], { opacity: 1 });
    lockScroll(false);
    heroIn();
    const go = () => fontsReady.then(() => {
      ScrollTrigger.refresh();
      if (lenis) lenis.scrollTo(deepLink, { immediate: true, force: true });
      else deepLink.scrollIntoView();
    });
    if (deepLink && deepLink !== hero) {
      if (document.readyState === 'complete') go();
      else window.addEventListener('load', go, { once: true });
    }
    return;
  }

  const parts = buildIntroLogo($('#introLogo'));

  fontsReady.then(() => {
    const axes = buildAxes($('#introLogo'), $('#introAxes'));
    const reveal = () => {
      lockScroll(false);
      ScrollTrigger.refresh();
      heroIn();
    };
    const tl = playIntro(parts, axes, () => exitIntro(parts, navLogo, reveal));
    const skip = () => { if (tl.progress() < 1) tl.progress(1); };
    window.addEventListener('keydown', e => { if (e.key === 'Escape') skip(); });
  });
})();

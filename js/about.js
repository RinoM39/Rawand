/* =====================================================================
   RAWAND — About (من نحن) · sheet A-02
   Needs gsap + ScrollTrigger (already loaded for the hero) and js/logo-data.js.
   Without GSAP, or with reduced motion, the section just shows its final state.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('about');
  if (!root) return;

  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };

  // The logo mark as a construction drawing: every part as a light outline, then three of them
  // grow in ink like grass — from the root up, with a soft growing tip:
  //   ١ the R's middle line            (from its foot up, then along the top bar)
  //   ٢ the stem leaving its foot      (up into the leaf, its colour fading out half way up the leaf)
  //   ٣ the crescent under the leaf that writes the "ر"   (from the lattice up along its curve)
  function buildMark(svg) {
    const L = window.RAWAND_LOGO;
    svg.setAttribute('viewBox', '-3 -12 177.5 182.5');
    svg.setAttribute('fill-rule', 'evenodd');
    const defs = el('defs', {}, svg);
    const box = { maskUnits: 'userSpaceOnUse', x: -20, y: -30, width: 215, height: 215 };

    // soft growing tip: the mask strokes are blurred
    el('feGaussianBlur', { stdDeviation: 2.4 }, el('filter', { id: 'am-tip', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs));
    // the leaf's ink fades out towards its tip
    const fade = el('linearGradient', { id: 'am-fade', gradientUnits: 'userSpaceOnUse', x1: 48, y1: 140, x2: 150, y2: 2 }, defs);
    [[0, 1], [.36, .92], [.78, 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': '#5B0F1A', 'stop-opacity': a }, fade));
    // the crescent is joined to the lattice: keep only the part above the junction
    el('polygon', { points: '80,99.5 116.5,136 180,136 180,-20 80,-20' }, el('clipPath', { id: 'am-cres', clipPathUnits: 'userSpaceOnUse' }, defs));

    const guides = el('g', {}, svg);
    [32.5, 44.8, 55.7].forEach(x => el('line', { class: 'guide', x1: x, y1: -12, x2: x, y2: 170.5 }, guides));
    [38, 51.6, 67.4].forEach(y => el('line', { class: 'guide', x1: -3, y1: y, x2: 174.5, y2: y }, guides));

    const soft = ['line1', 'line2', 'line3', 'leaf', 'weave'].map(k => el('path', { class: 'mk mk-soft', d: L.paths[k], pathLength: 1 }, svg));

    const grow = (id, pen, width, shape) => {
      const m = el('mask', { id, ...box }, defs);
      const p = el('path', { d: pen, fill: 'none', stroke: '#fff', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 2', 'stroke-dashoffset': 1.05, filter: 'url(#am-tip)' }, m);
      const g = el('g', { class: 'mk-grow', mask: `url(#${id})` }, svg);
      shape(g);
      return { pen: p, group: g };
    };
    const ink = [
      grow('am-g1', 'M44 156V51.4H79', 12, g => el('path', { class: 'mk-ink', d: L.paths.line2 }, g)),
      grow('am-g2', 'M48 141L81 100L152 0', 72, g => el('path', { d: L.paths.leaf, fill: 'url(#am-fade)' }, g)),
      grow('am-g3', 'M106 136C122 118 146 92 154 30', 28, g => el('path', { class: 'mk-ink', d: L.paths.weave, 'clip-path': 'url(#am-cres)' }, g)),
    ];
    return { guides: Array.from(guides.children), soft, ink };
  }

  // Wrap every word in a span for the ink effect; screen readers get one untouched copy.
  function splitWords(p) {
    const words = [];
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    const fill = (from, into) => from.childNodes.forEach(n => {
      if (n.nodeType !== Node.TEXT_NODE) {
        const clone = n.cloneNode(false);
        into.append(clone);
        fill(n, clone);
        return;
      }
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { into.append(part); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        into.append(w);
        words.push(w);
      });
    });
    fill(p, visual);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = p.textContent.replace(/\s+/g, ' ').trim();
    p.replaceChildren(sr, visual);
    return words;
  }

  const mark = buildMark(root.querySelector('#aboutMark'));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined' || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  const q = gsap.utils.selector(root);
  const statement = q('.about-statement')[0];
  const words = splitWords(statement);

  // sheet header: the rule is drawn from the right, like a pen across the sheet
  gsap.timeline({ scrollTrigger: { trigger: q('.sheet-head')[0], start: 'top 85%' } })
    .from(q('.sheet-rule'), { scaleX: 0, duration: 1.4, ease: 'power3.inOut' })
    .from(q('.sheet-label'), { opacity: 0, y: 12, duration: .8, stagger: .1, ease: 'power3.out' }, 0);

  // statement: each word fills with ink as it scrolls past
  gsap.fromTo(words, { color: 'rgba(91, 15, 26, .14)' }, {
    color: (i, w) => (w.closest('em') ? '#7A1E29' : '#5B0F1A'),
    stagger: .12,
    ease: 'none',
    scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 55%', scrub: .6 },
  });

  // construction drawing of the mark: axes, the light outlines, then the three parts grow in ink.
  // It is complete by the time the logo reaches the middle of the screen.
  gsap.set(mark.ink.map(i => i.group), { opacity: 0 });
  gsap.timeline({ scrollTrigger: { trigger: q('.about-figure')[0], start: 'top 90%', end: 'center 55%', scrub: .8 } })
    .from(mark.guides, { opacity: 0, duration: .25, stagger: .04 }, 0)
    .fromTo(mark.soft, { strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .55, stagger: .06, ease: 'none' }, .05)
    .to(mark.ink.map(i => i.group), { opacity: 1, duration: .2, ease: 'power1.out' }, .32)
    .to(mark.ink[0].pen, { attr: { 'stroke-dashoffset': 0 }, duration: .45, ease: 'power1.inOut' }, .32)
    .to(mark.ink[1].pen, { attr: { 'stroke-dashoffset': 0 }, duration: .55, ease: 'power1.inOut' }, .45)
    .to(mark.ink[2].pen, { attr: { 'stroke-dashoffset': 0 }, duration: .45, ease: 'power1.inOut' }, .55);

  // vision / mission: dimension lines open out from the label
  q('.pillar').forEach(p => {
    gsap.timeline({ scrollTrigger: { trigger: p, start: 'top 82%' } })
      .from(p.querySelectorAll('.dim-line'), { scaleX: 0, duration: 1.1, ease: 'power3.inOut' })
      .from(p.querySelector('.dim-label'), { opacity: 0, y: 8, duration: .6, ease: 'power3.out' }, .2)
      .from(p.querySelector('p'), { opacity: 0, y: 18, duration: .9, ease: 'power3.out' }, .45);
  });

  // values: the structural grid is set out (lines, then axis bubbles), then the text
  gsap.timeline({ scrollTrigger: { trigger: q('.about-values')[0], start: 'top 78%' } })
    .from(q('.values-title'), { opacity: 0, y: 12, duration: .7, ease: 'power3.out' }, 0)
    .from(q('.value-top'), { scaleX: 0, duration: 1.1, stagger: .1, ease: 'power3.inOut' }, .1)
    .from(q('.value-rule'), { scaleY: 0, duration: 1.1, stagger: .1, ease: 'power3.inOut' }, .25)
    .from(q('.value-axis'), { scale: 0, duration: .55, stagger: .1, ease: 'back.out(2.2)' }, .4)
    .from(q('.value h4, .value-en, .value-text'), { opacity: 0, y: 14, duration: .7, stagger: .05, ease: 'power3.out' }, .6);
})();

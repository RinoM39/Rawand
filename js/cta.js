/* =====================================================================
   RAWAND — "Have a project? Let's start on site." (home page)
   A live topographic survey on a burgundy sheet:
     - contour lines of a gently shifting terrain (marching squares on a sum of waves),
       every fifth one an index contour, as on a real survey;
     - a hill rises under the pointer and follows it; it rests under the pin (the site)
       and gathers tight round it when the pin is hovered;
     - the pin (the link) is drawn towards the pointer; the crosshair follows it;
     - the strip along the bottom reads the position and elevation under the pointer.
   Phones: the hill drifts on its own around the pin. Reduced motion: one still frame.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.querySelector('.site-cta');
  if (!root) return;
  const frame = root.querySelector('.cta-frame');
  const canvas = root.querySelector('.cta-canvas');
  const ctx = canvas.getContext('2d');
  const pin = root.querySelector('.cta-pin');
  const core = root.querySelector('.cta-pin-core');
  const ro = {
    lat: root.querySelector('.ro-lat'),
    lng: root.querySelector('.ro-lng'),
    el: root.querySelector('.ro-el'),
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  const CELL = 13;              // marching-squares cell, CSS px
  const UNIT = 250;             // terrain wavelength scale, CSS px
  const L0 = -3;                // contour levels: L0 + k * STEP
  const STEP = .17;
  const ORIGIN = { lat: 24.7136, lng: 46.6753, el: 612 };   // Riyadh

  const view = { w: 1, h: 1, dpr: 1, cols: 0, rows: 0, vals: null };
  const home = { x: 0, y: 0 };                 // the pin's resting centre (frame px)
  const hill = { x: 0, y: 0, a: .95, r: 150 };  // the moving hill
  const ptr = { x: 0, y: 0, in: false };
  const st = { t: 0, reveal: reduceMotion || !hasGSAP ? 1 : 0, hot: 0, pull: { x: 0, y: 0 } };
  let visible = false;

  /* ------------------------------------------------------------ terrain */

  function height(x, y, t) {
    const u = x / UNIT;
    const v = y / UNIT;
    let f = .62 * Math.sin(.9 * u + .35 * v + .16 * t)
      + .48 * Math.sin(-.42 * u + 1.08 * v - .12 * t + 1.3)
      + .3 * Math.sin(1.65 * u - 1.2 * v + .08 * t + 2.1)
      + .2 * Math.sin(2.3 * u + 1.9 * v - .14 * t + .4);
    const dx = x - hill.x;
    const dy = y - hill.y;
    f += hill.a * 2.1 * Math.exp(-(dx * dx + dy * dy) / (hill.r * hill.r));
    return f;
  }

  function sample() {
    const { cols, rows, vals } = view;
    let k = 0;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) vals[k++] = height(i * CELL, j * CELL, st.t);
    }
  }

  // segments per marching-squares case; edges: 0 top, 1 right, 2 bottom, 3 left
  const CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
    [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];

  function contours(minor, major) {
    const { cols, rows, vals } = view;
    const W = cols + 1;
    const pt = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = vals[j * W + i];
        const b = vals[j * W + i + 1];
        const c = vals[(j + 1) * W + i + 1];
        const d = vals[(j + 1) * W + i];
        const lo = Math.min(a, b, c, d);
        const hi = Math.max(a, b, c, d);
        const k0 = Math.ceil((lo - L0) / STEP);
        const k1 = Math.floor((hi - L0) / STEP);
        if (k1 < k0) continue;
        const x0 = i * CELL;
        const y0 = j * CELL;
        for (let k = k0; k <= k1; k++) {
          const L = L0 + k * STEP;
          const id = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          const segs = CASES[id];
          if (!segs.length) continue;
          // crossing points on the four edges
          pt[0] = x0 + CELL * (L - a) / (b - a); pt[1] = y0;
          pt[2] = x0 + CELL; pt[3] = y0 + CELL * (L - b) / (c - b);
          pt[4] = x0 + CELL * (L - d) / (c - d); pt[5] = y0 + CELL;
          pt[6] = x0; pt[7] = y0 + CELL * (L - a) / (d - a);
          const path = k % 5 === 0 ? major : minor;
          for (const [e0, e1] of segs) {
            path.moveTo(pt[e0 * 2], pt[e0 * 2 + 1]);
            path.lineTo(pt[e1 * 2], pt[e1 * 2 + 1]);
          }
        }
      }
    }
  }

  function draw() {
    const { w, h, dpr } = view;
    sample();
    const minor = new Path2D();
    const major = new Path2D();
    contours(minor, major);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    // the survey spreads out from the pin as the section arrives
    if (st.reveal < 1) {
      const far = Math.hypot(Math.max(home.x, w - home.x), Math.max(home.y, h - home.y));
      ctx.beginPath();
      ctx.arc(home.x, home.y, Math.max(.1, far * st.reveal), 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(245, 243, 240, .17)';
    ctx.lineWidth = .9;
    ctx.stroke(minor);
    ctx.strokeStyle = 'rgba(216, 209, 201, .42)';
    ctx.lineWidth = 1.3;
    ctx.stroke(major);
    // hovering the pin: the lines round the site light up
    if (st.hot > .01) {
      const g = ctx.createRadialGradient(hill.x, hill.y, 0, hill.x, hill.y, hill.r * 2.2);
      g.addColorStop(0, `rgba(245, 243, 240, ${.75 * st.hot})`);
      g.addColorStop(1, 'rgba(245, 243, 240, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.1;
      ctx.stroke(minor);
      ctx.stroke(major);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ layout */

  function measure() {
    const fr = frame.getBoundingClientRect();
    const pr = pin.getBoundingClientRect();
    home.x = pr.left - fr.left + pr.width / 2;
    home.y = pr.top - fr.top + pr.height / 2;
    hill.r = Math.max(110, Math.min(fr.width, fr.height) * .2);
  }

  function resize() {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.cols = Math.ceil(w / CELL);
    view.rows = Math.ceil(h / CELL);
    view.vals = new Float32Array((view.cols + 1) * (view.rows + 1));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    measure();
    if (!ptr.in) { hill.x = home.x; hill.y = home.y; }
    draw();
  }

  function readout(x, y) {
    const lat = ORIGIN.lat - (y - view.h / 2) / view.h * .012;
    const lng = ORIGIN.lng + (x - view.w / 2) / view.w * .02;
    const el = ORIGIN.el + height(x, y, st.t) * 6;
    ro.lat.textContent = lat.toFixed(4);
    ro.lng.textContent = lng.toFixed(4);
    ro.el.textContent = (el >= 0 ? '+' : '') + el.toFixed(2);
  }

  new ResizeObserver(resize).observe(frame);
  resize();
  readout(home.x, home.y);
  if (reduceMotion) return;

  /* ------------------------------------------------------------ pointer */

  frame.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' && !finePointer) return;
    const fr = frame.getBoundingClientRect();
    ptr.x = e.clientX - fr.left;
    ptr.y = e.clientY - fr.top;
    ptr.in = true;
  });
  frame.addEventListener('pointerleave', () => { ptr.in = false; });
  pin.addEventListener('pointerenter', () => { st.hotTarget = 1; });
  pin.addEventListener('pointerleave', () => { st.hotTarget = 0; });
  pin.addEventListener('focus', () => { st.hotTarget = 1; });
  pin.addEventListener('blur', () => { st.hotTarget = 0; });

  /* ------------------------------------------------------------ loop */

  let last = performance.now();
  function frameStep(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    st.t += dt * .55;

    // where the hill wants to be: the pointer, the pin while it's hovered, or a slow walk round the pin
    const hot = st.hotTarget || 0;
    st.hot += (hot - st.hot) * Math.min(1, dt * 5);
    let tx = home.x + Math.cos(st.t * .5) * hill.r * .5;
    let ty = home.y + Math.sin(st.t * .37) * hill.r * .35;
    if (ptr.in) { tx = ptr.x; ty = ptr.y; }
    if (hot) { tx = home.x + st.pull.x; ty = home.y + st.pull.y; }
    const ease = Math.min(1, dt * (ptr.in ? 4 : 1.6));
    hill.x += (tx - hill.x) * ease;
    hill.y += (ty - hill.y) * ease;
    hill.a += ((hot ? 1.45 : .95) - hill.a) * Math.min(1, dt * 3);

    // the pin leans towards the pointer when it's near
    let px = 0;
    let py = 0;
    if (ptr.in) {
      const dx = ptr.x - home.x;
      const dy = ptr.y - home.y;
      const d = Math.hypot(dx, dy);
      const reach = 260;
      if (d < reach) {
        const k = (1 - d / reach) * .42;
        px = dx * k;
        py = dy * k;
      }
    }
    st.pull.x += (px - st.pull.x) * Math.min(1, dt * 8);
    st.pull.y += (py - st.pull.y) * Math.min(1, dt * 8);
    core.style.transform = `translate(${st.pull.x.toFixed(2)}px, ${st.pull.y.toFixed(2)}px)`;
    frame.style.setProperty('--px', (home.x + st.pull.x).toFixed(1) + 'px');
    frame.style.setProperty('--py', (home.y + st.pull.y).toFixed(1) + 'px');

    if (ptr.in) readout(ptr.x, ptr.y);
    else readout(hill.x, hill.y);
    draw();
  }
  const tick = () => frameStep(performance.now());
  if (hasGSAP) gsap.ticker.add(tick);
  else (function raf() { tick(); requestAnimationFrame(raf); })();

  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) { last = performance.now(); measure(); }
  }, { rootMargin: '80px 0px' }).observe(frame);

  /* ------------------------------------------------------------ arrival */

  if (!hasGSAP) return;
  gsap.registerPlugin(ScrollTrigger);
  const q = gsap.utils.selector(root);

  // the sheet opens out to the full width
  gsap.fromTo(frame, { clipPath: 'inset(7% 5% 7% 5%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: root, start: 'top bottom', end: 'top 20%', scrub: .6 },
  });

  gsap.set(q('.cta-line > span'), { yPercent: 115 });
  gsap.set(q('.cta-en, .cta-lead, .cta-readout, .cta-scale'), { opacity: 0, y: 16 });
  gsap.set(q('.cta-pin'), { scale: 0, opacity: 0 });
  gsap.set(q('.cta-xh'), { scaleX: 0 });
  gsap.set(q('.cta-xv'), { scaleY: 0 });

  gsap.timeline({ scrollTrigger: { trigger: frame, start: 'top 62%', once: true } })
    .to(q('.cta-xh'), { scaleX: 1, duration: 1.3, ease: 'power3.inOut' }, 0)
    .to(q('.cta-xv'), { scaleY: 1, duration: 1.3, ease: 'power3.inOut' }, .1)
    .to(q('.cta-pin'), { scale: 1, opacity: 1, duration: .9, ease: 'back.out(1.6)' }, .5)
    .to(st, { reveal: 1, duration: 2.4, ease: 'power2.out' }, .6)
    .to(q('.cta-line > span'), { yPercent: 0, duration: 1.1, stagger: .12, ease: 'expo.out' }, .4)
    .to(q('.cta-en, .cta-lead'), { opacity: 1, y: 0, duration: .9, stagger: .1, ease: 'power3.out' }, .9)
    .to(q('.cta-readout, .cta-scale'), { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, 1.4);
})();

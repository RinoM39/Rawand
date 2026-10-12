/* =====================================================================
   RAWAND — Team page (الفريق) · sheet A-05
   Three partners, each drawn as a line portrait on one of three structural axes:
     load   → axes are set out, then light construction lines (head oval, eye and shoulder lines,
              head-unit marks), then the three portraits are plotted line by line over them
     scroll → (pinned) the camera walks to each partner; a scan line inks her portrait in
              the brand tones and her card appears; then all three stand together again
     hover  → a lens shows the real photograph under the drawing
   Needs: js/team-data.js (generated from the photos), gsap + ScrollTrigger; the nav and smooth
   scroll come from js/site.js.
   Without GSAP, or with reduced motion, the page stays a plain list with the toned portraits.
   ===================================================================== */
(() => {
  'use strict';

  const DATA = window.RAWAND_TEAM;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;

  const root = $('#team');
  if (!root || !DATA || !hasGSAP || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ------------------------------------------------------------ the three figures, in head units (u) */

  const SPACING = 3.1;                 // distance between axes
  const AXIS_TOP = -1.05;              // the axes start above the heads
  const FADE = [4.2, 5.15];            // the drawings dissolve into the paper here
  const PENCIL = [158, 74, 82];        // --rw-500
  const INK = [91, 15, 26];            // --rw-900
  const EN = window.RW_LANG === 'en';
  const SMALL = Math.min(window.innerWidth, (window.screen && window.screen.width) || 9999) < 760;   // phones: the lighter images

  // stroke widths (css px) are drawn in a few steps, so each step is one canvas stroke
  const LEVELS = [.3, .42, .56, .72, .9, 1.1, 1.32, 1.56, 1.85];
  const level = w => {
    let k = 0;
    while (k < LEVELS.length - 1 && LEVELS[k + 1] <= w + .06) k++;
    return k;
  };
  // per kind: thickest / thinnest (css px) and how long the tapered ends are (head units)
  const PEN = {
    sil: w => ({ max: 1.75, min: .9, taper: .1 }),
    ftr: w => ({ max: .5 + .95 * w, min: .25, taper: .025 + .03 * w }),
    hat: () => ({ max: .72, min: .3, taper: .05 }),
  };
  // one pass of corner cutting: the stored polylines become smooth curves
  function chaikin(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      out.push([x0 * .75 + x1 * .25, y0 * .75 + y1 * .25], [x0 * .25 + x1 * .75, y0 * .25 + y1 * .75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function parsePaths(str, kind, toW, weights) {
    return (str ? str.split('|') : []).map((s, j) => {
      const pts = chaikin(s.split(' ').map(q => toW(q.split(',').map(Number))));
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const len = cum[cum.length - 1] || 1e-6;
      const pen = PEN[kind](weights ? weights[j] : 1);
      // each segment's width step: full in the middle, thinning to the ends
      const lv = new Uint8Array(Math.max(1, pts.length - 1));
      for (let k = 0; k < pts.length - 1; k++) {
        const m = (cum[k] + cum[k + 1]) / 2;
        const t = clamp(Math.min(m, len - m) / pen.taper, .3, 1);
        lv[k] = level(pen.min + (pen.max - pen.min) * t);
      }
      return { kind, pts, cum, len, lv };
    });
  }
  // when each path is drawn, as a slice of the figure's 0→1 draw progress
  function schedule(list, a, b, each) {
    list.forEach((p, k) => {
      const t0 = a + (b - a - each) * (list.length > 1 ? k / (list.length - 1) : 0);
      p.t0 = t0;
      p.t1 = t0 + each;
    });
  }

  const figs = DATA.map((d, i) => {
    const u = d.unit;
    const X = EN ? [-SPACING, 0, SPACING + .8][i] : (1 - i) * SPACING;   // ١ ٢ ٣ in reading order
    const toW = ([x, y]) => [X + (x - d.ax) / u, (y - d.top) / u];
    const ftrW = d.ftrW ? d.ftrW.split(',').map(v => Number(v) / 10) : null;
    const groups = { sil: parsePaths(d.sil, 'sil', toW), ftr: parsePaths(d.ftr, 'ftr', toW, ftrW), hat: parsePaths(d.hat, 'hat', toW) };
    // pupils, filled once the eyes are drawn
    const dots = (d.dot ? d.dot.split('|') : []).map(q => {
      const [x, y, r] = q.split(',').map(Number);
      const [wx, wy] = toW([x, y]);
      return { x: wx, y: wy, r: r / u };
    });
    // construction lines, in world units
    const c = d.con;
    const con = c && {
      head: { x: toW([c.head[0], 0])[0], y: toW([0, c.head[1]])[1], rx: c.head[2] / u, ry: c.head[3] / u, rot: c.head[4] * Math.PI / 180 },
      eye: [toW([c.eye[0], c.eye[1]]), toW([c.eye[2], c.eye[3]])],
      sh: [toW([c.sh[0], c.sh[1]]), toW([c.sh[2], c.sh[3]])],
    };
    schedule(groups.sil, 0, .5, .5);
    schedule(groups.ftr, .18, .86, .16);
    schedule(groups.hat, .5, 1, .12);
    const img = kind => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = mark;
      im.src = `assets/team/${kind}-${i + 1}${SMALL ? '-s' : ''}.webp?v=2`;
      return im;
    };
    return {
      X, groups, dots, con,
      lext: d.ax / u,
      rext: (d.w - d.ax) / u,
      box: { x: X - d.ax / u, y: -d.top / u, w: d.w / u, h: d.h / u },
      tone: img('tone'),
      photo: img('photo'),
    };
  });
  const scene = {
    x0: Math.min(...figs.map(f => f.X - f.lext)),
    x1: Math.max(...figs.map(f => f.X + f.rext)),
    y0: AXIS_TOP - .3,
    y1: FADE[1],
  };

  /* ------------------------------------------------------------ state */

  const st = {
    axes: 0, tags: 0, zoom: 0, focus: 0,
    draw: [0, 0, 0], con: [0, 0, 0], ink: [0, 0, 0], emph: [1, 1, 1], card: [0, 0, 0],
  };
  const lens = { a: 0, x: 0, y: 0, on: false, fig: -1 };
  const ptr = { x: 0, y: 0, in: false };
  let dirty = true;
  function mark() { dirty = true; }

  const nav = $('#nav');
  const stage = $('.team-stage', root);
  const canvas = $('#teamCanvas');
  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d');
  const head = $('.team-head', root);
  const cards = $$('.member-card', root);
  const names = cards.map(c => $('.member-name', c));
  const tags = cards.map((c, i) => {
    const t = document.createElement('div');
    t.className = 'member-tag';
    t.innerHTML = `<b></b><span></span>`;
    t.querySelector('b').textContent = $('.member-short', c).textContent.trim();
    t.querySelector('span').textContent = $('.member-tagline', c).textContent.trim();
    $('.team-tags', root).appendChild(t);
    return t;
  });

  root.classList.add('is-live');

  const view = { w: 1, h: 1, dpr: 1, top: 0, mobile: false };
  function resize() {
    view.w = stage.clientWidth;
    view.h = stage.clientHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.mobile = view.w < 760;
    view.top = head.offsetTop + head.offsetHeight;
    for (const c of [canvas, layer]) {
      c.width = Math.round(view.w * view.dpr);
      c.height = Math.round(view.h * view.dpr);
    }
    mark();
  }

  /* ------------------------------------------------------------ camera */

  const navH = () => nav.offsetHeight;
  // all three standing together, under the heading
  function camRest() {
    const top = view.top + (view.mobile ? 18 : 26);
    const bottom = view.h - (view.mobile ? 70 : 104);
    const S = Math.min(view.w * (view.mobile ? .96 : .9) / (scene.x1 - scene.x0), (bottom - top) / (scene.y1 - scene.y0));
    return { S, wx: (scene.x0 + scene.x1) / 2, wy: (scene.y0 + scene.y1) / 2, sx: view.w / 2, sy: (top + bottom) / 2 };
  }
  // one partner close up: on the left with her card on the right (phones: centred, card docked below)
  function camFocus(i) {
    const f = figs[i];
    const top = navH() + 14;
    if (view.mobile) {
      const S = Math.min((view.h - top) * .6 / (FADE[1] - scene.y0), view.w * .9 / (f.lext + f.rext));
      return { S, wx: f.X + (f.rext - f.lext) / 2, wy: scene.y0, sx: view.w / 2, sy: top + 6 };
    }
    const S = (view.h - top - 10) / (FADE[1] + .15 - scene.y0);
    return { S, wx: f.X, wy: scene.y0, sx: view.w * .34, sy: top };
  }
  const lerpCam = (a, b, t) => ({ S: mix(a.S, b.S, t), wx: mix(a.wx, b.wx, t), wy: mix(a.wy, b.wy, t), sx: mix(a.sx, b.sx, t), sy: mix(a.sy, b.sy, t) });
  function camera() {
    const rest = camRest();
    if (st.zoom <= 0) return finish(rest);
    const i0 = Math.floor(clamp(st.focus, 0, 2));
    const i1 = Math.min(2, i0 + 1);
    const near = lerpCam(camFocus(i0), camFocus(i1), st.focus - i0);
    return finish(lerpCam(rest, near, st.zoom));
  }
  // wx/wy is the world point drawn at screen sx/sy (rest: centre; focus: top edge)
  function finish(c) {
    c.toS = (x, y) => [c.sx + (x - c.wx) * c.S, c.sy + (y - c.wy) * c.S];
    c.toW = (x, y) => [c.wx + (x - c.sx) / c.S, c.wy + (y - c.sy) / c.S];
    return c;
  }

  /* ------------------------------------------------------------ drawing */

  // add the drawn part (0..t) of a path to the per-width paths
  function tracePart(bins, p, t) {
    const pts = p.pts;
    const stop = t * p.len;
    let cur = -1;
    for (let k = 0; k < pts.length - 1; k++) {
      if (p.cum[k] >= stop) break;
      const L = p.lv[k];
      const bin = bins[L] || (bins[L] = new Path2D());
      if (L !== cur) { bin.moveTo(pts[k][0], pts[k][1]); cur = L; }
      if (p.cum[k + 1] <= stop) bin.lineTo(pts[k + 1][0], pts[k + 1][1]);
      else {
        const s = (stop - p.cum[k]) / (p.cum[k + 1] - p.cum[k]);
        bin.lineTo(mix(pts[k][0], pts[k + 1][0], s), mix(pts[k][1], pts[k + 1][1], s));
      }
    }
  }

  // the architect's set-out: head oval, eye line, shoulder line, head-unit marks on the axis
  function drawConstruction(c, f, i, px) {
    const k = f.con;
    const t = st.con[i];
    const a = .5 * t * (1 - st.ink[i]) * (.25 + .75 * st.emph[i]) * (1 - .5 * st.draw[i]);   // steps back once the portrait is drawn
    if (!k || a <= .01) return;
    const seg = (t0, t1) => clamp((t - t0) / (t1 - t0));
    c.save();
    c.strokeStyle = rgba(PENCIL, a);
    c.fillStyle = rgba(PENCIL, a);
    c.lineWidth = .75 * px;
    c.beginPath();
    // head oval, drawn round from the top
    const h = k.head;
    const oh = seg(0, .45);
    if (oh > 0) {
      c.moveTo(h.x + h.ry * Math.sin(h.rot), h.y - h.ry * Math.cos(h.rot));
      c.ellipse(h.x, h.y, h.rx, h.ry, h.rot, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * oh);
    }
    // a line, run out past both ends, drawn from the axis outwards
    const line = ([x0, y0], [x1, y1], over, tt) => {
      if (tt <= 0) return;
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const ax = x0 - ux * over, ay = y0 - uy * over, bx = x1 + ux * over, by = y1 + uy * over;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      c.moveTo(mix(mx, ax, tt), mix(my, ay, tt));
      c.lineTo(mix(mx, bx, tt), mix(my, by, tt));
    };
    line(k.eye[0], k.eye[1], h.rx * .85, seg(.25, .6));
    line(k.sh[0], k.sh[1], .14, seg(.4, .85));
    // head units down the axis
    for (let u = 0; u <= 4; u++) {
      const tu = seg(.15 + u * .1, .3 + u * .1);
      if (tu <= 0) continue;
      const w = (u === 0 || u === 1 ? .16 : .1) * tu;
      c.moveTo(f.X - w, u);
      c.lineTo(f.X + w, u);
    }
    c.stroke();
    // shoulder joints
    const tj = seg(.8, 1);
    if (tj > 0) {
      c.beginPath();
      for (const [x, y] of k.sh) {
        c.moveTo(x + .04 * tj, y);
        c.arc(x, y, .04 * tj, 0, Math.PI * 2);
      }
      c.stroke();
    }
    c.restore();
  }

  const rgba = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

  function drawFigure(c, f, i, cam) {
    const e = .2 + .8 * st.emph[i];
    const ink = st.ink[i];
    const draw = st.draw[i];
    const px = 1 / cam.S;
    const b = f.box;

    drawConstruction(c, f, i, px);

    // the toned portrait, revealed under a scan line running down the sheet
    if (ink > 0 && f.tone.naturalWidth) {
      const scan = b.y + (b.h + .05) * ink;
      c.save();
      c.beginPath();
      c.rect(b.x - 1, b.y - 1, b.w + 2, scan - b.y + 1);
      c.clip();
      c.globalAlpha = e;
      c.drawImage(f.tone, b.x, b.y, b.w, b.h);
      c.restore();
      if (ink < 1) {
        c.globalAlpha = e * Math.sin(Math.PI * ink);
        c.strokeStyle = rgba(INK, 1);
        c.lineWidth = 1.4 * px;
        c.beginPath();
        c.moveTo(b.x + .1, scan);
        c.lineTo(b.x + b.w - .1, scan);
        c.stroke();
        c.lineWidth = px;
        c.beginPath();
        c.moveTo(b.x + .1, scan - .08); c.lineTo(b.x + .1, scan + .08);
        c.moveTo(b.x + b.w - .1, scan - .08); c.lineTo(b.x + b.w - .1, scan + .08);
        c.stroke();
        c.globalAlpha = 1;
      }
    }

    // the line drawing: pencil while sketched, burgundy ink once inked; hatching gives way to the tone
    const col = PENCIL.map((v, k) => mix(v, INK[k], ink));
    const kinds = [['sil', 1], ['ftr', 1 - .25 * ink], ['hat', .7 * (1 - .8 * ink)]];
    for (const [kind, a] of kinds) {
      if (a <= .01) continue;
      const bins = [];
      for (const p of f.groups[kind]) {
        const t = clamp((draw - p.t0) / (p.t1 - p.t0));
        if (t > 0) tracePart(bins, p, t);
      }
      c.strokeStyle = rgba(col, a * e);
      bins.forEach((path, L) => {
        if (!path) return;
        c.lineWidth = LEVELS[L] * px;
        c.stroke(path);
      });
    }
    // pupils
    const pd = clamp((draw - .5) / .12);
    if (pd > 0 && f.dots.length) {
      c.fillStyle = rgba(col, pd * e);
      c.beginPath();
      for (const d of f.dots) {
        c.moveTo(d.x + d.r, d.y);
        c.arc(d.x, d.y, d.r * (.4 + .6 * pd), 0, Math.PI * 2);
      }
      c.fill();
    }

    // the lens: inside it, the photograph
    if (lens.fig === i && lens.a > .01 && f.photo.naturalWidth) {
      const [wx, wy] = cam.toW(lens.x, lens.y);
      c.save();
      c.beginPath();
      c.arc(wx, wy, lens.r * lens.a / cam.S, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = '#F5F3F0';
      c.fill();
      c.drawImage(f.photo, b.x, b.y, b.w, b.h);
      c.restore();
    }
  }

  function render(cam) {
    const { w, h, dpr } = view;

    // structural axes, behind everything
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    // (the axis stops above the head and picks up again under the drawing — never across a face)
    figs.forEach((f, i) => {
      const a = clamp(st.axes * 1.2 - i * .1);
      if (a <= 0) return;
      const [x, ya] = cam.toS(f.X, AXIS_TOP + .25);
      const yb = cam.toS(f.X, -.14)[1];
      const yc = cam.toS(f.X, FADE[0] + .35)[1];
      const yd = cam.toS(f.X, FADE[1] + .35)[1];
      const reach = mix(ya, ya + (yb - ya) + (yd - yc), a);
      ctx.strokeStyle = rgba(PENCIL, .5 * (.4 + .6 * st.emph[i]));
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x, Math.min(reach, yb));
      if (reach > yb) {
        ctx.moveTo(x, yc);
        ctx.lineTo(x, yc + (reach - yb));
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // the portraits on their own layer, so they can dissolve into the paper at the bottom
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, layer.width, layer.height);
    lctx.setTransform(dpr * cam.S, 0, 0, dpr * cam.S, dpr * (cam.sx - cam.wx * cam.S), dpr * (cam.sy - cam.wy * cam.S));
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    lctx.imageSmoothingQuality = 'high';
    figs.forEach((f, i) => drawFigure(lctx, f, i, cam));
    lctx.globalCompositeOperation = 'destination-in';
    const g = lctx.createLinearGradient(0, FADE[0], 0, FADE[1]);
    g.addColorStop(0, '#000');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lctx.fillStyle = g;
    lctx.fillRect(-80, -80, 160, 160);
    lctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // a sheet of paper slides over the neighbours so the card reads cleanly (desktop)
    const veil = view.mobile ? 0 : st.zoom;
    if (veil > .01) {
      const x0 = w * .45;
      const x1 = w * .57;
      const vg = ctx.createLinearGradient(x0, 0, x1, 0);
      vg.addColorStop(0, 'rgba(245, 243, 240, 0)');
      vg.addColorStop(1, `rgba(245, 243, 240, ${.94 * veil})`);
      ctx.fillStyle = vg;
      ctx.fillRect(x0, 0, w - x0, h);
    }

    // leader line from the focused partner to her card (desktop)
    if (!view.mobile) {
      const sr = stage.getBoundingClientRect();
      figs.forEach((f, i) => {
        const t = st.card[i];
        if (t <= .01) return;
        const nr = names[i].getBoundingClientRect();
        const [x0, y0] = cam.toS(f.X + Math.min(f.rext - .4, 1.05), 1.5);
        const x2 = nr.left - sr.left - 22;
        const y2 = nr.top - sr.top + nr.height * .55;
        if (x2 - x0 < 40) return;
        const x1 = x0 + Math.min(Math.abs(y2 - y0), (x2 - x0) * .4);
        const seg = [[x0, y0], [x1, y2], [x2, y2]];
        const lens1 = Math.hypot(x1 - x0, y2 - y0);
        const total = lens1 + (x2 - x1);
        let left = total * t;
        ctx.strokeStyle = rgba(INK, .7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let k = 1; k < seg.length && left > 0; k++) {
          const L = Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
          const s = Math.min(1, left / L);
          ctx.lineTo(mix(seg[k - 1][0], seg[k][0], s), mix(seg[k - 1][1], seg[k][1], s));
          left -= L;
        }
        ctx.stroke();
        ctx.fillStyle = rgba(INK, t);
        ctx.beginPath();
        ctx.arc(x0, y0, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // lens ring + CAD ticks
    if (lens.a > .01) {
      const r = lens.r * lens.a;
      ctx.strokeStyle = rgba(INK, .85);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lens.x, lens.y, r, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(lens.x + dx * (r + 4), lens.y + dy * (r + 4));
        ctx.lineTo(lens.x + dx * (r + 12), lens.y + dy * (r + 12));
      }
      ctx.stroke();
    }

    // name tags under the figures while they all stand together
    const ta = st.tags * (1 - st.zoom);
    figs.forEach((f, i) => {
      const [x, y] = cam.toS(f.X, 4.85);
      tags[i].style.opacity = ta * (.45 + .55 * st.emph[i]);
      tags[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
    });
  }

  /* ------------------------------------------------------------ pointer lens (mouse only) */

  if (finePointer) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      ptr.in = true;
      mark();
    });
    stage.addEventListener('pointerleave', () => { ptr.in = false; mark(); });
  }
  function updateLens(cam) {
    let hit = -1;
    if (ptr.in && !ptr.overUI) {
      const [wx, wy] = cam.toW(ptr.x, ptr.y);
      figs.forEach((f, i) => {
        if (st.draw[i] > .6 && wy > -.25 && wy < FADE[0] && wx > f.box.x + .2 && wx < f.box.x + f.box.w - .2) hit = i;
      });
    }
    if (hit >= 0) lens.fig = hit;
    lens.r = view.mobile ? 56 : 74;
    const target = hit >= 0 ? 1 : 0;
    lens.a += (target - lens.a) * .18;
    lens.x += (ptr.x - lens.x) * .35;
    lens.y += (ptr.y - lens.y) * .35;
    if (Math.abs(target - lens.a) < .002) lens.a = target;
    if (lens.a === 0) lens.fig = -1;
    root.classList.toggle('is-lens', hit >= 0);
    return lens.a !== target || Math.hypot(ptr.x - lens.x, ptr.y - lens.y) > .3;
  }

  /* ------------------------------------------------------------ timelines */

  // on load: set out the axes and the construction lines, then plot the three portraits over them
  gsap.set(cards, { autoAlpha: 0, y: 16 });
  const arrived = document.documentElement.dataset.arrive === '1';
  // (arriving through the page transition the drawing starts early: it shows through the logo window)
  gsap.timeline({ delay: arrived ? .45 : .25, onUpdate: mark })
    .from($$('.sheet-rule', root), { scaleX: 0, duration: 1.3, ease: 'power3.inOut' }, 0)
    .from($$('.sheet-label', root), { opacity: 0, y: 14, duration: .9, ease: 'power3.out' }, .1)
    .to(st, { axes: 1, duration: 1.3, ease: 'power2.inOut' }, .2)
    .to(st.con, { 0: 1, duration: 1.5, ease: 'power1.inOut' }, .55)
    .to(st.con, { 1: 1, duration: 1.5, ease: 'power1.inOut' }, .75)
    .to(st.con, { 2: 1, duration: 1.5, ease: 'power1.inOut' }, .95)
    .to(st.draw, { 0: 1, duration: 3.4, ease: 'power1.inOut' }, 1.35)
    .to(st.draw, { 1: 1, duration: 3.4, ease: 'power1.inOut' }, 1.7)
    .to(st.draw, { 2: 1, duration: 3.4, ease: 'power1.inOut' }, 2.05)
    .to(st, { tags: 1, duration: .9, ease: 'power1.out' }, 4.2)
    .to('.team-scroll > *', { opacity: 1, duration: .8 }, 4.6);

  // on scroll: walk from one partner to the next, inking each one, then all three together
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    onUpdate: mark,
    scrollTrigger: { trigger: stage, start: 'top top', end: '+=420%', pin: true, scrub: 1, anticipatePin: 1 },
  });
  tl.to('.team-scroll', { autoAlpha: 0, duration: .04, ease: 'none' }, 0)
    .to(head, { autoAlpha: 0, y: -18, duration: .06 }, .02)
    .to(st, { zoom: 1, duration: .1 }, .04);
  const step = (i, at) => {
    tl.to(st, { focus: i, duration: .1 }, at)
      .to(st.emph, { 0: i === 0 ? 1 : .16, 1: i === 1 ? 1 : .16, 2: i === 2 ? 1 : .16, duration: .08 }, at)
      .to(st.ink, { [i]: 1, duration: .13, ease: 'power1.inOut' }, at + .04)
      .to(cards[i], { autoAlpha: 1, y: 0, duration: .06, ease: 'power2.out' }, at + .09)
      .to(st.card, { [i]: 1, duration: .07, ease: 'power1.inOut' }, at + .1);
    if (i > 0) {
      tl.to(cards[i - 1], { autoAlpha: 0, y: -16, duration: .04, ease: 'power1.in' }, at)
        .to(st.card, { [i - 1]: 0, duration: .03, ease: 'none' }, at);
    }
  };
  step(0, .04);
  step(1, .3);
  step(2, .56);
  tl.to(cards[2], { autoAlpha: 0, y: -16, duration: .04, ease: 'power1.in' }, .8)
    .to(st.card, { 2: 0, duration: .03, ease: 'none' }, .8)
    .to(st, { zoom: 0, duration: .1 }, .81)
    .to(st.emph, { 0: 1, 1: 1, 2: 1, duration: .08 }, .83)
    .to(head, { autoAlpha: 1, y: 0, duration: .06 }, .87)
    .to({}, { duration: .07 }, .93);

  // cards are over the canvas: no lens while the pointer is on one
  cards.forEach(c => {
    c.style.pointerEvents = 'auto';
    c.addEventListener('pointerenter', () => { ptr.overUI = true; mark(); });
    c.addEventListener('pointerleave', () => { ptr.overUI = false; mark(); });
  });

  // the partners' sheets: each title block is ruled in, then its rows fill
  $$('.profile').forEach((pf, i) => {
    gsap.timeline({ scrollTrigger: { trigger: pf, start: 'top 86%' }, delay: i * .12 })
      .from(pf, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'power3.inOut', clearProps: 'clipPath' })
      .from(pf.querySelectorAll('.profile-head > *'), { opacity: 0, y: 12, duration: .6, stagger: .08, ease: 'power3.out' }, .45)
      .from(pf.querySelectorAll('.profile-row'), { opacity: 0, x: EN ? -14 : 14, duration: .6, stagger: .08, ease: 'power3.out' }, .6);
  });

  /* ------------------------------------------------------------ loop */

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) mark(); }).observe(stage);
  new ResizeObserver(resize).observe(stage);
  resize();
  if (document.fonts) document.fonts.ready.then(() => { resize(); ScrollTrigger.refresh(); });

  gsap.ticker.add(() => {
    if (!visible) return;
    const cam = camera();
    if (finePointer && updateLens(cam)) dirty = true;
    if (!dirty) return;
    dirty = false;
    render(cam);
  });
})();

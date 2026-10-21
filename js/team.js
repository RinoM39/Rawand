/* =====================================================================
   RAWAND — Team page (الفريق) · sheet A-05
   Three partners, each drawn as an ink portrait on one of three structural axes:
     load   → axes are set out, then light construction lines (head oval, eye and shoulder lines,
              head-unit marks), then each portrait is plotted over them — outline and folds in pen,
              the face feature by feature (brows, eyes, nose, mouth) — and its wash soaks in from the face
     scroll → (pinned) the camera closes in on each partner's head and shoulders; a scan line turns her
              drawing into her photograph in the brand tones and her card appears; then all three
              stand together again
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
  const REST = [124, 42, 52];          // between the two: the drawing at rest
  const EN = window.RW_LANG === 'en';
  const SMALL = Math.min(window.innerWidth, (window.screen && window.screen.width) || 9999) < 760;   // phones: the lighter images

  // pen widths (css px at the resting scale), one step per digit in the data; each step is one canvas stroke
  const LEVELS = [.26, .34, .44, .56, .7, .86, 1.04, 1.24, 1.48, 1.78];
  const S_REF = 110;                   // px per head unit at which the pen widths are set
  // fine detail (brow hairs, lid creases, hatching) comes in as the camera closes in
  const LOD = [150, 240];
  const smooth01 = t => t * t * (3 - 2 * t);
  // one pass of corner cutting: the stored polylines become smooth curves (a width rides along as a 3rd value)
  function chaikin(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      out.push(a.map((v, j) => v * .75 + b[j] * .25), a.map((v, j) => v * .25 + b[j] * .75));
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // pen paths: per-point width steps (digits) or one fixed step, tapered at the ends
  function parsePen(str, wstr, toW, fixed) {
    const ws = wstr ? wstr.split('|') : null;
    return (str ? str.split('|') : []).map((s, j) => {
      const raw = s.split(' ').map((q, k) => {
        const [x, y] = toW(q.split(',').map(Number));
        return [x, y, ws ? Number(ws[j][k] || 0) : fixed];
      });
      const pts = chaikin(raw);
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const len = cum[cum.length - 1] || 1e-6;
      const lv = new Uint8Array(Math.max(1, pts.length - 1));
      for (let k = 0; k < pts.length - 1; k++) {
        let w = (pts[k][2] + pts[k + 1][2]) / 2;
        if (!ws) {
          const m = (cum[k] + cum[k + 1]) / 2;
          w *= clamp(Math.min(m, len - m) / .05, .3, 1);
        }
        lv[k] = Math.max(0, Math.min(9, Math.round(w)));
      }
      return { pts, cum, len, lv };
    });
  }
  // face features: strokes with an anatomical thickness (head units), fills, circles, brow hairs
  function parseFace(F, toW, u) {
    const P = flat => { const out = []; for (let k = 0; k < flat.length; k += 2) out.push(toW([flat[k], flat[k + 1]])); return out; };
    const clips = F.c.map(c => { const p = new Path2D(); P(c).forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; });
    const strokes = F.s.map(([flat, th, a, d, clip, ord]) => {
      const pts = P(flat);
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      return { pts, th: th.map(v => v / 10 / u), cum, len: cum[cum.length - 1] || 1e-6, a: a / 100, d, clip, ord };
    });
    const fills = F.f.map(([flat, a, d, clip, cut, ord]) => {
      const p = new Path2D();
      P(flat).forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
      return { p, a: a / 100, d, clip, cut, ord };
    });
    const circles = F.o.map(([cx, cy, r, a, d, clip, kind, w, ord]) => {
      const [x, y] = toW([cx, cy]);
      return { x, y, r: r / u, a: a / 100, d, clip, kind, w: w / 10 / u, ord };
    });
    const hairs = [];
    for (let k = 0; k < F.h.length; k += 5) {
      const [x0, y0] = toW([F.h[k], F.h[k + 1]]);
      const [x1, y1] = toW([F.h[k + 2], F.h[k + 3]]);
      hairs.push({ x0, y0, x1, y1, a: F.h[k + 4] / 100 });
    }
    return { strokes, fills, circles, hairs, clips };
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
    const groups = { sil: parsePen(d.sil, d.silW, toW), lin: parsePen(d.lin, d.linW, toW), hat: parsePen(d.hat, null, toW, 1.4) };
    const face = parseFace(d.face, toW, u);
    // construction lines, in world units
    const c = d.con;
    const con = c && {
      head: { x: toW([c.head[0], 0])[0], y: toW([0, c.head[1]])[1], rx: c.head[2] / u, ry: c.head[3] / u, rot: c.head[4] * Math.PI / 180 },
      eye: [toW([c.eye[0], c.eye[1]]), toW([c.eye[2], c.eye[3]])],
      sh: [toW([c.sh[0], c.sh[1]]), toW([c.sh[2], c.sh[3]])],
    };
    schedule(groups.sil, 0, .45, .45);
    schedule(groups.lin, .1, .8, .14);
    schedule(groups.hat, 0, 1, .2);
    const img = kind => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = mark;
      im.src = `assets/team/${kind}-${i + 1}${SMALL ? '-s' : ''}.webp?v=3`;
      return im;
    };
    // where the head is (the wash soaks outwards from the face)
    const hc = toW([c.head[0], c.head[1]]);
    return {
      X, groups, face, con, hc,
      lext: d.ax / u,
      rext: (d.w - d.ax) / u,
      box: { x: X - d.ax / u, y: -d.top / u, w: d.w / u, h: d.h / u },
      wash: img('wash'),
      photo: null,           // the lens photograph: fetched on the first mouse move (js below)
    };
  });
  let toneAsked = false;
  function loadTones() {
    if (toneAsked) return;
    toneAsked = true;
    figs.forEach((f, i) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = mark;
      im.src = `assets/team/tone-${i + 1}${SMALL ? '-s' : ''}.webp?v=3`;
      f.tone = im;
    });
  }
  const scene = {
    x0: Math.min(...figs.map(f => f.X - f.lext)),
    x1: Math.max(...figs.map(f => f.X + f.rext)),
    y0: AXIS_TOP - .3,
    y1: FADE[1],
  };

  /* ------------------------------------------------------------ state */

  const st = {
    axes: 0, tags: 0, zoom: 0, focus: 0,
    draw: [0, 0, 0], con: [0, 0, 0], wash: [0, 0, 0], ink: [0, 0, 0], emph: [1, 1, 1], card: [0, 0, 0],
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
  // one partner close up, head and shoulders: on the left with her card on the right
  // (phones: centred, card docked below)
  const FOCUS = [-.38, 2.45];          // the world band (head units) the close-up shows
  function camFocus(i) {
    const f = figs[i];
    const top = navH() + 14;
    if (view.mobile) {
      const S = Math.min((view.h - top) * .56 / (FOCUS[1] - FOCUS[0]), view.w * .94 / 2.5);
      return { S, wx: f.X, wy: FOCUS[0], sx: view.w / 2, sy: top + 4 };
    }
    const S = (view.h - top - 6) / (FOCUS[1] - FOCUS[0]);
    return { S, wx: f.X, wy: FOCUS[0], sx: view.w * .31, sy: top };
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
    const a = .5 * t * (1 - st.ink[i]) * (.25 + .75 * st.emph[i]) * (1 - .65 * st.draw[i]) * (1 - .8 * st.wash[i]);   // steps back once the portrait is drawn
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

  // the wash soaks into the paper from the face outwards: drawn on a sheet of its own, kept inside a soft disc
  const soak = document.createElement('canvas');
  const sctx = soak.getContext('2d');
  function drawWash(c, f, i, a) {
    const w = st.wash[i];
    if (w <= 0 || a <= .01 || !f.wash.naturalWidth) return;
    const b = f.box;
    if (w >= 1) {
      c.globalAlpha = a;
      c.drawImage(f.wash, b.x, b.y, b.w, b.h);
      c.globalAlpha = 1;
      return;
    }
    // the figure's box on the canvas, in device pixels: the soak sheet is only that big
    const T = c.getTransform();
    const rx = Math.max(0, Math.floor(T.a * (b.x - 1) + T.e));
    const ry = Math.max(0, Math.floor(T.d * (b.y - 1) + T.f));
    const rw = Math.min(c.canvas.width, Math.ceil(T.a * (b.x + b.w + 1) + T.e)) - rx;
    const rh = Math.min(c.canvas.height, Math.ceil(T.d * (b.y + b.h + 1) + T.f)) - ry;
    if (rw <= 0 || rh <= 0) return;
    if (soak.width < rw || soak.height < rh) {
      soak.width = Math.max(soak.width, rw);
      soak.height = Math.max(soak.height, rh);
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, rw, rh);
    sctx.setTransform(T.a, T.b, T.c, T.d, T.e - rx, T.f - ry);
    sctx.globalAlpha = a * (.4 + .6 * w);
    sctx.drawImage(f.wash, b.x, b.y, b.w, b.h);
    sctx.globalAlpha = 1;
    const R = .15 + 4.8 * smooth01(w);
    const g = sctx.createRadialGradient(f.hc[0], f.hc[1], R * .5, f.hc[0], f.hc[1], R);
    g.addColorStop(0, '#000');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.globalCompositeOperation = 'destination-in';
    sctx.fillStyle = g;
    sctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    sctx.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(soak, 0, 0, rw, rh, rx, ry, rw, rh);
    c.restore();
  }

  // pen paths: the drawn part of each, batched by width step
  function drawPen(c, list, prog, col, a, px, zf) {
    if (a <= .01) return;
    // paths that are fully drawn join the group's kept paths once; only the ones still being drawn are
    // traced again each frame (widths are set at stroke time, so the kept paths serve any zoom)
    const acc = list.acc || (list.acc = { bins: [], done: new Uint8Array(list.length), left: list.length });
    let live = null;
    if (acc.left) {
      live = [];
      for (let k = 0; k < list.length; k++) {
        if (acc.done[k]) continue;
        const t = prog(list[k]);
        if (t >= 1) {
          tracePart(acc.bins, list[k], 1);
          acc.done[k] = 1;
          acc.left--;
        } else if (t > 0) tracePart(live, list[k], t);
      }
    }
    c.strokeStyle = rgba(col, Math.min(1, a));
    for (const bins of live ? [acc.bins, live] : [acc.bins]) {
      bins.forEach((path, L) => {
        if (!path) return;
        c.lineWidth = LEVELS[L] * px * zf;
        c.stroke(path);
      });
    }
  }

  // a stroke with a thickness: the outline of its drawn part (0..t), with round ends
  function strokeOutline(path, s, t, minW) {
    const { pts, th, cum } = s;
    const stop = t * s.len;
    const Q = [];
    const W = [];
    for (let k = 0; k < pts.length; k++) {
      if (cum[k] <= stop) {
        Q.push(pts[k]);
        W.push(Math.max(th[k], minW));
      } else {
        const f = (stop - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
        Q.push([mix(pts[k - 1][0], pts[k][0], f), mix(pts[k - 1][1], pts[k][1], f)]);
        W.push(Math.max(mix(th[k - 1], th[k], f), minW));
        break;
      }
    }
    const m = Q.length;
    if (m < 2) return;
    const nx = new Float32Array(m);
    const ny = new Float32Array(m);
    for (let k = 0; k < m; k++) {
      const p = Q[Math.max(0, k - 1)];
      const q = Q[Math.min(m - 1, k + 1)];
      const tx = q[0] - p[0];
      const ty = q[1] - p[1];
      const l = Math.hypot(tx, ty) || 1;
      nx[k] = -ty / l * W[k] / 2;
      ny[k] = tx / l * W[k] / 2;
    }
    path.moveTo(Q[0][0] + nx[0], Q[0][1] + ny[0]);
    for (let k = 1; k < m; k++) path.lineTo(Q[k][0] + nx[k], Q[k][1] + ny[k]);
    const a1 = Math.atan2(ny[m - 1], nx[m - 1]);
    path.arc(Q[m - 1][0], Q[m - 1][1], W[m - 1] / 2, a1, a1 - Math.PI, true);
    for (let k = m - 1; k >= 0; k--) path.lineTo(Q[k][0] - nx[k], Q[k][1] - ny[k]);
    const a0 = Math.atan2(ny[0], nx[0]);
    path.arc(Q[0][0], Q[0][1], W[0] / 2, a0 + Math.PI, a0, true);
    path.closePath();
  }

  // the face: brows, eyes, nose, mouth — drawn feature by feature over the outline
  const FACE_T0 = .42;
  const FACE_STEP = .042;
  const FACE_DUR = .15;
  const HAIR_W = .5 / 360;
  function drawFace(c, f, col, e, draw, px, lod) {
    const F = f.face;
    const prog = ord => clamp((draw - (FACE_T0 + ord * FACE_STEP)) / FACE_DUR);
    const appear = ord => smooth01(clamp((draw - (FACE_T0 + ord * FACE_STEP + FACE_DUR * .45)) / .1));
    // tones: brow bodies (fuller while the hairs are too small to see), lips, nostrils, lid shadow
    for (const fl of F.fills) {
      if (fl.cut) continue;
      const a = fl.a * appear(fl.ord) * (fl.d ? lod : 1) * e * (fl.ord === 0 ? 1 + .45 * (1 - lod) : 1);
      if (a <= .005) continue;
      c.fillStyle = rgba(col, Math.min(1, a));
      if (fl.clip >= 0) {
        c.save();
        c.clip(F.clips[fl.clip]);
        c.fill(fl.p);
        c.restore();
      } else c.fill(fl.p);
    }
    // iris, pupil, rim (inside the eye opening)
    for (const o of F.circles) {
      if (o.kind === 3) continue;
      const a = o.a * appear(o.ord) * e;
      if (a <= .005) continue;
      c.save();
      if (o.clip >= 0) c.clip(F.clips[o.clip]);
      c.beginPath();
      c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      if (o.kind === 1) {
        c.fillStyle = rgba(col, a);
        c.fill();
      } else {
        c.strokeStyle = rgba(col, a);
        c.lineWidth = Math.max(o.w, .3 * px);
        c.stroke();
      }
      c.restore();
    }
    // strokes, batched by alpha, and the brow hairs (close up only: thin wedges from the root);
    // once the face is fully drawn they are built again only when the scale or the detail level changes
    const done = draw >= 1;
    let cache = done && F.cache && F.cache.px === px && F.cache.lod === lod ? F.cache : null;
    if (!cache) {
      const buckets = new Map();
      for (const s of F.strokes) {
        const t = prog(s.ord);
        if (t <= 0) continue;
        const a = s.a * (s.d ? lod : 1);
        if (a <= .01) continue;
        const key = Math.round(a * 20);
        let p = buckets.get(key);
        if (!p) buckets.set(key, (p = new Path2D()));
        strokeOutline(p, s, t, (s.d ? .3 : .4) * px);
      }
      let hb = null;
      const th = prog(1);
      if (lod > .01 && th > 0) {
        const n = Math.floor(F.hairs.length * th);
        hb = [new Path2D(), new Path2D(), new Path2D()];
        const w = Math.max(HAIR_W, .3 * px) / 2;
        for (let k = 0; k < n; k++) {
          const h = F.hairs[k];
          const dx = h.x1 - h.x0;
          const dy = h.y1 - h.y0;
          const l = Math.hypot(dx, dy) || 1;
          const ox = -dy / l * w;
          const oy = dx / l * w;
          const p = hb[h.a > .75 ? 2 : h.a > .5 ? 1 : 0];
          p.moveTo(h.x0 + ox, h.y0 + oy);
          p.lineTo(h.x1, h.y1);
          p.lineTo(h.x0 - ox, h.y0 - oy);
          p.closePath();
        }
      }
      cache = { px, lod, buckets, hb };
      if (done) F.cache = cache;
    }
    cache.buckets.forEach((p, key) => {
      c.fillStyle = rgba(col, Math.min(1, key / 20 * e));
      c.fill(p);
    });
    if (cache.hb) {
      cache.hb.forEach((p, k) => {
        c.fillStyle = rgba(col, [.5, .7, .9][k] * lod * e);
        c.fill(p);
      });
    }
    // catch-lights: back to paper
    c.save();
    c.globalCompositeOperation = 'destination-out';
    for (const o of F.circles) {
      if (o.kind !== 3) continue;
      const a = appear(o.ord);
      if (a <= 0) continue;
      c.fillStyle = `rgba(0, 0, 0, ${a})`;
      c.beginPath();
      c.arc(o.x, o.y, Math.max(o.r, .55 * px), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function drawFigure(c, f, i, cam) {
    const e = .2 + .8 * st.emph[i];
    const ink = st.ink[i];
    const draw = st.draw[i];
    const px = 1 / cam.S;
    const zf = clamp(Math.pow(cam.S / S_REF, .3), .6, 1.6);
    const lod = smooth01(clamp((cam.S - LOD[0]) / (LOD[1] - LOD[0])));
    const b = f.box;

    drawConstruction(c, f, i, px);

    // wash → hatching → pen lines → face; resting in a soft burgundy, deep ink once inked
    const prog = p => clamp((draw - p.t0) / (p.t1 - p.t0));
    const hp = clamp(st.wash[i] * 1.6 - .6);
    const paint = (col, wa) => {
      drawWash(c, f, i, wa * e);
      drawPen(c, f.groups.hat, p => clamp((hp - p.t0) / (p.t1 - p.t0)), col, .5 * lod * e, px, zf);
      drawPen(c, f.groups.sil, prog, col, e, px, zf);
      drawPen(c, f.groups.lin, prog, col, .92 * e, px, zf);
      // the face is inked a shade deeper than the rest: eyes, brows and mouth carry the likeness
      drawFace(c, f, col.map((v, k) => mix(v, INK[k], .55)), e, draw, px, lod);
    };
    // inked: the photograph in the brand tones, the pen outline and folds over it
    const inked = () => {
      if (!f.tone || !f.tone.naturalWidth) return paint(INK, 1);
      c.globalAlpha = e;
      c.drawImage(f.tone, b.x, b.y, b.w, b.h);
      c.globalAlpha = 1;
      drawPen(c, f.groups.sil, prog, INK, e, px, zf);
      drawPen(c, f.groups.lin, prog, INK, .6 * e, px, zf);
    };
    if (ink <= 0) paint(REST, .85);
    else if (ink >= 1) inked();
    else {
      // the scan line runs down the sheet, inking what it has passed
      const scan = b.y + (b.h + .05) * ink;
      c.save();
      c.beginPath();
      c.rect(b.x - 1, scan, b.w + 2, b.h + 2);
      c.clip();
      paint(REST, .85);
      c.restore();
      c.save();
      c.beginPath();
      c.rect(b.x - 1, b.y - 1, b.w + 2, scan - b.y + 1);
      c.clip();
      inked();
      c.restore();
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

    // the lens: inside it, the photograph
    if (lens.fig === i && lens.a > .01 && f.photo && f.photo.naturalWidth) {
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
    const fade = [mix(FADE[0], FOCUS[1] - .62, st.zoom), mix(FADE[1], FOCUS[1] - .02, st.zoom)];

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
      const yc = cam.toS(f.X, fade[0] + .35)[1];
      const yd = cam.toS(f.X, fade[1] + .35)[1];
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
    const g = lctx.createLinearGradient(0, fade[0], 0, fade[1]);
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
    const loadPhotos = () => DATA.forEach((d, i) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = mark;
      im.src = `assets/team/photo-${i + 1}${SMALL ? '-s' : ''}.webp?v=3`;
      figs[i].photo = im;
    });
    stage.addEventListener('pointermove', loadPhotos, { once: true });
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
    .to(st.wash, { 0: 1, duration: 2.4, ease: 'power1.inOut' }, 3.9)
    .to(st.wash, { 1: 1, duration: 2.4, ease: 'power1.inOut' }, 4.25)
    .to(st.wash, { 2: 1, duration: 2.4, ease: 'power1.inOut' }, 4.6)
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

  setTimeout(loadTones, 2500);
  window.addEventListener('scroll', loadTones, { once: true, passive: true });

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

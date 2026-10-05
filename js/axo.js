/* =====================================================================
   RAWAND — Exploded axonometric line drawing (canvas 2D, orthographic)
   One building, three layers — one per partner:
     0  الهيكل الإنشائي  (الوظيفة)
     1  الواجهة          (الجمال)
     2  السطح الأخضر     (الاستدامة)
   Usage: const axo = RawandAxo.create(canvas, layoutFn); axo.st.draw = …; axo.render(time);
   ===================================================================== */
window.RawandAxo = (() => {
  'use strict';

  const DEG = Math.PI / 180;
  const INK = '91, 15, 26';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------ model */
  // 1 unit ≈ 3 m. Origin = centre of the ground floor.
  const W = 10, D = 7, FH = 1, FLOORS = 6, H = FH * FLOORS;
  const LIFT = [0, H + 2, H + 4];                 // how far each layer rises when exploded
  const YAW = 34 * DEG, PITCH = 26 * DEG;     // resting camera
  const SCHED = [[0, .58], [.26, .86], [.55, 1]]; // when each layer is drawn (0..1 of the draw)
  const SEG_T = .16;                          // how long one line takes to draw

  const segs = [];
  const trees = [];
  const count = [0, 0, 0];

  const add = (L, a, b, o = {}) => segs.push({
    L, a, b, k: count[L]++,
    w: o.w || 1, al: o.al == null ? 1 : o.al, dash: !!o.dash, n: o.n || null,
  });
  const rect = (L, y, x0, x1, z0, z1, o) => {
    add(L, [x0, y, z0], [x1, y, z0], o);
    add(L, [x1, y, z0], [x1, y, z1], o);
    add(L, [x1, y, z1], [x0, y, z1], o);
    add(L, [x0, y, z1], [x0, y, z0], o);
  };
  const corners = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

  // 0 — structure: site, slabs, columns, core
  rect(0, 0, -8.5, 8.5, -6, 6, { dash: true, al: .4 });
  for (let f = 0; f <= FLOORS; f++) {
    rect(0, f * FH, -W / 2, W / 2, -D / 2, D / 2, { w: 1.25 });
    if (f) rect(0, f * FH - .14, -W / 2, W / 2, -D / 2, D / 2, { al: .45 });
  }
  [-W / 2 + .5, -1.7, 1.7, W / 2 - .5].forEach(x =>
    [-D / 2 + .5, 0, D / 2 - .5].forEach(z => add(0, [x, 0, z], [x, H, z], { al: .7, w: .9 })));
  const core = { x0: -1.2, x1: 1.2, z0: -D / 2 + .5, z1: -D / 2 + 2.3, top: H + .8 };
  corners(core.x0, core.x1, core.z0, core.z1).forEach(([x, z]) => add(0, [x, 0, z], [x, core.top, z]));
  rect(0, core.top, core.x0, core.x1, core.z0, core.z1);

  // 1 — facade: ground-floor glazing + a skin of fins whose depth ripples like a leaf's edge
  const faces = [
    { n: [0, 0, 1], o: [-W / 2, D / 2], t: [1, 0], len: W, ph: 0 },
    { n: [1, 0, 0], o: [W / 2, D / 2], t: [0, -1], len: D, ph: 1.3 },
    { n: [0, 0, -1], o: [W / 2, -D / 2], t: [-1, 0], len: W, ph: 2.1 },
    { n: [-1, 0, 0], o: [-W / 2, -D / 2], t: [0, 1], len: D, ph: .7 },
  ];
  faces.forEach(f => {
    const at = (u, d = 0) => [f.o[0] + f.t[0] * u + f.n[0] * d, f.o[1] + f.t[1] * u + f.n[2] * d];
    for (let u = 0; u <= f.len + 1e-6; u += 1.25) {
      const [x, z] = at(u);
      add(1, [x, 0, z], [x, FH, z], { n: f.n, al: .55, w: .85 });
    }
    let prev = null;
    for (let u = .25; u < f.len; u += .5) {
      const d = .14 + .3 * (.5 + .5 * Math.sin(u * .78 + f.ph));
      const [xi, zi] = at(u);
      const [xo, zo] = at(u, d);
      add(1, [xo, FH, zo], [xo, H, zo], { n: f.n, al: .85, w: .85 });
      add(1, [xi, H, zi], [xo, H, zo], { n: f.n, al: .6, w: .8 });
      add(1, [xi, FH, zi], [xo, FH, zo], { n: f.n, al: .45, w: .8 });
      if (prev) add(1, [prev[0], H, prev[1]], [xo, H, zo], { n: f.n, al: .9 });
      prev = [xo, zo];
    }
    const [ax, az] = at(0), [bx, bz] = at(f.len);
    add(1, [ax, H, az], [bx, H, bz], { n: f.n, al: .4 });
    add(1, [ax, FH, az], [bx, FH, bz], { n: f.n, al: .4 });
  });
  // entrance canopy (front)
  [-2, 2].forEach(x => add(1, [x, 0, D / 2 + 1.3], [x, FH, D / 2 + 1.3], { w: .9 }));
  add(1, [-2, FH, D / 2], [-2, FH, D / 2 + 1.3]);
  add(1, [-2, FH, D / 2 + 1.3], [2, FH, D / 2 + 1.3], { w: 1.25 });
  add(1, [2, FH, D / 2 + 1.3], [2, FH, D / 2]);

  // 2 — roof: parapet, solar panels, pergola, planter with three trees
  const R = H;
  rect(2, R, -W / 2, W / 2, -D / 2, D / 2, { al: .45 });
  corners(-W / 2, W / 2, -D / 2, D / 2).forEach(([x, z]) => add(2, [x, R, z], [x, R + .4, z]));
  rect(2, R + .4, -W / 2, W / 2, -D / 2, D / 2, { w: 1.2 });
  for (let i = 0; i < 3; i++) {
    const x0 = -4.6 + i * 1.15, x1 = x0 + .95, zf = -1.3, zb = -3.1;
    add(2, [x0, R + .15, zf], [x1, R + .15, zf]);
    add(2, [x1, R + .15, zf], [x1, R + .7, zb]);
    add(2, [x1, R + .7, zb], [x0, R + .7, zb]);
    add(2, [x0, R + .7, zb], [x0, R + .15, zf]);
    add(2, [(x0 + x1) / 2, R + .15, zf], [(x0 + x1) / 2, R + .7, zb], { al: .45, w: .8 });
  }
  const pg = { x0: -4.6, x1: -.2, z0: -.6, z1: 3, y: R + 1.15 };
  corners(pg.x0, pg.x1, pg.z0, pg.z1).forEach(([x, z]) => add(2, [x, R, z], [x, pg.y, z]));
  add(2, [pg.x0, pg.y, pg.z0], [pg.x1, pg.y, pg.z0]);
  add(2, [pg.x0, pg.y, pg.z1], [pg.x1, pg.y, pg.z1]);
  for (let x = pg.x0; x <= pg.x1 + 1e-6; x += .4) add(2, [x, pg.y + .06, pg.z0 - .3], [x, pg.y + .06, pg.z1 + .3], { al: .75, w: .85 });
  const pl = { x0: 1.6, x1: 4.6, z0: -3, z1: 3, h: .35 };
  corners(pl.x0, pl.x1, pl.z0, pl.z1).forEach(([x, z]) => add(2, [x, R, z], [x, R + pl.h, z], { al: .6 }));
  rect(2, R + pl.h, pl.x0, pl.x1, pl.z0, pl.z1);
  [[3.1, -1.9, 1.5, -.14], [3.1, .05, 1.2, .1], [3.1, 1.95, 1.35, -.05]].forEach(([x, z, h, tilt], i) => {
    const y0 = R + pl.h, y1 = y0 + h * .34;
    add(2, [x, y0, z], [x, y1, z], { w: 1.1 });
    trees.push({ x, z, y: y1, h, tilt, seg: segs[segs.length - 1], i });
  });

  // draw timing: each layer has a window, lines inside it start one after another
  segs.forEach(s => {
    const [s0, s1] = SCHED[s.L];
    const r = count[s.L] > 1 ? s.k / (count[s.L] - 1) : 0;
    s.t0 = s0 + (s1 - s0 - SEG_T) * r;
    s.t1 = s.t0 + SEG_T;
  });

  // the brand leaf, unit height, pointing up
  const LEAF = new Path2D('M0 0C.34 -.16 .36 -.64 0 -1C-.36 -.64 -.34 -.16 0 0Z' +
    'M0 -.03L0 -.86M0 -.28L.17 -.46M0 -.28L-.17 -.46M0 -.53L.15 -.7M0 -.53L-.15 -.7');

  /* ------------------------------------------------------------ renderer */
  function create(canvas, layoutFn) {
    const ctx = canvas.getContext('2d');
    const st = {
      draw: 0,          // 0..1 pen progress
      explode: 0,       // 0..1 layers apart
      grow: 0,          // 0..1 roof trees
      tags: 0,          // 0..1 annotation leaders
      emph: [1, 1, 1],  // per-layer emphasis (the layer in focus stays, the others dim)
      focus: 0,         // 0..2 which layer the camera follows (fractional while moving)
      follow: 0,        // 0..1 how strongly the camera centres that layer
      zoom: 1,          // camera zoom around the drawing's centre
      tagW: 0,          // widest label in px, so labels never run off-screen
      yaw: 0, pitch: 0, // offsets from the resting camera (radians)
      orbit: 0,         // extra yaw driven by scroll
      pointer: null,    // [x, y] in CSS px, for the drafting crosshair
      cursor: 0,        // 0..1 crosshair visibility
      time: 0,
    };
    const out = { anchors: [[0, 0], [0, 0], [0, 0]], tagX: 0, tagAlpha: [0, 0, 0] };
    let w = 1, h = 1, dpr = 1, fit = null;

    const camera = (yaw, pitch) => ({ cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) });
    const proj = (p, c, lift = 0) => {
      const x1 = p[0] * c.cy - p[2] * c.sy;
      const z1 = p[0] * c.sy + p[2] * c.cy;
      const y = p[1] + lift;
      return [x1, -(y * c.cp - z1 * c.sp), y * c.sp + z1 * c.cp];
    };

    function fitBox(E, box) {
      const c = camera(YAW, PITCH);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const grow = (p, L) => {
        const q = proj(p, c, LIFT[L] * E);
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
        minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
      };
      segs.forEach(s => { if (!s.dash) { grow(s.a, s.L); grow(s.b, s.L); } });
      trees.forEach(t => grow([t.x, t.y + t.h, t.z], 2));
      const s = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
      return { s, ox: box.cx - s * (minX + maxX) / 2, oy: box.cy - s * (minY + maxY) / 2, cx: box.cx, cy: box.cy };
    }

    function resize() {
      w = canvas.clientWidth || 1;
      h = canvas.clientHeight || 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const lay = layoutFn(w, h);
      fit = { rest: fitBox(0, lay.rest), exp: fitBox(1, lay.exp) };
    }

    function render() {
      const E = st.explode;
      const z = st.zoom;
      const zx = mix(fit.rest.cx, fit.exp.cx, E), zy = mix(fit.rest.cy, fit.exp.cy, E);
      const s = mix(fit.rest.s, fit.exp.s, E) * z;
      const ox = zx + (mix(fit.rest.ox, fit.exp.ox, E) - zx) * z;
      let oy = zy + (mix(fit.rest.oy, fit.exp.oy, E) - zy) * z;
      const c = camera(YAW + st.yaw + st.orbit, PITCH + st.pitch);
      const P = (p, L) => {
        const q = proj(p, c, LIFT[L] * E);
        return [ox + s * q[0], oy + s * q[1], q[2]];
      };

      // annotation anchors: the corner of each layer that sits furthest right on screen
      const anchors = [[H * .5, 0, 0], [H * .62, 1, .45], [R + .7, 2, 0]].map(([y, L, pad]) => {
        let best = null;
        corners(-W / 2 - pad, W / 2 + pad, -D / 2 - pad, D / 2 + pad).forEach(([x, zz]) => {
          const q = P([x, y, zz], L);
          if (!best || q[0] > best[0]) best = q;
        });
        return [best[0], best[1]];
      });

      // the camera glides to keep the layer in focus near the middle of the screen
      if (st.follow > .001) {
        const f = clamp(st.focus, 0, 2);
        const i0 = Math.min(1, Math.floor(f));
        const fy = mix(anchors[i0][1], anchors[i0 + 1][1], f - i0);
        const pan = (h * .5 - fy) * st.follow;
        oy += pan;
        anchors.forEach(a => { a[1] += pan; });
      }
      const facing = n => {
        if (!n) return 1;
        return (n[1] * c.sp + (n[0] * c.sy + n[2] * c.cy) * c.cp) > .05 ? 1 : .2;
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';

      // batch lines by width/alpha/dash so the whole drawing is a handful of strokes
      const buckets = new Map();
      const push = (wd, al, dash, x1, y1, x2, y2) => {
        const key = `${wd}|${Math.round(al * 20)}|${dash ? 1 : 0}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, b = []);
        b.push(x1, y1, x2, y2);
      };

      const ghost = mix(mix(1, .3, clamp((st.draw - .45) / .4)), 1, E);
      const layerA = [ghost, 1, 1];
      for (const sg of segs) {
        const k = clamp((st.draw - sg.t0) / (sg.t1 - sg.t0));
        if (k <= 0) continue;
        const a = P(sg.a, sg.L);
        const end = k < 1 ? [mix(sg.a[0], sg.b[0], k), mix(sg.a[1], sg.b[1], k), mix(sg.a[2], sg.b[2], k)] : sg.b;
        const b = P(end, sg.L);
        const depth = clamp(.62 + (a[2] + b[2]) * .024, .3, 1);
        const al = sg.al * depth * facing(sg.n) * st.emph[sg.L] * layerA[sg.L];
        push(sg.w, al, sg.dash, a[0], a[1], b[0], b[1]);
      }

      // exploded-view guide lines at the four corners
      if (E > .01) {
        corners(-W / 2, W / 2, -D / 2, D / 2).forEach(([x, z]) => {
          const a = P([x, H, z], 0), b = P([x, R, z], 2);
          push(.8, .32 * Math.min(1, E * 2) * st.draw, true, a[0], a[1], b[0], b[1]);
        });
      }

      // height dimension (resting view only)
      const dimA = w < 700 ? 0 : clamp((st.draw - .5) * 3) * (1 - E);
      if (dimA > .01) {
        const dx = -W / 2 - 1.4, dz = D / 2;
        const a = P([dx, 0, dz], 0), b = P([dx, H, dz], 0);
        push(.8, .6 * dimA, false, a[0], a[1], b[0], b[1]);
        [a, b].forEach(p => push(.8, .6 * dimA, false, p[0] - 5, p[1] + 5, p[0] + 5, p[1] - 5));
        ctx.fillStyle = `rgba(${INK}, ${.7 * dimA})`;
        ctx.font = '600 10px Montserrat, sans-serif';
        ctx.direction = 'ltr';
        ctx.textAlign = 'right';
        ctx.fillText('+18.00', b[0] - 10, b[1] + 4);
        ctx.fillText('±0.00', a[0] - 10, a[1] + 4);
      }

      buckets.forEach((pts, key) => {
        const [wd, al, dash] = key.split('|');
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); }
        ctx.setLineDash(dash === '1' ? [4, 5] : []);
        ctx.lineWidth = +wd;
        ctx.strokeStyle = `rgba(${INK}, ${al / 20})`;
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // three leaves on the roof — they grow from their stems
      trees.forEach(t => {
        const g = clamp((st.draw - t.seg.t0) / (t.seg.t1 - t.seg.t0)) * st.grow;
        if (g <= .001) return;
        const p = P([t.x, t.y, t.z], 2);
        const size = t.h * s * g;
        ctx.save();
        ctx.translate(p[0], p[1]);
        ctx.rotate(t.tilt + Math.sin(st.time * 1.1 + t.i * 1.7) * .035);
        ctx.scale(size, size);
        ctx.lineWidth = 1.15 / size;
        ctx.strokeStyle = `rgba(${INK}, ${.92 * st.emph[2]})`;
        ctx.stroke(LEAF);
        ctx.restore();
      });

      // labels sit in one column right of the building, pulled in if they would leave the screen
      out.anchors = anchors;
      const maxX = Math.max(...anchors.map(a => a[0]));
      out.tagX = maxX + Math.min(56, w * .08);
      if (st.tagW) out.tagX = Math.min(out.tagX, w - 16 - st.tagW);
      out.tagAlpha = [0, 1, 2].map(i => clamp((st.tags - i * .15) / .55));
      out.anchors.forEach((p, i) => {
        const a = out.tagAlpha[i] * st.emph[i];
        if (a <= .01) return;
        ctx.strokeStyle = `rgba(${INK}, ${.55 * a})`;
        ctx.lineWidth = .9;
        ctx.beginPath();
        ctx.moveTo(p[0] + 4, p[1]);
        ctx.lineTo(mix(p[0] + 4, out.tagX - 8, out.tagAlpha[i]), p[1]);
        ctx.stroke();
        ctx.fillStyle = `rgba(${INK}, ${a})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // drafting crosshair that follows the pointer over the drawing
      if (st.pointer && st.cursor > .01) {
        const [px, py] = st.pointer;
        const a = st.cursor;
        ctx.strokeStyle = `rgba(${INK}, ${.1 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, py); ctx.lineTo(w, py);
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${INK}, ${.55 * a})`;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(${INK}, ${.6 * a})`;
        ctx.font = '500 10px Montserrat, sans-serif';
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.fillText(`X ${((px - ox) / s * 3).toFixed(2)}   Y ${((oy - py) / s * 3).toFixed(2)}`, px + 16, py - 14);
      }
      return out;
    }

    resize();
    return { st, resize, render, out };
  }

  return { create };
})();

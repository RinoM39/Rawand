/* =====================================================================
   RAWAND — Exploded axonometric line drawing (canvas 2D, orthographic)
   One building, drawn the way an architect presents it, in three layers:
     0  الهيكل الإنشائي  (الوظيفة)   slabs, structural grid, core, a cut-away corner that shows the floors
     1  الواجهة          (الجمال)    shopfront, curtain wall with leaf-rippled fins, louvred cantilever
     2  السطح الأخضر     (الاستدامة) parapet, PV array, pergola, green roof, the three trees
   Line weights follow drawing practice: outlines and cut edges heavy, edges medium, detail fine.
   Usage: const axo = RawandAxo.create(canvas, layoutFn); axo.st.draw = …; axo.render(time);
   ===================================================================== */
window.RawandAxo = (() => {
  'use strict';

  const DEG = Math.PI / 180;
  const INK = '91, 15, 26';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------ model */
  // 1 unit ≈ 3 m. Origin = centre of the podium at ground level.
  const POD = { x0: -6.5, x1: 6.5, z0: -4.2, z1: 5.2, lv: [0, 1.35, 2.35] };     // podium: double-height lobby + one floor
  const TOW = { x0: -4.5, x1: 4.5, z0: -3, z1: 3 };                             // tower, set back
  const TL = [2.35, 3.35, 4.35, 5.35, 6.35, 7.35];                             // tower levels (last = roof)
  const H = 7.35;
  const CANT = { x0: -4.5, x1: -.5, z0: 3, z1: 4.6, y0: 5.35 };                 // the top two floors reach out over the terrace
  const CUT = { x0: 1.3, z0: .4, y0: 2.35, y1: 6.35 };                          // facade peeled away at the near corner
  const CORE = { x0: -1.8, x1: .4, z0: -2.6, z1: -.2, top: 8.2 };
  const LIFT = [0, H + 2, H + 4];                 // how far each layer rises when exploded
  const YAW = 34 * DEG, PITCH = 26 * DEG;         // resting camera
  const SCHED = [[0, .58], [.26, .86], [.55, 1]]; // when each layer is drawn (0..1 of the draw)
  const SEG_T = .16;                              // how long one line takes to draw
  const VIEW = [Math.sin(YAW), Math.cos(YAW)];    // towards the camera, in plan

  // line weights (css px)
  const CUTW = 1.6, OUTW = 1.3, EDGE = .95, MED = .75, FINE = .55;

  const segs = [];
  const trees = [];
  const count = [0, 0, 0];

  const add = (L, a, b, o = {}) => segs.push({
    L, a, b, k: count[L]++,
    w: o.w || EDGE, al: o.al == null ? 1 : o.al, dash: !!o.dash, n: o.n || null,
    ng: !!o.ng,          // structure that stays solid at rest (outside the skin, or in the cut-away)
    nofit: !!o.nofit,    // not used to frame the drawing (site, paving)
  });
  const rectPts = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const LPTS = [[TOW.x0, TOW.z0], [TOW.x1, TOW.z0], [TOW.x1, TOW.z1], [CANT.x1, TOW.z1], [CANT.x1, CANT.z1], [CANT.x0, CANT.z1], [CANT.x0, TOW.z1]];
  const normal = (p, q) => {
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
    return [dz / L, 0, -dx / L];
  };
  const seen = n => n[0] * VIEW[0] + n[2] * VIEW[1] > 0;
  const poly = (L, y, pts, o) => pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    add(L, [p[0], y, p[1]], [q[0], y, q[1]], o);
  });
  // a solid between y0 and y1: the top outline, plus the bottom edge and corners of the faces that look at the camera
  function prism(L, pts, y0, y1, o = {}, ob = o) {
    poly(L, y1, pts, o);
    const vis = pts.map((p, i) => seen(normal(p, pts[(i + 1) % pts.length])));
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (vis[i]) add(L, [p[0], y0, p[1]], [q[0], y0, q[1]], ob);
      if (vis[i] || vis[(i + pts.length - 1) % pts.length]) add(L, [p[0], y0, p[1]], [p[0], y1, p[1]], ob);
    });
  }
  // a square column: its three visible edges
  const column = (L, x, z, y0, y1, o, s = .1) =>
    [[x + s, z + s], [x - s, z + s], [x + s, z - s]].forEach(([cx, cz]) => add(L, [cx, y0, cz], [cx, y1, cz], o));
  // section poché: 45° hatching across a cut face from p to q (plan points), between y0 and y1
  function hatchFace(L, p, q, y0, y1, step, o) {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len;
    for (let t = step * .5; t < len; t += step) {
      const t1 = Math.min(len, t + (y1 - y0));
      add(L, [p[0] + ux * t, y0, p[1] + uz * t], [p[0] + ux * t1, y0 + (t1 - t), p[1] + uz * t1], o);
    }
  }
  // a person for scale (1.7 m), standing in the picture plane
  function person(L, x, y, z, o) {
    const r = [Math.cos(YAW), -Math.sin(YAW)];
    const P = (dx, dy) => [x + r[0] * dx, y + dy, z + r[1] * dx];
    add(L, P(0, .21), P(0, .45), o);
    add(L, P(0, .21), P(-.05, 0), o);
    add(L, P(0, .21), P(.05, 0), o);
    add(L, P(0, .42), P(-.07, .25), o);
    add(L, P(0, .42), P(.07, .25), o);
    for (let k = 0; k < 6; k++) {
      const a0 = k * Math.PI / 3, a1 = a0 + Math.PI / 3;
      add(L, P(.05 * Math.cos(a0), .52 + .05 * Math.sin(a0)), P(.05 * Math.cos(a1), .52 + .05 * Math.sin(a1)), o);
    }
  }
  const inCut = (x, y, z) => y > CUT.y0 - 1e-6 && y < CUT.y1 - 1e-6 && x > CUT.x0 - 1e-6 && z > CUT.z0 - 1e-6;
  // a line, minus the parts that fall inside the cut-away
  function clipped(L, a, b, o) {
    const N = 24;
    let start = null;
    for (let k = 0; k <= N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const m = (t0 + t1) / 2;
      const keep = k < N && !inCut(mix(a[0], b[0], m), mix(a[1], b[1], m), mix(a[2], b[2], m));
      if (keep && start === null) start = t0;
      if (!keep && start !== null) {
        add(L, [mix(a[0], b[0], start), mix(a[1], b[1], start), mix(a[2], b[2], start)],
          [mix(a[0], b[0], t0), mix(a[1], b[1], t0), mix(a[2], b[2], t0)], o);
        start = null;
      }
    }
  }
  // seeded scatter (ground cover)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function groundCover(L, x0, x1, z0, z1, y, n, o) {
    for (let k = 0; k < n; k++) {
      const x = mix(x0, x1, rnd()), z = mix(z0, z1, rnd()), h = .05 + .06 * rnd();
      add(L, [x, y, z], [x + .02, y + h, z], o);
    }
  }

  /* ---------------- 0 — structure */
  const hidden = { w: EDGE, al: .75 };
  const site = { ng: true, nofit: true };
  // site boundary and forecourt paving
  poly(0, 0, rectPts(-9.5, 9.5, -6.8, 8.8), { ...site, dash: true, al: .4, w: MED });
  for (let x = -8; x <= 8.01; x += 1.6) add(0, [x, 0, POD.z1], [x, 0, 8.4], { ...site, w: FINE, al: .2 });
  for (const z of [6.3, 7.4]) add(0, [-8, 0, z], [8, 0, z], { ...site, w: FINE, al: .2 });
  poly(0, 0, rectPts(POD.x0, POD.x1, POD.z0, POD.z1), { ng: true, w: OUTW });

  // podium: columns on a 3.25-unit grid, the first-floor slab and the podium roof
  [-6.5, -3.25, 0, 3.25, 6.5].forEach(x => [-4.2, -1.05, 2.1, 5.2].forEach(z => column(0, x, z, 0, POD.lv[2], { w: MED, al: .7 })));
  POD.lv.slice(1).forEach(y => prism(0, rectPts(POD.x0, POD.x1, POD.z0, POD.z1), y - .14, y, hidden));

  // core: lift and stairs, running up through the roof
  prism(0, rectPts(CORE.x0, CORE.x1, CORE.z0, CORE.z1), 0, H, { w: EDGE, al: .8 });
  prism(0, rectPts(CORE.x0, CORE.x1, CORE.z0, CORE.z1), H, CORE.top, { w: EDGE, ng: true });
  add(0, [-.9, H, CORE.z1], [-.9, H + .6, CORE.z1], { w: FINE, ng: true });         // roof access door
  add(0, [-.3, H, CORE.z1], [-.3, H + .6, CORE.z1], { w: FINE, ng: true });
  add(0, [-.9, H + .6, CORE.z1], [-.3, H + .6, CORE.z1], { w: FINE, ng: true });

  // tower: columns on a 3-unit grid, slabs (the top three reach over the cantilever)
  [TOW.x0, -1.5, 1.5, TOW.x1].forEach(x => [TOW.z0, 0, TOW.z1].forEach(z => {
    const exposed = x > CUT.x0 && z > CUT.z0;
    column(0, x, z, POD.lv[2], H, exposed ? { w: EDGE, ng: true } : { w: MED, al: .7 });
  }));
  TL.slice(1).forEach(y => prism(0, y >= CANT.y0 ? LPTS : rectPts(TOW.x0, TOW.x1, TOW.z0, TOW.z1), y - .14, y, hidden));
  // the cantilever's truss, in its side wall
  for (let y = CANT.y0; y < H - .01; y += 1) {
    add(0, [CANT.x1, y, CANT.z0], [CANT.x1, y + 1, CANT.z1], { w: MED, ng: true, al: .8 });
    add(0, [CANT.x1, y, CANT.z1], [CANT.x1, y + 1, CANT.z1], { w: MED, ng: true, al: .8 });
  }

  // the cut-away corner: slab edges in section (heavy, hatched), beams, the open stair, rooms and people
  const cutO = { w: CUTW, ng: true };
  const pocheO = { w: FINE, ng: true, al: .55 };
  [3.35, 4.35, 5.35, 6.35].forEach(y => {
    const a = [CUT.x0, TOW.z1], b = [TOW.x1, TOW.z1], c = [TOW.x1, CUT.z0];
    add(0, [a[0], y, a[1]], [b[0], y, b[1]], cutO);
    add(0, [b[0], y, b[1]], [c[0], y, c[1]], cutO);
    add(0, [a[0], y - .14, a[1]], [b[0], y - .14, b[1]], cutO);
    add(0, [b[0], y - .14, b[1]], [c[0], y - .14, c[1]], cutO);
    hatchFace(0, a, b, y - .14, y, .16, pocheO);
    hatchFace(0, b, c, y - .14, y, .16, pocheO);
    // downstand beams along the grid under the slab
    add(0, [1.5, y - .4, TOW.z1], [TOW.x1, y - .4, TOW.z1], { w: MED, ng: true, al: .7 });
    add(0, [TOW.x1, y - .4, TOW.z1], [TOW.x1, y - .4, CUT.z0], { w: MED, ng: true, al: .7 });
  });
  const inner = { w: FINE, ng: true, al: .8 };
  [2.35, 3.35, 4.35, 5.35].forEach((y, f) => {
    // a straight open stair to the next floor, with handrail
    const s0 = 2.65, s1 = .95, steps = 7;
    [2.6, 3.4].forEach(x => {
      add(0, [x, y, s0], [x, y + 1, s1], { w: FINE, ng: true, al: .85 });
      add(0, [x, y + .32, s0], [x, y + 1.32, s1], { w: FINE, ng: true, al: .45 });
    });
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      add(0, [2.6, y + t, mix(s0, s1, t)], [3.4, y + t, mix(s0, s1, t)], inner);
    }
    // rooms
    if (f % 2 === 0) {
      // a work table and two people
      prism(0, rectPts(1.6, 2.3, 1.7, 2.5), y + .22, y + .25, inner);
      add(0, [1.65, y, 2.45], [1.65, y + .22, 2.45], inner);
      add(0, [2.25, y, 2.45], [2.25, y + .22, 2.45], inner);
      person(0, 1.75, y, 1.45, inner);
      if (f === 0) person(0, 3.95, y, 2.6, inner);
    } else {
      // a glazed meeting room
      prism(0, rectPts(3.65, 4.4, .55, 1.6), y, y + .75, { w: FINE, ng: true, al: .7 });
      prism(0, rectPts(3.8, 4.25, .85, 1.3), y + .22, y + .25, inner);
      person(0, 1.9, y, 2.3, inner);
    }
  });

  // podium roof terrace: paving, planters with ground cover, a bench
  const terr = { w: FINE, ng: true, al: .3 };
  [3.7, 4.4].forEach(z => add(0, [POD.x0, POD.lv[2], z], [POD.x1, POD.lv[2], z], terr));
  [[-6.2, -3.6], [3.6, 6.2]].forEach(([x0, x1]) => {
    prism(0, rectPts(x0, x1, 4.55, 5.0), POD.lv[2], POD.lv[2] + .22, { w: MED, ng: true, al: .85 });
    groundCover(0, x0 + .05, x1 - .05, 4.6, 4.95, POD.lv[2] + .22, 22, { w: FINE, ng: true, al: .7 });
  });
  prism(0, rectPts(5.0, 5.9, 1.2, 1.5), POD.lv[2] + .14, POD.lv[2] + .18, inner);
  person(0, 5.6, POD.lv[2], 2.2, inner);
  person(0, -5.2, POD.lv[2], 3.9, inner);
  // people on the forecourt
  person(0, -2.6, 0, 6.6, { w: FINE, ng: true, al: .85 });
  person(0, 3.4, 0, 7.2, { w: FINE, ng: true, al: .85 });

  /* ---------------- 1 — facade */
  // podium shopfront: mullions, transom, spandrel, the glass balustrade on the terrace
  const podFaces = rectPts(POD.x0, POD.x1, POD.z0, POD.z1);
  podFaces.forEach((p, i) => {
    const q = podFaces[(i + 1) % 4];
    const n = normal(p, q);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const at = u => [mix(p[0], q[0], u / len), mix(p[1], q[1], u / len)];
    const bay = len / Math.round(len / 1.3);
    const front = seen(n);
    for (let u = 0; u <= len + 1e-6; u += bay) {
      const [x, z] = at(u);
      add(1, [x, 0, z], [x, POD.lv[2], z], { n, w: MED, al: .8 });
      if (front) add(1, [x, POD.lv[2], z], [x, POD.lv[2] + .36, z], { n, w: FINE, al: .55 });   // balustrade posts
      if (front && u + bay / 2 < len) {
        const [xm, zm] = at(u + bay / 2);
        add(1, [xm, POD.lv[1], zm], [xm, POD.lv[2], zm], { n, w: FINE, al: .55 });       // first-floor mid mullion
      }
    }
    const P = (u, y) => { const [x, z] = at(u); return [x, y, z]; };
    add(1, P(0, POD.lv[2]), P(len, POD.lv[2]), { n, w: OUTW });
    add(1, P(0, POD.lv[1]), P(len, POD.lv[1]), { n, w: MED, al: .8 });
    add(1, P(0, POD.lv[1] - .16), P(len, POD.lv[1] - .16), { n, w: FINE, al: .6 });
    add(1, P(0, 1.0), P(len, 1.0), { n, w: FINE, al: .6 });
    if (front) add(1, P(0, POD.lv[2] + .36), P(len, POD.lv[2] + .36), { n, w: MED, al: .8 });   // handrail
  });
  // the entrance: double doors and a cantilevered canopy on tie rods
  const fz = POD.z1;
  [[-.8, 0, fz], [.8, 0, fz]].forEach(([x, y, z]) => add(1, [x, y, z], [x, .82, z], { w: MED }));
  add(1, [-.8, .82, fz], [.8, .82, fz], { w: MED });
  add(1, [0, 0, fz], [0, .82, fz], { w: FINE });
  prism(1, rectPts(-2.1, 2.1, fz, fz + 1.5), 1.1, 1.18, { w: EDGE });
  [-1.9, 1.9].forEach(x => add(1, [x, 1.18, fz + 1.35], [x, 1.95, fz], { w: FINE, al: .8 }));

  // tower curtain wall, floor by floor: mullions, spandrels, and on the street faces vertical fins
  // whose depth ripples like a leaf's edge; the cantilever gets horizontal louvres instead
  for (let f = 0; f < TL.length - 1; f++) {
    const y = TL[f], y1 = TL[f + 1];
    const pts = y >= CANT.y0 ? LPTS : rectPts(TOW.x0, TOW.x1, TOW.z0, TOW.z1);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const n = normal(p, q);
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const at = (u, d = 0) => [mix(p[0], q[0], u / len) + n[0] * d, mix(p[1], q[1], u / len) + n[2] * d];
      const front = seen(n);
      const onCant = y >= CANT.y0 && (p[1] > TOW.z1 + 1e-6 || q[1] > TOW.z1 + 1e-6);
      const P = (u, yy, d = 0) => { const [x, z] = at(u, d); return [x, yy, z]; };
      clipped(1, P(0, y), P(len, y), { n, w: EDGE, al: .9 });
      clipped(1, P(0, y + .24), P(len, y + .24), { n, w: FINE, al: .6 });
      if (onCant) {
        for (let k = 1; k < 10; k++) add(1, P(0, y + k * .1), P(len, y + k * .1), { n, w: FINE, al: front ? .75 : .5 });
        for (let u = 0; u <= len + 1e-6; u += len / Math.max(1, Math.round(len / 1))) add(1, P(u, y), P(u, y1), { n, w: MED, al: .8 });
        return;
      }
      const step = len / Math.round(len / .75);
      for (let u = 0; u <= len + 1e-6; u += step) {
        const a = P(u, y), b = P(u, y1);
        if (inCut((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)) continue;
        add(1, a, b, { n, w: MED, al: .75 });
        if (!front || u < 1e-6 || u > len - 1e-6) continue;
        const d = .1 + .26 * (.5 + .5 * Math.sin(u * .8 + i * 1.3));
        add(1, P(u, y, d), P(u, y1, d), { n, w: MED, al: .9 });
        add(1, P(u, y1), P(u, y1, d), { n, w: FINE, al: .5 });
      }
    });
  }
  // glass reflections, the draughtsman's way: pairs of short diagonal strokes on the glazing
  const glint = (L, x, y, z, n, s = .32) => {
    const t = [-n[2], 0, n[0]];
    [0, .09].forEach((o, k) => add(L, [x + t[0] * o, y + o * .6, z + t[2] * o], [x + t[0] * (o + s * (k ? .6 : 1)), y + o * .6 + s * (k ? .6 : 1), z + t[2] * (o + s * (k ? .6 : 1))], { n, w: FINE, al: .55 }));
  };
  glint(1, -4.6, .35, POD.z1, [0, 0, 1]);
  glint(1, 2.9, .3, POD.z1, [0, 0, 1]);
  glint(1, POD.x1, .4, 3.4, [1, 0, 0]);
  glint(1, POD.x1, 1.55, -2.2, [1, 0, 0]);
  glint(1, -3.9, 3.0, TOW.z1, [0, 0, 1], .38);
  glint(1, -2.4, 4.1, TOW.z1, [0, 0, 1], .3);
  glint(1, TOW.x1, 6.6, -1.6, [1, 0, 0], .36);
  glint(1, TOW.x1, 4.6, -2.3, [1, 0, 0], .3);
  glint(1, -.2, 6.55, TOW.z1, [0, 0, 1], .3);

  // where the skin is cut back
  add(1, [CUT.x0, CUT.y0, TOW.z1], [CUT.x0, CUT.y1, TOW.z1], { w: OUTW });
  add(1, [TOW.x1, CUT.y0, CUT.z0], [TOW.x1, CUT.y1, CUT.z0], { w: OUTW });
  add(1, [CUT.x0, CUT.y1, TOW.z1], [TOW.x1, CUT.y1, TOW.z1], { w: OUTW });
  add(1, [TOW.x1, CUT.y1, TOW.z1], [TOW.x1, CUT.y1, CUT.z0], { w: OUTW });
  // cantilever soffit
  poly(1, CANT.y0 - .14, rectPts(CANT.x0, CANT.x1, CANT.z0, CANT.z1), { w: MED, al: .7 });

  /* ---------------- 2 — roof */
  const R = H;
  // parapet with coping
  prism(2, LPTS, R, R + .35, { w: OUTW }, { w: EDGE });
  poly(2, R + .35, [[-4.38, -2.88], [4.38, -2.88], [4.38, 2.88], [-.62, 2.88], [-.62, 4.48], [-4.38, 4.48]], { w: FINE, al: .6 });
  // photovoltaic array: three rows of tilted panels, cells drawn in
  for (let r = 0; r < 3; r++) {
    const zb = -2.7 + r * .95, zf = zb + .7, yb = R + .55, yf = R + .2;
    for (let c = 0; c < 4; c++) {
      const x0 = .9 + c * .8, x1 = x0 + .75;
      const corner = [[x0, yf, zf], [x1, yf, zf], [x1, yb, zb], [x0, yb, zb]];
      corner.forEach((p, k) => add(2, p, corner[(k + 1) % 4], { w: MED }));
      [1 / 3, 2 / 3].forEach(t => add(2, [x0, mix(yf, yb, t), mix(zf, zb, t)], [x1, mix(yf, yb, t), mix(zf, zb, t)], { w: FINE, al: .55 }));
      add(2, [(x0 + x1) / 2, yf, zf], [(x0 + x1) / 2, yb, zb], { w: FINE, al: .55 });
      add(2, [x0, R, zb], [x0, yb, zb], { w: FINE, al: .6 });
      add(2, [x1, R, zb], [x1, yb, zb], { w: FINE, al: .6 });
    }
  }
  // pergola over the roof terrace
  const pg = { x0: .9, x1: 4.1, z0: 1, z1: 2.75, y: R + 1.05 };
  rectPts(pg.x0, pg.x1, pg.z0, pg.z1).forEach(([x, z]) => add(2, [x, R, z], [x, pg.y, z], { w: EDGE }));
  add(2, [pg.x0 - .2, pg.y, pg.z0], [pg.x1 + .2, pg.y, pg.z0], { w: EDGE });
  add(2, [pg.x0 - .2, pg.y, pg.z1], [pg.x1 + .2, pg.y, pg.z1], { w: EDGE });
  for (let x = pg.x0; x <= pg.x1 + 1e-6; x += .32) add(2, [x, pg.y + .06, pg.z0 - .25], [x, pg.y + .06, pg.z1 + .25], { w: FINE, al: .8 });
  prism(2, rectPts(1.4, 2.6, 2.1, 2.4), R + .12, R + .16, { w: FINE, al: .8 });
  person(2, 3.4, R, 1.9, { w: FINE, al: .85 });
  // extensive green roof
  poly(2, R + .04, rectPts(-4.2, -2.3, -2.7, 2.7), { w: FINE, al: .6 });
  groundCover(2, -4.15, -2.35, -2.65, 2.65, R + .04, 70, { w: FINE, al: .65 });
  // planter on the cantilever roof, and the three trees
  const pl = { x0: -4.2, x1: -.8, z0: 3.35, z1: 4.3, h: .35 };
  prism(2, rectPts(pl.x0, pl.x1, pl.z0, pl.z1), R, R + pl.h, { w: EDGE });
  groundCover(2, pl.x0 + .1, pl.x1 - .1, pl.z0 + .08, pl.z1 - .08, R + pl.h, 26, { w: FINE, al: .6 });
  [[-3.6, 3.82, 1.5, -.14], [-2.5, 3.82, 1.2, .1], [-1.4, 3.82, 1.35, -.05]].forEach(([x, z, h, tilt], i) => {
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
    const WIDTHS = [];
    const ALPHA = Array.from({ length: 21 }, (_, k) => `rgba(${INK}, ${k / 20})`);
    const pool = [];
    const used = [];
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
      segs.forEach(s => { if (!s.dash && !s.nofit) { grow(s.a, s.L); grow(s.b, s.L); } });
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
      const anchors = [[4.85, 0, 0], [5.6, 1, .45], [H + .7, 2, 0]].map(([y, L, pad]) => {
        let best = null;
        rectPts(TOW.x0 - pad, TOW.x1 + pad, TOW.z0 - pad, TOW.z1 + pad).forEach(([x, zz]) => {
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
      // (numeric keys and reused arrays: no strings or garbage per line, every frame)
      used.length = 0;
      const push = (wd, al, dash, x1, y1, x2, y2) => {
        let wi = WIDTHS.indexOf(wd);
        if (wi < 0) wi = WIDTHS.push(wd) - 1;
        const key = ((wi * 21) + Math.round(clamp(al) * 20)) * 2 + (dash ? 1 : 0);
        let b = pool[key];
        if (!b) b = pool[key] = [];
        if (!b.live) { b.live = true; b.length = 0; used.push(key); }
        b.push(x1, y1, x2, y2);
      };

      // at rest the structure inside the skin steps back; what is outside it or in the cut-away stays solid
      const ghost = mix(mix(1, .3, clamp((st.draw - .45) / .4)), 1, E);
      // (the same projection as P(), done inline: no arrays per point, ~1500 segments a frame)
      const lifts = [LIFT[0] * E, LIFT[1] * E, LIFT[2] * E];
      const ccy = c.cy, csy = c.sy, ccp = c.cp, csp = c.sp;
      for (const sg of segs) {
        const k = clamp((st.draw - sg.t0) / (sg.t1 - sg.t0));
        if (k <= 0) continue;
        const A = sg.a, B = sg.b, lift = lifts[sg.L];
        const ex = k < 1 ? mix(A[0], B[0], k) : B[0];
        const ey = k < 1 ? mix(A[1], B[1], k) : B[1];
        const ez = k < 1 ? mix(A[2], B[2], k) : B[2];
        let x1 = A[0] * ccy - A[2] * csy, z1 = A[0] * csy + A[2] * ccy, y = A[1] + lift;
        const ax = ox + s * x1, ay = oy + s * -(y * ccp - z1 * csp), az = y * csp + z1 * ccp;
        x1 = ex * ccy - ez * csy; z1 = ex * csy + ez * ccy; y = ey + lift;
        const bx = ox + s * x1, by = oy + s * -(y * ccp - z1 * csp), bz = y * csp + z1 * ccp;
        const depth = clamp(.62 + (az + bz) * .024, .3, 1);
        const al = sg.al * depth * facing(sg.n) * st.emph[sg.L] * (sg.L === 0 && !sg.ng ? ghost : 1);
        push(sg.w, al, sg.dash, ax, ay, bx, by);
      }

      // exploded-view guide lines at the four corners
      if (E > .01) {
        rectPts(TOW.x0, TOW.x1, TOW.z0, TOW.z1).forEach(([x, z]) => {
          const a = P([x, H, z], 0), b = P([x, H, z], 2);
          push(.8, .32 * Math.min(1, E * 2) * st.draw, true, a[0], a[1], b[0], b[1]);
        });
      }

      // dimensions, as on a drawing (resting view only): levels up the left, width and depth on the ground
      const dimA = w < 700 ? 0 : clamp((st.draw - .5) * 3) * (1 - E);
      const labels = [];
      if (dimA > .01) {
        const dA = .55 * dimA;
        const tick = (p, k = 4) => push(.8, dA, false, p[0] - k, p[1] + k, p[0] + k, p[1] - k);
        const dim = (A, B, off, text) => {
          const a0 = [A[0] + off[0] * .15, 0, A[2] + off[2] * .15], a1 = [A[0] + off[0] * 1.12, 0, A[2] + off[2] * 1.12];
          const b0 = [B[0] + off[0] * .15, 0, B[2] + off[2] * .15], b1 = [B[0] + off[0] * 1.12, 0, B[2] + off[2] * 1.12];
          [[a0, a1], [b0, b1]].forEach(([p, q]) => { const u = P(p, 0), v = P(q, 0); push(FINE, dA * .8, false, u[0], u[1], v[0], v[1]); });
          const u = P([A[0] + off[0], 0, A[2] + off[2]], 0), v = P([B[0] + off[0], 0, B[2] + off[2]], 0);
          push(.8, dA, false, u[0], u[1], v[0], v[1]);
          tick(u); tick(v);
          labels.push({ x: (u[0] + v[0]) / 2, y: (u[1] + v[1]) / 2, ang: Math.atan2(v[1] - u[1], v[0] - u[0]), text });
        };
        dim([POD.x0, 0, POD.z1], [POD.x1, 0, POD.z1], [0, 0, 1.25], ((POD.x1 - POD.x0) * 3).toFixed(2));
        dim([POD.x1, 0, POD.z1], [POD.x1, 0, POD.z0], [1.25, 0, 0], ((POD.z1 - POD.z0) * 3).toFixed(2));
        // levels
        const lx = POD.x0 - 1.3, lz = POD.z1;
        const top = P([lx, H, lz], 0), bot = P([lx, 0, lz], 0);
        push(.8, dA, false, bot[0], bot[1], top[0], top[1]);
        [0, POD.lv[1], POD.lv[2], H].forEach(y => {
          const p = P([lx, y, lz], 0);
          push(.8, dA, false, p[0] - 6, p[1], p[0] + 6, p[1]);
          push(.8, dA, false, p[0] - 3.5, p[1] - 5, p[0], p[1]);
          push(.8, dA, false, p[0] + 3.5, p[1] - 5, p[0], p[1]);
          push(.8, dA, false, p[0] - 3.5, p[1] - 5, p[0] + 3.5, p[1] - 5);
          labels.push({ x: p[0] - 10, y: p[1] - 2, ang: 0, text: y ? '+' + (y * 3).toFixed(2) : '±0.00', right: true });
        });
      }

      used.forEach(key => {
        const pts = pool[key];
        pts.live = false;
        const dash = key % 2, al = (key >> 1) % 21, wi = Math.floor((key >> 1) / 21);
        if (!al) return;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 4) { ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[i + 2], pts[i + 3]); }
        ctx.setLineDash(dash ? [4, 5] : []);
        ctx.lineWidth = WIDTHS[wi];
        ctx.strokeStyle = ALPHA[al];
        ctx.stroke();
      });
      ctx.setLineDash([]);
      if (labels.length) {
        ctx.fillStyle = `rgba(${INK}, ${.72 * dimA})`;
        ctx.font = '600 10px Montserrat, sans-serif';
        ctx.direction = 'ltr';
        labels.forEach(l => {
          let ang = l.ang;
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          ctx.save();
          ctx.translate(l.x, l.y);
          ctx.rotate(ang);
          ctx.textAlign = l.right ? 'right' : 'center';
          ctx.fillText(l.text, 0, l.right ? 0 : -6);
          ctx.restore();
        });
      }

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

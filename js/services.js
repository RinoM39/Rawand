/* =====================================================================
   RAWAND — Services (خدماتنا)
   Each service sheet has a living drawing (canvas), geometry that means what the title says:
     الاستشارات الهندسية → a survey: points on the site, a triangulation network, a sweeping
                           theodolite that tints each triangle by its level, then the site boundary
                           and the best spot
     التصميم             → the golden section: a φ rectangle cut square by square, the golden spiral
                           drawn through them, the diagonals meeting at its eye
     التنفيذ             → the assembly: blocks lowered on the crane cable, floor by floor, the level
                           gauge rising, the building handed over
   The drawings loop, building something different each time, and only run while on screen.
   Needs gsap + ScrollTrigger for the entrance; with reduced motion the drawings are still, complete.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('services');
  if (!root) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 360;
  const H = 260;
  const TAU = Math.PI * 2;
  const INK = '#5B0F1A';
  const PEN = '#9E4A52';
  const PAPER = '#F5F3F0';
  const tint = a => `rgba(122, 30, 41, ${a})`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = t => 1 - (1 - t) ** 3;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const easeBack = t => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
  const FONT = '600 7.5px Montserrat, sans-serif';

  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // draw the first p (0→1) of a polyline
  function polyPart(c, pts, p, close) {
    if (p <= 0 || pts.length < 2) return;
    const list = close ? pts.concat([pts[0]]) : pts;
    const lens = [];
    let total = 0;
    for (let i = 1; i < list.length; i++) { const l = Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]); lens.push(l); total += l; }
    let left = total * p;
    c.moveTo(list[0][0], list[0][1]);
    for (let i = 1; i < list.length && left > 0; i++) {
      const s = Math.min(1, left / lens[i - 1]);
      c.lineTo(list[i - 1][0] + (list[i][0] - list[i - 1][0]) * s, list[i - 1][1] + (list[i][1] - list[i - 1][1]) * s);
      left -= lens[i - 1];
    }
  }
  const label = (c, text, x, y, a, align = 'left') => {
    if (a <= 0) return;
    c.globalAlpha *= a;
    c.fillStyle = PEN;
    c.font = FONT;
    c.textAlign = align;
    c.fillText(text, x, y);
    c.globalAlpha /= a;
  };

  /* ------------------------------------------------------------ geometry helpers */

  function delaunay(P) {
    const pts = P.concat([[-1e3, -1e3], [2e3, -1e3], [500, 2e3]]);
    const n = P.length;
    const circ = v => {
      const [a, b, c] = v.map(i => pts[i]);
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      const A = a[0] ** 2 + a[1] ** 2, B = b[0] ** 2 + b[1] ** 2, C = c[0] ** 2 + c[1] ** 2;
      const ux = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d;
      const uy = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
      return [ux, uy, (a[0] - ux) ** 2 + (a[1] - uy) ** 2];
    };
    let tris = [{ v: [n, n + 1, n + 2] }];
    tris[0].c = circ(tris[0].v);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const bad = tris.filter(t => (p[0] - t.c[0]) ** 2 + (p[1] - t.c[1]) ** 2 < t.c[2]);
      const edges = [];
      bad.forEach(t => [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
        const e = [t.v[a], t.v[b]];
        const k = edges.findIndex(f => (f[0] === e[1] && f[1] === e[0]) || (f[0] === e[0] && f[1] === e[1]));
        if (k >= 0) edges.splice(k, 1); else edges.push(e);
      }));
      tris = tris.filter(t => !bad.includes(t));
      edges.forEach(e => { const v = [e[0], e[1], i]; tris.push({ v, c: circ(v) }); });
    }
    return tris.filter(t => t.v.every(i => i < n)).map(t => t.v);
  }
  function hull(P) {
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    pts.forEach(p => { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    pts.slice().reverse().forEach(p => { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  /* ------------------------------------------------------------ ١ consulting: the survey */

  function survey() {
    let pts, elev, edges, tris, ring, S, a0, contours, best, span;
    return {
      L: 9.6,
      gen(r) {
        pts = [];
        for (let guard = 0; pts.length < 13 && guard < 5000; guard++) {
          const p = [40 + r() * 280, 30 + r() * 196];
          const dx = (p[0] - 180) / 152, dy = (p[1] - 128) / 104;
          if (dx * dx + dy * dy > 1) continue;
          if (pts.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 44)) pts.push(p);
        }
        elev = pts.map(() => 600 + r() * 18);
        const tv = delaunay(pts);
        S = pts.reduce((b, p, i) => (p[0] < pts[b][0] ? i : b), 0);
        // network spreads out from the station, edge by edge
        const adj = pts.map(() => new Set());
        tv.forEach(([a, b, c]) => { adj[a].add(b).add(c); adj[b].add(a).add(c); adj[c].add(a).add(b); });
        const depth = pts.map(() => Infinity);
        depth[S] = 0;
        const queue = [S];
        while (queue.length) { const u = queue.shift(); adj[u].forEach(v => { if (depth[v] === Infinity) { depth[v] = depth[u] + 1; queue.push(v); } }); }
        const seen = new Set();
        edges = [];
        tv.forEach(t => [[0, 1], [1, 2], [2, 0]].forEach(([i, j]) => {
          let a = t[i], b = t[j];
          const key = Math.min(a, b) + '-' + Math.max(a, b);
          if (seen.has(key)) return;
          seen.add(key);
          if (depth[b] < depth[a]) [a, b] = [b, a];
          edges.push({ a, b, d: depth[a] + Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) / 400 });
        }));
        edges.sort((e, f) => e.d - f.d);
        // triangles: when the theodolite passes them, tinted by their mean level
        const sp = pts[S];
        a0 = -Math.PI / 2;
        tris = tv.map(v => {
          const cx = (pts[v[0]][0] + pts[v[1]][0] + pts[v[2]][0]) / 3;
          const cy = (pts[v[0]][1] + pts[v[1]][1] + pts[v[2]][1]) / 3;
          const ang = ((Math.atan2(cy - sp[1], cx - sp[0]) - a0) % TAU + TAU) % TAU;
          const lv = (elev[v[0]] + elev[v[1]] + elev[v[2]]) / 3;
          return { v, ang, a: .04 + .2 * ((lv - 600) / 18) };
        });
        ring = hull(pts);
        best = ring.reduce((m, p) => [m[0] + p[0] / ring.length, m[1] + p[1] / ring.length], [0, 0]);
        const xs = ring.map(p => p[0]);
        span = [Math.min(...xs), Math.max(...xs), Math.max(...ring.map(p => p[1]))];
        contours = [0, 1, 2, 3, 4].map(k => {
          const base = 34 + k * 48, ph = r() * TAU, amp = 6 + r() * 8;
          const line = [];
          for (let x = 0; x <= W; x += 10) line.push([x, base + Math.sin(x * .02 + ph) * amp + Math.sin(x * .047 + ph * 2) * 3]);
          return line;
        });
      },
      draw(c, t) {
        c.lineCap = 'round';
        c.lineJoin = 'round';
        // terrain contours
        c.strokeStyle = tint(.22);
        c.lineWidth = .7;
        c.beginPath();
        contours.forEach(l => polyPart(c, l, easeInOut(seg(t, 0, 1.4)), false));
        c.stroke();
        // triangles tinted by the sweep
        const sweep = t < 3.6 ? -1 : seg(t, 3.6, 6.2) * TAU;
        tris.forEach(tr => {
          const a = easeOut(seg(sweep, tr.ang, tr.ang + .7)) * tr.a;
          if (a <= 0) return;
          c.fillStyle = tint(a);
          c.beginPath();
          tr.v.forEach((i, k) => (k ? c.lineTo(...pts[i]) : c.moveTo(...pts[i])));
          c.closePath();
          c.fill();
        });
        // the triangulation network
        c.strokeStyle = INK;
        c.lineWidth = .8;
        c.globalAlpha = .75;
        c.beginPath();
        edges.forEach((e, k) => {
          const p = easeOut(seg(t, 1.4 + k * .055, 1.8 + k * .055));
          if (p <= 0) return;
          const A = pts[e.a], B = pts[e.b];
          c.moveTo(A[0], A[1]);
          c.lineTo(A[0] + (B[0] - A[0]) * p, A[1] + (B[1] - A[1]) * p);
        });
        c.stroke();
        c.globalAlpha = 1;
        // the theodolite's sight line and its fading wake
        if (t >= 3.6 && t <= 6.4) {
          const sp = pts[S], ang = a0 + sweep;
          const wake = c.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 260);
          wake.addColorStop(0, tint(.12));
          wake.addColorStop(1, tint(0));
          c.fillStyle = wake;
          c.beginPath();
          c.moveTo(sp[0], sp[1]);
          c.arc(sp[0], sp[1], 420, ang - .55, ang);
          c.closePath();
          c.fill();
          c.strokeStyle = PEN;
          c.lineWidth = .9;
          c.beginPath();
          c.moveTo(sp[0], sp[1]);
          c.lineTo(sp[0] + Math.cos(ang) * 420, sp[1] + Math.sin(ang) * 420);
          c.stroke();
        }
        // survey points + levels; the station drawn as a tripod
        pts.forEach((p, i) => {
          const a = easeBack(seg(t, .35 + i * .08, .7 + i * .08));
          if (a <= 0) return;
          const s = 3.6 * a;
          c.strokeStyle = INK;
          c.lineWidth = 1;
          c.beginPath();
          if (i === S) {
            c.moveTo(p[0], p[1] - s * 1.6); c.lineTo(p[0] - s * 1.2, p[1] + s); c.lineTo(p[0] + s * 1.2, p[1] + s); c.closePath();
          } else {
            c.moveTo(p[0] - s, p[1] - s); c.lineTo(p[0] + s, p[1] + s);
            c.moveTo(p[0] - s, p[1] + s); c.lineTo(p[0] + s, p[1] - s);
          }
          c.stroke();
          label(c, '+' + elev[i].toFixed(1), p[0] + 6, p[1] - 6, seg(t, .7 + i * .08, 1.1 + i * .08) * .9);
        });
        // the site boundary and the chosen spot
        c.strokeStyle = INK;
        c.lineWidth = 1.7;
        c.beginPath();
        polyPart(c, ring, easeInOut(seg(t, 6, 7)), true);
        c.stroke();
        const k = easeBack(seg(t, 6.8, 7.3));
        if (k > 0) {
          c.strokeStyle = INK;
          c.lineWidth = 1;
          c.beginPath();
          c.arc(best[0], best[1], 8 * k, 0, TAU);
          c.moveTo(best[0] - 13 * k, best[1]); c.lineTo(best[0] + 13 * k, best[1]);
          c.moveTo(best[0], best[1] - 13 * k); c.lineTo(best[0], best[1] + 13 * k);
          c.stroke();
          const pulse = ((t - 7.3) % 1.3) / 1.3;
          if (t > 7.3) {
            c.globalAlpha = 1 - pulse;
            c.beginPath();
            c.arc(best[0], best[1], 8 + pulse * 18, 0, TAU);
            c.stroke();
            c.globalAlpha = 1;
          }
        }
        // overall width of the site
        const d = seg(t, 7.1, 7.7);
        if (d > 0) {
          const y = Math.min(span[2] + 14, H - 10);
          c.strokeStyle = PEN;
          c.lineWidth = .8;
          c.beginPath();
          polyPart(c, [[span[0], y], [span[1], y]], easeOut(d), false);
          c.moveTo(span[0] - 3, y + 3); c.lineTo(span[0] + 3, y - 3);
          c.moveTo(span[1] - 3, y + 3); c.lineTo(span[1] + 3, y - 3);
          c.stroke();
          label(c, ((span[1] - span[0]) * .42).toFixed(1) + ' m', (span[0] + span[1]) / 2, y - 4, d, 'center');
        }
      },
    };
  }

  /* ------------------------------------------------------------ ٢ design: the golden section */

  function golden() {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const RW = 282, RH = RW / PHI, X0 = (W - RW) / 2, Y0 = (H - RH) / 2 - 6;
    let squares, pole, diags, flip;
    // one quarter circle per square, cut in turn from the left, top, right and bottom
    function build() {
      let r = { x: X0, y: Y0, w: RW, h: RH };
      const out = [];
      for (let k = 0; k < 10; k++) {
        const d = k % 4;
        let s, sx, sy, cx, cy, a, cut;
        if (d === 0) { s = r.h; sx = r.x; sy = r.y; cx = r.x + s; cy = r.y + s; a = Math.PI; cut = [[r.x + s, r.y], [r.x + s, r.y + s]]; r = { x: r.x + s, y: r.y, w: r.w - s, h: r.h }; }
        if (d === 1) { s = r.w; sx = r.x; sy = r.y; cx = r.x; cy = r.y + s; a = 1.5 * Math.PI; cut = [[r.x, r.y + s], [r.x + s, r.y + s]]; r = { x: r.x, y: r.y + s, w: r.w, h: r.h - s }; }
        if (d === 2) { s = r.h; sx = r.x + r.w - s; sy = r.y; cx = sx; cy = r.y; a = 0; cut = [[sx, r.y], [sx, r.y + s]]; r = { x: r.x, y: r.y, w: r.w - s, h: r.h }; }
        if (d === 3) { s = r.w; sx = r.x; sy = r.y + r.h - s; cx = r.x + s; cy = sy; a = .5 * Math.PI; cut = [[r.x, sy], [r.x + s, sy]]; r = { x: r.x, y: r.y, w: r.w, h: r.h - s }; }
        out.push({ s, sx, sy, cx, cy, a, cut });
      }
      for (let k = 0; k < 30; k++) {
        const d = k % 4, s = d % 2 ? r.w : r.h;
        if (d === 0) r = { x: r.x + s, y: r.y, w: r.w - s, h: r.h };
        if (d === 1) r = { x: r.x, y: r.y + s, w: r.w, h: r.h - s };
        if (d === 2) r = { x: r.x, y: r.y, w: r.w - s, h: r.h };
        if (d === 3) r = { x: r.x, y: r.y, w: r.w, h: r.h - s };
      }
      return { out, pole: [r.x + r.w / 2, r.y + r.h / 2] };
    }
    const spiralPoint = p => {          // a point a fraction p of the way along the spiral, outside in
      const n = squares.length, f = p * n, k = Math.min(n - 1, Math.floor(f)), q = squares[k], ang = q.a + (f - k) * Math.PI / 2;
      return [q.cx + Math.cos(ang) * q.s, q.cy + Math.sin(ang) * q.s];
    };
    return {
      L: 9.6,
      gen(r, loop) {
        flip = loop % 2 === 1;
        ({ out: squares, pole } = build());
        // the two diagonals that cross at the spiral's eye
        const R0 = [[X0, Y0 + RH], [X0 + RW, Y0]], R0b = [[X0, Y0], [X0 + RW, Y0 + RH]];
        const R1 = [[X0 + RH, Y0], [X0 + RW, Y0 + RH]], R1b = [[X0 + RH, Y0 + RH], [X0 + RW, Y0]];
        const dist = ([a, b]) => Math.abs((b[1] - a[1]) * pole[0] - (b[0] - a[0]) * pole[1] + b[0] * a[1] - b[1] * a[0]) / Math.hypot(b[1] - a[1], b[0] - a[0]);
        diags = [dist(R0) < dist(R0b) ? R0 : R0b, dist(R1) < dist(R1b) ? R1 : R1b];
      },
      draw(c, t) {
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.save();
        if (flip) { c.translate(W, 0); c.scale(-1, 1); }
        squares.forEach((q, k) => {
          const t0 = .8 + k * .42;
          const f = seg(t, t0 + .1, t0 + .5);
          if (f > 0) { c.fillStyle = tint((k % 2 ? .035 : .075) * f); c.fillRect(q.sx, q.sy, q.s, q.s); }
        });
        c.strokeStyle = INK;
        c.lineWidth = 1.2;
        c.beginPath();
        polyPart(c, [[X0, Y0], [X0 + RW, Y0], [X0 + RW, Y0 + RH], [X0, Y0 + RH]], easeInOut(seg(t, 0, .9)), true);
        c.stroke();
        c.strokeStyle = PEN;
        c.lineWidth = .8;
        c.beginPath();
        squares.forEach((q, k) => polyPart(c, q.cut, easeOut(seg(t, .8 + k * .42, 1.15 + k * .42)), false));
        c.stroke();
        c.strokeStyle = INK;
        c.lineWidth = 1.5;
        c.beginPath();
        squares.forEach((q, k) => {
          const p = easeInOut(seg(t, .95 + k * .42, 1.42 + k * .42));
          if (p <= 0) return;
          c.moveTo(q.cx + Math.cos(q.a) * q.s, q.cy + Math.sin(q.a) * q.s);
          c.arc(q.cx, q.cy, q.s, q.a, q.a + p * Math.PI / 2);
        });
        c.stroke();
        // diagonals meeting at the eye
        const dg = easeInOut(seg(t, 5, 5.8));
        if (dg > 0) {
          c.strokeStyle = PEN;
          c.lineWidth = .7;
          c.setLineDash([3, 3]);
          c.beginPath();
          diags.forEach(l => polyPart(c, l, dg, false));
          c.stroke();
          c.setLineDash([]);
        }
        // a pen point running along the spiral into its eye
        const run = seg(t, 5.4, 7.4);
        if (run > 0 && run < 1) {
          const [x, y] = spiralPoint(easeInOut(run));
          c.fillStyle = INK;
          c.beginPath();
          c.arc(x, y, 2.6, 0, TAU);
          c.fill();
          c.strokeStyle = tint(.35);
          c.lineWidth = 1;
          c.beginPath();
          c.arc(x, y, 6, 0, TAU);
          c.stroke();
        }
        const eye = seg(t, 7.2, 7.6);
        if (eye > 0) {
          const pulse = ((t - 7.2) % 1.4) / 1.4;
          c.fillStyle = INK;
          c.beginPath();
          c.arc(pole[0], pole[1], 2.4 * easeBack(eye), 0, TAU);
          c.fill();
          c.strokeStyle = INK;
          c.globalAlpha = 1 - pulse;
          c.beginPath();
          c.arc(pole[0], pole[1], 3 + pulse * 14, 0, TAU);
          c.stroke();
          c.globalAlpha = 1;
        }
        c.restore();
        // labels (never mirrored)
        const lx = x => (flip ? W - x : x);
        const lb = seg(t, 6.2, 7);
        if (lb > 0) {
          const y = Y0 + RH + 16, s0 = squares[0].s;
          const a = lx(X0), b = lx(X0 + s0), e = lx(X0 + RW);
          c.strokeStyle = PEN;
          c.lineWidth = .8;
          c.globalAlpha = lb;
          c.beginPath();
          c.moveTo(a, y); c.lineTo(e, y);
          [a, b, e].forEach(x => { c.moveTo(x - 3, y + 3); c.lineTo(x + 3, y - 3); });
          c.stroke();
          c.globalAlpha = 1;
          label(c, '1', (a + b) / 2, y - 4, lb, 'center');
          label(c, '0.618', (b + e) / 2, y - 4, lb, 'center');
          c.globalAlpha = lb;
          c.fillStyle = INK;
          c.font = 'italic 500 17px "Cormorant Garamond", serif';
          c.textAlign = flip ? 'left' : 'right';
          c.fillText('φ = 1.618', lx(X0 + RW - 6), Y0 - 7);
          c.globalAlpha = 1;
        }
      },
    };
  }

  /* ------------------------------------------------------------ ٣ execution: the assembly */

  function assembly() {
    const U = 22;
    const OX = 172, OY = 166;
    const iso = (x, y, z) => [OX + (x - y) * U * .866, OY + (x + y) * U * .5 - z * U];
    let blocks, maxH;
    const face = (c, pts, fill) => {
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fillStyle = PAPER;
      c.fill();
      c.fillStyle = fill;
      c.fill();
      c.stroke();
    };
    return {
      L: 9.6,
      gen(r) {
        // a terraced massing on a 4 × 3 plot: taller at the back, stepping down to the street
        const hts = [];
        for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) {
          const h = Math.round(4.2 - x * .55 - y * .85 + (r() - .5) * 1.4);
          hts.push({ x: x - 2, y: y - 1.5, h: clamp(h, 1, 4) });
        }
        maxH = Math.max(...hts.map(c => c.h));
        blocks = [];
        for (let z = 0; z < maxH; z++) {
          hts.filter(c => c.h > z).sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x).forEach(c => blocks.push({ x: c.x, y: c.y, z }));
        }
        const step = 4.3 / blocks.length;
        blocks.forEach((b, i) => { b.t0 = 1 + i * step; });
      },
      draw(c, t) {
        c.lineJoin = 'round';
        c.lineCap = 'round';
        // the plot and its grid
        const plot = [iso(-2.6, -2.1, 0), iso(2.6, -2.1, 0), iso(2.6, 2.1, 0), iso(-2.6, 2.1, 0)];
        c.strokeStyle = PEN;
        c.lineWidth = .8;
        c.setLineDash([4, 4]);
        c.beginPath();
        polyPart(c, plot, easeInOut(seg(t, 0, .9)), true);
        c.stroke();
        c.setLineDash([]);
        const g = seg(t, .4, 1.1);
        if (g > 0) {
          c.strokeStyle = tint(.25 * g);
          c.lineWidth = .6;
          c.beginPath();
          for (let x = -2; x <= 2; x++) { c.moveTo(...iso(x, -1.5, 0)); c.lineTo(...iso(x, 1.5, 0)); }
          for (let y = -1.5; y <= 1.5; y++) { c.moveTo(...iso(-2, y, 0)); c.lineTo(...iso(2, y, 0)); }
          c.stroke();
        }
        // blocks, back to front; each lowered on the crane cable
        let level = 0;
        const sorted = blocks.slice().sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
        c.strokeStyle = INK;
        c.lineWidth = .8;
        sorted.forEach(b => {
          const u = seg(t, b.t0, b.t0 + .45);
          if (u <= 0) return;
          if (u >= 1) level = Math.max(level, b.z + 1);
          const z = b.z + (1 - easeOut(u)) * 3.4;
          const { x, y } = b;
          const lit = seg(t, 5.9 + (x + y + 4) * .08, 6.3 + (x + y + 4) * .08) * (1 - seg(t, 6.8 + (x + y + 4) * .08, 7.4 + (x + y + 4) * .08));
          c.globalAlpha = seg(u, 0, .2);
          face(c, [iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x + 1, y + 1, z + 1), iso(x + 1, y, z + 1)], tint(.07));
          face(c, [iso(x, y + 1, z), iso(x + 1, y + 1, z), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], tint(.12));
          face(c, [iso(x, y, z + 1), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], tint(.16 + .22 * lit));
          if (u < 1) {
            const top = iso(x + .5, y + .5, z + 1);
            c.strokeStyle = PEN;
            c.lineWidth = .7;
            c.globalAlpha = .85 * (1 - u);
            c.beginPath();
            c.moveTo(top[0], 0);
            c.lineTo(top[0], top[1] - 4);
            c.moveTo(top[0] - 3, top[1] - 4); c.lineTo(top[0] + 3, top[1] - 4);
            c.stroke();
            c.strokeStyle = INK;
            c.lineWidth = .8;
          }
          c.globalAlpha = 1;
        });
        // level gauge on the side
        const gx = 330;
        const y0 = iso(2.6, 2.1, 0)[1];
        const yTop = y0 - level * U;
        c.strokeStyle = PEN;
        c.lineWidth = .8;
        c.beginPath();
        c.moveTo(gx, y0); c.lineTo(gx, y0 - maxH * U - 6);
        for (let z = 0; z <= maxH; z++) { c.moveTo(gx - 3, y0 - z * U); c.lineTo(gx, y0 - z * U); }
        c.stroke();
        if (level > 0) {
          c.fillStyle = INK;
          c.beginPath();
          c.moveTo(gx + 2, yTop); c.lineTo(gx + 8, yTop - 4); c.lineTo(gx + 8, yTop + 4); c.closePath();
          c.fill();
          label(c, '+' + (level * 3.5).toFixed(2), gx - 6, yTop - 4, 1, 'right');
        }
        // handed over: two trees by the street
        const tr = easeBack(seg(t, 6.6, 7.1));
        if (tr > 0) {
          [iso(-2.4, 1.95, 0), iso(2.4, 1.95, 0)].forEach(([x, y]) => {
            c.strokeStyle = INK;
            c.lineWidth = .8;
            c.beginPath();
            c.moveTo(x, y); c.lineTo(x, y - 9 * tr);
            c.stroke();
            c.fillStyle = tint(.14);
            c.beginPath();
            c.arc(x, y - 13 * tr, 6 * tr, 0, TAU);
            c.fill();
            c.stroke();
          });
        }
      },
    };
  }

  /* ------------------------------------------------------------ runner */
  // With a mouse: the drawing builds once when its sheet comes into view and holds its finished
  // state; hovering the sheet redraws it from nothing (each time a new variation).
  // Touch screens: it loops on its own while on screen.

  const SCENES = { survey, golden, assembly };
  const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const HOLD = 7.9;                       // the finished state, before the loop's fade-out
  Array.from(root.querySelectorAll('.svc-canvas')).forEach((canvas, i) => {
    const scene = SCENES[canvas.dataset.scene]();
    const ctx = canvas.getContext('2d');
    let dpr = 1, scale = 1, loop = 0, t0 = null, raf = 0, visible = false, last = reduceMotion ? HOLD : -1;
    scene.gen(rng(7 + i * 101), loop);
    const paint = t => {
      last = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (t < 0) return;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.direction = 'ltr';             // the page is RTL; levels like +611.2 must read left to right
      ctx.globalAlpha = 1 - seg(t, scene.L - .8, scene.L);
      ctx.save();
      scene.draw(ctx, t);
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      const w = canvas.clientWidth || W;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * H / W * dpr);
      scale = w / W;
      paint(last);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
    if (reduceMotion) return;

    const frame = now => {
      if (!visible && !hoverable) { raf = 0; return; }
      if (t0 === null) t0 = now;
      let t = (now - t0) / 1000;
      if (hoverable && t >= HOLD) { paint(HOLD); raf = 0; return; }   // hold the finished drawing
      if (t > scene.L) {
        loop++;
        scene.gen(rng(7 + i * 101 + loop * 977), loop);
        t0 = now;
        t = 0;
      }
      paint(t);
      raf = requestAnimationFrame(frame);
    };
    const play = delay => {
      t0 = performance.now() + delay;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const lag = window.matchMedia('(min-width: 901px)').matches ? i * 450 : 0;
    let shown = false;
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (!visible) return;
      if (!hoverable) { if (!raf) play(500 + lag); return; }
      if (!shown) { shown = true; play(500 + lag); }
    }, { threshold: .25 }).observe(canvas);

    if (hoverable) {
      canvas.closest('.svc').addEventListener('pointerenter', () => {
        if (!shown) return;
        loop++;
        scene.gen(rng(7 + i * 101 + loop * 977), loop);
        play(0);
      });
    }
  });

  /* ------------------------------------------------------------ entrance */

  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined' || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  const q = gsap.utils.selector(root);

  gsap.timeline({ scrollTrigger: { trigger: q('.sheet-head')[0], start: 'top 85%' } })
    .from(q('.sheet-rule'), { scaleX: 0, duration: 1.4, ease: 'power3.inOut' })
    .from(q('.sheet-label'), { opacity: 0, y: 12, duration: .8, ease: 'power3.out' }, 0);

  gsap.timeline({ scrollTrigger: { trigger: q('.svc-intro')[0], start: 'top 82%' } })
    .from(q('.svc-heading, .svc-heading-en, .svc-lead'), { opacity: 0, y: 24, duration: .9, stagger: .1, ease: 'power3.out' });

  const sideBySide = window.matchMedia('(min-width: 901px)').matches;
  Array.from(root.querySelectorAll('.svc')).forEach((svc, i) => {
    const tl = gsap.timeline({ delay: sideBySide ? i * .45 : 0, scrollTrigger: { trigger: svc, start: 'top 78%' } })
      .from(svc, { opacity: 0, y: 30, duration: .9, ease: 'power3.out' })
      .from(svc.querySelectorAll('.svc-title, .svc-desc, .svc-list li, .svc-foot'), { opacity: 0, y: 14, duration: .7, stagger: .06, ease: 'power3.out' }, .4);
    const link = svc.querySelector('.svc-link');
    if (link) tl.from(link, { [sideBySide ? 'scaleX' : 'scaleY']: 0, duration: .8, ease: 'power3.inOut' }, 1.2);
  });

  gsap.from(q('.svc-cta > *'), {
    opacity: 0, y: 20, duration: .9, stagger: .1, ease: 'power3.out',
    scrollTrigger: { trigger: q('.svc-cta')[0], start: 'top 88%' },
  });
})();

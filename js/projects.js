/* =====================================================================
   RAWAND — Projects (مشاريعنا) · sheet A-04
   Every project sheet gets a line drawing (villa elevation, office tower, community centre,
   master plan). The set is pinned and slides sideways (phones too); each sheet drafts
   itself as it reaches the middle. Very short screens (landscape phones) get a plain list. Needs gsap + ScrollTrigger (already loaded for the hero).
   Without them, or with reduced motion, it stays a plain list with finished drawings.
   Projects added on the dashboard (/auth → api/index.php) replace the sample sheets: a photo
   sheet whose cover is "developed" — wiped in by a pen line, burgundy print → full colour.
   Without the API (static hosting) or before the first project is published, the samples stay.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('projects');
  if (!root) return;

  const NS = 'http://www.w3.org/2000/svg';
  const f1 = v => Math.round(v * 10) / 10;

  // A tiny pen: every stroke gets pathLength=1 so it can be drawn with a dash offset.
  function pen(svg) {
    const add = (tag, attrs, cls) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      n.setAttribute('class', cls);
      svg.appendChild(n);
      return n;
    };
    return {
      path: (d, cls = 'ln') => add('path', { d, pathLength: 1 }, cls),
      line: (x1, y1, x2, y2, cls = 'ln') => add('path', { d: `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`, pathLength: 1 }, cls),
      poly: (pts, cls = 'ln', close = true) => add('path', { d: 'M' + pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + (close ? 'Z' : ''), pathLength: 1 }, cls),
      circle: (cx, cy, r, cls = 'ln') => add('circle', { cx, cy, r, pathLength: 1 }, cls),
      text: (x, y, s, cls = 'lbl') => {
        const t = add('text', { x, y, 'text-anchor': 'middle' }, cls);
        t.textContent = s;
        return t;
      },
    };
  }

  // shared drafting bits — all elevations stand on the same ground line
  const G = 290;
  const ground = p => {
    p.line(14, G, 506, G, 'ln bold');
    let d = '';
    for (let x = 26; x <= 500; x += 12) d += `M${x} ${G + 1}L${x - 7} ${G + 9}`;
    p.path(d, 'ln thin');
  };
  const person = (p, x) => {
    p.circle(x, G - 28, 3);
    p.path(`M${x} ${G - 25}V${G - 11}L${x - 3} ${G}M${x} ${G - 11}L${x + 3} ${G}M${x - 4} ${G - 14}L${x} ${G - 22}L${x + 4} ${G - 14}`);
  };
  const level = (p, x, y, t) => {
    p.poly([[x, y], [x - 5, y - 6], [x + 5, y - 6]]);
    p.text(x, y - 10, t);
  };
  const tree = (p, x, y, r) => {
    p.line(x, G, x, y + r * .7);
    p.circle(x, y, r);
    p.circle(x, y, r * .55, 'ln thin');
  };
  const dots = (pts, r) => pts.map(([x, y]) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`).join('');

  const DRAWINGS = {
    // ٠١ — villa, south elevation: Najdi crenellations, three slit windows, mashrabiya, palm
    villa(p) {
      p.path('M90 130H300V290H90ZM300 210H440V290H300Z', 'acc');
      ground(p);
      p.path('M24 290V248H84V290');
      p.path('M90 290V130H300V290', 'ln bold');
      p.path('M300 290V210H440V290', 'ln bold');
      p.line(90, 210, 300, 210, 'ln thin');
      let d = '';
      for (let x = 90; x < 300; x += 15) d += `M${x} 130L${x + 7.5} 119L${x + 15} 130`;
      p.path(d);
      [118, 136, 154].forEach(x => p.path(`M${x} 148H${x + 8}V196H${x}Z`));
      p.path('M196 146H282V198H196Z');
      d = '';
      for (let x = 204; x < 282; x += 8) d += `M${x} 146V198`;
      for (let y = 154; y < 198; y += 8) d += `M196 ${y}H282`;
      p.path(d, 'ln thin');
      p.path('M106 290V228H190V290');
      p.path('M134 228V290M162 228V290', 'ln thin');
      p.path('M226 290V234H260V290');
      p.line(216, 226, 270, 226, 'ln bold');
      p.path('M318 232H420V262H318Z');
      p.path('M352 232V262M386 232V262', 'ln thin');
      p.path('M440 210H488M484 210V290');
      d = '';
      for (let x = 446; x <= 482; x += 6) d += `M${x} 205V215`;
      p.path(d, 'ln thin');
      p.path('M58 290C61 245 55 205 64 162');
      p.path('M64 162q-20-8-38 6M64 162q-16-16-36-12M64 162q2-20-10-32M64 162q14-16 34-12M64 162q20-4 36 12M64 162q12 8 22 24');
      person(p, 280);
      p.path('M300 130H500M488 210H500', 'dash');
      level(p, 506, 290, '±0.00');
      level(p, 506, 210, '+3.50');
      level(p, 506, 130, '+7.00');
      p.path('M90 112V94M440 196V94', 'ln thin');
      p.line(90, 100, 440, 100);
      p.line(86, 104, 94, 96);
      p.line(436, 104, 444, 96);
      p.text(265, 94, '22.40');
    },

    // ٠٢ — office tower, east elevation: podium, rippling vertical fins, rooftop screen
    tower(p) {
      p.path('M180 40H340V230H180Z', 'acc');
      p.path('M24 290V150H104V290M430 290V178H498V290', 'dash');
      ground(p);
      p.path('M124 290V230H396V290', 'ln bold');
      p.line(124, 240, 396, 240, 'ln thin');
      let d = '';
      for (let x = 144; x <= 376; x += 20) d += `M${x} 240V290`;
      p.path(d, 'ln thin');
      p.path('M208 246H312L306 252H214Z');
      p.path('M180 230V40H340V230', 'ln bold');
      d = '';
      for (let y = 59; y < 230; y += 19) d += `M180 ${y}H340`;
      p.path(d, 'ln thin');
      d = '';
      for (let i = 1; i < 16; i++) d += `M${f1(180 + i * 10 + Math.sin(i * .9) * 2.5)} 44V230`;
      p.path(d);
      p.path('M214 40V22H306V40');
      d = '';
      for (let y = 27; y < 40; y += 4) d += `M214 ${y}H306`;
      p.path(d, 'ln thin');
      tree(p, 92, 246, 18);
      tree(p, 464, 250, 16);
      person(p, 236);
      person(p, 288);
      p.path('M340 40H406', 'dash');
      level(p, 412, 40, '+42.00');
      level(p, 412, 290, '±0.00');
    },

    // ٠٣ — community centre, north elevation: arcade, perforated band, wind tower (barjeel)
    center(p) {
      const arcade = close => {
        let d = '';
        for (let i = 0; i < 7; i++) {
          const x = 92 + i * 50;
          d += `M${x} 290V232A18 18 0 0 1 ${x + 36} 232V290${close ? 'Z' : ''}`;
        }
        return d;
      };
      p.path(arcade(true), 'acc');
      tree(p, 34, 212, 24);
      ground(p);
      p.path('M64 290V176H456V290', 'ln bold');
      p.path('M44 168H476V176H44Z');
      p.line(64, 206, 456, 206, 'ln thin');
      const holes = [];
      for (let row = 0; row < 2; row++) for (let x = 82 + row * 7; x < 442; x += 14) holes.push([x, 186 + row * 11]);
      p.path(dots(holes, 2.2), 'ln thin');
      p.path(arcade(false));
      p.path('M396 168V104H436V168', 'ln bold');
      p.line(390, 104, 442, 104);
      [403, 413, 423].forEach(x => p.path(`M${x} 112H${x + 6}V142H${x}Z`));
      person(p, 210);
      person(p, 470);
      p.path('M476 168H494M442 104H494', 'dash');
      level(p, 500, 290, '±0.00');
      level(p, 500, 168, '+6.00');
      level(p, 500, 104, '+9.50');
    },

    // ٠٤ — master plan: boulevard + roundabout, perimeter blocks, green park, north arrow
    plan(p) {
      p.path('M290 44H474V146H290Z', 'acc');
      p.poly([[34, 30], [486, 22], [500, 306], [24, 316]], 'dash');
      p.path('M30 160H232M280 160H496M30 176H232M280 176H496M248 26V144M264 26V144M248 192V312M264 192V312', 'ln bold');
      p.circle(256, 168, 24);
      p.circle(256, 168, 10, 'ln thin');
      let d = '', c = '';
      for (const x of [48, 112, 176]) for (const y of [44, 104]) {
        d += `M${x} ${y}h52v44h-52Z`;
        c += `M${x + 10} ${y + 10}h32v24h-32Z`;
      }
      for (const x of [284, 352, 420]) for (const y of [194, 254]) {
        d += `M${x} ${y}h56v44h-56Z`;
        c += `M${x + 10} ${y + 10}h36v24h-36Z`;
      }
      p.path(d);
      p.path(c, 'ln thin');
      p.path('M48 196H136V296H48ZM148 196H228V296H148Z');
      p.path('M58 206H126V286H58ZM158 206H218V286H158Z', 'ln thin');
      p.path('M290 44H474V146H290Z', 'ln thin');
      p.path('M290 138C330 112 360 134 398 100S456 62 474 54');
      p.path('M394 128a22 11 0 1 0 44 0a22 11 0 1 0 -44 0');
      p.path(dots([[306, 60], [324, 74], [300, 96], [346, 58], [372, 70], [420, 92], [452, 80], [450, 108], [462, 132], [312, 112], [356, 98], [410, 64]], 4.5));
      p.text(138, 100, T('سكني', 'Homes'), EN ? 'lbl' : 'lbl ar');
      p.text(382, 250, T('سكني', 'Homes'), EN ? 'lbl' : 'lbl ar');
      p.text(138, 191, T('تجاري', 'Retail'), EN ? 'lbl' : 'lbl ar');
      p.text(384, 88, T('حديقة', 'Park'), EN ? 'lbl' : 'lbl ar');
      p.circle(504, 44, 11, 'ln thin');
      p.poly([[504, 30], [509, 52], [504, 47], [499, 52]]);
      p.poly([[504, 30], [504, 47], [499, 52]], 'solid');
      p.text(504, 24, 'N');
      p.line(24, 330, 104, 330);
      [24, 44, 64, 84, 104].forEach((x, i) => p.line(x, 326, x, i % 2 ? 330 : 334, 'ln thin'));
      p.text(64, 344, '0     100     200 m');
    },
  };

  const EN = window.RW_LANG === 'en';
  const T = window.rwT || (a => a);
  const digits = v => (EN ? String(v) : String(v).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]));
  // the page's language first; the other one as the accent
  const pick = o => (o ? (EN ? o.en || o.ar : o.ar || o.en) : '') || '';
  const other = o => (o ? (EN ? o.ar : o.en) : '') || '';
  const ACC = EN ? 'ar' : 'en';

  /* ------------------------------------------------------------ projects from the dashboard */

  const UNITS = EN ? { m2: 'm²', ha: 'ha' } : { m2: 'م²', ha: 'هكتار' };
  function area(p) {
    const n = Number(String(p.area).replace(/[,٬\s]/g, ''));
    return (Number.isFinite(n) ? n.toLocaleString(EN ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 }) : digits(p.area)) + ' ' + (UNITS[p.areaUnit] || UNITS.m2);
  }
  function el(tag, cls, text, lang) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (lang) n.lang = lang;
    return n;
  }

  function photoSheet(p, i) {
    const li = el('li', 'prj prj-has-photo');
    const sheet = el('article', 'prj-sheet');
    sheet.setAttribute('aria-labelledby', 'prj-' + p.id);

    const info = el('div', 'prj-info');
    const top = el('header', 'prj-top');
    if (p.category.ar || p.category.en) {
      const cat = el('span', 'prj-cat', pick(p.category) + ' ');
      if (other(p.category)) cat.append(el('span', null, other(p.category), ACC));
      top.append(cat);
    }
    const title = el('h3', 'prj-title');
    title.id = 'prj-' + p.id;
    const link = el('a', 'prj-link', pick(p.title));
    link.href = 'project.html?id=' + encodeURIComponent(p.id);
    title.append(link, ' ', el('span', 'prj-en', other(p.title), ACC));
    info.append(top, title);
    if (pick(p.summary)) info.append(el('p', 'prj-desc', pick(p.summary)));

    const meta = el('dl', 'prj-meta');
    const fact = (k, v) => {
      const d = el('div');
      d.append(el('dt', null, k), el('dd', null, v));
      meta.append(d);
    };
    if (pick(p.location)) fact(T('الموقع', 'Location'), pick(p.location));
    if (p.year) fact(T('السنة', 'Year'), digits(p.year));
    if (p.area) fact(T('المساحة', 'Area'), area(p));
    info.append(meta);

    const phases = el('ol', 'prj-phases');
    [['consult', T('استشارة', 'Consulting')], ['design', T('تصميم', 'Design')], ['build', T('تنفيذ', 'Execution')]].forEach(([k, t]) => {
      const on = !!(p.scope && p.scope[k]);
      const x = el('li', on ? 'is-on' : null, t);
      if (!on) x.setAttribute('aria-hidden', 'true');
      phases.append(x);
    });
    const scope = el('div', 'prj-scope');
    scope.append(el('span', 'prj-scope-label', T('نطاق عملنا', 'Our scope')), phases);
    info.append(scope);

    const film = !!(p.video || p.videoUrl);
    const cover = p.images[0];
    const photo = el('div', 'prj-photo');
    const img = el('img');
    img.src = cover.src;
    img.alt = '';
    img.decoding = 'async';
    if (i > 1) img.loading = 'lazy';
    photo.append(img, el('i', 'prj-scan'));
    if (film) {
      const badge = el('span', 'prj-film', T('فيلم', 'Film'));
      badge.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z"/></svg>');
      photo.append(badge);
    }
    const n = p.images.length;
    const cap = el('figcaption', 'prj-cap');
    cap.dir = 'ltr';
    const go = el('span', 'prj-go', T('عرض المشروع', 'View project'));
    go.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5"/></svg>');
    cap.append(el('span', null, `${String(n).padStart(2, '0')} ${n === 1 ? 'Photograph' : 'Photographs'}${film ? ' · Film' : ''}`, 'en'), go);
    const fig = el('figure', 'prj-figure');
    fig.append(photo, cap);

    sheet.append(info, fig);
    li.append(sheet);
    return li;
  }

  function useProjects(list) {
    root.querySelectorAll('.prj').forEach(li => li.remove());
    const next = root.querySelector('.prj-next');
    list.forEach((p, i) => next.before(photoSheet(p, i)));
  }

  // wait for the list — briefly: if the API is slow or missing, the samples are shown
  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    start();
  };
  setTimeout(begin, 2500);
  fetch('api/?action=projects', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const list = d && d.ok && Array.isArray(d.projects) ? d.projects.filter(p => p.images && p.images.length) : [];
      if (!started && list.length) useProjects(list);
    })
    .catch(() => {})
    .then(begin);

  function start() {
  const sheets = Array.from(root.querySelectorAll('.prj, .prj-next'));
  const projects = sheets.filter(li => li.classList.contains('prj'));
  projects.forEach(li => {
    const svg = li.querySelector('.prj-drawing');
    if (svg) DRAWINGS[svg.dataset.drawing](pen(svg));
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined' || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  // phones: the address bar showing/hiding must not re-measure the pinned slide mid-swipe
  ScrollTrigger.config({ ignoreMobileResize: true });

  const q = gsap.utils.selector(root);
  const clamp = gsap.utils.clamp(0, 1);
  const stage = q('.prj-stage')[0];
  const rail = q('.prj-rail')[0];
  const track = q('.prj-track')[0];
  const paper = q('.projects-paper')[0];
  const fill = q('.prj-bar i')[0];

  // One paused timeline per sheet: the text settles, the drawing is drafted, then labels appear.
  function drafting(li) {
    const tl = gsap.timeline({ paused: true });
    const svg = li.querySelector('.prj-drawing');
    if (svg) {
      tl.fromTo(svg.querySelectorAll('.ln'), { strokeDasharray: '1 2', strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: .5, stagger: { amount: .5 }, ease: 'none' }, 0)
        .fromTo(svg.querySelectorAll('.dash, .lbl, .solid'), { opacity: 0 },
          { opacity: 1, duration: .2, stagger: .01, ease: 'none' }, .75);
    }
    // a photo sheet: the pen line wipes the cover in, then the burgundy print turns to colour
    const photo = li.querySelector('.prj-photo');
    if (photo) {
      tl.fromTo(photo, { '--wipe': 1 }, { '--wipe': 0, duration: .6, ease: 'power1.inOut' }, 0)
        .fromTo(photo, { '--ink': 1 }, { '--ink': 0, duration: .4, ease: 'none' }, .55);
    }
    tl.fromTo(li.querySelectorAll('.prj-top, .prj-title, .prj-desc, .prj-meta > div, .prj-scope, .prj-cap, .prj-next-sheet > *'),
      { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .25, stagger: .04, ease: 'power2.out' }, .05);
    return tl;
  }

  const mm = gsap.matchMedia();
  mm.add({
    rail: '(min-height: 520px)',
    list: 'not all and (min-height: 520px)',
  }, ctx => {
    const tls = sheets.map(drafting);

    // very short screens: a plain list, each sheet drafted as it scrolls up the screen
    if (ctx.conditions.list) {
      sheets.forEach((li, i) => ScrollTrigger.create({ trigger: li, start: 'top 88%', end: 'top 30%', scrub: .6, animation: tls[i] }));
      return undefined;
    }

    // pin the stage and slide the set to the right (it reads right → left)
    root.classList.add('is-rail');
    const dist = () => Math.max(0, track.offsetWidth - rail.clientWidth);
    const slide = gsap.to(track, {
      x: () => (EN ? -dist() : dist()),           // Arabic reads on to the left (slide right), English to the right
      ease: 'none',
      scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
    });

    // Each sheet's drafting follows its place on screen: rising into view, then sliding to the middle
    // (or, for the last sheets that never reach the middle, to where the slide stops).
    const done = sheets.map(() => -1);
    let live = false;
    function update() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ahead = dist() - Math.abs(gsap.getProperty(track, 'x'));
      sheets.forEach((li, i) => {
        const r = li.getBoundingClientRect();
        const edge = EN ? vw - r.left : r.right;       // how far the sheet has come in from the side it enters
        const goal = Math.min((vw + r.width) * .46, (edge + ahead) * .92);
        const p = Math.min(clamp((vh - r.top) / (vh * .55)), clamp(edge / goal));
        if (Math.abs(p - done[i]) > .0005) {
          done[i] = p;
          tls[i].progress(p);
        }
      });
      fill.style.transform = `scaleX(${slide.progress()})`;
      paper.style.backgroundPosition = `${gsap.getProperty(track, 'x')}px 0`;
    }
    const tick = () => { if (live) update(); };
    ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', onToggle: self => { live = self.isActive; }, onRefresh: update });
    gsap.ticker.add(tick);
    update();

    // keyboard: when something inside an off-screen sheet gets focus, scroll so that sheet is centred
    const onFocus = e => {
      const li = e.target.closest('.prj, .prj-next');
      const st = slide.scrollTrigger;
      if (!li || !st || !dist()) return;
      const r = li.getBoundingClientRect();
      const x = gsap.getProperty(track, 'x') + window.innerWidth / 2 - (r.left + r.width / 2);
      const along = gsap.utils.clamp(0, dist(), EN ? -x : x);
      window.scrollTo(0, st.start + (st.end - st.start) * along / dist());
    };
    track.addEventListener('focusin', onFocus);

    return () => {
      gsap.ticker.remove(tick);
      track.removeEventListener('focusin', onFocus);
      root.classList.remove('is-rail');
      paper.style.backgroundPosition = '';
      fill.style.transform = '';
    };
  });

  // header + opening words, like every other sheet
  gsap.timeline({ scrollTrigger: { trigger: q('.sheet-head')[0], start: 'top 85%' } })
    .from(q('.sheet-rule'), { scaleX: 0, duration: 1.4, ease: 'power3.inOut' })
    .from(q('.sheet-label'), { opacity: 0, y: 12, duration: .8, stagger: .1, ease: 'power3.out' }, 0);
  gsap.from(q('.prj-lead > *'), {
    opacity: 0, y: 24, duration: .9, stagger: .1, ease: 'power3.out',
    scrollTrigger: { trigger: q('.prj-lead')[0], start: 'top 82%' },
  });
  // the pinned slide may be added after the rest of the page was measured
  ScrollTrigger.refresh();
  }
})();

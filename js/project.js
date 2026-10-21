/* =====================================================================
   RAWAND — one project (project.html?id=…)
   Reads the project from the API (window.RAWAND_API → /project) and fills the sheet: title block, cover,
   Arabic + English text (the page's language first, the other as the accent), the films (up to three: uploaded
   files, and/or YouTube/Vimeo links that only load on click), the photographs and a photo viewer. Photos are "developed" like the home-page
   sheets: a pen line wipes them in, then the burgundy print turns to colour.
   gsap / ScrollTrigger are optional (without them, or with reduced motion, nothing moves).
   ===================================================================== */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const EN = window.RW_LANG === 'en';
  const T = window.rwT || (a => a);
  const arDigits = v => String(v).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const digits = v => (EN ? String(v) : arDigits(v));
  const pad2 = n => String(n).padStart(2, '0');
  const UNITS = { m2: ['م²', 'm²'], ha: ['هكتار', 'ha'] };
  const PHASES = [['consult', T('استشارة', 'Consulting')], ['design', T('تصميم', 'Design')], ['build', T('تنفيذ', 'Execution')]];
  // the page's language first; the other one as the accent
  const pick = o => (EN ? o.en || o.ar : o.ar || o.en) || '';
  const other = o => (EN ? o.ar : o.en) || '';
  const ACC = EN ? 'ar' : 'en';
  const motion = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text, lang) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (lang) {
      n.lang = lang;
      n.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    return n;
  }

  const id = new URLSearchParams(location.search).get('id') || '';
  // signed in on /auth (same browser)? then drafts can be previewed too
  const API = String(window.RAWAND_API || '').replace(/\/+$/, '');
  // stored photo/video addresses → the address this site fetches them from (js/config.js)
  const media = u => (typeof window.RAWAND_MEDIA === 'function' ? window.RAWAND_MEDIA(u) : u);
  const headers = {};
  try {
    const t = JSON.parse(localStorage.getItem('rw-admin') || 'null');
    if (t && t.token && t.exp > Date.now()) headers.Authorization = 'Bearer ' + t.token;
  } catch (e) { /* no token */ }
  (API ? window.RAWAND_FETCH('/project?id=' + encodeURIComponent(id), { cache: 'no-store', headers }) : Promise.reject(new Error('no API')))
    .then(r => r.json().then(d => (r.ok && d.ok ? d : Promise.reject(d))))
    .then(render)
    .catch(missing);

  function missing() {
    $('#pj').hidden = true;
    $('#pjMissing').hidden = false;
    document.title = T('المشروع غير موجود | روند RAWAND', 'Project not found | RAWAND');
  }

  function area(p, lang) {
    const n = Number(String(p.area).replace(/[,٬\s]/g, ''));
    const unit = (UNITS[p.areaUnit] || UNITS.m2)[lang === 'ar' ? 0 : 1];
    if (!Number.isFinite(n)) return (lang === 'ar' ? arDigits(p.area) : p.area) + ' ' + unit;
    return n.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 }) + ' ' + unit;
  }

  // blank line = new paragraph, single line break kept
  function paragraphs(box, text) {
    text.trim().split(/\n\s*\n/).forEach(par => {
      const p = el('p');
      par.split('\n').forEach((line, i) => {
        if (i) p.append(el('br'));
        p.append(line);
      });
      box.append(p);
    });
  }

  function embedUrl(link) {
    let u;
    try { u = new URL(link); } catch (e) { return ''; }
    const host = u.hostname.replace(/^(www|m)\./, '');
    let yt = '';
    if (host === 'youtu.be') yt = u.pathname.slice(1);
    else if (host === 'youtube.com') yt = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1] || '';
    if (/^[\w-]{6,}$/.test(yt)) return 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0';
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const v = (u.pathname.match(/(\d{5,})/) || [])[1];
      if (v) return 'https://player.vimeo.com/video/' + v + '?autoplay=1';
    }
    return '';
  }

  function render({ project: p, total, prev, next }) {
    const imgs = p.images || [];
    const cover = imgs[0];
    // the films in order (a project saved before the list: its one file and/or one link)
    const films = (Array.isArray(p.videos) ? p.videos : [...(p.video ? [p.video] : []), ...(p.videoUrl ? [{ url: p.videoUrl }] : [])])
      .filter(v => v.src || (v.url && embedUrl(v.url)));
    const film = films.length > 0;

    document.title = `${pick(p.title)} | ${T('روند RAWAND', 'RAWAND')}`;
    if (pick(p.summary)) document.querySelector('meta[name="description"]').setAttribute('content', pick(p.summary));
    $('#pjDraft').hidden = !!p.published;

    // title
    const cat = $('#pjCat');
    cat.textContent = pick(p.category);
    if (other(p.category)) cat.append(el('span', null, other(p.category), ACC));
    cat.hidden = !p.category.ar && !p.category.en;
    $('#pjTitle').textContent = pick(p.title);
    const sub = $('#pjTitleEn');
    sub.textContent = other(p.title);
    sub.lang = ACC;
    sub.dir = ACC === 'ar' ? 'rtl' : 'ltr';

    // title block
    const facts = $('#pjFacts');
    const fact = (ar, en, value, sub) => {
      const box = el('div');
      const dt = el('dt', null, EN ? en : ar);
      dt.append(el('small', null, EN ? ar : en, ACC));
      const dd = el('dd');
      dd.append(value);
      if (sub) dd.append(el('small', null, sub, ACC));
      box.append(dt, dd);
      facts.append(box);
    };
    if (p.location.ar || p.location.en) fact('الموقع', 'Location', pick(p.location), p.location.ar && p.location.en ? other(p.location) : '');
    if (p.year) fact('السنة', 'Year', digits(p.year));
    if (p.area) fact('المساحة', 'Area', area(p, EN ? 'en' : 'ar'), area(p, ACC));
    const phases = el('ul', 'pj-phases');
    PHASES.forEach(([k, t]) => {
      const on = !!(p.scope && p.scope[k]);
      const li = el('li', on ? 'is-on' : null, t);
      if (!on) li.setAttribute('aria-hidden', 'true');
      phases.append(li);
    });
    // the scope always gets the full bottom row of the title block
    if (facts.children.length % 2) facts.lastElementChild.style.gridColumn = '1 / -1';
    fact('نطاق عملنا', 'Scope', phases);
    facts.lastElementChild.style.gridColumn = '1 / -1';

    // cover — framed close to its own proportions (between 4:3 and 21:9)
    const coverBtn = $('#pjCover .pj-photo');
    const coverImg = $('#pjCoverImg');
    if (cover) {
      if (cover.w && cover.h) {
        coverImg.width = cover.w;
        coverImg.height = cover.h;
        coverBtn.style.setProperty('--ar', Math.max(4 / 3, Math.min(21 / 9, cover.w / cover.h)));
      }
      if (motion) gsap.set(coverBtn, { '--wipe': 1, '--ink': 1 });
      coverImg.src = media(cover.src);
      coverImg.alt = pick(p.title);
    } else $('#pjCover').hidden = true;
    $('#pjCapL').textContent = `${pad2(imgs.length)} ${imgs.length === 1 ? 'Photograph' : 'Photographs'}${film ? (films.length > 1 ? ` · ${films.length} Films` : ' · Film') : ''}`;
    $('#pjCapR').textContent = [p.location.en, p.year].filter(Boolean).join(' · ');

    // text: in the page's language only (the short summary if there is no full text);
    // the other language stands in only when the project has no text in this one
    const ar = (p.description.ar || p.summary.ar || '').trim();
    const en = (p.description.en || p.summary.en || '').trim();
    const useEn = EN ? !!en : !ar && !!en;
    const useAr = !useEn && !!ar;
    if (useAr) paragraphs($('#pjDescAr'), ar);
    if (useEn) paragraphs($('#pjDescEn'), en);
    $('#pjTextAr').hidden = !useAr;
    $('#pjTextEn').hidden = !useEn;
    $('#pjAbout').hidden = !useAr && !useEn;
    $('#pjAbout').classList.add('is-single');

    // films: the uploaded files play in place; a link loads its player only when asked for
    const first = $('#pjFilmFrame');
    films.forEach((m, i) => {
      const frame = i ? el('div', 'pj-film-frame') : first;
      if (i) $('#pjFilm').append(frame);
      if (m.src) {
        const v = el('video');
        v.controls = true;
        v.preload = 'metadata';
        v.playsInline = true;
        if (cover) v.poster = media(cover.src);
        v.src = media(m.src);
        frame.append(v);
      } else {
        const play = el('button', 'pj-play');
        play.type = 'button';
        if (cover) play.style.backgroundImage = `url("${media(cover.src)}")`;
        const n = films.length > 1 ? ' ' + digits(i + 1) : '';
        const label = el('span', null, T('تشغيل الفيلم', 'Play the film') + n);
        label.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z"/></svg>');
        play.append(label);
        play.addEventListener('click', () => {
          const f = el('iframe');
          f.src = embedUrl(m.url);
          f.title = pick(p.title);
          f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
          f.allowFullscreen = true;
          play.replaceWith(f);
        });
        frame.append(play);
      }
    });
    if (film) {
      $('#pjFilm').hidden = false;
      if (films.length > 1) {
        const h2 = $('#pjFilmTitle');
        h2.firstChild.textContent = T('أفلام المشروع ', 'Project films ');
        const small = h2.querySelector('small');
        if (small) small.textContent = EN ? 'أفلام' : 'Films';
      }
    }

    // photographs (the cover is the first in the viewer, but is not repeated here)
    const grid = $('#pjGrid');
    imgs.slice(1).forEach((m, i) => {
      const li = el('li');
      const btn = el('button', 'pj-photo pj-open');
      btn.type = 'button';
      btn.dataset.index = String(i + 1);
      btn.setAttribute('aria-label', T(`صورة ${digits(i + 2)} — عرض بالحجم الكامل`, `Photo ${i + 2} — view full size`));
      const img = el('img');
      if (m.w && m.h) { img.width = m.w; img.height = m.h; }
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.src = media(m.src);
      btn.append(img, el('i', 'pj-scan'));
      li.append(btn);
      grid.append(li);
    });
    $('#pjGallery').hidden = imgs.length < 2;

    // previous / next
    if (total > 1 && next) {
      const nav = $('#pjNav');
      const card = (q, label, cls) => {
        const a = el('a', 'pj-near ' + cls);
        a.href = 'project.html?id=' + encodeURIComponent(q.id);
        if (q.cover) {
          const im = el('img');
          im.src = media(q.cover);
          im.alt = '';
          im.loading = 'lazy';
          a.append(im);
        }
        const t = el('span');
        t.append(el('span', 'pj-near-label', label), el('span', 'pj-near-title', pick(q.title)), el('span', 'pj-near-en', other(q.title), ACC));
        a.append(t);
        return a;
      };
      if (prev && prev.id !== next.id) nav.append(card(prev, T('المشروع السابق', 'Previous project'), 'is-prev'));
      nav.append(card(next, T('المشروع التالي', 'Next project'), 'is-next'));
      nav.hidden = false;
    }

    const pj = $('#pj');
    pj.classList.remove('is-loading');
    pj.removeAttribute('aria-busy');

    viewer(imgs);
    animate(coverBtn, coverImg);
  }

  /* ------------------------------------------------------------ photo viewer */

  function viewer(imgs) {
    if (!imgs.length) return;
    const lb = $('#lb');
    const img = $('#lbImg');
    let at = 0;
    lb.classList.toggle('is-single', imgs.length < 2);
    lb.setAttribute('data-lenis-prevent', '');
    const show = i => {
      at = (i + imgs.length) % imgs.length;
      img.src = media(imgs[at].src);
      $('#lbCount').textContent = `${digits(pad2(at + 1))} / ${digits(pad2(imgs.length))}`;
    };
    document.addEventListener('click', e => {
      const b = e.target.closest('.pj-open');
      if (!b) return;
      show(Number(b.dataset.index) || 0);
      lb.showModal();
      document.documentElement.classList.add('is-locked');
    });
    lb.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));
    $('#lbClose').addEventListener('click', () => lb.close());
    $('#lbPrev').addEventListener('click', () => show(at - 1));
    $('#lbNext').addEventListener('click', () => show(at + 1));
    // the next photo is the way the page reads: ← in Arabic, → in English
    lb.addEventListener('keydown', e => {
      if (e.key === (EN ? 'ArrowRight' : 'ArrowLeft')) show(at + 1);
      if (e.key === (EN ? 'ArrowLeft' : 'ArrowRight')) show(at - 1);
    });
    lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
    lb.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    let x0 = null;
    img.addEventListener('pointerdown', e => { x0 = e.clientX; });
    img.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) show(at + ((dx > 0) !== EN ? 1 : -1));
    });
  }

  /* ------------------------------------------------------------ motion */

  function develop(photo, delay = 0) {
    return gsap.timeline({ delay })
      .fromTo(photo, { '--wipe': 1 }, { '--wipe': 0, duration: 1.1, ease: 'power2.inOut' })
      .fromTo(photo, { '--ink': 1 }, { '--ink': 0, duration: .9, ease: 'power1.out' }, '-=.2');
  }

  function animate(coverBtn, coverImg) {
    if (!motion) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.timeline()
      .from('.pj .sheet-rule', { scaleX: 0, duration: 1.2, ease: 'power3.inOut' })
      .from('.pj-back, .pj-titles > *, .pj-facts > div', { opacity: 0, y: 16, duration: .8, stagger: .06, ease: 'power3.out' }, .1);

    const ready = coverImg.complete ? Promise.resolve() : new Promise(r => {
      coverImg.addEventListener('load', r, { once: true });
      coverImg.addEventListener('error', r, { once: true });
    });
    ready.then(() => develop(coverBtn, .35));

    document.querySelectorAll('.pj-grid .pj-photo').forEach(ph => {
      gsap.set(ph, { '--wipe': 1, '--ink': 1 });
      ScrollTrigger.create({ trigger: ph, start: 'top 90%', once: true, onEnter: () => develop(ph) });
    });
    document.querySelectorAll('.pj-text, .pj-film, .pj-gallery .pj-h, .pj-nav, .pj-cta').forEach(n => {
      if (n.closest('[hidden]')) return;
      gsap.from(n, { opacity: 0, y: 28, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 86%' } });
    });
    ScrollTrigger.refresh();
  }
})();

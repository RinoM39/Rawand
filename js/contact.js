/* =====================================================================
   RAWAND — Contact page (تواصل معنا) · sheet A-06
   - a survey drawing of the studio's point in Riyadh (pen strokes, drafted on scroll)
   - the project brief: three steps; each finished step inks one of the logo's three R lines,
     sending grows the leaf and stamps the sheet. Sending opens WhatsApp (data-whatsapp) or the
     visitor's mail app (data-email) with the brief written out — there is no server.
   Needs js/logo-data.js; gsap + ScrollTrigger are optional (without them it is all static).
   ===================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('contact');
  if (!root) return;

  const NS = 'http://www.w3.org/2000/svg';
  const LOGO = window.RAWAND_LOGO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const f1 = v => Math.round(v * 10) / 10;
  const T = window.rwT || (a => a);
  const EN = window.RW_LANG === 'en';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };

  /* ------------------------------------------------------------ survey drawing */

  function pen(parent) {
    const add = (tag, attrs, cls) => el(tag, { ...attrs, class: cls }, parent);
    return {
      path: (d, cls = 'ln') => add('path', { d, pathLength: 1 }, cls),
      line: (x1, y1, x2, y2, cls = 'ln') => add('path', { d: `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`, pathLength: 1 }, cls),
      circle: (cx, cy, r, cls = 'ln') => add('circle', { cx, cy, r, pathLength: 1 }, cls),
      text: (x, y, s, cls = 'lbl') => {
        const t = add('text', { x, y, 'text-anchor': 'middle' }, cls);
        t.textContent = s;
        return t;
      },
    };
  }

  // A tilted street grid (like Riyadh's), a main road, a ring-road curve, range rings around the studio.
  function survey(svg) {
    const C = [176, 100];
    const defs = el('defs', {}, svg);
    el('rect', { x: 8, y: 8, width: 344, height: 184 }, el('clipPath', { id: 'svClip' }, defs));
    const city = pen(el('g', { 'clip-path': 'url(#svClip)' }, svg));
    const top = pen(svg);

    const a = -42 * Math.PI / 180;
    const d = [Math.cos(a), Math.sin(a)];
    const n = [-d[1], d[0]];
    for (let k = -7; k <= 7; k++) {
      const o = [C[0] + n[0] * k * 30, C[1] + n[1] * k * 30];
      city.line(o[0] - d[0] * 320, o[1] - d[1] * 320, o[0] + d[0] * 320, o[1] + d[1] * 320, 'ln thin');
      const q = [C[0] + d[0] * k * 30, C[1] + d[1] * k * 30];
      city.line(q[0] - n[0] * 320, q[1] - n[1] * 320, q[0] + n[0] * 320, q[1] + n[1] * 320, 'ln thin');
    }
    const m = [C[0] + n[0] * 22, C[1] + n[1] * 22];
    city.line(m[0] - d[0] * 320, m[1] - d[1] * 320, m[0] + d[0] * 320, m[1] + d[1] * 320, 'ln bold');
    city.path('M8 156C74 70 236 34 352 74', 'ln bold');

    top.circle(C[0], C[1], 26, 'dash');
    top.circle(C[0], C[1], 54, 'dash');
    top.path(`M${C[0] - 16} ${C[1]}H${C[0] - 6}M${C[0] + 6} ${C[1]}H${C[0] + 16}M${C[0]} ${C[1] - 16}V${C[1] - 6}M${C[0]} ${C[1] + 6}V${C[1] + 16}`);
    el('circle', { cx: C[0], cy: C[1], r: 6, class: 'pulse' }, svg);
    el('circle', { cx: C[0], cy: C[1], r: 3.5, class: 'solid' }, svg);
    top.text(C[0] - 34, C[1] - 12, T('روند', 'RAWAND'), EN ? 'lbl' : 'lbl ar');

    top.circle(332, 34, 11, 'ln thin');
    top.path('M332 20L337 42L332 37L327 42Z');
    el('path', { d: 'M332 20V37L327 42Z', class: 'solid' }, svg);
    top.text(332, 14, 'N');

    top.line(18, 178, 98, 178);
    [18, 38, 58, 78, 98].forEach((x, i) => top.line(x, 174, x, i % 2 ? 178 : 182, 'ln thin'));
    top.text(58, 192, '0      1      2 km');
  }
  const surveySvg = $('.contact-survey', root);
  survey(surveySvg);

  /* ------------------------------------------------------------ the brief's logo */

  const form = document.getElementById('brief');
  const steps = $$('.brief-step', form);
  const markSvg = document.getElementById('briefMark');
  const mark = { pens: [], grows: [] };
  if (LOGO) {
    markSvg.setAttribute('viewBox', LOGO.viewBox.mark);
    markSvg.setAttribute('fill-rule', 'evenodd');
    const defs = el('defs', {}, markSvg);
    const box = { maskUnits: 'userSpaceOnUse', x: -40, y: -40, width: 260, height: 340 };
    ['line1', 'line2', 'line3', 'leaf', 'weave'].forEach(k => el('path', { d: LOGO.paths[k], class: 'bm-ghost' }, markSvg));
    // step ١ → outer line, ٢ → middle, ٣ → inner
    mark.pens = [
      { key: 'line1', d: 'M26 162V38H96', w: 24 },
      { key: 'line2', d: 'M44.8 162V51.6H80', w: 16 },
      { key: 'line3', d: 'M55.7 126V67.4H71', w: 16 },
    ].map(p => {
      const msk = el('mask', { id: `bm-${p.key}`, ...box }, defs);
      const stroke = el('path', { d: p.d, fill: 'none', stroke: '#fff', 'stroke-width': p.w, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1.001 }, msk);
      el('path', { d: LOGO.paths[p.key], mask: `url(#bm-${p.key})` }, markSvg);
      return stroke;
    });
    const grad = el('radialGradient', { id: 'bm-grow' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff' }, grad);
    el('stop', { offset: '.78', 'stop-color': '#fff' }, grad);
    el('stop', { offset: '1', 'stop-color': '#000' }, grad);
    mark.grows = [['leaf', 47, 152], ['weave', 58, 152]].map(([k, cx, cy]) => {
      const msk = el('mask', { id: `bm-${k}`, ...box }, defs);
      const c = el('circle', { cx, cy, r: 0, fill: 'url(#bm-grow)' }, msk);
      el('path', { d: LOGO.paths[k], mask: `url(#bm-${k})` }, markSvg);
      return c;
    });
  }
  function setPen(i, on) {
    const p = mark.pens[i];
    if (!p) return;
    const v = on ? 0 : 1.001;
    if (hasGSAP && !reduceMotion) gsap.to(p, { strokeDashoffset: v, duration: on ? .9 : .5, ease: 'power2.inOut', overwrite: true });
    else p.setAttribute('stroke-dashoffset', v);
  }
  function setLeaf(on) {
    mark.grows.forEach(c => {
      if (hasGSAP && !reduceMotion) gsap.to(c, { attr: { r: on ? 250 : 0 }, duration: on ? 1 : .4, ease: on ? 'power2.out' : 'power1.in', overwrite: true });
      else c.setAttribute('r', on ? 250 : 0);
    });
  }

  /* ------------------------------------------------------------ validation */

  const f = {
    name: $('#bf-name'), reach: $('#bf-reach'), city: $('#bf-city'), area: $('#bf-area'), msg: $('#bf-msg'),
  };
  const toLatin = s => s.replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const isPhone = v => /^\+?\d{8,15}$/.test(toLatin(v).replace(/[\s()-]/g, ''));
  // the chosen options as the visitor reads them (their label, in the page's language)
  const checked = name => $$(`input[name="${name}"]:checked`, form).map(i => (i.nextElementSibling ? i.nextElementSibling.textContent.trim() : i.value));

  const RULES = [
    { el: f.name, step: 0, ok: () => f.name.value.trim().length >= 2, msg: T('اكتب اسمك من فضلك.', 'Please write your name.') },
    { el: f.reach, step: 0, ok: () => isEmail(f.reach.value.trim()) || isPhone(f.reach.value.trim()), msg: T('اكتب رقم جوال أو بريداً إلكترونياً صحيحاً.', 'Please write a valid mobile number or email.') },
    { el: $('.chips', form), step: 1, ok: () => checked('type').length > 0, msg: T('اختر نوع المشروع.', 'Choose the project type.'), err: '#bf-type-err', focus: () => $('input[name="type"]', form) },
    { el: $('.phases', form), step: 1, ok: () => checked('service').length > 0, msg: T('اختر خدمة واحدة على الأقل.', 'Choose at least one service.'), err: '#bf-svc-err', focus: () => $('input[name="service"]', form) },
    { el: f.msg, step: 2, ok: () => f.msg.value.trim().length >= 10, msg: T('اكتب سطرين على الأقل عن المشروع.', 'Tell us a little more about the project.') },
  ];
  const errBox = r => (r.err ? $(r.err) : $('.field-err', r.el.closest('.field')));
  function showError(r, on) {
    const box = errBox(r);
    box.textContent = on ? r.msg : '';
    const input = r.el.matches('input, textarea') ? r.el : null;
    if (input) {
      input.closest('.field').classList.toggle('is-invalid', on);
      if (on) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  const done = [false, false, false];
  function progress() {
    [0, 1, 2].forEach(i => {
      const ok = RULES.filter(r => r.step === i).every(r => r.ok());
      if (ok !== done[i]) {
        done[i] = ok;
        steps[i].classList.toggle('is-done', ok);
        setPen(i, ok);
      }
    });
    // an error clears as soon as its field is fixed
    RULES.forEach(r => { if (errBox(r).textContent && r.ok()) showError(r, false); });
  }
  form.addEventListener('input', progress);
  form.addEventListener('change', progress);

  /* ------------------------------------------------------------ send */

  const wa = (form.dataset.whatsapp || '').replace(/\D/g, '');
  const doneBox = $('.brief-done', form);
  const doneTitle = $('.brief-done-title', form);
  if (wa) {
    $('.brief-note', form).textContent = T('عند الإرسال نجهّز موجزك في واتساب لتراجعه وترسله بنفسك.', 'When you send, we prepare your brief in WhatsApp so you can review it and send it yourself.');
    $('.brief-done-text', form).textContent = T('أكمل الإرسال من واتساب، وسنعود إليك قريباً.', 'Finish sending it from WhatsApp — we will get back to you soon.');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const bad = RULES.filter(r => !r.ok());
    RULES.forEach(r => showError(r, bad.includes(r)));
    if (bad.length) {
      const first = bad[0];
      (first.focus ? first.focus() : first.el).focus();
      return;
    }

    const name = f.name.value.trim();
    const lines = [
      T('موجز مشروع — روند', 'Project brief — RAWAND'),
      '',
      `${T('الاسم', 'Name')}: ${name}`,
      `${T('للتواصل', 'Contact')}: ${f.reach.value.trim()}`,
      `${T('نوع المشروع', 'Project type')}: ${checked('type').join(T('، ', ', '))}`,
      `${T('الخدمة المطلوبة', 'Service needed')}: ${checked('service').join(T('، ', ', '))}`,
      f.city.value.trim() ? `${T('المدينة', 'City')}: ${f.city.value.trim()}` : null,
      f.area.value.trim() ? `${T('المساحة التقريبية', 'Approximate area')}: ${f.area.value.trim()} ${T('م²', 'm²')}` : null,
      '',
      f.msg.value.trim(),
    ].filter(l => l !== null);
    const text = lines.join('\n');

    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    else window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`${T('موجز مشروع', 'Project brief')} — ${name}`)}&body=${encodeURIComponent(text)}`;

    // the logo completes (the sheet's header stays in view), the sheet is stamped
    setLeaf(true);
    const head = $('.brief-head', form);
    doneBox.style.top = `${head.offsetTop + head.offsetHeight + 1}px`;
    doneBox.hidden = false;
    doneTitle.setAttribute('tabindex', '-1');
    doneTitle.focus({ preventScroll: true });
    if (hasGSAP && !reduceMotion) {
      const stamp = $$('.brief-stamp circle, .brief-stamp .stamp-tick', form);
      gsap.timeline()
        .fromTo(doneBox, { opacity: 0 }, { opacity: 1, duration: .4, ease: 'power1.out' })
        .fromTo(stamp, { strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .9, stagger: .15, ease: 'power2.inOut' }, .1)
        .fromTo('.brief-stamp text', { opacity: 0 }, { opacity: 1, duration: .5 }, .5)
        .fromTo(['.brief-done-title', '.brief-done-text', '.brief-again'].map(s => $(s, form)), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, stagger: .08, ease: 'power3.out' }, .45);
    }
  });
  $$('.brief-stamp circle, .brief-stamp .stamp-tick', form).forEach(p => p.setAttribute('pathLength', 1));

  $('.brief-again', form).addEventListener('click', () => {
    doneBox.hidden = true;
    setLeaf(false);
    f.name.focus();
  });

  /* ------------------------------------------------------------ scroll reveals */

  if (!hasGSAP || reduceMotion) return;
  gsap.registerPlugin(ScrollTrigger);
  const q = gsap.utils.selector(root);

  gsap.timeline({ scrollTrigger: { trigger: q('.sheet-head')[0], start: 'top 85%' } })
    .from(q('.sheet-rule'), { scaleX: 0, duration: 1.4, ease: 'power3.inOut' })
    .from(q('.sheet-label'), { opacity: 0, y: 12, duration: .8, stagger: .1, ease: 'power3.out' }, 0);

  gsap.timeline({ scrollTrigger: { trigger: q('.contact-grid')[0], start: 'top 80%' } })
    .from(q('.contact-heading, .contact-heading-en, .contact-lead'), { opacity: 0, y: 24, duration: .9, stagger: .1, ease: 'power3.out' }, 0)
    .from(q('.contact-channels > div'), { opacity: 0, y: 14, duration: .7, stagger: .07, ease: 'power3.out' }, .35)
    .from(q('.brief'), { opacity: 0, y: 34, duration: 1, ease: 'power3.out' }, .15)
    .from(q('.brief-head, .brief-step, .brief-foot'), { opacity: 0, y: 16, duration: .7, stagger: .08, ease: 'power3.out' }, .45)
    .from(markSvg.querySelectorAll('.bm-ghost'), { opacity: 0, duration: .6, stagger: .06 }, .7);

  const strokes = surveySvg.querySelectorAll('.ln');
  const fades = surveySvg.querySelectorAll('.dash, .lbl, .solid, .pulse');
  gsap.set(strokes, { strokeDasharray: '1 2', strokeDashoffset: 1 });
  gsap.set(fades, { opacity: 0 });
  gsap.timeline({ scrollTrigger: { trigger: surveySvg, start: 'top 85%' } })
    .to(strokes, { strokeDashoffset: 0, duration: 1.6, stagger: { amount: 1 }, ease: 'power2.inOut' })
    .to(fades, { opacity: 1, duration: .6, stagger: .04, ease: 'power1.out' }, 1.2);

})();

/* =====================================================================
   RAWAND — admin dashboard (/auth)
   - sign in with the one fixed account (ADMIN_EMAIL / ADMIN_PASSWORD on the Neon function);
     the API hands back a token, kept in localStorage for 12 hours
   - list of projects: reorder (= order on the site), publish state, edit, preview, delete
   - editor: Arabic + English text, images (compressed in the browser, first = cover,
     drag to reorder) and a video file sent straight to Neon storage with progress, or a YouTube/Vimeo link
   Talks to the Neon function at window.RAWAND_API (js/config.js; source in backend/).
   Needs js/logo-data.js for the logo.
   ===================================================================== */
(() => {
  'use strict';

  const API = String(window.RAWAND_API || '').replace(/\/+$/, '');
  const TOKEN_KEY = 'rw-admin';
  const LOGO = window.RAWAND_LOGO;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const arabic = v => String(v).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const pad2 = n => arabic(String(n).padStart(2, '0'));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const uid = (n = 16) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const clone = o => JSON.parse(JSON.stringify(o));
  const VIDEO_LINK = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i;

  const S = { auth: false, email: '', token: '', maxImage: 25 << 20, maxVideo: 1024 << 20, projects: [], loaded: false };

  const MSG = {
    bad_login: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    too_many: 'محاولات كثيرة خاطئة. انتظر قليلاً ثم حاول من جديد.',
    unauthorized: 'انتهت الجلسة. سجّل الدخول من جديد.',
    title_required: 'اكتب اسم المشروع بالعربي والإنجليزي.',
    cover_required: 'المشروع المنشور يحتاج صورة واحدة على الأقل لتكون الغلاف.',
    bad_video_url: 'رابط الفيديو يجب أن يكون من YouTube أو Vimeo ويبدأ بـ https://',
    too_big: 'الملف أكبر من الحد المسموح.',
    bad_type: 'صيغة الملف غير مدعومة.',
    not_found: 'المشروع غير موجود — ربما حُذف.',
    not_configured: 'السيرفر لم يُضبط بعد: البريد وكلمة المرور غير موجودين في إعدادات Neon.',
    upload_failed: 'تعذّر رفع الملف.',
    network: 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت وحاول مجدداً.',
    no_api: 'لم يُضبط عنوان الـ API بعد (js/config.js)، فلوحة التحكم لا تستطيع الاتصال به.',
    server: 'حدث خطأ في السيرفر. حاول بعد قليل.',
  };
  const message = e => MSG[e && e.code] || MSG.network;

  // ready-made categories: one click fills both languages
  const CATS = [
    ['سكني', 'Residential'], ['تجاري', 'Commercial'], ['ثقافي', 'Cultural'], ['تعليمي', 'Educational'],
    ['ضيافة', 'Hospitality'], ['تخطيط عمراني', 'Urban planning'], ['تصميم داخلي', 'Interior'], ['لاندسكيب', 'Landscape'],
  ];

  const BLANK = {
    id: '', published: true,
    title: { ar: '', en: '' }, category: { ar: '', en: '' }, location: { ar: '', en: '' },
    summary: { ar: '', en: '' }, description: { ar: '', en: '' },
    year: '', area: '', areaUnit: 'm2',
    scope: { consult: false, design: true, build: false },
    images: [], video: null, videoUrl: '',
  };

  const ICON = {
    up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    down: '<path d="M12 5v14m6-6-6 6-6-6"/>',
    right: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    left: '<path d="M19 12H5m6 6-6-6 6-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    star: '<path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9L3.4 9.7l6-.7Z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    photo: '<rect x="3" y="5" width="18" height="14"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
    film: '<rect x="3" y="6" width="13" height="12"/><path d="m16 10 5-3v10l-5-3"/>',
  };

  /* ------------------------------------------------------------ tiny DOM helpers */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  function icon(name) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICON[name];   // our own constant markup
    return svg;
  }
  function iconBtn(name, label, onclick, disabled, extra) {
    return h('button', { type: 'button', class: 'icon-btn' + (extra ? ' ' + extra : ''), title: label, 'aria-label': label, disabled, dataset: { act: name }, onclick }, icon(name));
  }
  function size(b) {
    if (b >= 1 << 30) return arabic((b / (1 << 30)).toFixed(1)) + ' غيغابايت';
    if (b >= 1 << 20) return arabic(Math.round(b / (1 << 20))) + ' ميغابايت';
    return arabic(Math.max(1, Math.round(b / 1024))) + ' كيلوبايت';
  }
  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, path, v) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((a, k) => (a[k] = a[k] && typeof a[k] === 'object' ? a[k] : {}), o)[last] = v;
  }

  function toast(text, error) {
    const t = h('div', { class: 'toast' + (error ? ' is-error' : '') }, text);
    $('#toasts').append(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 350); }, error ? 5600 : 3000);
  }

  function confirmBox(title, text, ok) {
    const dlg = $('#dlg');
    $('#dlgTitle').textContent = title;
    $('#dlgText').textContent = text;
    $('#dlgOk').textContent = ok;
    dlg.returnValue = '';
    return new Promise(resolve => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  /* ------------------------------------------------------------ talking to the API */

  class ApiError extends Error {
    constructor(code, status = 0, data = {}) { super(code); this.code = code; this.status = status; this.data = data || {}; }
  }

  async function api(action, opts = {}) {
    if (!API) throw new ApiError('no_api');
    const headers = {};
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const qs = opts.params ? '?' + new URLSearchParams(opts.params) : '';
    let res;
    try {
      res = await fetch(`${API}/${action}${qs}`, {
        method: opts.body !== undefined ? 'POST' : 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
      });
    } catch (e) {
      throw new ApiError('network');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { throw new ApiError(res.status >= 500 ? 'server' : 'no_api', res.status); }
    if (!res.ok || !data.ok) throw new ApiError(data.error || 'network', res.status, data);
    return data;
  }

  // when the session has run out mid-work: sign in again on top of the page, then carry on
  let relogin = null;
  function needLogin() {
    if (!relogin) relogin = new Promise(resolve => showGate(resolve));
    return relogin;
  }
  async function call(action, opts) {
    try {
      return await api(action, opts);
    } catch (e) {
      if (e.code !== 'unauthorized') throw e;
      await needLogin();
      return api(action, opts);
    }
  }

  function saveToken(token, exp) {
    S.token = token || '';
    try {
      if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp }));
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode: signed in for this page only */ }
  }
  function loadToken() {
    try {
      const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (t && t.token && t.exp > Date.now()) return t.token;
    } catch (e) { /* nothing stored */ }
    return '';
  }

  function applySession(s) {
    S.auth = true;
    S.email = s.email || '';
    if (s.token) saveToken(s.token, s.exp);
    S.maxImage = s.maxImage || S.maxImage;
    S.maxVideo = s.maxVideo || S.maxVideo;
    $('#deskUser').textContent = S.email;
    $('#imgHint').textContent = `JPG · PNG · WEBP — حتى ${size(S.maxImage)} للصورة. تُصغَّر الصور الكبيرة تلقائياً قبل الرفع.`;
    $('#vidHint').textContent = `MP4 · MOV · WEBM — حتى ${size(S.maxVideo)}. الأفضل MP4 ليعمل على كل الأجهزة.`;
  }

  /* ------------------------------------------------------------ uploads: straight to Neon storage */

  // PUT the file to the signed URL the API gave us, with progress
  function put(url, headers, file, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      for (const [k, v] of Object.entries(headers || {})) x.setRequestHeader(k, v);
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ApiError(x.status >= 500 ? 'network' : 'upload_failed', x.status)));
      x.onerror = () => reject(new ApiError('network'));
      x.onabort = () => reject(new ApiError('aborted'));
      if (signal) {
        if (signal.aborted) return reject(new ApiError('aborted'));
        signal.addEventListener('abort', () => x.abort(), { once: true });
      }
      x.send(file);
    });
  }

  const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', heic: 'image/heic', heif: 'image/heif' };
  const typeOf = file => file.type || TYPES[(file.name.split('.').pop() || '').toLowerCase()] || '';

  // 1) ask the API for a signed URL  2) PUT the file  3) the API checks what actually arrived
  async function upload(file, kind, onProgress, signal) {
    const ticket = await call('upload', { body: { kind, type: typeOf(file), size: file.size } });
    for (let tries = 0; ; tries++) {
      try {
        await put(ticket.url, ticket.headers, file, onProgress, signal);
        break;
      } catch (e) {
        if (e.code !== 'network' || tries >= 3) throw e;
        await wait(1000 * (tries + 1));
      }
    }
    if (signal && signal.aborted) throw new ApiError('aborted');
    return call('upload/check', { body: { key: ticket.key, kind } });
  }

  // width x height, for the page layout (read from the browser's own decode)
  function imageSize(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = src;
    });
  }

  // big photos are scaled to 2560px and re-encoded (WebP) in the browser before upload
  async function prepareImage(file) {
    if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { return file; }
    const MAX = 2560;
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size <= 1.2 * 1048576 && /jpeg|webp/.test(file.type)) { bmp.close(); return file; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
    if (!blob || (k === 1 && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.jpg'), { type: blob.type });
  }

  /* ------------------------------------------------------------ logo */

  function buildLockup(svg) {
    if (!LOGO || !svg || svg.childElementCount) return;
    const P = LOGO.paths;
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    };
    const x0 = 165.5;
    const sE = 0.952;
    svg.setAttribute('viewBox', '0 0 317 146.5');
    svg.setAttribute('fill-rule', 'evenodd');
    const mark = el('g', { transform: 'translate(-15 -6)' }, svg);
    ['line1', 'line2', 'line3', 'leaf', 'weave'].forEach(k => el('path', { d: P[k] }, mark));
    const ar = el('g', { transform: `translate(${x0 - 10.875} ${30 - 162.125})` }, svg);
    ['ar', 'ar_marks'].forEach(k => el('path', { d: P[k] }, ar));
    const en = el('g', { transform: `translate(${x0 - 7.25 * sE} ${95 - 222 * sE}) scale(${sE})` }, svg);
    ['en0', 'en1', 'en2', 'en3', 'en4', 'en5'].forEach(k => el('path', { d: P[k] }, en));
  }

  // sign-in mark: ghost outlines; line 1 inks with the email, line 2 with the password, the rest on entry
  function buildGateMark(svg) {
    if (!LOGO || !svg) return;
    svg.setAttribute('viewBox', LOGO.viewBox.mark);
    svg.setAttribute('fill-rule', 'evenodd');
    const parts = { line1: 's1', line2: 's2', line3: 's3', leaf: 's3', weave: 's3' };
    for (const [k, step] of Object.entries(parts)) {
      for (const cls of ['gm-ghost', 'gm-ink ' + step]) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', LOGO.paths[k]);
        p.setAttribute('class', cls);
        svg.appendChild(p);
      }
    }
  }

  /* ================================================================ SIGN IN */

  const gate = $('#gate');
  const loginForm = $('#loginForm');
  const emailIn = $('#loginEmail');
  const passIn = $('#loginPass');
  const loginErr = $('#loginError');
  let gateDone = null;

  function gateStep() {
    const emailOk = /^\S+@\S+\.\S+$/.test(emailIn.value.trim());
    gate.dataset.step = emailOk ? (passIn.value.length >= 4 ? '2' : '1') : '0';
  }

  function showGate(onDone) {
    gateDone = onDone || null;
    gate.hidden = false;
    gate.classList.remove('is-leaving');
    gate.classList.toggle('is-overlay', !!onDone);
    $('.gate-sub', gate).textContent = onDone
      ? 'انتهت الجلسة. سجّل الدخول للمتابعة — تعديلاتك ما زالت هنا.'
      : 'للفريق فقط. سجّل الدخول لإدارة المشاريع.';
    if (!onDone) $('#desk').hidden = true;
    loginErr.textContent = '';
    if (S.email) emailIn.value = S.email;
    gateStep();
    setTimeout(() => (emailIn.value ? passIn : emailIn).focus(), 60);
  }

  emailIn.addEventListener('input', gateStep);
  passIn.addEventListener('input', gateStep);
  $('#pwEye').addEventListener('click', e => {
    const show = passIn.type === 'password';
    passIn.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(show));
    e.currentTarget.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });

  function shake(text) {
    loginErr.textContent = text;
    gate.classList.remove('is-shaking');
    void gate.offsetWidth;
    gate.classList.add('is-shaking');
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = emailIn.value.trim();
    const password = passIn.value;
    if (!email || !password) { shake('اكتب البريد الإلكتروني وكلمة المرور.'); return; }
    const btn = $('#loginBtn');
    btn.classList.add('is-busy');
    loginErr.textContent = '';
    try {
      const s = await api('login', { body: { email, password } });
      applySession(s);
      passIn.value = '';
      gate.dataset.step = '3';
      if (gateDone) {
        await wait(450);
        gate.hidden = true;
        const done = gateDone;
        gateDone = null;
        relogin = null;
        done();
      } else {
        gate.classList.add('is-leaving');
        await wait(850);
        enterDesk();
      }
    } catch (err) {
      gateStep();
      if (err.code === 'too_many' && err.data.wait) shake(`محاولات كثيرة خاطئة. حاول بعد ${arabic(Math.ceil(err.data.wait / 60))} دقيقة.`);
      else shake(message(err));
      if (err.code === 'bad_login') { passIn.select(); }
    } finally {
      btn.classList.remove('is-busy');
    }
  });

  /* ================================================================ DESK */

  function enterDesk() {
    gate.hidden = true;
    $('#desk').hidden = false;
    buildLockup($('#deskLogo'));
    loadProjects().then(route);
  }

  $('#logoutBtn').addEventListener('click', async () => {
    if (E.open && (E.dirty || busy())) {
      const ok = await confirmBox('الخروج بدون حفظ؟', 'لديك تغييرات لم تُحفظ بعد في هذا المشروع.', 'خروج');
      if (!ok) return;
    }
    closeEditor();
    S.auth = false;
    saveToken('');
    S.loaded = false;
    history.replaceState(null, '', location.pathname);
    currentHash = '';
    showGate();
  });

  /* ------------------------------------------------------------ routing: #/ · #/new · #/edit/<id> */

  let currentHash = location.hash;
  let ignoreHash = false;

  function route() {
    const r = location.hash.replace(/^#\/?/, '');
    if (r === 'new') openEditor('');
    else if (r.startsWith('edit/')) openEditor(decodeURIComponent(r.slice(5)));
    else showList();
  }

  window.addEventListener('hashchange', async () => {
    if (ignoreHash) { ignoreHash = false; return; }
    if (!S.auth) return;
    if (E.open && (E.dirty || busy())) {
      const ok = await confirmBox('تغييرات غير محفوظة', 'إذا خرجت الآن فستضيع التعديلات التي لم تُحفظ.', 'خروج بدون حفظ');
      if (!ok) {
        ignoreHash = true;
        location.hash = currentHash || '#/';
        return;
      }
    }
    currentHash = location.hash;
    route();
  });

  window.addEventListener('beforeunload', e => {
    if (E.open && (E.dirty || busy())) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ------------------------------------------------------------ the list */

  const plist = $('#plist');
  let focusAfter = null;
  let reorderTimer = 0;

  async function loadProjects() {
    plist.replaceChildren(h('li', { class: 'plist-skeleton' }), h('li', { class: 'plist-skeleton' }));
    try {
      const r = await call('all');
      S.projects = r.projects || [];
      S.loaded = true;
    } catch (e) {
      toast(message(e), true);
    }
    renderList();
  }

  function countLabel(n) {
    if (!n) return '';
    if (n === 1) return 'مشروع واحد';
    if (n === 2) return 'مشروعان';
    return arabic(n) + (n <= 10 ? ' مشاريع' : ' مشروعاً');
  }

  function renderList() {
    const list = S.projects;
    $('#listCount').textContent = countLabel(list.length);
    $('#pempty').hidden = list.length > 0 || !S.loaded;
    plist.replaceChildren(...list.map((p, i) => {
      const cover = p.images && p.images[0];
      const meta = [];
      if (p.category && p.category.ar) meta.push(h('span', null, p.category.ar));
      if (p.location && p.location.ar) meta.push(h('span', null, p.location.ar));
      if (p.year) meta.push(h('span', null, arabic(p.year)));
      meta.push(h('span', null, icon('photo'), arabic((p.images || []).length)));
      if (p.video || p.videoUrl) meta.push(h('span', null, icon('film'), 'فيديو'));
      const open = e => { if (!e.target.closest('button, a')) location.hash = '#/edit/' + encodeURIComponent(p.id); };
      return h('li', { class: 'pitem', dataset: { id: p.id }, onclick: open },
        h('span', { class: 'pitem-num' }, pad2(i + 1)),
        h('span', { class: 'pitem-thumb' }, cover ? h('img', { src: cover.src, alt: '', loading: 'lazy' }) : null),
        h('div', { class: 'pitem-main' },
          h('h2', { class: 'pitem-title' }, p.title.ar || '—', h('span', { class: 'pitem-en', lang: 'en', dir: 'ltr' }, p.title.en)),
          h('p', { class: 'pitem-meta' }, meta)),
        h('span', { class: 'badge' + (p.published ? ' is-live' : '') }, p.published ? 'منشور' : 'مسودّة'),
        h('div', { class: 'pitem-tools' },
          iconBtn('up', 'تحريك لأعلى', () => move(i, -1), i === 0),
          iconBtn('down', 'تحريك لأسفل', () => move(i, 1), i === list.length - 1),
          h('a', { class: 'icon-btn', href: '#/edit/' + encodeURIComponent(p.id), title: 'تعديل', 'aria-label': 'تعديل: ' + p.title.ar }, icon('edit')),
          h('a', { class: 'icon-btn', href: '../project.html?id=' + encodeURIComponent(p.id), target: '_blank', rel: 'noopener', title: 'معاينة في الموقع', 'aria-label': 'معاينة: ' + p.title.ar }, icon('eye')),
          iconBtn('trash', 'حذف', () => removeProject(p), false, 'danger')));
    }));
    if (focusAfter) {
      const b = $(`.pitem[data-id="${CSS.escape(focusAfter.id)}"] [data-act="${focusAfter.act}"]`);
      (b && !b.disabled ? b : $(`.pitem[data-id="${CSS.escape(focusAfter.id)}"] [data-act]:not(:disabled)`))?.focus();
      focusAfter = null;
    }
  }

  function move(i, d) {
    const j = i + d;
    const list = S.projects;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    focusAfter = { id: list[j].id, act: d < 0 ? 'up' : 'down' };
    renderList();
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(async () => {
      try {
        await call('reorder', { body: { ids: S.projects.map(p => p.id) } });
        toast('تم حفظ الترتيب.');
      } catch (e) {
        toast(message(e), true);
        loadProjects();
      }
    }, 600);
  }

  async function removeProject(p) {
    const ok = await confirmBox(`حذف «${p.title.ar}»؟`, 'سيُحذف المشروع مع كل صوره والفيديو نهائياً، ولا يمكن التراجع.', 'حذف المشروع');
    if (!ok) return false;
    try {
      await call('delete', { body: { id: p.id } });
    } catch (e) {
      toast(message(e), true);
      return false;
    }
    S.projects = S.projects.filter(x => x.id !== p.id);
    toast('حُذف المشروع.');
    renderList();
    return true;
  }

  function showList() {
    closeEditor();
    $('#editor').hidden = true;
    $('#listView').hidden = false;
    if (!S.loaded) loadProjects(); else renderList();
    document.title = 'لوحة التحكم | روند RAWAND';
  }

  /* ================================================================ EDITOR */

  const editor = $('#editor');
  const tilesEl = $('#tiles');
  // E.tiles: [{ key, src, w, h, status: 'done' | 'uploading' | 'error', progress, preview, file, ctrl, error }]
  const E = { open: false, id: '', draft: null, tiles: [], video: null, dirty: false, saving: false };

  const busy = () => E.tiles.some(t => t.status === 'uploading') || !!(E.video && E.video.status === 'uploading');

  function setDirty(v) {
    E.dirty = v;
    paintState();
  }

  function paintState() {
    const st = $('#saveState');
    const n = E.tiles.filter(t => t.status === 'uploading').length + (E.video && E.video.status === 'uploading' ? 1 : 0);
    st.classList.toggle('is-dirty', E.dirty);
    if (n) st.textContent = n === 1 ? 'جارٍ رفع ملف…' : `جارٍ رفع ${arabic(n)} ملفات…`;
    else if (E.dirty) st.textContent = 'تغييرات غير محفوظة';
    else st.textContent = E.id ? 'كل التغييرات محفوظة.' : '';
    $('#saveBtn').disabled = n > 0;
  }

  function openEditor(id) {
    if (!S.loaded) { loadProjects().then(() => S.loaded && openEditor(id)); return; }
    const p = id ? S.projects.find(x => x.id === id) : null;
    if (id && !p) {
      toast(MSG.not_found, true);
      history.replaceState(null, '', '#/');
      currentHash = '#/';
      showList();
      return;
    }
    closeEditor();
    E.open = true;
    E.id = p ? p.id : '';
    E.draft = Object.assign(clone(BLANK), p ? clone(p) : {});
    E.tiles = (E.draft.images || []).map(m => ({ key: uid(8), src: m.src, w: m.w, h: m.h, status: 'done' }));
    E.video = E.draft.video ? { src: E.draft.video.src, size: E.draft.video.size || 0, name: E.draft.video.src.split('/').pop(), status: 'done' } : null;

    $$('[data-f]', editor).forEach(el => {
      const v = getPath(E.draft, el.dataset.f);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
    $$('.is-invalid', editor).forEach(el => el.classList.remove('is-invalid'));
    paintHead();
    renderChips();
    paintCounts();
    renderTiles();
    renderVideo();
    setDirty(false);

    $('#listView').hidden = true;
    editor.hidden = false;
    window.scrollTo(0, 0);
    if (!p) setTimeout(() => $('#fTitleAr').focus(), 50);
  }

  function closeEditor() {
    if (!E.open) return;
    E.tiles.forEach(t => { if (t.ctrl) t.ctrl.abort(); if (t.preview) URL.revokeObjectURL(t.preview); });
    if (E.video) { if (E.video.ctrl) E.video.ctrl.abort(); if (E.video.preview) URL.revokeObjectURL(E.video.preview); }
    E.open = false;
    E.tiles = [];
    E.video = null;
    E.dirty = false;
  }

  function paintHead() {
    const name = E.id ? (E.draft.title.ar || E.draft.title.en) : '';
    $('#editorTitle').textContent = E.id ? name : 'مشروع جديد';
    document.title = (E.id ? name : 'مشروع جديد') + ' | لوحة التحكم';
    const prev = $('#previewLink');
    prev.hidden = !E.id;
    prev.href = '../project.html?id=' + encodeURIComponent(E.id);
    $('#deleteBtn').hidden = !E.id;
  }

  // text fields, checkboxes and the unit select all write into the draft
  editor.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (!f) return;
    setPath(E.draft, f, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    const field = e.target.closest('.field');
    if (field) field.classList.remove('is-invalid');
    if (f.startsWith('category.')) renderChips();
    if (f.startsWith('summary.')) paintCounts();
    setDirty(true);
  });
  editor.addEventListener('change', e => {
    if (e.target.tagName === 'SELECT' && e.target.dataset.f) {
      setPath(E.draft, e.target.dataset.f, e.target.value);
      setDirty(true);
    }
  });

  function renderChips() {
    const c = E.draft.category;
    $('#catChips').replaceChildren(...CATS.map(([ar, en]) => h('button', {
      type: 'button',
      class: 'chip' + (c.ar === ar && c.en === en ? ' is-on' : ''),
      'aria-pressed': String(c.ar === ar && c.en === en),
      onclick: () => {
        E.draft.category = { ar, en };
        $('#fCatAr').value = ar;
        $('#fCatEn').value = en;
        renderChips();
        setDirty(true);
      },
    }, ar, h('small', { lang: 'en' }, en))));
  }

  function paintCounts() {
    $$('[data-count]', editor).forEach(el => {
      const n = (getPath(E.draft, el.dataset.count) || '').length;
      el.textContent = arabic(n) + ' / ' + arabic(360);
      el.classList.toggle('is-near', n > 300);
    });
  }

  /* ------------------------------------------------------------ images */

  function addImages(files) {
    let added = 0;
    for (const file of files) {
      if (!/^image\//.test(file.type) && !/\.(heic|heif|avif|webp|jpe?g|png|gif)$/i.test(file.name)) {
        toast(`«${file.name}» ليس صورة.`, true);
        continue;
      }
      if (E.tiles.length >= 60) { toast('الحد الأقصى ٦٠ صورة للمشروع.', true); break; }
      const t = { key: uid(8), status: 'uploading', progress: 0, file, preview: URL.createObjectURL(file) };
      E.tiles.push(t);
      added++;
      uploadTile(t);
    }
    if (added) { renderTiles(); setDirty(true); }
  }

  async function uploadTile(t) {
    t.status = 'uploading';
    t.progress = 0;
    t.ctrl = new AbortController();
    paintTile(t);
    paintState();
    try {
      const file = await prepareImage(t.file);
      if (file.size > S.maxImage) throw new ApiError('too_big');
      const res = await upload(file, 'image', p => {
        t.progress = p;
        const bar = t.el && $('.bar i', t.el);
        if (bar) bar.style.setProperty('--p', p);
      }, t.ctrl.signal);
      const { w, h } = await imageSize(t.preview);
      Object.assign(t, { src: res.src, w, h, status: 'done', ctrl: null });
    } catch (e) {
      if (e.code === 'aborted') return;
      t.status = 'error';
      t.ctrl = null;
      t.error = e.code === 'bad_type' && /hei[cf]/i.test(t.file.type + t.file.name)
        ? 'صيغة HEIC غير مدعومة. صدّر الصورة بصيغة JPG.'
        : message(e);
    }
    if (E.tiles.includes(t)) { paintTile(t); paintState(); }
  }

  function tileEl(t, i) {
    const n = E.tiles.length;
    const li = h('li', {
      class: 'tile' + (i === 0 ? ' is-cover' : '') + (t.status === 'uploading' ? ' is-loading' : '') + (t.status === 'error' ? ' is-error' : ''),
      draggable: 'true',
      dataset: { key: t.key },
    },
      h('img', { src: t.preview || t.src, alt: '', draggable: 'false' }),
      i === 0 ? h('span', { class: 'tile-badge' }, 'الغلاف') : h('span', { class: 'tile-num' }, arabic(i + 1)),
      t.status === 'error' ? h('div', { class: 'tile-msg' }, t.error,
        t.file ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => uploadTile(t) }, 'إعادة المحاولة') : null) : null,
      t.status === 'uploading' ? h('span', { class: 'bar' }, h('i', { style: `--p:${t.progress || 0}` })) : null,
      h('div', { class: 'tile-tools' },
        i > 0 ? iconBtn('star', 'اجعلها الغلاف', () => moveTile(t, 0, 'star')) : null,
        iconBtn('right', 'تقديم', () => moveTile(t, i - 1, 'right'), i === 0),
        iconBtn('left', 'تأخير', () => moveTile(t, i + 1, 'left'), i === n - 1),
        iconBtn('x', 'إزالة الصورة', () => removeTile(t))));
    t.el = li;
    return li;
  }

  function renderTiles() {
    tilesEl.replaceChildren(...E.tiles.map(tileEl));
  }
  function paintTile(t) {
    const i = E.tiles.indexOf(t);
    if (i < 0 || !t.el || !t.el.isConnected) return;
    t.el.replaceWith(tileEl(t, i));
  }

  function moveTile(t, to, act) {
    const from = E.tiles.indexOf(t);
    to = Math.max(0, Math.min(E.tiles.length - 1, to));
    if (from < 0 || from === to) return;
    E.tiles.splice(from, 1);
    E.tiles.splice(to, 0, t);
    renderTiles();
    setDirty(true);
    // keyboard: keep focus on the tile that moved
    if (act && t.el) ($(`[data-act="${act}"]:not(:disabled)`, t.el) || $('[data-act]:not(:disabled)', t.el)).focus();
  }

  function removeTile(t) {
    if (t.ctrl) t.ctrl.abort();
    if (t.preview) URL.revokeObjectURL(t.preview);
    E.tiles = E.tiles.filter(x => x !== t);
    renderTiles();
    setDirty(true);
  }

  // drag a tile onto another to reorder (mouse); the arrow buttons do the same on touch / keyboard
  let dragKey = null;
  tilesEl.addEventListener('dragstart', e => {
    const li = e.target.closest('.tile');
    if (!li) return;
    dragKey = li.dataset.key;
    li.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
  });
  tilesEl.addEventListener('dragover', e => {
    if (!dragKey) return;
    e.preventDefault();
    const li = e.target.closest('.tile');
    $$('.tile.is-target', tilesEl).forEach(x => x !== li && x.classList.remove('is-target'));
    if (li && li.dataset.key !== dragKey) li.classList.add('is-target');
  });
  tilesEl.addEventListener('drop', e => {
    if (!dragKey) return;
    e.preventDefault();
    const li = e.target.closest('.tile');
    const t = E.tiles.find(x => x.key === dragKey);
    if (li && t) moveTile(t, E.tiles.findIndex(x => x.key === li.dataset.key));
  });
  tilesEl.addEventListener('dragend', () => {
    dragKey = null;
    $$('.tile', tilesEl).forEach(x => x.classList.remove('is-dragging', 'is-target'));
  });

  /* ------------------------------------------------------------ video */

  function setVideo(file) {
    if (!file) return;
    if (!/^video\//.test(file.type) && !/\.(mp4|m4v|mov|webm)$/i.test(file.name)) { toast('هذا الملف ليس فيديو.', true); return; }
    if (file.size > S.maxVideo) { toast(`الفيديو أكبر من ${size(S.maxVideo)}.`, true); return; }
    dropVideo();
    E.video = { status: 'uploading', progress: 0, name: file.name, size: file.size, file, preview: URL.createObjectURL(file) };
    renderVideo();
    setDirty(true);
    uploadVideo(E.video);
  }

  async function uploadVideo(v) {
    v.status = 'uploading';
    v.ctrl = new AbortController();
    renderVideo();
    paintState();
    try {
      const res = await upload(v.file, 'video', p => {
        v.progress = p;
        if (E.video === v) paintVideoProgress();
      }, v.ctrl.signal);
      Object.assign(v, { src: res.src, size: res.size, status: 'done', ctrl: null });
    } catch (e) {
      if (e.code === 'aborted') return;
      v.status = 'error';
      v.ctrl = null;
      v.error = message(e);
    }
    if (E.video === v) { renderVideo(); paintState(); }
  }

  function dropVideo() {
    if (!E.video) return;
    if (E.video.ctrl) E.video.ctrl.abort();
    if (E.video.preview) URL.revokeObjectURL(E.video.preview);
    E.video = null;
  }

  function paintVideoProgress() {
    const v = E.video;
    $('#vidBar i').style.setProperty('--p', v.progress);
    $('#vidState').textContent = `جارٍ الرفع… ${arabic(Math.floor(v.progress * 100))}٪ من ${size(v.size)}`;
  }

  function renderVideo() {
    const v = E.video;
    $('#vidCard').hidden = !v;
    $('#vidDrop').hidden = !!v;
    const state = $('#vidState');
    state.classList.remove('is-warn');
    $('#vidCard .vid-retry')?.remove();
    if (!v) { $('#vidPlayer').removeAttribute('src'); return; }
    const player = $('#vidPlayer');
    const src = v.preview || v.src;
    if (player.getAttribute('src') !== src) player.src = src;
    $('#vidName').textContent = v.name || '';
    $('#vidBar').hidden = v.status !== 'uploading';
    if (v.status === 'uploading') paintVideoProgress();
    else if (v.status === 'error') {
      state.textContent = v.error;
      state.classList.add('is-warn');
      if (v.file) state.after(h('button', { type: 'button', class: 'btn btn-ghost btn-sm vid-retry', onclick: () => uploadVideo(v) }, 'إعادة المحاولة'));
    } else state.textContent = 'تم الرفع' + (v.size ? ' · ' + size(v.size) : '') + '.';
  }

  $('#vidPlayer').addEventListener('error', () => {
    if (!E.video) return;
    const st = $('#vidState');
    st.textContent = 'المتصفح لا يستطيع تشغيل هذا الفيديو. الأفضل رفعه بصيغة MP4 (H.264).';
    st.classList.add('is-warn');
  });
  $('#vidRemove').addEventListener('click', () => {
    dropVideo();
    renderVideo();
    setDirty(true);
  });

  /* ------------------------------------------------------------ dropping & picking files */

  const hasFiles = e => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  function dropZone(zone, onFiles) {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      zone.classList.add('is-over');
    }));
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over'); });
    zone.addEventListener('drop', e => {
      zone.classList.remove('is-over');
      if (!hasFiles(e)) return;
      e.preventDefault();
      onFiles(Array.from(e.dataTransfer.files));
    });
  }
  dropZone($('#imgDrop'), addImages);
  dropZone(tilesEl, addImages);
  dropZone($('#vidDrop'), files => setVideo(files[0]));
  // a file dropped anywhere else must not make the browser leave the page
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });

  $('#imgInput').addEventListener('change', e => { addImages(Array.from(e.target.files)); e.target.value = ''; });
  $('#vidInput').addEventListener('change', e => { setVideo(e.target.files[0]); e.target.value = ''; });
  // paste a screenshot / copied image straight into the project
  document.addEventListener('paste', e => {
    if (!E.open || !e.clipboardData) return;
    const files = Array.from(e.clipboardData.files || []).filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addImages(files); }
  });

  /* ------------------------------------------------------------ save · delete */

  function invalid(sel) {
    const el = $(sel);
    el.closest('.field').classList.add('is-invalid');
    return el;
  }

  editor.addEventListener('submit', async e => {
    e.preventDefault();
    if (E.saving) return;
    if (busy()) { toast('انتظر حتى يكتمل رفع الملفات.', true); return; }
    const d = E.draft;
    const missing = [];
    if (!d.title.ar.trim()) missing.push(invalid('#fTitleAr'));
    if (!d.title.en.trim()) missing.push(invalid('#fTitleEn'));
    if (missing.length) {
      missing[0].focus();
      toast(MSG.title_required, true);
      return;
    }
    const images = E.tiles.filter(t => t.status === 'done').map(t => ({ src: t.src, w: t.w || 0, h: t.h || 0 }));
    if (d.published && !images.length) {
      $('#imgDrop').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(MSG.cover_required, true);
      return;
    }
    if (E.tiles.some(t => t.status === 'error')) toast('بعض الصور لم تُرفع وسيتم تجاهلها.', true);
    const link = (d.videoUrl || '').trim();
    if (link && !VIDEO_LINK.test(link)) {
      invalid('#fVideoUrl').focus();
      toast(MSG.bad_video_url, true);
      return;
    }

    const project = Object.assign(clone(d), {
      id: E.id,
      videoUrl: link,
      images,
      video: E.video && E.video.status === 'done' ? { src: E.video.src, size: E.video.size || 0 } : null,
    });
    E.saving = true;
    $('#saveBtn').classList.add('is-busy');
    try {
      const { project: p } = await call('save', { body: { project } });
      const i = S.projects.findIndex(x => x.id === p.id);
      if (i >= 0) S.projects[i] = p; else S.projects.unshift(p);
      const wasNew = !E.id;
      E.id = p.id;
      E.draft = Object.assign(clone(BLANK), clone(p));
      E.tiles = E.tiles.filter(t => t.status === 'done');
      if (wasNew) {
        history.replaceState(null, '', '#/edit/' + encodeURIComponent(p.id));
        currentHash = location.hash;
      }
      renderTiles();
      paintHead();
      setDirty(false);
      toast(wasNew ? 'تمت إضافة المشروع ✓' : 'تم حفظ التعديلات ✓');
    } catch (err) {
      toast(message(err), true);
    } finally {
      E.saving = false;
      $('#saveBtn').classList.remove('is-busy');
    }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    const p = S.projects.find(x => x.id === E.id);
    if (!p) return;
    if (await removeProject(p)) {
      E.dirty = false;
      closeEditor();
      history.replaceState(null, '', '#/');
      currentHash = '#/';
      showList();
    }
  });

  /* ================================================================ start */

  async function boot() {
    buildGateMark($('#gateMark'));
    S.token = loadToken();
    if (!API) {
      showGate();
      loginErr.textContent = MSG.no_api;
    } else if (!S.token) {
      showGate();
    } else {
      try {
        const s = await api('session');
        if (s.auth) { applySession(s); enterDesk(); } else { saveToken(''); showGate(); }
      } catch (e) {
        showGate();
        loginErr.textContent = message(e);
      }
    }
    document.body.classList.remove('is-booting');
  }
  boot();
})();

'use strict';
/* سَكِينَة web: same screens and content as the Android app. No network calls, no analytics. */
const $ = (s, r = document) => r.querySelector(s);
const APP = $('#app');
const AR_DIG = '٠١٢٣٤٥٦٧٨٩';
const ar = n => String(n).replace(/[0-9]/g, d => AR_DIG[d]);
function norm(s) {
  let o = '';
  for (const c of s) {
    const k = c.codePointAt(0);
    if ((k >= 0x064B && k <= 0x065F) || k === 0x0670 || (k >= 0x06D6 && k <= 0x06ED) || k === 0x0640 || k === 0x08D3 || k === 0x200F || k === 0xFEFF) continue;
    if ('أإآٱ'.includes(c)) o += 'ا'; else if (c === 'ى') o += 'ي'; else if (c === 'ة') o += 'ه'; else if (c === 'ؤ') o += 'و'; else if (c === 'ئ') o += 'ي'; else if (c === 'ء') continue; else o += c;
  }
  return o;
}
const tokens = q => norm(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 6);
const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const gregMonths = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const weekDays = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => ymd(new Date());
function hijriText(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const g = t => parseInt(p.find(x => x.type === t).value, 10);
  return `${ar(g('day'))} ${hijriMonths[g('month') - 1]} ${ar(g('year'))} هـ`;
}
const gregText = (d = new Date()) => `${weekDays[(d.getDay() + 6) % 7]}، ${ar(d.getDate())} ${gregMonths[d.getMonth()]} ${ar(d.getFullYear())}`;
const greeting = h => h >= 4 && h <= 10 ? 'صباح الخير والطمأنينة' : h >= 11 && h <= 15 ? 'طاب يومك بذكر الله' : h >= 16 && h <= 18 ? 'مساء الخير والسكينة' : 'ليلة هادئة بذكر الله';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- storage ---------- */
const DEF = { settings: { textScale: 1, darkMode: 0, contrast: false, reduceMotion: false, vibrate: true, silent: false, onboarded: false },
  favs: [], colls: [], collItems: [], days: [], tdays: {}, recents: [], hist: [], sessions: {}, qLast: null, tas: { count: 0, preset: 'r0', target: 100 }, nextColl: 1 };
let S;
function load() { try { S = Object.assign(structuredClone(DEF), JSON.parse(localStorage.getItem('sakeenah.v1') || '{}')); S.settings = Object.assign({}, DEF.settings, S.settings); } catch (e) { S = structuredClone(DEF); } }
let saveT; function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('sakeenah.v1', JSON.stringify(S)); } catch (e) {} }, 150); }
load();

/* ---------- data ---------- */
let ITEMS = [], BYID = {}, QURAN = [], THEMES = [], CATS = [];
async function loadData() {
  const [c, q, t] = await Promise.all(['content', 'quran', 'themes'].map(n => fetch(`${n}.json`).then(r => r.json())));
  ITEMS = c.map(o => ({ itemId: o.id, kind: o.k, catId: o.c, catTitle: o.ct, ord: o.o, title: o.t || '', text: o.x, count: o.n, ref: o.r || '', tafsir: o.tf || '', source: o.s || '', norm: norm((o.t || '') + ' ' + o.ct + ' ' + o.x) }));
  ITEMS.forEach(i => BYID[i.itemId] = i);
  QURAN = q; THEMES = t.themes;
  const seen = new Map(); ITEMS.filter(i => i.kind === 'hisn').forEach(i => { if (!seen.has(i.catId)) seen.set(i.catId, i.catTitle); });
  CATS = [...seen].sort((a, b) => a[0] - b[0]).map(([catId, catTitle]) => ({ catId, catTitle }));
}
const catItems = c => ITEMS.filter(i => i.catId === c).sort((a, b) => a.ord - b.ord);
const DUAS = () => ITEMS.filter(i => i.kind === 'dua').sort((a, b) => a.ord - b.ord);
const slots = [{ key: 'morning', title: 'أذكار الصباح', cat: 1 }, { key: 'evening', title: 'أذكار المساء', cat: 1 }, { key: 'sleep', title: 'أذكار النوم', cat: 2 }, { key: 'post', title: 'أذكار بعد الصلاة', cat: 27 }];
const sourceOf = i => i.source || 'حصن المسلم للشيخ سعيد بن علي بن وهف القحطاني (النص كما في مجموعة Adhkar-json المفتوحة)';
const shareTextOf = i => [i.title, i.text, i.ref, 'المصدر: ' + sourceOf(i), 'من تطبيق سَكِينَة — رفيق قلبك في كل حين'].filter(Boolean).join('\n');

/* ---------- icons ---------- */
const IC = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z', fav: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  favo: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  add: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  set: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z',
  back: 'M4 12l8-8 1.41 1.41L7.83 11H20v2H7.83l5.58 5.59L12 20z', info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z', check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10z', del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', up: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z', dn: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z', x: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${IC[n]}"/></svg>`;

/* ---------- ui helpers ---------- */
function applyTheme() {
  const s = S.settings;
  const dark = s.darkMode === 2 || (s.darkMode === 0 && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark); document.body.classList.toggle('hc', s.contrast); document.body.classList.toggle('rm', s.reduceMotion);
  document.documentElement.style.setProperty('--scale', s.textScale);
  $('meta[name=theme-color]').content = dark ? '#0E1A22' : '#F7F2E8';
}
function vibrate(ms) { if (S.settings.vibrate && !S.settings.silent && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; APP.appendChild(e); setTimeout(() => e.remove(), 2200); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch (_) {} a.remove(); } }
async function shareText(t) { if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === 'AbortError') return; } } copyText(t); }
function topbar(title, back, actions = '') { return `<div class="topbar">${back ? `<button class="ib" data-act="back" aria-label="رجوع"><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="${IC.back}"/></svg></button>` : '<span style="width:12px"></span>'}<h1>${esc(title)}</h1>${actions}</div>`; }
const ibtn = (name, label, act, extra = '') => `<button class="ib" aria-label="${label}" data-act="${act}" ${extra}>${icon(name)}</button>`;
const card = (inner, go = '', cls = '') => go ? `<button class="card click ${cls}" data-go="${go}">${inner}</button>` : `<div class="card ${cls}">${inner}</div>`;
const pill = (t, sel, attrs) => `<button class="pill ${sel ? 'sel' : ''}" ${attrs}>${esc(t)}</button>`;
const sec = (t, m = '') => `<div class="sec" ${m ? `style="margin:${m}"` : ''}>${esc(t)}</div>`;
const empty = t => `<div class="empty">${esc(t)}</div>`;
function dialog(html, onMount) {
  const bg = document.createElement('div'); bg.className = 'dlgbg'; bg.innerHTML = `<div class="dlg" role="dialog">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  APP.appendChild(bg); onMount && onMount(bg, () => bg.remove()); return bg;
}
function confirmDlg(title, body, yes, onYes) {
  dialog(`<h3>${esc(title)}</h3><div class="sub" style="font-size:17px">${esc(body)}</div><div class="acts"><button class="tbtn" data-y>${esc(yes)}</button><button class="tbtn" data-n>إلغاء</button></div>`, (bg, close) => {
    $('[data-y]', bg).onclick = () => { close(); onYes(); }; $('[data-n]', bg).onclick = close;
  });
}

/* ---------- state ops ---------- */
const isFav = k => S.favs.some(f => f.key === k);
function toggleFav(k) { if (isFav(k)) S.favs = S.favs.filter(f => f.key !== k); else S.favs.unshift({ key: k, ts: Date.now() }); save(); }
function addRecent(k) { S.recents = [{ key: k, ts: Date.now() }, ...S.recents.filter(r => r.key !== k)].slice(0, 30); save(); }
const dayDone = (date, slot) => S.days.some(d => d.date === date && d.slot === slot && d.done);
function markDay(slot) { if (!dayDone(todayStr(), slot)) { S.days.push({ date: todayStr(), slot, done: 1 }); save(); } }
function describe(key) {
  if (key.startsWith('q:')) { const [, n, a] = key.split(':').map(Number); const s = QURAN[n - 1]; if (!s) return null; const t = s.a[a - 1]; if (t == null) return null; return { key, title: `سورة ${s.name}، الآية ${ar(a)}`, preview: t, norm: norm(t) }; }
  const i = BYID[key]; return i ? { key, title: i.title || i.catTitle, preview: i.text, norm: i.norm } : null;
}
function openKey(key) { if (key.startsWith('q:')) { const p = key.split(':'); go(`#/surah/${p[1]}?ay=${p[2]}`); } else go(`#/item/${key}`); }

/* ---------- router ---------- */
let route = { path: '', q: new URLSearchParams() }, tab = 0, histDepth = 0;
function go(h) { location.hash = h; }
function back() { if (history.length > 1 && histDepth > 0) { histDepth--; history.back(); } else go('#/main'); }
window.addEventListener('hashchange', () => { histDepth++; render(); });
function parse() { const h = location.hash.slice(1) || '/splash'; const [p, q] = h.split('?'); return { path: p, q: new URLSearchParams(q || '') }; }
let ready = false, cleanup = null;
function render() {
  if (!ready) return;
  if (cleanup) { cleanup(); cleanup = null; }
  route = parse(); const seg = route.path.split('/').filter(Boolean); const name = seg[0], arg = seg[1];
  if (!S.settings.onboarded && name !== 'onboarding' && name !== 'splash') return go('#/onboarding');
  let html = '', mount = null;
  switch (name) {
    case 'onboarding': ({ html, mount } = onboarding()); break;
    case 'main': case 'splash': ({ html, mount } = mainScreen()); break;
    case 'reader': ({ html, mount } = reader(+arg, route.q.get('slot') || '')); break;
    case 'item': ({ html, mount } = detail(decodeURIComponent(arg))); break;
    case 'theme': ({ html, mount } = themeScreen(arg)); break;
    case 'quran': ({ html, mount } = quranList()); break;
    case 'surah': ({ html, mount } = surah(+arg, +(route.q.get('ay') || 1))); break;
    case 'search': ({ html, mount } = search()); break;
    case 'wird': ({ html, mount } = wird()); break;
    case 'settings': ({ html, mount } = settings()); break;
    case 'about': ({ html, mount } = about()); break;
    case 'privacy': ({ html, mount } = privacy()); break;
    case 'collection': ({ html, mount } = collection(+arg)); break;
    default: return go('#/main');
  }
  APP.innerHTML = `<div class="screen">${html}</div>`;
  const root = $('.screen'); mount && mount(root);
  bindCommon(root);
}
function bindCommon(root) {
  root.querySelectorAll('[data-go]').forEach(e => e.onclick = () => go(e.dataset.go));
  root.querySelectorAll('[data-act=back]').forEach(e => e.onclick = back);
  root.querySelectorAll('[data-open]').forEach(e => e.onclick = () => openKey(e.dataset.open));
}

/* ---------- onboarding ---------- */
function onboarding() {
  const pages = [['home', 'ذكر يومي بهدوء', 'أذكار الصباح والمساء والنوم وبعد الصلاة، بنصوص من حصن المسلم وعدّاد يرافقك.'], ['star', 'أدعية من القرآن', 'أدعية الأنبياء وأدعية القرآن بنصّها كما في المصحف، مع التفسير الميسر.'], ['fav', 'طمأنينة للقلب', 'مواضيع مرتبة حسب ما تشعر به: الهم، الكرب، الدَّين، الصبر، المغفرة.'], ['search', 'القرآن والبحث دون إنترنت', 'المصحف كاملاً وبحث عربي محلي، كل ذلك داخل جهازك.'], ['cal', 'وردك الشخصي', 'مسبحة رقمية، مفضلة ومجموعات. بياناتك تبقى على جهازك.']];
  let i = 0;
  const html = `<div class="onb"><div class="row" style="justify-content:flex-start"><button class="tbtn" data-skip style="color:var(--sub);font-size:18px">تخطّي</button></div><div class="pg" id="pg"></div><div class="row" style="justify-content:center;padding:12px" id="dots"></div><button class="bigbtn" id="nx" style="width:100%"></button></div>`;
  return { html, mount: r => {
    const draw = () => { const [ic, t, b] = pages[i]; $('#pg', r).innerHTML = `<div class="ic">${icon(ic)}</div><h2>${t}</h2><p>${b}</p>`; $('#dots', r).innerHTML = pages.map((_, k) => `<span class="dot ${k === i ? 'on' : ''}"></span>`).join(''); $('#nx', r).textContent = i === pages.length - 1 ? 'ابدأ' : 'التالي'; };
    const fin = () => { S.settings.onboarded = true; save(); go('#/main'); };
    $('#nx', r).onclick = () => i === pages.length - 1 ? fin() : (i++, draw()); $('[data-skip]', r).onclick = fin; draw();
    let x0 = null; r.addEventListener('touchstart', e => x0 = e.touches[0].clientX); r.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { i = Math.max(0, Math.min(pages.length - 1, i + (dx > 0 ? 1 : -1))); draw(); } x0 = null; });
  } };
}

/* ---------- main + tabs ---------- */
const NAV = [['الرئيسية', 'home'], ['الأذكار', 'menu'], ['طمأنينة', 'fav'], ['المسبحة', 'add'], ['مكتبتي', 'star']];
function mainScreen() {
  const html = `<div class="scroll" id="tabbody"></div><nav class="nav">${NAV.map((n, i) => `<button data-tab="${i}" aria-label="${n[0]}"><span class="ind">${icon(n[1])}</span>${n[0]}</button>`).join('')}</nav>`;
  return { html, mount: r => {
    const draw = () => {
      if (cleanup) { cleanup(); cleanup = null; }
      r.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('sel', +b.dataset.tab === tab));
      const body = $('#tabbody', r); body.scrollTop = 0;
      const t = [homeTab, azkarTab, comfortTab, tasbeehTab, libraryTab][tab](body);
      body.innerHTML = t.html; t.mount && t.mount(body); bindCommon(body);
      body.querySelectorAll('[data-tabgo]').forEach(e => e.onclick = () => { tab = +e.dataset.tabgo; draw(); });
    };
    r.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = +b.dataset.tab; draw(); });
    draw();
  } };
}

/* sky header */
function skyBand(h) { return h >= 5 && h <= 10 ? 0 : h >= 11 && h <= 15 ? 1 : h >= 16 && h <= 18 ? 2 : 3; }
function drawSky(cv, hour) {
  const b = skyBand(hour), r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); const w = r.width, h = r.height;
  const cols = [['#3F6E8C', '#E8A367'], ['#2F7F86', '#8FC6C0'], ['#4B3F72', '#E0804F'], ['#0B1624', '#1F3A4D']][b];
  const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, cols[0]); lg.addColorStop(1, cols[1]); g.fillStyle = lg; g.fillRect(0, 0, w, h);
  const glow = (x, y, rad, c) => { const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); };
  const dot = (x, y, rad, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); };
  if (b === 0 || b === 2) { const x = w * (b === 0 ? 0.78 : 0.25), y = h * 0.82; glow(x, y, h * 0.7, 'rgba(255,228,168,.4)'); dot(x, y, h * 0.13, '#FFE2A0'); }
  else if (b === 1) { const x = w * 0.8, y = h * 0.28; glow(x, y, h * 0.5, 'rgba(255,255,255,.33)'); dot(x, y, h * 0.1, '#FFF3CC'); }
  else {
    const rr = h * 0.12, x = w * 0.8, y = h * 0.3; dot(x, y, rr, '#F1E7C8'); dot(x + rr * 0.5, y - rr * 0.15, rr * 0.9, '#14283A');
    [[.1, .15], [.25, .3], [.4, .12], [.55, .38], [.65, .18], [.9, .55], [.15, .6], [.5, .7], [.33, .5]].forEach((p, i) => dot(w * p[0], h * p[1], 2.5 + (i % 3), `rgba(255,255,255,${S.settings.reduceMotion ? .8 : (i % 2 ? .6 : .9)})`));
  }
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * .88); g.bezierCurveTo(w * .25, h * .78, w * .5, h * .95, w * .75, h * .84); g.bezierCurveTo(w * .88, h * .8, w * .95, h * .86, w, h * .83); g.lineTo(w, h); g.fill();
}
function homeTab() {
  const hour = new Date().getHours(), today = todayStr();
  const done = new Set(S.days.filter(d => d.date === today && d.done).map(d => d.slot));
  const cont = Object.entries(S.sessions).find(([k, s]) => s.date === today && !s.complete);
  const doy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const shorts = ITEMS.filter(i => i.kind === 'hisn' && [1, 129, 130, 35, 34, 26, 27].includes(i.catId) && i.text.length < 260).sort((a, b) => a.catId - b.catId || a.ord - b.ord);
  const duas = DUAS();
  const dhikr = shorts.length ? shorts[doy % shorts.length] : null, dua = duas.length ? duas[doy % duas.length] : null, dua2 = duas.length ? duas[(doy + 7) % duas.length] : null;
  let h = `<div class="sky"><canvas></canvas><div class="in"><div class="row"><div class="grow" style="font-size:18px;opacity:.85">سَكِينَة</div>${ibtn('search', 'بحث', 'x', 'data-go="#/search" style="color:#fff"')}${ibtn('set', 'الإعدادات', 'x', 'data-go="#/settings" style="color:#fff"')}</div><h2>${greeting(hour)}</h2><div style="font-size:19px">${hijriText()}</div><div style="font-size:16px;opacity:.85">${gregText()}</div></div></div>`;
  const n = slots.filter(s => done.has(s.key)).length;
  h += `<div style="padding:16px">${card(`<div class="row"><div class="grow" style="font-size:20px;font-weight:700">وردك اليوم</div><div class="gold" style="font-size:18px">${ar(n)} من ${ar(slots.length)}</div></div><div class="bar" style="margin:8px 0 6px"><i style="width:${n / slots.length * 100}%"></i></div><div class="sub" style="font-size:15px">${n === slots.length ? 'ما شاء الله، أتممت أذكار اليوم.' : 'خطوة هادئة كل مرة، وما تيسّر منها فهو خير.'}</div>`, '#/wird')}</div>`;
  h += `<div class="col" style="padding:0 16px">` + [0, 2].map(i => `<div class="row" style="align-items:stretch">${[slots[i], slots[i + 1]].map(sl => `<div class="grow">${card(`<div class="row"><div class="grow" style="font-size:18px;font-weight:700">${sl.title}</div>${done.has(sl.key) ? icon('check', 'chk') : ''}</div>`, `#/reader/${sl.cat}?slot=${sl.key}`)}</div>`).join('')}</div>`).join('') + `</div>`;
  if (cont) { const [k] = cont; const sl = slots.find(s => s.key === k); const cat = sl ? sl.cat : (+k.replace('cat', '') || 1); const t = sl ? sl.title : (CATS.find(c => c.catId === cat) || {}).catTitle || 'باب من الأذكار'; h += `<div style="padding:16px">${card(`<div class="gold" style="font-size:16px">تابع ما بدأت</div><div style="font-size:20px;font-weight:700">${esc(t)}</div>`, `#/reader/${cat}${sl ? '?slot=' + sl.key : ''}`)}</div>`; }
  if (S.qLast) { const [sn, an] = S.qLast.split(':').map(Number); const su = QURAN[sn - 1]; if (su) h += `<div style="padding:0 16px">${card(`<div class="gold" style="font-size:16px">تابع القراءة</div><div style="font-size:20px;font-weight:700">سورة ${su.name}، الآية ${ar(an)}</div>`, `#/surah/${sn}?ay=${an}`)}</div>`; }
  const clamp = (n) => `display:-webkit-box;-webkit-line-clamp:${n};-webkit-box-orient:vertical;overflow:hidden`;
  if (dhikr) h += sec('ذكر اليوم') + `<div style="padding:0 16px">${card(`<div style="font-size:22px;line-height:1.7;${clamp(6)}">${esc(dhikr.text)}</div><div class="gold" style="font-size:15px;margin-top:6px">${esc(dhikr.catTitle)}</div>`, `#/item/${dhikr.itemId}`)}</div>`;
  if (dua) h += sec('دعاء اليوم من القرآن') + `<div style="padding:0 16px">${card(`<div class="q" style="font-size:24px;line-height:1.8;${clamp(6)}">${esc(dua.text)}</div><div class="gold" style="font-size:15px;margin-top:6px">${esc(dua.title)} • ${esc(dua.ref)}</div>`, `#/item/${dua.itemId}`)}</div>`;
  if (dua2 && dua2.tafsir) h += sec('تأمّل اليوم') + `<div style="padding:0 16px">${card(`<div style="font-size:18px;line-height:1.7;${clamp(5)}">${esc(dua2.tafsir)}</div><div class="gold" style="font-size:14px;margin-top:6px">التفسير الميسر • ${esc(dua2.ref)}</div>`, `#/item/${dua2.itemId}`)}</div>`;
  h += sec('اختصارات') + `<div class="row" style="padding:0 16px;align-items:stretch"><div class="grow"><button class="card click" data-tabgo="3" style="font-size:18px;font-weight:700">المسبحة</button></div><div class="grow"><button class="card click" data-tabgo="4" style="font-size:18px;font-weight:700">المفضلة</button></div><div class="grow">${card('<span style="font-size:18px;font-weight:700">المصحف</span>', '#/quran')}</div></div>`;
  const picks = ['hamm', 'karb', 'dayn', 'sabr', 'maghfira', 'rizq', 'dhuriya', 'najat']; const list = THEMES.filter(t => picks.includes(t.id));
  h += sec('ماذا يشغل قلبك؟') + `<div style="padding:0 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">${list.map(t => `<button class="pill" data-go="#/theme/${t.id}">${esc(t.title)}</button>`).join('')}</div><button class="tbtn" data-tabgo="2" style="color:var(--gold);margin:0 8px">كل المواضيع</button><div style="height:24px"></div>`;
  return { html: h, mount: r => { const cv = $('canvas', r); const d = () => drawSky(cv, hour); d(); const ro = new ResizeObserver(d); ro.observe(cv.parentElement); cleanup = () => ro.disconnect(); } };
}
function azkarTab() {
  const h = `${topbar('الأذكار', false, ibtn('search', 'بحث في كل المحتوى', 'x', 'data-go="#/search"'))}<div class="pad col" id="az"><div class="gold" style="font-size:20px;font-weight:700">الأذكار اليومية</div>${slots.map(sl => card(`<span style="font-size:20px;font-weight:700">${sl.title}</span>`, `#/reader/${sl.cat}?slot=${sl.key}`)).join('')}<div class="gold" style="font-size:20px;font-weight:700;margin-top:8px">حصن المسلم: كل الأبواب</div><input id="cq" placeholder="ابحث في أبواب الأذكار"><div class="col" id="cl" style="gap:8px"></div></div>`;
  return { html: h, mount: r => { const draw = () => { const nq = norm($('#cq', r).value), l = CATS.filter(c => !nq || norm(c.catTitle).includes(nq)); $('#cl', r).innerHTML = l.map(c => `<button class="catrow" data-go="#/reader/${c.catId}">${esc(c.catTitle)}</button>`).join('') || empty('لا يوجد باب بهذا الاسم'); bindCommon($('#cl', r)); }; $('#cq', r).oninput = draw; draw(); } };
}
function comfortTab() {
  const h = `${topbar('طمأنينة', false, ibtn('search', 'بحث', 'x', 'data-go="#/search"'))}<div class="pad col"><div class="sub" style="font-size:17px">أدعية وأذكار مرتبة حسب ما في قلبك. اختر ما يناسبك.</div><div class="row" style="align-items:stretch"><div class="grow">${card('<div style="font-size:18px;font-weight:700">أدعية الأنبياء</div><div class="sub" style="font-size:14px">من القرآن الكريم</div>', '#/theme/prophets')}</div><div class="grow">${card('<div style="font-size:18px;font-weight:700">كل أدعية القرآن</div><div class="sub" style="font-size:14px">مع التفسير الميسر</div>', '#/theme/all')}</div></div>${card('<div style="font-size:18px;font-weight:700">المصحف الشريف</div><div class="sub" style="font-size:14px">اقرأ من حيث توقفت</div>', '#/quran')}${THEMES.map(t => card(`<div style="font-size:19px;font-weight:700">${esc(t.title)}</div><div class="sub" style="font-size:14px">${(t.duas.length ? ar(t.duas.length) + ' أدعية من القرآن' : '') + (t.duas.length && t.cats.length ? ' • ' : '') + (t.cats.length ? ar(t.cats.length) + ' أبواب من حصن المسلم' : '')}</div>`, `#/theme/${t.id}`)).join('')}</div>`;
  return { html: h };
}

/* ---------- tasbeeh ---------- */
const prescribed = [{ key: 'r0', phrase: 'سبحان الله', target: 33 }, { key: 'r1', phrase: 'الحمد لله', target: 33 }, { key: 'r2', phrase: 'الله أكبر', target: 33 }, { key: 'r3', phrase: 'سبحان الله وبحمده', target: 100 }];
const phrases = ['سبحان الله', 'الحمد لله', 'لا إله إلا الله', 'الله أكبر', 'سبحان الله وبحمده', 'سبحان الله العظيم', 'لا حول ولا قوة إلا بالله', 'أستغفر الله', 'اللهم صلِّ وسلِّم على نبينا محمد'];
function tasbeehTab() {
  const html = `${topbar('المسبحة', false)}<div id="tw" style="padding:0 16px;text-align:center"></div>`;
  return { html, mount: r => {
    const T = S.tas, w = $('#tw', r);
    const draw = () => {
      const pre = prescribed.find(p => p.key === T.preset), pi = T.preset.startsWith('p:') ? +T.preset.slice(2) : 0;
      const phrase = pre ? pre.phrase : phrases[pi] || phrases[0], target = pre ? pre.target : T.target, presc = !!pre, fin = target > 0 && T.count >= target;
      const prog = target > 0 ? Math.min(1, T.count / target) : 0, R = 122, C = 2 * Math.PI * R;
      const hist = Object.entries(S.tdays).sort((a, b) => b[0].localeCompare(a[0])).filter(([d]) => d !== todayStr()).slice(0, 6);
      w.innerHTML = `<div class="gold" style="font-size:15px;text-align:start">عدد مشروع</div><div class="hs">${prescribed.map(p => pill(`${p.phrase} ${ar(p.target)}`, T.preset === p.key, `data-pre="${p.key}"`)).join('')}</div><div class="sub" style="font-size:15px;text-align:start">هدف شخصي</div><div class="hs">${phrases.map((p, i) => pill(p, T.preset === 'p:' + i, `data-pre="p:${i}"`)).join('')}</div>
<div style="font-size:30px;font-weight:700;margin-top:18px">${esc(phrase)}</div><div style="font-size:16px;color:var(${presc ? '--gold' : '--sub'})">${presc ? 'عدد مشروع من حصن المسلم: ' + ar(target) : target > 0 ? 'هدفك الشخصي: ' + ar(target) + ' (ليس عدداً مشروعاً)' : 'عدّ حر دون هدف'}</div>
<div class="tas" id="tas" role="button" aria-label="عدّاد المسبحة، العدد ${ar(T.count)}" style="margin-top:14px"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="130" fill="var(--primary)" opacity="${document.body.classList.contains('dark') ? .35 : .1}"/><circle cx="130" cy="130" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="16"/>${target > 0 ? `<circle cx="130" cy="130" r="${R}" fill="none" stroke="var(--gold)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${C * prog} ${C}" transform="rotate(-90 130 130)"/>` : ''}</svg><div class="c"><div style="font-size:64px;font-weight:700">${ar(T.count)}</div>${fin ? '<div class="gold" style="font-size:18px">اكتمل، تقبّل الله</div>' : `<div class="sub" style="font-size:16px">${target > 0 ? 'من ' + ar(target) : 'اضغط للعد'}</div>`}</div></div>
<div class="row" style="justify-content:center;margin:14px 0"><button class="obtn" id="rs">تصفير</button>${presc ? '' : '<button class="obtn" id="tg">تغيير الهدف</button>'}</div>
<div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><span style="font-size:17px">اهتزاز</span><button class="sw ${S.settings.vibrate ? 'on' : ''}" data-sw="vibrate" aria-label="اهتزاز"></button><span style="font-size:17px;margin-inline-start:16px">وضع الصمت</span><button class="sw ${S.settings.silent ? 'on' : ''}" data-sw="silent" aria-label="وضع الصمت"></button></div>
<div class="sec" style="margin:20px 0 8px;text-align:start">سجل الأيام</div><div style="font-size:18px;text-align:start">اليوم: ${ar(S.tdays[todayStr()] || 0)}</div>${hist.map(([d, n]) => `<div class="sub" style="font-size:16px;text-align:start">${d}: ${ar(n)}</div>`).join('')}<div style="height:24px"></div>`;
      w.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { if (T.preset !== b.dataset.pre) { T.preset = b.dataset.pre; T.count = 0; save(); draw(); } });
      w.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { S.settings[b.dataset.sw] = !S.settings[b.dataset.sw]; save(); draw(); });
      $('#tas', w).onclick = () => { if (fin) return; T.count++; S.tdays[todayStr()] = (S.tdays[todayStr()] || 0) + 1; save(); vibrate(target > 0 && T.count >= target ? 90 : 12); draw(); };
      $('#rs', w).onclick = () => confirmDlg('تصفير العدّاد', 'هل تريد إعادة العدّاد إلى الصفر؟ لن يُحذف سجل اليوم.', 'تصفير', () => { T.count = 0; save(); draw(); });
      const tg = $('#tg', w); if (tg) tg.onclick = () => dialog(`<h3>هدفك الشخصي</h3><div class="sub">اكتب العدد الذي تريده. اتركه 0 للعدّ الحر.</div><input id="tv" inputmode="numeric" value="${T.target}" style="margin-top:8px"><div class="acts"><button class="tbtn" data-y>حفظ</button><button class="tbtn" data-n>إلغاء</button></div>`, (bg, close) => { $('[data-y]', bg).onclick = () => { T.target = parseInt($('#tv', bg).value.replace(/\D/g, '').slice(0, 6) || '0', 10); save(); close(); draw(); }; $('[data-n]', bg).onclick = close; });
    };
    draw();
  } };
}

/* ---------- library ---------- */
let libTab = 0, libQ = '';
function dispRow(d, trailing = '') { return `<div class="row" style="background:var(--surface);border-radius:16px;padding:14px"><button class="grow" data-open="${esc(d.key)}" style="text-align:start"><div class="gold" style="font-size:16px;font-weight:700">${esc(d.title)}</div><div style="font-size:18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(d.preview)}</div></button>${trailing}</div>`; }
function libraryTab() {
  const html = `${topbar('مكتبتي', false, ibtn('set', 'الإعدادات', 'x', 'data-go="#/settings"'))}<div class="pills" style="padding:0 16px 8px">${['المفضلة', 'مجموعاتي', 'الأخيرة'].map((t, i) => pill(t, libTab === i, `data-lt="${i}"`)).join('')}</div><div id="lb"></div>`;
  return { html, mount: r => {
    const draw = () => {
      r.querySelectorAll('[data-lt]').forEach(b => b.classList.toggle('sel', +b.dataset.lt === libTab));
      const lb = $('#lb', r); const nq = norm(libQ);
      const srch = libTab !== 1 ? `<div style="padding:8px 16px"><input id="lq" placeholder="ابحث في المحفوظات" value="${esc(libQ)}"></div>` : '';
      let body = '';
      if (libTab === 1) {
        body = `<div class="pad col"><button class="bigbtn" id="nc">مجموعة جديدة</button>${S.colls.length ? '' : empty('أنشئ مجموعات لتنظيم ما تحب، مثل: أدعيتي في الصباح.')}${S.colls.map(c => card(`<div style="font-size:19px;font-weight:700">${esc(c.name)}</div><div class="sub" style="font-size:14px">${ar(S.collItems.filter(x => x.collId === c.id).length)} عنصر</div>`, `#/collection/${c.id}`)).join('')}</div>`;
      } else {
        const src = libTab === 0 ? S.favs : S.recents; const l = src.map(f => describe(f.key)).filter(Boolean).filter(d => !nq || d.norm.includes(nq) || norm(d.title).includes(nq));
        body = `<div class="pad col" style="gap:8px">${l.length ? l.map(d => dispRow(d)).join('') : empty(libTab === 0 ? (S.favs.length ? 'لا نتائج' : 'لم تضف شيئاً إلى المفضلة بعد.\nاضغط على القلب في أي ذكر أو دعاء أو آية.') : (S.recents.length ? 'لا نتائج' : 'ما اطّلعت عليه سيظهر هنا.'))}</div>`;
      }
      lb.innerHTML = srch + body; bindCommon(lb);
      const lq = $('#lq', lb); if (lq) lq.oninput = e => { libQ = e.target.value; const pos = e.target.selectionStart; draw(); const n = $('#lq', lb); n.focus(); n.setSelectionRange(pos, pos); };
      const nc = $('#nc', lb); if (nc) nc.onclick = () => dialog(`<h3>مجموعة جديدة</h3><input id="cn" placeholder="الاسم"><div class="acts"><button class="tbtn" data-y>إنشاء</button><button class="tbtn" data-n>إلغاء</button></div>`, (bg, close) => { $('[data-y]', bg).onclick = () => { const n = $('#cn', bg).value.trim(); if (n) { S.colls.push({ id: S.nextColl++, name: n, ord: S.colls.length + 1 }); save(); close(); draw(); } }; $('[data-n]', bg).onclick = close; });
    };
    r.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { libTab = +b.dataset.lt; draw(); }); draw();
  } };
}
function collection(id) {
  const c = S.colls.find(x => x.id === id);
  if (!c) return { html: topbar('', true) + empty('المجموعة غير موجودة') };
  const items = () => S.collItems.filter(x => x.collId === id).sort((a, b) => a.ord - b.ord);
  const html = `${topbar(c.name, true, ibtn('edit', 'إعادة تسمية', 'x', 'id="rn"') + ibtn('del', 'حذف المجموعة', 'x', 'id="dl"'))}<div class="scroll pad col" id="ci" style="gap:8px"></div>`;
  return { html, mount: r => {
    const draw = () => {
      const l = items().map(ci => ({ ci, d: describe(ci.key) })).filter(x => x.d);
      $('#ci', r).innerHTML = l.length ? l.map(({ ci, d }, i) => dispRow(d, `<div style="display:flex;flex-direction:column"><button class="ib" style="width:40px;height:40px" data-mv="${i}:-1" aria-label="تحريك للأعلى">${icon('up')}</button><button class="ib" style="width:40px;height:40px" data-mv="${i}:1" aria-label="تحريك للأسفل">${icon('dn')}</button></div><button class="ib" data-rm="${esc(ci.key)}" aria-label="إزالة من المجموعة">${icon('x')}</button>`)).join('') : empty('المجموعة فارغة. أضف إليها من زر "إلى مجموعة" في صفحة أي ذكر أو دعاء.');
      bindCommon($('#ci', r));
      r.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { S.collItems = S.collItems.filter(x => !(x.collId === id && x.key === b.dataset.rm)); save(); draw(); });
      r.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const [i, dlt] = b.dataset.mv.split(':').map(Number), a = l[i], o = l[i + dlt]; if (!o) return; const t = a.ci.ord; a.ci.ord = o.ci.ord; o.ci.ord = t; save(); draw(); });
    };
    draw();
    $('#rn', r).onclick = () => dialog(`<h3>إعادة تسمية</h3><input id="cn" value="${esc(c.name)}"><div class="acts"><button class="tbtn" data-y>حفظ</button><button class="tbtn" data-n>إلغاء</button></div>`, (bg, close) => { $('[data-y]', bg).onclick = () => { const n = $('#cn', bg).value.trim(); if (n) { c.name = n; save(); close(); render(); } }; $('[data-n]', bg).onclick = close; });
    $('#dl', r).onclick = () => confirmDlg('حذف المجموعة', 'ستُحذف المجموعة دون حذف العناصر من المفضلة.', 'حذف', () => { S.colls = S.colls.filter(x => x.id !== id); S.collItems = S.collItems.filter(x => x.collId !== id); save(); back(); });
  } };
}
function addToCollection(key) {
  dialog(`<h3>إضافة إلى مجموعة</h3>${S.colls.length ? '' : '<div class="sub">لا توجد مجموعات بعد. أنشئ مجموعتك الأولى:</div>'}${S.colls.map(c => `<button class="tbtn" style="width:100%;font-size:18px" data-c="${c.id}">${esc(c.name)}</button>`).join('')}<input id="cn" placeholder="مجموعة جديدة" style="margin-top:8px"><div class="acts"><button class="tbtn" data-y>إنشاء وإضافة</button><button class="tbtn" data-n>إغلاق</button></div>`, (bg, close) => {
    const add = id => { const max = Math.max(0, ...S.collItems.filter(x => x.collId === id).map(x => x.ord)); S.collItems = S.collItems.filter(x => !(x.collId === id && x.key === key)); S.collItems.push({ collId: id, key, ord: max + 1 }); save(); close(); toast('أُضيف إلى المجموعة'); };
    bg.querySelectorAll('[data-c]').forEach(b => b.onclick = () => add(+b.dataset.c));
    $('[data-y]', bg).onclick = () => { const n = $('#cn', bg).value.trim(); if (n) { const id = S.nextColl++; S.colls.push({ id, name: n, ord: 999 }); add(id); } }; $('[data-n]', bg).onclick = close;
  });
}

/* ---------- share card ---------- */
const cardStyleNames = ['ليل', 'عاج', 'زمردي'];
async function renderCard(text, sub, variant, quran) {
  await document.fonts.load('64px Amiri'); await document.fonts.load('bold 36px Amiri'); await document.fonts.load('64px AmiriQuran');
  const [c1, c2, ink, gold] = [['#0E1A22', '#1D3342', '#EDE6D6', '#D9B96B'], ['#F7F2E8', '#EADFC4', '#1B2B2A', '#9A7A2E'], ['#174A47', '#0E2E33', '#F3EBD8', '#E0C27A']][variant];
  const W = 1080, pad = 110, maxW = W - pad * 2;
  const meas = document.createElement('canvas').getContext('2d'); meas.direction = 'rtl';
  const wrap = (g, t, fnt) => { g.font = fnt; const words = t.split(/\s+/), lines = []; let cur = ''; for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; } if (cur) lines.push(cur); return lines; };
  let size = 64, lines; const fam = quran ? 'AmiriQuran' : 'Amiri';
  for (;;) { lines = wrap(meas, text, `${size}px ${fam}`); if (lines.length * size * 1.35 <= 1000 || size <= 30) break; size -= 3; }
  const subL = wrap(meas, sub, 'bold 36px Amiri'), top = 230, th = lines.length * size * 1.35, sh = subL.length * 36 * 1.3;
  const H = Math.max(1350, top + th + 60 + sh + 300), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.direction = 'rtl'; g.textAlign = 'center';
  const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, c1); lg.addColorStop(1, c2); g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.strokeStyle = gold; g.globalAlpha = .63; g.lineWidth = 3; g.beginPath(); g.roundRect(40, 40, W - 80, H - 80, 40); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.roundRect(58, 58, W - 116, H - 116, 30); g.stroke(); g.globalAlpha = 1;
  const logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'logo.png'; }); g.drawImage(logo, (W - 120) / 2, 100, 120, 120);
  g.fillStyle = ink; g.font = `${size}px ${fam}`; lines.forEach((l, i) => g.fillText(l, W / 2, top + 40 + size * 1.1 + i * size * 1.35));
  g.fillStyle = gold; g.font = 'bold 36px Amiri'; subL.forEach((l, i) => g.fillText(l, W / 2, top + 40 + th + 50 + 36 + i * 36 * 1.3));
  g.font = 'bold 34px Amiri'; g.fillText('سَكِينَة — رفيق قلبك في كل حين', W / 2, H - 110);
  return cv;
}
async function shareCard(text, sub, style, quran) {
  const cv = await renderCard(text, sub, style, quran); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const f = new File([blob], 'sakeenah_card.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sakeenah_card.png'; a.click(); toast('تم حفظ البطاقة');
}
function stylePicker(sel) { return `<div class="row" style="gap:8px;justify-content:center">${cardStyleNames.map((n, i) => pill(n, sel === i, `data-st="${i}"`)).join('')}</div>`; }

/* ---------- reader ---------- */
function reader(cat, slot) {
  const items = catItems(cat); const key = slot || 'cat' + cat;
  if (!items.length) return { html: topbar('الأذكار', true) + empty('لا توجد أذكار في هذا الباب') };
  const title = (slots.find(s => s.key === slot) || {}).title || items[0].catTitle;
  let counts = items.map(i => i.count), idx = 0; const s0 = S.sessions[key];
  if (s0 && s0.date === todayStr() && !s0.complete && s0.counts.length === items.length) { counts = s0.counts.slice(); idx = Math.min(s0.idx, items.length - 1); }
  let extra = 0, focus = false;
  const html = `<div id="rbody" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`;
  return { html, mount: r => {
    const persist = () => { const all = counts.every(c => c === 0); S.sessions[key] = { date: todayStr(), idx, counts: counts.slice(), complete: all ? 1 : 0 }; if (all && slot) markDay(slot); save(); };
    const draw = () => {
      const cur = items[idx], all = counts.every(c => c === 0);
      $('#rbody', r).innerHTML = `${focus ? `<div class="row" style="justify-content:flex-start;padding-top:env(safe-area-inset-top)"><button class="tbtn" id="ex" style="color:var(--sub)">إنهاء القراءة الهادئة</button></div>` : `${topbar(title, true, `<button class="ib" aria-label="${isFav(cur.itemId) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}" id="fv" style="color:${isFav(cur.itemId) ? 'var(--gold)' : 'inherit'}">${icon(isFav(cur.itemId) ? 'fav' : 'favo')}</button>${ibtn('info', 'وضع القراءة الهادئ', 'x', 'id="fc"')}`)}<div class="row" style="padding:0 16px"><div class="bar grow"><i style="width:${(idx + 1) / items.length * 100}%"></i></div><span class="sub" style="font-size:15px">${ar(idx + 1)} / ${ar(items.length)}</span></div>`}
<div class="pager" id="pg">${items.map((it, i) => { const rem = counts[i]; return `<section data-i="${i}"><div class="zikr" style="--ex:${extra}px">${esc(it.text)}</div><div style="height:14px"></div>${it.count > 1 ? `<div class="gold" style="font-size:17px">العدد المشروع في الكتاب: ${ar(it.count)}</div>` : ''}${focus ? '' : '<div class="sub" style="font-size:14px">المصدر: حصن المسلم للقحطاني</div>'}<div style="height:18px"></div><button class="counter ${rem === 0 ? 'done' : ''}" data-cnt="${i}" ${rem === 0 ? 'disabled' : ''} aria-label="${rem === 0 ? 'اكتمل هذا الذكر' : 'اضغط للعد، المتبقي ' + ar(rem)}">${rem === 0 ? icon('check').replace('<svg', '<svg width="56" height="56" fill="currentColor"') : ar(rem)}</button><div class="sub" style="font-size:14px;margin-top:6px">${it.count > 1 ? 'اضغط للعد (المتبقي)' : 'اضغط عند الانتهاء'}</div></section>`; }).join('')}</div>
${focus ? '' : `${all ? '<div class="gold" style="font-size:17px;text-align:center">أتممت هذا الباب، تقبّل الله منك.</div>' : ''}<div class="row" style="justify-content:space-around"><button class="tbtn" id="cp">نسخ</button><button class="tbtn" id="sh">مشاركة</button><button class="tbtn" id="cd">بطاقة</button><button class="tbtn" id="fm">أ-</button><button class="tbtn" id="fp">أ+</button></div><div class="row" style="padding:6px 16px calc(6px + env(safe-area-inset-bottom))"><button class="obtn grow" id="pv" ${idx === 0 ? 'disabled style="opacity:.4"' : ''}>السابق</button><button class="bigbtn grow" id="nx">التالي</button></div>`}`;
      const rb = $('#rbody', r), pg = $('#pg', rb); pg.style.scrollBehavior = 'auto'; pg.scrollLeft = -idx * pg.clientWidth;
      let t; pg.onscroll = () => { clearTimeout(t); t = setTimeout(() => { const n = Math.round(Math.abs(pg.scrollLeft) / pg.clientWidth); if (n !== idx && n >= 0 && n < items.length) { idx = n; persist(); addRecent(items[idx].itemId); draw(); } }, 120); };
      rb.querySelectorAll('[data-cnt]').forEach(b => b.onclick = () => { const i = +b.dataset.cnt; if (counts[i] > 0) { counts[i]--; vibrate(counts[i] === 0 ? 60 : 15); persist(); draw(); } });
      const on = (id, f) => { const e = $(id, rb); if (e) e.onclick = f; };
      const go2 = n => { idx = Math.max(0, Math.min(items.length - 1, n)); persist(); addRecent(items[idx].itemId); draw(); };
      on('#fv', () => { toggleFav(cur.itemId); draw(); }); on('#fc', () => { focus = true; draw(); }); on('#ex', () => { focus = false; draw(); });
      on('#cp', () => copyText(shareTextOf(cur))); on('#sh', () => shareText(shareTextOf(cur))); on('#fm', () => { if (extra > -8) extra -= 3; draw(); }); on('#fp', () => { if (extra < 24) extra += 3; draw(); });
      on('#pv', () => go2(idx - 1)); on('#nx', () => go2(idx + 1));
      on('#cd', () => { let st = 0; dialog(`<h3>بطاقة للمشاركة</h3><div id="sp">${stylePicker(0)}</div><div class="acts"><button class="tbtn" data-y>مشاركة</button><button class="tbtn" data-n>إلغاء</button></div>`, (bg, close) => { bg.addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { st = +b.dataset.st; $('#sp', bg).innerHTML = stylePicker(st); } }); $('[data-y]', bg).onclick = () => { close(); shareCard(cur.text, cur.catTitle, st, false); }; $('[data-n]', bg).onclick = close; }); });
      bindCommon(rb);
    };
    addRecent(items[idx].itemId); draw();
  } };
}

/* ---------- detail / themes ---------- */
function detail(id) {
  const it = BYID[id]; if (!it) return { html: topbar('', true) + empty('تعذّر العثور على هذا العنصر') };
  addRecent(id); const quran = it.kind === 'dua'; let st = 0;
  const html = `${topbar(it.title || it.catTitle, true, `<button class="ib" id="fv" aria-label="المفضلة">${icon(isFav(id) ? 'fav' : 'favo')}</button>`)}<div class="scroll pad" style="text-align:center"><div class="${quran ? 'q' : ''}" style="font-size:28px;line-height:1.85">${esc(it.text)}</div><div style="height:12px"></div>${it.ref ? `<div class="gold" style="font-size:18px;font-weight:700">${esc(it.ref)}</div>` : ''}${it.count > 1 ? `<div class="gold" style="font-size:17px">العدد المشروع في الكتاب: ${ar(it.count)}</div>` : ''}<div class="sub" style="font-size:14px;margin-top:10px">المصدر: ${esc(sourceOf(it))}</div>${it.tafsir ? `<div style="margin-top:16px;text-align:start">${card(`<div class="gold" style="font-size:17px;font-weight:700">التفسير الميسر</div><div style="font-size:19px;line-height:1.7;margin-top:6px">${esc(it.tafsir)}</div>`)}</div>` : ''}${it.kind === 'hisn' ? `<button class="tbtn" data-go="#/reader/${it.catId}">افتح الباب كاملاً: ${esc(it.catTitle)}</button>` : ''}<div style="height:14px"></div><div id="sp">${stylePicker(0)}</div></div><div class="row" style="justify-content:space-around;padding:8px 8px calc(8px + env(safe-area-inset-bottom))"><button class="tbtn" id="cp">نسخ</button><button class="tbtn" id="sh">مشاركة</button><button class="tbtn" id="cd">بطاقة</button><button class="tbtn" id="ac">إلى مجموعة</button></div>`;
  return { html, mount: r => {
    $('#fv', r).onclick = () => { toggleFav(id); $('#fv', r).innerHTML = icon(isFav(id) ? 'fav' : 'favo'); };
    $('#cp', r).onclick = () => copyText(shareTextOf(it)); $('#sh', r).onclick = () => shareText(shareTextOf(it)); $('#ac', r).onclick = () => addToCollection(id);
    $('#cd', r).onclick = () => shareCard(it.text, it.ref || it.catTitle, st, quran);
    $('#sp', r).onclick = e => { const b = e.target.closest('[data-st]'); if (b) { st = +b.dataset.st; $('#sp', r).innerHTML = stylePicker(st); } };
  } };
}
function themeScreen(id) {
  const all = DUAS(); let title = '', duas = [], cats = [];
  if (id === 'all') { title = 'أدعية من القرآن الكريم'; duas = all; } else if (id === 'prophets') { title = 'أدعية الأنبياء عليهم السلام'; duas = all.filter(d => d.title.includes('عليه السلام')); }
  else { const t = THEMES.find(x => x.id === id); title = t ? t.title : ''; duas = all.filter(d => t && t.duas.includes(d.itemId)); cats = CATS.filter(c => t && t.cats.includes(c.catId)); }
  const clamp2 = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';
  const html = `${topbar(title, true)}<div class="scroll pad col">${duas.length ? '<div class="gold" style="font-size:19px;font-weight:700">من القرآن الكريم</div>' : ''}${duas.map(d => card(`<div style="font-size:18px;font-weight:700">${esc(d.title)}</div><div class="q sub" style="font-size:18px;${clamp2}">${esc(d.text)}</div><div class="gold" style="font-size:14px">${esc(d.ref)}</div>`, `#/item/${d.itemId}`)).join('')}${cats.length ? '<div class="gold" style="font-size:19px;font-weight:700">من حصن المسلم</div>' : ''}${cats.map(c => card(`<span style="font-size:18px">${esc(c.catTitle)}</span>`, `#/reader/${c.catId}`)).join('')}${!duas.length && !cats.length ? empty('لا توجد عناصر') : ''}</div>`;
  return { html };
}

/* ---------- quran ---------- */
function quranList() {
  return { html: `${topbar('المصحف الشريف', true)}<div class="scroll pad col" style="gap:8px">${QURAN.map(s => `<button class="catrow" data-go="#/surah/${s.n}?ay=1"><span class="gold" style="width:48px;font-size:18px;font-weight:700">${ar(s.n)}</span><span class="grow" style="font-size:20px">سورة ${esc(s.name)}</span><span class="sub" style="font-size:14px">${ar(s.a.length)} آية</span></button>`).join('')}</div>` };
}
function surah(n, startAy) {
  const s = QURAN[n - 1]; if (!s) return { html: topbar('', true) + empty('السورة غير موجودة') };
  const bism = QURAN[0].a[0]; const showB = n !== 1 && n !== 9; let size = 28;
  const html = `${topbar('سورة ' + s.name, true, `<button class="tbtn" id="sm">أ-</button><button class="tbtn" id="sp">أ+</button>`)}<div class="scroll pad" id="sc" style="padding-top:8px"></div>`;
  return { html, mount: r => {
    const sc = $('#sc', r);
    const draw = () => { sc.style.setProperty('--qs', size + 'px'); sc.innerHTML = (showB ? `<div class="q gold" style="font-size:${size + 2}px;text-align:center;padding:8px 0">${esc(bism)}</div>` : '') + s.a.map((t, i) => `<div class="ayah q ${i + 1 === startAy && startAy > 1 ? 'hl' : ''}" data-a="${i + 1}">${esc(t)} \uFD3F${ar(i + 1)}\uFD3E</div>`).join(''); };
    draw();
    const target = sc.querySelector(`[data-a="${startAy}"]`); if (target && startAy > 1) target.scrollIntoView({ block: 'start' });
    let t; sc.onscroll = () => { clearTimeout(t); t = setTimeout(() => { const top = sc.getBoundingClientRect().top; for (const e of sc.querySelectorAll('.ayah')) { if (e.getBoundingClientRect().bottom > top + 4) { S.qLast = `${n}:${e.dataset.a}`; save(); break; } } }, 200); };
    $('#sm', r).onclick = () => { if (size > 20) { size -= 3; draw(); } }; $('#sp', r).onclick = () => { if (size < 46) { size += 3; draw(); } };
    sc.onclick = e => { const a = e.target.closest('.ayah'); if (!a) return; const an = +a.dataset.a, key = `q:${n}:${an}`, txt = `${s.a[an - 1]} \uFD3F${ar(an)}\uFD3E\n(سورة ${s.name})`;
      dialog(`<h3>سورة ${esc(s.name)}، الآية ${ar(an)}</h3><div class="col" style="gap:0"><button class="tbtn" style="font-size:18px" data-m="f">${isFav(key) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}</button><button class="tbtn" style="font-size:18px" data-m="c">نسخ</button><button class="tbtn" style="font-size:18px" data-m="s">مشاركة</button><button class="tbtn" style="font-size:18px" data-m="d">بطاقة</button><button class="tbtn" style="font-size:18px" data-m="g">إلى مجموعة</button></div><div class="acts"><button class="tbtn" data-n>إغلاق</button></div>`, (bg, close) => {
        bg.addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; const m = b.dataset.m; if (m === 'f') { toggleFav(key); close(); } else if (m === 'c') { copyText(txt); } else if (m === 's') { shareText(txt + '\nمن تطبيق سَكِينَة'); } else if (m === 'd') { close(); shareCard(s.a[an - 1], `سورة ${s.name}، الآية ${ar(an)}`, 0, true); } else if (m === 'g') { close(); addToCollection(key); } });
        $('[data-n]', bg).onclick = close; }); };
  } };
}

/* ---------- search ---------- */
function highlight(text, q) { const toks = tokens(q); if (!toks.length) return esc(text); return text.split(' ').map(w => { const nw = norm(w); return nw && toks.some(t => nw.includes(t)) ? `<mark>${esc(w)}</mark>` : esc(w); }).join(' '); }
let QN = null;
function search() {
  const html = `${topbar('بحث', true)}<div style="padding:16px"><input id="q" placeholder="ابحث في الأذكار والأدعية والقرآن"></div><div class="scroll" style="padding:0 16px" id="res"></div>`;
  return { html, mount: r => {
    const res = $('#res', r), inp = $('#q', r); let t;
    const showHist = () => { res.innerHTML = S.hist.length ? `<div class="gold" style="font-size:16px;font-weight:700">عمليات بحث سابقة</div>${S.hist.map(h => `<button class="tbtn" data-h="${esc(h)}" style="font-size:18px;width:100%;justify-content:flex-start">${esc(h)}</button>`).join('')}<button class="tbtn" id="ch" style="color:var(--sub)">مسح السجل</button>` : empty('يعمل البحث دون إنترنت ويتجاوز التشكيل والهمزات.'); res.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { inp.value = b.dataset.h; run(); }); const c = $('#ch', res); if (c) c.onclick = () => { S.hist = []; save(); showHist(); }; };
    const run = () => {
      const tk = tokens(inp.value); if (!tk.length) return showHist();
      if (!QN) QN = QURAN.map(s => s.a.map(a => norm(a)));
      const items = []; ITEMS.forEach(i => { if (items.length < 80 && tk.every(x => i.norm.includes(x))) items.push({ key: i.itemId, title: i.title || i.catTitle, preview: i.text }); });
      let ays = 0;
      for (let s = 0; s < QURAN.length && ays < 40; s++) for (let a = 0; a < QN[s].length && ays < 40; a++) if (tk.slice(0, 3).every(x => QN[s][a].includes(x))) { items.push({ key: `q:${s + 1}:${a + 1}`, title: `سورة ${QURAN[s].name}، الآية ${ar(a + 1)}`, preview: QURAN[s].a[a] }); ays++; }
      res.innerHTML = items.length ? `<div class="col" style="gap:8px;padding-bottom:24px">${items.map(d => `<button style="background:var(--surface);border-radius:16px;padding:14px;text-align:start;display:block;width:100%" data-open="${esc(d.key)}"><div class="gold" style="font-size:15px;font-weight:700">${esc(d.title)}</div><div style="font-size:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${highlight(d.preview, inp.value)}</div></button>`).join('')}</div>` : empty(`لا نتائج لـ "${inp.value}"`);
      bindCommon(res); clearTimeout(t); t = setTimeout(() => { const q = inp.value.trim(); if (q) { S.hist = [q, ...S.hist.filter(x => x !== q)].slice(0, 8); save(); } }, 1200);
    };
    let d; inp.oninput = () => { clearTimeout(d); d = setTimeout(run, 250); }; showHist(); inp.focus();
  } };
}

/* ---------- wird ---------- */
function wird() {
  const today = todayStr(), done = new Set(S.days.filter(d => d.date === today && d.done).map(d => d.slot));
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const html = `${topbar('وردي اليومي', true)}<div class="scroll pad col">${card(`<div class="gold" style="font-size:19px;font-weight:700">اليوم: ${ar(slots.filter(s => done.has(s.key)).length)} من ${ar(slots.length)}</div>${slots.map(sl => `<div class="row" style="min-height:48px"><span class="dot ${done.has(sl.key) ? 'on' : ''}" style="width:14px;height:14px"></span><span class="grow" style="font-size:18px">${sl.title}</span><button class="tbtn" data-go="#/reader/${sl.cat}?slot=${sl.key}">${done.has(sl.key) ? 'إعادة' : 'ابدأ'}</button></div>`).join('')}`)}${sec('آخر سبعة أيام', '12px 0 0')}${card(days.map(d => { const n = S.days.filter(x => x.date === ymd(d) && x.done).length; return `<div class="row" style="padding:4px 0"><span style="width:90px;font-size:16px">${weekDays[(d.getDay() + 6) % 7]}</span>${slots.map((_, k) => `<span class="dot ${k < n ? 'on' : ''}" style="width:12px;height:12px"></span>`).join('')}<span class="grow"></span><span class="sub" style="font-size:15px">${ar(n)}</span></div>`; }).join(''))}<div class="sub" style="font-size:14px">هذا سجلّ لتنظيمك الشخصي، وليس حكماً على عبادتك. تقبّل الله منك.</div></div>`;
  return { html };
}

/* ---------- settings ---------- */
function settings() {
  const s = S.settings; const sw = (k, t) => `<div class="row" style="min-height:52px"><span class="grow" style="font-size:18px">${t}</span><button class="sw ${s[k] ? 'on' : ''}" data-sw="${k}" aria-label="${t}"></button></div>`;
  const html = `${topbar('الإعدادات', true)}<div class="scroll pad col" style="gap:8px">${sec('المظهر', '0')}<div class="pills">${pill('حسب الجهاز', s.darkMode === 0, 'data-dm="0"')}${pill('فاتح', s.darkMode === 1, 'data-dm="1"')}${pill('داكن', s.darkMode === 2, 'data-dm="2"')}</div><div style="font-size:18px">حجم الخط</div><input type="range" id="ts" min="0.85" max="1.4" step="0.05" value="${s.textScale}" style="width:100%">${sw('contrast', 'تباين عالٍ')}${sw('reduceMotion', 'تقليل الحركة')}${sw('vibrate', 'اهتزاز عند العدّ')}${sw('silent', 'وضع الصمت (بلا اهتزاز)')}
${sec('التذكيرات', '12px 0 0')}<div class="sub" style="font-size:15px">التذكيرات اليومية متاحة في تطبيق الأندرويد فقط. المتصفحات لا تسمح بتذكير مجدول في الخلفية دون خادم، ولا يوجد خادم هنا.</div>
${sec('بياناتي', '12px 0 0')}<div class="sub" style="font-size:15px">المفضلة والمجموعات والسجلات تُحفظ في هذا المتصفح فقط. يمكنك حفظ نسخة في ملف.</div><div class="row"><button class="obtn grow" id="ex">نسخ احتياطي</button><button class="obtn grow" id="im">استعادة</button></div><input type="file" id="fi" accept="application/json,.json" hidden><button class="obtn" id="rs" style="color:#B3261E">مسح بياناتي</button><div class="gold" id="msg" style="font-size:16px"></div>
${sec('عن التطبيق', '12px 0 0')}<button class="tbtn" style="font-size:18px;justify-content:flex-start" data-go="#/about">عن سَكِينَة والمصادر</button><button class="tbtn" style="font-size:18px;justify-content:flex-start" data-go="#/privacy">سياسة الخصوصية</button></div>`;
  return { html, mount: r => {
    const msg = t => $('#msg', r).textContent = t;
    r.querySelectorAll('[data-dm]').forEach(b => b.onclick = () => { s.darkMode = +b.dataset.dm; save(); applyTheme(); render(); });
    r.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { s[b.dataset.sw] = !s[b.dataset.sw]; save(); applyTheme(); render(); });
    $('#ts', r).onchange = e => { s.textScale = +e.target.value; save(); applyTheme(); };
    $('#ex', r).onclick = () => { const o = { app: 'sakeenah', version: 1, favs: S.favs.map(f => ({ k: f.key, t: f.ts })), colls: S.colls.map(c => ({ id: c.id, n: c.name, o: c.ord })), collItems: S.collItems.map(c => ({ c: c.collId, k: c.key, o: c.ord })), days: S.days.map(d => ({ d: d.date, s: d.slot, x: d.done })), tasbeeh: Object.entries(S.tdays).map(([d, n]) => ({ d, n })) }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' })); a.download = 'sakeenah-backup.json'; a.click(); msg('تم حفظ النسخة الاحتياطية'); };
    $('#im', r).onclick = () => $('#fi', r).click();
    $('#fi', r).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await f.text()); if (o.app !== 'sakeenah') throw 0; const map = {}; S.favs = o.favs.map(x => ({ key: x.k, ts: x.t })); S.colls = o.colls.map(c => { const id = S.nextColl++; map[c.id] = id; return { id, name: c.n, ord: c.o }; }); S.collItems = o.collItems.filter(c => map[c.c]).map(c => ({ collId: map[c.c], key: c.k, ord: c.o })); S.days = o.days.map(d => ({ date: d.d, slot: d.s, done: d.x })); S.tdays = Object.fromEntries(o.tasbeeh.map(t => [t.d, t.n])); save(); msg('تمت الاستعادة'); } catch (_) { msg('الملف غير صالح، لم يتغير شيء'); } };
    $('#rs', r).onclick = () => confirmDlg('مسح بياناتي', 'سيُحذف كل ما حفظته: المفضلة والمجموعات والسجلات. لا يمكن التراجع إلا من نسخة احتياطية.', 'مسح', () => { Object.assign(S, { favs: [], colls: [], collItems: [], days: [], tdays: {}, recents: [], sessions: {}, hist: [], qLast: null, tas: { count: 0, preset: 'r0', target: 100 } }); save(); msg('تم المسح'); });
  } };
}
function textPage(title, parts) { return { html: `${topbar(title, true)}<div class="scroll pad col">${parts.map(([h, t]) => (h ? `<div class="gold" style="font-size:19px;font-weight:700">${h}</div>` : '') + `<div style="font-size:17px;line-height:1.75;white-space:pre-line">${esc(t)}</div>`).join('')}</div>` }; }
const about = () => textPage('عن سَكِينَة', [['سَكِينَة — رفيق قلبك في كل حين', 'الإصدار ١٫٠٫٠. تطبيق هادئ للأذكار والأدعية والمسبحة، يعمل بالكامل دون إنترنت.'], ['المصادر', 'الأذكار: نص حصن المسلم للشيخ سعيد بن علي بن وهف القحطاني، من مجموعة Adhkar-json المفتوحة (rn0x).\nنص القرآن الكريم: مشروع تنزيل (Tanzil) بالرسم العثماني، عبر alquran.cloud، دون أي تعديل.\nالتفسير الميسر: مجمع الملك فهد لطباعة المصحف الشريف، عبر alquran.cloud.\nالخط: Amiri و Amiri Quran بترخيص SIL OFL.'], ['ما لا يتضمنه هذا الإصدار', 'لا توجد تلاوات صوتية. لا درجات حديثية (تصحيح وتضعيف). لا أسماء الله الحسنى ولا مكتبة أحاديث، لأن النص الموثوق لم يُدمج بعد. لا نضيف أي نص دون مصدر موثق.'], ['تنبيه', 'التطبيق ليس بديلاً عن سؤال أهل العلم. أي ملاحظة أو خطأ تجده فاكتب لنا ليُصحَّح.']]);
const privacy = () => textPage('سياسة الخصوصية', [['', 'سَكِينَة لا تجمع أي بيانات عنك ولا ترسل أي شيء خارج جهازك.'], ['الإنترنت', 'بعد التحميل الأول تعمل النسخة على الويب دون اتصال. لا يوجد خادم لنا، ولا تُرسل بياناتك لأحد.'], ['ما يُحفظ في متصفحك', 'المفضلة، المجموعات، سجل الأذكار والمسبحة، آخر موضع قراءة، وإعدادات المظهر. تبقى كلها محلية في هذا المتصفح، وتُحذف بمسح بيانات الموقع أو من زر "مسح بياناتي".'], ['لا إعلانات ولا تحليلات', 'لا حسابات، لا تتبّع، لا إعلانات، ولا مكتبات تحليل.']]);

/* ---------- boot ---------- */
(async function () {
  applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  APP.innerHTML = `<div class="splash"><img src="logo.png" alt="شعار سَكِينَة"><h1>سَكِينَة</h1><p>رفيق قلبك في كل حين</p></div>`;
  const t0 = Date.now(); await loadData();
  const left = (S.settings.reduceMotion ? 300 : 1200) - (Date.now() - t0); if (left > 0) await new Promise(r => setTimeout(r, left));
  ready = true; if (!location.hash || location.hash === '#/splash') history.replaceState(null, '', S.settings.onboarded ? '#/main' : '#/onboarding'); render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

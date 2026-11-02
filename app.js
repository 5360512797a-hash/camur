/* Çamur Cebi — ekran katmanı */
'use strict';
const KEY = 'camur_cebi_v1';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (x, d = 1) => ok(x) ? Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fv = (x, d) => ok(x) ? Number(x).toLocaleString('tr-TR', { maximumFractionDigits: d }) : '—';
const toast = m => { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); };
const row = (k, v, u, big) => `<div class="row${big ? ' big' : ''}"><span class="k">${k}</span><span class="v">${v}${u ? `<em>${u}</em>` : ''}</span></div>`;
/* torba/varil tam sayıya, BB ondalıklı yukarı yuvarlanır */
const packQty = (it, u) => it.size > 100 ? Math.ceil(u * 10) / 10 : Math.ceil(u);
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fmtT = s => { if (!s) return ''; const [d, t] = s.split('T'); const [y, m, g] = d.split('-'); return `${g}.${m} ${t || ''}`; };

let DB, UI = { tab: 'test', mode: 'tam', open: null, edit: null, hes: 'sifir', mud: 'agir', q: '', onlyHave: true, heslab: {} };
const W = () => DB.wells[DB.active];
function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || !DB.wells) { const w = seedWell(); DB = { v: 1, active: w.id, wells: { [w.id]: w }, alarms: defAlarms() }; }
  if (!DB.wells[DB.active]) DB.active = Object.keys(DB.wells)[0];
  if (!DB.alarms) DB.alarms = defAlarms();
}
const defAlarms = () => [{ id: 'a', name: 'Test', min: 10, end: 0, left: 0, rep: false }, { id: 'b', name: 'Tam test', min: 30, end: 0, left: 0, rep: false }];
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 200); }
function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Kayıt yapılamadı: depolama dolu olabilir.'); } }
window.addEventListener('pagehide', saveNow);

/* ---------- ortak hacimler ---------- */
const wellNow = () => wellCalc(kuyuIn(W().kuyu));
const tanksNow = () => tankTotals(W());
const circVol = () => { const w = W(), man = num(w.vol); if (ok(man) && man > 0) return man; return tanksNow().aktif + wellNow().inHole; };
const sortedTests = () => [...W().tests].sort((a, b) => a.time.localeCompare(b.time));
function prevTest() {            // karşılaştırılacak önceki test
  const s = sortedTests();
  if (!UI.edit) return s[s.length - 1] || null;
  const i = s.findIndex(t => t.id === UI.edit); return i > 0 ? s[i - 1] : null;
}
function fillSpecFromReport(rs) { Object.entries(rs || {}).forEach(([k, r]) => { if (r) W().specs[k] = r; }); }

/* ---------- başlık ---------- */
function renderHeader() {
  const w = W(), last = sortedTests().slice(-1)[0], tt = tanksNow(), wc = wellNow();
  $('wName').textContent = w.name;
  $('wSub').textContent = `${(MUD_TYPES[w.mudType] || {}).name || ''}${last ? ' · son test ' + fmtT(last.time) : ''}`;
  $('hdrVol').innerHTML = `${f(tt.mud + wc.inHole, 0)} bbl<small>sistem</small>`;
}
const TABS = [
  ['test', 'Test', '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 14h9"/>'],
  ['tavsiye', 'Tavsiye', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>'],
  ['stok', 'Stok', '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'],
  ['hesap', 'Hesap', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h4M8 16h2M12 16h4"/>'],
  ['tank', 'Tank', '<rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 13c3-2 6 2 9 0s6-2 9 0M9 6v13M15 6v13"/>'],
  ['kuyu', 'Kuyu', '<path d="M8 3v18M16 3v18M11 3v14l1 3 1-3V3"/><path d="M4 3h16"/>']
];
function renderBar() { $('bar').innerHTML = TABS.map(([k, n, p]) => `<button data-tab="${k}" aria-selected="${UI.tab === k}"><svg viewBox="0 0 24 24">${p}</svg>${n}</button>`).join(''); }
const VIEWS = {};
function go(t) { UI.tab = t; UI.open = null; renderBar(); render(); window.scrollTo(0, 0); }
function render() { renderHeader(); VIEWS[UI.tab](); }
$('bar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

/* ---------- sheet ---------- */
function sheet(html) { $('sheetBox').innerHTML = html; $('sheet').hidden = false; }
const closeSheet = () => { $('sheet').hidden = true; };
$('sheet').addEventListener('click', e => { if (e.target.id === 'sheet' || e.target.dataset.close != null) closeSheet(); });

/* =========================================================
   ALARMLAR
   iOS arka plandayken sayfayı durdurur. Bu yüzden bitiş zamanı saklanır, ekran açık tutulur
   (Wake Lock) ve uygulamaya dönüldüğünde süre dolmuşsa alarm çalar.
   ========================================================= */
let audio, ringing = null, beepT, wake;
function audioUnlock() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';   // sessiz düğmesinde de çalsın
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), g = audio.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.02);
  } catch (e) {}
}
function beep() {
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  [0, 0.28, 0.56].forEach(t => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'square'; o.frequency.value = 1760; g.gain.value = 0.35; o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2); });
}
async function wakeSync() {
  const need = DB.alarms.some(a => a.end > 0);
  try {
    if (need && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => wake = null); }
    if (!need && wake) { await wake.release(); wake = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { wakeSync(); tick(); } });
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function renderAlarms() {
  $('alarms').innerHTML = DB.alarms.map(a => {
    const run = a.end > 0, pause = !run && a.left > 0, left = run ? (a.end - Date.now()) / 1000 : pause ? a.left : a.min * 60;
    return `<div class="al ${ringing === a.id ? 'ring' : run ? 'run' : pause ? 'pause' : ''}" id="al-${a.id}"><button class="go" data-al="${a.id}" aria-label="${esc(a.name)} alarmı başlat veya duraklat"><i>${run ? esc(a.name) : pause ? 'Duraklatıldı' : '▶ ' + a.min + ' dk'}</i><b>${mmss(left)}</b></button><button class="set" data-alset="${a.id}" aria-label="${esc(a.name)} alarm ayarı">⚙</button></div>`;
  }).join('');
}
function tick() {
  DB.alarms.forEach(a => {
    if (a.end > 0) {
      const left = (a.end - Date.now()) / 1000;
      if (left <= 0) { a.end = 0; a.left = 0; ring(a); save(); wakeSync(); renderAlarms(); return; }
      const b = document.querySelector(`#al-${a.id} b`); if (b) b.textContent = mmss(left);
    }
  });
}
setInterval(tick, 500);
function ring(a) {
  ringing = a.id;
  $('ringBox').hidden = false;
  $('ringBox').innerHTML = `<h2>${esc(a.name)}</h2><p style="margin:0;font-size:1.1rem">${a.min} dakika doldu. Test zamanı.</p><button class="btn" data-ring="again">Durdur ve yeniden başlat</button><button class="btn ghost" data-ring="stop">Sadece durdur</button>`;
  if (a.rep) startAl(a);
  beep(); clearInterval(beepT); beepT = setInterval(beep, 1500);
}
function startAl(a) { a.end = Date.now() + (a.left > 0 ? a.left : a.min * 60) * 1000; a.left = 0; }
$('ringBox').addEventListener('click', e => {
  const m = e.target.dataset.ring; if (!m) return;
  clearInterval(beepT); const a = DB.alarms.find(x => x.id === ringing); ringing = null; $('ringBox').hidden = true;
  if (m === 'again' && a && !a.end) startAl(a);
  save(); renderAlarms(); wakeSync();
});
$('alarms').addEventListener('click', e => {
  const g = e.target.closest('[data-al]'), s = e.target.closest('[data-alset]');
  if (g) {
    audioUnlock(); const a = DB.alarms.find(x => x.id === g.dataset.al);
    if (a.end > 0) { a.left = (a.end - Date.now()) / 1000; a.end = 0; } else startAl(a);
    save(); renderAlarms(); wakeSync();
  }
  if (s) {
    const a = DB.alarms.find(x => x.id === s.dataset.alset);
    sheet(`<h2>Alarm ayarı</h2><div class="grid" style="margin-top:10px"><label>Ad<input type="text" id="alN" value="${esc(a.name)}"></label><label>Süre (dakika)<input id="alM" inputmode="decimal" value="${a.min}"></label></div>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="alR" ${a.rep ? 'checked' : ''}> Bitince otomatik yeniden başlasın</label>
      <p class="note">Alarm ancak uygulama açık ve ekran önündeyken çalar. Süre çalışırken ekran kapanmaz. iPhone’u kilitlersen veya başka uygulamaya geçersen ses çıkmaz; geri döndüğünde alarm çalar.</p>
      <div class="btns"><button class="btn" id="alOk">Kaydet</button><button class="btn sec" id="alRe">Sıfırla</button><button class="btn sec" data-close>Kapat</button></div>`);
    $('alOk').onclick = () => { const m = num($('alM').value); if (!(m > 0)) return toast('Süreyi dakika olarak gir.'); a.min = m; a.name = $('alN').value.trim() || a.name; a.rep = $('alR').checked; a.left = 0; a.end = 0; save(); renderAlarms(); wakeSync(); closeSheet(); };
    $('alRe').onclick = () => { a.left = 0; a.end = 0; save(); renderAlarms(); wakeSync(); closeSheet(); };
  }
});

/* =========================================================
   1. TEST
   ========================================================= */
const spec = k => W().specs[k] || {};
const rangeTxt = k => { const s = spec(k); return ok(s.lo) && ok(s.hi) ? `${fv(s.lo, 2)}–${fv(s.hi, 2)}` : ok(s.hi) ? `≤ ${fv(s.hi, 2)}` : ok(s.lo) ? `≥ ${fv(s.lo, 2)}` : ''; };
const draftV = () => derive(W().draft.v || {});
function spark(vals, s, cur) {
  const pts = vals.filter(ok); if (cur != null && ok(cur)) pts.push(cur);
  if (pts.length < 2 && !(s && (ok(s.lo) || ok(s.hi)))) return '';
  const all = [...pts, ...(s ? [s.lo, s.hi].filter(ok) : [])], mn = Math.min(...all), mx = Math.max(...all), r = (mx - mn) || 1, W_ = 64, H = 20;
  const y = v => H - 2 - (v - mn) / r * (H - 4), x = i => pts.length > 1 ? 2 + i * (W_ - 6) / (pts.length - 1) : W_ / 2;
  const band = s && ok(s.lo) && ok(s.hi) ? `<rect x="0" y="${y(s.hi)}" width="${W_}" height="${Math.max(1, y(s.lo) - y(s.hi))}" fill="currentColor" opacity=".14"/>` : '';
  return `<svg class="spk" viewBox="0 0 ${W_} ${H}" aria-hidden="true">${band}<polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${pts.map((p, i) => `${x(i)},${y(p)}`).join(' ')}"/><circle cx="${x(pts.length - 1)}" cy="${y(pts[pts.length - 1])}" r="2.2" fill="currentColor"/></svg>`;
}
function bigChart(k) {
  const ts = sortedTests().map(t => ({ t: t.time, y: num(derive(t.v)[k]) })).filter(p => ok(p.y)), s = spec(k);
  if (ts.length < 2) return '<div class="note">Grafik için en az iki kayıtlı test gerekir.</div>';
  const W_ = 340, H = 140, L = 34, R = 8, T = 8, B = 20, all = [...ts.map(p => p.y), ...[s.lo, s.hi].filter(ok)], mn = Math.min(...all), mx = Math.max(...all), r = (mx - mn) || 1;
  const x = i => L + i * (W_ - L - R) / (ts.length - 1), y = v => T + (1 - (v - mn) / r) * (H - T - B);
  const band = ok(s.lo) || ok(s.hi) ? `<rect x="${L}" y="${y(ok(s.hi) ? s.hi : mx)}" width="${W_ - L - R}" height="${Math.max(1, y(ok(s.lo) ? s.lo : mn) - y(ok(s.hi) ? s.hi : mx))}" fill="#2E7D4F" opacity=".16"/>` : '';
  return `<svg class="big" viewBox="0 0 ${W_} ${H}" role="img" aria-label="${esc(PROP[k].n)} geçmişi">${band}
    <text x="${L - 4}" y="${y(mx) + 4}" text-anchor="end" font-size="10" fill="currentColor">${fv(mx, 2)}</text><text x="${L - 4}" y="${y(mn)}" text-anchor="end" font-size="10" fill="currentColor">${fv(mn, 2)}</text>
    <polyline fill="none" stroke="#C9561A" stroke-width="2" points="${ts.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')}"/>
    ${ts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="3" fill="#C9561A"/>`).join('')}
    <text x="${L}" y="${H - 5}" font-size="10" fill="currentColor">${fmtT(ts[0].t)}</text><text x="${W_ - R}" y="${H - 5}" text-anchor="end" font-size="10" fill="currentColor">${fmtT(ts[ts.length - 1].t)}</text></svg>`;
}
function propRow(p, v) {
  const val = W().draft.v ? W().draft.v[p.k] : '';
  const input = p.auto ? `<div class="out" id="out-${p.k}">${fv(v[p.k], p.d)}</div>`
    : `<input id="in-${p.k}" data-pk="${p.k}" inputmode="${p.k === 'cake' ? 'text' : 'decimal'}" autocomplete="off" aria-label="${esc(p.n)}" value="${esc(val ?? '')}">`;
  return `<div class="pr" id="pr-${p.k}"><button class="nm" data-popen="${p.k}"><b>${esc(p.n)}</b><small>${p.u || '&nbsp;'}</small></button>${input}<div class="sub" id="sub-${p.k}"></div>${UI.open === p.k ? expandHtml(p) : ''}</div>`;
}
function expandHtml(p) {
  const ts = sortedTests().slice(-8).reverse().map(t => ({ t: t.time, y: num(derive(t.v)[p.k]) })).filter(x => ok(x.y));
  return `<div class="x" id="x-${p.k}">${p.help ? `<div>${esc(p.help)}</div>` : ''}${bigChart(p.k)}
    <div class="lastv">${ts.map(x => `<span>${fv(x.y, p.d)}<small>${fmtT(x.t)}</small></span>`).join('') || '<small>Kayıt yok</small>'}</div></div>`;
}
function updRow(p, v) {
  const r = $('pr-' + p.k); if (!r) return;
  const x = num(v[p.k]), pt = prevTest(), pv = pt ? num(derive(pt.v)[p.k]) : NaN, d = devOf(x, pv), st = specState(x, spec(p.k));
  r.className = 'pr' + (d && d.lvl ? ' d' + d.lvl : '') + (st ? ' oos-' + st : '');
  if (p.auto && $('out-' + p.k)) $('out-' + p.k).textContent = fv(x, p.d);
  const hist = sortedTests().filter(t => t.id !== UI.edit).slice(-6).map(t => num(derive(t.v)[p.k]));
  const lab = st === 'lo' ? '<span class="chip lo">düşük</span>' : st === 'hi' ? '<span class="chip hi">yüksek</span>' : st === 'ok' ? '<span class="chip ok">aralıkta</span>' : '';
  const dc = d && d.lvl ? `<span class="chip ${d.lvl}">${d.pct > 0 ? '+' : ''}${f(d.pct, 0)}%</span>` : d ? `<span>${d.pct > 0 ? '+' : ''}${f(d.pct, 0)}%</span>` : '';
  $('sub-' + p.k).innerHTML = `${rangeTxt(p.k) ? `<span>Aralık ${rangeTxt(p.k)}</span>` : ''}${ok(pv) ? `<span>· Önceki ${fv(pv, p.d)}</span>` : ''}${dc}${ok(x) ? lab : ''}<span class="sp">${spark(hist, spec(p.k), x)}</span>`;
}
function updSum() {
  const v = draftV(), pt = prevTest(), c = { y: 0, o: 0, r: 0 }; let oos = 0;
  if (pt) { const pv = derive(pt.v); PROPS.forEach(p => { const d = devOf(num(v[p.k]), num(pv[p.k])); if (d && c[d.lvl] != null) c[d.lvl]++; }); }
  PROPS.forEach(p => { const st = specState(num(v[p.k]), spec(p.k)); if (st === 'lo' || st === 'hi') oos++; });
  const any = Object.keys(W().draft.v || {}).some(k => W().draft.v[k] !== '');
  $('devSum').hidden = !any;
  $('devSum').innerHTML = `<div class="sumbar"><b>Önceki teste göre:</b>${c.y + c.o + c.r === 0 ? '<span class="chip ok">%10’dan az</span>' : ''}${c.y ? `<span class="chip y">${c.y} sarı</span>` : ''}${c.o ? `<span class="chip o">${c.o} turuncu</span>` : ''}${c.r ? `<span class="chip r">${c.r} kırmızı</span>` : ''}${oos ? `<span class="chip hi">${oos} aralık dışı</span>` : ''}</div>`;
}
function updAll() { const v = draftV(); PROPS.forEach(p => updRow(p, v)); updSum(); }
const HIST_COLS = ['mw', 'fv', 'pv', 'yp', 'g10s', 'g10m', 'ph', 'fl', 'sol', 'sand', 'mbt', 'cl', 'ca', 'kcl'];
const HIST_LBL = { mw: 'MW', fv: 'FV', pv: 'PV', yp: 'YP', g10s: 'Jel10s', g10m: 'Jel10d', ph: 'pH', fl: 'FL', sol: 'Katı', sand: 'Kum', mbt: 'MBT', cl: 'Cl', ca: 'Ca', kcl: 'KCl%' };
VIEWS.test = function () {
  const w = W(), v = draftV(), d = w.draft, list = UI.mode === 'hizli' ? PROPS.filter(p => p.quick) : PROPS;
  const pt = prevTest();
  $('view').innerHTML = `<div class="card">
      <h2>${UI.edit ? 'Testi düzenle' : 'Yeni çamur testi'}</h2>
      <p class="hint">${pt ? `Karşılaştırma: ${fmtT(pt.time)} testi.` : 'İlk test: karşılaştırma yok.'} Yazarken renk değişir.</p>
      <div class="legend"><span class="chip y">%10–20 sapma</span><span class="chip o">%20–30</span><span class="chip r">%30 üstü</span></div>
      <div class="grid" style="margin-top:10px">
        <label>Tarih ve saat<input type="datetime-local" id="t-time" value="${esc(d.time || nowLocal())}"></label>
        <label>Derinlik (m)<input id="t-depth" inputmode="decimal" value="${esc(d.depth ?? '')}"></label>
        <label>Alındığı yer<select id="t-place">${['FlowLine', 'Emiş', 'Aktif tank', 'Hopper', 'Rezerv'].map(x => `<option ${d.place === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>
      <div class="seg" style="margin-top:10px"><button data-mode="hizli" aria-pressed="${UI.mode === 'hizli'}">Hızlı (yoğunluk, huni)</button><button data-mode="tam" aria-pressed="${UI.mode === 'tam'}">Tam test</button></div>
    </div>
    <div id="devSum" hidden></div>
    ${GROUPS.map(([g, n]) => { const ps = list.filter(p => p.g === g); return ps.length ? `<div class="gh">${n}</div>` + ps.map(p => propRow(p, v)).join('') : ''; }).join('')}
    <div class="btns"><button class="btn" id="tSave" style="flex:1">${UI.edit ? 'Değişikliği kaydet' : 'Testi kaydet'}</button><button class="btn sec" id="tClear">${UI.edit ? 'Vazgeç' : 'Temizle'}</button>${UI.edit ? '<button class="btn danger" id="tDel">Sil</button>' : ''}</div>
    <div class="card"><h2>Test geçmişi</h2><p class="hint">Satıra dokununca test düzenlenir. Aralık dışı değerler renkli.</p>
      <div class="tw"><table class="t"><tr><th>Zaman</th><th>Der.</th>${HIST_COLS.map(k => `<th>${HIST_LBL[k]}</th>`).join('')}</tr>
      ${sortedTests().reverse().map(t => { const x = derive(t.v); return `<tr data-tedit="${t.id}"><td>${fmtT(t.time)}</td><td>${fv(t.depth, 0)}</td>${HIST_COLS.map(k => { const y = num(x[k]), st = specState(y, spec(k)); return `<td class="${st ? 'c-' + st : ''}">${fv(y, PROP[k].d > 1 ? 1 : PROP[k].d)}</td>`; }).join('')}</tr>`; }).join('') || `<tr><td colspan="${HIST_COLS.length + 2}">Henüz test yok.</td></tr>`}</table></div>
      <div class="btns"><label class="btn sec" style="flex-direction:row">Günlük raporu yükle (.xls)<input type="file" id="repFile" accept=".xls,.xlsx,application/vnd.ms-excel"></label><button class="btn sec" id="xlsOut">Excel’e aktar</button></div>
      <p class="note" id="repStatus">Rapor dosyandaki testler, plan aralıkları ve stok otomatik okunur.</p></div>`;
  updAll();
  $('t-time').onchange = e => { W().draft.time = e.target.value; save(); };
  $('t-depth').oninput = e => { W().draft.depth = e.target.value; save(); };
  $('t-place').onchange = e => { W().draft.place = e.target.value; save(); };
  $('tSave').onclick = saveTest;
  $('tClear').onclick = () => { UI.edit = null; W().draft = {}; save(); render(); };
  if ($('tDel')) $('tDel').onclick = () => { if (!confirm('Bu test silinsin mi?')) return; W().tests = W().tests.filter(t => t.id !== UI.edit); UI.edit = null; W().draft = {}; save(); render(); };
  $('repFile').onchange = readReport; $('xlsOut').onclick = exportXls;
};
function saveTest() {
  const w = W(), d = w.draft, v = {};
  Object.entries(d.v || {}).forEach(([k, x]) => { const n = num(x); if (ok(n)) v[k] = n; });
  if (!Object.keys(v).length) return toast('Önce en az bir değer gir.');
  const rec = { id: UI.edit || uid(), time: $('t-time').value || nowLocal(), depth: num($('t-depth').value), place: $('t-place').value, v };
  if (!ok(rec.depth)) rec.depth = '';
  if (UI.edit) w.tests = w.tests.map(t => t.id === UI.edit ? rec : t); else w.tests.push(rec);
  UI.edit = null; const keepDepth = rec.depth; w.draft = { depth: keepDepth }; save(); render(); window.scrollTo(0, 0); toast('Test kaydedildi.');
}
$('view').addEventListener('input', e => {
  const k = e.target.dataset.pk; if (!k) return;
  const d = W().draft; d.v = d.v || {}; d.v[k] = e.target.value; save(); updAll();
});
$('view').addEventListener('click', e => {
  const m = e.target.closest('[data-mode]'); if (m) { UI.mode = m.dataset.mode; render(); return; }
  const o = e.target.closest('[data-popen]');
  if (o) { const k = o.dataset.popen, old = $('x-' + UI.open); if (old) old.remove(); if (UI.open === k) UI.open = null; else { UI.open = k; $('pr-' + k).insertAdjacentHTML('beforeend', expandHtml(PROP[k])); } return; }
  const t = e.target.closest('[data-tedit]');
  if (t) { const r = W().tests.find(x => x.id === t.dataset.tedit); if (!r) return; UI.edit = r.id; UI.mode = 'tam'; W().draft = { time: r.time, depth: r.depth, place: r.place, v: Object.fromEntries(Object.entries(r.v).map(([a, b]) => [a, String(b)])) }; render(); window.scrollTo(0, 0); }
});
const LIBS = { xlsx: 'xlsx.full.min.js', pdf: 'pdf.min.js' }, libP = {};
function loadLib(k) {
  if (libP[k]) return libP[k];
  return libP[k] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIBS[k]; s.onload = () => { if (k === 'pdf' && window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; res(); }; s.onerror = () => { delete libP[k]; rej(new Error('lib')); }; document.head.appendChild(s); });
}
setTimeout(() => loadLib('xlsx').catch(() => {}), 1500);
async function readReport(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const st = $('repStatus'); st.textContent = 'Okunuyor…';
  try {
    await loadLib('xlsx');
    const r = parseReport(XLSX, XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }));
    if (!r) { st.textContent = 'Bu dosyada rapor sayfası (PROPERTY) bulunamadı.'; return; }
    const w = W(); let added = 0;
    r.tests.forEach(t => { if (!w.tests.some(x => x.time === t.time && +x.v.mw === +t.v.mw)) { w.tests.push(t); added++; } });
    fillSpecFromReport(r.spec);
    if (/kcl.*gl[iı]k/i.test(r.well.mudText)) w.mudType = 'kclg'; else if (/kcl/i.test(r.well.mudText)) w.mudType = 'kcl';
    let upd = 0;
    r.stock.forEach(s => { const it = w.stock.find(x => x.name.toLocaleUpperCase('tr') === s.name.toLocaleUpperCase('tr')); if (it) { it.qty = s.qty; it.used = s.used; if (s.price) it.price = s.price; upd++; } else { w.stock.push(mkItem(s.name, s.desc, s.unit, s.qty, s.used, s.price)); upd++; } });
    if (ok(num(r.well.depth))) w.kuyu.depth = num(r.well.depth);
    save(); render(); $('repStatus').textContent = `${added} yeni test, ${upd} stok kalemi güncellendi (${file.name}).`;
  } catch (x) { st.textContent = x.message === 'lib' ? 'Okuyucu yüklenemedi. Uygulamayı bir kez internetliyken aç.' : 'Dosya okunamadı: ' + x.message; }
}
async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function exportXls() {
  try { await loadLib('xlsx'); } catch (e) { return toast('Excel modülü yüklenemedi. Bir kez internetliyken aç.'); }
  const w = W(), wb = XLSX.utils.book_new();
  const T = [['Zaman', 'Derinlik m', 'Yer', ...PROPS.map(p => `${p.n}${p.u ? ' (' + p.u + ')' : ''}`)], ...sortedTests().map(t => { const x = derive(t.v); return [t.time.replace('T', ' '), t.depth, t.place, ...PROPS.map(p => ok(num(x[p.k])) ? +num(x[p.k]).toFixed(3) : '')]; })];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(T), 'Testler');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ürün', 'Tanım', 'Birim', 'Kalan', 'Toplam sarf', 'Birim fiyat'], ...w.stock.map(s => [s.name, s.desc, s.unit, s.qty, s.used, s.price])]), 'Stok');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Zaman', 'Ürün', 'İşlem', 'Miktar', 'Not'], ...w.stockLog.map(l => [l.time.replace('T', ' '), l.name, l.kind, l.qty, l.note || ''])]), 'Stok hareketi');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Zaman', 'Aktif bbl', 'Yedek bbl', 'Su bbl', 'Kuyu içi bbl', 'Toplam bbl'], ...w.tanks.log.map(l => [l.time.replace('T', ' '), l.aktif, l.yedek, l.su, l.hole, l.total])]), 'Tank okumaları');
  saveFile(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${w.name.replace(/\W+/g, '_') || 'kuyu'}_camur.xlsx`);
}

/* =========================================================
   2. TAVSİYE
   ========================================================= */
function doseHtml(d, V, label) {
  const w = W(), it = w.stock.find(s => s.key === d.key), ppb = d.ppb;
  const kg = ppb * V / LB_KG;
  if (!it) return `<div class="dose"><b>${esc(d.key)}</b><div class="q">${f(ppb, 2)} ppb</div></div>`;
  const u = kg / it.size, short = packQty(it, u) > it.qty;
  return `<div class="dose"><b>${esc(it.name)}</b><div class="q">${fv(packQty(it, u), 1)} ${esc(it.pack)}</div>
    <small>${f(ppb, 2)} ppb · ${f(kg, 0)} kg · ${f(V, 0)} bbl için ${short ? `<span class="warnx">stok yetmez (${fv(it.qty, 1)} ${esc(it.pack)})</span>` : `stok ${fv(it.qty, 1)} ${esc(it.pack)}`}</small>
    <button class="btn sm" data-take="${it.id}" data-units="${packQty(it, u)}" data-note="${esc(label)}">Stoktan düş</button></div>`;
}
function calcHtml(c, V) {
  if (c.type === 'dil') {
    const a = dilute(FLUID.su, V, c.p1, c.p2), b = W().stock.find(s => s.key === 'barit');
    return `<div class="dose"><b>Su ile ${f(c.p2, 1)} lb/ft³’e</b><div class="q">${f(a.add, 0)} bbl</div><small>Çamur atmadan üstüne ekle. ${f(a.replace, 0)} bbl çamur atarsan ${f(a.replace, 0)} bbl su yeter.</small></div>`;
  }
  if (c.type === 'wu') {
    const r1 = weightUp(WM.barit, V, c.p1, c.p2), r2 = weightUp(WM.caco3, V, c.p1, c.p2);
    return `<div class="dose"><b>Barit, ${f(c.p2, 1)} lb/ft³ için</b><div class="q">${f(r1.units, 1)} BB</div><small>${f(r1.kg, 0)} kg · hacim +${f(r1.dV, 0)} bbl</small></div>
      <div class="dose"><b>veya CaCO₃</b><div class="q">${f(r2.units, 1)} BB</div><small>${f(r2.kg, 0)} kg · hacim +${f(r2.dV, 0)} bbl</small></div>`;
  }
  if (c.type === 'sol') {
    const r = solidsDil(V, c.c, c.t);
    return `<div class="dose"><b>Katıyı %${f(c.t, 0)}’a indirmek için</b><div class="q">${f(r.add, 0)} bbl</div><small>Atmadan seyreltme. Attıktan sonra tamamlarsan ${f(r.replace, 0)} bbl.</small></div>`;
  }
  return '';
}
VIEWS.tavsiye = function () {
  const w = W(), s = sortedTests(), t = s[s.length - 1], V = circVol(), auto = !ok(num(w.vol)), prev = s[s.length - 2];
  const list = t ? advise(t, w.specs, w.mudType, prev).sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]) : [];
  $('view').innerHTML = `<div class="card"><h2>Ne yapmalıyım?</h2><p class="hint">${t ? `Son teste göre: ${fmtT(t.time)}${ok(t.depth) ? ', ' + fv(t.depth, 0) + ' m' : ''}.` : 'Önce bir test kaydet.'}</p>
      <div class="grid"><label>Çamur tipi<select id="mt">${Object.entries(MUD_TYPES).map(([k, x]) => `<option value="${k}" ${w.mudType === k ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label>
      <label>Hesap hacmi (bbl)<input id="vol" inputmode="decimal" placeholder="${f(V, 0)}" value="${esc(w.vol)}"></label></div>
      <p class="note">${auto ? `Boş bırakınca aktif tanklar + kuyu içi kullanılır: ${f(V, 0)} bbl.${tanksNow().aktif === 0 ? ' Tank seviyelerini henüz girmedin, sadece kuyu hacmi sayılıyor.' : ''}` : 'Elle girilen hacim kullanılıyor.'}</p></div>
    ${!t ? '' : list.length ? list.map(a => `<div class="adv ${a.sev}"><b class="t">${a.sev === 'alarm' ? '⚠ ' : ''}${esc(a.title)}</b><p>${esc(a.why)}</p><ol>${a.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${a.doses.map(d => doseHtml(d, V, a.title)).join('')}${a.calc ? calcHtml(a.calc, V) : ''}</div>`).join('')
      : '<div class="adv"><b class="t" style="color:var(--ok)">Bütün değerler aralıkta.</b><p>İşlem gerekmiyor. Testlere devam et.</p></div>'}
    <div class="note">Dozlar başlangıç değeridir. Önce numunede dene: 350 ml çamura 1 gram eklemek 1 ppb demektir. Sonra sisteme ver, bir sirkülasyon sonra tekrar ölç. Kuyu programı ve şefin talimatı önceliklidir.</div>
    <div class="card"><h2>Hedef aralıklar</h2><p class="hint">Rapordaki plan: yoğunluk, huni, pH, sıvı kaybı. Diğerleri genel başlangıç değeridir, programına göre değiştir.</p>
      <div class="tw"><table class="t"><tr><th>Özellik</th><th>En az</th><th>En çok</th></tr>${PROPS.filter(p => !['tout', 'ttest', 'hphtT', 'r600', 'r300', 'r200', 'r100', 'r6', 'r3'].includes(p.k)).map(p => { const x = spec(p.k); return `<tr><td>${esc(p.n)}</td><td><input data-sp="${p.k}" data-b="lo" inputmode="decimal" value="${esc(x.lo ?? '')}"></td><td><input data-sp="${p.k}" data-b="hi" inputmode="decimal" value="${esc(x.hi ?? '')}"></td></tr>`; }).join('')}</table></div>
      <div class="btns"><button class="btn sec" id="spReset">Bu çamur tipinin varsayılanına dön</button></div></div>`;
  $('mt').onchange = e => { w.mudType = e.target.value; if (confirm('Hedef aralıklar bu çamur tipine göre değişsin mi?')) w.specs = JSON.parse(JSON.stringify(MUD_TYPES[w.mudType].spec)); save(); render(); };
  $('vol').onchange = e => { w.vol = e.target.value; save(); render(); };
  $('spReset').onclick = () => { w.specs = JSON.parse(JSON.stringify(MUD_TYPES[w.mudType].spec)); save(); render(); };
  document.querySelectorAll('[data-sp]').forEach(i => i.onchange = () => { const k = i.dataset.sp, s_ = w.specs[k] = w.specs[k] || {}; const x = num(i.value); s_[i.dataset.b] = ok(x) ? x : null; save(); });
};

/* =========================================================
   3. STOK
   ========================================================= */
function stockMove(it, kind, qty, note) {
  const q = +qty; if (!(q > 0)) return false;
  const sign = kind === 'gelen' ? 1 : -1;
  it.qty = +(it.qty + sign * q).toFixed(3);
  if (kind === 'sarf') it.used = +(it.used + q).toFixed(3);
  W().stockLog.unshift({ id: uid(), time: nowLocal(), itemId: it.id, name: it.name, kind, qty: q, note: note || '' });
  save(); return true;
}
function moveSheet(it, kind, qty, note) {
  sheet(`<h2>${esc(it.name)}</h2><p class="hint">Kalan ${fv(it.qty, 2)} ${esc(it.pack)} · ${esc(it.unit)}</p>
    <div class="seg" id="mvKind">${[['sarf', 'Sarf'], ['gelen', 'Gelen'], ['giden', 'Giden']].map(([k, n]) => `<button data-k="${k}" aria-pressed="${kind === k}">${n}</button>`).join('')}</div>
    <div class="grid" style="margin-top:10px"><label>Miktar (${esc(it.pack)})<input id="mvQ" inputmode="decimal" value="${esc(qty ?? '')}"></label><label>Not<input type="text" id="mvN" value="${esc(note || '')}"></label></div>
    <div class="btns"><button class="btn" id="mvOk">Kaydet</button><button class="btn sec" data-close>Vazgeç</button></div>`);
  $('mvKind').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $('mvKind').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  $('mvOk').onclick = () => { if (!stockMove(it, kind, num($('mvQ').value), $('mvN').value)) return toast('Miktar gir.'); closeSheet(); render(); toast('Stok güncellendi.'); };
}
function itemSheet(it) {
  const isNew = !it; it = it || { name: '', desc: '', unit: '25 kg/torba', min: '', price: '', sg: '' };
  sheet(`<h2>${isNew ? 'Yeni ürün' : 'Ürün ayarı'}</h2><div class="grid" style="margin-top:10px"><label>Ad<input type="text" id="iN" value="${esc(it.name)}"></label><label>Görevi<input type="text" id="iD" value="${esc(it.desc)}"></label>
    <label>Birim<input type="text" id="iU" value="${esc(it.unit)}" placeholder="25 kg/torba, 1.5 MT/BB, 55 gal/varil"></label>${isNew ? '<label>Mevcut miktar<input id="iQ" inputmode="decimal"></label>' : ''}
    <label>Asgari stok<input id="iM" inputmode="decimal" value="${esc(it.min)}"></label><label>Birim fiyat<input id="iP" inputmode="decimal" value="${esc(it.price)}"></label></div>
    <div class="btns"><button class="btn" id="iOk">Kaydet</button>${isNew ? '' : '<button class="btn danger" id="iDel">Sil</button>'}<button class="btn sec" data-close>Vazgeç</button></div>`);
  $('iOk').onclick = () => {
    const n = $('iN').value.trim(); if (!n) return toast('Ad gir.');
    if (isNew) W().stock.push(Object.assign(mkItem(n, $('iD').value, $('iU').value, num($('iQ').value) || 0, 0, num($('iP').value) || 0), { min: $('iM').value }));
    else { const u = parseUnit($('iU').value); Object.assign(it, { name: n, desc: $('iD').value, unit: $('iU').value, size: u.size, liq: u.liq, pack: u.pack, min: $('iM').value, price: num($('iP').value) || 0 }); }
    save(); closeSheet(); render();
  };
  if ($('iDel')) $('iDel').onclick = () => { if (!confirm(it.name + ' silinsin mi?')) return; W().stock = W().stock.filter(x => x !== it); save(); closeSheet(); render(); };
}
VIEWS.stok = function () {
  const w = W(), q = UI.q.toLocaleLowerCase('tr'), today = nowLocal().slice(0, 10);
  const items = w.stock.filter(s => (!q || s.name.toLocaleLowerCase('tr').includes(q) || s.desc.toLocaleLowerCase('tr').includes(q)) && (!UI.onlyHave || s.qty > 0 || q));
  const low = w.stock.filter(s => ok(num(s.min)) && s.qty <= num(s.min));
  const value = w.stock.reduce((a, s) => a + s.qty * (s.price || 0), 0);
  const todayLog = w.stockLog.filter(l => l.time.startsWith(today) && l.kind === 'sarf');
  const todayCost = todayLog.reduce((a, l) => { const s = w.stock.find(x => x.id === l.itemId); return a + l.qty * (s ? s.price || 0 : 0); }, 0);
  $('view').innerHTML = `<div class="readout"><h3>Kimyasal stoğu</h3>${row('Stokta olan kalem', w.stock.filter(s => s.qty > 0).length, 'adet')}${row('Asgari altında', low.length, 'adet')}${row('Envanter değeri', f(value, 0), '')}${row('Bugünkü sarf değeri', f(todayCost, 0), '')}</div>
    ${low.length ? `<div class="badbox">Az kalan: ${low.map(s => esc(s.name)).join(', ')}</div>` : ''}
    <div class="card"><div class="grid"><label>Ara<input type="search" id="sq" value="${esc(UI.q)}" placeholder="Ürün veya görev"></label></div>
      <div class="btns" style="margin-top:8px"><label class="chk"><input type="checkbox" id="sh" ${UI.onlyHave ? 'checked' : ''}> Sadece stokta olanlar</label><button class="btn sm" id="sAdd" style="margin-left:auto">Ürün ekle</button></div>
      <div id="sList" style="margin-top:6px">${items.map(s => { const lowS = ok(num(s.min)) && s.qty <= num(s.min); return `<div class="it ${lowS ? 'low' : ''}"><div><b>${esc(s.name)}</b><small>${esc(s.desc)} · ${esc(s.unit)}</small></div><div class="q">${fv(s.qty, 2)} <small>${esc(s.pack)}</small></div>
        <div class="bb"><button class="btn sm" data-mv="${s.id}" data-k="sarf">− Sarf</button><button class="btn sm" data-mv="${s.id}" data-k="gelen">+ Gelen</button><button class="btn sm" data-iset="${s.id}">Ayar</button><small style="margin-left:auto;align-self:center;color:var(--muted)">Top. sarf ${fv(s.used, 1)}</small></div></div>`; }).join('') || '<p class="hint">Sonuç yok.</p>'}</div></div>
    <div class="card"><h2>Son hareketler</h2><div class="tw"><table class="t"><tr><th>Zaman</th><th>Ürün</th><th>İşlem</th><th>Miktar</th></tr>${w.stockLog.slice(0, 20).map(l => `<tr><td>${fmtT(l.time)}</td><td style="text-align:left">${esc(l.name)}</td><td>${l.kind}</td><td>${fv(l.qty, 2)}</td></tr>`).join('') || '<tr><td colspan="4">Henüz hareket yok.</td></tr>'}</table></div></div>`;
  $('sq').oninput = e => { UI.q = e.target.value; const p = e.target.selectionStart; VIEWS.stok(); $('sq').focus(); $('sq').setSelectionRange(p, p); };
  $('sh').onchange = e => { UI.onlyHave = e.target.checked; render(); };
  $('sAdd').onclick = () => itemSheet(null);
};
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mv]'); if (m) moveSheet(W().stock.find(s => s.id === m.dataset.mv), m.dataset.k);
  const st = e.target.closest('[data-iset]'); if (st) itemSheet(W().stock.find(s => s.id === st.dataset.iset));
  const t = e.target.closest('[data-take]'); if (t) moveSheet(W().stock.find(s => s.id === t.dataset.take), 'sarf', t.dataset.units, t.dataset.note);
});

/* =========================================================
   4. HESAP
   ========================================================= */
const lastMw = () => { const s = sortedTests().filter(t => ok(num(t.v.mw))).slice(-1)[0]; return s ? num(s.v.mw) : ''; };
const stockSel = (id, attr) => `<select ${attr}>${W().stock.map(s => `<option value="${s.id}" ${s.id === id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`;
function loadRecipe(k) {
  const w = W(); w.mix.tpl = k;
  w.mix.rows = RECIPES[k].rows.map(([key, dose]) => { const it = w.stock.find(s => s.key === key); return it ? { rid: uid(), id: it.id, dose } : null; }).filter(Boolean);
  save();
}
VIEWS.hesap = function () {
  $('view').innerHTML = `<div class="chips">${[['sifir', 'Sıfırdan çamur'], ['mud', 'Mevcut çamura müdahale'], ['birim', 'Birim çevirici']].map(([k, n]) => `<button data-hes="${k}" aria-pressed="${UI.hes === k}">${n}</button>`).join('')}</div><div id="hesBody" class="stack"></div>`;
  ({ sifir: hesSifir, mud: hesMud, birim: hesBirim })[UI.hes]();
};
function hesSifir() {
  const w = W(), m = w.mix; if (!m.rows.length && m.tpl !== 'bos') loadRecipe(m.tpl);
  $('hesBody').innerHTML = `<div class="card"><h2>Sıfırdan çamur</h2><p class="hint">Reçete seç, hacmi yaz. Dozlar son hacme göredir (ppb); sıvılar % hacimdir.</p>
    <div class="grid"><label>Reçete<select id="mTpl">${Object.entries(RECIPES).map(([k, r]) => `<option value="${k}" ${m.tpl === k ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label><label>Hazırlanacak hacim (bbl)<input id="mVol" inputmode="decimal" value="${esc(m.vol)}"></label></div>
    <div class="tw" style="margin-top:10px"><table class="t"><tr><th>Ürün</th><th>Doz</th><th></th></tr>${m.rows.map(r => `<tr><td style="position:static">${stockSel(r.id, `data-mr="${r.rid}" data-f="id"`)}</td><td><input data-mr="${r.rid}" data-f="dose" inputmode="decimal" value="${esc(r.dose)}"></td><td><button class="btn sm" data-mdel="${r.rid}">Sil</button></td></tr>`).join('')}</table></div>
    <div class="btns"><button class="btn sm" id="mAdd">Ürün ekle</button></div></div><div class="readout" id="mOut"></div>`;
  $('mTpl').onchange = e => { loadRecipe(e.target.value); hesSifir(); };
  $('mVol').oninput = e => { m.vol = e.target.value; save(); mixOut(); };
  $('mAdd').onclick = () => { m.rows.push({ rid: uid(), id: w.stock[0].id, dose: '' }); save(); hesSifir(); };
  $('hesBody').querySelectorAll('[data-mr]').forEach(i => { i.oninput = i.onchange = () => { const r = m.rows.find(x => x.rid === i.dataset.mr); r[i.dataset.f] = i.value; save(); mixOut(); }; });
  $('hesBody').querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => { m.rows = m.rows.filter(x => x.rid !== b.dataset.mdel); save(); hesSifir(); });
  mixOut();
}
let lastMix;
function mixOut() {
  const w = W(), V = num(w.mix.vol); if (!(V > 0)) { $('mOut').innerHTML = '<h3>Sonuç</h3><div class="row"><span class="k">Hacim gir.</span></div>'; return; }
  const r = lastMix = mixCalc(V, w.mix.rows, w.stock), s = specState(r.mw, spec('mw'));
  $('mOut').innerHTML = `<h3>Sonuç</h3>${row('Beklenen yoğunluk', f(r.mw, 1), 'lb/ft³', true)}${row('', f(r.ppg, 2), 'ppg')}${row('Gereken su', f(r.water, 0), 'bbl')}
    <h3 style="margin-top:12px">Karıştırma sırası</h3>${r.rows.map((x, i) => row(`${i + 1}. ${esc(x.it.name)}`, `${fv(packQty(x.it, x.units), 1)} ${esc(x.it.pack)}`, x.it.liq ? f(x.gal, 0) + ' gal' : f(x.kg, 0) + ' kg')).join('')}
    ${r.rows.some(x => x.short) ? `<div class="badbox">Stok yetmez: ${r.rows.filter(x => x.short).map(x => esc(x.it.name)).join(', ')}</div>` : ''}
    <p class="note" style="color:#AEB9C0">Sıra genel bir öneridir: bentonit tatlı suda önceden şişirilir, polimerler topaklanmasın diye yavaş verilir, tuz ve ağırlaştırıcı sona bırakılır. Yoğunluk yaklaşık hesaptır (tuz çözününce hacim biraz azalır), tankta ölç.</p>
    <div class="btns"><button class="btn" id="mTake">Hepsini stoktan düş</button></div>`;
  $('mTake').onclick = () => { if (!r.rows.length || !confirm('Bu reçete stoktan düşülsün mü?')) return; r.rows.forEach(x => stockMove(x.it, 'sarf', packQty(x.it, x.units), `${f(V, 0)} bbl ${RECIPES[w.mix.tpl].name}`)); toast('Stok düşüldü.'); mixOut(); };
}
const H = (k, d) => { const v = UI.heslab[k]; return v == null ? (d ?? '') : v; };
const inp = (k, lbl, d) => `<label>${lbl}<input data-h="${k}" inputmode="decimal" value="${esc(H(k, d))}"></label>`;
const n_ = (k, d) => { const x = num(H(k, d)); return x; };
function hesMud() {
  const V0 = Math.round(circVol()) || '', mw0 = lastMw(), O = UI.mud;
  const tiles = [['agir', 'Ağırlaştır', 'Barit veya CaCO₃'], ['hafif', 'Hafiflet', 'Su veya petrol'], ['kimya', 'Kimyasal ekle', 'ppb ↔ torba'], ['karis', 'İki çamuru karıştır', 'Sonuç yoğunluk'], ['kati', 'Katı düşür', 'Seyreltme miktarı']];
  let form = '';
  if (O === 'agir') {
    const mat = H('mat', 'barit'), q = H('agq', 'hedef');
    form = `<div class="seg" data-hseg="mat">${[['barit', 'Barit'], ['caco3', 'CaCO₃']].map(([k, n]) => `<button data-v="${k}" aria-pressed="${mat === k}">${n}</button>`).join('')}</div>
      <label style="margin-top:10px">Soru<select data-hs="agq"><option value="hedef" ${q === 'hedef' ? 'selected' : ''}>Hedefe çıkmak için kaç adet?</option><option value="adet" ${q === 'adet' ? 'selected' : ''}>Bu kadar adet ne kadar ağırlaştırır?</option><option value="hacim" ${q === 'hacim' ? 'selected' : ''}>Bu kadar adetle kaç bbl çamur yapılır?</option></select></label>
      <div class="grid" style="margin-top:10px">${q !== 'hacim' ? inp('V', 'Çamur hacmi (bbl)', V0) : ''}${inp('p1', 'Şimdiki yoğunluk (lb/ft³)', mw0)}${q !== 'adet' ? inp('p2', 'Hedef yoğunluk (lb/ft³)') : ''}${q !== 'hedef' ? inp('u', `Adet (${WM[mat].kg} kg)`, 1) : ''}</div>`;
  } else if (O === 'hafif') {
    const fl = H('fl', 'su');
    form = `<div class="seg" data-hseg="fl">${[['su', 'Su'], ['petrol', 'Petrol']].map(([k, n]) => `<button data-v="${k}" aria-pressed="${fl === k}">${n}</button>`).join('')}</div>
      <div class="grid" style="margin-top:10px">${inp('V', 'Çamur hacmi (bbl)', V0)}${inp('p1', 'Şimdiki yoğunluk (lb/ft³)', mw0)}${inp('p2', 'Hedef yoğunluk (lb/ft³)')}</div>`;
  } else if (O === 'kimya') {
    form = `<label>Ürün${stockSel(H('it', W().stock.find(s => s.key === 'pacl')?.id), 'data-hs="it"')}</label><div class="grid" style="margin-top:10px">${inp('V', 'Çamur hacmi (bbl)', V0)}${inp('ppb', 'Doz (ppb)', 0.25)}</div>`;
  } else if (O === 'karis') {
    form = `<div class="grid">${inp('v1', '1. çamur hacmi (bbl)')}${inp('p1', '1. çamur yoğunluğu', mw0)}${inp('v2', '2. çamur hacmi (bbl)')}${inp('p2', '2. çamur yoğunluğu')}</div>`;
  } else {
    form = `<div class="grid">${inp('V', 'Çamur hacmi (bbl)', V0)}${inp('c', 'Şimdiki katı veya MBT', '')}${inp('t', 'Hedef', '')}</div><p class="note">% katı için de MBT için de aynı oran geçerlidir. Sıvı katısız kabul edilir.</p>`;
  }
  $('hesBody').innerHTML = `<div class="tiles">${tiles.map(([k, n, s]) => `<button class="tile" data-mud="${k}" aria-pressed="${O === k}"><b>${n}</b><small>${s}</small></button>`).join('')}</div>
    <div class="card">${form}</div><div class="readout" id="hOut"></div>`;
  hOut();
}
function hOut() {
  const O = UI.mud, V0 = Math.round(circVol()), mw0 = lastMw(); let h = '<h3>Sonuç</h3>', take = null;
  const V = n_('V', V0), p1 = n_('p1', mw0), p2 = n_('p2');
  const need = '<div class="row"><span class="k">Değerleri gir.</span></div>';
  if (O === 'agir') {
    const m = WM[H('mat', 'barit')], q = H('agq', 'hedef'), u = n_('u', 1), it = W().stock.find(s => s.key === m.key);
    if (q === 'hedef') {
      if (V > 0 && p1 > 0 && p2 > p1) { const r = weightUp(m, V, p1, p2); h += row(`${m.name} gerekli`, f(r.units, 2), `adet (${m.kg} kg)`, true) + row('Ağırlık', f(r.kg, 0), 'kg') + row('Hacim artışı', f(r.dV, 1), 'bbl') + row('Son hacim', f(V + r.dV, 0), 'bbl'); if (it) take = { it, u: +r.units.toFixed(2), note: `${f(p1, 1)} → ${f(p2, 1)} lb/ft³` }; }
      else h += p2 > 0 && p2 <= p1 ? '<div class="row"><span class="k">Hedef şimdikinden yüksek olmalı. Düşürmek için Hafiflet’i seç.</span></div>' : need;
    } else if (q === 'adet') {
      if (V > 0 && p1 > 0 && u > 0) { const r = weightWith(m, u, V, p1); h += row('Yeni yoğunluk', f(r.pcf, 1), 'lb/ft³', true) + row('', f(r.ppg, 2), 'ppg') + row('Artış', '+' + f(r.pcf - p1, 1), 'lb/ft³'); } else h += need;
    } else if (u > 0 && p1 > 0 && p2 > p1) h += row('Çamur hacmi', f(volWith(m, u, p1, p2), 0), 'bbl', true); else h += need;
  } else if (O === 'hafif') {
    const fl = FLUID[H('fl', 'su')];
    if (V > 0 && p1 > 0 && p2 > 0 && p2 < p1 && p2 / PCF > fl.ppg) {
      const r = dilute(fl, V, p1, p2);
      h += row(`${fl.name}: üstüne ekle`, f(r.add, 0), 'bbl', true) + row('Son hacim', f(V + r.add, 0), 'bbl') + `<div class="sp" style="height:8px"></div>` + row(`Önce ${f(r.replace, 0)} bbl çamur at, sonra ${fl.name.toLowerCase()}`, f(r.replace, 0), 'bbl') + row('Son hacim', f(V, 0), 'bbl') + `<p class="note" style="color:#AEB9C0">Excel’indeki sonuç ikinci satırdır: aynı hacimde çamur atıldığını varsayar.</p>`;
    } else h += need;
  } else if (O === 'kimya') {
    const it = W().stock.find(s => s.id === H('it', W().stock.find(x => x.key === 'pacl')?.id)), ppb = n_('ppb', 0.25);
    if (it && V > 0 && ppb > 0) {
      const kg = ppb * V / LB_KG, u = (it.liq ? ppb * V / (8.33 * it.sg) : kg) / it.size;
      h += row(esc(it.name), fv(packQty(it, u), 1), esc(it.pack), true) + row('Ağırlık', f(kg, 0), 'kg') + row('Stokta', fv(it.qty, 2), esc(it.pack));
      if (u > it.qty) h += '<div class="badbox">Stok yetmez.</div>';
      take = { it, u: packQty(it, u), note: `${f(ppb, 2)} ppb, ${f(V, 0)} bbl` };
    } else h += need;
  } else if (O === 'karis') {
    const v1 = n_('v1'), v2 = n_('v2');
    if (v1 > 0 && v2 > 0 && p1 > 0 && p2 > 0) { const r = blend(v1, p1, v2, p2); h += row('Karışım yoğunluğu', f(r.pcf, 1), 'lb/ft³', true) + row('', f(r.pcf / PCF, 2), 'ppg') + row('Toplam hacim', f(r.V, 0), 'bbl'); } else h += need;
  } else {
    const c = n_('c'), t = n_('t');
    if (V > 0 && c > 0 && t > 0 && t < c) { const r = solidsDil(V, c, t); h += row('Atmadan seyrelt', f(r.add, 0), 'bbl', true) + row('Son hacim', f(V + r.add, 0), 'bbl') + row('Önce at, sonra tamamla', f(r.replace, 0), 'bbl'); } else h += need;
  }
  if (take) h += `<div class="btns"><button class="btn" data-take="${take.it.id}" data-units="${take.u}" data-note="${esc(take.note)}">Stoktan düş</button></div>`;
  $('hOut').innerHTML = h;
}
function hesBirim() {
  const g = ['Hacim', 'Ağırlık', 'Uzunluk', 'Basınç', 'Konsantrasyon', 'Yoğunluk'];
  const U = { Hacim: { bbl: 1, 'm³': 0.159, gal: 42, L: 158.97, 'ft³': 5.615 }, 'Ağırlık': { kg: 1, lb: 2.204, ton: 0.001 }, Uzunluk: { m: 1, ft: 3.281, inç: 39.37, cm: 100 }, 'Basınç': { psi: 1, bar: 0.06895, kPa: 6.895, 'kg/cm²': 0.0703 }, Konsantrasyon: { 'lb/bbl': 1, 'kg/m³': 2.853 }, 'Yoğunluk': { 'lb/ft³': 1, ppg: 1 / 7.48, SG: 1 / 62.4, 'kg/m³': 16.02 } };
  const G = H('ug', 'Yoğunluk'), u = U[G], from = H('uf', Object.keys(u)[0]) in u ? H('uf', Object.keys(u)[0]) : Object.keys(u)[0], val = n_('uv', 75);
  $('hesBody').innerHTML = `<div class="card"><h2>Birim çevirici</h2><div class="grid"><label>Tür<select data-hs="ug">${g.map(x => `<option ${x === G ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${inp('uv', 'Değer', 75)}<label>Birim<select data-hs="uf">${Object.keys(u).map(x => `<option ${x === from ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div></div><div class="readout" id="hOut2"></div>`;
  const put = () => { const x = n_('uv', 75); $('hOut2').innerHTML = '<h3>Sonuç</h3>' + (ok(x) ? Object.entries(u).map(([k, c]) => row(k, fv(x / u[from] * c, 4), '')).join('') : ''); };
  UI.birimPut = put; put();
}
$('view').addEventListener('click', e => {
  const a = e.target.closest('[data-hes]'); if (a) { UI.hes = a.dataset.hes; VIEWS.hesap(); return; }
  const b = e.target.closest('[data-mud]'); if (b) { UI.mud = b.dataset.mud; hesMud(); return; }
  const s = e.target.closest('[data-hseg] button'); if (s) { UI.heslab[s.parentElement.dataset.hseg] = s.dataset.v; hesMud(); }
});
$('view').addEventListener('input', e => {
  const k = e.target.dataset.h; if (!k) return; UI.heslab[k] = e.target.value;
  if (UI.hes === 'birim') UI.birimPut(); else hOut();
});
$('view').addEventListener('change', e => { const k = e.target.dataset.hs; if (!k) return; UI.heslab[k] = e.target.value; if (UI.hes === 'birim') hesBirim(); else hesMud(); });

/* =========================================================
   5. TANK
   ========================================================= */
function tankSvg(t, tot) {
  const W_ = 340, H_ = 74, lv = W().tanks.levels, sum = t.comps.reduce((a, c) => a + c.len, 0); let x = 1, s = '';
  t.comps.forEach((c, i) => {
    const w = (W_ - 2) * c.len / sum, maxK = Math.max(...c.seg.map(z => z[1])), y = cm => H_ - 1 - cm / TANK_MAX * (H_ - 2);
    const pts = [[x, 1]], rx = [];                         // sağ duvar kademeli (dorse boynu)
    let right = [];
    [...c.seg].reverse().forEach(([hi, k], j, arr) => { const lo = j < arr.length - 1 ? arr[j + 1][0] : 0, wd = w * k / maxK; right.push([x + wd, y(hi)], [x + wd, y(lo)]); });
    const poly = [[x, 1], ...right, [x, H_ - 1]].map(p => p.join(',')).join(' ');
    const cm = Math.min(TANK_MAX, Math.max(0, num(lv[c.id]) || 0)), yy = y(cm), id = `cp-${c.id}`;
    s += `<clipPath id="${id}"><polygon points="${poly}"/></clipPath><rect clip-path="url(#${id})" x="${x}" y="${yy}" width="${w}" height="${H_ - yy}" fill="${t.comps.length && (W().tanks.roles[t.id] || t.role) === 'su' ? '#4C8FBF' : '#8A6A3F'}"/><polygon points="${poly}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    s += `<text x="${x + w / 2}" y="14" text-anchor="middle" font-size="10" fill="currentColor">${cm ? cm + ' cm' : ''}</text>`;
    x += w;
  });
  return `<svg viewBox="0 0 ${W_} ${H_}" role="img" aria-label="${esc(t.name)} doluluk">${s}</svg>`;
}
function updTanks() {
  const r = tanksNow(), wc = wellNow(), total = r.mud + wc.inHole;
  TANKS.forEach(t => { const e = $('tt-' + t.id); if (e) e.textContent = f(r.tanks[t.id].tot, 1) + ' bbl'; t.comps.forEach(c => { const b = $('cv-' + c.id); if (b) b.textContent = f(r.tanks[t.id].comps[c.id], 1) + ' bbl'; }); const sv = $('sv-' + t.id); if (sv) sv.innerHTML = tankSvg(t); });
  const last = W().tanks.log[0], dl = last ? total - last.total : null;
  $('tOut').innerHTML = `<h3>Toplam sistem</h3>${row('Aktif tanklar', f(r.aktif, 1), 'bbl')}${row('Yedek tanklar', f(r.yedek, 1), 'bbl')}${row('Kuyu içi (dizi varken)', f(wc.inHole, 1), 'bbl')}${row('Toplam çamur', f(total, 1), 'bbl', true)}${row('Su tankları (ayrı)', f(r.su, 1), 'bbl')}
    ${dl != null ? row(`Son okumaya göre (${fmtT(last.time)})`, `${dl > 0 ? '+' : ''}${f(dl, 1)}`, 'bbl') : ''}`;
  renderHeader();
}
VIEWS.tank = function () {
  const w = W(), T = w.tanks, lvl = T.levels;
  $('view').innerHTML = `<div class="readout" id="tOut"></div>
    <div class="note">Seviyeyi santim olarak yaz, hacim anında hesaplanır. Tank yüksekliği 225 cm.</div>
    ${TANKS.map(t => `<div class="card tk"><div class="tk-h"><b>${esc(t.name)}</b><span id="tt-${t.id}"></span></div><div id="sv-${t.id}"></div>
      <div class="cmps">${t.comps.map(c => `<div class="cmp"><b>${esc(c.name)}</b><input data-lv="${c.id}" inputmode="decimal" placeholder="cm" aria-label="${esc(t.name)} ${esc(c.name)} santim" value="${esc(lvl[c.id] ?? '')}"><span id="cv-${c.id}"></span></div>`).join('')}</div>
      <label style="flex-direction:row;align-items:center;gap:8px">Durum<select data-role="${t.id}" style="max-width:150px">${[['aktif', 'Aktif'], ['yedek', 'Yedek'], ['su', 'Su']].map(([k, n]) => `<option value="${k}" ${(T.roles[t.id] || t.role) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${t.note ? `<div class="note" style="margin-top:0">${esc(t.note)}</div>` : ''}</div>`).join('')}
    <div class="card"><h2>Diğer hacimler</h2><p class="hint">Bu dosyada ölçüsü olmayan tankları doğrudan bbl olarak yaz.</p>
      <div class="cmps">${T.extra.map(e => `<div class="cmp"><b>${esc(e.name)}</b><input data-ex="${e.id}" inputmode="decimal" placeholder="bbl" value="${esc(e.bbl)}"></div>`).join('')}</div></div>
    <div class="btns"><button class="btn" id="tLog" style="flex:1">Okumayı kaydet</button><button class="btn sec" id="tZero">Seviyeleri temizle</button></div>
    <div class="card"><h2>Okuma geçmişi</h2><p class="hint">Kaydedilen okumalar arasındaki fark, kaçak veya kazancı gösterir.</p><div class="tw"><table class="t"><tr><th>Zaman</th><th>Aktif</th><th>Yedek</th><th>Kuyu</th><th>Toplam</th><th>Fark</th></tr>
      ${T.log.slice(0, 15).map((l, i) => { const p = T.log[i + 1], d = p ? l.total - p.total : null; return `<tr><td>${fmtT(l.time)}</td><td>${f(l.aktif, 0)}</td><td>${f(l.yedek, 0)}</td><td>${f(l.hole, 0)}</td><td>${f(l.total, 0)}</td><td>${d == null ? '—' : (d > 0 ? '+' : '') + f(d, 1)}</td></tr>`; }).join('') || '<tr><td colspan="6">Henüz okuma yok.</td></tr>'}</table></div></div>`;
  $('tLog').onclick = () => { const r = tanksNow(), wc = wellNow(); T.log.unshift({ time: nowLocal(), aktif: +r.aktif.toFixed(1), yedek: +r.yedek.toFixed(1), su: +r.su.toFixed(1), hole: +wc.inHole.toFixed(1), total: +(r.mud + wc.inHole).toFixed(1), lv: Object.assign({}, lvl) }); save(); render(); toast('Okuma kaydedildi.'); };
  $('tZero').onclick = () => { if (!confirm('Tüm seviyeler temizlensin mi?')) return; T.levels = {}; save(); render(); };
  document.querySelectorAll('[data-lv]').forEach(i => i.oninput = () => { const c = i.value, x = num(c); T.levels[i.dataset.lv] = c; i.classList.toggle('over', ok(x) && x > TANK_MAX); save(); updTanks(); });
  document.querySelectorAll('[data-role]').forEach(i => i.onchange = () => { T.roles[i.dataset.role] = i.value; save(); updTanks(); });
  document.querySelectorAll('[data-ex]').forEach(i => i.oninput = () => { T.extra.find(x => x.id === i.dataset.ex).bbl = i.value; save(); updTanks(); });
  updTanks();
};

/* =========================================================
   6. KUYU
   ========================================================= */
const RKEY = { csg: [['name', 'Ad', 'text'], ['cid', 'İç çap (in)'], ['top', 'Üst (m)'], ['shoe', 'Pabuç (m)']], ds: [['name', 'Ad', 'text'], ['od', 'Dış çap (in)'], ['cid', 'İç çap (in)'], ['len', 'Boy (m)']] };
const rowsT = kind => `<div class="tw"><table class="t"><tr>${RKEY[kind].map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr>${W().kuyu[kind].map(r => `<tr>${RKEY[kind].map(c => `<td style="position:static"><input data-kr="${kind}" data-rid="${r.id}" data-f="${c[0]}" ${c[2] === 'text' ? 'type="text"' : 'inputmode="decimal"'} value="${esc(r[c[0]] ?? '')}"></td>`).join('')}<td><button class="btn sm" data-krdel="${kind}" data-rid="${r.id}">Sil</button></td></tr>`).join('')}</table></div><div class="btns"><button class="btn sm" data-kradd="${kind}">Satır ekle</button></div>`;
const tallyM = () => { const t = W().tally, k = t.unit === 'ft' ? 1 / FT_M : 1; const L = t.rows.map(x => num(x) * k).filter(ok), n_in = Math.min(t.inHole || L.length, L.length); return { n: L.length, tot: L.reduce((a, b) => a + b, 0), inN: n_in, inSum: L.slice(0, n_in).reduce((a, b) => a + b, 0), avg: L.length ? L.reduce((a, b) => a + b, 0) / L.length : NaN }; };
VIEWS.kuyu = function () {
  const w = W(), k = w.kuyu, p = w.pump, t = w.tally;
  $('view').innerHTML = `<div class="readout" id="kOut"></div>
    <div class="card"><h2>Kuyu</h2><div class="grid"><label>Kuyu derinliği (m)<input data-k="depth" inputmode="decimal" value="${esc(k.depth)}"></label><label>Matkap derinliği (m)<input data-k="bit" inputmode="decimal" value="${esc(k.bit)}"></label><label>Açık kuyu çapı (in)<input data-k="oh" inputmode="decimal" value="${esc(k.oh)}"></label></div>
      <h3>Casing</h3>${rowsT('csg')}
      <h3>Dizi (matkaptan yukarı doğru)</h3>${rowsT('ds')}<div id="dsWarn"></div></div>
    <div class="card"><h2>Tally</h2><p class="hint">Excel veya PDF tally dosyasını seç. Boru boyları toplanır, diziye aktarılır.</p>
      <div class="btnrow"><label class="btn sec" style="flex-direction:row">Dosya seç (Excel / PDF)<input type="file" id="tlFile" accept=".xls,.xlsx,.csv,.pdf"></label>${t.rows.length ? '<button class="btn sm" id="tlClear">Temizle</button>' : ''}</div>
      <p class="note" id="tlStat">${t.src ? esc(t.src) : 'Dosya seçilmedi.'}</p>
      <div id="tlBody"></div></div>
    <div class="card"><h2>Pompa</h2><div class="grid">
      <label>bbl/stroke (%100 verimle)<input data-p="bps" inputmode="decimal" value="${esc(p.bps)}" placeholder="boşsa gömlekten"></label>
      <label>Verim (%)<input data-p="eff" inputmode="decimal" value="${esc(p.eff)}"></label>
      <label>Pompa-1 SPM<input data-spm="0" inputmode="decimal" value="${esc(p.spm[0])}"></label><label>Pompa-2 SPM<input data-spm="1" inputmode="decimal" value="${esc(p.spm[1])}"></label>
      <label>Gömlek (in)<input data-p="liner" inputmode="decimal" value="${esc(p.liner)}"></label><label>Strok boyu (in)<input data-p="stroke" inputmode="decimal" value="${esc(p.stroke)}"></label></div>
      <p class="note">bbl/stroke yazarsan o kullanılır. Boş bırakırsan triplex pompa için gömlek ve strok boyundan hesaplanır.</p></div>
    <div class="readout" id="trOut"></div>
    <div class="card"><h2>Manevra dolumu</h2><p class="hint">Dizi çekerken kuyuya ne kadar çamur basılmalı.</p><div class="grid"><label>Stand boyu (m)<input id="stL" inputmode="decimal" value="${esc(w.trip.stand)}"></label></div><div id="fillOut" style="margin-top:8px"></div></div>
    <div class="card"><h2>Kuyu kayıtları</h2><div class="btnrow"><button class="btn sm" id="bk">Yedek al</button><label class="btn sm" style="flex-direction:row;display:inline-block">Yedekten yükle<input type="file" id="bkIn" accept=".json"></label><button class="btn sm" id="wl">Kuyu değiştir</button></div></div>`;
  $('tlFile').onchange = tallyFile;
  if ($('tlClear')) $('tlClear').onclick = () => { w.tally = { rows: [], unit: 'm', inHole: 0, bha: '', src: '' }; save(); render(); };
  $('stL').oninput = e => { w.trip.stand = e.target.value; save(); kOut(); };
  $('bk').onclick = () => { const d = new Date().toISOString().slice(0, 10); saveFile(new Blob([JSON.stringify(DB)], { type: 'application/json' }), `camur_yedek_${d}.json`); };
  $('bkIn').onchange = async e => { const f_ = e.target.files[0]; if (!f_) return; try { const d = JSON.parse(await f_.text()); if (!d.wells) throw 0; if (!confirm('Mevcut veriler yedekle değiştirilsin mi?')) return; DB = d; saveNow(); render(); renderAlarms(); toast('Yedek yüklendi.'); } catch (x) { toast('Geçerli yedek dosyası değil.'); } };
  $('wl').onclick = wellSheet;
  tallyBody(); kOut();
};
function tallyBody() {
  const w = W(), t = w.tally; if (!t.rows.length) { $('tlBody').innerHTML = ''; return; }
  const s = tallyM(), bha = (w.kuyu.ds.slice(0, -1).reduce((a, r) => a + (num(r.len) || 0), 0));
  $('tlBody').innerHTML = `<div class="grid"><label>Kuyudaki boru adedi<input id="tlIn" inputmode="decimal" value="${s.inN}"></label><label>BHA boyu (m)<input id="tlB" inputmode="decimal" value="${esc(t.bha === '' ? bha : t.bha)}"></label></div>
    <div class="note">Dosyada ${s.n} boru, toplam ${f(s.tot, 2)} m, ortalama ${f(s.avg, 2)} m. Kuyudaki ${s.inN} boru: <b>${f(s.inSum, 2)} m</b>.</div>
    <div class="note">Matkap derinliği: ${f(s.inSum + (num(t.bha === '' ? bha : t.bha) || 0), 2)} m</div>
    <div class="btns"><button class="btn" id="tlApply">Diziye ve matkap derinliğine aktar</button></div>`;
  $('tlIn').onchange = e => { t.inHole = Math.round(num(e.target.value)) || 0; save(); tallyBody(); };
  $('tlB').onchange = e => { t.bha = e.target.value; save(); tallyBody(); };
  $('tlApply').onclick = () => {
    const s2 = tallyM(), B = num(t.bha === '' ? bha : t.bha) || 0, ds = w.kuyu.ds, last = ds[ds.length - 1];
    if (last) last.len = +s2.inSum.toFixed(2);
    w.kuyu.bit = +(s2.inSum + B).toFixed(2);
    if (!(num(w.kuyu.depth) >= w.kuyu.bit)) w.kuyu.depth = w.kuyu.bit;
    save(); render(); toast('Tally diziye aktarıldı.');
  };
}
async function tallyFile(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const st = $('tlStat'); st.textContent = 'Okunuyor…';
  try {
    const r = await readTally(file);
    if (!r || !r.joints.length) { st.textContent = 'Dosyada boru uzunluğu bulunamadı.'; return; }
    W().tally = { rows: r.joints, unit: r.unit, inHole: r.joints.length, bha: '', src: `${r.joints.length} boru okundu · birim ${r.unit} · ${r.src}` }; save(); render();
  } catch (x) { st.textContent = x.message === 'scan' ? 'Bu PDF taranmış görüntü, içinde okunacak metin yok. Excel sürümünü dene.' : x.message === 'lib' ? 'Okuyucu yüklenemedi. Uygulamayı bir kez internetliyken aç.' : 'Dosya okunamadı: ' + x.message; }
}
async function readTally(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    await loadLib('pdf');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const all = []; let votes = { ft: 0, m: 0 }, pages = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p), tc = await page.getTextContent(), toks = [];
      tc.items.forEach(it => { if (!it.str || !it.str.trim()) return; const x0 = it.transform[4], y0 = it.transform[5], w = it.width || it.str.length * 5; let off = 0; it.str.split(/(\s+)/).forEach(pt => { if (pt.trim()) toks.push({ s: pt.trim(), x: x0 + w * (off + pt.length / 2) / it.str.length, y: y0 }); off += pt.length; }); });
      if (!toks.length) continue; pages++;
      toks.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = []; toks.forEach(t => { const l = lines.find(L => Math.abs(L.y - t.y) < 3); if (l) l.t.push(t); else lines.push({ y: t.y, t: [t] }); });
      const xs = toks.map(t => t.x).sort((a, b) => a - b), cents = [];
      xs.forEach(x => { const c = cents[cents.length - 1]; if (c && x - c.max < 14) { c.max = x; c.sum += x; c.n++; } else cents.push({ min: x, max: x, sum: x, n: 1 }); });
      const colOf = x => { let bi = 0, bd = 1e9; cents.forEach((c, i) => { const d = Math.abs(c.sum / c.n - x); if (d < bd) { bd = d; bi = i; } }); return bi; };
      const grid = lines.map(L => { const r = []; L.t.forEach(t => { const c = colOf(t.x); r[c] = r[c] ? r[c] + ' ' + t.s : t.s; }); return Array.from(r, v => v ?? ''); });
      const res = parseGrid(grid); if (res) { votes[res.unit] += res.joints.length; all.push(...res.joints); }
    }
    if (!pages) throw new Error('scan');
    return { unit: votes.m > votes.ft ? 'm' : 'ft', joints: all, src: file.name };
  }
  await loadLib('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); let best = null;
  wb.SheetNames.forEach(sn => { const r = parseGrid(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' })); if (r && (!best || r.joints.length > best.joints.length)) best = r; });
  if (!best) return null; best.src = file.name; return best;
}
function kOut() {
  const w = W(), wc = wellNow(), pc = pumpCalc(w.pump), act = tanksNow().aktif, tr = tripCalc(wc, pc, act);
  $('kOut').innerHTML = `<h3>Kuyu hacmi</h3>${row('Açık kuyu', f(wc.ohVol, 1), 'bbl')}${row('Casing içi', f(wc.csgVol, 1), 'bbl')}${row('Toplam kuyu hacmi', f(wc.hole, 1), 'bbl')}${row('Dizi içi', f(wc.dsCap, 1), 'bbl')}${row('Anülüs', f(wc.ann, 1), 'bbl')}${row('Dizi taşırması', f(wc.dsDisp, 1), 'bbl')}${row('Kuyudaki çamur', f(wc.inHole, 1), 'bbl', true)}`;
  const dw = $('dsWarn'); if (dw) dw.innerHTML = Math.abs(wc.gap) > 0.5 && wc.strLen > 0 ? `<div class="warnbox">Dizi boyu ${f(wc.strLen, 1)} m, matkap derinliği ${f(wc.B, 1)} m. ${f(Math.abs(wc.gap), 1)} m fark var; boyları kontrol et.</div>` : '';
  const tRow = (n, r, big) => row(n, ok(r.min) ? `${f(r.min, 1)} dk` : '—', ok(r.stk) ? f(r.stk, 0) + ' stk' : '', big);
  $('trOut').innerHTML = `<h3>Çamurun tripi</h3>${row('Pompa çıkışı', ok(pc.net) ? f(pc.net, 4) : '—', 'bbl/stk')}${row('Debi', ok(pc.gpm) ? f(pc.gpm, 0) : '—', `gpm · ${f(pc.bpm, 2)} bbl/dk`)}
    ${tRow('Yüzey → Matkap', tr.s2b)}${tRow('Matkap → Yüzey', tr.b2s, true)}${tRow('Kuyu tam tur', tr.hole)}${tRow(`Toplam (kuyu + ${f(act, 0)} bbl aktif tank)`, tr.total)}
    ${!(pc.bpm > 0) ? '<p class="note" style="color:#AEB9C0">Pompa değerlerini girince süreler çıkar.</p>' : ''}`;
  const L = num(w.trip.stand), dp = [...wc.str].pop(), fo = $('fillOut');
  if (fo) fo.innerHTML = dp && L > 0 ? (() => { const ft = L * FT_M, dry = (cap(dp.od) - cap(dp.id)) * ft, wet = cap(dp.od) * ft; return `<div class="tw"><table class="t"><tr><th>${esc(dp.name)}</th><th>1 stand</th><th>5 stand</th></tr><tr><td>Kuru boru</td><td>${f(dry, 2)} bbl</td><td>${f(dry * 5, 2)} bbl</td></tr><tr><td>Islak boru</td><td>${f(wet, 2)} bbl</td><td>${f(wet * 5, 2)} bbl</td></tr></table></div><p class="note">Bastığın çamur bu değerden azsa kuyu gelme yapıyor olabilir: dur ve şefe haber ver.</p>`; })() : '';
}
$('view').addEventListener('input', e => {
  const d = e.target.dataset, w = W();
  if (d.k && UI.tab === 'kuyu') { w.kuyu[d.k] = e.target.value; save(); kOut(); renderHeader(); }
  else if (d.kr) { const r = w.kuyu[d.kr].find(x => x.id === d.rid); r[d.f] = e.target.value; save(); kOut(); renderHeader(); }
  else if (d.p) { w.pump[d.p] = e.target.value; save(); kOut(); }
  else if (d.spm != null) { w.pump.spm[+d.spm] = e.target.value; save(); kOut(); }
});
$('view').addEventListener('click', e => {
  const a = e.target.closest('[data-kradd]'), x = e.target.closest('[data-krdel]');
  if (a) { W().kuyu[a.dataset.kradd].push({ id: uid(), name: '', cid: '', od: '', len: '', top: 0, shoe: '' }); save(); render(); }
  if (x) { const k = x.dataset.krdel; W().kuyu[k] = W().kuyu[k].filter(r => r.id !== x.dataset.rid); save(); render(); }
});

/* ---------- kuyu listesi ---------- */
function wellSheet() {
  const ws = Object.values(DB.wells);
  sheet(`<h2>Kuyular</h2>${ws.map(w => `<div class="it"><div><b>${esc(w.name)}</b><small>${esc(w.status)} · ${w.tests.length} test · ${esc((MUD_TYPES[w.mudType] || {}).name || '')}</small></div><div class="btnrow">${w.id === DB.active ? '<span class="chip ok">açık</span>' : `<button class="btn sm" data-wopen="${w.id}">Aç</button>`}</div></div>`).join('')}
    <div class="grid" style="margin-top:12px"><label>Yeni kuyu adı<input type="text" id="wNew"></label></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="wStock" checked> Stoğu bu kuyudan devret</label>
    <div class="btns"><button class="btn" id="wAdd">Yeni kuyu aç</button><button class="btn sec" id="wRen">Adı değiştir</button><button class="btn sec" id="wEnd">${W().status === 'aktif' ? 'Kuyuyu bitir' : 'Tekrar aktif yap'}</button>${ws.length > 1 ? '<button class="btn danger" id="wDel">Kuyuyu sil</button>' : ''}<button class="btn sec" data-close>Kapat</button></div>`);
  $('sheetBox').querySelectorAll('[data-wopen]').forEach(b => b.onclick = () => { DB.active = b.dataset.wopen; UI.edit = null; save(); closeSheet(); render(); });
  $('wAdd').onclick = () => { const n = $('wNew').value.trim() || 'Yeni kuyu', cur = W(), w = newWell(n); w.mudType = cur.mudType; w.specs = JSON.parse(JSON.stringify(cur.specs)); if ($('wStock').checked) w.stock = JSON.parse(JSON.stringify(cur.stock)).map(s => Object.assign(s, { used: 0 })); DB.wells[w.id] = w; DB.active = w.id; UI.edit = null; save(); closeSheet(); render(); };
  $('wRen').onclick = () => { const n = prompt('Kuyu adı', W().name); if (n) { W().name = n; save(); closeSheet(); render(); } };
  $('wEnd').onclick = () => { W().status = W().status === 'aktif' ? 'bitti' : 'aktif'; save(); wellSheet(); };
  if ($('wDel')) $('wDel').onclick = () => { if (!confirm(`${W().name} ve tüm kayıtları silinsin mi?`)) return; delete DB.wells[DB.active]; DB.active = Object.keys(DB.wells)[0]; save(); closeSheet(); render(); };
}
$('wellBtn').onclick = wellSheet;

/* ---------- başlat ---------- */
load(); renderBar(); renderAlarms(); render(); wakeSync(); tick();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

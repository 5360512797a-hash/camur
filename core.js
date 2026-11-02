/* Çamur Cebi — hesap çekirdeği (ekrandan bağımsız).
   Kaynaklar: Günlük Sondaj Sıvısı Raporu, Çamur Ağırlaştırma Excel'i, MR 8000 Tank Hacimleri Excel'i. */
'use strict';
const FT_M = 3.28084, PCF = 7.48, W_PPG = 8.33, LB_KG = 2.204622;
const uid = () => Math.random().toString(36).slice(2, 10);
const num = v => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.').replace(/[<>≤≥~\s]/g, '')); };
const ok = x => x != null && x !== '' && isFinite(x);

/* ---------- TANKLAR (MR 8000) ----------
   seg: [üst sınır cm, bbl/cm]. Excel'deki kademeli katsayılar; toplam yükseklik 225 cm. */
const S2 = [[80, 0.532], [115, 0.786], [225, 1.017]];
const TANKS = [
  { id: 'elek', name: 'Elek tankı', role: 'aktif', note: 'Tank altındaki 50,7 bbl ölü hacim okumaya dahil değildir.', comps: [
    { id: 'e3', name: '3. bölme', len: 2.16, seg: [[225, 0.333]] }, { id: 'e2', name: '2. bölme', len: 2.16, seg: [[225, 0.333]] },
    { id: 'e1', name: '1. bölme', len: 2.15, seg: [[225, 0.331]] }, { id: 'ek', name: 'Kum tuzağı', len: 2.08, seg: [[80, 0.298], [225, 0.321]] }] },
  { id: 'cok', name: 'Çökelme tankı', role: 'aktif', comps: [{ id: 'c1', name: '1. bölme', len: 4.7, seg: [[225, 0.724]] }, { id: 'c2', name: '2. bölme', len: 6.6, seg: S2 }] },
  { id: 'em1', name: 'Emiş-1 tankı', role: 'aktif', comps: [{ id: 'm1', name: '1. bölme', len: 2.25, seg: [[225, 0.347]] }, { id: 'm2', name: '2. bölme', len: 3.73, seg: [[225, 0.575]] },
    { id: 'm3', name: '3. bölme', len: 5.3, seg: [[80, 0.344], [115, 0.592], [225, 0.817]] }] },
  { id: 'em2', name: 'Emiş-2 tankı', role: 'yedek', comps: [{ id: 'n1', name: '1. kısım', len: 4.7, seg: [[225, 0.724]] }, { id: 'n2', name: '2. kısım', len: 6.6, seg: S2 }] },
  { id: 'hop', name: 'Hopper', role: 'yedek', comps: [{ id: 'h1', name: '1. bölme', len: 4.7, seg: [[225, 0.724]] }, { id: 'h2', name: '2. bölme', len: 6.6, seg: S2 }] },
  { id: 'rz1', name: 'Rezerv-1 tankı', role: 'yedek', comps: [{ id: 'r1', name: '1. bölme', len: 4.7, seg: [[225, 0.724]] }, { id: 'r2', name: '2. bölme', len: 6.6, seg: S2 }] },
  { id: 'rz2', name: 'Rezerv-2 tankı', role: 'yedek', comps: [{ id: 'q1', name: '1. bölme', len: 4.7, seg: [[225, 0.724]] }, { id: 'q2', name: '2. bölme', len: 6.6, seg: S2 }] },
  { id: 'su1', name: 'Su tankı-1', role: 'su', comps: [{ id: 's1', name: 'Su', len: 11.3, seg: [[80, 1.256], [115, 1.51], [225, 1.741]] }] },
  { id: 'su2', name: 'Su tankı-2', role: 'su', comps: [{ id: 's2', name: 'Su', len: 11.3, seg: [[80, 1.256], [115, 1.51], [225, 1.741]] }] }
];
const TANK_MAX = 225;
function volAt(comp, cm) {
  let v = 0, lo = 0;
  for (const [hi, k] of comp.seg) { if (cm <= lo) break; v += (Math.min(cm, hi) - lo) * k; lo = hi; }
  return v;
}
function tankTotals(w) {
  const lv = w.tanks.levels, roles = w.tanks.roles, res = { aktif: 0, yedek: 0, su: 0, tanks: {} };
  TANKS.forEach(t => {
    let tot = 0; const comps = {};
    t.comps.forEach(c => { const cm = num(lv[c.id]); const b = ok(cm) ? volAt(c, Math.max(0, cm)) : 0; comps[c.id] = b; tot += b; });
    res.tanks[t.id] = { tot, comps };
    res[roles[t.id] || t.role] += tot;
  });
  (w.tanks.extra || []).forEach(e => { const b = num(e.bbl); if (ok(b)) res[e.role || 'aktif'] += b; });
  res.mud = res.aktif + res.yedek;
  return res;
}

/* ---------- KUYU ---------- */
const cap = d => d * d / 1029.4;             // bbl/ft
function wellCalc(k) {
  const D = num(k.depth) || 0, B = Math.min(ok(num(k.bit)) ? num(k.bit) : D, D) , oh = num(k.oh) || 0;
  const csgs = (k.csg || []).map(c => ({ name: c.name, id: num(c.id), top: num(c.top) || 0, shoe: num(c.shoe) })).filter(c => c.id > 0 && c.shoe > 0);
  const holeId = d => { const on = csgs.filter(c => d >= c.top && d < c.shoe); return on.length ? Math.min(...on.map(c => c.id)) : oh; };
  // dizi alttan üste
  const str = []; let z = B;
  (k.ds || []).forEach(r => { const L = num(r.len) || 0; if (L <= 0 || z <= 0) return; const a = Math.max(0, z - L); str.push({ name: r.name, od: num(r.od) || 0, id: num(r.id) || 0, top: a, bot: z }); z = a; });
  const pts = new Set([0, B, D]);
  csgs.forEach(c => { [c.top, c.shoe].forEach(x => { if (x < D) pts.add(x); }); });
  str.forEach(s => { pts.add(s.top); pts.add(s.bot); });
  const xs = [...pts].filter(x => x >= 0 && x <= D).sort((a, b) => a - b);
  let csgVol = 0, ohVol = 0, dsCap = 0, dsDisp = 0, ann = 0; const secs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2, ft = (b - a) * FT_M, H = holeId(m), cased = csgs.some(c => m >= c.top && m < c.shoe);
    const v = cap(H) * ft; if (cased) csgVol += v; else ohVol += v;
    const p = str.find(s => m >= s.top && m < s.bot);
    if (p) { dsCap += cap(p.id) * ft; dsDisp += (cap(p.od) - cap(p.id)) * ft; }
    const annV = p ? (cap(H) - cap(p.od)) * ft : v;
    if (m < B) ann += annV;
    secs.push({ a, b, H, cased, pipe: p ? p.name : '', od: p ? p.od : 0, ann: annV });
  }
  const hole = csgVol + ohVol, inHole = hole - dsDisp, strLen = str.reduce((s, x) => s + (x.bot - x.top), 0);
  return { D, B, csgVol, ohVol, hole, dsCap, dsDisp, ann, inHole, secs, strLen, gap: B - strLen, str };
}
function pumpCalc(p) {
  let bps = num(p.bps);
  const eff = (ok(num(p.eff)) ? num(p.eff) : 100) / 100;
  if (!ok(bps) && num(p.liner) > 0 && num(p.stroke) > 0) bps = linerBps(num(p.liner), num(p.stroke));
  const spm = (p.spm || []).map(num).filter(x => x > 0).reduce((a, b) => a + b, 0);
  const net = bps * eff, bpm = net * spm;
  return { bps, eff, net, spm, bpm, gpm: bpm * 42 };
}
const linerBps = (d, s) => 3 * Math.PI / 4 * d * d * s / 9702;   // triplex, %100 verim
function tripCalc(wc, pc, active) {
  const row = bbl => ({ bbl, min: pc.bpm > 0 ? bbl / pc.bpm : NaN, stk: pc.net > 0 ? bbl / pc.net : NaN });
  return { s2b: row(wc.dsCap), b2s: row(wc.ann), hole: row(wc.dsCap + wc.ann), total: row(wc.dsCap + wc.ann + (active || 0)) };
}

/* ---------- ÇAMUR TESTLERİ ---------- */
const GROUPS = [['temel', 'Temel'], ['reo', 'Reoloji'], ['fil', 'Sıvı kaybı'], ['ret', 'Retort ve katı'], ['kim', 'Kimya']];
const P = (k, g, n, u, d, x = {}) => Object.assign({ k, g, n, u, d }, x);
const PROPS = [
  P('tout', 'temel', 'Çıkış sıcaklığı', '°F', 0, { help: 'Flow-line’dan çıkan çamurun sıcaklığı.' }),
  P('mw', 'temel', 'Yoğunluk', 'lb/ft³', 1, { quick: 1, help: 'Terazi ile ölçülür. Kuyu basıncını kontrol eden ana değer. Beklenmedik düşüş gaz veya su girişi olabilir.' }),
  P('fv', 'temel', 'Huni viskozitesi', 'sn/qt', 0, { quick: 1, help: '1 quart çamurun Marsh hunisinden akış süresi. Hızlı kontrol değeridir.' }),
  P('ttest', 'reo', 'Test sıcaklığı', '°F', 0, { help: 'Reolojiyi ölçtüğün çamurun sıcaklığı. Testleri aynı sıcaklıkta yap.' }),
  P('r600', 'reo', '600 rpm', '', 0, { help: 'Viskozimetre okuması.' }), P('r300', 'reo', '300 rpm', '', 0), P('r200', 'reo', '200 rpm', '', 0),
  P('r100', 'reo', '100 rpm', '', 0), P('r6', 'reo', '6 rpm', '', 0), P('r3', 'reo', '3 rpm', '', 0),
  P('pv', 'reo', 'Plastik viskozite', 'cP', 0, { auto: 1, help: '600 − 300 okuması. Yükselmesi genelde katı artışı demektir.' }),
  P('yp', 'reo', 'Yield point', 'lb/100ft²', 0, { auto: 1, help: '300 okuması − PV. Kesinti taşıma gücü.' }),
  P('g10s', 'reo', 'Jel 10 sn', 'lb/100ft²', 0, { help: '3 rpm’de 10 saniye bekledikten sonra en yüksek okuma.' }),
  P('g10m', 'reo', 'Jel 10 dk', 'lb/100ft²', 0, { help: '10 dakika bekledikten sonra okuma. 10 sn değerinden çok yüksekse katı veya karbonat kirliliğine bak.' }),
  P('g30m', 'reo', 'Jel 30 dk', 'lb/100ft²', 0),
  P('fl', 'fil', 'API sıvı kaybı', 'ml/30dk', 1, { help: 'API filtre presi, 100 psi, 30 dakika. Yükselirse kek kalınlaşır, kuyu daralır.' }),
  P('cake', 'fil', 'API kek', '1/32 in', 0, { help: '“<1” yazabilirsin; 1 olarak hesaba girer.' }),
  P('hpht', 'fil', 'HPHT sıvı kaybı', 'ml/30dk', 1), P('hphtT', 'fil', 'HPHT sıcaklığı', '°F', 0),
  P('water', 'ret', 'Su', '% hacim', 1, { help: 'Retort sonucu.' }), P('oil', 'ret', 'Petrol', '% hacim', 1), P('sol', 'ret', 'Katı', '% hacim', 1, { help: 'Retort sonucu (100 − su − petrol).' }),
  P('solc', 'ret', 'Düzeltilmiş katı', '% hacim', 1, { auto: 1, help: 'Tuzun kapladığı hacim çıkarılmış gerçek katı. Yoğunluk, retort ve kimya girilince hesaplanır.' }),
  P('sand', 'ret', 'Kum', '% hacim', 1, { help: 'Kum tüpü (200 mesh) ile ölçülür.' }), P('mbt', 'ret', 'MBT', 'lb/bbl', 2, { help: 'Metilen mavisi testi: çamurdaki aktif kil miktarı.' }),
  P('ph', 'kim', 'pH', '', 1, { help: 'pH metre veya kağıt.' }), P('cl', 'kim', 'Klor', 'mg/L', 0, { help: 'Filtrattan titrasyon. Ani artış tuzlu su, ani düşüş tatlı su girişi olabilir.' }),
  P('pf', 'kim', 'Alkalinite Pf', 'ml', 2), P('mf', 'kim', 'Alkalinite Mf', 'ml', 2), P('pm', 'kim', 'Alkalinite Pm', 'ml', 2),
  P('th', 'kim', 'Toplam sertlik', 'mg/L', 0), P('ca', 'kim', 'Kalsiyum', 'mg/L', 0, { help: 'Filtrattan titrasyon. Sert su, çimento, jips girişinde yükselir.' }),
  P('kcl', 'kim', 'KCl', '% ağırlık', 1, { help: 'Kil inhibisyonunu sağlayan tuz oranı.' }),
  P('mg', 'kim', 'Magnezyum', 'mg/L', 1, { auto: 1 }), P('lime', 'kim', 'Depo kireç', 'lb/bbl', 2, { auto: 1 }),
  P('oh', 'kim', 'Hidroksil', 'mg/L', 0, { auto: 1 }), P('co3', 'kim', 'Karbonat', 'mg/L', 0, { auto: 1 }), P('hco3', 'kim', 'Bikarbonat', 'mg/L', 0, { auto: 1 })
];
const PROP = Object.fromEntries(PROPS.map(p => [p.k, p]));

function derive(v0) {
  const v = Object.assign({}, v0), g = k => num(v[k]);
  const r6 = g('r600'), r3 = g('r300');
  if (ok(r6) && ok(r3)) { v.pv = r6 - r3; v.yp = r3 - v.pv; }
  const th = g('th'), ca = g('ca');
  if (ok(th) && ok(ca)) v.mg = Math.max(0, th - ca) * 0.6075;
  const pf = g('pf'), mf = g('mf'), pm = g('pm'), fw = ok(g('water')) ? g('water') / 100 : 1;
  if (ok(pm) && ok(pf)) v.lime = 0.26 * (pm - fw * pf);
  if (ok(pf) && ok(mf)) {
    let oh = 0, co3 = 0, hco3 = 0;
    if (pf === 0) hco3 = 1220 * mf;
    else if (2 * pf < mf) { co3 = 1200 * pf; hco3 = 1220 * (mf - 2 * pf); }
    else if (2 * pf === mf) co3 = 1200 * pf;
    else if (pf < mf) { oh = 340 * (2 * pf - mf); co3 = 1200 * (mf - pf); }
    else oh = 340 * mf;
    v.oh = oh; v.co3 = co3; v.hco3 = hco3;
  }
  const s = solids(v); if (s) v.solc = s.vs;
  return v;
}
function solids(v) {                      // raporun katı analizi (KCl + NaCl düzeltmesi)
  const mw = num(v.mw) / PCF, vw = num(v.water), vo = num(v.oil) || 0, kclw = num(v.kcl) || 0, cl = num(v.cl) || 0, ca = num(v.ca) || 0, th = num(v.th) || 0;
  if (!ok(mw) || !ok(vw)) return null;
  const sg = kclw === 0 ? 1 : kclw <= 5 ? 0.9985 + 6.3 * kclw / 1000 : kclw <= 10 ? 0.997334 + 6.6 * kclw / 1000 : 0.9954 + 6.8 * kclw / 1000;
  const kcl = 10000 * kclw * sg, mg = th > ca ? (th - ca) * 243 / 400 : 0;
  const clNa = Math.max(0, cl - 0.47554 * kcl - 1.769112 * ca - 2.91734 * mg);
  const nacl = 1.64846 * clNa, cacl2 = 2.7691 * ca, mgcl2 = 3.91734 * mg;
  const rf = 1 + (6.45 * nacl + 5.845 * kcl + 7.6 * cacl2 + 7.5 * mgcl2) * 1e-7, vif = 1 / (rf - (kcl + nacl + cacl2 + mgcl2) * 1e-6);
  const vwc = vif * vw, vs = 100 - vo - vwc;
  return { vs, vif, rf, vwc, kcl, nacl };
}
/* Önceki değere göre sapma: <10 yok, 10–20 sarı, 20–30 turuncu, üstü kırmızı */
function devOf(x, prev) {
  if (!ok(x) || !ok(prev)) return null;
  if (prev === 0) return x === 0 ? { pct: 0, lvl: '' } : null;
  const pct = (x - prev) / Math.abs(prev) * 100, a = Math.abs(pct);
  return { pct, lvl: a < 10 ? '' : a < 20 ? 'y' : a < 30 ? 'o' : 'r' };
}
function specState(x, s) {
  if (!ok(x) || !s) return '';
  if (ok(s.lo) && x < s.lo) return 'lo';
  if (ok(s.hi) && x > s.hi) return 'hi';
  return ok(s.lo) || ok(s.hi) ? 'ok' : '';
}

/* ---------- ÇAMUR TİPLERİ VE HEDEFLER ---------- */
const sp = o => Object.fromEntries(Object.entries(o).map(([k, [lo, hi]]) => [k, { lo, hi }]));
const MUD_TYPES = {
  kclg: { name: 'KCl Polimer / Glikol', poly: 1, salt: 'kcl', spec: sp({ mw: [70, 80], fv: [45, 60], pv: [10, 25], yp: [15, 28], g10s: [3, 8], g10m: [5, 15], fl: [null, 5], cake: [null, 1], sand: [null, 1], sol: [null, 12], solc: [null, 10], mbt: [null, 15], ph: [9, 10.5], ca: [null, 400], kcl: [5, 8] }) },
  kcl: { name: 'KCl Polimer', poly: 1, salt: 'kcl', spec: sp({ mw: [68, 80], fv: [42, 58], pv: [10, 22], yp: [14, 26], g10s: [3, 8], g10m: [5, 15], fl: [null, 6], cake: [null, 1], sand: [null, 1], sol: [null, 12], solc: [null, 10], mbt: [null, 15], ph: [9, 10.5], ca: [null, 400], kcl: [3, 7] }) },
  nacl: { name: 'Tuzlu su (NaCl) Polimer', poly: 1, salt: 'nacl', spec: sp({ mw: [72, 85], fv: [40, 55], pv: [10, 25], yp: [12, 22], g10s: [3, 8], g10m: [5, 15], fl: [null, 6], cake: [null, 2], sand: [null, 1], sol: [null, 12], mbt: [null, 15], ph: [9, 10.5], ca: [null, 600] }) },
  lsnd: { name: 'Düşük katılı polimer (LSND)', poly: 1, spec: sp({ mw: [65, 78], fv: [38, 50], pv: [8, 18], yp: [8, 16], g10s: [2, 6], g10m: [4, 12], fl: [null, 8], cake: [null, 2], sand: [null, 1], sol: [null, 6], mbt: [null, 15], ph: [9, 10], ca: [null, 200] }) },
  ligno: { name: 'Lignosülfonat / Dispers', thin: 1, spec: sp({ mw: [70, 95], fv: [40, 55], pv: [12, 28], yp: [8, 18], g10s: [2, 6], g10m: [5, 15], fl: [null, 8], cake: [null, 2], sand: [null, 1], sol: [null, 15], mbt: [null, 25], ph: [10, 11], ca: [null, 200] }) },
  spud: { name: 'Spud / Bentonit', spud: 1, spec: sp({ mw: [65, 72], fv: [35, 60], pv: [5, 15], yp: [10, 25], g10s: [3, 10], g10m: [6, 20], sand: [null, 2], mbt: [15, 30], ph: [9, 10], ca: [null, 200] }) }
};

/* ---------- STOK ---------- */
const SG = { barit: 4.2, caco3f: 2.7, caco3m: 2.7, caco3c: 2.7, bent: 2.6, kcl: 1.98, nacl: 2.16, kostik: 2.13, soda: 2.53, bikarb: 2.2, sitrik: 1.66, kirec: 2.2, xcd: 1.5, pacl: 1.6, pacr: 1.6, cmc: 1.6, nisasta: 1.5, cfl: 1.4 };
const KEYMAP = [[/^BARIT/, 'barit'], [/^BENTONIT/, 'bent'], [/^KOSTİK SODA/, 'kostik'], [/^XCD/, 'xcd'], [/^PAC LV/, 'pacl'], [/^PAC R/, 'pacr'], [/^CMC LV/, 'cmc'], [/^CFL/, 'cfl'], [/NİŞASTA/, 'nisasta'],
  [/^SİTRİK/, 'sitrik'], [/BİKARBONAT/, 'bikarb'], [/^SODA KÜLÜ/, 'soda'], [/^CaCO3, İNCE/i, 'caco3f'], [/^CaCO3, ORTA/i, 'caco3m'], [/^CaCO3, KALIN/i, 'caco3c'], [/^KCL/, 'kcl'], [/^NACL/, 'nacl'], [/^KİREÇ/, 'kirec'], [/^GLIKOL/, 'glikol']];
const keyOf = name => { const n = String(name).trim(); const m = KEYMAP.find(([r]) => r.test(n)); return m ? m[1] : ''; };
function parseUnit(u) {                       // '25 kg/torba' → {size kg|gal, liq, pack}
  const m = String(u).trim().match(/^([\d.,]+)\s*(MT|kg|gal|l|lb)\s*\/\s*(.+)$/i);
  if (!m) return { size: 25, liq: false, pack: 'torba' };
  const x = num(m[1]), un = m[2].toLowerCase();
  if (un === 'mt') return { size: x * 1000, liq: false, pack: m[3] };
  if (un === 'kg') return { size: x, liq: false, pack: m[3] };
  if (un === 'lb') return { size: x / LB_KG, liq: false, pack: m[3] };
  if (un === 'gal') return { size: x, liq: true, pack: m[3] };
  return { size: x / 3.785, liq: true, pack: m[3] };
}
function mkItem(name, desc, unit, qty, used, price) {
  const u = parseUnit(unit), key = keyOf(name);
  return { id: uid(), key, name, desc: desc || '', unit, size: u.size, liq: u.liq, pack: u.pack, qty: +qty || 0, used: +used || 0, min: '', price: +price || 0, sg: SG[key] || (u.liq ? 1 : 1.6) };
}
const SEED_STOCK = [["BENTONIT", "Viskozite&Sıvı Kaybı Kontrolü", "1 MT/BB", 5, 0, 228.8], ["KOSTİK SODA", "pH&Sertlik Kontrolü", "25 kg/torba", 163, 2, 16.5], ["XCD", "Viskozite Kontrolü", "25 kg/torba", 171, 4, 149.88], ["PAC LV", "Sıvı Kaybı Kontrolü", "25 kg/torba", 589, 51, 32.31], ["PAC R", "Viskozite&Sıvı Kaybı Kontrolü", "25 kg/torba", 0, 0, 77], ["CMC LV", "Sıvı Kaybı Kontrolü", "25 kg/torba", 180, 0, 23.93], ["CFL", "İnceltici", "25 kg/torba", 0, 0, 41.72], ["MODİFİYE NİŞASTA", "Sıvı Kaybı Kontrolü", "25 kg/torba", 297, 33, 21.73], ["SİTRİK ASİT", "pH&Sertlik Kontrolü", "25 kg/torba", 150, 10, 38.52], ["SODYUM BİKARBONAT", "Kalsiyum Giderici", "25 kg/torba", 170, 0, 12.55], ["SODA KÜLÜ", "Kalsiyum Giderici", "25 kg/torba", 478, 2, 19.25], ["KAÇAK SELÜLOZU, İNCE", "Kaçak Malzemesi", "25 kg/torba", 0, 0, 19.91], ["KAÇAK SELÜLOZU, ORTA", "Kaçak Malzemesi", "25 kg/torba", 0, 0, 19.91], ["MICA M", "Kaçak Malzemesi", "25 kg/torba", 40, 0, 6.6], ["CaCO3, İNCE", "Kaçak Malzemesi", "1 MT/BB", 11, 4, 66.39], ["CaCO3, KALIN", "Kaçak Malzemesi", "1 MT/BB", 0, 0, 1.78], ["BARIT", "Yoğunluk Kontrolü", "1.5 MT/BB", 17, 0, 226.05], ["KCL", "Kil İnhibisyonu", "1 MT/BB", 38, 4, 623.7], ["NACL", "Kil İnhibisyonu", "1 MT/BB", 56, 8, 79.31], ["KOROZYON ÖNLEYİCİ", "Korozyon İnhibitörü", "55 gal/varil", 0, 0, 214.08], ["PTS200", "Yüksek Sıcaklık Performans Arttırıcı", "25 kg/bidon", 0, 0, 79.2], ["CaCO3, ORTA", "Kaçak Malzemesi", "1 MT/BB", 2, 6, 66.39], ["ALÜMİNYUM STEARAT", "Köpük Kırıcı", "20 kg/torba", 0, 0, 90.23], ["BIOCIDE", "Bakteri önleyici", "5 gal/bidon", 17, 0, 18.75], ["GLIKOL MC", "Kil İnhibisyonu", "55 gal/varil", 0, 0, 226.73], ["SPOT SIVISI", "Spotting Sıvısı", "50 gal/varil", 0, 0, 327.8], ["FLO-VIS PLUS", "Viskozite Yapıcı", "25 kg/torba", 0, 0, 524.61], ["FLO-TROL", "Sıvı Kaybı Kontrolü", "25 kg/torba", 0, 0, 87.54], ["PHPA Toz", "Kil İnhibisyonu", "25 kg/torba", 0, 0, 53.63], ["PHPA Sıvı", "Kil İnhibisyonu", "5 gal/bidon", 0, 0, 60.5], ["LUBRICANT", "Yağlayıcı", "55 gal/varil", 19, 0, 343.53], ["KİREÇ", "Kalsiyum Kaynağı & Alkalinite Kontrolü", "25 kg/torba", 0, 0, 3.07], ["GILSONITE", "Kil İnhibisyonu", "25 kg/torba", 0, 0, 79.2], ["PENETREX", "ROP arttırıcı", "55 gal/varil", 0, 0, 619.16], ["CaCO3 İnce", "Köprü Malzemesi", "25 kg/torba", 0, 0, 1.84], ["Q-Drill", "ROP arttırıcı", "55 gal/varil", 0, 0, 568.7], ["ULTRAFREE", "ROP arttırıcı", "55 gal/varil", 0, 0, 904.06], ["Soltex", "Kil İnhibisyonu", "25 kg/torba", 0, 0, 79.2], ["Polyamine", "Kil İnhibisyonu", "55 gal/varil", 0, 0, 871.2]];
const seedStock = () => SEED_STOCK.map(r => mkItem(...r));

/* Hazır reçeteler. dose: katı için ppb, sıvı için % hacim */
const RECIPES = {
  rapor: { name: 'KCl Polimer (rapordaki reçete)', rows: [['nacl', 38], ['kcl', 20], ['caco3f', 19], ['caco3m', 19], ['pacl', 5], ['nisasta', 4], ['kostik', 0.2], ['soda', 0.2]] },
  kclg: { name: 'KCl Polimer / Glikol (başlangıç)', rows: [['soda', 0.25], ['kostik', 0.25], ['xcd', 1], ['pacl', 1.5], ['nisasta', 3], ['kcl', 25.5], ['glikol', 3]] },
  lsnd: { name: 'Düşük katılı polimer (başlangıç)', rows: [['bent', 7], ['soda', 0.25], ['kostik', 0.2], ['xcd', 0.5], ['pacl', 1]] },
  spud: { name: 'Spud bentonit (başlangıç)', rows: [['soda', 0.25], ['bent', 22], ['kostik', 0.1]] },
  lcm: { name: 'Kaçak hapı (rapordaki reçete)', rows: [['xcd', 0.45], ['caco3m', 40]] },
  sweep: { name: 'Viskoz süpürme hapı (başlangıç)', rows: [['xcd', 1.5], ['pacr', 1]] },
  bos: { name: 'Boş liste', rows: [] }
};
const MIX_ORDER = { bent: 1, soda: 2, kostik: 3, kirec: 3, xcd: 4, pacr: 5, pacl: 6, cmc: 6, nisasta: 7, nacl: 8, kcl: 9, glikol: 10, caco3f: 11, caco3m: 11, caco3c: 11, barit: 12 };
function mixCalc(V, rows, stock) {
  let solidVol = 0, lbs = 0; const out = [];
  rows.forEach(r => {
    const it = stock.find(s => s.id === r.id), d = num(r.dose);
    if (!it || !ok(d) || d <= 0) return;
    let kg, gal, vol, lb;
    if (it.liq) { vol = V * d / 100; gal = vol * 42; lb = vol * 350 * it.sg; kg = lb / LB_KG; }
    else { lb = d * V; kg = lb / LB_KG; vol = lb / (350 * it.sg); }
    const units = (it.liq ? gal : kg) / it.size;
    solidVol += vol; lbs += lb;
    out.push({ it, d, kg, gal, vol, lb, units, short: units > it.qty, order: MIX_ORDER[it.key] || 8 });
  });
  const water = V - solidVol, mwPpg = V > 0 ? (water * 42 * W_PPG + lbs) / (V * 42) : NaN;
  return { rows: out.sort((a, b) => a.order - b.order), water, mw: mwPpg * PCF, ppg: mwPpg };
}

/* ---------- AĞIRLAŞTIRMA / SEYRELTME (Levent'in Excel'i ile aynı formüller) ---------- */
const WM = { barit: { name: 'Barit', K: 1470, D: 35, kg: 1500, key: 'barit' }, caco3: { name: 'CaCO₃', K: 945, D: 22.5, kg: 1000, key: 'caco3f' } };
function weightUp(m, V, p1, p2) {
  const a = p1 / PCF, b = p2 / PCF, lb = V * m.K * (b - a) / (m.D - b), kg = lb / 2.204;
  return { lb, kg, units: kg / m.kg, dV: (b - a) / (m.D - b) * V };
}
function weightWith(m, units, V, p1) {
  const lb = units * m.kg * LB_KG, a = p1 / PCF, b = (m.D * lb + m.K * a * V) / (m.K * V + lb);
  return { ppg: b, pcf: b * PCF, lb };
}
function volWith(m, units, p1, p2) {
  const lb = units * m.kg * LB_KG, a = p1 / PCF, b = p2 / PCF;
  return lb * (m.D - b) / (m.K * (b - a));
}
const FLUID = { su: { name: 'Su', ppg: W_PPG }, petrol: { name: 'Petrol', ppg: 7 } };
function dilute(fl, V, p1, p2) {
  const a = p1 / PCF, b = p2 / PCF;
  return { replace: V * (a - b) / (a - fl.ppg),   // aynı hacimde çamur atılıp sıvı eklenirse (Excel)
    add: V * (a - b) / (b - fl.ppg) };            // hiç çamur atılmadan üstüne eklenirse
}
function blend(v1, p1, v2, p2) { const V = v1 + v2; return { V, pcf: (v1 * p1 + v2 * p2) / V }; }
function solidsDil(V, c, t) { return { add: V * (c - t) / t, replace: V * (c - t) / c }; }

/* ---------- TAVSİYE MOTORU ---------- */
const ppm2ppb = { soda: 0.00093, bikarb: 0.00074, kirecCO3: 0.00043, kirecHCO3: 0.00021 };
const KCL_PPB = 3.65;     // %1 KCl ≈ 3,65 ppb (raporda %7 = 25,57 ppb)
function dose(key, ppb, why) { return { key, ppb, why }; }
function advise(test, specs, typeKey, prev) {
  const T = MUD_TYPES[typeKey] || MUD_TYPES.kclg, v = derive(test.v), p = prev ? derive(prev.v) : {}, out = [];
  const x = k => num(v[k]), s = k => specs[k] || {}, st = k => specState(x(k), s(k));
  const tgt = k => { const a = s(k); return ok(a.lo) && ok(a.hi) ? (a.lo + a.hi) / 2 : ok(a.hi) ? a.hi : a.lo; };
  const rng = k => { const a = s(k); return ok(a.lo) && ok(a.hi) ? `${a.lo}–${a.hi}` : ok(a.hi) ? `en çok ${a.hi}` : ok(a.lo) ? `en az ${a.lo}` : ''; };
  const add = (sev, k, title, why, steps, doses, calc) => out.push({ sev, k, title, why, steps, doses: doses || [], calc });
  const name = k => PROP[k].n, val = k => `${+x(k).toFixed(PROP[k].d)}${PROP[k].u ? ' ' + PROP[k].u : ''}`;
  const hiT = k => `${name(k)} yüksek: ${val(k)} (hedef ${rng(k)})`, loT = k => `${name(k)} düşük: ${val(k)} (hedef ${rng(k)})`;
  const cement = x('ph') > 10.5 && (x('pm') > 3 || x('ca') > 400 || (ok(p.ca) && x('ca') > num(p.ca) * 1.3));

  /* --- önce kuyu güvenliği --- */
  if (ok(num(p.mw)) && ok(x('mw')) && x('mw') < num(p.mw) - 2) add('alarm', 'mw', `Yoğunluk aniden düştü: ${p.mw} → ${x('mw')} lb/ft³`, 'Gaz kesmesi, su girişi veya ölçüm hatası olabilir.', ['Tartıyı temizleyip tekrar ölç.', 'Tanklarda seviye artışı var mı bak (Tank sekmesi).', 'Artış varsa kuyu kontrolü olabilir: hemen sondaj şefine haber ver.']);
  if (ok(p.cl) && ok(x('cl')) && num(p.cl) > 0) {
    const dc = (x('cl') - num(p.cl)) / num(p.cl);
    if (dc > 0.2) add('alarm', 'cl', `Klor hızlı arttı: ${p.cl} → ${x('cl')} mg/L`, 'Tuzlu su akışı veya tuz formasyonu olabilir.', ['Testi tekrarla, pit seviyesini kontrol et.', 'Yoğunluk ve akış değişimi varsa şefe bildir.']);
    if (dc < -0.2) add('warn', 'cl', `Klor hızlı düştü: ${p.cl} → ${x('cl')} mg/L`, 'Tatlı su girişi veya fazla su eklenmesi olabilir.', ['Su hattı açık mı kontrol et.', 'Pit seviyesini kontrol et, tuzu hedefe getir.']);
  }

  /* --- yoğunluk --- */
  if (st('mw') === 'hi') add('hi', 'mw', hiT('mw'), 'Genelde çamura karışan kesinti katısı yoğunluğu artırır.', ['Elekler, desander, desilter ve decanter çalışıyor mu kontrol et.', T.salt ? 'Seyreltmeyi su yerine hazır polimer/tuzlu premix ile yap; düz su KCl ve polimeri de düşürür.' : 'Gerekirse aşağıdaki kadar seyrelt.'], [], { type: 'dil', p1: x('mw'), p2: s('mw').hi });
  if (st('mw') === 'lo') add('lo', 'mw', loT('mw'), 'Yoğunluk artırılmalı. Önce ani düşüş nedeni yoksa ağırlaştırıcı ekle.', ['Hopper’dan yavaşça ekle, sirkülasyon altında karıştır.', 'Hazne/rezervuar kesiliyorsa asitte çözünen CaCO₃ tercih edilir, yüksek yoğunluk için barit gerekir.'], [], { type: 'wu', p1: x('mw'), p2: tgt('mw') });

  /* --- reoloji --- */
  const vMix = (st('yp') === 'lo' && st('fv') === 'hi') || (st('yp') === 'hi' && st('fv') === 'lo');
  const vLow = !vMix && (st('fv') === 'lo' || st('yp') === 'lo'), vHigh = !vMix && (st('fv') === 'hi' || st('yp') === 'hi');
  if (vMix) add('warn', 'yp', `Huni ve YP ters yönde: FV ${val('fv')}, YP ${val('yp')}`, 'İkisi birlikte hareket etmeli. Ölçüm hatası veya sıcaklık farkı olabilir.', ['Numuneyi karıştırıp iki testi aynı sıcaklıkta tekrarla.', 'Doğrulanmadan viskozite kimyasalı ekleme.']);
  if (vLow) {
    const t = st('yp') === 'lo' ? loT('yp') : loT('fv');
    if (T.spud) add('lo', 'yp', t, 'Çamurda yeterli jel yapısı yok.', ['Önceden şişirilmiş bentonit ekle, kuru bentonit tuzlu çamura girmez.'], [dose('bent', 2)]);
    else if (T.thin) add('lo', 'yp', t, 'Taşıma gücü zayıf.', ['Önceden şişirilmiş bentonit veya XCD ile küçük adımlarla artır.'], [dose('xcd', 0.1)]);
    else add('lo', 'yp', t, 'Polimer miktarı azalmış, kesinti taşıma gücü düşük.', ['XCD’yi yavaş ekle (hopper’dan 1 torba ≈ 10 dk).', 'Bir sirkülasyon sonra FV ve YP’yi tekrar ölç.'], [dose('xcd', st('yp') === 'lo' && x('yp') < (s('yp').lo || 0) * 0.7 ? 0.2 : 0.1)]);
  }
  if (vHigh) {
    const t = st('yp') === 'hi' ? hiT('yp') : hiT('fv');
    if (T.thin) add('hi', 'yp', t, 'Katı artışı veya kirlilik reolojiyi yükseltmiş.', ['Önce katı kontrolü, sonra inceltici.', 'Seyreltme ile birlikte uygula.'], [dose('cfl', 0.5)]);
    else add('hi', 'yp', t, T.poly ? 'Fazla polimer veya birikmiş ince katı.' : 'Katı veya kil artışı.', ['XCD eklemeyi durdur.', 'Decanter/desilter’i çalıştır, %5–10 hacim taze premix ile seyrelt.', T.poly ? 'Polimerli çamura lignosülfonat inceltici koyma; seyreltme doğru çözümdür.' : 'Gerekirse su ile seyrelt.']);
  }
  if (st('pv') === 'lo' && !vLow) add('info', 'pv', loT('pv'), 'Düşük PV genelde sorun değildir; taşıma gücü YP ile kontrol edilir.', ['YP ve FV hedefteyse işlem gerekmez.']);
  if (st('pv') === 'hi') add('hi', 'pv', hiT('pv'), 'PV’nin yükselmesi çamurdaki ince katı arttı demektir.', ['Elek tellerini kontrol et, daha ince tel tak.', 'Decanter’ı devreye al.', 'Düzeltilmiş katı ve MBT’ye birlikte bak.']);
  if (st('g10m') === 'hi' || (ok(x('g10s')) && ok(x('g10m')) && x('g10s') > 0 && x('g10m') > x('g10s') * 3)) add('warn', 'g10m', `Jeller aşırı artıyor: ${v.g10s ?? '—'} / ${v.g10m ?? '—'}`, 'İlerleyen jel; ince katı veya karbonat kirliliğine işaret eder.', ['Katı kontrolünü artır.', 'Pf/Mf ile karbonatı kontrol et.', 'Manevra sonrası pompayı yavaş başlat; yüksek jel kuyuya basınç vurur.']);

  /* --- sıvı kaybı --- */
  if (st('fl') === 'hi') {
    const ex = x('fl') - s('fl').hi;
    if (T.spud) add('hi', 'fl', hiT('fl'), 'Kek geçirgen.', ['PAC LV veya CMC LV’yi küçük adımlarla ekle.', 'Bentonit miktarını (MBT) kontrol et.'], [dose('pacl', 0.25)]);
    else add('hi', 'fl', hiT('fl'), 'Filtrat kontrol polimerleri tükenmiş veya kırılmış olabilir.', ['PAC LV’yi yavaş ekle; yanında modifiye nişasta kullan.', x('tout') > 250 ? 'Çıkış sıcaklığı yüksek: nişasta 250 °F üzerinde bozulabilir, PAC LV ağırlıklı git.' : 'Bir sirkülasyon sonra API sıvı kaybını tekrar ölç.'], [dose('pacl', Math.min(0.75, Math.max(0.25, ex * 0.25))), dose('nisasta', Math.min(1, Math.max(0.25, ex * 0.25)))]);
  }
  if (st('cake') === 'hi') add('warn', 'cake', hiT('cake'), 'Kalın kek diziyi yapıştırır ve kuyuyu daraltır.', ['Sıvı kaybını ve katıyı düşür.', 'Kum ve düzeltilmiş katıya bak.']);

  /* --- pH --- */
  if (st('ph') === 'lo') add('lo', 'ph', loT('ph'), 'Düşük pH polimerleri ve korozyon korumasını bozar.', ['Kostiği kimyasal varilinde suda çöz, yavaş yavaş ver.', 'Kostik yakıcıdır: gözlük, eldiven ve maske tak.'], [dose('kostik', s('ph').lo - x('ph') > 0.7 ? 0.2 : 0.1)]);
  if (st('ph') === 'hi') {
    if (cement) add('hi', 'ph', hiT('ph'), 'pH yüksek ve Pm/kalsiyum da yüksek: çimento kirliliği olabilir.', ['Sodyum bikarbonat ile kalsiyumu çöktür, sitrik asit ile pH’ı indir.', 'Çimento delindiyse devam eden kirlenme için dozu tekrarla.'], [dose('sitrik', 0.2)]);
    else add('hi', 'ph', hiT('ph'), 'Fazla kostik veya kireç girişi.', ['Sitrik asidi çözüp yavaş ver.', 'Kostik eklemeyi durdur.'], [dose('sitrik', x('ph') - s('ph').hi > 0.7 ? 0.3 : 0.1)]);
  }

  if (x('ph') > 10.5 && ok(x('pf')) && x('pf') < 0.3) add('warn', 'pf', `pH ve Pf uyuşmuyor: pH ${x('ph')}, Pf ${x('pf')}`, 'pH bu kadar yüksekken Pf’nin de yüksek çıkması beklenir.', ['pH metreyi tampon çözeltiyle kalibre edip tekrar ölç.', 'İşlem yapmadan önce bu farkı doğrula.']);

  /* --- kalsiyum / sertlik --- */
  if (st('ca') === 'hi') {
    const ex = x('ca') - s('ca').hi, fw = ok(x('water')) ? x('water') / 100 : 1;
    if (cement) add('hi', 'ca', hiT('ca'), 'Çimento veya kireç kaynaklı kalsiyum.', ['Sodyum bikarbonat kalsiyumu çöktürür ve pH’ı artırmaz.'], [dose('bikarb', ex * ppm2ppb.bikarb * fw)]);
    else add('hi', 'ca', hiT('ca'), 'Sert su veya jips/anhidrit girişi.', ['Soda külü kalsiyumu çöktürür.', 'Karışım suyunun sertliğini de ölç.'], [dose('soda', ex * ppm2ppb.soda * fw)]);
  }
  /* --- karbonat --- */
  if (ok(x('pf')) && ok(x('mf')) && x('pf') > 0 && x('mf') / x('pf') >= 5 && num(v.hco3) >= 800) {
    const fw = ok(x('water')) ? x('water') / 100 : 1;
    add('warn', 'mf', `Karbonat kirliliği işareti: Pf ${x('pf')} / Mf ${x('mf')}, bikarbonat ${Math.round(v.hco3)} mg/L`, 'Mf/Pf oranı yüksek. Karbonat ve bikarbonat jelleri artırır, sıvı kaybını bozar.', [x('ph') < (s('ph').lo || 9.5) ? 'Önce pH’ı hedefe getir (bikarbonat karbonata döner).' : 'Pf/Mf testini taze filtratla tekrarla.', 'Kireci küçük dozla ver, tekrar Pf/Mf ölç.', 'Kaynak CO₂ gazı, fazla soda külü veya bozulan polimer olabilir.'], [dose('kirec', num(v.hco3) * ppm2ppb.kirecHCO3 * fw + num(v.co3 || 0) * ppm2ppb.kirecCO3 * fw)]);
  }

  /* --- tuz --- */
  if (st('kcl') === 'lo') add('lo', 'kcl', loT('kcl'), 'KCl azalmış; killi formasyon şişebilir.', ['KCl’yi hopper’dan ekle, seyreltme suyunu da KCl’li hazırla.'], [dose('kcl', (tgt('kcl') - x('kcl')) * KCL_PPB)]);
  if (st('kcl') === 'hi') add('info', 'kcl', hiT('kcl'), 'İnhibisyon yeterli, maliyet artar.', ['KCl ilavesini durdur; seyreltme ile doğal olarak iner.']);
  if (st('cl') === 'lo' && T.salt === 'nacl') add('lo', 'cl', loT('cl'), 'Tuz konsantrasyonu düşmüş.', ['NaCl ekle veya tuzlu premix ile tamamla.'], [dose('nacl', (tgt('cl') - x('cl')) * 0.00058)]);

  /* --- katı --- */
  const solK = ok(x('solc')) && s('solc').hi != null ? 'solc' : 'sol';
  if (st(solK) === 'hi') add('hi', solK, hiT(solK), 'Fazla katı; sondaj hızını düşürür, reolojiyi ve yoğunluğu artırır.', ['Elek telini inceltip desilter/decanter’ı devreye al.', 'Gerekirse aşağıdaki kadar seyrelt.'], [], { type: 'sol', c: x(solK), t: s(solK).hi });
  if (st('sand') === 'hi') add('hi', 'sand', hiT('sand'), 'Kum aşındırır; pompa gömleği ve matkabı yıpratır.', ['Elek telleri yırtık mı bak, gerekirse daha ince tel tak.', 'Desander’ı devreye al.']);
  if (st('mbt') === 'hi') add('hi', 'mbt', hiT('mbt'), 'Aktif kil birikiyor.', ['Decanter’ı çalıştır, taze premix ile seyrelt.', T.salt === 'kcl' ? 'KCl yüzdesi hedefte mi kontrol et.' : 'İnhibisyonu kontrol et.']);
  if (st('mbt') === 'lo' && T.spud) add('lo', 'mbt', loT('mbt'), 'Bentonit az.', ['Önceden şişirilmiş bentonit ekle.'], [dose('bent', Math.max(2, (tgt('mbt') - x('mbt'))))]);
  return out;
}
const SEV_RANK = { alarm: 0, hi: 1, lo: 1, warn: 2, info: 3 };

/* ---------- BAŞLANGIÇ VERİSİ (rapor_yeni.xls) ---------- */
function newWell(name) {
  return { id: uid(), name: name || 'Yeni kuyu', field: '', rig: '', op: '', status: 'aktif', created: new Date().toISOString(),
    mudType: 'kclg', specs: JSON.parse(JSON.stringify(MUD_TYPES.kclg.spec)), tests: [], draft: {},
    tanks: { levels: {}, roles: {}, extra: [{ id: uid(), name: 'Trip tankı', bbl: '', role: 'aktif' }, { id: uid(), name: 'Premix', bbl: '', role: 'yedek' }], log: [] },
    stock: seedStock().map(s => Object.assign(s, { qty: 0, used: 0 })), stockLog: [],
    kuyu: { depth: '', bit: '', oh: '', csg: [], ds: [{ id: uid(), name: 'DC', od: '', cid: '', len: '' }, { id: uid(), name: 'HWDP', od: '', cid: '', len: '' }, { id: uid(), name: 'DP', od: '', cid: '', len: '' }] },
    pump: { bps: '', liner: '', stroke: '', eff: 96, spm: ['', ''] }, tally: { rows: [], unit: 'm', inHole: 0, bha: '', src: '' },
    trip: { stand: 28 }, mix: { tpl: 'rapor', vol: 100, rows: [] }, vol: '' };
}
function seedWell() {
  const w = newWell('Çimlihöyük');
  Object.assign(w, { field: 'Şehit Esma Çevik', rig: 'BD//2', op: 'TPAO' });
  w.stock = seedStock();
  const d = '2025-02-18';
  w.tests = [
    { id: uid(), time: d + 'T13:00', depth: 1174, place: 'FlowLine', src: 'rapor', v: { tout: 100, ttest: 95, mw: 80, fv: 54, r600: 57, r300: 37, r200: 30, r100: 20, r6: 4, r3: 3, g10s: 6, g10m: 8, g30m: 10, fl: 3.4, cake: 1, water: 88, oil: 1, sol: 11, sand: 1, mbt: 12.5, ph: 11.5, cl: 70000, pf: 0.1, mf: 1.2, pm: 2, th: 200, ca: 160, kcl: 7 } },
    { id: uid(), time: d + 'T22:00', depth: 1222, place: 'FlowLine', src: 'rapor', v: { tout: 120, ttest: 115, mw: 75, fv: 55, r600: 61, r300: 40, r200: 31, r100: 20, r6: 4, r3: 3, g10s: 4, g10m: 9, fl: 4.3, cake: 1, water: 80, oil: 4, sand: 1.3, mbt: 13.75, ph: 10.5, cl: 75000, pf: 0.1, mf: 1, pm: 1.5, th: 240, ca: 200, kcl: 7 } }
  ];
  w.kuyu = { depth: 1226, bit: 1226, oh: 17.5,
    csg: [{ id: uid(), name: '20" yüzey', cid: 19, top: 0, shoe: 300 }, { id: uid(), name: '13 3/8" ara', cid: 12.715, top: 0, shoe: 800 }],
    ds: [{ id: uid(), name: 'DC 8"', od: 8, cid: 2.813, len: 118 }, { id: uid(), name: 'HWDP 4 1/2"', od: 4.5, cid: 2.813, len: 113 }, { id: uid(), name: 'DP 4 1/2"', od: 4.5, cid: 3.826, len: 995 }] };
  w.pump = { bps: '', liner: 6.5, stroke: 9, eff: 96, spm: [90, 90] };
  return w;
}
/* ekrandaki alan adları (cid) → hesap motoru (id) */
function kuyuIn(k) {
  return { depth: k.depth, bit: k.bit, oh: k.oh, csg: (k.csg || []).map(c => ({ name: c.name, id: c.cid, top: c.top, shoe: c.shoe })), ds: (k.ds || []).map(r => ({ name: r.name, od: r.od, id: r.cid, len: r.len })) };
}

/* ---------- TALLY OKUYUCU (Sondaj Hesap Cebi ile aynı) ---------- */
const RANGE = { ft: [25, 48], m: [7.6, 14.7] }, BROAD = { ft: [3, 50], m: [0.9, 15.3] };
const HDR_LEN = /(length|uzunluk|boy|len\b|lenght|feet|ft\b|metre|meter|\(m\)|\bm\b)/i, HDR_NO = /(^no\.?$|joint|jt|^#$|sıra|sira|numara)/i, SKIP_ROW = /(toplam|total|kümülatif|kumulatif|cumul|sum|ara toplam|subtotal)/i;
function cellNum(v) {
  if (typeof v === 'number') return { v, dec: !Number.isInteger(v) };
  if (v == null) return null;
  const s = String(v).trim().replace(/\s*(ft|m|')$/i, '');
  if (!/^-?\d{1,3}([.,]\d+)?$/.test(s)) return null;
  return { v: parseFloat(s.replace(',', '.')), dec: /[.,]/.test(s) };
}
function parseGrid(grid) {
  grid = grid.filter(r => r && r.some(c => c !== '' && c != null));
  if (!grid.length) return null;
  const nc = Math.max(...grid.map(r => r.length));
  let hdrRow = -1, lenHdrCols = new Set();
  for (let r = 0; r < Math.min(15, grid.length); r++) {
    const hits = Array.from(grid[r]).map((c, i) => typeof c === 'string' && c.trim().length <= 16 && HDR_LEN.test(c) && !HDR_NO.test(c) ? i : -1).filter(i => i >= 0);
    if (hits.length > lenHdrCols.size) { hdrRow = r; lenHdrCols = new Set(hits); }
  }
  const stats = [];
  for (let c = 0; c < nc; c++) {
    let numc = 0, inFt = 0, inM = 0, dec = 0, seq = 0, prev = null;
    grid.forEach((r, ri) => { if (ri <= hdrRow) return; const x = cellNum(r[c]); if (!x) return; numc++; if (x.dec) dec++;
      if (prev != null && !x.dec && x.v === prev + 1) seq++; prev = x.dec ? null : x.v;
      if (x.v >= RANGE.ft[0] && x.v <= RANGE.ft[1]) inFt++; if (x.v >= RANGE.m[0] && x.v <= RANGE.m[1]) inM++; });
    stats.push({ c, numc, inFt, inM, dec, seqCol: numc > 2 && seq / (numc - 1) > 0.6 });
  }
  const anyDec = stats.some(s => s.dec >= 3);
  const pick = (u, strict) => stats.filter(s => {
    const inR = u === 'ft' ? s.inFt : s.inM;
    if (s.seqCol) return false;
    if (inR < 3 || inR / s.numc < 0.6) return false;
    if (strict) return lenHdrCols.size ? lenHdrCols.has(s.c) : s.dec / s.numc >= 0.5;
    return !anyDec || s.dec / s.numc >= 0.3;
  });
  let best = null;
  for (const strict of [true, false]) {
    for (const u of ['ft', 'm']) { const cols = pick(u, strict); const score = cols.reduce((a, s) => a + (u === 'ft' ? s.inFt : s.inM), 0); if (cols.length && (!best || score > best.score)) best = { u, cols: cols.map(s => s.c), score }; }
    if (best) break;
  }
  if (!best) return null;
  const joints = [];
  best.cols.forEach(c => {
    grid.forEach((r, ri) => {
      if (ri <= hdrRow) return;
      if (Array.from(r).some(x => typeof x === 'string' && SKIP_ROW.test(x))) return;
      const x = cellNum(r[c]); if (!x) return;
      const [lo, hi] = BROAD[best.u]; if (x.v < lo || x.v > hi) return;
      joints.push(x.v);
    });
  });
  return { unit: best.u, joints, cols: best.cols.length };
}

/* ---------- GÜNLÜK RAPOR OKUYUCU (rapor .xls) ---------- */
function parseReport(XLSX, wb) {
  const shP = wb.Sheets.PROPERTY, shI = wb.Sheets.INVENTORY, shC = wb.Sheets['COST ANALYSIS'];
  if (!shP) return null;
  const cell = (sh, r, c) => { const x = sh && sh[XLSX.utils.encode_cell({ r, c })]; return x ? x.v : ''; };
  const P_ = (r, c) => cell(shP, r, c);
  const res = { tests: [], stock: [] };
  res.well = { name: String(P_(3, 12)).trim(), field: P_(3, 96), rig: P_(5, 67), op: P_(4, 12), depth: P_(8, 116), mudText: String(P_(31, 0)).trim() };
  const d = P_(4, 123);
  const dateStr = typeof d === 'number' ? new Date(Math.round((d - 25569) * 864e5)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const rng = s => { s = String(s).trim().replace(',', '.'); let m = s.match(/^<\s*([\d.]+)/); if (m) return { lo: null, hi: +m[1] }; m = s.replace(/,/g, '.').match(/^([\d.]+)\s*-\s*([\d.]+)/); return m ? { lo: +m[1], hi: +m[2] } : null; };
  res.spec = { mw: rng(P_(34, 0)), fv: rng(P_(34, 20)), ph: rng(P_(34, 40)), fl: rng(P_(34, 50)) };
  const MAP = { tout: 40, ttest: 41, mw: 42, fv: 43, g10s: 47, g10m: 48, g30m: 49, fl: 50, cake: 51, hpht: 52, hphtT: 53, water: 55, oil: 56, sol: 57, sand: 60, mbt: 61, ph: 62, cl: 63, pf: 64, mf: 65, pm: 66, th: 68, ca: 69, kcl: 71 };
  const RH = { r600: 80, r300: 90, r200: 100, r100: 110, r6: 120, r3: 130 };
  [26, 37, 48, 59].forEach((c, i) => {
    const mw = num(P_(42, c)); if (!ok(mw) || mw === 0) return;
    const v = {}; Object.entries(MAP).forEach(([k, r]) => { const x = num(P_(r, c)); if (ok(x)) v[k] = x; });
    Object.entries(RH).forEach(([k, col]) => { const x = num(P_(37 + i, col)); if (ok(x)) v[k] = x; });
    const tv = P_(38, c), mins = typeof tv === 'number' ? Math.round(tv * 1440) : 0;
    const time = `${dateStr}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    res.tests.push({ id: uid(), time, depth: num(P_(39, c)) || '', place: P_(37, c) || '', src: 'rapor', v });
  });
  for (let r = 8; r < 64; r++) {
    const name = String(cell(shI, r, 8)).trim(); if (!name) continue;
    res.stock.push({ name, desc: cell(shI, r, 30), unit: cell(shI, r, 55), qty: +cell(shI, r, 128) || 0, used: +cell(shI, r, 116) || 0, price: +cell(shC, r, 49) || 0 });
  }
  return res;
}

if (typeof module !== 'undefined') module.exports = { num, ok, TANKS, volAt, tankTotals, wellCalc, pumpCalc, linerBps, tripCalc, PROPS, PROP, derive, solids, devOf, specState, MUD_TYPES, seedWell, newWell, kuyuIn, parseUnit, mkItem, seedStock, mixCalc, RECIPES, WM, weightUp, weightWith, volWith, FLUID, dilute, blend, solidsDil, advise, parseGrid, parseReport, PCF };

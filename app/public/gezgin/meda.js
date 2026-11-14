/**
 * MEDA — Perseverance'ın gerçek hava ölçümleri (Jezero, Sol 105–110, Ls ≈ 55–57°).
 * Veri: assets/meda/meda_sols.json (NASA PDS Atmospheres · Mars 2020 MEDA DER ürünlerinden 10 dk medyanlar).
 * Saf fonksiyonlar Node'da test edilebilir; MedaPanel yalnızca tarayıcıda DOM kurar.
 */
import {t} from './dil.js';
import {rotorGucu,SABIT} from './sistemler.js';

export const MEDA_URL = 'assets/meda/meda_sols.json';
export const COMPOSITE = 'birlesik';
/** Oyun kuralları — Ingenuity'nin bildirilen çalışma zarfından esinlenmiş, sertifikalı sınırlar değildir. */
export const FLIGHT_RULES = Object.freeze({
  rhoNo: 0.0110, rhoMarginal: 0.0125,     // kg/m³ — altında rotor yeterli itki üretemez
  windNo: 10, windMarginal: 6,            // m/s, 10 dk medyan
  gustNo: 13, gustMarginal: 9,            // m/s, 10 dk %95 (ani rüzgâr)
  coldMarginal: -75,                      // °C — batarya ısıtma yükü
  rhoRef: 0.0170,                         // enerji çarpanı için referans yoğunluk (bu sol'lerin ortası)
});
const FALLBACK = {p: 765, t: -30, tg: 0, rh: 0.2, ws: 3, wmax: 5, wd: 120, rho: 0.0170, sza: 40};

export async function loadMeda(url = MEDA_URL) {
  try {
    const r = await fetch(url, {cache: 'no-cache'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (!d?.sols || !Object.keys(d.sols).length) throw new Error('empty data');
    return d;
  } catch (e) { console.warn('MEDA data could not be loaded:', e.message); return null; }
}

export function solKeys(data) {
  if (!data) return [];
  const ks = Object.keys(data.sols).sort((a, b) => Number(a) - Number(b));
  return data.composite?.bins ? [...ks, COMPOSITE] : ks;
}
export function binsFor(data, key) {
  if (!data) return null;
  return key === COMPOSITE ? data.composite?.bins || null : data.sols[key]?.bins || null;
}
export const lsFor = (data, key) => key === COMPOSITE ? data?.composite?.ls : data?.sols[key]?.ls;

/**
 * Günlük döngüde (24 saat, dairesel) dakika `minute` için değer.
 * Kutu merkezleri arasında doğrusal ara değer; `maxGap` dakikadan uzun boşlukta null.
 * @returns {{v:number|null, exact:boolean}}
 */
export function valueAt(arr, minute, binMin = 10, maxGap = 80, circular = false) {
  if (!arr?.length) return {v: null, exact: false};
  const n = arr.length, day = n * binMin;
  const m = ((minute % day) + day) % day;
  const i = Math.min(n - 1, Math.floor(m / binMin));
  const exact = arr[i] != null;
  const c = m / binMin - .5;                       // kutu merkezleri (k + .5)·binMin
  let L = null, R = null;
  for (let k = 0; k <= n; k++) { const j = Math.floor(c) - k; const jj = ((j % n) + n) % n; if (arr[jj] != null) { L = {pos: j, v: arr[jj]}; break; } }
  for (let k = 0; k <= n; k++) { const j = Math.floor(c) + 1 + k; const jj = ((j % n) + n) % n; if (arr[jj] != null) { R = {pos: j, v: arr[jj]}; break; } }
  if (!L && !R) return {v: null, exact: false};
  if (!L || !R) { const o = L || R; return {v: Math.abs(o.pos - c) * binMin <= binMin ? o.v : null, exact}; }
  const gap = (R.pos - L.pos) * binMin;
  if (gap > maxGap) {
    const o = (c - L.pos) <= (R.pos - c) ? L : R;
    return {v: Math.abs(o.pos - c) * binMin <= binMin ? o.v : null, exact};
  }
  const f = R.pos === L.pos ? 0 : (c - L.pos) / (R.pos - L.pos);
  if (circular) { const d = ((R.v - L.v + 540) % 360) - 180; return {v: (L.v + d * f + 360) % 360, exact}; }
  return {v: L.v + (R.v - L.v) * f, exact};
}

/** Bir an için tüm değişkenler. Seçili sol'de veri yoksa (boşluk) birleşik döngüye düşer. */
export function sample(data, key, minute) {
  const out = {minute, sol: key, fromComposite: [], missing: false};
  const bins = binsFor(data, key), comp = binsFor(data, COMPOSITE), bm = data?.binMinutes || 10;
  if (!bins) { Object.assign(out, FALLBACK); out.missing = true; return out; }
  for (const k of ['p', 't', 'tg', 'rh', 'vmr', 'ws', 'wmax', 'wd', 'lwd', 'lwu', 'sza', 'rho']) {
    let r = valueAt(bins[k], minute, bm, 80, k === 'wd');
    if (r.v == null && comp && bins !== comp) { r = valueAt(comp[k], minute, bm, 80, k === 'wd'); if (r.v != null) out.fromComposite.push(k); }
    out[k] = r.v ?? FALLBACK[k] ?? null;
  }
  return out;
}

/** Uçuş durumu ve enerji çarpanı. level: 'ok' | 'marginal' | 'no' */
export function flightStatus(s, rules = FLIGHT_RULES) {
  const reasons = []; let level = 'ok';
  const bump = (lv, why) => { reasons.push(why); if (lv === 'no' || level === 'ok') level = lv; };
  const rho = s.rho ?? rules.rhoRef, ws = s.ws ?? 0, gust = s.wmax ?? ws, tc = s.t ?? 0;
  if (rho < rules.rhoNo) bump('no', t('meda.r.seyrek', {r: rho.toFixed(4)}));
  else if (rho < rules.rhoMarginal) bump('marginal', t('meda.r.dusuk', {r: rho.toFixed(4)}));
  if (ws > rules.windNo) bump('no', t('meda.r.ruzgar', {v: ws.toFixed(1)}));
  else if (ws > rules.windMarginal) bump('marginal', t('meda.r.ruzgar', {v: ws.toFixed(1)}));
  if (gust > rules.gustNo) bump('no', t('meda.r.ani', {v: gust.toFixed(1)}));
  else if (gust > rules.gustMarginal) bump('marginal', t('meda.r.ani', {v: gust.toFixed(1)}));
  if (tc < rules.coldMarginal) bump('marginal', t('meda.r.soguk', {c: Math.round(tc)}));
  if ((s.sza ?? 0) > 90) bump('marginal', t('meda.r.gece'));
  const f = energyFactor(s, rules);
  return {level, reasons, factor: f.total, parts: f};
}

/** Askıda kalma gücü ∝ ρ^-½ (momentum teorisi) · rüzgâra karşı konum tutma · soğukta batarya ısıtma. */
export function energyFactor(s, rules = FLIGHT_RULES) {
  const rho = Math.max(.005, s.rho ?? rules.rhoRef), ws = Math.max(0, s.ws ?? 0), t = s.t ?? 0;
  const density = Math.sqrt(rules.rhoRef / rho);
  const wind = 1 + .015 * ws;
  const cold = t < -60 ? 1 + (-60 - t) * .004 : 1;
  const total = Math.min(1.4, Math.max(.8, density * wind * cold));
  return {density, wind, cold, total};
}

/** Askıda kalma gücü (W) — 1,8 kg helikopter. */
/* OsirisZK v3: oyunun rotor modeliyle aynı hesap (momentum teorisi, FM 0,27; Ingenuity ≈350 W kalibrasyonu). */
export const hoverPowerW = rho => rotorGucu({itkiN: 1.8 * SABIT.g, rho: Math.max(.005, rho), rotorCapM: 1.2});

/** Meteorolojik yön (esintinin GELDİĞİ yön, kuzeyden saat yönünde) → oyun düzleminde akış vektörü. Kuzey = −z, doğu = +x. */
export function windVector(ws, wdDeg) {
  if (!(ws > 0) || wdDeg == null) return [0, 0];
  const b = (wdDeg + 180) * Math.PI / 180;
  return [ws * Math.sin(b), -ws * Math.cos(b)];
}

/* ─────────────── Derin öğrenme tahmini (GRU, PyTorch ile çevrim dışı eğitildi; ağırlıklar assets/meda/meda_tahmin.json) ─────────────── */
export const FORECAST_URL = 'assets/meda/meda_tahmin.json';
export async function loadForecast(url = FORECAST_URL) {
  try { const r = await fetch(url, {cache: 'no-cache'}); if (!r.ok) throw new Error(`HTTP ${r.status}`); const d = await r.json(); if (!d?.models?.length) throw new Error('no model'); return d; }
  catch (e) { console.warn('MEDA forecast model could not be loaded:', e.message); return null; }
}
const sigm = x => 1 / (1 + Math.exp(-x));
/** PyTorch GRU (r, z, n kapıları) + doğrusal çıkış. seq: LOOK × kanal, c: günlük döngü girdisi. */
export function gruForward(m, seq, c) {
  const {W_ih, W_hh, b_ih, b_hh} = m.gru, hid = W_hh[0].length; let h = new Float64Array(hid);
  for (const x of seq) {
    const gi = W_ih.map((row, i) => row.reduce((s, w, j) => s + w * x[j], b_ih[i]));
    const gh = W_hh.map((row, i) => row.reduce((s, w, j) => s + w * h[j], b_hh[i]));
    const nh = new Float64Array(hid);
    for (let k = 0; k < hid; k++) { const r = sigm(gi[k] + gh[k]), z = sigm(gi[hid + k] + gh[hid + k]), n = Math.tanh(gi[2 * hid + k] + r * gh[2 * hid + k]); nh[k] = (1 - z) * n + z * h[k]; }
    h = nh;
  }
  const z = [...h, ...c];
  return m.head.W.map((row, i) => row.reduce((s, w, j) => s + w * z[j], m.head.b[i]));
}
const okAt = (S, m) => m >= 0 && m < 1440 && S.p[m] != null && S.t[m] != null && S.tg[m] != null && S.sza[m] != null;
/** m0'da biten LOOK dakikalık kesintisiz ölçüm var mı? */
export function windowOk(F, sol, m0) { const S = F?.series?.[sol], L = F?.config?.look || 20; if (!S) return false; for (let m = m0 - L + 1; m <= m0; m++) if (!okAt(S, m)) return false; return true; }
const futureOk = (F, sol, m0) => { const S = F.series[sol], H = F.config.horizon; for (let m = m0 + 1; m <= m0 + H; m++) if (m >= 1440 || S.t[m] == null || S.p[m] == null) return false; return true; };
/** İstenen dakikaya en yakın geçerli tahmin anı. Önce sonraki 15 dakikası da ölçülmüş (tahmin–ölçüm karşılaştırılabilir) anı arar. */
export function nearestForecastMinute(F, sol, minute, span = 180) {
  for (const strict of [true, false])
    for (let d = 0; d <= span; d++) for (const m of [minute - d, minute + d]) if (windowOk(F, sol, m) && (!strict || futureOk(F, sol, m))) return m;
  return null;
}
/** sol + dakika için 15 dk ileri tahmin; baseline'lar ve (varsa) gerçek ölçümle birlikte. */
export function forecastAt(F, sol, m0) {
  if (!F || !windowOk(F, sol, m0)) return null;
  const S = F.series[sol], L = F.config.look, H = F.config.horizon, {mu, sd, ysd} = F.norm;
  const last = [S.p[m0], S.t[m0], S.tg[m0]], seq = [];
  for (let m = m0 - L + 1; m <= m0; m++) {
    const f = [S.p[m] - last[0], S.t[m] - last[1], S.tg[m] - last[2], last[0], last[1], last[2], Math.cos(S.sza[m] * Math.PI / 180), Math.sin(2 * Math.PI * m / 1440), Math.cos(2 * Math.PI * m / 1440)];
    seq.push(f.map((v, j) => (v - mu[j]) / sd[j]));
  }
  const clim = [];
  for (let k = 0; k < H; k++) clim.push(F.clim.t[(m0 + 1 + k) % 1440] - F.clim.t[m0 % 1440]);
  for (let k = 0; k < H; k++) clim.push(F.clim.p[(m0 + 1 + k) % 1440] - F.clim.p[m0 % 1440]);
  const outs = F.models.map(m => gruForward(m, seq, clim.map((v, i) => v / ysd[i])));
  const d = outs[0].map((_, i) => outs.reduce((s, o) => s + o[i], 0) / outs.length * ysd[i]);
  const fut = k => m0 + 1 + k, act = (arr, k) => fut(k) < 1440 ? arr[fut(k)] ?? null : null;
  const split = F.config.split, role = split.train.includes(+sol) ? 'train' : split.val.includes(+sol) ? 'val' : split.test.includes(+sol) ? 'test' : 'other';
  return {sol, m0, H, L, role, delta: d,
    t: d.slice(0, H).map(v => last[1] + v), p: d.slice(H).map(v => last[0] + v),
    tDiurnal: clim.slice(0, H).map(v => last[1] + v), pDiurnal: clim.slice(H).map(v => last[0] + v),
    tNow: last[1], pNow: last[0],
    actualT: Array.from({length: H}, (_, k) => act(S.t, k)), actualP: Array.from({length: H}, (_, k) => act(S.p, k)),
    histT: Array.from({length: L}, (_, k) => S.t[m0 - L + 1 + k]), histP: Array.from({length: L}, (_, k) => S.p[m0 - L + 1 + k])};
}
export const meanOf = a => a.reduce((s, v) => s + v, 0) / a.length;

export const clockText = m => { const mm = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };
const COMPASS = () => t('meda.pusula').split(',');
export const compass = deg => deg == null ? '—' : COMPASS()[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

/* ───────────────────────────── Panel (tarayıcı) ───────────────────────────── */
const VARS_ = () => ({
  p:   {tab: t('meda.v.p'),    unit: 'Pa',    series: [{k: 'p', c: '#e4a76d', l: t('meda.s.p')}], fmt: v => v.toFixed(1)},
  t:   {tab: t('meda.v.t'),  unit: '°C',    series: [{k: 't', c: '#e4a76d', l: t('meda.s.t')}, {k: 'tg', c: '#77d0bf', l: t('meda.s.tg')}], fmt: v => v.toFixed(0)},
  rh:  {tab: t('meda.v.rh'),       unit: '%',     series: [{k: 'rh', c: '#9fc6e6', l: t('meda.s.rh')}], fmt: v => v.toFixed(v < 1 ? 2 : 1)},
  ws:  {tab: t('meda.v.ws'),    unit: 'm/s',   series: [{k: 'ws', c: '#e4a76d', l: t('meda.s.ws')}, {k: 'wmax', c: '#f0d7a8', l: t('meda.s.wmax'), dash: [4, 3]}], fmt: v => v.toFixed(1),
        lines: [{v: FLIGHT_RULES.gustMarginal, c: '#e0b25c', l: t('meda.l.marj')}, {v: FLIGHT_RULES.gustNo, c: '#e0715c', l: t('meda.l.yasak')}]},
  rho: {tab: t('meda.v.rho'),  unit: 'kg/m³', series: [{k: 'rho', c: '#77d0bf', l: t('meda.s.rho')}], fmt: v => v.toFixed(4), tick: v => v.toFixed(3), range: [0.010, 0.022],
        lines: [{v: FLIGHT_RULES.rhoMarginal, c: '#e0b25c', l: t('meda.l.marj')}, {v: FLIGHT_RULES.rhoNo, c: '#e0715c', l: t('meda.l.yasak')}]},
});
const VARS = new Proxy({}, {get: (_, k) => VARS_()[k], ownKeys: () => Reflect.ownKeys(VARS_()), getOwnPropertyDescriptor: (_, k) => ({enumerable: true, configurable: true, value: VARS_()[k]})});
const SPEEDS = [1, 10, 60];
/** Okunaklı eksen değerleri (1-2-5 adımları). */
export function niceTicks(lo, hi, n = 4) {
  const raw = (hi - lo) / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  let step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
  const make = st => { const o = []; for (let v = Math.ceil(lo / st) * st; v <= hi + st * 1e-9; v += st) o.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(10)); return o; };
  let out = make(step); if (out.length < 3) { step /= 2; out = make(step); }
  return out;
}
const FC_TAB = 'fc';
const ROLE_TXT = k => k === 'other' ? '' : t('meda.fc.rol.' + k);
const LEVEL_TXT = new Proxy({}, {get: (_, k) => t('meda.d.' + String(k))});

export class MedaPanel {
  constructor(data, {onChange = () => {}, minute = 660} = {}) {
    this.data = data; this.onChange = onChange;
    this.sol = data?.composite?.bins ? COMPOSITE : (solKeys(data)[0] || COMPOSITE);
    this.var = 't'; this.minute = minute; this.playing = false; this.speed = 0; this._acc = 0;
    this.cur = sample(data, this.sol, this.minute); this.status = flightStatus(this.cur);
  }
  mount(root) {
    this.root = root; const d = this.data;
    const q = s => root.querySelector(s);
    if (!d) { q('.meda-body').innerHTML = `<p class="meda-empty">${t('meda.yok')}</p>`; return this; }
    q('#medaSols').innerHTML = solKeys(d).map(k => `<button data-sol="${k}">${k === COMPOSITE ? t('meda.birlesik') : 'SOL ' + k}</button>`).join('');
    q('#medaVars').innerHTML = this.varButtons();
    q('#medaSols').addEventListener('click', e => { const b = e.target.closest('[data-sol]'); if (b) this.setSol(b.dataset.sol); });
    q('#medaVars').addEventListener('click', e => { const b = e.target.closest('[data-var]'); if (b) this.setVar(b.dataset.var); });
    this.slider = q('#medaTime'); this.slider.addEventListener('input', () => this.setMinute(Number(this.slider.value)));
    q('#medaPlay').addEventListener('click', () => this.togglePlay());
    q('#medaSpeed').addEventListener('click', () => { this.speed = (this.speed + 1) % SPEEDS.length; this.render(); });
    this.canvas = q('#medaChart');
    const pick = e => { if (this.var === FC_TAB) return; const r = this.canvas.getBoundingClientRect(), L = 36, Rm = 8; const f = (e.clientX - r.left - L) / (r.width - L - Rm); this.setMinute(Math.round(Math.min(1, Math.max(0, f)) * 1439)); };
    this.canvas.addEventListener('pointerdown', e => { this._drag = true; this.canvas.setPointerCapture(e.pointerId); pick(e); });
    this.canvas.addEventListener('pointermove', e => { if (this._drag) pick(e); });
    this.canvas.addEventListener('pointerup', () => this._drag = false);
    this.canvas.addEventListener('pointercancel', () => this._drag = false);
    const files = d.files || [];
    this.srcText = t('meda.kaynak', {n: files.length}); q('#medaSrc').textContent = this.srcText;
    q('#medaSrc').title = files.join('\n');
    this.render(); return this;
  }
  varButtons() { return Object.entries(VARS).map(([k, v]) => `<button data-var="${k}">${v.tab}</button>`).join('') + `<button data-var="${FC_TAB}" class="fc-tab" title="${t('meda.fc.ipucu')}"${this.F ? '' : ' hidden'}>${t('meda.fc.sekme')}</button>`; }
  /** Dil değiştiğinde düğme ve kaynak metinlerini yeniler. */
  relabel() {
    if (!this.root || !this.data) return;
    const q = s => this.root.querySelector(s);
    q('#medaSols').innerHTML = solKeys(this.data).map(k => `<button data-sol="${k}">${k === COMPOSITE ? t('meda.birlesik') : 'SOL ' + k}</button>`).join('');
    q('#medaVars').innerHTML = this.varButtons();
    this.srcText = t('meda.kaynak', {n: (this.data.files || []).length});
    this.status = flightStatus(this.cur); this.render();
  }
  update() { const prev = this.status?.level; this.cur = sample(this.data, this.sol, this.minute); this.status = flightStatus(this.cur); this.onChange(this.cur, this.status, prev); }
  setSol(k) { if (!binsFor(this.data, k)) return; this.sol = k; this.update(); this.render(); }
  setVar(v) { if (!VARS[v] && v !== FC_TAB) return; this.var = v; this.render(); }
  setForecast(F) { this.F = F; this._fcKey = null; const b = this.root?.querySelector(`[data-var="${FC_TAB}"]`); if (b) b.hidden = !F; if (!F && this.var === FC_TAB) this.var = 't'; this.render(); }
  /** Seçili sol ve saate göre tahmin. BİRLEŞİK'te o saati ölçen sol (105/106/107) kullanılır; ölçüm yoksa en yakın blok. */
  forecast() {
    const F = this.F; if (!F) return null;
    const key = `${this.sol}|${this.minute}`; if (this._fcKey === key) return this._fc;
    const sols = this.sol === COMPOSITE ? (this.data.composite?.sols || []).map(String) : [this.sol];
    let best = null;
    for (const s of sols) { const m = nearestForecastMinute(F, s, this.minute); if (m != null && (!best || Math.abs(m - this.minute) < Math.abs(best.m - this.minute))) best = {s, m}; }
    this._fcKey = key; this._fc = best ? forecastAt(F, best.s, best.m) : null; return this._fc;
  }
  setMinute(m) { this.minute = ((Math.round(m) % 1440) + 1440) % 1440; this.update(); this.render(); }
  togglePlay(force) { this.playing = force ?? !this.playing; this.render(); }
  /** Oyun döngüsünden çağrılır: oynatılıyorsa gerçek 1 sn = SPEEDS[speed] Mars dakikası. */
  tick(dt) { if (!this.playing) return; this._acc += dt * SPEEDS[this.speed]; if (this._acc >= 1) { const k = Math.floor(this._acc); this._acc -= k; this.minute = (this.minute + k) % 1440; this.update(); this._dirty = true; } }
  render() {
    if (!this.root || !this.data) return;
    const q = s => this.root.querySelector(s), c = this.cur, st = this.status;
    this.root.querySelectorAll('[data-sol]').forEach(b => b.classList.toggle('on', b.dataset.sol === this.sol));
    this.root.querySelectorAll('[data-var]').forEach(b => b.classList.toggle('on', b.dataset.var === this.var));
    if (document.activeElement !== this.slider) this.slider.value = String(this.minute);
    q('#medaClock').textContent = `${clockText(this.minute)} LMST`;
    q('#medaPlay').textContent = this.playing ? '❚❚' : '▶';
    q('#medaSpeed').textContent = `×${SPEEDS[this.speed]}`;
    const ls = lsFor(this.data, this.sol);
    q('#medaMeta').textContent = `${this.sol === COMPOSITE ? 'SOL ' + (this.data.composite.sols || []).join('+') : 'SOL ' + this.sol} · Ls ${ls?.toFixed(1)}°`;
    const approx = k => c.fromComposite.includes(k) ? `<i title="${t('meda.bosluk')}">*</i>` : '';
    const [wx, wz] = windVector(1, c.wd), ang = Math.atan2(wx, -wz) * 180 / Math.PI;
    const fcMode = this.var === FC_TAB && this.F, fc = fcMode ? this.forecast() : null;
    this.root.classList.toggle('fc-mode', !!fcMode);
    if (fcMode) {
      const M = this.F.metrics.test, mt = k => meanOf(M[k].t), mp = k => meanOf(M[k].p), H = this.F.config.horizon;
      const gainT = (1 - mt('gru') / mt('diurnal')) * 100, gainP = (1 - mp('gru') / mp('diurnal')) * 100;
      const aT = fc?.actualT[H - 1], aP = fc?.actualP[H - 1], fark = g => `<em title="${t('meda.fc.farkIpucu')}">${g >= 0 ? '−' : '+'}${Math.abs(g).toFixed(0)}%</em>`;
      q('#medaRead').innerHTML = (fc ? [
        [t('meda.fc.hava', {h: H}), `${fc.t[H - 1].toFixed(1)}<em>°C</em>`],
        [t('meda.fc.olculen'), aT == null ? '—' : `${aT.toFixed(1)}<em>°C</em>`],
        [t('meda.fc.basinc', {h: H}), `${fc.p[H - 1].toFixed(1)}<em>Pa</em>`],
        [t('meda.fc.olculen'), aP == null ? '—' : `${aP.toFixed(1)}<em>Pa</em>`],
      ] : [[t('meda.fc.tahmin'), t('meda.fc.olcumYok')], ['', ''], ['', ''], ['', '']]).concat([
        [t('meda.fc.hataHava'), `${mt('gru').toFixed(2)}<em>°C</em> ${fark(gainT)}`],
        [t('meda.fc.hataBasinc'), `${mp('gru').toFixed(2)}<em>Pa</em> ${fark(gainP)}`],
      ]).map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join('');
      const W = this.F.windows, S = this.F.config.split;
      q('#medaSrc').textContent = t('meda.fc.kaynak', {l: this.F.config.look, h: H, e: S.train.join(', '), d: S.val.join(', '), s: S.test.join(', '), we: W.train, wd: W.val, ws: W.test, n: this.F.models.length, pt: mt('persistence').toFixed(2), pp: mp('persistence').toFixed(2)});
    } else {
      q('#medaSrc').textContent = this.srcText;
    q('#medaRead').innerHTML = [
      [t('meda.o.p'), `${c.p.toFixed(1)}<em>Pa</em>${approx('p')}`],
      [t('meda.o.t'), `${c.t.toFixed(0)}<em>°C</em>${approx('t')}`],
      [t('meda.o.tg'), `${c.tg.toFixed(0)}<em>°C</em>${approx('tg')}`],
      [t('meda.o.rh'), `${c.rh.toFixed(c.rh < 1 ? 2 : 1)}<em>%</em>${approx('rh')}`],
      [`${t('meda.o.ws')}${c.wd == null ? '' : ' ' + t('meda.den', {y: compass(c.wd)})}`, `${c.ws.toFixed(1)}<em>m/s</em> <span class="warrow" style="transform:rotate(${ang.toFixed(0)}deg)" title="${t('meda.akis')}">↑</span>${approx('ws')}`],
      [t('meda.o.rho'), `${c.rho.toFixed(4)}<em>kg/m³</em>${approx('rho')}`],
    ].map(([l, v]) => `<div><small>${l}</small><b>${v}</b></div>`).join('');
    }
    const fl = q('#medaFlight'); fl.className = `meda-flight ${st.level}`;
    fl.innerHTML = `<b>${LEVEL_TXT[st.level]}</b><span>${st.reasons.length ? st.reasons.join(' · ') : t('meda.sinirIci')}</span><span class="meda-energy">${t('meda.aski', {w: Math.round(hoverPowerW(c.rho))})}</span>`;
    this.drawChart(); this._dirty = false;
  }
  drawChart() {
    const cv = this.canvas; if (!cv) return;
    if (this.var === FC_TAB && this.F) return this.drawForecast();
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(200, Math.round(cv.clientWidth * dpr)), H = Math.max(80, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = W / dpr, h = H / dpr, L = 36, R = 8, T = 6, B = 15, pw = w - L - R, ph = h - T - B;
    ctx.clearRect(0, 0, w, h);
    const V = VARS[this.var], bins = binsFor(this.data, this.sol), comp = binsFor(this.data, COMPOSITE), n = bins.p.length;
    const xOf = i => L + (i + .5) / n * pw;
    // gece gölgesi (güneş zenit açısı > 90°)
    const sza = comp?.sza || bins.sza; ctx.fillStyle = 'rgba(5,10,18,.55)';
    for (let i = 0; i < n; i++) { const z = sza[i] ?? bins.sza[i]; if (z != null && z > 90) ctx.fillRect(L + i / n * pw, T, pw / n + .6, ph); }
    // ölçek
    let lo = Infinity, hi = -Infinity;
    for (const s of V.series) for (const v of bins[s.k]) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (V.range) { lo = Math.min(lo, V.range[0]); hi = Math.max(hi, V.range[1]); }
    if (V.lines) for (const l of V.lines) hi = Math.max(hi, l.v * 1.08);
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * .06 || 1; lo -= pad; hi += pad + (hi - lo) * .12;   // üstte açıklama için pay
    const yOf = v => T + ph - (v - lo) / (hi - lo) * ph;
    ctx.font = '9px Consolas,monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const ticks = niceTicks(lo, hi, 4);
    for (const v of ticks) { const y = yOf(v); ctx.strokeStyle = '#223646'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke(); ctx.fillStyle = '#7f97a5'; ctx.fillText(V.tick ? V.tick(v) : V.fmt(v), L - 4, y); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let hr = 0; hr <= 24; hr += 3) { const x = L + hr / 24 * pw; ctx.fillStyle = '#7f97a5'; ctx.fillText(String(hr).padStart(2, '0'), x, T + ph + 3); }
    if (V.lines) for (const l of V.lines) { const y = yOf(l.v); if (y < T || y > T + ph) continue; ctx.strokeStyle = l.c; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = l.c; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(l.l, L + pw - 2, y - 1); }
    const line = (arr, col, width, dash, alpha = 1) => { ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); let on = false;
      for (let i = 0; i < n; i++) { const v = arr[i]; if (v == null) { on = false; continue; } const x = xOf(i), y = yOf(v); on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; };
    if (this.sol !== COMPOSITE && comp) line(comp[V.series[0].k], '#a3b3be', 1, [2, 2], .35);
    for (const s of V.series) line(bins[s.k], s.c, 1.7, s.dash);
    // imleç
    const x = L + this.minute / 1440 * pw; ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
    for (const s of V.series) { const v = this.cur[s.k]; if (v == null) continue; ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(x, yOf(v), 3.2, 0, Math.PI * 2); ctx.fill(); }
    // açıklama
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; let lx = L + 4;
    for (const s of V.series) { ctx.fillStyle = s.c; ctx.fillRect(lx, T + 4, 9, 2); ctx.fillStyle = '#c9d6dc'; ctx.fillText(`${s.l} (${V.unit})`, lx + 12, T); lx += ctx.measureText(`${s.l} (${V.unit})`).width + 24; }
    if (this.sol !== COMPOSITE && comp) { ctx.fillStyle = '#7f97a5'; ctx.fillText(t('meda.birlesikCizgi'), lx, T); }
  }
  drawForecast() {
    const cv = this.canvas, fc = this.forecast();
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(200, Math.round(cv.clientWidth * dpr)), Hh = Math.max(80, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = W / dpr, h = Hh / dpr, L = 40, R = 8, T = 14, B = 14, pw = w - L - R, gap = 8, ph = (h - T - B - gap) / 2;
    ctx.clearRect(0, 0, w, h); ctx.font = '9px Consolas,monospace';
    if (!fc) { ctx.fillStyle = '#a3b3be'; ctx.textAlign = 'center'; ctx.fillText(t('meda.fc.blokYok'), w / 2, h / 2); return; }
    const {L: LK, H, m0} = fc, n = LK + H, xOf = k => L + (k + .5) / n * pw;   // k: 0..LK-1 geçmiş, LK..n-1 gelecek
    const nowX = L + LK / n * pw;
    ctx.fillStyle = 'rgba(228,167,109,.06)'; ctx.fillRect(nowX, T, L + pw - nowX, h - T - B);
    const pane = (top, hist, act, pred, diu, unit, col, label, fmt) => {
      const all = [...hist, ...act.filter(v => v != null), ...pred, ...diu];
      let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * .15 || .5; lo -= pad; hi += pad;
      const yOf = v => top + ph - (v - lo) / (hi - lo) * ph;
      ctx.strokeStyle = '#223646'; ctx.lineWidth = 1; ctx.strokeRect(L, top, pw, ph);
      ctx.fillStyle = '#7f97a5'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(hi - pad * .5), L - 4, top + 6); ctx.fillText(fmt(lo + pad * .5), L - 4, top + ph - 6);
      const line = (pts, c, wd, dash) => { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.setLineDash(dash || []); ctx.beginPath(); let on = false; for (const [k, v] of pts) { if (v == null) { on = false; continue; } on ? ctx.lineTo(xOf(k), yOf(v)) : ctx.moveTo(xOf(k), yOf(v)); on = true; } ctx.stroke(); ctx.setLineDash([]); };
      const last = hist[LK - 1];
      line(hist.map((v, k) => [k, v]), col, 1.8);
      line([[LK - 1, last], ...act.map((v, k) => [LK + k, v])], '#c9d6dc', 1.4);
      line([[LK - 1, last], [n - 1, last]], '#7f97a5', 1, [1, 3]);
      line([[LK - 1, last], ...diu.map((v, k) => [LK + k, v])], '#9fb2bd', 1.1, [4, 3]);
      line([[LK - 1, last], ...pred.map((v, k) => [LK + k, v])], '#f2c14e', 2.2);
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(xOf(n - 1), yOf(pred[H - 1]), 3, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = col; ctx.fillText(`${label} (${unit})`, L + 4, top + 2);
    };
    pane(T, fc.histT, fc.actualT, fc.t, fc.tDiurnal, '°C', '#e4a76d', t('meda.fc.pHava'), v => v.toFixed(1));
    pane(T + ph + gap, fc.histP, fc.actualP, fc.p, fc.pDiurnal, 'Pa', '#77d0bf', t('meda.fc.pBasinc'), v => v.toFixed(1));
    ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(nowX, T - 2); ctx.lineTo(nowX, h - B); ctx.stroke();
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#c9d6dc';
    const role = ROLE_TXT(fc.role); ctx.fillStyle = fc.role === 'test' ? '#77d0bf' : fc.role === 'val' ? '#e7b95f' : '#a3b3be'; ctx.fillText(`SOL ${fc.sol}${role ? ' · ' + role : ''}`, L, h - B + 3); ctx.fillStyle = '#c9d6dc'; ctx.textAlign = 'center'; ctx.fillText(t('meda.fc.simdi', {s: clockText(m0)}), nowX, h - B + 3);
    ctx.textAlign = 'right'; ctx.fillText(t('meda.fc.ileri', {h: H, s: clockText(m0 + H)}), L + pw, h - B + 3);
    // açıklama + veri rolü
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; let lx = L; const item = (c, txt, dash) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(lx, 5); ctx.lineTo(lx + 10, 5); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#a3b3be'; ctx.fillText(txt, lx + 13, 0); lx += ctx.measureText(txt).width + 24; };
    item('#c9d6dc', t('meda.fc.l.olcum')); item('#f2c14e', t('meda.fc.l.gru')); item('#9fb2bd', t('meda.fc.l.gunluk'), [4, 3]); item('#7f97a5', t('meda.fc.l.kalicilik'), [1, 3]);
    if (Math.abs(m0 - this.minute) > 2) { ctx.textAlign = 'center'; ctx.fillStyle = '#e7b95f'; ctx.fillText(t('meda.fc.enYakin'), L + pw * .5, T + ph + 0.5); }
  }
}

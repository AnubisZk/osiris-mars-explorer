/**
 * DERİN ÖĞRENME & KUANTUM ML paneli.
 *  KAYA · MLP     — nn.js: tarayıcıda eğitilen sinir ağı (temsilî spektrumlar)
 *  KUANTUM · VQC  — quantum.js: aynı veri ve bölmeyle 4 kübitlik kuantum sınıflandırıcı (simülasyon)
 * OsirisZK v3.3: metinler dil.js (TR/EN); ZEMİN CNN sekmesi, onu besleyen rapor üretimi ml/ hattında olmadığı için alınmadı.
 * MLP ve VQC aynı yerleşimi paylaşır; yalnız mimari kutusu değişir (VQC'de devre şeması).
 */
import {ROCK_CLASSES, RockTrainer, targetSpectrum, TARGET_CLASS, BANDS, REF_SPECTRA, ARCH} from './nn.js';
import {QuantumTrainer, NQ, LAYERS, N_THETA} from './quantum.js';
import {t, aktifDil} from './dil.js';

const pct = v => aktifDil() === 'en' ? `${(v * 100).toFixed(1)}%` : `%${(v * 100).toFixed(1)}`;
const SINIF = {hematite: 'hematit', sediment: 'sediman', basalt: 'bazalt'};
const ad = key => t('sinif.' + SINIF[key]);
const MLP_PARAMS = ARCH.slice(1).reduce((s, n, i) => s + n * (ARCH[i] + 1), 0);
const NOTES = {rock: () => t('dl.not.rock'), quantum: () => t('dl.not.quantum', {n: NQ})};

export class DLPanel {
  constructor(root, {onLog = () => {}} = {}) {
    this.root = root; this.onLog = onLog; this.tab = 'rock';
    this.m = {rock: {trainer: null, seed: 2025, scans: []}, quantum: {trainer: null, seed: 2025, scans: []}};
    this.pending = [];
    const q = s => root.querySelector(s); this.q = q;
    q('#dlTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) this.setTab(b.dataset.tab); });
    q('#dlRetrain').addEventListener('click', () => this.tab === 'quantum' ? this.trainQuantum(this.m.quantum.seed + 1) : this.train(this.m.rock.seed + 1, {thenQuantum: false}));
  }
  get trainer() { return this.m.rock.trainer; }          // geriye uyumluluk (testler)
  get qtrainer() { return this.m.quantum.trainer; }
  get active() { return this.m[this.tab] || this.m.rock; }
  meta() {
    const tr = this.active.trainer;
    this.q('#dlMeta').textContent = !tr ? t('dl.sirada') : tr.done ? (this.tab === 'quantum' ? t('dl.meta.q') : t('dl.meta.mlp')) : t('dl.egitiliyor');
  }
  relabel() { this.q('#dlNote').textContent = NOTES[this.tab](); this.render(); }
  setTab(k) {
    if (!NOTES[k]) return;
    this.tab = k; this.root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === k));
    this.q('#dlNote').textContent = NOTES[k](); this.render();
  }
  /** MLP: epok epok; bitince kuantum sınıflandırıcı sırayla eğitilir. */
  train(seed = this.m.rock.seed, {thenQuantum = true} = {}) {
    const M = this.m.rock; M.seed = seed; const tr = M.trainer = new RockTrainer(seed); this.render();
    const go = () => { if (M.trainer !== tr) return; tr.step(); if (this.tab === 'rock') this.render(); if (!tr.done) { setTimeout(go, 16); return; }
      const s = tr.test; this.onLog(t('dl.l.mlp', {a: pct(s.accuracy), f: s.macroF1.toFixed(3), n: tr.data.test.y.length}), 'success');
      this.rescan('rock'); this.render(); if (thenQuantum && !this.m.quantum.trainer) this.trainQuantum(); };
    setTimeout(go, 30); return tr;
  }
  /** Kuantum eğitimi Web Worker'da (arka planda) yürür; desteklenmezse ana iş parçacığında küçük dilimlerle. */
  trainQuantum(seed = this.m.quantum.seed) {
    const M = this.m.quantum; M.seed = seed; M.worker?.terminate(); M.worker = null;
    const tr = M.trainer = new QuantumTrainer(seed); this.meta(); if (this.tab === 'quantum') this.render();
    const finish = () => { this.onLog(t('dl.l.vqc', {n: NQ, a: pct(tr.test.accuracy), s: tr.cfg.shots, b: pct(tr.testShots.accuracy)}), 'success'); this.rescan('quantum'); this.render(); };
    const fallback = () => { const go = () => { if (M.trainer !== tr) return; if (tr.tick(7) && this.tab === 'quantum') this.render(); if (!tr.done) setTimeout(go, 4); else finish(); }; setTimeout(go, 30); };
    let w;
    try { w = new Worker(new URL('./qworker.js', import.meta.url), {type: 'module'}); } catch (e) { fallback(); return tr; }
    M.worker = w;
    w.onmessage = e => {
      if (M.trainer !== tr) return; const d = e.data;
      if (d.type === 'epoch') { tr.history.push(d.h); tr.epoch = d.epoch; tr.best = d.best; if (this.tab === 'quantum') this.render(); }
      else if (d.type === 'done') { tr.model.restore(d.state); tr.best = {...d.best, state: d.state}; tr.test = d.test; tr.testShots = d.testShots; tr.model.evals = d.evals; tr.ms = d.ms; tr.done = true; w.terminate(); M.worker = null; finish(); }
    };
    w.onerror = ev => { ev.preventDefault?.(); w.terminate(); M.worker = null; if (M.trainer === tr && !tr.done) { tr.history = []; tr.epoch = 0; tr.best = null; fallback(); } };
    w.postMessage({seed}); return tr;
  }
  /** Bir kaya tarandığında çağrılır: eğitilmiş her iki model de sınıflandırır. */
  classifyTarget(index, label) {
    let res = null;
    for (const key of ['rock', 'quantum']) {
      const M = this.m[key], tr = M.trainer;
      if (!tr?.done) { if (!this.pending.some(p => p[0] === index && p[2] === key)) this.pending.push([index, label, key]); continue; }
      const r = this.classifyWith(key, index, label);
      this.onLog(t('dl.l.tahmin', {m: key === 'rock' ? 'MLP' : 'VQC', h: label, s: ad(r.pred), p: pct(Math.max(...r.p))}) + (r.correct ? '' : t('dl.l.uyusmuyor')), r.correct ? 'success' : 'warn');
      if (key === 'rock') res = r;
    }
    this.render(); return res;
  }
  classifyWith(key, index, label) {
    const M = this.m[key], truth = TARGET_CLASS[index], spec = targetSpectrum(index, truth), p = M.trainer.classify(spec), k = p.indexOf(Math.max(...p));
    const r = {index, label, truth, spec, p, pred: ROCK_CLASSES[k].key, correct: ROCK_CLASSES[k].key === truth};
    M.scans = [r, ...M.scans.filter(s => s.index !== index)]; return r;
  }
  rescan(key) {
    const todo = this.pending.filter(p => p[2] === key); this.pending = this.pending.filter(p => p[2] !== key);
    const M = this.m[key]; const old = M.scans; M.scans = [];
    [...old.map(s => [s.index, s.label]), ...todo].reverse().forEach(([i, l]) => this.classifyWith(key, i, l));
  }
  render() {
    const key = this.tab, M = this.active, tr = M.trainer, q = this.q, isQ = key === 'quantum';
    this.meta();
    q('#dlK1').textContent = t('dl.k.dogruluk'); q('#dlK2').textContent = isQ ? t('dl.k.olcum', {n: tr?.cfg.shots ?? 1024}) : t('dl.k.f1'); q('#dlK3').textContent = t('dl.k.epok');
    q('#dlArchText').hidden = isQ; q('#dlCircuit').hidden = !isQ;
    if (!tr) {
      q('#dlAcc').textContent = '…'; q('#dlF1').textContent = '…'; q('#dlEpoch').textContent = '—';
      q('#dlCm').innerHTML = ''; q('#dlLive').innerHTML = `<div class="dl-live-head">${t('dl.sirada')}</div><p>${t('dl.siradaAciklama')}</p>`;
      this.clearCanvas('#dlLoss'); if (isQ) this.drawCircuit(); this.drawSpectrum(null); return;
    }
    const T = tr.test;
    q('#dlAcc').textContent = T ? pct(T.accuracy) : '…';
    q('#dlF1').textContent = isQ ? (tr.testShots ? pct(tr.testShots.accuracy) : '…') : T ? T.macroF1.toFixed(3) : '…';
    q('#dlEpoch').textContent = `${tr.epoch}/${tr.cfg.epochs}`;
    const counts = t('dl.sayilar', {e: tr.data.train.y.length, d: tr.data.val.y.length, s: tr.data.test.y.length});
    if (isQ) {
      const mlp = this.m.rock.trainer?.test;
      q('#dlCounts').textContent = t('dl.qparam', {q: N_THETA, n: NQ}) + ' · ' + counts + (mlp && T ? ' · ' + t('dl.mlpKars', {a: pct(mlp.accuracy), p: MLP_PARAMS}) : '');
    } else q('#dlCounts').textContent = t('dl.param', {p: MLP_PARAMS}) + ' · ' + counts;
    const cm = T?.confusion, labels = ROCK_CLASSES.map(c => ad(c.key));
    q('#dlCm').innerHTML = `<table><tr><th class="corner">${t('dl.cm')}</th>${labels.map(l => `<th>${l.slice(0, 3).toUpperCase()}</th>`).join('')}<th>F1</th></tr>${labels.map((l, i) => {
      const row = cm ? cm[i] : [0, 0, 0], sum = row.reduce((a, b) => a + b, 0) || 1;
      return `<tr><th>${l}</th>${row.map((v, j) => `<td class="${i === j ? 'diag' : ''}" style="--a:${(v / sum).toFixed(3)}">${cm ? v : '·'}</td>`).join('')}<td class="f1">${T ? T.perClass[i].f1.toFixed(2) : '—'}</td></tr>`; }).join('')}</table>`;
    this.drawLoss(tr);
    const s = M.scans[0];
    q('#dlLive').innerHTML = s ? `<div class="dl-live-head">${t('dl.sonTarama')} · <b>${s.label}</b> <span class="${s.correct ? 'ok' : 'bad'}">${s.correct ? t('dl.dogru') : t('dl.yanlis')}</span></div>` +
      ROCK_CLASSES.map((c, i) => `<div class="dl-prob"><span>${ad(c.key)}</span><i><u style="width:${(s.p[i] * 100).toFixed(1)}%;background:${c.color}"></u></i><b>${pct(s.p[i])}</b></div>`).join('')
      : `<div class="dl-live-head">${t('dl.canli')}</div><p>${t(isQ ? 'dl.canliQ' : 'dl.canliMlp')}</p>`;
    if (isQ) this.drawCircuit();
    this.drawSpectrum(s);
  }
  canvas2d(sel) {
    const cv = this.q(sel); if (!cv || cv.hidden) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr); if (!W || !H) return null;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W / dpr, H / dpr); return {ctx, w: W / dpr, h: H / dpr};
  }
  clearCanvas(sel) { this.canvas2d(sel); }
  drawLoss(tr) {
    const c = this.canvas2d('#dlLoss'); if (!c) return; const {ctx, w, h} = c, L = 4, T = 13, B = 4, pw = w - L * 2, ph = h - T - B;
    ctx.strokeStyle = '#223646'; for (let k = 0; k <= 2; k++) { const y = T + ph * k / 2; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke(); }
    const hs = tr.history, E = tr.cfg.epochs, mx = Math.max(1.2, ...hs.map(h => h.loss));
    const plot = (f, col, sc) => { ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); hs.forEach((h, i) => { const x = L + (h.epoch - 1) / (E - 1) * pw, y = T + ph - f(h) / sc * ph; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    plot(h => h.loss, '#e4a76d', mx); plot(h => h.valLoss, '#e4a76d88', mx); plot(h => h.valAcc, '#77d0bf', 1);
    if (tr.best && tr.done) { const x = L + (tr.best.epoch - 1) / (E - 1) * pw; ctx.strokeStyle = '#f2efe855'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke(); ctx.setLineDash([]); }
    ctx.font = '9px Consolas,monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e4a76d'; const k1 = t('dl.c.kayip'), k2 = t('dl.c.dogAcc'); ctx.fillText(k1, L, 0); const x2 = L + ctx.measureText(k1).width + 10; ctx.fillStyle = '#77d0bf'; ctx.fillText(k2, x2, 0); ctx.fillStyle = '#7f97a5'; ctx.fillText(tr.done ? t('dl.c.enIyi', {e: tr.best.epoch}) : '', x2 + ctx.measureText(k2).width + 10, 0);
  }
  /** Bir katmanın devre şeması (×3): RY(x) kodlama → RY/RZ parametreleri → CNOT halkası → ⟨Z⟩ ölçümü. */
  drawCircuit() {
    const c = this.canvas2d('#dlCircuit'); if (!c) return; const {ctx, w, h} = c;
    const T = 9, B = 4, L = 18, R = 30, ys = Array.from({length: NQ}, (_, i) => T + (i + .5) * (h - T - B) / NQ), x0 = L, x1 = w - R;
    ctx.font = '8px Consolas,monospace'; ctx.textBaseline = 'middle';
    ys.forEach((y, i) => { ctx.strokeStyle = '#3a5163'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = '#7f97a5'; ctx.textAlign = 'left'; ctx.fillText(`q${i}`, 2, y); });
    const bw = Math.min(30, (x1 - x0) / 7.2), bh = Math.min(12, (h - T - B) / NQ - 3);
    const gate = (x, y, txt, fill, stroke) => { ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh); ctx.fillStyle = '#0e151b'; ctx.textAlign = 'center'; ctx.fillText(txt, x, y + .5); };
    const span = x1 - x0, gx = k => x0 + span * k;
    ys.forEach(y => { gate(gx(.10), y, 'RY(x)', '#77d0bf', '#a8e6d9'); gate(gx(.27), y, 'RY θ', '#e4a76d', '#f0c79c'); gate(gx(.43), y, 'RZ φ', '#e4a76d', '#f0c79c'); });
    for (let qi = 0; qi < NQ; qi++) {                                   // CNOT halkası
      const x = gx(.58 + qi * .085), yc = ys[qi], yt = ys[(qi + 1) % NQ];
      ctx.strokeStyle = '#c9d6dc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yc); ctx.lineTo(x, yt); ctx.stroke();
      ctx.fillStyle = '#c9d6dc'; ctx.beginPath(); ctx.arc(x, yc, 2.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x, yt, 4.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 4.5, yt); ctx.lineTo(x + 4.5, yt); ctx.moveTo(x, yt - 4.5); ctx.lineTo(x, yt + 4.5); ctx.stroke();
    }
    ctx.strokeStyle = '#5e7787'; ctx.setLineDash([2, 2]); ctx.strokeRect(gx(.03), T - 3, gx(.94) - gx(.03), h - T - B + 4); ctx.setLineDash([]);
    ctx.fillStyle = '#e4a76d'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t('dl.c.katman', {n: LAYERS}), gx(.03), 0);
    ctx.fillStyle = '#7f97a5'; ctx.textAlign = 'right'; ctx.fillText(t('dl.c.olcum'), w - 2, 0);
    ctx.textBaseline = 'middle';
    ys.slice(0, 3).forEach((y, i) => { ctx.fillStyle = '#f2c14e'; ctx.textAlign = 'left'; ctx.fillText(`⟨Z${i}⟩`, x1 + 3, y); });
  }
  drawSpectrum(s) {
    const c = this.canvas2d('#dlSpec'); if (!c) return; const {ctx, w, h} = c, L = 4, T = 12, B = 11, pw = w - L * 2, ph = h - T - B;
    const xOf = i => L + (BANDS[i] - 445) / (1012 - 445) * pw, yOf = v => T + ph - v / 0.36 * ph;
    ROCK_CLASSES.forEach(cl => { ctx.strokeStyle = cl.color; ctx.globalAlpha = .35; ctx.lineWidth = 1; ctx.beginPath(); REF_SPECTRA[cl.key].forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))); ctx.stroke(); });
    ctx.globalAlpha = 1;
    if (s) { ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 1.8; ctx.beginPath(); s.spec.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))); ctx.stroke(); s.spec.forEach((v, i) => { ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 2, 0, 7); ctx.fill(); }); }
    ctx.font = '9px Consolas,monospace'; ctx.fillStyle = '#7f97a5'; ctx.textBaseline = 'top'; ctx.fillText(s ? t('dl.c.spek') : t('dl.c.spekBos'), L, 0);
    ctx.textBaseline = 'bottom'; ctx.fillText('445', L, h); ctx.textAlign = 'right'; ctx.fillText('1012 nm', w - L, h); ctx.textAlign = 'left';
  }
  summary() {
    const scans = key => this.m[key].scans.map(s => ({target: s.label, truth: s.truth, predicted: s.pred, probabilities: Object.fromEntries(ROCK_CLASSES.map((c, i) => [c.key, +s.p[i].toFixed(4)]))}));
    return {rockClassifier: this.m.rock.trainer?.summary() || null, quantumClassifier: this.m.quantum.trainer?.summary() || null,
      scans: scans('rock'), quantumScans: scans('quantum')};
  }
}

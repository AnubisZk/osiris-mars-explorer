/**
 * Kuantum makine öğrenmesi — 4 kübitlik varyasyonel kuantum sınıflandırıcı (VQC), tarayıcıda simüle edilir.
 * Görev, MLP ile aynıdır: kaya türünü 8 bantlı (temsilî) spektrumdan bulmak; aynı eğitim / doğrulama / test bölmesi.
 *
 * Devre (3 katman, "veri yeniden yükleme"):  her katmanda  RY(xᵢ) kodlama → RY(θ) RZ(φ) → CNOT halkası
 * Ölçüm: q0, q1, q2'nin ⟨Z⟩ beklenen değerleri → a·⟨Z⟩ + b → softmax (3 sınıf). Hibrit kuantum–klasik model.
 * Gradyan: parameter-shift kuralı  ∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)] / 2 — gerçek kuantum donanımında
 * kullanılan yöntemin aynısı (her parametre için devre iki kez daha çalıştırılır).
 * Girdi: 8 öznitelik PCA ile 4 bileşene indirilir (kübit başına bir açı, 0…π).
 * Bu bir simülasyondur (16 karmaşık genlik); gerçek kuantum bilgisayar değildir ve bu boyutta kuantum avantajı beklenmez.
 */
import {makeDataset, features, ROCK_CLASSES, rng, TRAIN_CFG} from './nn.js';

export const NQ = 4, LAYERS = 3, N_THETA = LAYERS * NQ * 2, DIM = 1 << NQ;
export const Q_CFG = Object.freeze({epochs: 30, batch: 24, lr: 0.08, shots: 1024});

/* ── durum vektörü simülatörü (kübit q = indeksin q. biti) ── */
export function newState() { const re = new Float64Array(DIM), im = new Float64Array(DIM); re[0] = 1; return {re, im}; }
export function ry({re, im}, q, th) {
  const c = Math.cos(th / 2), s = Math.sin(th / 2), m = 1 << q;
  for (let i = 0; i < DIM; i++) if (!(i & m)) { const j = i | m, ar = re[i], ai = im[i], br = re[j], bi = im[j];
    re[i] = c * ar - s * br; im[i] = c * ai - s * bi; re[j] = s * ar + c * br; im[j] = s * ai + c * bi; }
}
export function rz({re, im}, q, th) {
  const c = Math.cos(th / 2), s = Math.sin(th / 2), m = 1 << q;
  for (let i = 0; i < DIM; i++) { const r = re[i], a = im[i];
    if (i & m) { re[i] = c * r - s * a; im[i] = c * a + s * r; } else { re[i] = c * r + s * a; im[i] = c * a - s * r; } }
}
export function cnot({re, im}, ctl, tgt) {
  const mc = 1 << ctl, mt = 1 << tgt;
  for (let i = 0; i < DIM; i++) if ((i & mc) && !(i & mt)) { const j = i | mt; let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
}
export const probs = ({re, im}) => Array.from(re, (r, i) => r * r + im[i] * im[i]);
export const expZ = (p, q) => p.reduce((s, v, i) => s + (i & (1 << q) ? -v : v), 0);

/** Devreyi çalıştır: x = 4 kodlama açısı, th = N_THETA parametre. Ölçüm olasılıklarını döndürür. */
export function circuit(x, th) {
  const st = newState();
  for (let l = 0; l < LAYERS; l++) {
    for (let q = 0; q < NQ; q++) ry(st, q, x[q]);
    for (let q = 0; q < NQ; q++) { ry(st, q, th[(l * NQ + q) * 2]); rz(st, q, th[(l * NQ + q) * 2 + 1]); }
    for (let q = 0; q < NQ; q++) cnot(st, q, (q + 1) % NQ);
  }
  return probs(st);
}
const zOut = p => [expZ(p, 0), expZ(p, 1), expZ(p, 2)];
function softmax(v) { const m = Math.max(...v), e = v.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); }

/** Sonlu ölçüm (shot) ile ⟨Z⟩ tahmini — gerçek donanımdaki istatistiksel gürültü. */
export function sampleZ(p, shots, r) {
  const cdf = []; let acc = 0; for (const v of p) cdf.push(acc += v);
  const cnt = new Array(DIM).fill(0);
  for (let s = 0; s < shots; s++) { const u = r() * acc; let k = 0; while (k < DIM - 1 && cdf[k] < u) k++; cnt[k]++; }
  return [0, 1, 2].map(q => cnt.reduce((a, c, i) => a + (i & (1 << q) ? -c : c), 0) / shots);
}

/* ── PCA (8 → 4), Jacobi özdeğer ayrışımı ── */
export function pca(X, k = NQ) {
  const n = X.length, d = X[0].length, mu = Array(d).fill(0);
  X.forEach(x => x.forEach((v, j) => mu[j] += v / n));
  const C = Array.from({length: d}, () => Array(d).fill(0));
  X.forEach(x => { for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] += (x[i] - mu[i]) * (x[j] - mu[j]) / (n - 1); });
  const A = C.map(r => r.slice()), V = Array.from({length: d}, (_, i) => Array.from({length: d}, (_, j) => +(i === j)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0; for (let i = 0; i < d; i++) for (let j = i + 1; j < d; j++) off += A[i][j] ** 2; if (off < 1e-14) break;
    for (let p = 0; p < d; p++) for (let q = p + 1; q < d; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let r = 0; r < d; r++) { const arp = A[r][p], arq = A[r][q]; A[r][p] = c * arp - s * arq; A[r][q] = s * arp + c * arq; }
      for (let r = 0; r < d; r++) { const apr = A[p][r], aqr = A[q][r]; A[p][r] = c * apr - s * aqr; A[q][r] = s * apr + c * aqr; }
      for (let r = 0; r < d; r++) { const vrp = V[r][p], vrq = V[r][q]; V[r][p] = c * vrp - s * vrq; V[r][q] = s * vrp + c * vrq; }
    }
  }
  const ev = A.map((r, i) => r[i]), order = ev.map((v, i) => i).sort((a, b) => ev[b] - ev[a]).slice(0, k);
  const comps = order.map(i => V.map(r => r[i])), total = ev.reduce((a, b) => a + Math.max(0, b), 0);
  const project = x => comps.map(c => c.reduce((s, w, j) => s + w * (x[j] - mu[j]), 0));
  const Z = X.map(project), zs = Array(k).fill(0);
  Z.forEach(z => z.forEach((v, j) => zs[j] += v * v / n));
  const sc = zs.map(v => Math.sqrt(v) || 1);
  // Tüm bileşenler 1. bileşenin ölçeğiyle ölçeklenir: küçük (gürültülü) bileşenler açıyı az oynatır.
  // Bileşen başına ayrı ölçeklemeye göre doğrulama doğruluğu %89 → %98 (doğrulama kümesiyle seçildi).
  const g = sc[0] / 1.5;
  return {mu, comps, scale: sc, explained: order.map(i => ev[i] / total), angles: x => project(x).map(v => Math.PI / (1 + Math.exp(-v / g)))};
}

export class VQC {
  constructor(seed = 11) { const r = rng(seed); this.th = Float64Array.from({length: N_THETA}, () => (r() - .5) * .2 * Math.PI); this.a = 2; this.b = [0, 0, 0];
    this.opt = {m: new Float64Array(N_THETA + 4), v: new Float64Array(N_THETA + 4), t: 0}; this.evals = 0; }
  get nParams() { return N_THETA + 4; }
  z(x, th = this.th) { this.evals++; return zOut(circuit(x, th)); }
  predictZ(z) { return softmax(z.map((v, k) => this.a * v + this.b[k])); }
  predict(x) { return this.predictZ(this.z(x)); }
  /** Parameter-shift gradyanlı Adam adımı. */
  trainBatch(X, Y, lr = Q_CFG.lr) {
    const g = new Float64Array(N_THETA + 4); let loss = 0; const sh = Math.PI / 2, th = Float64Array.from(this.th);
    for (let n = 0; n < X.length; n++) {
      const z = this.z(X[n]), p = this.predictZ(z); loss -= Math.log(Math.max(1e-12, p[Y[n]]));
      const dz = p.map((v, k) => this.a * (v - (k === Y[n] ? 1 : 0)));
      for (let k = 0; k < 3; k++) { g[N_THETA] += (p[k] - (k === Y[n] ? 1 : 0)) * z[k]; g[N_THETA + 1 + k] += p[k] - (k === Y[n] ? 1 : 0); }
      for (let j = 0; j < N_THETA; j++) {
        th[j] = this.th[j] + sh; const zp = this.z(X[n], th); th[j] = this.th[j] - sh; const zm = this.z(X[n], th); th[j] = this.th[j];
        g[j] += dz[0] * (zp[0] - zm[0]) / 2 + dz[1] * (zp[1] - zm[1]) / 2 + dz[2] * (zp[2] - zm[2]) / 2;
      }
    }
    const o = this.opt, b1 = .9, b2 = .999; o.t++;
    for (let i = 0; i < g.length; i++) {
      const gi = g[i] / X.length; o.m[i] = b1 * o.m[i] + (1 - b1) * gi; o.v[i] = b2 * o.v[i] + (1 - b2) * gi * gi;
      const step = lr * (o.m[i] / (1 - b1 ** o.t)) / (Math.sqrt(o.v[i] / (1 - b2 ** o.t)) + 1e-8);
      if (i < N_THETA) this.th[i] -= step; else if (i === N_THETA) this.a -= step; else this.b[i - N_THETA - 1] -= step;
    }
    return loss / X.length;
  }
  snapshot() { return {th: Float64Array.from(this.th), a: this.a, b: [...this.b]}; }
  restore(s) { this.th = Float64Array.from(s.th); this.a = s.a; this.b = [...s.b]; }
}

function metricsFrom(cm) {
  const k = cm.length, total = cm.flat().reduce((a, b) => a + b, 0), correct = cm.reduce((s, r, i) => s + r[i], 0);
  const perClass = cm.map((row, i) => { const tp = row[i], fn = row.reduce((a, b) => a + b, 0) - tp, fp = cm.reduce((a, r) => a + r[i], 0) - tp;
    const pr = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0; return {precision: pr, recall: rc, f1: pr + rc ? 2 * pr * rc / (pr + rc) : 0}; });
  return {accuracy: total ? correct / total : 0, macroF1: perClass.reduce((s, c) => s + c.f1, 0) / k, perClass, confusion: cm, n: total};
}
export function evaluateQ(model, A, y, {shots = 0, seed = 5} = {}) {
  const cm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = rng(seed); let loss = 0;
  A.forEach((x, n) => { const p0 = circuit(x, model.th); model.evals++; const z = shots ? sampleZ(p0, shots, r) : zOut(p0), p = model.predictZ(z);
    loss -= Math.log(Math.max(1e-12, p[y[n]])); cm[y[n]][p.indexOf(Math.max(...p))]++; });
  return {...metricsFrom(cm), loss: loss / A.length};
}

/** MLP ile aynı veri ve bölmeyle, epok epok eğitim. */
export class QuantumTrainer {
  constructor(seed = 2025, cfg = Q_CFG) {
    this.seed = seed; this.cfg = cfg; this.data = makeDataset(TRAIN_CFG.perClass, seed);
    this.pca = pca(this.data.train.X); const ang = d => d.X.map(this.pca.angles);
    this.A = {train: ang(this.data.train), val: ang(this.data.val), test: ang(this.data.test)};
    this.model = new VQC(seed + 7); this.r = rng(seed + 3); this.epoch = 0; this.history = []; this.best = null; this.test = null; this.testShots = null; this.done = false; this.ms = 0;
  }
  step() {
    if (this.done) return null; const t0 = performance.now();
    const y = this.data.train.y, idx = y.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let tot = 0, nb = 0;
    for (let s = 0; s < idx.length; s += this.cfg.batch) { const ids = idx.slice(s, s + this.cfg.batch); tot += this.model.trainBatch(ids.map(i => this.A.train[i]), ids.map(i => y[i]), this.cfg.lr); nb++; }
    this._finishEpoch(tot / nb); this.ms += performance.now() - t0; return this.history.at(-1);
  }
  /** Arayüz için: süre bütçesi (ms) dolana kadar mini-yığın işler; epok sonunda doğrulama, en sonda test. */
  tick(budgetMs = 8) {
    if (this.done) return false; const t0 = performance.now(), y = this.data.train.y;
    while (performance.now() - t0 < budgetMs && !this.done) {
      if (!this._perm) { this._perm = y.map((_, i) => i); for (let i = this._perm.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [this._perm[i], this._perm[j]] = [this._perm[j], this._perm[i]]; } this._pos = 0; this._tot = 0; this._nb = 0; }
      const ids = this._perm.slice(this._pos, this._pos + this.cfg.batch); this._pos += this.cfg.batch;
      this._tot += this.model.trainBatch(ids.map(i => this.A.train[i]), ids.map(i => y[i]), this.cfg.lr); this._nb++;
      if (this._pos >= this._perm.length) { this._finishEpoch(this._tot / this._nb); this._perm = null; return true; }
    }
    this.ms += performance.now() - t0; return false;
  }
  _finishEpoch(loss) {
    this.epoch++; const v = evaluateQ(this.model, this.A.val, this.data.val.y);
    this.history.push({epoch: this.epoch, loss, valLoss: v.loss, valAcc: v.accuracy});
    if (!this.best || v.loss < this.best.valLoss) this.best = {valLoss: v.loss, epoch: this.epoch, state: this.model.snapshot()};
    if (this.epoch >= this.cfg.epochs) {
      this.model.restore(this.best.state);
      this.test = evaluateQ(this.model, this.A.test, this.data.test.y);
      this.testShots = evaluateQ(this.model, this.A.test, this.data.test.y, {shots: this.cfg.shots, seed: this.seed + 9});
      this.done = true;
    }
  }
  run() { while (!this.done) this.step(); return this.test; }
  classify(spec) { const {mu, sd} = this.data.norm; return this.model.predict(this.pca.angles(features(spec).map((v, j) => (v - mu[j]) / sd[j]))); }
  summary() {
    return {model: `VQC ${NQ} kübit · ${LAYERS} katman (RY kodlama + RY/RZ + CNOT halkası) · ⟨Z⟩ ölçümü · parameter-shift + Adam`, simulated: true,
      params: {quantum: N_THETA, classical: 4}, pcaExplainedVariance: this.pca.explained.map(v => +v.toFixed(4)), circuitEvaluations: this.model.evals,
      epochs: this.epoch, bestEpoch: this.best?.epoch ?? null, labels: ROCK_CLASSES.map(c => c.key),
      test: this.test && {accuracy: +this.test.accuracy.toFixed(4), macroF1: +this.test.macroF1.toFixed(4), confusion: this.test.confusion},
      testWithShots: this.testShots && {shots: this.cfg.shots, accuracy: +this.testShots.accuracy.toFixed(4), macroF1: +this.testShots.macroF1.toFixed(4)}};
  }
}

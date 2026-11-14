/**
 * Tarayıcıda eğitilen küçük sinir ağı (MLP) — kaya türünü 8 bantlı yansıma spektrumundan sınıflandırır.
 * Eğitim verisi TEMSİLÎ (sentetik) spektrumlardır: hematit / sediman / bazalt için literatürdeki genel
 * spektral şekillerden üretilir, toz karışımı + parlaklık + eğim + gürültü eklenir. Gerçek Mastcam-Z ölçümü değildir.
 * Hiçbir sonuç elle yazılmaz: doğruluk, F1 ve karışıklık matrisi her açılışta bu dosyadaki eğitimle hesaplanır.
 * Zemin CNN sekmesi ise ml/ klasöründe gerçek veriyle eğitilen modelin raporunu (assets/ml/ml_reports.json) gösterir.
 */
export const BANDS = [445, 527, 600, 676, 751, 867, 937, 1012];   // nm (Mastcam-Z benzeri filtre merkezleri)
export const ROCK_CLASSES = [
  {key: 'hematite', tr: 'Hematit', color: '#e4a76d'},
  {key: 'sediment', tr: 'Sediman', color: '#d9c48f'},
  {key: 'basalt', tr: 'Bazalt', color: '#77d0bf'},
];
/** Temsilî bağıl yansıma şekilleri (0–1). Hematit: ~535 ve ~860 nm soğurma; sediman: parlak, kırmızı eğim;
 *  bazalt: koyu, ~950–1000 nm piroksen soğurması; toz: parlak oksitlenmiş Mars tozu. */
export const REF_SPECTRA = {
  hematite: [0.055, 0.070, 0.120, 0.165, 0.185, 0.150, 0.160, 0.190],
  sediment: [0.090, 0.130, 0.210, 0.255, 0.275, 0.285, 0.280, 0.272],
  basalt:   [0.070, 0.080, 0.090, 0.098, 0.102, 0.096, 0.088, 0.082],
};
export const DUST = [0.095, 0.150, 0.255, 0.315, 0.335, 0.345, 0.345, 0.343];
export const ARCH = [8, 16, 16, 3];
export const TRAIN_CFG = Object.freeze({perClass: 600, epochs: 40, batch: 32, lr: 0.01, split: [0.70, 0.15, 0.15]});

export function rng(seed) {                        // mulberry32 — tekrarlanabilir rastgelelik
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.gauss = () => { let u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return f;
}

/** Bir sınıftan rastgele spektrum. dust: toz oranı aralığı. */
export function synthSpectrum(cls, r, {dustMax = 0.5, noise = 0.015} = {}) {
  const ref = REF_SPECTRA[cls]; if (!ref) throw new RangeError('Bilinmeyen sınıf: ' + cls);
  const k = Math.exp(r.gauss() * 0.18), s = r.gauss() * 0.06, f = Math.pow(r(), 1.3) * dustMax;
  return ref.map((v, i) => {
    let x = v * (1 + r.gauss() * 0.035) * (1 + s * (BANDS[i] - 750) / 600);
    x = (1 - f) * x + f * DUST[i];
    return Math.max(0.004, x * k * (1 + r.gauss() * noise) + r.gauss() * 0.003);
  });
}
export const features = spec => spec.map(v => Math.log(Math.max(1e-4, v)));

export function makeDataset(perClass, seed) {
  const r = rng(seed), X = [], y = [];
  for (let c = 0; c < ROCK_CLASSES.length; c++) for (let n = 0; n < perClass; n++) { X.push(features(synthSpectrum(ROCK_CLASSES[c].key, r))); y.push(c); }
  // karıştır + sınıf dengeli bölme
  const idx = X.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const parts = {train: [], val: [], test: []}, seen = [0, 0, 0], [a, b] = TRAIN_CFG.split;
  for (const i of idx) { const c = y[i], q = seen[c]++ / perClass; (q < a ? parts.train : q < a + b ? parts.val : parts.test).push(i); }
  const pick = ids => ({X: ids.map(i => X[i]), y: ids.map(i => y[i])});
  const tr = pick(parts.train), mu = Array(8).fill(0), sd = Array(8).fill(0);
  for (const x of tr.X) x.forEach((v, j) => mu[j] += v / tr.X.length);
  for (const x of tr.X) x.forEach((v, j) => sd[j] += (v - mu[j]) ** 2 / tr.X.length);
  const norm = {mu, sd: sd.map(v => Math.sqrt(v) || 1)};
  const z = d => ({X: d.X.map(x => x.map((v, j) => (v - norm.mu[j]) / norm.sd[j])), y: d.y});
  return {train: z(tr), val: z(pick(parts.val)), test: z(pick(parts.test)), norm};
}

export class MLP {
  constructor(sizes = ARCH, seed = 1) {
    const r = rng(seed); this.sizes = sizes; this.W = []; this.b = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const nin = sizes[l], nout = sizes[l + 1], sc = Math.sqrt(2 / nin);
      this.W.push(Float64Array.from({length: nin * nout}, () => r.gauss() * sc)); this.b.push(new Float64Array(nout));
    }
    this.m = [...this.W, ...this.b].map(a => new Float64Array(a.length)); this.v = this.m.map(a => new Float64Array(a.length)); this.t = 0;
  }
  forward(x) {
    const acts = [Float64Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const nin = this.sizes[l], nout = this.sizes[l + 1], a = acts[l], W = this.W[l], z = new Float64Array(nout);
      for (let o = 0; o < nout; o++) { let s = this.b[l][o]; for (let i = 0; i < nin; i++) s += W[o * nin + i] * a[i]; z[o] = s; }
      if (l < this.W.length - 1) for (let o = 0; o < nout; o++) z[o] = Math.max(0, z[o]);
      else { const mx = Math.max(...z); let s = 0; for (let o = 0; o < nout; o++) { z[o] = Math.exp(z[o] - mx); s += z[o]; } for (let o = 0; o < nout; o++) z[o] /= s; }
      acts.push(z);
    }
    return acts;
  }
  predict(x) { return Array.from(this.forward(x).at(-1)); }
  /** Bir mini-yığın üzerinde Adam adımı; ortalama çapraz entropi kaybını döndürür. */
  trainBatch(X, Y, lr = TRAIN_CFG.lr) {
    const gW = this.W.map(w => new Float64Array(w.length)), gb = this.b.map(b => new Float64Array(b.length)); let loss = 0;
    for (let n = 0; n < X.length; n++) {
      const acts = this.forward(X[n]), p = acts.at(-1); loss -= Math.log(Math.max(1e-12, p[Y[n]]));
      let delta = Float64Array.from(p); delta[Y[n]] -= 1;
      for (let l = this.W.length - 1; l >= 0; l--) {
        const nin = this.sizes[l], nout = this.sizes[l + 1], a = acts[l], W = this.W[l];
        for (let o = 0; o < nout; o++) { gb[l][o] += delta[o]; for (let i = 0; i < nin; i++) gW[l][o * nin + i] += delta[o] * a[i]; }
        if (l > 0) { const prev = new Float64Array(nin); for (let i = 0; i < nin; i++) { let s = 0; for (let o = 0; o < nout; o++) s += W[o * nin + i] * delta[o]; prev[i] = a[i] > 0 ? s : 0; } delta = prev; }
      }
    }
    const params = [...this.W, ...this.b], grads = [...gW, ...gb], b1 = .9, b2 = .999, eps = 1e-8; this.t++;
    for (let k = 0; k < params.length; k++) {
      const P = params[k], G = grads[k], M = this.m[k], Vv = this.v[k];
      for (let i = 0; i < P.length; i++) {
        const g = G[i] / X.length; M[i] = b1 * M[i] + (1 - b1) * g; Vv[i] = b2 * Vv[i] + (1 - b2) * g * g;
        P[i] -= lr * (M[i] / (1 - b1 ** this.t)) / (Math.sqrt(Vv[i] / (1 - b2 ** this.t)) + eps);
      }
    }
    return loss / X.length;
  }
  snapshot() { return {W: this.W.map(a => Float64Array.from(a)), b: this.b.map(a => Float64Array.from(a))}; }
  restore(s) { this.W = s.W.map(a => Float64Array.from(a)); this.b = s.b.map(a => Float64Array.from(a)); }
}

export function evaluate(model, data, k = ROCK_CLASSES.length) {
  const cm = Array.from({length: k}, () => Array(k).fill(0)); let loss = 0;
  data.X.forEach((x, n) => { const p = model.predict(x); loss -= Math.log(Math.max(1e-12, p[data.y[n]])); cm[data.y[n]][p.indexOf(Math.max(...p))]++; });
  const total = data.y.length, correct = cm.reduce((s, row, i) => s + row[i], 0);
  const perClass = cm.map((row, i) => { const tp = row[i], fn = row.reduce((a, b) => a + b, 0) - tp, fp = cm.reduce((a, r) => a + r[i], 0) - tp;
    const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0; return {precision: prec, recall: rec, f1: prec + rec ? 2 * prec * rec / (prec + rec) : 0, support: tp + fn}; });
  return {accuracy: total ? correct / total : 0, macroF1: perClass.reduce((s, c) => s + c.f1, 0) / k, perClass, confusion: cm, loss: total ? loss / total : 0, n: total};
}

/** Adım adım (epok epok) eğitim — arayüz donmasın diye. */
export class RockTrainer {
  constructor(seed = 2025, cfg = TRAIN_CFG) {
    this.seed = seed; this.cfg = cfg; this.data = makeDataset(cfg.perClass, seed); this.model = new MLP(ARCH, seed + 1);
    this.r = rng(seed + 2); this.epoch = 0; this.history = []; this.best = null; this.test = null; this.done = false;
  }
  step() {
    if (this.done) return null;
    const {X, y} = this.data.train, idx = X.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let tot = 0, nb = 0;
    for (let s = 0; s < idx.length; s += this.cfg.batch) { const ids = idx.slice(s, s + this.cfg.batch); tot += this.model.trainBatch(ids.map(i => X[i]), ids.map(i => y[i]), this.cfg.lr); nb++; }
    this.epoch++; const v = evaluate(this.model, this.data.val);
    const h = {epoch: this.epoch, loss: tot / nb, valLoss: v.loss, valAcc: v.accuracy}; this.history.push(h);
    if (!this.best || v.loss < this.best.valLoss) this.best = {valLoss: v.loss, epoch: this.epoch, state: this.model.snapshot()};
    if (this.epoch >= this.cfg.epochs) { this.model.restore(this.best.state); this.test = evaluate(this.model, this.data.test); this.done = true; }
    return h;
  }
  run() { while (!this.done) this.step(); return this.test; }
  classify(spec) { const {mu, sd} = this.data.norm; return this.model.predict(features(spec).map((v, j) => (v - mu[j]) / sd[j])); }
  summary() {
    return {model: `MLP ${ARCH.join('-')} (ReLU, softmax, Adam lr ${this.cfg.lr})`, data: 'temsilî (sentetik) 8 bant yansıma spektrumları — gerçek Mastcam-Z ölçümü değil',
      seed: this.seed, samples: {train: this.data.train.y.length, val: this.data.val.y.length, test: this.data.test.y.length},
      epochs: this.epoch, bestEpoch: this.best?.epoch ?? null, labels: ROCK_CLASSES.map(c => c.key),
      test: this.test && {accuracy: +this.test.accuracy.toFixed(4), macroF1: +this.test.macroF1.toFixed(4), confusion: this.test.confusion,
        perClassF1: Object.fromEntries(this.test.perClass.map((c, i) => [ROCK_CLASSES[i].key, +c.f1.toFixed(4)]))}};
  }
}

/** Oyundaki bir hedef kayanın "ölçülen" spektrumu (hedef başına sabit tohum, yüzeyi biraz tozlu). */
export function targetSpectrum(index, cls) { return synthSpectrum(cls, rng(7100 + index * 131), {dustMax: 0.35, noise: 0.02}); }
export const TARGET_CLASS = ['hematite', 'sediment', 'basalt'];

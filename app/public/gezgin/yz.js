/* =============================================================================
 * YAPAY ZEKÂ KATMANI — tarayıcıda çalışır, harici kütüphane ve internet gerektirmez.
 *
 * 1) MAKİNE ÖĞRENMESİ — EnerjiModeli: Özyinelemeli en küçük kareler (RLS).
 *    Drone uçarken her adımda ölçülen gücü (W) uçuş koşullarından öğrenir. Fizik formülünü
 *    BİLMEZ; yalnızca telemetriden öğrenir. Otonom pilot, bir sonraki hedefe gidip gezgine dönmek
 *    için gereken enerjiyi bu modelle tahmin eder ve "devam mı, dönüş mü" kararını verir.
 *
 * 2) DERİN ÖĞRENME — SpektrumSiniflandirici: 8-16-16-3 çok katmanlı sinir ağı (ReLU, softmax),
 *    Adam ile tarayıcıda eğitilir. Girdi: 8 bantlı görünür/yakın kızılötesi yansıma spektrumu
 *    (Mastcam-Z benzeri filtre dalga boyları). Çıktı: hematit / tortul (sediman) / bazalt.
 *    ⚠ Prototip spektrumlar TEMSİLÎdir: ölçülmüş laboratuvar spektrumları değil, bu kayaçların
 *    bilinen biçim özelliklerini (hematitte ~860 nm soğurma, bazaltta koyu ve düşen yakın IR,
 *    tortulda daha parlak ve düz eğri) taklit eden öğretim verisidir.
 * ========================================================================== */

// ------------------------------------------------------------- tohumlu rastgele
export function rastgele(tohum = 1) {
  let a = tohum >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// ============================================================= 1) RLS enerji modeli
export class EnerjiModeli {
  constructor(lambda = 0.9995) {
    this.n = 6; this.lambda = lambda; this.w = new Array(this.n).fill(0); this.w[0] = 300;
    this.P = Array.from({ length: this.n }, (_, i) => Array.from({ length: this.n }, (_, j) => (i === j ? 1e4 : 0)));
    this.ornek = 0; this.hataOrt = null;
  }
  /** Özellikler: sabit, yatay hız², tırmanma, alçalma, yoğunluk etkisi, rüzgâr² */
  static ozellik({ yatayHiz, dikeyHiz, rho, ruzgar = 0 }) {
    return [1, (yatayHiz * yatayHiz) / 25, Math.max(0, dikeyHiz), Math.max(0, -dikeyHiz), Math.sqrt(0.016 / rho), (ruzgar / 10) ** 2];
  }
  tahmin(kosul) { const x = EnerjiModeli.ozellik(kosul); return x.reduce((s, v, i) => s + v * this.w[i], 0); }
  ogren(kosul, olculenW) {
    const x = EnerjiModeli.ozellik(kosul), P = this.P, n = this.n;
    const Px = P.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
    const payda = this.lambda + x.reduce((s, v, i) => s + v * Px[i], 0);
    const k = Px.map((v) => v / payda);
    const hata = olculenW - this.tahmin(kosul);
    this.w = this.w.map((v, i) => v + k[i] * hata);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i][j] = (P[i][j] - k[i] * Px[j]) / this.lambda;
    this.ornek++;
    const mutlak = Math.abs(hata) / Math.max(1, olculenW);
    this.hataOrt = this.hataOrt == null ? mutlak : this.hataOrt * 0.98 + mutlak * 0.02;
    return hata;
  }
  get hazir() { return this.ornek >= 120; }
  /** Bir uçuş bacağının enerjisi (Wh): yatay yol + irtifa değişimi */
  bacakEnerjisi({ mesafeM, irtifaDegisimM = 0, seyirHizi = 4, tirmanma = 1, rho, ruzgar = 0 }) {
    const tYatay = mesafeM / seyirHizi, tDikey = Math.abs(irtifaDegisimM) / tirmanma;
    const pYatay = this.tahmin({ yatayHiz: seyirHizi, dikeyHiz: 0, rho, ruzgar });
    const pDikey = this.tahmin({ yatayHiz: 0, dikeyHiz: irtifaDegisimM >= 0 ? tirmanma : -tirmanma, rho, ruzgar });
    return (pYatay * tYatay + pDikey * tDikey) / 3600;
  }
  durum() { return { w: [...this.w], P: this.P.map((r) => [...r]), ornek: this.ornek, hataOrt: this.hataOrt }; }
  yukle(d) { if (d?.w?.length === this.n) { this.w = d.w; this.P = d.P; this.ornek = d.ornek; this.hataOrt = d.hataOrt; } }
}

// ============================================================= 2) DL sınıflandırıcı
export const BANTLAR_NM = [445, 530, 600, 675, 750, 865, 935, 1010];
export const SINIFLAR = ['hematit', 'sediman', 'bazalt'];
// TEMSİLÎ prototip yansıma eğrileri (bkz. dosya başı)
const PROTOTIP = {
  hematit: [0.10, 0.13, 0.19, 0.24, 0.27, 0.22, 0.24, 0.27],
  sediman: [0.16, 0.20, 0.26, 0.30, 0.32, 0.32, 0.30, 0.29],
  bazalt:  [0.07, 0.08, 0.10, 0.11, 0.11, 0.10, 0.09, 0.085],
};
/** Gözlenen spektrum: albedo değişimi + ölçüm gürültüsü (gürültü uzaklık ve toza göre artar). */
export function spektrumUret(sinif, r, gurultu = 0.01) {
  const albedo = 0.75 + 0.5 * r(), egim = (r() - 0.5) * 0.04;
  // gürültü göreli (sinyal/gürültü oranı): uzaktan ve tozlu havada artar
  return PROTOTIP[sinif].map((v, i) => Math.max(0.002, v * albedo * (1 + egim * (i - 3.5)) * (1 + gauss(r) * gurultu)));
}
function girdi(spektrum) {
  const ort = spektrum.reduce((a, b) => a + b, 0) / spektrum.length;
  return spektrum.map((v) => v / ort - 1);   // biçim (eğri şekli), parlaklıktan bağımsız
}
export class SpektrumSiniflandirici {
  constructor(tohum = 42) {
    const r = rastgele(tohum), he = (n) => Math.sqrt(2 / n);
    const katman = (g, c) => ({ W: Array.from({ length: c }, () => Array.from({ length: g }, () => gauss(r) * he(g))), b: new Array(c).fill(0) });
    this.k = [katman(8, 16), katman(16, 16), katman(16, 3)];
    this.dogruluk = null;
  }
  ileri(x) {
    const ara = [x];
    this.k.forEach((L, li) => {
      const a = L.W.map((row, i) => row.reduce((s, w, j) => s + w * ara[li][j], L.b[i]));
      ara.push(li < this.k.length - 1 ? a.map((v) => Math.max(0, v)) : a);
    });
    const z = ara[ara.length - 1], m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
    return { olasilik: e.map((v) => v / s), ara };
  }
  /** Adam ile mini-yığın eğitimi */
  egit(veri, { epok = 80, oran = 0.01, yigin = 32, tohum = 7 } = {}) {
    const r = rastgele(tohum), b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const m = this.k.map((L) => ({ W: L.W.map((row) => row.map(() => 0)), b: L.b.map(() => 0) }));
    const v = this.k.map((L) => ({ W: L.W.map((row) => row.map(() => 0)), b: L.b.map(() => 0) }));
    let adim = 0;
    for (let e = 0; e < epok; e++) {
      const sira = veri.map((_, i) => i).sort(() => r() - 0.5);
      for (let s = 0; s < sira.length; s += yigin) {
        const g = this.k.map((L) => ({ W: L.W.map((row) => row.map(() => 0)), b: L.b.map(() => 0) }));
        const parca = sira.slice(s, s + yigin);
        for (const idx of parca) {
          const { x, y } = veri[idx], { olasilik, ara } = this.ileri(x);
          let d = olasilik.map((p, i) => p - (i === y ? 1 : 0));
          for (let li = this.k.length - 1; li >= 0; li--) {
            const L = this.k[li], giris = ara[li];
            d.forEach((di, i) => { g[li].b[i] += di; giris.forEach((gj, j) => { g[li].W[i][j] += di * gj; }); });
            if (li > 0) d = giris.map((gj, j) => (gj > 0 ? L.W.reduce((s2, row, i) => s2 + row[j] * d[i], 0) : 0));
          }
        }
        adim++;
        this.k.forEach((L, li) => {
          const guncelle = (deger, mm, vv, gg) => {
            const gr = gg / parca.length; mm = b1 * mm + (1 - b1) * gr; vv = b2 * vv + (1 - b2) * gr * gr;
            return [deger - oran * (mm / (1 - b1 ** adim)) / (Math.sqrt(vv / (1 - b2 ** adim)) + eps), mm, vv];
          };
          L.W.forEach((row, i) => row.forEach((w, j) => { [row[j], m[li].W[i][j], v[li].W[i][j]] = guncelle(w, m[li].W[i][j], v[li].W[i][j], g[li].W[i][j]); }));
          L.b.forEach((bb, i) => { [L.b[i], m[li].b[i], v[li].b[i]] = guncelle(bb, m[li].b[i], v[li].b[i], g[li].b[i]); });
        });
      }
    }
  }
  siniflandir(spektrum) {
    const { olasilik } = this.ileri(girdi(spektrum));
    const i = olasilik.indexOf(Math.max(...olasilik));
    return { sinif: SINIFLAR[i], guven: olasilik[i], olasilik };
  }
}
/** Eğitim + ayrı test kümesiyle doğruluk. Aynı tohumla her açılışta aynı model. */
export function siniflandiriciHazirla({ egitimSinifBasi = 250, testSinifBasi = 100, tohum = 2026 } = {}) {
  const r = rastgele(tohum);
  const kume = (n, gMin, gMax) => SINIFLAR.flatMap((s, y) => Array.from({ length: n }, () => ({ x: girdi(spektrumUret(s, r, gMin + (gMax - gMin) * r())), y })));
  const egitim = kume(egitimSinifBasi, 0.01, 0.12), test = kume(testSinifBasi, 0.01, 0.12);
  const model = new SpektrumSiniflandirici(tohum);
  model.egit(egitim);
  const dogru = test.filter(({ x, y }) => { const o = model.ileri(x).olasilik; return o.indexOf(Math.max(...o)) === y; }).length;
  model.dogruluk = dogru / test.length;
  return model;
}

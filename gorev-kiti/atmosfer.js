// ============================================================================
//  ATMOSFER — gerçek ölçümlerden öğrenilen "günlük döngü" modeli (dijital ikizin ilk katmanı)
//  Sorumlu rol: BİLİM DANIŞMANI + KODCU
//
//  Fikir: Bir gezegende hava basıncı, sıcaklık ve rüzgâr gün içinde tekrar eden bir
//  döngü izler (Güneş doğar, yer ısınır, hava hareketlenir...). Bu döngüyü birkaç sinüs
//  ve kosinüs eğrisinin toplamıyla yazabiliriz (Fourier serisi):
//
//     f(t) = a0 + a1·cos(2πt/24) + b1·sin(2πt/24) + a2·cos(4πt/24) + b2·sin(4πt/24) + ...
//
//  t = yerel güneş saati (0–24). a0, a1, b1... katsayılarını gerçek ölçümlere en iyi
//  uyacak şekilde "en küçük kareler" yöntemiyle buluruz: buna modeli EĞİTMEK diyoruz.
//  Eğitimi veri-atolyesi.html sayfası yapar ve sonucu bir JSON dosyası olarak verir.
//
//  Hava yoğunluğu ideal gaz yasasından gelir:   ρ = p ÷ (R × T)
//    p: basınç (Pa), T: sıcaklık (K), R: gazın özgül sabiti (gezegenler.js → gazSabiti_J_kgK)
// ============================================================================

const IKI_PI = 2 * Math.PI;

// Tasarım matrisinin bir satırı: [1, cos(ωt), sin(ωt), cos(2ωt), sin(2ωt), ...]
export function ozellikler(saat, harmonik) {
  const s = [1];
  for (let k = 1; k <= harmonik; k++) { const w = IKI_PI * k * saat / 24; s.push(Math.cos(w), Math.sin(w)); }
  return s;
}

// Doğrusal denklem sistemi (Gauss eleme, kısmi pivotlama): A·x = b
function coz(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Veri modeli kurmaya yetmiyor: günün daha fazla saatinden ölçüm gerekli.');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// En küçük kareler: (XᵀX)·k = Xᵀy  →  k = katsayılar
export function egit(saatler, degerler, harmonik = 2) {
  const n = 1 + 2 * harmonik, XtX = Array.from({ length: n }, () => Array(n).fill(0)), Xty = Array(n).fill(0);
  let say = 0;
  for (let i = 0; i < saatler.length; i++) {
    const y = degerler[i]; if (!Number.isFinite(y) || !Number.isFinite(saatler[i])) continue;
    const x = ozellikler(saatler[i], harmonik); say++;
    for (let a = 0; a < n; a++) { Xty[a] += x[a] * y; for (let b = 0; b < n; b++) XtX[a][b] += x[a] * x[b]; }
  }
  if (say < n * 3) throw new Error(`Çok az ölçüm var (${say}). En az ${n * 3} ölçüm gerekli.`);
  const k = coz(XtX, Xty);
  // Başarı ölçüleri: RMSE (ortalama hata) ve R² (verinin ne kadarını açıklıyor)
  let ss = 0, st = 0, ort = 0, m = 0;
  for (let i = 0; i < saatler.length; i++) if (Number.isFinite(degerler[i]) && Number.isFinite(saatler[i])) { ort += degerler[i]; m++; }
  ort /= m;
  for (let i = 0; i < saatler.length; i++) {
    if (!Number.isFinite(degerler[i]) || !Number.isFinite(saatler[i])) continue;
    const e = degerler[i] - hesapla(k, saatler[i]); ss += e * e; st += (degerler[i] - ort) ** 2;
  }
  return { k, rmse: Math.sqrt(ss / m), r2: st > 0 ? 1 - ss / st : 1, n: m };
}

// Modeli, eğitimde HİÇ GÖRMEDİĞİ ölçümlerde sınar (test). Gerçek doğruluk budur:
// eğitim verisindeki hata, modelin ezberini de ölçer; test verisindeki hata ise genelleme gücünü.
export function degerlendir(k, saatler, degerler) {
  let ss = 0, st = 0, ort = 0, m = 0;
  for (let i = 0; i < saatler.length; i++) if (Number.isFinite(degerler[i]) && Number.isFinite(saatler[i])) { ort += degerler[i]; m++; }
  if (!m) return { rmse: NaN, r2: NaN, n: 0 };
  ort /= m;
  for (let i = 0; i < saatler.length; i++) {
    if (!Number.isFinite(degerler[i]) || !Number.isFinite(saatler[i])) continue;
    const e = degerler[i] - hesapla(k, saatler[i]); ss += e * e; st += (degerler[i] - ort) ** 2;
  }
  return { rmse: Math.sqrt(ss / m), r2: st > 0 ? 1 - ss / st : NaN, n: m };
}

export function hesapla(k, saat) {
  const x = ozellikler(saat, (k.length - 1) / 2);
  return x.reduce((t, v, i) => t + v * k[i], 0);
}

// JSON modelden bir "ortam fonksiyonu" kurar: saat → {p, T, rho, ruzgar}
export function atmosferModeli(json, gazSabiti) {
  for (const a of ['basinc_Pa', 'sicaklik_K']) if (!json?.[a]?.k) throw new Error(`Atmosfer modelinde "${a}" eksik.`);
  const R = json.gazSabiti_J_kgK ?? gazSabiti;
  if (!(R > 0)) throw new Error('Gaz sabiti bilinmiyor (gezegenler.js → gazSabiti_J_kgK).');
  const f = (ad, saat) => (json[ad]?.k ? hesapla(json[ad].k, ((saat % 24) + 24) % 24) : 0);
  const model = saat => {
    const p = f('basinc_Pa', saat), T = f('sicaklik_K', saat);
    const dogu = f('ruzgarDogu_m_s', saat), kuzey = f('ruzgarKuzey_m_s', saat);
    return { saat, p, T, rho: p / (R * T), ruzgarDogu: dogu, ruzgarKuzey: kuzey, ruzgarHiz: Math.hypot(dogu, kuzey) };
  };
  model.bilgi = { ad: json.ad, kaynak: json.kaynak, gezegen: json.gezegen, olcumSayisi: json.olcumSayisi, hata: json.hata };
  return model;
}

// Görev bir atmosfer modeli kullanıyorsa yükleyip görev nesnesine bağlar.
// yukle: dosya yolunu alıp JSON döndüren fonksiyon (tarayıcıda fetch, Node'da fs).
export async function atmosferiBagla(gorev, yukle, gazSabiti) {
  if (!gorev.atmosfer?.model) return gorev;
  const json = await yukle(gorev.atmosfer.model);
  if (json.gezegen && json.gezegen !== gorev.gezegen) throw new Error(`Atmosfer modeli "${json.gezegen}" için, görev ise "${gorev.gezegen}" üzerinde.`);
  Object.defineProperty(gorev, '_atmosfer', { value: atmosferModeli(json, gazSabiti), enumerable: false, configurable: true });
  return gorev;
}

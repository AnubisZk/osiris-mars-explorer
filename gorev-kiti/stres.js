// ============================================================================
//  STRES TESTİ — bir tasarımı aşırı koşullarda yüzlerce kez uçurur (Monte Carlo)
//  Sorumlu rol: BİLİM DANIŞMANI
//
//  Gerçek gezegende hava hiçbir gün tahmin edildiği gibi değildir. Bu yüzden mühendisler
//  bir aracı tek bir uçuşla değil, "kötü günler" de dahil binlerce olası uçuşla dener.
//  Her denemede hava yoğunluğu, rüzgâr ve batarya biraz farklı seçilir; otopilot görevi
//  uçar ve sonuç sayılır. Başarı oranı ve güven aralığı tasarımın ne kadar sağlam olduğunu söyler.
//
//  Belirsizlik nereden geliyor? Görev gerçek veriden eğitilmiş bir atmosfer modeli kullanıyorsa
//  (dijital ikiz) modelin TEST hatası (RMSE) kullanılır: model ne kadar yanılıyorsa testte o kadar
//  sapma denenir. Model yoksa aşağıdaki VARSAYILAN değerler kullanılır.
// ============================================================================

import { otopilotlaUc, gorevArazisi } from './otopilot.js';
import { ortam } from './fizik.js';

export const VARSAYILAN = { yogunlukSapma: 0.05, ruzgarSapma_m_s: 1.5 };

export const SENARYOLAR = {
  normal:  { ad: 'Normal gün',            aciklama: 'Hava modeldeki gibi; yalnızca küçük rastgele sapmalar.' },
  ruzgarli:{ ad: 'Rüzgârlı gün',          aciklama: 'Ortalama rüzgâra 4–8 m/s eklenir; yön rastgele.' },
  toz:     { ad: 'Toz şeytanı',           aciklama: 'Uçuş sırasında bir hortum aracın yakınından geçer: ~20 s boyunca 10–15 m/s ani rüzgâr.' },
  soguk:   { ad: 'Soğuk sabah',           aciklama: 'Hava daha yoğun (+%8) ama soğuk batarya kapasitesinin %20\'sini kaybeder.' },
  ince:    { ad: 'Seyrek hava (öğleden sonra)', aciklama: 'Hava yoğunluğu %12 düşük: rotor daha az itki üretir.' },
};

// Tekrarlanabilir rastgele sayı (aynı tohum → aynı sonuç). Bilimde deneyin tekrarlanabilmesi önemlidir.
export function tohumluRastgele(tohum = 1) {
  let a = tohum >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }

// Wilson güven aralığı: "100 denemede 92 başarı" gerçekte ne kadar olabilir? (%95 güven)
export function wilson(basari, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = basari / n, z2 = z * z, m = (p + z2 / (2 * n)) / (1 + z2 / n);
  const y = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [Math.max(0, m - y), Math.min(1, m + y)];
}

// Modelin test hatasından belirsizliği çıkar (yoksa varsayılan)
// ρ = p/(R·T) olduğundan bağıl hata ≈ √((σp/p)² + (σT/T)²)
export function belirsizlik(gorev) {
  const h = gorev._atmosfer?.bilgi?.hata, test = ad => h?.[ad]?.test?.rmse;
  if (!h || !test('basinc_Pa') || !test('sicaklik_K')) return { ...VARSAYILAN, kaynak: 'varsayılan değerler (gerçek veri modeli ya da test sonucu yok)' };
  const a = gorev._atmosfer((gorev.atmosfer?.saat ?? 12));
  const ruz = Math.hypot(test('ruzgarDogu_m_s') ?? 0, test('ruzgarKuzey_m_s') ?? 0);
  return {
    yogunlukSapma: Math.hypot(test('basinc_Pa') / a.p, test('sicaklik_K') / a.T),
    ruzgarSapma_m_s: ruz || VARSAYILAN.ruzgarSapma_m_s,
    kaynak: 'atmosfer modelinin test hatası (dijital ikiz)',
  };
}

// Tek bir deneme için görevin "o günkü" kopyası
export function denemeGorevi(gorev, senaryo, r, b = belirsizlik(gorev)) {
  const g = { ...gorev, arac: { ...gorev.arac }, ruzgar: { ...(gorev.ruzgar ?? {}) } };
  let rhoCarpan = 1 + normal(r) * b.yogunlukSapma;
  if (senaryo === 'soguk') { rhoCarpan *= 1.08; if (g.arac.tip === 'rotor') g.arac.batarya_Wh *= 0.8; }
  if (senaryo === 'ince') rhoCarpan *= 0.88;
  rhoCarpan = Math.max(0.5, rhoCarpan);
  const temel = ortam(gorev);
  if (gorev._atmosfer) {
    const asil = gorev._atmosfer;
    Object.defineProperty(g, '_atmosfer', { value: s => { const a = asil(s); return { ...a, rho: a.rho * rhoCarpan }; }, enumerable: false });
  } else if (temel.rho0 > 0) g.havaYogunlugu_kg_m3 = temel.rho0 * rhoCarpan;

  // sürekli rüzgâr sapması + senaryoya göre ek rüzgâr
  const yon = r() * 2 * Math.PI, sapma = Math.abs(normal(r)) * b.ruzgarSapma_m_s;
  let ex = Math.sin(yon) * sapma, ez = -Math.cos(yon) * sapma;
  if (senaryo === 'ruzgarli') { const y2 = r() * 2 * Math.PI, h = 4 + 4 * r(); ex += Math.sin(y2) * h; ez -= Math.cos(y2) * h; }
  let hortum = null;
  if (senaryo === 'toz') hortum = { t0: 20 + r() * 120, sure: 20, hiz: 10 + 5 * r(), yon: r() * 2 * Math.PI };
  Object.defineProperty(g, '_ruzgarEk', { enumerable: false, value: t => {
    if (!hortum || t < hortum.t0 || t > hortum.t0 + hortum.sure) return { x: ex, z: ez };
    const f = Math.sin(Math.PI * (t - hortum.t0) / hortum.sure);           // yavaşça gelir, geçer
    const yy = hortum.yon + (t - hortum.t0) * 0.6;                           // dönen rüzgâr
    return { x: ex + Math.sin(yy) * hortum.hiz * f, z: ez - Math.cos(yy) * hortum.hiz * f };
  } });
  return g;
}

const NEDEN = { kaza: 'Sert iniş / kaza', enerji: 'Enerji ya da yakıt bitti', zaman: 'Zamanında bitiremedi' };

// N deneme. ilerleme(oran) arayüz için çağrılır; tarayıcıyı dondurmamak için parça parça çalışır.
export async function stresTesti(gorev, { n = 60, senaryolar = ['normal', 'ruzgarli', 'toz', 'soguk', 'ince'], tohum = 7, dt = 1 / 60, ilerleme, bekle = () => new Promise(c => setTimeout(c, 0)) } = {}) {
  const r = tohumluRastgele(tohum), zemin = gorevArazisi(gorev), b = belirsizlik(gorev);
  const sonuc = { belirsizlik: b, senaryolar: {}, toplam: { n: 0, basari: 0 }, nedenler: {} };
  let yapilan = 0; const hepsi = n * senaryolar.length;
  for (const s of senaryolar) {
    const sr = { n: 0, basari: 0, nedenler: {}, sureler: [], kalanlar: [] };
    for (let i = 0; i < n; i++) {
      const g = denemeGorevi(gorev, s, r, b);
      const d = otopilotlaUc(g, { dt, zemin });
      sr.n++;
      if (d.sonuc.tur === 'basari') {
        sr.basari++; sr.sureler.push(d.zaman);
        sr.kalanlar.push(g.arac.tip === 'roket' ? d.yakit_kg / g.arac.yakit_kg : d.enerji_Wh / g.arac.batarya_Wh);
      } else {
        const k = NEDEN[d.sonuc.tur] ?? d.sonuc.tur;
        sr.nedenler[k] = (sr.nedenler[k] ?? 0) + 1; sonuc.nedenler[k] = (sonuc.nedenler[k] ?? 0) + 1;
      }
      yapilan++;
      if (ilerleme && yapilan % 5 === 0) { ilerleme(yapilan / hepsi); await bekle(); }
    }
    sr.oran = sr.basari / sr.n; sr.aralik = wilson(sr.basari, sr.n);
    sr.enAzKalan = sr.kalanlar.length ? Math.min(...sr.kalanlar) : null;
    sonuc.senaryolar[s] = sr; sonuc.toplam.n += sr.n; sonuc.toplam.basari += sr.basari;
  }
  sonuc.toplam.oran = sonuc.toplam.basari / sonuc.toplam.n;
  sonuc.toplam.aralik = wilson(sonuc.toplam.basari, sonuc.toplam.n);
  ilerleme?.(1);
  return sonuc;
}

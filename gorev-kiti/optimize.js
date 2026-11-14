// ============================================================================
//  OPTİMİZASYON — "otonom mühendis": en hafif (en ucuz) uygun tasarımı arar
//  Sorumlu rol: KODCU + BİLİM DANIŞMANI
//
//  Yöntem: EVRİMSEL ARAMA (doğadaki seçilimden esinlenir)
//    1. Rastgele tasarımlardan bir "nüfus" oluştur (yapay zekânın önerisi de bunlara katılır).
//    2. Her tasarıma not ver: kütlesi + kuralları ihlal ettiği ölçüde ceza.
//    3. En iyileri seç, aralarında karıştır (çaprazlama) ve biraz değiştir (mutasyon).
//    4. Birçok nesil tekrarla. Sonunda en iyi tasarımlar kalır.
//  Sonra en iyi adaylar STRES TESTİ'nden geçer (stres.js). Hedef başarı oranı tutmazsa
//  güvenlik payı artırılıp arama tekrarlanır. Böylece:
//    yapay zekâ önerir → algoritma iyileştirir → simülasyon doğrular.
// ============================================================================

import { degerlendir } from './tasarim.js';
import { YAPI_MALZEMELERI, BATARYALAR, ROKET_MOTORLARI } from './malzemeler.js';
import { ortam } from './fizik.js';
import { tohumluRastgele, stresTesti } from './stres.js';

// Arama uzayı: her değişkenin alabileceği değerler
export const ARALIK = {
  rotor: {
    rotorSayisi: [2, 4],
    yaricap_m: [0.15, 1.2],
    ucHizi_m_s: [60, 240],
    batarya_Wh: [5, 400],
    bataryaTipi: Object.keys(BATARYALAR),
    yapiMalzemesi: Object.keys(YAPI_MALZEMELERI),
    kanatMalzemesi: ['karbon', 'cam', 'aluminyum'],
    maksEgim_derece: [10, 30],   // çok eğik araç rüzgârda yere değerken devrilir
  },
  roket: {
    yakit_kg: [0.2, 800],
    maksItki_N: [2, 20000],
    motorTipi: Object.keys(ROKET_MOTORLARI),
    yapiMalzemesi: Object.keys(YAPI_MALZEMELERI),
  },
};

// Havası olmayan yerde rotor çalışmaz: tip gezegene göre seçilir
export function uygunTip(gorev) { return ortam(gorev).rho0 > 0 ? 'rotor' : 'roket'; }

// Bir tasarımı aralığa sıkıştırır (yapay zekâ ya da öğrenci saçma bir sayı verirse düzeltir)
export function sinirla(tip, d) {
  const a = ARALIK[tip], o = { tip };
  for (const [k, v] of Object.entries(a)) {
    const x = d?.[k];
    if (typeof v[0] === 'number' && v.length === 2 && k !== 'rotorSayisi') o[k] = Number.isFinite(+x) ? Math.min(v[1], Math.max(v[0], +x)) : (v[0] + v[1]) / 2;
    else o[k] = v.includes(x) ? x : v.includes(+x) ? +x : v[0];
  }
  if (d?.renk) o.renk = d.renk;
  return o;
}

function rastgeleTasarim(tip, r) {
  const a = ARALIK[tip], o = { tip };
  for (const [k, v] of Object.entries(a)) o[k] = (typeof v[0] === 'number' && k !== 'rotorSayisi') ? v[0] * (v[1] / v[0]) ** r() : v[Math.floor(r() * v.length)];
  return o;   // sayılar logaritmik ölçekte seçilir: 5 Wh ile 400 Wh arası eşit şansla taranır
}

function cocuk(tip, a, b, r, oran) {
  const o = { tip };
  for (const [k, v] of Object.entries(ARALIK[tip])) {
    let x = r() < 0.5 ? a[k] : b[k];
    if (r() < oran) x = (typeof v[0] === 'number' && k !== 'rotorSayisi') ? x * Math.exp((r() - 0.5) * 0.6) : v[Math.floor(r() * v.length)];
    o[k] = x;
  }
  return sinirla(tip, o);
}

// Not (küçük = iyi): kütle × (1 + ceza). Ceza, her kuralın ne kadar aşıldığına göre büyür.
export function not(gereksinim, d) {
  let e;
  try { e = degerlendir(gereksinim, d); } catch { return { puan: Infinity, e: null }; }
  const o = e.ozet, h = e.hesap;
  let ceza = 0;
  ceza += Math.max(0, gereksinim.minItkiAgirlik - o.itkiAgirlikOrani) * 20;
  if (d.tip === 'rotor') ceza += Math.max(0, o.ucMach - gereksinim.maksMach) * 50;
  ceza += Math.max(0, (Number.isFinite(h.butceOrani) ? h.butceOrani : 99) - gereksinim.maksButce) * 20;
  if (!h.sureYeter) ceza += 5;
  if (Number.isFinite(o.ruzgarDayanimi)) ceza += Math.max(0, (gereksinim.minRuzgarDayanimi ?? 1.2) - o.ruzgarDayanimi) * 20;
  if (d.tip === 'rotor') ceza += Math.max(0, 1.2 / Math.cos(d.maksEgim_derece * Math.PI / 180) - o.itkiAgirlikOrani) * 20;
  if (d.tip === 'rotor' && BATARYALAR[d.bataryaTipi]?.deneysel) ceza += 0.02;   // deneysel teknoloji küçük bir risk payı
  return { puan: e.kutle_kg * (1 + ceza), e };
}

// Evrimsel arama. tohumlar: başlangıca eklenecek tasarımlar (ör. yapay zekânın önerisi)
export function optimizeEt(gereksinim, { tip = uygunTip(gereksinim.gorev), tohumlar = [], nufus = 40, nesil = 50, tohum = 3 } = {}) {
  const r = tohumluRastgele(tohum);
  let pop = [...tohumlar.map(t => sinirla(tip, t)), ...Array.from({ length: nufus }, () => rastgeleTasarim(tip, r))].slice(0, nufus)
    .map(d => ({ d, ...not(gereksinim, d) }));
  const gecmis = [];
  for (let n = 0; n < nesil; n++) {
    pop.sort((a, b) => a.puan - b.puan);
    gecmis.push({ nesil: n, enIyi: pop[0].puan, kutle: pop[0].e?.kutle_kg ?? null, uygun: !!pop[0].e?.uygun });
    const secilen = pop.slice(0, Math.ceil(nufus / 4));                 // en iyi dörtte bir hayatta kalır
    const yeni = secilen.slice();
    while (yeni.length < nufus) {
      const a = secilen[Math.floor(r() * secilen.length)].d, b = secilen[Math.floor(r() * secilen.length)].d;
      const d = cocuk(tip, a, b, r, 0.3);
      yeni.push({ d, ...not(gereksinim, d) });
    }
    pop = yeni;
  }
  pop.sort((a, b) => a.puan - b.puan);
  // birbirinin aynısı adayları ayıkla
  const adaylar = [];
  for (const p of pop) if (p.e?.uygun && !adaylar.some(q => Math.abs(q.e.kutle_kg - p.e.kutle_kg) < 1e-3)) adaylar.push(p);
  return { enIyi: pop[0], adaylar: adaylar.slice(0, 5), gecmis };
}

// Bütün döngü: optimize et → stres testi → tutmazsa güvenlik payını artır ve tekrarla
export async function otonomTasarim(gereksinim, { tohumlar = [], n = 30, turlar = 3, ilerleme, gunluk = () => {}, bekle } = {}) {
  let g = { ...gereksinim };
  const turKaydi = [];
  for (let tur = 1; tur <= turlar; tur++) {
    gunluk(`Tur ${tur}: evrimsel arama (bütçe sınırı %${Math.round(g.maksButce * 100)}, itki/ağırlık ≥ ${g.minItkiAgirlik})`);
    const o = optimizeEt(g, { tohumlar, tohum: 3 + tur });
    if (!o.adaylar.length) { gunluk('Kurallara uyan tasarım bulunamadı.'); turKaydi.push({ tur, g, o, stres: null }); break; }
    const aday = o.adaylar[0];
    gunluk(`En hafif uygun aday: ${aday.e.kutle_kg.toFixed(2)} kg → stres testi (${n} deneme × 5 senaryo)`);
    const stres = await stresTesti(aday.e.gorev, { n, ilerleme: x => ilerleme?.((tur - 1 + x) / turlar), bekle });
    const enKotu = Math.min(...Object.values(stres.senaryolar).map(s => s.oran));
    turKaydi.push({ tur, g, o, aday, stres, enKotu });
    gunluk(`Stres testi: toplam %${(stres.toplam.oran * 100).toFixed(0)}, en kötü senaryo %${(enKotu * 100).toFixed(0)} (hedef %${gereksinim.hedefBasari * 100})`);
    if (enKotu >= gereksinim.hedefBasari) { ilerleme?.(1); return { basarili: true, tasarim: aday, stres, turKaydi }; }
    tohumlar = [aday.d];
    // Güvenlik payını, başarısızlığın NEDENİNE göre artır (mühendisler de böyle yapar)
    const n2 = stres.nedenler, kaza = n2['Sert iniş / kaza'] ?? 0, enerji = (n2['Enerji ya da yakıt bitti'] ?? 0) + (n2['Zamanında bitiremedi'] ?? 0);
    if (kaza >= enerji) {
      g = { ...g, minItkiAgirlik: g.minItkiAgirlik + 0.3, minRuzgarDayanimi: (g.minRuzgarDayanimi ?? 1.2) + 0.4 };
      gunluk('Başarısızlıklar çoğunlukla kaza: itki ve rüzgâr dayanımı payı artırılıyor.');
    } else {
      g = { ...g, maksButce: Math.max(0.2, g.maksButce - 0.15) };
      gunluk('Başarısızlıklar çoğunlukla enerji/süre: enerji bütçesi payı artırılıyor.');
    }
  }
  ilerleme?.(1);
  const son = turKaydi.filter(t => t.stres).sort((a, b) => b.enKotu - a.enKotu)[0];
  return { basarili: false, tasarim: son?.aday ?? null, stres: son?.stres ?? null, turKaydi };
}

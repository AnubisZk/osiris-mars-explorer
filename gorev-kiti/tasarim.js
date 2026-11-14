// ============================================================================
//  TASARIM — tasarım kararlarından bir araç "kurar": kütle bütçesi, uçabilirlik, maliyet
//  Sorumlu rol: BİLİM DANIŞMANI + KODCU (Görev Fabrikası'nın kalbi)
//
//  TASARIM DÖNGÜSÜ: Araç ağırlaştıkça daha güçlü motor gerekir; güçlü motor daha ağırdır;
//  bu da aracı ağırlaştırır... Mühendisler bu yüzden kütleyi bir tahminle başlatır ve
//  hesap "oturana" kadar tekrarlar (yakınsama). Burada da öyle yapıyoruz.
//
//  ⚠ BASİTLEŞTİRİLMİŞ MODEL: Aşağıdaki katsayılar (KATSAYI) öğretim amaçlı varsayımlardır.
//  Ingenuity benzeri bir tasarımda toplam kütleyi gerçeğe yakın (~1,6–1,8 kg) verecek
//  şekilde seçildi. Gerçek bir tasarımda her parça ayrı ayrı mühendislik hesabı ister.
// ============================================================================

import { ortam, aracOzeti, maksItki, rotorGucu, G0 } from './fizik.js';
import { YAPI_MALZEMELERI, BATARYALAR, MOTORLAR, ROKET_MOTORLARI } from './malzemeler.js';
import { hesapla } from './hesap.js';

export const KATSAYI = {
  kanatDoluluk: 0.12,           // pervane kanatlarının diski kaplama oranı (σ)
  kanatKalinlik_m: 0.0006,      // kanadın eşdeğer (ortalama) kalınlığı
  yapiOraniKarbon: 0.25,        // karbon fiberle yapı kütlesi = %25 × (iç kütle)
  tankOrani: 0.15,              // yakıt tankı kütlesi = %15 × yakıt kütlesi
  suruklenmeTaban_m2: 0.03,     // gövdenin hava direnci (Cd·A) tabanı
};

const ozgulDayanim = m => m.cekme_MPa / m.yogunluk_kg_m3;

// Yapı kütlesi oranı: özgül dayanımı karbondan düşük malzeme daha çok kütle ister
export function yapiOrani(malzemeKimlik) {
  const m = YAPI_MALZEMELERI[malzemeKimlik] ?? YAPI_MALZEMELERI.karbon;
  return KATSAYI.yapiOraniKarbon * ozgulDayanim(YAPI_MALZEMELERI.karbon) / ozgulDayanim(m);
}

// Görev gereksinimleri: faydalı yük, aviyonik ve görev (hedefler, gezegen)
// Havasız yerde roket, inişte frenlemek için daha fazla itki payı ister (itki/ağırlık ≥ 2,5).
// Tasarım rüzgârı: görevin rüzgârı + 10 m/s (stres testindeki "rüzgârlı gün"ü karşılayacak pay).
export function varsayilanGereksinim(gorev) {
  const havasiz = !(ortam(gorev).rho0 > 0);
  return { gorev, tasarimRuzgari_m_s: (gorev.ruzgar?.hiz_m_s ?? 0) + 10, minRuzgarDayanimi: 1.2, yuk_kg: 0.3, aviyonik_kg: 0.25, aviyonikGucu_W: 20,
    hedefBasari: 0.9, minItkiAgirlik: havasiz ? 2.5 : 1.5, maksMach: 0.8, maksButce: 0.6 };
}

// ---------------------------------------------------------------- rotorlu araç
// d: { rotorSayisi: 2|4, yaricap_m, ucHizi_m_s, batarya_Wh, bataryaTipi, yapiMalzemesi, kanatMalzemesi, maksEgim_derece, renk }
export function rotorluArac(gereksinim, d) {
  const ort = ortam(gereksinim.gorev);
  const n = d.rotorSayisi === 4 ? 4 : 2, A = n * Math.PI * d.yaricap_m ** 2;
  const verim = ort.rho0 < 0.1 ? 0.2 : 0.5;            // seyrek havada rotor verimi düşer (Ingenuity ile ayarlandı)
  const bat = BATARYALAR[d.bataryaTipi] ?? BATARYALAR.liion, kanat = YAPI_MALZEMELERI[d.kanatMalzemesi] ?? YAPI_MALZEMELERI.karbon;
  const parcalar = {
    'Faydalı yük': gereksinim.yuk_kg,
    'Aviyonik (bilgisayar, sensörler)': gereksinim.aviyonik_kg,
    'Batarya': d.batarya_Wh / bat.ozgulEnerji_Wh_kg,
    'Pervaneler': n * KATSAYI.kanatDoluluk * Math.PI * d.yaricap_m ** 2 * KATSAYI.kanatKalinlik_m * kanat.yogunluk_kg_m3,
  };
  const arac = { tip: 'rotor', rotorAlani_m2: A, ucHizi_m_s: d.ucHizi_m_s, rotorVerimi: verim, avyonikGucu_W: gereksinim.aviyonikGucu_W, batarya_Wh: d.batarya_Wh };
  // tasarım döngüsü: motor gücü → motor kütlesi → toplam kütle → ...
  let m = 1, motor = 0, yapi = 0;
  const Tmax = maksItki(arac, ort.rho0);
  for (let i = 0; i < 40; i++) {
    const Ptepe = rotorGucu(arac, Tmax, ort.rho0, 0);                 // en büyük itkide çekilen güç
    motor = Ptepe / MOTORLAR.standart.gucYogunlugu_W_kg;
    const ic = parcalar['Faydalı yük'] + parcalar['Aviyonik (bilgisayar, sensörler)'] + parcalar['Batarya'] + motor;
    yapi = yapiOrani(d.yapiMalzemesi) * ic;
    const yeni = ic + yapi + parcalar['Pervaneler'];
    if (Math.abs(yeni - m) < 1e-9) { m = yeni; break; }
    m = yeni;
  }
  parcalar['Motorlar ve sürücüler'] = motor;
  parcalar[`Gövde (${(YAPI_MALZEMELERI[d.yapiMalzemesi] ?? YAPI_MALZEMELERI.karbon).ad})`] = yapi;
  Object.assign(arac, {
    ad: `Fabrika tasarımı: ${n === 2 ? 'eş eksenli' : 'dört rotorlu'} helikopter`, kutle_kg: m,
    suruklenmeAlani_m2: KATSAYI.suruklenmeTaban_m2 + 0.02 * d.yaricap_m ** 2,
    maksHiz_m_s: 10, maksEgim_derece: d.maksEgim_derece ?? 25, guvenliInis_m_s: 2, renk: d.renk ?? '#ffb347',
  });
  return { arac, parcalar, kutle_kg: m };
}

// ---------------------------------------------------------------- roketli araç
// d: { yakit_kg, maksItki_N, motorTipi, yapiMalzemesi, renk }
export function roketliArac(gereksinim, d) {
  const motorTip = ROKET_MOTORLARI[d.motorTipi] ?? ROKET_MOTORLARI.mono;
  const motor = d.maksItki_N / (motorTip.motorItkiAgirlik * G0), tank = KATSAYI.tankOrani * d.yakit_kg;
  const ic = gereksinim.yuk_kg + gereksinim.aviyonik_kg + motor + tank, yapi = yapiOrani(d.yapiMalzemesi) * ic;
  const kuru = ic + yapi;
  const parcalar = { 'Faydalı yük': gereksinim.yuk_kg, 'Aviyonik (bilgisayar, sensörler)': gereksinim.aviyonik_kg,
    [`Roket motoru (${motorTip.ad})`]: motor, 'Yakıt tankı': tank,
    [`Gövde (${(YAPI_MALZEMELERI[d.yapiMalzemesi] ?? YAPI_MALZEMELERI.karbon).ad})`]: yapi, 'Yakıt': d.yakit_kg };
  const arac = { tip: 'roket', ad: `Fabrika tasarımı: roketli iniş aracı (${motorTip.ad})`, kuruKutle_kg: kuru, yakit_kg: d.yakit_kg,
    maksItki_N: d.maksItki_N, isp_s: motorTip.isp_s, suruklenmeAlani_m2: 0, maksHiz_m_s: 10, maksEgim_derece: 45, guvenliInis_m_s: 2, renk: d.renk ?? '#e8e8e8' };
  return { arac, parcalar, kutle_kg: kuru + d.yakit_kg };
}

// Araç değerleri ayarlar.js'e yazılacağı için okunur basamağa yuvarlanır (4 anlamlı basamak)
const yuvarla = v => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(4) : v);
export function aracKur(gereksinim, d) {
  const k = d.tip === 'roket' ? roketliArac(gereksinim, d) : rotorluArac(gereksinim, d);
  // Hangi parça hangi malzemeden? (malzeme maliyeti için)
  k.parcaMalzemesi = {};
  for (const p of Object.keys(k.parcalar)) {
    if (p.startsWith('Gövde')) k.parcaMalzemesi[p] = YAPI_MALZEMELERI[d.yapiMalzemesi] ?? YAPI_MALZEMELERI.karbon;
    else if (p === 'Pervaneler') k.parcaMalzemesi[p] = YAPI_MALZEMELERI[d.kanatMalzemesi] ?? YAPI_MALZEMELERI.karbon;
    else if (p === 'Batarya') k.parcaMalzemesi[p] = BATARYALAR[d.bataryaTipi] ?? BATARYALAR.liion;
  }
  for (const a of Object.keys(k.arac)) k.arac[a] = yuvarla(k.arac[a]);
  k.kutle_kg = k.arac.tip === 'roket' ? k.arac.kuruKutle_kg + k.arac.yakit_kg : k.arac.kutle_kg;
  return k;
}

// ---------------------------------------------------------------- değerlendirme
// Tasarımı gereksinimlere göre değerlendirir (hızlı: simülasyon değil, hesap motoru)
export function degerlendir(gereksinim, d) {
  const kurulan = aracKur(gereksinim, d);
  const gorev = { ...gereksinim.gorev, arac: kurulan.arac };
  if (gereksinim.gorev._atmosfer) Object.defineProperty(gorev, '_atmosfer', { value: gereksinim.gorev._atmosfer, enumerable: false });
  const o = aracOzeti(gorev), h = hesapla(gorev);
  const sorunlar = [];
  if (o.itkiAgirlikOrani < gereksinim.minItkiAgirlik) sorunlar.push(`itki/ağırlık ${o.itkiAgirlikOrani.toFixed(2)} < ${gereksinim.minItkiAgirlik}`);
  if (kurulan.arac.tip === 'rotor' && o.ucMach > gereksinim.maksMach) sorunlar.push(`uç Mach ${o.ucMach.toFixed(2)} > ${gereksinim.maksMach}`);
  if (!(h.butceOrani <= gereksinim.maksButce)) sorunlar.push(`enerji/yakıt bütçesi %${(h.butceOrani * 100).toFixed(0)} > %${gereksinim.maksButce * 100}`);
  if (!h.sureYeter) sorunlar.push('süre sınırı yetmiyor');
  if (kurulan.arac.tip === 'rotor' && ortam(gorev).rho0 <= 0) sorunlar.push('havası olmayan yerde rotor çalışmaz');
  // Rüzgâra dayanım: araç eğilerek yatay kuvvet üretir (W·tanθ); bu, rüzgârın sürükleme kuvvetini yenmeli.
  // Eğilince dikey itki azalır, bu yüzden itki/ağırlık en az 1/cosθ olmalı (yukarıda kontrol ediliyor).
  const ort = ortam(gorev), a = kurulan.arac, v = gereksinim.tasarimRuzgari_m_s ?? 8;
  const egim = (a.maksEgim_derece ?? 25) * Math.PI / 180;
  const suruklenme = 0.5 * ort.rho0 * (a.suruklenmeAlani_m2 ?? 0) * v * v;
  o.ruzgarDayanimi = suruklenme > 0 ? o.agirlik_N * Math.tan(egim) / suruklenme : Infinity;
  if (o.ruzgarDayanimi < (gereksinim.minRuzgarDayanimi ?? 1.2)) sorunlar.push(`${v.toFixed(0)} m/s rüzgâra dayanım ${o.ruzgarDayanimi.toFixed(2)} < ${gereksinim.minRuzgarDayanimi ?? 1.2}`);
  if (a.tip === 'rotor' && o.itkiAgirlikOrani < 1.2 / Math.cos(egim)) sorunlar.push(`${(a.maksEgim_derece ?? 25).toFixed(0)}° eğilince itki yetmez (itki/ağırlık ≥ ${(1.2 / Math.cos(egim)).toFixed(2)} olmalı)`);
  // Soğuğa dayanım: malzeme günlüğünde bir alt sıcaklık sınırı yazılmışsa gezegenin en soğuk değeriyle karşılaştırılır
  const kullanilan = [d.yapiMalzemesi, d.kanatMalzemesi].filter(Boolean).map(k => YAPI_MALZEMELERI[k]).filter(Boolean);
  if (d.bataryaTipi && BATARYALAR[d.bataryaTipi]) kullanilan.push(BATARYALAR[d.bataryaTipi]);
  for (const m of new Set(kullanilan)) {
    if (m.enDusukSicaklik_C != null && ort.enDusukSicaklik_C != null && m.enDusukSicaklik_C > ort.enDusukSicaklik_C)
      sorunlar.push(`${m.ad} en fazla ${m.enDusukSicaklik_C} °C'ye dayanıyor, ${ort.ad} ${ort.enDusukSicaklik_C} °C'ye iniyor (malzeme günlüğü)`);
  }
  return { ...kurulan, gorev, ozet: o, hesap: h, sorunlar, uygun: sorunlar.length === 0 };
}

// Maliyet: yollama ücreti × kütle (usd_kg null ise yalnızca kütle raporlanır)
export function maliyet(kutle_kg, usd_kg) {
  return { kutle_kg, usd: usd_kg ? kutle_kg * usd_kg : null };
}

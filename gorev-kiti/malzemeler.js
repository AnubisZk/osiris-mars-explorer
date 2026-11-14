// ============================================================================
//  MALZEMELER — Görev Fabrikası'nın malzeme, batarya ve motor tabloları
//  Sorumlu rol: BİLİM DANIŞMANI
//
//  ⚠ Buradaki değerler TİPİK ve YAKLAŞIK değerlerdir (malzeme el kitapları, üretici
//  verileri). Aynı malzemenin türüne ve üretimine göre değerler değişir. Bilim danışmanı
//  her değeri bir kaynaktan (ör. MatWeb, üretici veri sayfası) kontrol etmeli ve
//  "kaynak" alanına yazmalıdır. Değeri değiştirirseniz nedenini YZ-GUNLUGU.md'ye yazın.
//
//  Bir yapı malzemesinin ne kadar iyi olduğunu "özgül dayanım" belirler:
//      özgül dayanım = çekme dayanımı ÷ yoğunluk
//  Aynı yükü taşımak için gereken malzeme kütlesi özgül dayanımla ters orantılıdır.
// ============================================================================

export const YAPI_MALZEMELERI = {
  karbon: { ad: 'Karbon fiber kompozit', yogunluk_kg_m3: 1550, cekme_MPa: 600, renk: '#2b2b2b',
    not: 'Hafif ve dayanıklı; Ingenuity\'nin pervaneleri karbon fiberdi. Yarı-izotropik katman için tipik değer.', kaynak: 'tipik el kitabı değeri (doğrulayın)' },
  aluminyum: { ad: 'Alüminyum 7075-T6', yogunluk_kg_m3: 2810, cekme_MPa: 572, renk: '#c9ccd1',
    not: 'Havacılıkta çok kullanılan alaşım; işlemesi kolay.', kaynak: 'tipik el kitabı değeri (doğrulayın)' },
  titanyum: { ad: 'Titanyum Ti-6Al-4V', yogunluk_kg_m3: 4430, cekme_MPa: 950, renk: '#9aa4ad',
    not: 'Çok dayanıklı ama ağır ve pahalı; sıcaklık değişimlerine dayanıklı.', kaynak: 'tipik el kitabı değeri (doğrulayın)' },
  cam: { ad: 'Cam elyafı kompozit', yogunluk_kg_m3: 1900, cekme_MPa: 300, renk: '#e8e4d0',
    not: 'Karbondan ucuz, ama daha ağır ve daha az dayanıklı.', kaynak: 'tipik el kitabı değeri (doğrulayın)' },
  pla: { ad: '3B yazıcı PLA', yogunluk_kg_m3: 1240, cekme_MPa: 50, renk: '#f2a65a',
    not: 'Okulda basılabilir! Ama zayıf ve soğukta kırılganlaşır: Mars gecesine (−80 °C) uygun değildir.', kaynak: 'tipik üretici değeri (doğrulayın)', soguktaKirilgan: true },
};

// Batarya paketi: özgül enerji (Wh/kg) paketin tamamı için (hücre + kutu + bağlantılar)
export const BATARYALAR = {
  liion: { ad: 'Li-iyon paket', ozgulEnerji_Wh_kg: 150, not: 'Uzay görevlerinde yaygın. Soğukta kapasite düşer, ısıtma gerekir.', kaynak: 'tipik paket değeri (doğrulayın)' },
  lipo: { ad: 'Li-polimer (drone) paketi', ozgulEnerji_Wh_kg: 180, not: 'Dünya dronlarında yaygın; yüksek akım verir.', kaynak: 'tipik paket değeri (doğrulayın)' },
  lis: { ad: 'Li-kükürt (deneysel)', ozgulEnerji_Wh_kg: 300, not: 'Gelecek vadeden ama henüz deneysel bir teknoloji: ömrü kısa.', kaynak: 'araştırma aşaması, tahmini (doğrulayın)', deneysel: true },
};

// Elektrik motoru + sürücü: güç yoğunluğu (W/kg)
export const MOTORLAR = {
  standart: { ad: 'Fırçasız motor + sürücü', gucYogunlugu_W_kg: 2000, kaynak: 'tipik değer (doğrulayın)' },
};

// Roket motorları: özgül itki (Isp) ve motorun kendi itki/ağırlık oranı
export const ROKET_MOTORLARI = {
  mono: { ad: 'Tek yakıtlı (hidrazin)', isp_s: 220, motorItkiAgirlik: 15, not: 'Basit ve güvenilir; iniş araçlarında yaygın.', kaynak: 'tipik değer (doğrulayın)' },
  bi: { ad: 'Çift yakıtlı (MMH/NTO)', isp_s: 310, motorItkiAgirlik: 20, not: 'Daha verimli ama daha karmaşık.', kaynak: 'tipik değer (doğrulayın)' },
};

// Yollama (fırlatma + yolculuk + iniş) maliyeti için kaynaklı örnek değerler.
// Bu tahminler birbirinden çok farklıdır: bu da gerçek dünyanın bir dersidir!
export const YOLLAMA_FIYATLARI = {
  marsYakini: { ad: 'Mars yakınına kadar, kaba hesap', usd_kg: 34000,
    kaynak: 'SpaceRef, "zarf arkası" hesap: alçak Dünya yörüngesi 10.000 $/kg varsayımıyla; yörüngeye girme ve iniş HARİÇ' },
  aYuzeyi: { ad: 'Ay yüzeyine (karşılaştırma için)', usd_kg: 1200000,
    kaynak: 'SpaceInsider, Philip Swan analizi: Ay yüzeyine kg başına yaklaşık 1,2 milyon $' },
  kendi: { ad: 'Kendi bulduğunuz değer', usd_kg: null, kaynak: 'Takımın bulduğu kaynak (yazın)' },
};
export const INGENUITY_YAPIM_USD = 80e6;   // Ingenuity'nin yapım maliyeti (Planetary Society): kıyas için

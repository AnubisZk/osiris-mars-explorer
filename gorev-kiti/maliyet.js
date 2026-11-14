// ============================================================================
//  MALİYET — gerçek görevlerden alınmış sayılarla gerçekçi görev maliyeti
//  Sorumlu rol: MALZEME MÜHENDİSİ + BİLİM DANIŞMANI
//
//  Bir uzay aracının maliyeti yalnızca "kg × fırlatma fiyatı" değildir. Gerçekte dört kalem vardır:
//    1. Malzeme   : aracın ham maddesi (malzeme günlüğündeki fiyatlarla)
//    2. Geliştirme, yapım ve test: tasarım, uzay koşullarında test, kalifikasyon
//    3. Taşıma    : fırlatma + gezegenler arası yolculuk + atmosfere giriş ve iniş
//    4. Operasyon : görev boyunca aracı uçuran ekip
//  Taşıma için tek bir doğru sayı yoktur; bu yüzden gerçek görevlerden bir ALT ve bir ÜST
//  sınır hesaplanır. Sonuç bir aralıktır: mühendisler de maliyeti aralık olarak verir.
// ============================================================================

// Gerçek görevlerin kaynaklı sayıları (ABD doları, harcandığı yılın doları)
export const REFERANSLAR = {
  mars2020: {
    ad: 'Mars 2020 (Perseverance)', gelistirme_usd: 2.2e9, firlatma_usd: 243e6, operasyon_usd: 300e6, inisKutlesi_kg: 1025,
    kaynak: 'The Planetary Society, "The Cost of Perseverance, in Context" (2020); gezgin kütlesi: NASA/JPL Mars 2020 basın kiti',
  },
  ingenuity: {
    ad: 'Ingenuity helikopteri', yapim_usd: 80e6, operasyon_usd: 5e6, operasyonSuresi_ay: 1, kutle_kg: 1.8,
    kaynak: 'The Planetary Society / NASA JPL: yapım ~80 milyon $, 1 aylık görevin operasyonu ~5 milyon $',
  },
  dragonfly: {
    ad: 'Dragonfly (Titan)', toplam_usd: 3.35e9, inisKutlesi_kg: 450,
    kaynak: 'NASA / Johns Hopkins APL (2024): toplam yaşam döngüsü maliyeti 3,35 milyar $; iniş kütlesi ≈450 kg',
  },
  clps: {
    ad: 'NASA CLPS Ay iniş sözleşmeleri', alt_usd_kg: 538e3, ust_usd_kg: 2.41e6,
    kaynak: 'CLPS sözleşmelerinin kg başına analizi (Live in the Future, 2026; Philip Swan analizi Ay yüzeyi için ~1,2 milyon $/kg)',
  },
};

const R = REFERANSLAR;

// Gezegene göre taşıma (fırlatma + yolculuk + iniş) maliyeti, YÜZEYE İNEN kg başına
export const TASIMA = {
  mars: {
    alt_usd_kg: R.mars2020.firlatma_usd / R.mars2020.inisKutlesi_kg,
    ust_usd_kg: (R.mars2020.gelistirme_usd + R.mars2020.firlatma_usd) / R.mars2020.inisKutlesi_kg,
    aciklama: 'Alt sınır: yalnızca Mars 2020 roketi ÷ yüzeye inen kütle. Üst sınır: roket + bütün uzay aracı (yolculuk modülü, iniş sistemi, gezgin) ÷ yüzeye inen kütle. Gerçek değer arada bir yerdedir: Ingenuity gibi gezginin altında giden küçük bir araç iniş sistemini paylaşır.',
    kaynak: R.mars2020.kaynak,
  },
  ay: {
    alt_usd_kg: R.clps.alt_usd_kg, ust_usd_kg: R.clps.ust_usd_kg,
    aciklama: 'Ticari Ay iniş hizmetlerinin (CLPS) kg başına fiyat aralığı: iniş dahil.',
    kaynak: R.clps.kaynak,
  },
  titan: {
    alt_usd_kg: null, ust_usd_kg: R.dragonfly.toplam_usd / R.dragonfly.inisKutlesi_kg,
    aciklama: 'Titan\'a ayrı bir taşıma fiyatı yok. Üst sınır: Dragonfly\'ın bütün görev maliyeti ÷ iniş kütlesi (geliştirme ve operasyon dahil, yani gerçek taşıma maliyetinden yüksektir).',
    kaynak: R.dragonfly.kaynak,
  },
  europa: {
    alt_usd_kg: null, ust_usd_kg: null,
    aciklama: 'Europa yüzeyine henüz hiçbir araç inmedi; gerçek bir referans yok. Takım kendi kaynağını bulmalı.',
    kaynak: '—',
  },
  dunya: {
    alt_usd_kg: 0, ust_usd_kg: 0,
    aciklama: 'Dünya\'da uzaya taşıma yok; aracı arabayla götürürsünüz.',
    kaynak: '—',
  },
};

// Malzeme ham maliyeti: parça kütlesi × malzeme günlüğündeki $/kg
// parcaMalzemesi: { 'Pervaneler': {ad, fiyat_usd_kg}, 'Gövde (...)': {...}, 'Batarya': {...} }
export function malzemeMaliyeti(parcalar, parcaMalzemesi) {
  const satirlar = [];
  let toplam = 0, eksik = 0;
  for (const [parca, kg] of Object.entries(parcalar)) {
    const m = parcaMalzemesi[parca];
    if (!m) continue;
    const usd = Number.isFinite(m.fiyat_usd_kg) ? kg * m.fiyat_usd_kg : null;
    if (usd == null) eksik++; else toplam += usd;
    satirlar.push({ parca, malzeme: m.ad, kg, fiyat_usd_kg: m.fiyat_usd_kg ?? null, usd, kaynak: m.fiyatKaynagi ?? m.kaynak ?? null });
  }
  return { satirlar, toplam_usd: toplam, eksik };
}

// Bütün maliyet. s: { gezegen, kutle_kg, parcalar, parcaMalzemesi, gelistirme_usd, operasyonSuresi_ay, tasimaKendi_usd_kg }
export function gorevMaliyeti(s) {
  const t = TASIMA[s.gezegen] ?? TASIMA.europa;
  const kendi = Number.isFinite(s.tasimaKendi_usd_kg) && s.tasimaKendi_usd_kg >= 0 ? s.tasimaKendi_usd_kg : null;
  const altKg = kendi ?? t.alt_usd_kg ?? t.ust_usd_kg, ustKg = kendi ?? t.ust_usd_kg ?? t.alt_usd_kg;
  const malzeme = malzemeMaliyeti(s.parcalar, s.parcaMalzemesi ?? {});
  const gelistirme = s.gelistirme_usd ?? R.ingenuity.yapim_usd;
  const operasyon = (s.operasyonSuresi_ay ?? 1) * R.ingenuity.operasyon_usd / R.ingenuity.operasyonSuresi_ay;
  const tasima = { alt: altKg == null ? null : s.kutle_kg * altKg, ust: ustKg == null ? null : s.kutle_kg * ustKg, alt_usd_kg: altKg, ust_usd_kg: ustKg, kendi: kendi != null, ...t };
  const sabit = malzeme.toplam_usd + gelistirme + operasyon;
  const toplam = { alt: tasima.alt == null ? null : sabit + tasima.alt, ust: tasima.ust == null ? null : sabit + tasima.ust };
  return {
    malzeme, gelistirme_usd: gelistirme, operasyon_usd: operasyon, tasima, toplam,
    // Ders: ham malzeme toplamın ne kadarı?
    malzemePayi: toplam.ust ? malzeme.toplam_usd / toplam.ust : null,
  };
}

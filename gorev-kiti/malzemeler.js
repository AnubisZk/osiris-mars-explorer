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

// (Gerçekçi görev maliyeti maliyet.js içindedir; bu tablo eski "kaba hesap" karşılaştırması içindir.)
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

// ============================================================================
//  MALZEME GÜNLÜĞÜ — malzeme mühendisi öğrencilerin araştırdığı değerler hesaba katılır
//
//  Öğrenciler MALZEME-GUNLUGU.md dosyasındaki tabloya (ya da Fabrika sayfasındaki forma)
//  buldukları malzemeleri ve değerleri kaynaklarıyla yazar. Fabrika bu satırları okur:
//   • "Kimlik" sütunu hazır bir malzemeninkiyle aynıysa (karbon, aluminyum, titanyum, cam,
//     pla, liion, lipo, lis) o malzemenin DOLU sütunları öğrencinin değeriyle güncellenir.
//   • Yeni bir kimlikse yeni bir malzeme olarak seçeneklere eklenir.
//   • Aynı kimlik birden çok kez yazıldıysa EN SON satır kullanılır; eski satırlar silinmez,
//     raporda "önceki ölçüm" olarak görünür.
//   • Kaynağı olmayan satır kullanılır ama raporda ⚠ ile işaretlenir.
//   • Olağan dışı bir sayı (ör. 2,7 yerine 2700000) hesaba KATILMAZ ve nedeni gösterilir.
// ============================================================================

const VARSAYILAN_YAPI = structuredClone(YAPI_MALZEMELERI);
const VARSAYILAN_BATARYA = structuredClone(BATARYALAR);

const SUTUNLAR = {
  tarih: /tarih/i, rol: /rol/i, tur: /tür|tur/i, kimlik: /kimlik/i, ad: /malzeme|ad/i,
  yogunluk_kg_m3: /yoğunluk|yogunluk/i, cekme_MPa: /çekme|cekme|dayanım/i, ozgulEnerji_Wh_kg: /özgül enerji|ozgul enerji|wh/i,
  fiyat_usd_kg: /fiyat/i, enDusukSicaklik_C: /sıcakl|sicakl/i, kaynak: /kaynak/i, not: /not/i,
};
const SAYI_ALANLARI = ['yogunluk_kg_m3', 'cekme_MPa', 'ozgulEnerji_Wh_kg', 'fiyat_usd_kg', 'enDusukSicaklik_C'];
const SINIR = { yogunluk_kg_m3: [100, 25000], cekme_MPa: [1, 7000], ozgulEnerji_Wh_kg: [10, 1000], fiyat_usd_kg: [0, 1e7], enDusukSicaklik_C: [-273, 500] };

// Türkçe ondalık virgülü ve binlik noktayı anlar: "2,7" → 2.7, "2.810" → 2810, "1.550,5" → 1550.5
export function sayiOku(m) {
  let t = String(m ?? '').trim().replace(/\s/g, '').replace(/[−–]/g, '-');
  if (!t || t === '-' || /^\[.*\]$/.test(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

const kimlikYap = s => String(s ?? '').toLocaleLowerCase('tr').trim().replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// MALZEME-GUNLUGU.md metnindeki "Kayıtlar" tablosunu satırlara çevirir
export function gunlukOku(metin, kaynakAdi = 'MALZEME-GUNLUGU.md') {
  const satirlar = String(metin ?? '').split(/\r?\n/).filter(s => s.trim().startsWith('|'));
  let baslik = null; const kayitlar = [];
  for (const s of satirlar) {
    const h = s.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
    if (h.every(x => /^:?-{2,}:?$/.test(x) || x === '')) continue;
    if (!baslik) {
      if (!h.some(x => /kimlik/i.test(x))) continue;
      baslik = h.map(x => Object.entries(SUTUNLAR).find(([, r]) => r.test(x))?.[0] ?? null);
      continue;
    }
    const k = { dosya: kaynakAdi };
    h.forEach((x, i) => { if (baslik[i]) k[baslik[i]] = x; });
    if (!k.kimlik && !k.ad) continue;
    if (/^örnek/i.test(k.not ?? '') || /^\[.*\]$/.test(k.ad ?? '')) continue;   // şablon satırları
    kayitlar.push(k);
  }
  return kayitlar;
}

// Kayıtları denetler ve kataloğu kurar. Döndürür: { yapi, batarya, rapor:[{kayit, durum, sorunlar}] }
export function katalogKur(kayitlar = []) {
  const yapi = structuredClone(VARSAYILAN_YAPI), batarya = structuredClone(VARSAYILAN_BATARYA), rapor = [];
  kayitlar.forEach((ham, sira) => {
    const sorunlar = [], uyarilar = [];
    const tur = /bat/i.test(ham.tur ?? '') ? 'batarya' : 'yapi';
    const kimlik = kimlikYap(ham.kimlik || ham.ad);
    const deger = {};
    for (const a of SAYI_ALANLARI) {
      const v = sayiOku(ham[a]);
      if (v == null) continue;
      if (Number.isNaN(v)) { sorunlar.push(`${a} sayı değil ("${ham[a]}")`); continue; }
      const [en, ek] = SINIR[a];
      if (v < en || v > ek) { sorunlar.push(`${a} = ${v} olağan dışı (beklenen ${en}–${ek})`); continue; }
      deger[a] = v;
    }
    const tablo = tur === 'batarya' ? batarya : yapi, onceki = tablo[kimlik];
    const gerekli = tur === 'batarya' ? ['ozgulEnerji_Wh_kg'] : ['yogunluk_kg_m3', 'cekme_MPa'];
    if (!onceki) for (const a of gerekli) if (deger[a] == null && !sorunlar.some(x => x.startsWith(a))) sorunlar.push(`yeni malzeme için ${a} gerekli`);
    if (!String(ham.kaynak ?? '').trim()) uyarilar.push('kaynak yazılmamış');
    if (sorunlar.length) { rapor.push({ sira: sira + 1, kimlik, tur, kayit: ham, durum: 'hesaba katılmadı', sorunlar, uyarilar }); return; }
    const kaynakMetni = `${ham.kaynak?.trim() || 'KAYNAK YOK'} (malzeme günlüğü${ham.rol ? ', ' + ham.rol : ''}${ham.tarih ? ', ' + ham.tarih : ''})`;
    const fiziksel = Object.keys(deger).some(a => a !== 'fiyat_usd_kg');
    const yeni = { ...(onceki ?? {}), ...deger, ad: ham.ad?.trim() || onceki?.ad || kimlik, ogrenci: true,
      kaynak: fiziksel || !onceki ? kaynakMetni : onceki.kaynak, kaynaksiz: !String(ham.kaynak ?? '').trim() };
    if (deger.fiyat_usd_kg != null) yeni.fiyatKaynagi = kaynakMetni;
    if (deger.enDusukSicaklik_C != null) yeni.soguktaKirilgan = false;   // öğrencinin ölçtüğü sınır kullanılır
    if (onceki?.ogrenci) rapor.filter(r => r.kimlik === kimlik && r.durum === 'kullanılıyor').forEach(r => { r.durum = 'önceki ölçüm (yenisi kullanılıyor)'; });
    tablo[kimlik] = yeni;
    rapor.push({ sira: sira + 1, kimlik, tur, kayit: ham, durum: 'kullanılıyor', sorunlar, uyarilar, guncelleme: !!onceki && !onceki.ogrenci, alanlar: Object.keys(deger) });
  });
  return { yapi, batarya, rapor };
}

// Kataloğu bütün modüllerin kullandığı tablolara uygular (Fabrika sayfası açılışta bir kez çağırır)
export function katalogUygula({ yapi, batarya }) {
  for (const k of Object.keys(YAPI_MALZEMELERI)) delete YAPI_MALZEMELERI[k];
  for (const k of Object.keys(BATARYALAR)) delete BATARYALAR[k];
  Object.assign(YAPI_MALZEMELERI, yapi); Object.assign(BATARYALAR, batarya);
}
export function varsayilanKatalog() { return { yapi: structuredClone(VARSAYILAN_YAPI), batarya: structuredClone(VARSAYILAN_BATARYA), rapor: [] }; }

// Gezegenin en soğuk koşulunda malzeme dayanır mı? (enDusukSicaklik_C: malzemenin alt sınırı)
export function soguktaUygunMu(malzeme, gezegenEnDusuk_C) {
  if (malzeme?.enDusukSicaklik_C != null && gezegenEnDusuk_C != null) return malzeme.enDusukSicaklik_C <= gezegenEnDusuk_C;
  return !malzeme?.soguktaKirilgan;
}

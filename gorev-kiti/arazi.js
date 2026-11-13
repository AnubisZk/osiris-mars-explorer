// ============================================================================
//  ARAZİ — zemin yüksekliğini hesaplayan fonksiyon
//  Sorumlu rol: TASARIMCI (görünüş) + KODCU
//
//  Bu arazi "prosedürel"dir: matematikle üretilir, gerçek bir harita DEĞİLDİR.
//  Oyununda bunu açıkça yaz ("temsili arazi"). Gerçek görevlerde NASA'nın
//  yükseklik haritaları (DTM) kullanılır.
//
//  Ayarlar (ayarlar.js → arazi):
//    tohum   : aynı tohum hep aynı araziyi üretir (sayıyı değiştir, yeni arazi gör)
//    krater  : kaç krater olsun
//    tepe    : tepelerin yüksekliği (metre)
// ============================================================================

// Tohumlu rastgele sayı üreteci: aynı tohum → aynı sayı dizisi.
export function rastgele(tohum) {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Araziyi bir kez kurar ve (x, z) → yükseklik fonksiyonu döndürür.
// duzAlanlar: üssün ve hedeflerin çevresi düz olsun diye [{x, z, yaricap}]
export function araziKur(ayar = {}, duzAlanlar = []) {
  const tohum = ayar.tohum ?? 1;
  const tepe = ayar.tepe ?? 6;
  const kraterSayisi = ayar.krater ?? 20;
  const r = rastgele(tohum);

  // Birkaç farklı dalga boyunda sinüs: yumuşak tepeler
  const dalgalar = [];
  for (let i = 0; i < 5; i++) {
    const boy = 60 + r() * 260;            // dalga boyu (m)
    const aci = r() * Math.PI * 2;
    dalgalar.push({ kx: Math.cos(aci) * 2 * Math.PI / boy, kz: Math.sin(aci) * 2 * Math.PI / boy, faz: r() * 6.28, genlik: tepe * (0.25 + r() * 0.5) });
  }

  // Kraterler: çukur + kenarında hafif sırt
  const kraterler = [];
  for (let i = 0; i < kraterSayisi; i++) {
    const R = 6 + Math.pow(r(), 2.2) * 45;  // küçük krater çok, büyük krater az
    kraterler.push({ x: (r() - 0.5) * 900, z: (r() - 0.5) * 900, R, derinlik: R * 0.18 });
  }

  function hamYukseklik(x, z) {
    let y = 0;
    for (const d of dalgalar) y += d.genlik * Math.sin(d.kx * x + d.kz * z + d.faz);
    for (const k of kraterler) {
      const dx = x - k.x, dz = z - k.z;
      const u = Math.sqrt(dx * dx + dz * dz) / k.R;   // 0 = merkez, 1 = kenar
      if (u < 1.6) {
        if (u < 1) y -= k.derinlik * (1 - u * u);                       // çukur
        else y += k.derinlik * 0.35 * Math.cos((u - 1) / 0.6 * Math.PI / 2); // sırt
      }
    }
    return y;
  }

  // Düz alanlar: o noktanın yüksekliğine yumuşakça yaklaşır
  const duz = duzAlanlar.map(a => ({ ...a, y: hamYukseklik(a.x, a.z) }));

  return function zemin(x, z) {
    let y = hamYukseklik(x, z);
    for (const a of duz) {
      const d = Math.hypot(x - a.x, z - a.z);
      const ic = a.yaricap, dis = a.yaricap * 2;
      if (d < dis) {
        const w = d <= ic ? 1 : 1 - (d - ic) / (dis - ic);
        const s = w * w * (3 - 2 * w);            // yumuşak geçiş
        y = y * (1 - s) + a.y * s;
      }
    }
    return y;
  };
}

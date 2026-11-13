// ============================================================================
//  HESAP — görevin fizik hesaplarını adım adım çıkaran "doğrulama motoru"
//  Sorumlu rol: BİLİM DANIŞMANI
//
//  Bu dosya, oyunun kullandığı fizik.js ile AYNI denklemleri kullanarak
//  ayarlar.js'teki görev için bütün hesapları formül → yerine koyma → sonuç
//  biçiminde yazar. Yapay zekânın ya da takımın FIZIK-HESAPLARI.md'ye yazdığı
//  sonuçları bununla karşılaştırırsınız: fark %1'den büyükse biri yanılmıştır!
//
//  Kullanım:
//    • Tarayıcıda: hesap.html sayfasını açın.
//    • Komut satırında: node hesapla.mjs
// ============================================================================

import { ortam, aracOzeti, ITKI_KATSAYISI, G0 } from './fizik.js';

const say = (v, b = 2) => (Number.isFinite(v) ? v.toLocaleString('tr-TR', { minimumFractionDigits: b, maximumFractionDigits: b }) : '—');
const dk = s => `${say(s / 60, 1)} dk`;

// Görev rotası: üs → hedefler (listedeki sırayla) → üs
export function rota(gorev) {
  const noktalar = [{ ad: 'Üs', x: 0, z: 0 }, ...gorev.hedefler, { ad: 'Üs', x: 0, z: 0 }];
  const ayaklar = [];
  for (let i = 1; i < noktalar.length; i++) {
    const a = noktalar[i - 1], b = noktalar[i], dx = b.x - a.x, dz = b.z - a.z;
    ayaklar.push({ den: a.ad, ye: b.ad, dx, dz, mesafe: Math.hypot(dx, dz) });
  }
  return { ayaklar, toplam: ayaklar.reduce((t, a) => t + a.mesafe, 0) };
}

// Bütün sonuçları sayı olarak döndürür (testler ve karşılaştırma için)
export function hesapla(gorev) {
  const ort = ortam(gorev), a = gorev.arac, o = aracOzeti(gorev), r = rota(gorev);
  const roket = a.tip === 'roket';
  const maksHiz = a.maksHiz_m_s ?? 8, maksDikey = a.maksDikeyHiz_m_s ?? (roket ? 4 : 3);
  const seyir = 25;                                                // oyunun önerdiği seyir yüksekliği (m)
  const yatay_s = r.toplam / maksHiz;
  const dikey_s = (gorev.hedefler.length + 1) * 2 * seyir / maksDikey;   // her ayakta bir tırmanış + bir iniş
  const gozlem_s = gorev.hedefler.reduce((t, h) => t + (h.gozlemSuresi_s ?? 3), 0);
  const sure_s = yatay_s + dikey_s + gozlem_s;
  const s = { ort, arac: a, ozet: o, rota: r, seyir, maksHiz, maksDikey, yatay_s, dikey_s, gozlem_s, sure_s, roket };
  if (roket) {
    s.mdot = o.agirlik_N / (a.isp_s * G0);
    s.gerekenYakit_kg = s.mdot * sure_s;                            // askıda kalma tüketimiyle (üst sınır tahmini)
    s.butceOrani = s.gerekenYakit_kg / a.yakit_kg;
    s.kuruTW = a.maksItki_N / (a.kuruKutle_kg * ort.g);
  } else {
    s.diskYuku = o.agirlik_N / a.rotorAlani_m2;
    s.vi = Math.sqrt(o.agirlik_N / (2 * ort.rho0 * a.rotorAlani_m2));
    s.gerekenEnerji_Wh = o.askidaGuc_W * sure_s / 3600;
    s.butceOrani = s.gerekenEnerji_Wh / a.batarya_Wh;
  }
  const rz = gorev.ruzgar ?? {};
  s.ruzgarSonda = (rz.hiz_m_s ?? 0) + (rz.artis_m_s_dk ?? 0) * sure_s / 60;
  s.sureYeter = !(gorev.sureSiniri_s > 0) || sure_s <= gorev.sureSiniri_s;
  return s;
}

// FIZIK-HESAPLARI.md ile aynı başlıklarda, Markdown biçiminde rapor
export function hesapRaporu(gorev) {
  const h = hesapla(gorev), { ort, arac: a, ozet: o, rota: r } = h;
  const L = [];
  L.push(`# Fizik hesapları — ${gorev.baslik}`, '',
    `> Bu rapor **hesap.js** tarafından, oyunun kendi fizik denklemleriyle üretildi. FIZIK-HESAPLARI.md'deki sonuçlarınızı bununla karşılaştırın.`,
    `> Yuvarlama farkı dışında (%1'den küçük) bir fark varsa hangi adımda ayrıldığınızı bulun.`, '');

  L.push('## 1. Ortam', '', '| Büyüklük | Değer | Kaynak |', '|---|---|---|',
    `| Gezegen / uydu | ${ort.ad} | — |`,
    `| Yerçekimi ivmesi g | ${say(ort.g, 3)} m/s² | ${gorev.yercekimi_m_s2 != null ? 'ayarlar.js' : 'gezegenler.js'} |`,
    `| Yüzeyde hava yoğunluğu ρ | ${ort.rho0 > 0 ? say(ort.rho0, ort.rho0 < 0.1 ? 4 : 3) + ' kg/m³' : 'yok (0)'} | ${gorev.havaYogunlugu_kg_m3 != null ? 'ayarlar.js' : 'gezegenler.js'} |`,
    `| Ses hızı | ${ort.sesHizi_m_s ? say(ort.sesHizi_m_s, 0) + ' m/s' : '—'} | gezegenler.js |`,
    `| Işık gecikmesi (gerçekte) | ${ort.isikGecikmesi} | gezegenler.js |`,
    `| Oyundaki komut gecikmesi | ${say(gorev.gecikme_s ?? 0, 1)} s | ayarlar.js |`, '');

  L.push('## 2. Kütle ve ağırlık', '');
  if (h.roket) L.push(`- Toplam kütle: m = kuru kütle + yakıt = ${say(a.kuruKutle_kg, 0)} + ${say(a.yakit_kg, 0)} = **${say(o.kutle_kg, 1)} kg**`);
  else L.push(`- Kütle: m = **${say(o.kutle_kg, 2)} kg**`);
  L.push(`- Ağırlık: W = m × g = ${say(o.kutle_kg, 2)} × ${say(ort.g, 3)} = **${say(o.agirlik_N, 2)} N**`,
    `- Karşılaştırma: aynı araç Dünya'da W = ${say(o.kutle_kg, 2)} × 9,81 = ${say(o.kutle_kg * 9.81, 2)} N`, '');

  if (h.roket) {
    L.push('## 3. Roket motoru', '',
      `- En büyük itki: T_maks = **${say(o.maksItki_N, 0)} N**`,
      `- İtki/ağırlık (dolu): T_maks ÷ W = ${say(o.maksItki_N, 0)} ÷ ${say(o.agirlik_N, 1)} = **${say(o.itkiAgirlikOrani, 2)}**`,
      `- İtki/ağırlık (yakıt bitince): T_maks ÷ (m_kuru × g) = ${say(a.maksItki_N, 0)} ÷ (${say(a.kuruKutle_kg, 0)} × ${say(ort.g, 3)}) = **${say(h.kuruTW, 2)}**`,
      `- Askıda kalırken yakıt tüketimi: ṁ = W ÷ (Isp × g₀) = ${say(o.agirlik_N, 1)} ÷ (${say(a.isp_s, 0)} × ${say(G0, 3)}) = **${say(h.mdot, 4)} kg/s**`,
      `- Askıda kalma süresi (yaklaşık): yakıt ÷ ṁ = ${say(a.yakit_kg, 1)} ÷ ${say(h.mdot, 4)} = **${say(o.askidaKalmaSuresi_s, 0)} s ≈ ${dk(o.askidaKalmaSuresi_s)}**`,
      `- Hız değişimi bütçesi (roket denklemi): Δv = Isp × g₀ × ln(m_dolu ÷ m_kuru) = ${say(a.isp_s, 0)} × ${say(G0, 3)} × ln(${say(o.kutle_kg, 0)} ÷ ${say(a.kuruKutle_kg, 0)}) = **${say(o.deltaV_m_s, 0)} m/s**`, '');
  } else {
    L.push('## 3. Rotor', '',
      `- En büyük itki: T_maks = C_T × ρ × A × v_uç² = ${say(ITKI_KATSAYISI, 3)} × ${say(ort.rho0, 4)} × ${say(a.rotorAlani_m2, 4)} × ${say(a.ucHizi_m_s, 0)}² = **${say(o.maksItki_N, 2)} N**`,
      `- İtki/ağırlık: T_maks ÷ W = ${say(o.maksItki_N, 2)} ÷ ${say(o.agirlik_N, 2)} = **${say(o.itkiAgirlikOrani, 2)}** → ${o.ucabilir ? 'kalkabilir ✓' : 'KALKAMAZ ✗'}`,
      `- Disk yükü: W ÷ A = ${say(o.agirlik_N, 2)} ÷ ${say(a.rotorAlani_m2, 4)} = **${say(h.diskYuku, 1)} N/m²**`,
      `- Uç Mach sayısı: v_uç ÷ ses hızı = ${say(a.ucHizi_m_s, 0)} ÷ ${say(ort.sesHizi_m_s, 0)} = **${say(o.ucMach, 2)}** ${o.ucMach > 0.8 ? '⚠ 0,8\'den büyük' : '(0,8\'den küçük ✓)'}`, '',
      '## 4. Güç ve batarya', '',
      `- İndüklenmiş hız: v_i = √(W ÷ (2ρA)) = √(${say(o.agirlik_N, 2)} ÷ (2 × ${say(ort.rho0, 4)} × ${say(a.rotorAlani_m2, 4)})) = **${say(h.vi, 2)} m/s**`,
      `- Askıda kalma gücü: P = W × v_i ÷ verim + avyonik = ${say(o.agirlik_N, 2)} × ${say(h.vi, 2)} ÷ ${say(a.rotorVerimi, 2)} + ${say(a.avyonikGucu_W ?? 0, 0)} = **${say(o.askidaGuc_W, 0)} W**`,
      `- Askıda kalma süresi: batarya × 3600 ÷ P = ${say(a.batarya_Wh, 1)} × 3600 ÷ ${say(o.askidaGuc_W, 0)} = **${say(o.askidaKalmaSuresi_s, 0)} s ≈ ${dk(o.askidaKalmaSuresi_s)}**`, '');
  }

  L.push(`## ${h.roket ? 4 : 5}. Görev rotası`, '', '| Ayak | Δx (m) | Δz (m) | Mesafe = √(Δx² + Δz²) |', '|---|---|---|---|');
  for (const y of r.ayaklar) L.push(`| ${y.den} → ${y.ye} | ${say(y.dx, 0)} | ${say(y.dz, 0)} | ${say(y.mesafe, 1)} m |`);
  L.push(`| **Toplam** | | | **${say(r.toplam, 1)} m** |`, '');

  L.push(`## ${h.roket ? 5 : 6}. Süre ve ${h.roket ? 'yakıt' : 'enerji'} bütçesi (tahmini)`, '',
    `- Yatay uçuş: toplam yol ÷ en yüksek hız = ${say(r.toplam, 1)} ÷ ${say(h.maksHiz, 1)} = ${say(h.yatay_s, 0)} s`,
    `- Tırmanış ve iniş: ${gorev.hedefler.length + 1} ayak × 2 × ${h.seyir} m ÷ ${say(h.maksDikey, 1)} m/s = ${say(h.dikey_s, 0)} s`,
    `- Gözlemler: ${gorev.hedefler.map(t => say(t.gozlemSuresi_s ?? 3, 0)).join(' + ')} = ${say(h.gozlem_s, 0)} s`,
    `- **Toplam süre ≈ ${say(h.sure_s, 0)} s ≈ ${dk(h.sure_s)}**${gorev.sureSiniri_s > 0 ? ` (süre sınırı ${dk(gorev.sureSiniri_s)} → ${h.sureYeter ? 'yetiyor ✓' : 'YETMİYOR ✗'})` : ''}`);
  if (h.roket) L.push(`- Gereken yakıt ≈ ṁ × süre = ${say(h.mdot, 4)} × ${say(h.sure_s, 0)} = **${say(h.gerekenYakit_kg, 1)} kg** → yakıtın **%${say(h.butceOrani * 100, 0)}**'i`);
  else L.push(`- Gereken enerji ≈ P × süre ÷ 3600 = ${say(o.askidaGuc_W, 0)} × ${say(h.sure_s, 0)} ÷ 3600 = **${say(h.gerekenEnerji_Wh, 1)} Wh** → bataryanın **%${say(h.butceOrani * 100, 0)}**'i`);
  L.push(`- Değerlendirme: ${h.butceOrani < 0.7 ? 'bütçe rahat ✓' : h.butceOrani < 1 ? 'bütçe sıkı ⚠ (rüzgâr ve hatalar için pay az)' : 'bütçe YETMİYOR ✗ (hedefleri yaklaştırın ya da aracı değiştirin)'}`);
  if (h.ruzgarSonda > 0) L.push(`- Rüzgâr: başta ${say(gorev.ruzgar.hiz_m_s ?? 0, 1)} m/s, görev sonunda ≈ ${say(h.ruzgarSonda, 1)} m/s${h.ruzgarSonda > h.maksHiz * 0.5 ? ' ⚠ en yüksek hızın yarısından fazla' : ''}`);
  L.push('', '> Not: Bu bir **tahmindir**. Gerçek uçuşta ileri uçuş gücü, rüzgâr, düzeltme manevraları ve arazi süreyi değiştirir. Test uçuşlarının raporlarıyla karşılaştırın.', '');
  return L.join('\n');
}

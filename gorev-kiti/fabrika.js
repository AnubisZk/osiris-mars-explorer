// ============================================================================
//  FABRİKA — Görev Fabrikası'nın arayüzden bağımsız parçaları (testlerle sınanır)
//    • yapay zekâya gidecek tasarım komutu ve gelen cevabın okunması
//    • tasarlanan aracı oynanabilir bir göreve dönüştürme
//    • TASARIM-RAPORU.md metni
// ============================================================================

import { ortam } from './fizik.js';
import { rota } from './hesap.js';
import { ARALIK, sinirla } from './optimize.js';
import { SENARYOLAR } from './stres.js';
import { YAPI_MALZEMELERI, BATARYALAR, ROKET_MOTORLARI } from './malzemeler.js';

const say = (v, b = 2) => (Number.isFinite(v) ? v.toLocaleString('tr-TR', { minimumFractionDigits: b, maximumFractionDigits: b }) : '—');
const yuzde = v => (Number.isFinite(v) ? `%${Math.round(v * 100)}` : '—');
const para = v => (Number.isFinite(v) ? v.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' $' : '—');

// ---------------------------------------------------------------- yapay zekâ komutu
export function yzKomutu(gereksinim, tip) {
  const g = gereksinim.gorev, o = ortam(g), r = rota(g);
  const alanlar = Object.entries(ARALIK[tip]).map(([k, v]) =>
    `- ${k}: ${typeof v[0] === 'number' && k !== 'rotorSayisi' ? `${v[0]} ile ${v[1]} arası sayı` : `şunlardan biri: ${v.map(x => JSON.stringify(x)).join(', ')}`}`).join('\n');
  const secenek = tip === 'rotor'
    ? `Batarya tipleri (Wh/kg): ${Object.entries(BATARYALAR).map(([k, b]) => `${k}=${b.ozgulEnerji_Wh_kg}${b.deneysel ? ' (deneysel)' : ''}`).join(', ')}.`
    : `Roket motorları: ${Object.entries(ROKET_MOTORLARI).map(([k, m]) => `${k}=Isp ${m.isp_s} s`).join(', ')}.`;
  return `[Görev Fabrikası · tasarım önerisi]
Bir öğrenci takımıyla ${o.ad} üzerinde çalışacak bir ${tip === 'rotor' ? 'rotorlu (helikopter/dron)' : 'roketli'} keşif aracı tasarlıyoruz.

Görev: "${g.baslik}"
- Yerçekimi: ${say(o.g)} m/s², yüzey hava yoğunluğu: ${say(o.rho0, 4)} kg/m³, ses hızı: ${say(o.sesHizi_m_s, 0)} m/s
- ${g.hedefler.length} hedef, toplam rota ${say(r.toplam, 0)} m (üs → hedefler → üs), her hedefte gözlem için alçalıp beklemek gerekiyor
- Rüzgâr: ${say(g.ruzgar?.hiz_m_s ?? 0, 1)} m/s; stres testinde ${gereksinim.tasarimRuzgari_m_s} m/s'ye kadar
- Faydalı yük ${gereksinim.yuk_kg} kg, aviyonik ${gereksinim.aviyonik_kg} kg (${gereksinim.aviyonikGucu_W} W)
- Kurallar: itki/ağırlık ≥ ${gereksinim.minItkiAgirlik}${tip === 'rotor' ? `, rotor ucu Mach ≤ ${gereksinim.maksMach}` : ''}, görev enerjinin/yakıtın en çok %${Math.round(gereksinim.maksButce * 100)}'ini harcamalı
- Amaç: kuralları sağlayan EN HAFİF araç (yollama maliyeti kütleyle orantılı)
${secenek}

Tasarım değişkenleri:
${alanlar}

Cevabının başında tek bir JSON nesnesi ver (yalnızca yukarıdaki alanlar), ardından en fazla 5 madde ile her seçimin fiziksel gerekçesini Türkçe ve ortaokul öğrencisinin anlayacağı dille açıkla.`;
}

// Cevaptaki ilk { ... } bloğunu bulur, okur ve aralığa sıkıştırır
export function yzCevabiniOku(metin, tip) {
  const m = String(metin ?? '').match(/\{[\s\S]*?\}/);
  if (!m) throw new Error('Cevapta JSON bulunamadı. Yapay zekâdan yalnızca JSON istemeyi deneyin.');
  let ham;
  try { ham = JSON.parse(m[0]); } catch { throw new Error('Cevaptaki JSON okunamadı (yazım hatası var).'); }
  const d = sinirla(tip, ham);
  const duzeltilen = Object.keys(ARALIK[tip]).filter(k => ham[k] !== undefined && String(ham[k]) !== String(d[k]));
  const eksik = Object.keys(ARALIK[tip]).filter(k => ham[k] === undefined);
  return { tasarim: d, duzeltilen, eksik, aciklama: metin.slice(m.index + m[0].length).trim() };
}

// ---------------------------------------------------------------- oynanabilir görev
export function oyunGorevi(taban, arac, { baslik, hikaye } = {}) {
  const g = structuredClone({ ...taban, arac });
  g.kimlik = 'fabrika';
  if (baslik) g.baslik = baslik;
  g.hikaye = hikaye || `${taban.hikaye} (Bu görevin aracı Görev Fabrikası'nda tasarlandı ve stres testinden geçti.)`;
  return g;
}

// ---------------------------------------------------------------- rapor
export function tasarimRaporu(S) {
  const e = S.degerlendirme, g = e.gorev, a = e.arac, o = ortam(g), roket = a.tip === 'roket';
  const satirlar = [];
  const ekle = (...x) => satirlar.push(...x);
  ekle(`# Tasarım raporu: ${g.baslik}`, '',
    `> Görev Fabrikası ile üretildi (${new Date().toLocaleString('tr-TR')}). Değerler basitleştirilmiş bir modelden gelir;`,
    `> malzeme ve fiyat tabloları "tipik değer"dir, kaynaklarını takım doğrulamalıdır.`, '',
    '## 1. Sistem tasarımı (gereksinimler)', '',
    '| Gereksinim | Değer |', '|---|---|',
    `| Gezegen | ${o.ad} (g = ${say(o.g)} m/s², ρ = ${say(o.rho0, 4)} kg/m³) |`,
    `| Hedef sayısı / rota | ${g.hedefler.length} hedef, ${say(rota(g).toplam, 0)} m |`,
    `| Faydalı yük / aviyonik | ${say(S.gereksinim.yuk_kg)} kg / ${say(S.gereksinim.aviyonik_kg)} kg (${say(S.gereksinim.aviyonikGucu_W, 0)} W) |`,
    `| İtki/ağırlık en az | ${say(S.gereksinim.minItkiAgirlik, 1)} |`,
    roket ? null : `| Rotor ucu Mach en çok | ${say(S.gereksinim.maksMach, 1)} |`,
    `| Enerji/yakıt bütçesi en çok | ${yuzde(S.gereksinim.maksButce)} |`,
    `| Tasarım rüzgârı | ${S.gereksinim.tasarimRuzgari_m_s} m/s |`,
    `| Stres testinde hedef başarı (en kötü senaryo) | ${yuzde(S.gereksinim.hedefBasari)} |`, '');
  ekle('## 2. Cihaz tasarımı', '', `**Kaynak:** ${S.kaynak ?? 'takımın elle seçtiği değerler'}`, '',
    '| Değişken | Değer |', '|---|---|',
    ...Object.entries(S.tasarim).filter(([k]) => k !== 'tip').map(([k, v]) => `| ${k} | ${typeof v === 'number' ? say(v, Number.isInteger(v) ? 0 : v < 10 ? 3 : 1) : (YAPI_MALZEMELERI[v]?.ad ?? BATARYALAR[v]?.ad ?? ROKET_MOTORLARI[v]?.ad ?? v)} |`), '',
    '### Kütle dökümü', '', '| Parça | Kütle (kg) | Pay |', '|---|---|---|',
    ...Object.entries(e.parcalar).map(([k, v]) => `| ${k} | ${say(v, 3)} | ${yuzde(v / e.kutle_kg)} |`),
    `| **Toplam** | **${say(e.kutle_kg, 3)}** | %100 |`, '',
    '### Kontroller', '',
    `- İtki/ağırlık: **${say(e.ozet.itkiAgirlikOrani)}**`,
    roket ? `- Delta-v: **${say(e.ozet.deltaV_m_s, 0)} m/s**` : `- Rotor ucu Mach: **${say(e.ozet.ucMach)}**, askıda güç: **${say(e.ozet.askidaGuc_W, 0)} W**`,
    `- Askıda kalma süresi: **${say(e.ozet.askidaKalmaSuresi_s / 60, 1)} dk**`,
    `- Görevin tahmini enerji/yakıt kullanımı: **${yuzde(e.hesap.butceOrani)}** (hesap.js, askıda kalma tüketimiyle üst sınır tahmini)`,
    Number.isFinite(e.ozet.ruzgarDayanimi) ? `- Rüzgâr dayanımı: **${say(e.ozet.ruzgarDayanimi)}** (1'den büyükse araç tasarım rüzgârına karşı durabilir)` : null,
    e.sorunlar.length ? `- ⚠ Sağlanmayan kurallar: ${e.sorunlar.join('; ')}` : '- ✓ Bütün kurallar sağlanıyor', '');
  if (S.yz) ekle('### Yapay zekâ önerisi', '', `- **Araç:** ${S.yz.arac}`, `- **Aralığa göre düzeltilen alanlar:** ${S.yz.duzeltilen.length ? S.yz.duzeltilen.join(', ') : 'yok'}`,
    `- **Eksik gelen alanlar:** ${S.yz.eksik.length ? S.yz.eksik.join(', ') : 'yok'}`, '', '**Gönderilen komutun tamamı:**', '', '````text', S.yz.komut, '````', '');
  if (S.optimizasyon?.length) ekle('### Otonom mühendis (optimizasyon) günlüğü', '', ...S.optimizasyon.map(s => `- ${s}`), '');
  const f = S.maliyet;
  ekle('## 3. Yollama maliyeti', '', `- Kütle: **${say(e.kutle_kg, 3)} kg**`,
    f?.usd_kg ? `- Fiyat: ${para(f.usd_kg)}/kg (${f.ad}; kaynak: ${f.kaynak})` : '- Fiyat: seçilmedi',
    f?.usd_kg ? `- **Yollama maliyeti ≈ ${para(e.kutle_kg * f.usd_kg)}** (yalnızca taşıma; iniş sistemi, yapım ve işletme hariç)` : null, '');
  if (S.sim) ekle('## 4. Simülasyon (otopilot, tek uçuş)', '', `- Sonuç: **${S.sim.mesaj}**`, `- Süre: ${say(S.sim.zaman / 60, 1)} dk, kalan enerji/yakıt: ${yuzde(S.sim.kalan)}, puan: ${S.sim.puan}`, '');
  if (S.stres) {
    const s = S.stres;
    ekle('## 5. Stres testi (Monte Carlo)', '', `Belirsizlik kaynağı: ${s.belirsizlik.kaynak} — hava yoğunluğu ±${yuzde(s.belirsizlik.yogunlukSapma)}, rüzgâr ±${say(s.belirsizlik.ruzgarSapma_m_s, 1)} m/s.`, '',
      '| Senaryo | Başarı | Oran | %95 güven aralığı | En az kalan enerji | Başarısızlık nedenleri |', '|---|---|---|---|---|---|',
      ...Object.entries(s.senaryolar).map(([k, v]) => `| ${SENARYOLAR[k]?.ad ?? k} | ${v.basari}/${v.n} | ${yuzde(v.oran)} | ${yuzde(v.aralik[0])} – ${yuzde(v.aralik[1])} | ${yuzde(v.enAzKalan)} | ${Object.entries(v.nedenler).map(([n, c]) => `${n}: ${c}`).join(', ') || '—'} |`),
      `| **Toplam** | **${s.toplam.basari}/${s.toplam.n}** | **${yuzde(s.toplam.oran)}** | ${yuzde(s.toplam.aralik[0])} – ${yuzde(s.toplam.aralik[1])} | | |`, '');
  }
  ekle('## 6. Oyun', '', '- Bu araç, Görev Kiti\'nde `index.html?gorev=fabrika` adresiyle oynanabilir; aynı görev `ayarlar.js` olarak da indirilebilir.', '',
    '## Takımın kontrolü (takım doldurur)', '', '- [ ] Kütle dökümündeki her parçayı bir kaynakla karşılaştırdık', '- [ ] Fiyat ve malzeme değerlerinin kaynağını doğruladık',
    '- [ ] Stres testinin başarısızlık nedenlerini inceledik ve tasarımı buna göre tartıştık', '- [ ] Yapay zekânın gerekçelerini kendi hesabımızla kontrol ettik');
  return satirlar.filter(x => x !== null).join('\n') + '\n';
}

// ---------------------------------------------------------------- öğrencinin çalışmasını koruma
// KURAL: Öğrencilerin ürettiği hiçbir şey otomatik silinmez ya da üzerine yazılmaz.
//  • Her kaydedilen tasarım, tarayıcıdaki tasarım arşivine EKLENİR (eskiler kalır).
//  • "Oyunda aç" yalnızca hangi tasarımın oynanacağını seçer; arşivden bir şey silmez.
//  • ayarlar.js dosyasına hiçbir zaman doğrudan yazılmaz: yeni ayarlar indirilir, takım
//    eski dosyasını commit ettikten sonra kendisi değiştirir (Git geçmişi eskisini saklar).
export const ARSIV_ANAHTARI = 'gorevKiti:fabrikaTasarimlari';
export const OYUN_ANAHTARI = 'gorevKiti:fabrika';

export function arsiv(depo) {
  try { const x = JSON.parse(depo.getItem(ARSIV_ANAHTARI)); return Array.isArray(x) ? x : []; } catch { return []; }
}

// kayit: { gorev, tasarim, ozet } → arşive eklenir. Depo doluysa HİÇBİR ŞEY silinmez; hata döner.
export function arsiveEkle(depo, kayit) {
  const liste = arsiv(depo);
  const yeni = { no: (liste.at(-1)?.no ?? 0) + 1, zaman: new Date().toISOString(), ...kayit };
  try {
    depo.setItem(ARSIV_ANAHTARI, JSON.stringify([...liste, yeni]));
    return { tamam: true, no: yeni.no, sayi: liste.length + 1 };
  } catch {
    return { tamam: false, hata: 'Tarayıcı deposu dolu. Tasarım raporlarını indirip saklayın; eski tasarımlar silinmedi.' };
  }
}

export function oyundaAc(depo, gorev) {
  try { depo.setItem(OYUN_ANAHTARI, JSON.stringify(gorev)); return true; } catch { return false; }
}

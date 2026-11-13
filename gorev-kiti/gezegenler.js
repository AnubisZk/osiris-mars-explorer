// ============================================================================
//  GEZEGENLER — Görev Kiti'nin bilimsel veri tablosu
//  Sorumlu rol: BİLİM DANIŞMANI
//
//  Bu dosyadaki her sayı gerçek bir ölçüme ya da kabul görmüş bir değere dayanır.
//  Bir sayıyı değiştirirsen, nereden aldığını "kaynak" satırına yaz ve
//  YZ-GUNLUGU.md dosyasına not düş. Yapay zekânın verdiği bir sayıyı
//  kaynağına bakmadan buraya yazma!
//
//  Birimler:
//    yercekimi_m_s2      → metre / saniye²   (Dünya'da 9.81)
//    havaYogunlugu_kg_m3 → kilogram / metreküp, yüzeyde (Dünya'da deniz seviyesinde 1.225)
//    olcekYuksekligi_m   → yükseldikçe havanın e (≈2,7) kat seyreldiği yükseklik
//    sesHizi_m_s         → rotor uçlarının bu hıza yaklaşması verimi düşürür
//    gazSabiti_J_kgK     → havanın özgül gaz sabiti R = 8,314 ÷ (mol kütlesi, kg/mol); ρ = p ÷ (R·T) için
// ============================================================================

export const GEZEGENLER = {
  dunya: {
    ad: 'Dünya',
    yercekimi_m_s2: 9.81,
    havaYogunlugu_kg_m3: 1.225,
    olcekYuksekligi_m: 8500,
    sesHizi_m_s: 340,
    gazSabiti_J_kgK: 287.05,
    isikGecikmesi: 'yok (pilot sahada)',
    gok: '#8ec5ff', sis: '#cfe6ff', zemin1: '#5f7f3a', zemin2: '#8a7a55',
    kaynak: 'Uluslararası Standart Atmosfer (ISA), deniz seviyesi',
  },
  mars: {
    ad: 'Mars',
    yercekimi_m_s2: 3.71,
    havaYogunlugu_kg_m3: 0.020,
    olcekYuksekligi_m: 11100,
    sesHizi_m_s: 240,
    gazSabiti_J_kgK: 191.8,
    isikGecikmesi: 'tek yön 3–22 dakika (gezegenlerin konumuna göre)',
    gok: '#d9a77c', sis: '#e3b48e', zemin1: '#a24f28', zemin2: '#c98a5a',
    kaynak: 'NASA Mars Fact Sheet; yüzey yoğunluğu mevsime göre ~0,015–0,020 kg/m³; ortalama mol kütlesi 43,34 g/mol (R = 191,8)',
  },
  ay: {
    ad: 'Ay',
    yercekimi_m_s2: 1.62,
    havaYogunlugu_kg_m3: 0,
    olcekYuksekligi_m: 1,
    sesHizi_m_s: 0,
    gazSabiti_J_kgK: 0,
    isikGecikmesi: 'tek yön yaklaşık 1,3 saniye',
    gok: '#05060a', sis: '#05060a', zemin1: '#6d6d6d', zemin2: '#a9a9a9',
    kaynak: 'NASA Moon Fact Sheet; Ay\'ın havası yok denecek kadar azdır, rotor çalışmaz',
  },
  titan: {
    ad: 'Titan (Satürn\'ün uydusu)',
    yercekimi_m_s2: 1.352,
    havaYogunlugu_kg_m3: 5.4,
    olcekYuksekligi_m: 20000,
    sesHizi_m_s: 195,
    gazSabiti_J_kgK: 290.7,
    isikGecikmesi: 'tek yön yaklaşık 70–90 dakika',
    gok: '#c98b3c', sis: '#d7a25a', zemin1: '#5a4630', zemin2: '#8c6f45',
    kaynak: 'Huygens sondası ölçümleri (2005); hava Dünya\'dakinin ~4,4 katı yoğun; R = p ÷ (ρ·T) ≈ 146 700 ÷ (5,4 × 93,7) ≈ 290 (Huygens yüzey değerleriyle)',
  },
  europa: {
    ad: 'Europa (Jüpiter\'in uydusu)',
    yercekimi_m_s2: 1.315,
    havaYogunlugu_kg_m3: 0,
    olcekYuksekligi_m: 1,
    sesHizi_m_s: 0,
    gazSabiti_J_kgK: 0,
    isikGecikmesi: 'tek yön yaklaşık 33–53 dakika',
    gok: '#020308', sis: '#020308', zemin1: '#b9c4cc', zemin2: '#8a6a55',
    kaynak: 'NASA Europa Fact Sheet; buz kabuk, havası yok denecek kadar az',
  },
};

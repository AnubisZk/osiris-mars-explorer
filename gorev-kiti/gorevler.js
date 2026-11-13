// ============================================================================
//  GÖREVLER — Görev Atölyesi'ndeki hazır görev kartları
//
//  Her görev, ayarlar.js dosyasındaki GOREV nesnesiyle AYNI yapıdadır.
//  Atölye sayfasında bir kart seçip "ayarlar.js'yi indir" dediğinde bu
//  dosyadaki görev, aşağıdaki ayarlarDosyasi() ile yazıya dökülür.
//
//  Oyunu bir görevle hızlıca denemek için adres çubuğuna ?gorev=titan
//  gibi bir ek yazabilirsin. Ek yoksa oyun ayarlar.js dosyasını kullanır.
// ============================================================================

export const GOREVLER = {
  ankara: {
    kimlik: 'ankara',
    baslik: 'Deprem Sonrası Keşif',
    zorluk: 1,
    gezegen: 'dunya',
    havaYogunlugu_kg_m3: 1.12, // Ankara ~940 m rakımda hava deniz seviyesinden biraz seyrek
    hikaye: 'Ankara yakınında bir deprem oldu. Yollar kapalı. Küçük keşif dronun üç noktaya uçup hasarı gözlemleyecek ve üsse dönecek. Bu, ilk uçuşun: kontrolleri burada öğren.',
    gercekGorev: 'AFAD ve itfaiye ekipleri afet bölgelerinde keşif dronları kullanır.',
    bilimNotu: 'Dünya\'da hava yoğun, yerçekimi güçlü. Küçük ve hızlı dönen pervaneler yeterli itki üretir.',
    arac: {
      ad: 'Keşif dronu (5 inç dört rotorlu)', tip: 'rotor',
      kutle_kg: 1.0, rotorAlani_m2: 0.0507, ucHizi_m_s: 200, rotorVerimi: 0.5, avyonikGucu_W: 5,
      batarya_Wh: 19, suruklenmeAlani_m2: 0.02, maksHiz_m_s: 14, maksEgim_derece: 30, guvenliInis_m_s: 2,
      renk: '#3fa9f5',
    },
    hedefler: [
      { ad: 'Çöken köprü', x: 90, z: -60, yaricap: 15, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
      { ad: 'Okul binası', x: -110, z: -120, yaricap: 15, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
      { ad: 'Su deposu', x: -40, z: 100, yaricap: 15, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 2, yon_derece: 90, artis_m_s_dk: 0 },
    gecikme_s: 0,
    sureSiniri_s: 0,
    arazi: { tohum: 11, krater: 0, tepe: 10 },
  },

  jezero: {
    kimlik: 'jezero',
    baslik: 'Jezero Krateri Keşfi',
    zorluk: 1,
    gezegen: 'mars',
    hikaye: 'Perseverance gezgini Jezero Krateri\'nde eski bir nehir deltasını inceliyor. Senin helikopterin gezginin önünden uçup üç ilginç kayayı gözlemleyecek, sonra üsse dönecek.',
    gercekGorev: 'NASA\'nın Ingenuity helikopteri 2021–2024 arasında Mars\'ta 72 uçuş yaptı. Kütlesi 1,8 kg, rotor çapı 1,2 m idi.',
    bilimNotu: 'Mars\'ın havası Dünya\'nınkinden yaklaşık 60 kat seyrek. Bu yüzden rotorlar çok büyük ve çok hızlı dönmek zorunda; yerçekimi ise Dünya\'nın üçte biri kadar.',
    arac: {
      ad: 'Mars helikopteri (Ingenuity benzeri)', tip: 'rotor',
      kutle_kg: 1.8, rotorAlani_m2: 2.26, ucHizi_m_s: 150, rotorVerimi: 0.2, avyonikGucu_W: 20,
      batarya_Wh: 30, suruklenmeAlani_m2: 0.06, maksHiz_m_s: 10, maksEgim_derece: 20, guvenliInis_m_s: 2,
      renk: '#d9d9d9',
    },
    hedefler: [
      { ad: 'Delta kayası', x: 80, z: -70, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Katmanlı kaya', x: 150, z: 40, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Krater kenarı', x: -60, z: 110, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 3, yon_derece: 270, artis_m_s_dk: 0 },
    gecikme_s: 0,
    sureSiniri_s: 0,
    arazi: { tohum: 7, krater: 30, tepe: 6 },
  },

  'toz-firtinasi': {
    kimlik: 'toz-firtinasi',
    baslik: 'Toz Fırtınası Gelmeden Dön',
    zorluk: 2,
    gezegen: 'mars',
    hikaye: 'Uydular büyük bir toz fırtınasının yaklaştığını bildirdi. Rüzgâr her dakika artıyor. Dört örnek alanını fırtına gelmeden gözlemle ve helikopteri üsse indir.',
    gercekGorev: 'Mars\'ta bazen tüm gezegeni saran toz fırtınaları olur. 2018\'deki fırtına Opportunity gezgininin sonunu getirdi.',
    bilimNotu: 'Seyrek havada rüzgârın itme kuvveti azdır, ama rotorun da itkisi azdır. Rüzgâra karşı uçmak bataryayı hızla tüketir.',
    arac: {
      ad: 'Mars helikopteri (Ingenuity benzeri)', tip: 'rotor',
      kutle_kg: 1.8, rotorAlani_m2: 2.26, ucHizi_m_s: 150, rotorVerimi: 0.2, avyonikGucu_W: 20,
      batarya_Wh: 30, suruklenmeAlani_m2: 0.06, maksHiz_m_s: 10, maksEgim_derece: 20, guvenliInis_m_s: 2,
      renk: '#d9d9d9',
    },
    hedefler: [
      { ad: 'Kum tepesi', x: 120, z: -90, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Toz şeytanı izi', x: 180, z: 60, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Kaya bloğu', x: 30, z: 160, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Eski kanal', x: -120, z: 40, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 4, yon_derece: 200, artis_m_s_dk: 1.5 },
    gecikme_s: 0,
    sureSiniri_s: 300,
    sureBittiMesaji: 'Toz fırtınası üsse ulaştı. Helikopter dışarıda kaldı.',
    arazi: { tohum: 23, krater: 18, tepe: 8 },
  },

  titan: {
    kimlik: 'titan',
    baslik: 'Titan Kumullarında Uçuş',
    zorluk: 1,
    gezegen: 'titan',
    hikaye: 'Satürn\'ün dev uydusu Titan\'dasın. Hava kalın, yerçekimi zayıf: uçmak için güneş sistemindeki en kolay yer! Üç bölgeden örnek gözlemi yap ve iniş alanına dön.',
    gercekGorev: 'NASA\'nın sekiz rotorlu Dragonfly aracının 2034\'te Titan\'a ulaşması planlanıyor.',
    bilimNotu: 'Titan\'ın havası Dünya\'nınkinden ~4 kat yoğun, yerçekimi ise ~7 kat zayıf. Aynı rotor burada çok daha az güçle uçar. Işık oraya ~80 dakikada gider: gerçek araç kendi kendine uçmak zorunda.',
    arac: {
      ad: 'Titan rotorlu iniş aracı (Dragonfly\'dan küçük)', tip: 'rotor',
      kutle_kg: 50, rotorAlani_m2: 2.0, ucHizi_m_s: 40, rotorVerimi: 0.5, avyonikGucu_W: 30,
      batarya_Wh: 60, suruklenmeAlani_m2: 0.8, maksHiz_m_s: 10, maksEgim_derece: 35, guvenliInis_m_s: 2,
      renk: '#f2c14e',
    },
    hedefler: [
      { ad: 'Kumul sırtı', x: 140, z: -40, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 4 },
      { ad: 'Organik kum', x: 60, z: 150, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 4 },
      { ad: 'Selk Krateri izi', x: -150, z: -80, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 4 },
    ],
    ruzgar: { hiz_m_s: 0.5, yon_derece: 90, artis_m_s_dk: 0 },
    gecikme_s: 0,
    sureSiniri_s: 0,
    arazi: { tohum: 5, krater: 4, tepe: 14 },
  },

  'ay-guney': {
    kimlik: 'ay-guney',
    baslik: 'Ay\'ın Güney Kutbu',
    zorluk: 2,
    gezegen: 'ay',
    hikaye: 'Ay\'ın güney kutbundaki karanlık kraterlerde su buzu olabilir. Roketli robot iniş aracın üç noktaya "zıplayarak" gidecek. Dikkat: komutların Ay\'a 1,3 saniyede ulaşıyor!',
    gercekGorev: 'Artemis programı astronotları Ay\'ın güney kutbu bölgesine indirmeyi hedefliyor; Hindistan\'ın Chandrayaan-3 aracı 2023\'te bu bölgenin yakınına indi.',
    bilimNotu: 'Ay\'da hava yok: rotor çalışmaz, paraşüt açılmaz, hava direnci yoktur. Bir kez hızlanırsan seni durduracak tek şey kendi roketindir.',
    arac: {
      ad: 'Robot iniş aracı (roketli)', tip: 'roket',
      kuruKutle_kg: 300, yakit_kg: 150, maksItki_N: 1500, isp_s: 300,
      suruklenmeAlani_m2: 0, maksHiz_m_s: 10, maksEgim_derece: 45, guvenliInis_m_s: 2,
      renk: '#e8e8e8',
    },
    hedefler: [
      { ad: 'Shackleton kenarı', x: 160, z: -60, yaricap: 18, maksIrtifa_m: 20, gozlemSuresi_s: 3 },
      { ad: 'Gölgeli krater (buz?)', x: 40, z: -190, yaricap: 18, maksIrtifa_m: 20, gozlemSuresi_s: 4 },
      { ad: 'Güneşli tepe', x: -150, z: 70, yaricap: 18, maksIrtifa_m: 20, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 0, yon_derece: 0, artis_m_s_dk: 0 },
    gecikme_s: 1.3,
    sureSiniri_s: 0,
    arazi: { tohum: 42, krater: 45, tepe: 7 },
  },

  europa: {
    kimlik: 'europa',
    baslik: 'Europa Buzunda Örnek Avı',
    zorluk: 3,
    gezegen: 'europa',
    hikaye: 'Jüpiter\'in uydusu Europa\'nın buz kabuğunun altında bir okyanus var. Yakıtın çok az: dört çatlak bölgesini gözlemle ve iniş alanına geri dön. Yakıtı akıllı kullan!',
    gercekGorev: 'NASA\'nın Europa Clipper aracı Europa\'yı yörüngeden incelemek için yolda. Bir iniş aracı henüz yalnızca tasarım aşamasında.',
    bilimNotu: 'Europa\'da da hava yok. Işık oraya 33–53 dakikada gider: gerçek bir iniş aracı tamamen otonom olmak zorundadır. Bu oyunda sen yerinde bir pilot gibisin.',
    arac: {
      ad: 'Europa iniş aracı (roketli)', tip: 'roket',
      kuruKutle_kg: 250, yakit_kg: 55, maksItki_N: 900, isp_s: 320,
      suruklenmeAlani_m2: 0, maksHiz_m_s: 10, maksEgim_derece: 45, guvenliInis_m_s: 1.8,
      renk: '#c9d7e3',
    },
    hedefler: [
      { ad: 'Kırmızı çatlak', x: 110, z: -100, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
      { ad: 'Kaos bölgesi', x: 170, z: 50, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
      { ad: 'Buz sırtı', x: -40, z: 150, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
      { ad: 'Tuz lekesi', x: -130, z: -50, yaricap: 16, maksIrtifa_m: 15, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 0, yon_derece: 0, artis_m_s_dk: 0 },
    gecikme_s: 0,
    sureSiniri_s: 0,
    arazi: { tohum: 99, krater: 10, tepe: 5 },
  },

  'mars-gunbatimi': {
    kimlik: 'mars-gunbatimi',
    baslik: 'Mars\'ta Gün Batmadan',
    zorluk: 3,
    gezegen: 'mars',
    hikaye: 'Güneş batmak üzere. Gece Mars\'ta sıcaklık −80 °C\'nin altına düşer ve batarya ısıtıcıya ayrılmalı. Küçük bataryayla dört hedefi gözlemle ve üsse dön.',
    gercekGorev: 'Ingenuity her gece bataryasının bir kısmını kendini ısıtmaya harcadı. Kış aylarında bu, uçuşları zorlaştırdı.',
    bilimNotu: 'Batarya enerjisi watt-saat (Wh) ile ölçülür. 300 W çeken bir helikopter 18 Wh\'lik bataryayı yaklaşık 3,5 dakikada bitirir.',
    arac: {
      ad: 'Mars helikopteri (küçük batarya)', tip: 'rotor',
      kutle_kg: 1.8, rotorAlani_m2: 2.26, ucHizi_m_s: 150, rotorVerimi: 0.2, avyonikGucu_W: 20,
      batarya_Wh: 18, suruklenmeAlani_m2: 0.06, maksHiz_m_s: 10, maksEgim_derece: 20, guvenliInis_m_s: 2,
      renk: '#d9d9d9',
    },
    hedefler: [
      { ad: 'Kuzey kayası', x: 40, z: -90, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Kumul', x: 100, z: -20, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Krater içi', x: 60, z: 80, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
      { ad: 'Güney yamacı', x: -50, z: 60, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
    ],
    ruzgar: { hiz_m_s: 2, yon_derece: 45, artis_m_s_dk: 0 },
    gecikme_s: 0,
    sureSiniri_s: 210,
    sureBittiMesaji: 'Güneş battı. Hava çok soğudu, batarya ısıtılamadı.',
    arazi: { tohum: 31, krater: 25, tepe: 6 },
  },
};

// ---------------------------------------------------------------- ayarlar.js üretici
// Bir görevi, öğrencinin rahatça okuyup değiştirebileceği ayarlar.js metnine çevirir.
const s = v => JSON.stringify(v);
const yon = d => ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'][Math.round(((d % 360) + 360) % 360 / 45) % 8];

export function ayarlarDosyasi(g) {
  const a = g.arac, roket = a.tip === 'roket';
  const satir = [];
  satir.push(`// ============================================================================
//  AYARLAR — SENİN GÖREVİN BURADA
//  Görev: ${g.baslik}
//
//  Oyunun her şeyi bu dosyadan okunur. Bir sayıyı değiştir, kaydet ve
//  tarayıcıda sayfayı yenile (F5): değişikliği hemen görürsün.
//
//  KURALLAR
//   • Tırnak içindeki yazıları ('...') istediğin gibi değiştirebilirsin.
//   • Sayıların yanındaki birimlere dikkat et: _kg kilogram, _m metre, _s saniye...
//   • Bir şey bozulursa sayfada kırmızı bir hata kutusu çıkar; son değişikliğini geri al.
//   • Bilimsel bir sayıyı değiştirdiysen nedenini YZ-GUNLUGU.md dosyasına yaz.
// ============================================================================

export const GOREV = {
  kimlik: ${s(g.kimlik)},

  // ---- HİKÂYE (Tasarımcı) ------------------------------------------------
  baslik: ${s(g.baslik)},
  hikaye: ${s(g.hikaye)},
  gercekGorev: ${s(g.gercekGorev)},
  bilimNotu: ${s(g.bilimNotu)},
  zorluk: ${g.zorluk},             // 1 = kolay, 2 = orta, 3 = zor

  // ---- DÜNYA (Bilim danışmanı) --------------------------------------------
  // gezegen: 'dunya' | 'mars' | 'ay' | 'titan' | 'europa'  (değerler gezegenler.js içinde)
  gezegen: ${s(g.gezegen)},`);
  if (g.yercekimi_m_s2 != null) satir.push(`  yercekimi_m_s2: ${g.yercekimi_m_s2},   // gezegenin değerini değiştirir`);
  if (g.havaYogunlugu_kg_m3 != null) satir.push(`  havaYogunlugu_kg_m3: ${g.havaYogunlugu_kg_m3},   // gezegenin yüzey değeri yerine bunu kullan`);
  satir.push(`
  // ---- ARAÇ (Bilim danışmanı + Kodcu) -------------------------------------
  arac: {
    ad: ${s(a.ad)},
    tip: ${s(a.tip)},              // 'rotor' (havası olan yerler) | 'roket' (her yerde)`);
  if (roket) satir.push(`    kuruKutle_kg: ${a.kuruKutle_kg},       // yakıt hariç kütle
    yakit_kg: ${a.yakit_kg},           // yakıt bitince motor durur
    maksItki_N: ${a.maksItki_N},        // motorun en büyük itkisi (newton)
    isp_s: ${a.isp_s},               // özgül itki: büyükse yakıt daha verimli kullanılır`);
  else satir.push(`    kutle_kg: ${a.kutle_kg},              // toplam kütle
    rotorAlani_m2: ${a.rotorAlani_m2},       // rotorların süpürdüğü toplam alan (π × r² × rotor sayısı)
    ucHizi_m_s: ${a.ucHizi_m_s},          // rotor ucunun hızı; ses hızına yaklaşmasın
    rotorVerimi: ${a.rotorVerimi},        // 0..1 arası; seyrek havada küçüktür
    avyonikGucu_W: ${a.avyonikGucu_W},       // bilgisayar, kamera vb. sürekli çeken güç
    batarya_Wh: ${a.batarya_Wh},          // batarya enerjisi (watt-saat)`);
  satir.push(`    suruklenmeAlani_m2: ${a.suruklenmeAlani_m2},  // hava direnci için Cd × alan (havasız yerde etkisiz)
    maksHiz_m_s: ${a.maksHiz_m_s},         // yardımcı pilotun izin verdiği en yüksek yatay hız
    maksEgim_derece: ${a.maksEgim_derece},     // aracın en fazla ne kadar eğilebileceği
    guvenliInis_m_s: ${a.guvenliInis_m_s},     // bundan hızlı yere değersen kaza olur
    renk: ${s(a.renk)},          // aracın rengi
  },

  // ---- HEDEFLER (Tasarımcı) -----------------------------------------------
  // x: doğu(+)/batı(−), z: güney(+)/kuzey(−), metre cinsinden. Üs (0, 0) noktasında.
  // Bir hedefi gözlemlemek için: yaricap içinde, maksIrtifa_m altında, yavaş (< 3 m/s)
  // ve gozlemSuresi_s kadar beklemen gerekir.
  hedefler: [`);
  for (const h of g.hedefler) satir.push(`    { ad: ${s(h.ad)}, x: ${h.x}, z: ${h.z}, yaricap: ${h.yaricap}, maksIrtifa_m: ${h.maksIrtifa_m}, gozlemSuresi_s: ${h.gozlemSuresi_s} },`);
  const r = g.ruzgar;
  satir.push(`  ],

  // ---- KOŞULLAR -------------------------------------------------------------
  ruzgar: { hiz_m_s: ${r.hiz_m_s}, yon_derece: ${r.yon_derece}, artis_m_s_dk: ${r.artis_m_s_dk} },  // ${r.hiz_m_s ? yon(r.yon_derece) + ' yönüne esiyor' : 'rüzgâr yok'}
  gecikme_s: ${g.gecikme_s},             // komutların araca ulaşma süresi (ışık gecikmesi)
  sureSiniri_s: ${g.sureSiniri_s},          // 0 = süre sınırı yok`);
  if (g.sureBittiMesaji) satir.push(`  sureBittiMesaji: ${s(g.sureBittiMesaji)},`);
  satir.push(`
  // ---- GERÇEK VERİ: DİJİTAL İKİZ (isteğe bağlı, bkz. VERI-IKIZI.md) ----------
  // Veri Atölyesi'nde (veri-atolyesi.html) gerçek ölçümlerden eğittiğiniz atmosfer modelini
  // kullanmak için modeli veri/ klasörüne koyun ve aşağıdaki satırı açın.
  // saat: görevin başladığı yerel güneş saati (0–24). Hava yoğunluğu ve rüzgâr modelden gelir.`);
  if (g.atmosfer) satir.push(`  atmosfer: { model: ${s(g.atmosfer.model)}, saat: ${g.atmosfer.saat} },`);
  else satir.push(`  // atmosfer: { model: 'veri/jezero-atmosfer.json', saat: 10 },`);
  satir.push(`
  // ---- ARAZİ (Tasarımcı) ----------------------------------------------------
  // Temsili, matematikle üretilmiş arazi. tohum'u değiştirince yeni bir arazi çıkar.
  arazi: { tohum: ${g.arazi.tohum}, krater: ${g.arazi.krater}, tepe: ${g.arazi.tepe} },
};
`);
  return satir.join('\n');
}

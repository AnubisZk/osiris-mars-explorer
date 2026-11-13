// ============================================================================
//  AYARLAR — SENİN GÖREVİN BURADA
//  Görev: Jezero Krateri Keşfi
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
  kimlik: "jezero",

  // ---- HİKÂYE (Tasarımcı) ------------------------------------------------
  baslik: "Jezero Krateri Keşfi",
  hikaye: "Perseverance gezgini Jezero Krateri'nde eski bir nehir deltasını inceliyor. Senin helikopterin gezginin önünden uçup üç ilginç kayayı gözlemleyecek, sonra üsse dönecek.",
  gercekGorev: "NASA'nın Ingenuity helikopteri 2021–2024 arasında Mars'ta 72 uçuş yaptı. Kütlesi 1,8 kg, rotor çapı 1,2 m idi.",
  bilimNotu: "Mars'ın havası Dünya'nınkinden yaklaşık 60 kat seyrek. Bu yüzden rotorlar çok büyük ve çok hızlı dönmek zorunda; yerçekimi ise Dünya'nın üçte biri kadar.",
  zorluk: 1,             // 1 = kolay, 2 = orta, 3 = zor

  // ---- DÜNYA (Bilim danışmanı) --------------------------------------------
  // gezegen: 'dunya' | 'mars' | 'ay' | 'titan' | 'europa'  (değerler gezegenler.js içinde)
  gezegen: "mars",

  // ---- ARAÇ (Bilim danışmanı + Kodcu) -------------------------------------
  arac: {
    ad: "Mars helikopteri (Ingenuity benzeri)",
    tip: "rotor",              // 'rotor' (havası olan yerler) | 'roket' (her yerde)
    kutle_kg: 1.8,              // toplam kütle
    rotorAlani_m2: 2.26,       // rotorların süpürdüğü toplam alan (π × r² × rotor sayısı)
    ucHizi_m_s: 150,          // rotor ucunun hızı; ses hızına yaklaşmasın
    rotorVerimi: 0.2,        // 0..1 arası; seyrek havada küçüktür
    avyonikGucu_W: 20,       // bilgisayar, kamera vb. sürekli çeken güç
    batarya_Wh: 30,          // batarya enerjisi (watt-saat)
    suruklenmeAlani_m2: 0.06,  // hava direnci için Cd × alan (havasız yerde etkisiz)
    maksHiz_m_s: 10,         // yardımcı pilotun izin verdiği en yüksek yatay hız
    maksEgim_derece: 20,     // aracın en fazla ne kadar eğilebileceği
    guvenliInis_m_s: 2,     // bundan hızlı yere değersen kaza olur
    renk: "#d9d9d9",          // aracın rengi
  },

  // ---- HEDEFLER (Tasarımcı) -----------------------------------------------
  // x: doğu(+)/batı(−), z: güney(+)/kuzey(−), metre cinsinden. Üs (0, 0) noktasında.
  // Bir hedefi gözlemlemek için: yaricap içinde, maksIrtifa_m altında, yavaş (< 3 m/s)
  // ve gozlemSuresi_s kadar beklemen gerekir.
  hedefler: [
    { ad: "Delta kayası", x: 80, z: -70, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
    { ad: "Katmanlı kaya", x: 150, z: 40, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
    { ad: "Krater kenarı", x: -60, z: 110, yaricap: 14, maksIrtifa_m: 12, gozlemSuresi_s: 3 },
  ],

  // ---- KOŞULLAR -------------------------------------------------------------
  ruzgar: { hiz_m_s: 3, yon_derece: 270, artis_m_s_dk: 0 },  // batı yönüne esiyor
  gecikme_s: 0,             // komutların araca ulaşma süresi (ışık gecikmesi)
  sureSiniri_s: 0,          // 0 = süre sınırı yok

  // ---- GERÇEK VERİ: DİJİTAL İKİZ (isteğe bağlı, bkz. VERI-IKIZI.md) ----------
  // Veri Atölyesi'nde (veri-atolyesi.html) gerçek ölçümlerden eğittiğiniz atmosfer modelini
  // kullanmak için modeli veri/ klasörüne koyun ve aşağıdaki satırı açın.
  // saat: görevin başladığı yerel güneş saati (0–24). Hava yoğunluğu ve rüzgâr modelden gelir.
  // atmosfer: { model: 'veri/jezero-atmosfer.json', saat: 10 },

  // ---- ARAZİ (Tasarımcı) ----------------------------------------------------
  // Temsili, matematikle üretilmiş arazi. tohum'u değiştirince yeni bir arazi çıkar.
  arazi: { tohum: 7, krater: 30, tepe: 6 },
};

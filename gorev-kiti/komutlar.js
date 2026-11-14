// ============================================================================
//  KOMUTLAR — yapay zekâ için hazır komut (prompt) paketi
//
//  Atölye sayfası bu listeyi gösterir ve {süslü parantez} içindeki yerleri
//  seçtiğiniz görevle doldurur. KOMUTLAR.md dosyası da bu listeden üretilir.
//
//  İyi bir komutun 5 parçası:
//   1. KİMSİN?      "Ben bir öğrenciyim, takımımla bir uzay oyunu yapıyoruz."
//   2. NE VAR?      Elinizdeki bilgi ya da kod (yapıştırın).
//   3. NE İSTİYORSUN? Tek ve açık bir iş.
//   4. NASIL?       Biçim: tablo, adım adım, yalnızca değişen satırlar...
//   5. KONTROL      "Kaynağını yaz", "emin değilsen söyle".
// ============================================================================

export const ASAMALAR = [
  { no: 0, ad: 'Depoyu kur', sure: '30 dk' },
  { no: 1, ad: 'Görevi anla', sure: '30 dk' },
  { no: 2, ad: 'Tasarla', sure: '45 dk' },
  { no: 3, ad: 'Kur', sure: '20 dk' },
  { no: 4, ad: 'Üret', sure: '2 saat' },
  { no: 5, ad: 'Test et', sure: '45 dk' },
  { no: 6, ad: 'Yayınla ve sun', sure: '40 dk' },
];

const BEN = 'Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor.';

export const KOMUTLAR = [
  // ---------------------------------------------------------------- 0
  { asama: 0, rol: 'Takım kaptanı', baslik: 'Ajanla depoyu doldur',
    metin: `Bu depo bir öğrenci takımının "Görev Kiti" projesi. Önce AGENTS.md dosyasını oku ve oradaki kurallara uy.

Görevimiz: "{baslik}" — {gezegen} üzerinde, araç: {arac}. Görevde {hedefSayisi} hedef var.
ayarlar.js şu anda bu görevin hazır ayarlarını içeriyor: gezegen = '{gezegenKimlik}'.

Senden istediklerimiz, sırayla:
0. AGENTS.md'deki şeffaflık kuralına göre bu komutu, işe başlamadan önce, KOMUT-KAYDI.md'ye kelimesi kelimesine kaydet ve commit et.
1. README.md, ayarlar.js, fizik.js ve gezegenler.js dosyalarını oku. fizik.js'teki denklemleri bize 5–6 maddede, bir lise öğrencisinin anlayacağı şekilde özetle.
2. FIZIK-HESAPLARI.md dosyasını görevimiz için doldur: her satır "formül → sayıları yerine koyma → sonuç (birimiyle)" olsun. Aracımız {arac}; kullanılmayan bölümün (3A rotor ya da 3B roket) başına "Bu görevde kullanılmıyor" yaz, silme.
3. "node hesapla.mjs" komutunu çalıştır. Çıktıdaki sonuçları defterin "Motorun sonucu" sütununa yaz, farkı yüzde olarak hesapla. Fark %1'den büyükse nedenini bul ve düzelt.
4. Ortam tablosundaki her değerin yanına güvenilir bir kaynak (NASA, ESA) bağlantısı yaz. Emin olmadığın değeri "emin değilim" diye işaretle.
5. Yaptığın her işi YZ-GUNLUGU.md'ye bir satır olarak ekle.
6. Her adımı ayrı, Türkçe mesajlı bir commit olarak kaydet; mesajların sonuna komut numarasını ekle.
7. İş bitince KOMUT-KAYDI.md'deki kaydı tamamla (yaptıkların, commit'ler, emin olmadıkların).
ayarlar.js, fizik.js ve hesap.js dosyalarında hiçbir şeyi değiştirme. Bitince bize neyi yaptığını ve hangi değerleri kendimizin kontrol etmesi gerektiğini listele.`,
    ipucu: 'Bu komut, depoya erişebilen bir kodlama ajanı içindir (ör. Claude Code, Codex, GitHub Copilot ajanı). Ajanın açtığı her değişikliği GitHub\'da "Commits" sekmesinden birlikte okuyun.' },
  { asama: 0, rol: 'Takım kaptanı', baslik: 'Asistanla hesap defterini yaz',
    metin: `${BEN} Görevimiz "{baslik}" — {gezegen} üzerinde, araç: {arac}.
Aşağıda oyunumuzun ayarlar.js dosyası var. Projemizdeki fizik motoru şu denklemleri kullanıyor:
- Ağırlık: W = m × g
- Rotor itkisi: T = 0,012 × ρ × A × v_uç²  ·  indüklenmiş hız: v_i = √(W ÷ (2ρA))  ·  askıda güç: P = W × v_i ÷ verim + avyonik  ·  süre: t = batarya × 3600 ÷ P
- Roket: ṁ = W ÷ (Isp × 9,807)  ·  süre: t = yakıt ÷ ṁ  ·  Δv = Isp × 9,807 × ln(m_dolu ÷ m_kuru)
- Rota: üs (0,0) → hedefler (sırayla) → üs; her ayak √(Δx² + Δz²)
- Süre tahmini: toplam yol ÷ maksHiz + ayak sayısı × 2 × 25 m ÷ dikey hız (rotor 3, roket 4 m/s) + gözlem süreleri

Bu bilgilerle bizim için bir "Fizik Hesap Defteri" yaz (Markdown). Bölümler: 1. Ortam, 2. Kütle ve ağırlık, 3. Rotor ya da roket hesapları (aracımıza göre), 4. Görev rotası (tablo), 5. Süre ve enerji/yakıt bütçesi. Her hesabı "formül → sayıları yerine koyma → sonuç (birimiyle)" biçiminde yaz. Kısa tut; açıklamayı hesapların altına bir cümleyle ekle.

[ayarlar.js dosyasının tamamını buraya yapıştırın]`,
    ipucu: 'Cevabı GitHub\'da FIZIK-HESAPLARI.md dosyasını düzenleyip (kalem simgesi) yapıştırın. Sonra oyunun "🧮 Hesaplar" sayfasıyla her sonucu karşılaştırın.' },
  { asama: 0, rol: 'Bilim danışmanı', baslik: 'Hesap farkını bul',
    metin: `${BEN} Bir hesabımızda yapay zekânın bulduğu sonuçla oyunun fizik motorunun bulduğu sonuç farklı çıktı.

Hesap defterimizdeki satır:
[DEFTERDEKİ SATIRI YAPIŞTIRIN — formül, yerine koyma, sonuç]

Oyunun "🧮 Hesaplar" sayfasındaki aynı satır:
[HESAPLAR SAYFASINDAKİ SATIRI YAPIŞTIRIN]

Hangi adımda ayrıldıklarını bul: yanlış sayı mı kullanılmış, birim mi karışmış, işlem sırası mı yanlış, yuvarlama mı? Doğrudan cevabı söylemek yerine bizim kontrol edebileceğimiz şekilde adım adım göster.`,
    ipucu: 'Hatayı bulduğunuzda YZ-GUNLUGU.md\'nin "Yapay zekânın yanıldığı yerler" bölümüne yazın: bu, değerlendirmede artı puandır.' },

  // ---------------------------------------------------------------- 1
  { asama: 1, rol: 'Bilim danışmanı', baslik: 'Gezegeni tanı',
    metin: `${BEN} Görevimiz {gezegen} üzerinde geçiyor.
{gezegen} için şu bilgileri bir tablo hâlinde ver:
- yüzeyde yerçekimi ivmesi (m/s²)
- yüzeyde hava yoğunluğu (kg/m³) ve havanın neyden oluştuğu
- yüzey sıcaklığı aralığı (°C)
- Dünya'dan gönderilen bir radyo sinyalinin oraya ulaşma süresi
Her değerin yanına güvenilir bir kaynağın adını yaz (NASA, ESA gibi). Emin olmadığın değeri "emin değilim" diye işaretle. Kısa ve anlaşılır yaz.`,
    ipucu: 'Gelen sayıları gezegenler.js dosyasındaki değerlerle karşılaştırın. Farklıysa kaynağına bakın ve günlüğe yazın.' },
  { asama: 1, rol: 'Tasarımcı', baslik: 'Gerçek görevleri öğren',
    metin: `${BEN} Görevimiz {gezegen} üzerinde geçiyor.
{gezegen}'e gönderilmiş ya da gönderilmesi planlanan, yüzeye inen veya uçan araçları listele. Her biri için: adı, hangi ajansın olduğu, yılı ve en ilginç başarısı (bir cümle). En fazla 6 araç yaz. Bilmediğin ya da emin olmadığın tarihleri uydurma, "emin değilim" yaz.`,
    ipucu: 'Bu listeden görevinize ilham verecek bir tane seçin ve tasarım belgesinin 1. bölümüne yazın.' },

  // ---------------------------------------------------------------- 2
  { asama: 2, rol: 'Tasarımcı', baslik: 'Hikâye yaz',
    metin: `${BEN} Görevimizin adı "{baslik}". {gezegen} üzerinde, {arac} ile geçiyor. Oyuncu birkaç hedefi gözlemleyip üsse dönüyor.
Oyunun başında oyuncunun okuyacağı 3–5 cümlelik bir görev hikâyesi yaz. 3 farklı seçenek ver: biri heyecanlı, biri bilimsel, biri gizemli olsun. 12 yaşındaki bir okurun anlayacağı bir dille yaz. Bilimsel olarak yanlış bir şey söyleme.`,
    ipucu: 'En beğendiğinizi seçin, kendi cümlelerinizle değiştirin. Hikâyedeki her bilimsel iddiayı bilim danışmanı kontrol etsin.' },
  { asama: 2, rol: 'Tasarımcı', baslik: 'Hedefleri seç',
    metin: `${BEN} Görevimiz {gezegen} üzerinde geçiyor. Uçan aracımız {hedefSayisi} noktayı gözlemleyecek.
{gezegen} yüzeyinde bilim insanlarının incelemek isteyeceği {hedefSayisi} türde yer öner. Her biri için:
- en fazla 3 kelimelik bir ad (oyunda etiket olarak görünecek)
- neden bilimsel olarak önemli olduğunu anlatan bir cümle
Gerçekte var olan yer türlerini kullan (krater, kumul, buz çatlağı gibi).`,
    ipucu: 'Hedefleri kâğıt haritaya yerleştirin: üs ortada, her kare 100 m. Sonra x ve z değerlerini tasarım belgesine yazın.' },
  { asama: 2, rol: 'Bilim danışmanı', baslik: 'Aracı boyutlandır',
    metin: `${BEN} Aracımız {gezegen} üzerinde uçacak. Yerçekimi {g} m/s², aracın kütlesi {kutle} kg.
1. Aracın ağırlığını (newton) hesapla. Formülü yaz, sonra sayıları yerine koy.
2. Aracın yerden kalkabilmesi için motorların en az ne kadar itki üretmesi gerektiğini açıkla.
3. Aynı araç Dünya'da olsaydı ağırlığı ne olurdu? Karşılaştır.
Her adımı ayrı göster. Sonucu ben de hesap makinesiyle kontrol edeceğim.`,
    ipucu: 'Sonucu hesap makinesiyle kendiniz de bulun. Sonra oyunun giriş ekranındaki "Kütle → ağırlık" değeriyle karşılaştırın.' },

  // ---------------------------------------------------------------- 3
  { asama: 3, rol: 'Kodcu', baslik: 'Kiti anla',
    metin: `${BEN} Aşağıda oyunumuzun ayarlar.js dosyası var. Bu dosyayı bir lise öğrencisine anlatır gibi açıkla:
- Dosyada hangi bölümler var, her biri oyunda neyi değiştiriyor?
- "arac" bölümündeki her ayarın gerçek hayatta neye karşılık geldiğini bir cümleyle söyle.
- Yeni başlayan biri bu dosyada hangi 3 şeyi güvenle değiştirebilir?
Kodu yeniden yazma, sadece açıkla.

[ayarlar.js dosyasının tamamını buraya yapıştırın]`,
    ipucu: 'Anlamadığınız bir satır kalırsa sadece o satırı yapıştırıp tekrar sorun.' },

  // ---------------------------------------------------------------- 4
  { asama: 4, rol: 'Kodcu', baslik: 'Görevi ayarlar.js\'e yaz',
    metin: `${BEN} Aşağıda oyunumuzun ayarlar.js dosyası ve takımımızın tasarım kararları var.
ayarlar.js dosyasını tasarımımıza göre güncelle. Kurallar:
- Alan adlarını (baslik, arac, hedefler...) ve dosyanın yapısını DEĞİŞTİRME, yalnızca değerleri değiştir.
- Birimleri koru (_kg kilogram, _m metre, _s saniye).
- Sonunda, değiştirdiğin her satırı ayrı bir liste hâlinde göster.

Tasarım kararlarımız:
- Görev adı: {baslik}
- Gezegen: {gezegenKimlik}
- Hikâye: [tasarım belgesinden yapıştırın]
- Hedefler (ad, x, z): [tasarım belgesinden yapıştırın]
- Araç: [tasarım belgesinden yapıştırın]

[ayarlar.js dosyasının tamamını buraya yapıştırın]`,
    ipucu: 'Yeni dosyayı kaydetmeden önce değişen satırlar listesini takımca okuyun. Bilim danışmanı sayıları onaylasın.' },
  { asama: 4, rol: 'Kodcu', baslik: 'Yeni özellik ekle',
    metin: `${BEN} Oyunun ekran ve kontrol kodu oyun.js dosyasında. Fizik hesabı ayrı bir dosyada (fizik.js); ona dokunmak istemiyoruz.
oyun.js'e şu özelliği eklemek istiyoruz: [ÖZELLİĞİ YAZIN — örnekler: "motor sesi: itki arttıkça yükselen bir uğultu, Web Audio API ile, dışarıdan ses dosyası kullanmadan" / "her hedefin ortasına dönen bir kaya modeli" / "görev tamamlanınca ekranda konfeti"].
- Tüm dosyayı yeniden yazma. Hangi satırın altına hangi kodu eklemem gerektiğini göster.
- Eklediğin her satırın ne yaptığını Türkçe bir yorumla açıkla.
- three.js zaten "import * as THREE from 'three'" ile yüklü.

[oyun.js'in ilgili kısmını buraya yapıştırın]`,
    ipucu: 'Önce mevcut hâli commit edin: Git eskisini saklar, kopya dosya açmanıza gerek kalmaz. Ekledikten sonra oyunu açıp deneyin; bozulursa kırmızı kutudaki yazıyla "Hata ayıkla" komutunu kullanın.' },
  { asama: 4, rol: 'Kodcu', baslik: 'Hata ayıkla',
    metin: `${BEN} Oyunumuzda bir hata var.
Hata mesajı (kırmızı kutuda ya da F12 → Console'da gördüğümüz):
[HATA MESAJINI BURAYA YAPIŞTIRIN]

Son değiştirdiğimiz kod:
[DEĞİŞTİRDİĞİNİZ SATIRLARI BURAYA YAPIŞTIRIN]

1. Hatanın nedenini bir öğrenciye anlatır gibi açıkla.
2. Düzeltilmiş kodu göster, yalnızca değişen satırları.
3. Bir dahaki sefere bu hatayı nasıl önleyebileceğimizi bir cümleyle söyle.`,
    ipucu: 'Düzeltmeyi uygulamadan önce açıklamayı anladığınızdan emin olun. Bu hatayı günlüğün "yanıldığı yerler" bölümüne değil, kayıtlar bölümüne yazın.' },
  { asama: 4, rol: 'Tasarımcı', baslik: 'Kapak görseli',
    metin: `Bir oyun kapak görseli için görsel üretme aracına verilecek bir komut yaz (İngilizce, en fazla 60 kelime).
Görsel: {gezegen} yüzeyinde, {arac} uçarken. Hikâye: {hikaye}
Gerçekçi bilimsel illüstrasyon tarzında olsun. Gökyüzünün ve zeminin rengi {gezegen} için bilimsel olarak doğru olsun. Görselde yazı, logo ya da gerçek bir kişi olmasın.`,
    ipucu: 'Görsel üretme araçlarını öğretmeninizin hesabından kullanın. Ürettiğiniz görseli kullanırsanız günlüğe "yapay zekâyla üretildi" diye yazın.' },

  { asama: 4, rol: 'Bilim danışmanı', baslik: 'Veri dosyasını anla (dijital ikiz)',
    metin: `${BEN} Oyunumuzun havasını NASA'nın Perseverance gezginindeki MEDA hava istasyonunun gerçek ölçümleriyle besleyeceğiz (bkz. VERI-IKIZI.md).
Aşağıda indirdiğimiz bir MEDA dosyasının XML etiketinden (label) bir bölüm ve CSV dosyasının ilk birkaç satırı var.
1. Her sütunun ne olduğunu ve birimini bir tablo hâlinde açıkla.
2. Hangi sütun yerel güneş saati (LTST), hangisi basınç, hava sıcaklığı, rüzgâr hızı ve rüzgâr yönü? Birimleri ne?
3. Eksik ya da geçersiz değerler nasıl gösterilmiş olabilir?
Emin olmadığın yerde tahmin yürütme, "XML'de bu bilgi yok" de.

[XML ETİKETİNDEN SÜTUN TANIMLARINI BURAYA YAPIŞTIRIN]

[CSV DOSYASININ İLK 5 SATIRINI BURAYA YAPIŞTIRIN]`,
    ipucu: 'Cevabı XML dosyasının kendisiyle karşılaştırın: sütun adı ve birim XML\'de yazandan farklıysa XML doğrudur. Sonra Veri Atölyesi\'nde sütunları buna göre eşleştirin.' },
  { asama: 4, rol: 'Bilim danışmanı', baslik: 'Modeli yorumla (dijital ikiz)',
    metin: `${BEN} Veri Atölyesi'nde gerçek Mars ölçümlerinden bir "günlük döngü" modeli eğittik: f(t) = a0 + a1·cos(2πt/24) + b1·sin(2πt/24) + ... (t = yerel güneş saati), katsayıları en küçük kareler yöntemiyle bulundu.
Sonuçlarımız (harmonik sayısı → RMSE ve R²):
[TABLOYU BURAYA YAPIŞTIRIN]
1. RMSE ve R²'yi bir lise öğrencisinin anlayacağı şekilde açıkla.
2. Harmonik sayısı arttıkça RMSE azalıyorsa bu modelin hep daha iyi olduğu anlamına mı gelir? Aşırı öğrenmeyi bizim örneğimizle açıkla.
3. Bu modelin sınırları neler? (yer, mevsim, ani olaylar)
4. Hangi harmonik sayısını seçmemiz mantıklı olur? Kararı bize bırak, sadece neye bakmamız gerektiğini söyle.`,
    ipucu: 'Seçiminizi ve gerekçenizi VERI-IKIZI.md\'deki "Seçtiğimiz harmonik sayısı" satırına kendi cümlelerinizle yazın.' },

  // ---------------------------------------------------------------- 5
  { asama: 5, rol: 'Bilim danışmanı', baslik: 'Sonuçları yorumla',
    metin: `${BEN} Oyunumuzun fizik motoru bu formülleri kullanıyor:
- Rotorun en büyük itkisi: T = 0,012 × ρ × A × (uç hızı)²
- Askıda kalmak için gereken güç: P = T × √(T / (2ρA)) / verim
Bizim aracımız {gezegen} üzerinde ve oyun şu değerleri gösteriyor: [GİRİŞ EKRANINDAKİ İTKİ/AĞIRLIK, ASKIDA KALMA GÜCÜ VE SÜRESİNİ YAPIŞTIRIN].
1. Bu formüllerdeki her harfin ne anlama geldiğini açıkla.
2. Hava yoğunluğu (ρ) azalınca itki ve güç neden değişiyor?
3. Değerlerimiz gerçek bir araçla (örneğin Ingenuity askıda yaklaşık 350 W harcıyordu) karşılaştırıldığında makul mü?`,
    ipucu: 'Bu açıklamayı tasarım belgesinin 3. bölümüne kendi cümlelerinizle özetleyin.' },
  { asama: 5, rol: 'Bilim danışmanı', baslik: 'Yapay zekâyı denetle',
    metin: `${BEN} Bir yapay zekâ bize şu bilgiyi verdi:
"[KONTROL ETMEK İSTEDİĞİNİZ BİLGİYİ YAPIŞTIRIN]"
Bu bilgiyi doğrulamak için hangi güvenilir kaynaklara bakmalıyız? Bu bilgide hata olma ihtimali olan yerler neler? Doğrudan "doğru" ya da "yanlış" demek yerine, bizim nasıl kontrol edebileceğimizi anlat.`,
    ipucu: 'Önerilen kaynağa gerçekten gidin ve okuyun. Yapay zekâya "kontrol ettim" dedirtmek kontrol etmek değildir.' },
  { asama: 5, rol: 'Bilim danışmanı', baslik: 'Fabrika tasarımını denetle',
    metin: `${BEN} Görev Fabrikası'nda (fabrika.html) {gezegen} için bir araç tasarladık. Sayfanın verdiği kütle dökümü ve kontroller:
[TASARIM-RAPORU.md'NİN "2. Cihaz tasarımı" BÖLÜMÜNÜ BURAYA YAPIŞTIRIN]
1. Her parçanın kütlesini gerçek bir araçla (ör. Ingenuity: toplam yaklaşık 1,8 kg) karşılaştır; makul olmayan görünenleri işaretle.
2. Kontrollerdeki her kuralın (itki/ağırlık, uç Mach, enerji bütçesi, rüzgâr dayanımı) fiziksel anlamını bir cümleyle açıkla.
3. Bu tasarımın en zayıf yeri neresi? Kararı bize bırak; neye bakmamız gerektiğini söyle.
Bilmediğin bir sayıyı uydurma; kaynak önerirken "doğrulayın" de.`,
    ipucu: 'Yapay zekânın karşılaştırdığı gerçek değerlerin kaynağını bulun ve TASARIM-RAPORU.md\'nin "Takımın kontrolü" kutularını doldurun.' },
  { asama: 5, rol: 'Bilim danışmanı', baslik: 'Stres testini yorumla',
    metin: `${BEN} Aracımızı Görev Fabrikası'nın stres testinde (Monte Carlo) aşırı koşullarda defalarca uçurduk. Sonuç tablosu:
[TASARIM-RAPORU.md'NİN "5. Stres testi" TABLOSUNU BURAYA YAPIŞTIRIN]
1. "%95 güven aralığı" sütununu bir ortaokul öğrencisine anlatır gibi açıkla. Deneme sayısını artırırsak ne olur?
2. Başarısızlık nedenlerine bakarak aracın hangi özelliğini değiştirmeyi düşünmeliyiz? Birkaç seçenek söyle, seçimi bize bırak.
3. Bu testin sınırları neler? (otopilot, basitleştirilmiş kütle modeli, atmosfer modelinin hatası)`,
    ipucu: 'Önerilerden birini Fabrika\'da deneyin, stres testini yeniden çalıştırın ve iki sonucu karşılaştırın. Her iki tasarım da arşivde kalır.' },

  // ---------------------------------------------------------------- 6
  { asama: 6, rol: 'Sunucu', baslik: 'Sunum planı',
    metin: `${BEN} Projemizi 5 dakikada jüriye sunacağız. Görevimiz: "{baslik}" ({gezegen}).
Bize 5 dakikalık bir sunum planı yap. Bölümler: görev ve hikâye (1 dk), bilim — neden bu araç bu gezegende uçabiliyor (1 dk), canlı oyun gösterimi (1,5 dk), yapay zekâyı nasıl kullandık ve nerede yanıldığını nasıl yakaladık (1 dk), ne öğrendik (0,5 dk).
Her bölüm için kimin konuşacağını boş bırak, söylenecek 2–3 ana fikri madde olarak yaz. Tam metin yazma; kendi cümlelerimizle konuşacağız.`,
    ipucu: 'Sunumu en az bir kez süre tutarak prova edin.' },
  { asama: 6, rol: 'Sunucu', baslik: 'Jüri soruları',
    metin: `${BEN} Görevimiz "{baslik}" ({gezegen}, {arac}). Jüri üyeleri bilim insanları ve öğretmenler.
Bize sorulabilecek 6 zor soru yaz: 2'si bilim, 2'si kod, 2'si yapay zekâ kullanımı hakkında olsun. Cevapları YAZMA; cevapları biz hazırlayacağız.`,
    ipucu: 'Her soruyu bir takım arkadaşınız cevaplasın, diğerleri yorum yapsın.' },
];

// Her hazır komutun kalıcı kodu: K<aşama>.<sıra> (ör. K0.1). Komut kaydında hangi hazır
// komutun kullanıldığını gösterir.
KOMUTLAR.forEach(k => { k.kod = `K${k.asama}.${KOMUTLAR.filter(x => x.asama === k.asama).indexOf(k) + 1}`; });
export const komutBasligi = k => `[Hazır komut ${k.kod} · ${k.baslik} · Görev Atölyesi]`;

// Komuttaki {yer tutucu}ları bir görevle doldurur
export function komutuDoldur(metin, gorev, gezegenAdi) {
  const a = gorev?.arac ?? {};
  const kutle = a.tip === 'roket' ? (a.kuruKutle_kg ?? 0) + (a.yakit_kg ?? 0) : a.kutle_kg;
  const degerler = {
    baslik: gorev?.baslik ?? '[görevin adı]',
    gezegen: gezegenAdi ?? '[gezegen]',
    gezegenKimlik: gorev?.gezegen ?? '[gezegen]',
    arac: a.ad ?? '[araç]',
    hikaye: gorev?.hikaye ?? '[hikâye]',
    hedefSayisi: gorev?.hedefler?.length ?? 3,
    kutle: kutle ?? '[kütle]',
    g: gorev?._g ?? '[yerçekimi]',
  };
  return metin.replace(/\{(\w+)\}/g, (t, k) => (k in degerler ? String(degerler[k]) : t));
}

// KOMUTLAR.md metnini üretir (yer tutucular köşeli parantezli kalır)
export function komutlarMd() {
  const s = ['# Yapay Zekâ Komut Paketi', '',
    '> Bu komutları kopyalayıp yapay zekâ aracına yapıştırın. `{süslü parantezli}` yerleri kendi görevinizle doldurun',
    '> (atölye sayfasında bir görev seçerseniz bunlar otomatik dolar). `[KÖŞELİ PARANTEZLİ]` yerlere kendi bilgilerinizi yapıştırın.',
    '>', '> Her kullanımı **YZ-GUNLUGU.md** dosyasına yazmayı unutmayın.', '',
    '## İyi bir komutun 5 parçası', '',
    '1. **Kimsin?** — "Ben bir öğrenciyim, takımımla bir uzay oyunu yapıyoruz."',
    '2. **Ne var?** — Elinizdeki bilgiyi ya da kodu yapıştırın.',
    '3. **Ne istiyorsun?** — Tek ve açık bir iş isteyin.',
    '4. **Nasıl?** — Biçimi söyleyin: tablo, adım adım, yalnızca değişen satırlar.',
    '5. **Kontrol** — "Kaynağını yaz", "emin değilsen söyle" deyin.', '',
    '## Yapay zekâ kuralları', '',
    '- Yapay zekâ **yanılabilir**: özellikle sayılarda, tarihlerde ve kaynak adlarında. Her sayıyı kontrol edin.',
    '- Anlamadığınız kodu yapıştırmayın: önce "bu kodu açıkla" deyin.',
    '- Ad soyad, okul numarası, adres, telefon, fotoğraf gibi kişisel bilgileri yazmayın.',
    '- Hesaplar öğretmeninizindir; araçları onun gözetiminde kullanın.',
    '- Her komutun ilk satırındaki `[Hazır komut Kx.y ...]` kodunu silmeyin: ajanlar komutları KOMUT-KAYDI.md\'ye bu kodla kaydeder.', ''];
  for (const a of ASAMALAR) {
    s.push(`## Aşama ${a.no} — ${a.ad} (${a.sure})`, '');
    for (const k of KOMUTLAR.filter(k => k.asama === a.no)) {
      s.push(`### ${k.kod} · ${k.baslik} · *${k.rol}*`, '', '```', komutBasligi(k), k.metin, '```', '', `💡 ${k.ipucu}`, '');
    }
  }
  return s.join('\n');
}

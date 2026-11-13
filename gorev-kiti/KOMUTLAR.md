# Yapay Zekâ Komut Paketi

> Bu komutları kopyalayıp yapay zekâ aracına yapıştırın. `{süslü parantezli}` yerleri kendi görevinizle doldurun
> (atölye sayfasında bir görev seçerseniz bunlar otomatik dolar). `[KÖŞELİ PARANTEZLİ]` yerlere kendi bilgilerinizi yapıştırın.
>
> Her kullanımı **YZ-GUNLUGU.md** dosyasına yazmayı unutmayın.

## İyi bir komutun 5 parçası

1. **Kimsin?** — "Ben bir öğrenciyim, takımımla bir uzay oyunu yapıyoruz."
2. **Ne var?** — Elinizdeki bilgiyi ya da kodu yapıştırın.
3. **Ne istiyorsun?** — Tek ve açık bir iş isteyin.
4. **Nasıl?** — Biçimi söyleyin: tablo, adım adım, yalnızca değişen satırlar.
5. **Kontrol** — "Kaynağını yaz", "emin değilsen söyle" deyin.

## Yapay zekâ kuralları

- Yapay zekâ **yanılabilir**: özellikle sayılarda, tarihlerde ve kaynak adlarında. Her sayıyı kontrol edin.
- Anlamadığınız kodu yapıştırmayın: önce "bu kodu açıkla" deyin.
- Ad soyad, okul numarası, adres, telefon, fotoğraf gibi kişisel bilgileri yazmayın.
- Hesaplar öğretmeninizindir; araçları onun gözetiminde kullanın.

## Aşama 0 — Depoyu kur (30 dk)

### Ajanla depoyu doldur · *Takım kaptanı*

```
Bu depo bir öğrenci takımının "Görev Kiti" projesi. Önce AGENTS.md dosyasını oku ve oradaki kurallara uy.

Görevimiz: "{baslik}" — {gezegen} üzerinde, araç: {arac}. Görevde {hedefSayisi} hedef var.
ayarlar.js şu anda bu görevin hazır ayarlarını içeriyor: gezegen = '{gezegenKimlik}'.

Senden istediklerimiz, sırayla:
1. README.md, ayarlar.js, fizik.js ve gezegenler.js dosyalarını oku. fizik.js'teki denklemleri bize 5–6 maddede, bir lise öğrencisinin anlayacağı şekilde özetle.
2. FIZIK-HESAPLARI.md dosyasını görevimiz için doldur: her satır "formül → sayıları yerine koyma → sonuç (birimiyle)" olsun. Aracımız {arac}; kullanılmayan bölümü (3A rotor ya da 3B roket) sil.
3. "node hesapla.mjs" komutunu çalıştır. Çıktıdaki sonuçları defterin "Motorun sonucu" sütununa yaz, farkı yüzde olarak hesapla. Fark %1'den büyükse nedenini bul ve düzelt.
4. Ortam tablosundaki her değerin yanına güvenilir bir kaynak (NASA, ESA) bağlantısı yaz. Emin olmadığın değeri "emin değilim" diye işaretle.
5. Yaptığın her işi YZ-GUNLUGU.md'ye bir satır olarak ekle.
6. Her adımı ayrı, Türkçe mesajlı bir commit olarak kaydet.
ayarlar.js, fizik.js ve hesap.js dosyalarında hiçbir şeyi değiştirme. Bitince bize neyi yaptığını ve hangi değerleri kendimizin kontrol etmesi gerektiğini listele.
```

💡 Bu komut, depoya erişebilen bir kodlama ajanı içindir (ör. Claude Code, Codex, GitHub Copilot ajanı). Ajanın açtığı her değişikliği GitHub'da "Commits" sekmesinden birlikte okuyun.

### Asistanla hesap defterini yaz · *Takım kaptanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimiz "{baslik}" — {gezegen} üzerinde, araç: {arac}.
Aşağıda oyunumuzun ayarlar.js dosyası var. Projemizdeki fizik motoru şu denklemleri kullanıyor:
- Ağırlık: W = m × g
- Rotor itkisi: T = 0,012 × ρ × A × v_uç²  ·  indüklenmiş hız: v_i = √(W ÷ (2ρA))  ·  askıda güç: P = W × v_i ÷ verim + avyonik  ·  süre: t = batarya × 3600 ÷ P
- Roket: ṁ = W ÷ (Isp × 9,807)  ·  süre: t = yakıt ÷ ṁ  ·  Δv = Isp × 9,807 × ln(m_dolu ÷ m_kuru)
- Rota: üs (0,0) → hedefler (sırayla) → üs; her ayak √(Δx² + Δz²)
- Süre tahmini: toplam yol ÷ maksHiz + ayak sayısı × 2 × 25 m ÷ dikey hız (rotor 3, roket 4 m/s) + gözlem süreleri

Bu bilgilerle bizim için bir "Fizik Hesap Defteri" yaz (Markdown). Bölümler: 1. Ortam, 2. Kütle ve ağırlık, 3. Rotor ya da roket hesapları (aracımıza göre), 4. Görev rotası (tablo), 5. Süre ve enerji/yakıt bütçesi. Her hesabı "formül → sayıları yerine koyma → sonuç (birimiyle)" biçiminde yaz. Kısa tut; açıklamayı hesapların altına bir cümleyle ekle.

[ayarlar.js dosyasının tamamını buraya yapıştırın]
```

💡 Cevabı GitHub'da FIZIK-HESAPLARI.md dosyasını düzenleyip (kalem simgesi) yapıştırın. Sonra oyunun "🧮 Hesaplar" sayfasıyla her sonucu karşılaştırın.

### Hesap farkını bul · *Bilim danışmanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Bir hesabımızda yapay zekânın bulduğu sonuçla oyunun fizik motorunun bulduğu sonuç farklı çıktı.

Hesap defterimizdeki satır:
[DEFTERDEKİ SATIRI YAPIŞTIRIN — formül, yerine koyma, sonuç]

Oyunun "🧮 Hesaplar" sayfasındaki aynı satır:
[HESAPLAR SAYFASINDAKİ SATIRI YAPIŞTIRIN]

Hangi adımda ayrıldıklarını bul: yanlış sayı mı kullanılmış, birim mi karışmış, işlem sırası mı yanlış, yuvarlama mı? Doğrudan cevabı söylemek yerine bizim kontrol edebileceğimiz şekilde adım adım göster.
```

💡 Hatayı bulduğunuzda YZ-GUNLUGU.md'nin "Yapay zekânın yanıldığı yerler" bölümüne yazın: bu, değerlendirmede artı puandır.

## Aşama 1 — Görevi anla (30 dk)

### Gezegeni tanı · *Bilim danışmanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimiz {gezegen} üzerinde geçiyor.
{gezegen} için şu bilgileri bir tablo hâlinde ver:
- yüzeyde yerçekimi ivmesi (m/s²)
- yüzeyde hava yoğunluğu (kg/m³) ve havanın neyden oluştuğu
- yüzey sıcaklığı aralığı (°C)
- Dünya'dan gönderilen bir radyo sinyalinin oraya ulaşma süresi
Her değerin yanına güvenilir bir kaynağın adını yaz (NASA, ESA gibi). Emin olmadığın değeri "emin değilim" diye işaretle. Kısa ve anlaşılır yaz.
```

💡 Gelen sayıları gezegenler.js dosyasındaki değerlerle karşılaştırın. Farklıysa kaynağına bakın ve günlüğe yazın.

### Gerçek görevleri öğren · *Tasarımcı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimiz {gezegen} üzerinde geçiyor.
{gezegen}'e gönderilmiş ya da gönderilmesi planlanan, yüzeye inen veya uçan araçları listele. Her biri için: adı, hangi ajansın olduğu, yılı ve en ilginç başarısı (bir cümle). En fazla 6 araç yaz. Bilmediğin ya da emin olmadığın tarihleri uydurma, "emin değilim" yaz.
```

💡 Bu listeden görevinize ilham verecek bir tane seçin ve tasarım belgesinin 1. bölümüne yazın.

## Aşama 2 — Tasarla (45 dk)

### Hikâye yaz · *Tasarımcı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimizin adı "{baslik}". {gezegen} üzerinde, {arac} ile geçiyor. Oyuncu birkaç hedefi gözlemleyip üsse dönüyor.
Oyunun başında oyuncunun okuyacağı 3–5 cümlelik bir görev hikâyesi yaz. 3 farklı seçenek ver: biri heyecanlı, biri bilimsel, biri gizemli olsun. 12 yaşındaki bir okurun anlayacağı bir dille yaz. Bilimsel olarak yanlış bir şey söyleme.
```

💡 En beğendiğinizi seçin, kendi cümlelerinizle değiştirin. Hikâyedeki her bilimsel iddiayı bilim danışmanı kontrol etsin.

### Hedefleri seç · *Tasarımcı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimiz {gezegen} üzerinde geçiyor. Uçan aracımız {hedefSayisi} noktayı gözlemleyecek.
{gezegen} yüzeyinde bilim insanlarının incelemek isteyeceği {hedefSayisi} türde yer öner. Her biri için:
- en fazla 3 kelimelik bir ad (oyunda etiket olarak görünecek)
- neden bilimsel olarak önemli olduğunu anlatan bir cümle
Gerçekte var olan yer türlerini kullan (krater, kumul, buz çatlağı gibi).
```

💡 Hedefleri kâğıt haritaya yerleştirin: üs ortada, her kare 100 m. Sonra x ve z değerlerini tasarım belgesine yazın.

### Aracı boyutlandır · *Bilim danışmanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Aracımız {gezegen} üzerinde uçacak. Yerçekimi {g} m/s², aracın kütlesi {kutle} kg.
1. Aracın ağırlığını (newton) hesapla. Formülü yaz, sonra sayıları yerine koy.
2. Aracın yerden kalkabilmesi için motorların en az ne kadar itki üretmesi gerektiğini açıkla.
3. Aynı araç Dünya'da olsaydı ağırlığı ne olurdu? Karşılaştır.
Her adımı ayrı göster. Sonucu ben de hesap makinesiyle kontrol edeceğim.
```

💡 Sonucu hesap makinesiyle kendiniz de bulun. Sonra oyunun giriş ekranındaki "Kütle → ağırlık" değeriyle karşılaştırın.

## Aşama 3 — Kur (20 dk)

### Kiti anla · *Kodcu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Aşağıda oyunumuzun ayarlar.js dosyası var. Bu dosyayı bir lise öğrencisine anlatır gibi açıkla:
- Dosyada hangi bölümler var, her biri oyunda neyi değiştiriyor?
- "arac" bölümündeki her ayarın gerçek hayatta neye karşılık geldiğini bir cümleyle söyle.
- Yeni başlayan biri bu dosyada hangi 3 şeyi güvenle değiştirebilir?
Kodu yeniden yazma, sadece açıkla.

[ayarlar.js dosyasının tamamını buraya yapıştırın]
```

💡 Anlamadığınız bir satır kalırsa sadece o satırı yapıştırıp tekrar sorun.

## Aşama 4 — Üret (2 saat)

### Görevi ayarlar.js'e yaz · *Kodcu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Aşağıda oyunumuzun ayarlar.js dosyası ve takımımızın tasarım kararları var.
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

[ayarlar.js dosyasının tamamını buraya yapıştırın]
```

💡 Yeni dosyayı kaydetmeden önce değişen satırlar listesini takımca okuyun. Bilim danışmanı sayıları onaylasın.

### Yeni özellik ekle · *Kodcu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Oyunun ekran ve kontrol kodu oyun.js dosyasında. Fizik hesabı ayrı bir dosyada (fizik.js); ona dokunmak istemiyoruz.
oyun.js'e şu özelliği eklemek istiyoruz: [ÖZELLİĞİ YAZIN — örnekler: "motor sesi: itki arttıkça yükselen bir uğultu, Web Audio API ile, dışarıdan ses dosyası kullanmadan" / "her hedefin ortasına dönen bir kaya modeli" / "görev tamamlanınca ekranda konfeti"].
- Tüm dosyayı yeniden yazma. Hangi satırın altına hangi kodu eklemem gerektiğini göster.
- Eklediğin her satırın ne yaptığını Türkçe bir yorumla açıkla.
- three.js zaten "import * as THREE from 'three'" ile yüklü.

[oyun.js'in ilgili kısmını buraya yapıştırın]
```

💡 Önce dosyanın bir kopyasını alın (ör. oyun-yedek.js). Ekledikten sonra oyunu açıp deneyin; bozulursa kırmızı kutudaki yazıyla "Hata ayıkla" komutunu kullanın.

### Hata ayıkla · *Kodcu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Oyunumuzda bir hata var.
Hata mesajı (kırmızı kutuda ya da F12 → Console'da gördüğümüz):
[HATA MESAJINI BURAYA YAPIŞTIRIN]

Son değiştirdiğimiz kod:
[DEĞİŞTİRDİĞİNİZ SATIRLARI BURAYA YAPIŞTIRIN]

1. Hatanın nedenini bir öğrenciye anlatır gibi açıkla.
2. Düzeltilmiş kodu göster, yalnızca değişen satırları.
3. Bir dahaki sefere bu hatayı nasıl önleyebileceğimizi bir cümleyle söyle.
```

💡 Düzeltmeyi uygulamadan önce açıklamayı anladığınızdan emin olun. Bu hatayı günlüğün "yanıldığı yerler" bölümüne değil, kayıtlar bölümüne yazın.

### Kapak görseli · *Tasarımcı*

```
Bir oyun kapak görseli için görsel üretme aracına verilecek bir komut yaz (İngilizce, en fazla 60 kelime).
Görsel: {gezegen} yüzeyinde, {arac} uçarken. Hikâye: {hikaye}
Gerçekçi bilimsel illüstrasyon tarzında olsun. Gökyüzünün ve zeminin rengi {gezegen} için bilimsel olarak doğru olsun. Görselde yazı, logo ya da gerçek bir kişi olmasın.
```

💡 Görsel üretme araçlarını öğretmeninizin hesabından kullanın. Ürettiğiniz görseli kullanırsanız günlüğe "yapay zekâyla üretildi" diye yazın.

## Aşama 5 — Test et (45 dk)

### Sonuçları yorumla · *Bilim danışmanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Oyunumuzun fizik motoru bu formülleri kullanıyor:
- Rotorun en büyük itkisi: T = 0,012 × ρ × A × (uç hızı)²
- Askıda kalmak için gereken güç: P = T × √(T / (2ρA)) / verim
Bizim aracımız {gezegen} üzerinde ve oyun şu değerleri gösteriyor: [GİRİŞ EKRANINDAKİ İTKİ/AĞIRLIK, ASKIDA KALMA GÜCÜ VE SÜRESİNİ YAPIŞTIRIN].
1. Bu formüllerdeki her harfin ne anlama geldiğini açıkla.
2. Hava yoğunluğu (ρ) azalınca itki ve güç neden değişiyor?
3. Değerlerimiz gerçek bir araçla (örneğin Ingenuity askıda yaklaşık 350 W harcıyordu) karşılaştırıldığında makul mü?
```

💡 Bu açıklamayı tasarım belgesinin 3. bölümüne kendi cümlelerinizle özetleyin.

### Yapay zekâyı denetle · *Bilim danışmanı*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Bir yapay zekâ bize şu bilgiyi verdi:
"[KONTROL ETMEK İSTEDİĞİNİZ BİLGİYİ YAPIŞTIRIN]"
Bu bilgiyi doğrulamak için hangi güvenilir kaynaklara bakmalıyız? Bu bilgide hata olma ihtimali olan yerler neler? Doğrudan "doğru" ya da "yanlış" demek yerine, bizim nasıl kontrol edebileceğimizi anlat.
```

💡 Önerilen kaynağa gerçekten gidin ve okuyun. Yapay zekâya "kontrol ettim" dedirtmek kontrol etmek değildir.

## Aşama 6 — Yayınla ve sun (40 dk)

### Sunum planı · *Sunucu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Projemizi 5 dakikada jüriye sunacağız. Görevimiz: "{baslik}" ({gezegen}).
Bize 5 dakikalık bir sunum planı yap. Bölümler: görev ve hikâye (1 dk), bilim — neden bu araç bu gezegende uçabiliyor (1 dk), canlı oyun gösterimi (1,5 dk), yapay zekâyı nasıl kullandık ve nerede yanıldığını nasıl yakaladık (1 dk), ne öğrendik (0,5 dk).
Her bölüm için kimin konuşacağını boş bırak, söylenecek 2–3 ana fikri madde olarak yaz. Tam metin yazma; kendi cümlelerimizle konuşacağız.
```

💡 Sunumu en az bir kez süre tutarak prova edin.

### Jüri soruları · *Sunucu*

```
Ben bir öğrenciyim. Takımımla, tarayıcıda çalışan bir uzay görevi simülasyon oyunu yapıyoruz. Oyunumuz three.js ile yazılmış "Görev Kiti" adlı hazır bir projeye dayanıyor. Görevimiz "{baslik}" ({gezegen}, {arac}). Jüri üyeleri bilim insanları ve öğretmenler.
Bize sorulabilecek 6 zor soru yaz: 2'si bilim, 2'si kod, 2'si yapay zekâ kullanımı hakkında olsun. Cevapları YAZMA; cevapları biz hazırlayacağız.
```

💡 Her soruyu bir takım arkadaşınız cevaplasın, diğerleri yorum yapsın.

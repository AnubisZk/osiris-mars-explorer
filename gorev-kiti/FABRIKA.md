# 🏭 Görev Fabrikası — rehber

Görev Fabrikası, bir uzay görevini baştan sona **mühendis gibi** tasarlayıp sonunda oynanabilir bir
oyun üretmenizi sağlar. Açmak için oyunun üst çubuğundaki **🏭 Fabrika** düğmesine basın ya da
`fabrika.html` sayfasını açın.

```
Sistem tasarımı → Cihaz tasarımı → Görev maliyeti → Simülasyon → Stres testi → OYUN
 (ne istiyoruz?)   (aracı kur)       (kaç para?)          (bir uçuş)    (kötü günler)  (oyna!)
```

> 🛡 **Çalışmanız korunur.** Fabrika'da kaydettiğiniz her tasarım tarayıcıdaki arşive *eklenir*;
> hiçbir tasarım ya da yapay zekâ kaydı otomatik silinmez. Sayfa `ayarlar.js` dosyanıza hiçbir zaman
> doğrudan yazmaz: yeni dosyayı indirirsiniz, eskisini commit ettikten sonra kendiniz değiştirirsiniz.
> Git, dosyanın bütün eski hâllerini saklar.

## 1. Sistem tasarımı — ne istiyoruz?
Başlangıç görevini seçin (kendi `ayarlar.js`'iniz ya da hazır görevlerden biri). Sonra
**gereksinimleri** yazın: aracın taşıyacağı faydalı yük (kamera, sensör), aviyonik (bilgisayar,
telsiz) ve stres testinde istediğiniz başarı oranı. Sayfa kuralları otomatik koyar:

| Kural | Neden? |
|---|---|
| İtki/ağırlık ≥ 1,5 (havasız yerde roket için ≥ 2,5) | Kalkış, tırmanış ve frenleme için itki payı gerekir |
| Rotor ucu Mach ≤ 0,8 | Pervane ucu ses hızına yaklaşınca verim düşer, titreşim artar |
| Görev, enerjinin/yakıtın en çok %60'ını harcamalı | Beklenmedik durumlar için yedek |
| Tasarım rüzgârına dayanım ≥ 1,2 | Araç eğilerek rüzgârın itişini yenebilmeli |

## 2. Cihaz tasarımı — aracı kur
Rotor sayısı, yarıçap, uç hızı, batarya, malzeme gibi **tasarım değişkenlerini** seçin. Her
değişiklikte sayfa aracı yeniden "kurar" ve kütle dökümünü gösterir.

**Tasarım döngüsü:** Batarya büyürse araç ağırlaşır → daha güçlü motor gerekir → motor ağırlaşır →
araç yine ağırlaşır... Hesap kütle artık değişmeyene kadar tekrarlanır (yakınsama). Bu, gerçek
mühendislerin de kullandığı yöntemdir.

Üç yolla tasarlayabilirsiniz:

1. **Elle:** Değerleri kendiniz deneyin, kontrollerin yeşile dönmesini sağlayın.
2. **🤖 Yapay zekâ önersin:** Görev bilgileri ve kurallar bir komutla yapay zekâya gönderilir. Gelen
   öneri forma yazılır; aralık dışındaki değerler düzeltilir ve bu size söylenir. Gönderilen komutun
   tamamı atölye asistanının günlüğüne ve tasarım raporuna **kelimesi kelimesine** kaydedilir.
3. **⚙️ Otonom mühendis:** Bilgisayar, *evrimsel arama* ile en hafif uygun tasarımı arar: rastgele
   tasarımlardan bir nüfus kurar, en iyileri seçer, karıştırır, biraz değiştirir ve bunu 50 nesil
   tekrarlar. Formdaki tasarım (yapay zekânın önerisi dahil) da aramaya katılır. En iyi aday stres
   testine girer; testi geçemezse başarısızlığın **nedenine göre** güvenlik payı artırılır ve arama
   tekrarlanır.

> **Yapay zekâ önerir → algoritma iyileştirir → simülasyon doğrular.** Hiçbirine körü körüne
> güvenmeyin: yapay zekânın gerekçelerini kendi hesabınızla, algoritmanın sonucunu stres testiyle
> kontrol edin.

## 3. Gerçekçi görev maliyeti
Bir uzay aracının maliyeti yalnızca "kütle × fırlatma fiyatı" değildir. Sayfa dört kalemi gerçek
görevlerin sayılarıyla hesaplar:

| Kalem | Nasıl hesaplanır? | Kaynak |
|---|---|---|
| Malzeme | Parça kütlesi × **malzeme günlüğünüzdeki** $/kg | Sizin bulduğunuz fiyatlar |
| Geliştirme, yapım, test | Ingenuity referansı: ~80 milyon $ (değiştirebilirsiniz) | The Planetary Society |
| Taşıma (fırlatma + yolculuk + iniş) | Kütle × gerçek görevden kg başına **alt–üst sınır** | Mars: Perseverance (roket 243 milyon $, uzay aracı 2,2 milyar $, yüzeye inen 1025 kg). Ay: ticari iniş sözleşmeleri. Titan: Dragonfly (3,35 milyar $, ~450 kg) |
| Operasyon | Ingenuity: 1 aylık görev ~5 milyon $ × ay sayısı | The Planetary Society |

- **Mars'ta taşıma** kg başına yaklaşık 237 bin $ (yalnızca roket) ile 2,4 milyon $ (roket + bütün
  uzay aracı) arasındadır. Gerçek değer arada bir yerdedir; sonuç bu yüzden bir **aralık** olarak verilir.
- **Europa** yüzeyine henüz hiçbir araç inmedi: gerçek bir referans yok. Sayfa sayı uydurmaz; kendi
  kaynağınızı bulup "Kendi taşıma değeriniz" kutusuna yazın.
- Ders: ham malzeme toplamın binde birinden bile azdır. Uzay araçlarını pahalı yapan; tasarım, test ve
  taşımadır. Ama her kilogram taşımayı yüz binlerce dolar artırır: hafiflik bu yüzden önemlidir.

## 🧪 Malzeme günlüğü (malzeme mühendisi)
Takımın malzeme mühendisi araştırdığı malzemeleri **kaynağıyla** `MALZEME-GUNLUGU.md`'ye (ya da 2.
adımdaki forma) yazar. Fabrika bu kayıtları **hesaba katar**:

- **Yeni malzeme** (ör. `al6061`): gövde/pervane/batarya seçeneklerine 🧪 işaretiyle eklenir; otonom
  mühendis de onu dener. Yoğunluk ve dayanım kütle hesabını, özgül enerji batarya kütlesini değiştirir.
- **Hazır malzemeyi güncelleme** (kimlik `karbon`, `aluminyum`, `liion`...): yalnızca doldurduğunuz
  sütunlar değişir (ör. yalnızca fiyat).
- **Fiyat** malzeme maliyetine girer. **En düşük çalışma sıcaklığı** gezegenin en soğuk değeriyle
  karşılaştırılır; dayanmıyorsa tasarım "uygun değil" olur.
- Olağan dışı bir sayı (ör. yoğunluk 2 700 000) hesaba katılmaz ve nedeni gösterilir. Kaynaksız satır
  kullanılır ama raporda ⚠ ile görünür.
- Hiçbir satır silinmez: aynı kimlikle yeni satır yazarsanız en son satır kullanılır, eskisi raporda
  "önceki ölçüm" olarak kalır.

## 4. Simülasyon
Otonom pilot görevi bir kez uçar: 25 m'ye tırmanır, her hedefe gider, alçalıp gözlem yapar ve üsse
iner. Haritada izlediği yolu, grafikte yüksekliği ve kalan enerjiyi görürsünüz. Pilot oyunun kendi
fizik motorunu kullanır; hile yapmaz.

## 5. Stres testi — kötü günler
Tasarım her senaryoda onlarca kez uçurulur (Monte Carlo yöntemi). Her denemede hava biraz farklıdır:

| Senaryo | Ne oluyor? |
|---|---|
| Normal gün | Küçük rastgele sapmalar |
| Rüzgârlı gün | Rüzgâra 4–8 m/s eklenir |
| Toz şeytanı | ~20 saniye boyunca dönen, 10–15 m/s ani rüzgâr |
| Soğuk sabah | Hava daha yoğun ama batarya kapasitesinin %20'si gider |
| Seyrek hava | Hava yoğunluğu %12 düşük |

**Belirsizlik nereden geliyor?** Görev, Veri Atölyesi'nde gerçek NASA ölçümlerinden eğittiğiniz
atmosfer modelini kullanıyorsa (bkz. `VERI-IKIZI.md`), sapmalar modelin **test hatasından** gelir:
modeliniz ne kadar yanılıyorsa stres testi o kadar zorlar. Model yoksa varsayılan değerler
kullanılır (yoğunluk ±%5, rüzgâr ±1,5 m/s).

**%95 güven aralığı:** 50 denemede 46 başarı, gerçek başarının tam %92 olduğunu kanıtlamaz. Aralık,
gerçek değerin büyük olasılıkla nerede olduğunu söyler (Wilson yöntemi). Deneme arttıkça daralır.

## 6. Oyun
- **▶ Kaydet ve oyunda aç:** Tasarım arşive eklenir ve oyun `index.html?gorev=fabrika` adresiyle açılır.
- **⬇ ayarlar.js indir:** Tasarımınız takımın görev dosyası olarak. Önce mevcut `ayarlar.js`'inizi
  commit edin, sonra yenisini koyun. `node --check ayarlar.js` ve `node hesapla.mjs` ile kontrol edin.
- **⬇ TASARIM-RAPORU.md indir:** Gereksinimler, kütle dökümü, kontroller, maliyet, simülasyon, stres
  testi tablosu ve yapay zekâya gönderilen komutun tamamı. Deponuza ekleyin; sonundaki "Takımın
  kontrolü" kutularını takımca doldurun.

## Rol dağılımı önerisi
| Rol | Fabrika'daki işi |
|---|---|
| Takım kaptanı | Gereksinimleri takımla birlikte yazar, son tasarıma karar verir |
| Bilim danışmanı | Kütle dökümünü ve kontrolleri kaynaklarla karşılaştırır, stres testi sonuçlarını yorumlar |
| Malzeme mühendisi | Malzeme günlüğünü kaynaklarla doldurur, malzeme seçimini ve maliyet tablosunu yorumlar |
| Kodcu | ayarlar.js'i depoya koyar, `hesapla.mjs` ile doğrular, commit eder |
| Tasarımcı | Görev adı, hikâye ve araç rengi; oyunun görünüşü |
| Sunucu | Tasarım raporunu ve yapay zekâ kullanımını sunuma dönüştürür |

## Bilinen sınırlar (dürüst olalım)
- Kütle modeli **basitleştirilmiştir**: katsayılar (`tasarim.js` → `KATSAYI`) Ingenuity benzeri bir
  tasarımı ~1,6 kg verecek şekilde seçildi. Gerçek bir araçta her parça ayrı mühendislik ister.
- Hazır malzeme ve batarya değerleri `malzemeler.js` içinde "tipik değer" olarak işaretlidir; malzeme
  günlüğünüz bunları kaynaklı değerlerle günceller. Geliştirme maliyeti tek bir referansa (Ingenuity) dayanır.
- Stres testi otonom pilotla yapılır; bir insan pilot daha iyi ya da daha kötü uçabilir.
- Görevin enerji tahmini (hesap.js) askıda kalma tüketimiyle yapılan **temkinli** bir üst sınırdır;
  simülasyonda genellikle daha az enerji harcanır.

# 🛰 Gerçek veriyle dijital ikiz (bonus görev)

**Dijital ikiz**, gerçek bir sistemin bilgisayardaki, gerçek ölçümlerle beslenen kopyasıdır.
Bu görevde simülatörünüzün **havasını** gerçek ölçümlerle besleyeceksiniz: NASA'nın Mars'taki
Perseverance gezgininin hava istasyonu **MEDA**'nın verisinden bir model eğitip oyuna bağlayacaksınız.
Böylece oyununuz "Mars'ta hava yoğunluğu hep 0,020 kg/m³" demek yerine, **seçtiğiniz saatte
Jezero Krateri'nde ölçülen havaya** göre uçar.

> **Süre:** 60–90 dakika · **Kimler:** Bilim danışmanı (veri), Kodcu (bağlama), tüm takım (deney)
> **Araçlar:** `veri-atolyesi.html` (kitte), bir tarayıcı, internet

---

## Neden önemli?

Rotorun itkisi ve harcadığı güç **hava yoğunluğuna** bağlıdır (bkz. `fizik.js`). Mars'ta gün içinde
sıcaklık onlarca derece değişir. Soğuk hava daha yoğundur, aynı helikopter daha az güçle uçar.
Gerçek görev ekipleri uçuş saatini bu yüzden hava koşullarına göre planlar.
Sizin sorunuz: **Bizim aracımız için en iyi uçuş saati hangisi, ve ne kadar fark ediyor?**

---

## Adım 1 — Veriyi indirin (Bilim danışmanı, 15 dk)

Veri Atölyesi sayfasının (oyunun klasöründe `veri-atolyesi.html`) 1. adımındaki bağlantıları kullanın:

| Ne | Bağlantı |
|---|---|
| MEDA işlenmiş veri (basınç, rüzgâr) | https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/ |
| MEDA kalibre veri (hava sıcaklığı) | https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/ |
| İşlenmiş verinin tamamı (büyük!) | https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/meda_derived.tar.gz |
| Kalibre verinin tamamı (büyük!) | https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/meda_calibrated.tar.gz |
| MEDA veri sayfası ve belgeleri | https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html |
| (Dünya için) NASA POWER saatlik veri | https://power.larc.nasa.gov/data-access-viewer/ |

1. Sol'ler aralık klasörlerinde durur: ör. `data_derived_env/sol_0090_0179/sol_0105/`. **Art arda 3 sol** seçin (ör. 105, 106, 107): ikisi eğitim, biri test için. Sol 1 gibi görevin ilk günlerini seçmeyin; o günlerde rüzgâr dosyası yok.
2. Her sol için şu dosyaları indirin (`.CSV` ve yanındaki `.xml`):

   | Dosya (sol 105 örneği) | Ne ölçer | Kullanacağımız sütunlar |
   |---|---|---|
   | `WE__0105…DER_PS…P01.CSV` | basınç | `LTST` (yerel saat), `PRESSURE` (Pa) |
   | `WE__0105…DER_WS…P03.CSV` | rüzgâr | `LTST`, `HORIZONTAL_WIND_SPEED` (m/s), `WIND_DIRECTION` (derece), `ROVER_STILL` |
   | kalibre klasörde adında **ATS** geçen dosya | hava sıcaklığı | `LTST`, hava sıcaklığı sütunu (`.xml`'ye bakın) |

3. Aynı adlı `.xml` dosyasını açın: sütunların adlarını ve **birimlerini** orada bulursunuz. Bunları not alın.
4. Aynı dosyanın birkaç sürümü (P01, P02, P03…) varsa **en yüksek numaralısını** kullanın.
5. Şunlar **gerekmez**: `DER_ANCILLARY` (gezginin konumu ve Güneş'in açısı), `DER_TIRS` (kızılötesi ışınım), `DER_RHS` (nem).
   `DER_RHS`'teki `HUMIDITY_LOCAL_TEMP` nem sensörünün kendi sıcaklığıdır, hava sıcaklığı değildir. ATS yoksa yalnızca *yaklaşık* bir değer olarak kullanılabilir; bunu günlüğe yazın.
6. Sol 105 için Mars'ın mevsimi (güneş boylamı, Ls) yaklaşık 55°'dir: Jezero'da kuzey ilkbaharı. Seçtiğiniz sol'lerin Ls değerini `.xml` dosyasının başındaki iki ondalıklı sayıdan okuyup not edin; modeliniz bu mevsim için geçerlidir.
7. Hangi dosyaları indirdiğinizi `YZ-GUNLUGU.md`'ye değil, aşağıdaki "Veri kaydı" tablosuna yazın.

> 💡 Dosyalar büyükse sorun değil: Veri Atölyesi her şeyi tarayıcıda işler, hiçbir şey dışarı gönderilmez.

## Adım 2 — Sütunları eşleştirin (Bilim danışmanı, 15 dk)

1. `veri-atolyesi.html`'yi açın (oyunu nasıl açıyorsanız öyle: Live Server ya da yayındaki site).
2. **"Dosya seç"** ile dosyaları yükleyin.
3. Her dosya için seçin:
   - **Saat sütunu:** yerel güneş saati. MEDA'da genellikle adında `LTST` geçer (Local True Solar Time).
   - **Basınç**, **sıcaklık**, **rüzgâr hızı** ve **rüzgâr yönü** sütunları ve **birimleri**. Bir dosyada olmayanı "yok" bırakın.
     (Atölye MEDA sütunlarını çoğunlukla kendisi bulur; yine de kontrol edin.)
   - Rüzgâr dosyalarında **"yalnızca gezgin dururken (ROVER_STILL = 1)"** kutusu açık kalsın: gezgin hareket ederken ölçülen rüzgâr güvenilir değildir.
   - **Rüzgâr yönü:** MEDA belgelerinde (`document/` klasöründeki RDR SIS) yönün rüzgârın *geldiği* mi *gittiği* yön mü olduğuna bakın ve atölyede ona göre seçin. Hava yoğunluğu bu seçimden etkilenmez; yalnızca rüzgârın oyundaki yönü etkilenir.
4. **Bir solu test için ayırın:** O solun dosyalarında "Bu dosya ne için?" kutusundan **🧪 test** seçin. Model test dosyalarını hiç görmez; doğruluğu orada ölçülür. (En az 2 sol eğitim, 1 sol test.)
5. Önce aracın nasıl çalıştığını görmek isterseniz **"🧪 Alıştırma verisiyle dene"** düğmesi var. Ama bu veri **uydurmadır**, projede kullanılmaz.

## Adım 3 — Modeli eğitin (Bilim danışmanı + tüm takım, 20 dk)

1. Gezegeni seçin, **harmonik sayısını** 2 bırakıp **"Modeli eğit"**e basın.
2. Grafiklere bakın: noktalar ölçümler, turuncu eğri modelin tahmini.
3. Atölye, 1–4 harmonik için **eğitim** ve **test** hatalarını otomatik bir tabloda gösterir. Değerleri aşağıya yazın.
4. Tartışın: Harmonik arttıkça **eğitim** hatası hep azalıyor mu? **Test** hatası da azalıyor mu? İkisi ayrıldığında ne oluyor? (İpucu: aşırı öğrenme)
5. **Modelimizin doğruluğu**, seçtiğiniz harmonikteki **test** RMSE ve R²'sidir. Sunumda bunu söyleyin, eğitim hatasını değil.

| Harmonik | Basınç RMSE eğitim / test (Pa) | Basınç R² test | Sıcaklık RMSE eğitim / test (K) | Sıcaklık R² test | Rüzgâr R² test |
|---|---|---|---|---|---|
| 1 | / | | / | | |
| 2 | / | | / | | |
| 3 | / | | / | | |
| 4 | / | | / | | |

**Seçtiğimiz harmonik sayısı ve nedeni (test hatasına göre):** [ ... ]
**Modelimizin doğruluğu (test):** basınç RMSE [ ... ] Pa, sıcaklık RMSE [ ... ] K, rüzgâr R² [ ... ]

## Adım 4 — Simülatöre bağlayın (Kodcu, 10 dk)

1. **"Modeli indir"** ile `.json` dosyasını indirin ve kitin `veri/` klasörüne koyun.
2. `ayarlar.js`'te `// atmosfer: ...` satırını bulun, Veri Atölyesi'nin verdiği satırla değiştirin.
   Satırın başında `//` **olmasın**:
   ```js
   atmosfer: { model: 'veri/jezero-atmosfer.json', saat: 10 },
   ```
3. Oyunu yenileyin. Giriş ekranında **"Atmosfer: 🛰 veri modeli"** ve o saatteki basınç, sıcaklık, rüzgâr görünmeli.
   Uçarken telemetride **"Hava yoğunluğu (veri)"** satırı çıkar.
4. **🧮 Hesaplar** sayfası da artık modeldeki yoğunluğu kullanır (ortam tablosunda "atmosfer modeli" yazar).

## Adım 5 — Deney: en iyi uçuş saati (tüm takım, 20 dk)

`saat` değerini değiştirerek aşağıdaki tabloyu doldurun. Değerleri **🧮 Hesaplar** sayfasından okuyun,
sonra her saat için bir test uçuşu yapıp uçuş raporunu da ekleyin.

| Başlangıç saati | ρ (kg/m³) | Rüzgâr (m/s) | Askıda güç (W) | Askıda kalma süresi | Uçuş sonucu / puan |
|---|---|---|---|---|---|
| 07:00 | | | | | |
| 10:00 | | | | | |
| 13:00 | | | | | |
| 16:00 | | | | | |

**Sonuç:** Aracımız için en iyi saat [ ... ], çünkü [ ... ].
**Sabit yoğunluklu (veri modeli olmayan) oyunla fark:** [ ... ]

## Adım 6 — Kaydedin

- `GOREV-TASARIMI.md` → bölüm 2'ye: "Atmosfer, MEDA verisinden eğitilen modelden geliyor" ve hangi sollar.
- `FIZIK-HESAPLARI.md` → ortam tablosuna modelin o saatteki değerleri.
- Yapay zekâ kullandıysanız → `YZ-GUNLUGU.md` ve (ajan için) `KOMUT-KAYDI.md`.

### Veri kaydı

| Dosya adı | Sol | Sensör (PS/WS/ATS) | Nereden indirildi | Sütun ve birim notu |
|---|---|---|---|---|
| | | | | |

---

## Sözlük

- **Sol:** Bir Mars günü, yaklaşık 24 saat 40 dakika.
- **LTST (yerel gerçek güneş saati):** Güneş'in gökteki yerine göre saat; 12:00'de Güneş en tepededir.
- **Model eğitmek:** Bir formülün katsayılarını, ölçümlere en iyi uyacak şekilde bulmak.
- **En küçük kareler:** Model ile ölçüm arasındaki farkların karelerinin toplamını en küçük yapan yöntem.
- **RMSE:** Modelin ölçümlerden ortalama sapması (birimi ölçümün birimi).
- **R²:** Verideki değişimin modelce açıklanan oranı (1 = tamamı).
- **Eğitim / test verisi:** Model eğitim verisinden öğrenir; doğruluğu, hiç görmediği test verisinde ölçülür.
- **Aşırı öğrenme:** Modelin gürültüyü de ezberlemesi; eğitim verisinde iyi, yeni veride kötü.
- **Dijital ikiz:** Gerçek bir sistemin, gerçek verilerle güncellenen bilgisayar modeli.

## Dürüst olalım: bu modelin sınırları

- Model **tek bir yerin** (Jezero) ve **seçtiğiniz solların** havasını öğrenir. Başka mevsimde ya da başka bir yerde farklı olabilir.
- Model **ortalama bir günü** öğrenir. Toz şeytanı gibi ani olayları göstermez.
- Ingenuity'nin görevi bittiği için bu bir "gerçek zamanlı" ikiz değil, **geçmiş gerçek veriyle beslenen** bir modeldir.
  Gerçek zamanlı bir ikiz için kulübünüzün dronunun uçuş kayıtları ve o anki hava verisi gerekir. Bu da bir sonraki proje olabilir!

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

1. Klasörlerden **aynı mevsimden 2–5 sol** seçin (sol = Mars günü; sol numaraları birbirine yakın olsun).
2. Her sol için adında **PS** (basınç), **WS** (rüzgâr) ve **ATS** (hava sıcaklığı) geçen `.csv` dosyalarını indirin.
3. Aynı adlı `.xml` dosyasını da açın: sütunların adlarını ve **birimlerini** orada bulursunuz. Bunları not alın.
4. Aynı dosyanın birkaç sürümü varsa **en yüksek sürüm numaralısını** kullanın.
5. Hangi dosyaları indirdiğinizi `YZ-GUNLUGU.md`'ye değil, aşağıdaki "Veri kaydı" tablosuna yazın.

> 💡 Dosyalar büyükse sorun değil: Veri Atölyesi her şeyi tarayıcıda işler, hiçbir şey dışarı gönderilmez.

## Adım 2 — Sütunları eşleştirin (Bilim danışmanı, 15 dk)

1. `veri-atolyesi.html`'yi açın (oyunu nasıl açıyorsanız öyle: Live Server ya da yayındaki site).
2. **"Dosya seç"** ile dosyaları yükleyin.
3. Her dosya için seçin:
   - **Saat sütunu:** yerel güneş saati. MEDA'da genellikle adında `LTST` geçer (Local True Solar Time).
   - **Basınç**, **sıcaklık**, **rüzgâr hızı** ve **rüzgâr yönü** sütunları ve **birimleri**. Bir dosyada olmayanı "yok" bırakın.
4. Önce aracın nasıl çalıştığını görmek isterseniz **"🧪 Alıştırma verisiyle dene"** düğmesi var. Ama bu veri **uydurmadır**, projede kullanılmaz.

## Adım 3 — Modeli eğitin (Bilim danışmanı + tüm takım, 20 dk)

1. Gezegeni seçin, **harmonik sayısını** 2 bırakıp **"Modeli eğit"**e basın.
2. Grafiklere bakın: noktalar ölçümler, turuncu eğri modelin tahmini.
3. **RMSE** ve **R²** değerlerini aşağıdaki tabloya yazın.
4. Harmonik sayısını 1, 3 ve 4 yapıp yeniden eğitin. Tabloyu doldurun.
5. Tartışın: Hangi harmonik sayısı en iyi? Harmonik arttıkça RMSE hep azalıyor mu? Bu, modelin daha **iyi** olduğu anlamına mı gelir? (İpucu: aşırı öğrenme)

| Harmonik | Basınç RMSE (Pa) | Basınç R² | Sıcaklık RMSE (K) | Sıcaklık R² |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

**Seçtiğimiz harmonik sayısı ve nedeni:** [ ... ]

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
- **Aşırı öğrenme:** Modelin gürültüyü de ezberlemesi; eğitim verisinde iyi, yeni veride kötü.
- **Dijital ikiz:** Gerçek bir sistemin, gerçek verilerle güncellenen bilgisayar modeli.

## Dürüst olalım: bu modelin sınırları

- Model **tek bir yerin** (Jezero) ve **seçtiğiniz solların** havasını öğrenir. Başka mevsimde ya da başka bir yerde farklı olabilir.
- Model **ortalama bir günü** öğrenir. Toz şeytanı gibi ani olayları göstermez.
- Ingenuity'nin görevi bittiği için bu bir "gerçek zamanlı" ikiz değil, **geçmiş gerçek veriyle beslenen** bir modeldir.
  Gerçek zamanlı bir ikiz için kulübünüzün dronunun uçuş kayıtları ve o anki hava verisi gerekir. Bu da bir sonraki proje olabilir!

# Malzeme günlüğü

> **Kim doldurur?** Takımın **malzeme mühendisi** (ROLLER.md). Diğer roller de ekleyebilir.
> **Ne işe yarar?** Buraya yazdığınız değerler Görev Fabrikası'nda (`fabrika.html`) **hesaba katılır**:
> aracın kütlesi, soğuğa dayanımı ve malzeme maliyeti sizin bulduğunuz sayılarla hesaplanır.

## Nasıl yazılır?

1. Bir malzeme araştırın (MatWeb, üretici veri sayfası, NASA/ESA raporu, ders kitabı).
2. Aşağıdaki **Kayıtlar** tablosunun sonuna bir satır ekleyin. Eski satırları **silmeyin, değiştirmeyin**:
   bir değeri düzeltmek istiyorsanız aynı **Kimlik** ile yeni bir satır yazın. Fabrika en son satırı kullanır,
   eskisini "önceki ölçüm" olarak raporda gösterir.
3. **Kimlik** sütunu:
   - Hazır bir malzemeyi güncellemek için onun kimliğini yazın: `karbon`, `aluminyum`, `titanyum`, `cam`, `pla`
     (yapı) ya da `liion`, `lipo`, `lis` (batarya). Yalnızca **doldurduğunuz** sütunlar güncellenir.
   - Yeni bir malzeme için kısa bir kimlik uydurun (ör. `al6061`, `kevlar`). Yeni yapı malzemesinde
     yoğunluk ve çekme dayanımı, yeni bataryada özgül enerji **zorunludur**.
4. **Tür:** `yapı` ya da `batarya`.
5. Sayılarda ondalık için virgül kullanın (`2,7`). Bilmediğiniz sütunu boş bırakın; **sayı uydurmayın**.
6. **Kaynak** sütununu mutlaka doldurun (site adı ve sayfa başlığı ya da bağlantı). Kaynaksız satır
   hesaba katılır ama raporda ⚠ ile görünür ve jüri bunu sorar.
7. **En düşük çalışma sıcaklığı:** Malzemenin bozulmadan kullanılabildiği en düşük sıcaklık. Fabrika bunu
   gezegenin en soğuk değeriyle karşılaştırır (Mars gecesi −80 °C, Titan −179 °C...). Dayanmıyorsa tasarım
   "uygun değil" olur.
8. **Fiyat ($/kg):** Ham malzemenin kilogram fiyatı. Fabrika parça kütlesiyle çarpıp **malzeme maliyetini**
   hesaplar. (İpucu: toplam görev maliyetinin içinde bu kalemin ne kadar küçük kaldığına bakın!)

Fabrika sayfasındaki **"Malzeme günlüğüne ekle"** formunu da kullanabilirsiniz: eklenen satırlar
tarayıcıda saklanır ve "📋 Satırları kopyala" ile bu dosyaya yapıştırılır. Dosyayı commit etmeyi unutmayın.

## Kayıtlar

| Tarih | Rol | Tür | Kimlik | Malzeme adı | Yoğunluk (kg/m³) | Çekme dayanımı (MPa) | Özgül enerji (Wh/kg) | Fiyat ($/kg) | En düşük çalışma sıcaklığı (°C) | Kaynak | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [gg.aa.yyyy] | Malzeme mühendisi | yapı | [kimlik] | [malzemenin adı] | [ ] | [ ] |  | [ ] | [ ] | [kaynak] | örnek satır: bunu silmeyin, altına yazın |

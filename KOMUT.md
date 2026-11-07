# Yeni sohbet için komut

Aşağıdaki metni yeni sohbete yapıştırın. `zsk-flight-core.zip` dosyasını da ekleyin.

---

Ekte `zsk-flight-core.zip` var: kendi FPV drone simülatörümün (ZSK-FPV) uçuş çekirdeği.
İçinde Rapier ile 240 Hz fizik, uçuş kontrolcüsü (ANGLE / ACRO / KONUM), altı drone türü,
kumanda, rüzgâr, testler ve 5" referans uçuş izi var. Önce `README.md` dosyasını oku.

Referans açık kaynak proje: https://github.com/VictorZakharov/threejs-nanites

**Amaç:** bu çekirdek ve nanites tekniklerini kullanarak **hayalî bir askerî görev dronu
eğitim simülatörü** yapmak.

**Hedefler**
- Yüksek görsel kalite, düşük GPU maliyeti
- 1080p'de önce kararlı 120/144 FPS, mümkünse 240 FPS
- Gerçekçi ağaçlar, çalılar ve arazi
- FPV uçuş fiziği ve kumanda sistemi korunacak

**Çalışma sırası**
1. Çekirdeği aç, `npm install && npm run check` çalıştır. 46 test geçmeli ve 5" izi "AYNI" çıkmalı.
2. Nanites reposunu incele:
   - lisansı (kod alınacaksa uygun mu)
   - Three.js sürümü, WebGL / WebGPU durumu
   - cluster LOD, GPU culling, impostor ve temporal upscaling teknikleri
3. **Ayrı bir benchmark sahnesi** kur. Önce 5.000, 20.000 ve 50.000 ağaçla şunları ölç ve
   JSON/CSV olarak dışa aktar:
   - FPS
   - CPU kare süresi
   - GPU kare süresi (WebGL2 zamanlayıcı sorgusu / WebGPU zaman damgası)
   - tahmini VRAM
   - çizim çağrısı sayısı
   Senin ortamında gerçek GPU yoksa sayfanın ölçüm ve dışa aktarma işlevini doğrula;
   gerçek ölçümleri ben kendi bilgisayarımda yapıp göndereceğim. Tarayıcının FPS'i ekran
   yenileme hızıyla sınırladığını hesaba kat; asıl ölçüt kare süresi olsun.
4. Sonuçlara göre en düşük riskle alınabilecek bileşenleri belirle. Aşamalı uygulama planı
   ve performans raporu hazırla, **onayımı al**, sonra uygula.
5. **Fizik ve çizim ayrı kalacak:**
   - Rapier dünyası 240 Hz sabit adımla, çizimden bağımsız döner.
   - Çarpışma ayrı bir çarpışma düzeninden kurulur; görsel LOD, culling ve impostor
     değişimleri çarpışmayı asla etkilemez.
   - Çekirdek dosyalarını değiştirme; gerekirse üstüne ayrı katman yaz.
   - Her aşamada `npm run check` çalıştır.
6. **Askerî görev modülü** (plan aşamasında birlikte netleştirelim):
   - Hayalî bir askerî eğitim sahası: maket araçlar, sığınak, radar maketi, siper hattı,
     hangar, hedef panoları.
   - Hayalî iki tür: taktik keşif dronu (gimballi, yakınlaştırmalı kamera, KONUM) ve
     ağır FPV görev dronu (eğitim yükü taşır).
   - Görevler:
     - keşif: hedefleri kamerayla bulma ve tanımlama
     - hedefe yönlendirme: işaretli panoya ya da maket araca isabet; patlama yok, isabet işareti ve puan var
     - etkisiz işaret yükünü hedef dairesine bırakma
   - Zorluk seçenekleri: görüntü parazitiyle sinyal kaybı, eve dönüş oku olmadan seyir, rüzgâr.
7. **Erişim:** askerî bölüm yalnız yönetici şifresiyle açılsın. Tarayıcı içi şifrenin gerçek
   koruma olmadığını açıkça belirt. Sunucu tarafı koruma (Vercel ara katmanı, şifre ortam
   değişkeninde) ya da ayrı derleme öner.

**Kapsam ve sınırlar (zorunlu)**
- Sistemler ve adlar hayalî olacak; gerçek silah sistemlerinin adları ve performans
  değerleri kullanılmayacak.
- İnsan hedef olmayacak; hedefler araç, yapı ve hedef panoları olacak.
- Gerçekçi patlayıcı ya da hasar modellemesi yapılmayacak.
- Gerçek yerler kullanılmayacak.

**Bilinen durum:** Fiziksel kumanda (Xbox / PS5 / FPV vericisi) testini ben yapacağım;
çekirdek bugüne kadar klavye ve otomatik testlerle doğrulandı.

Önce yalnız analiz ve plan çıkar, hiçbir şeyi uygulamadan bana sun.

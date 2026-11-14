# 🚀 Görev Kiti — Uzay Görevi Simülatörü Yap

Bu klasör, takımınızın kendi uzay görevi oyununu yapacağı **hazır bir başlangıç projesidir**.
İçinde çalışan bir 3B uçuş oyunu var. Siz onu kendi görevinize göre değiştireceksiniz:
yeni bir gezegen, yeni bir araç, yeni hedefler, yeni bir hikâye.

> Bütün hesaplar (GitHub, Netlify, yapay zekâ araçları) **öğretmeninizindir**.
> Bir hesaba giriş yapmanız ya da bir şey yayınlamanız gerektiğinde öğretmeninize söyleyin.

---

## 1. Klasörde ne var?

| Dosya | Ne işe yarar? | Kim sorumlu? | Değiştirmeli miyim? |
|---|---|---|---|
| `ayarlar.js` | **Görevin tamamı burada:** hikâye, gezegen, araç, hedefler, rüzgâr, süre | Herkes | ✅ Evet, en çok burayı değiştireceksiniz |
| `gezegenler.js` | Gezegenlerin bilimsel verileri (yerçekimi, hava yoğunluğu...) | Bilim danışmanı | ⚠️ Yalnızca kaynağını yazarak |
| `fizik.js` | Aracın nasıl uçtuğunu hesaplayan denklemler | Bilim danışmanı + Kodcu | ⚠️ Anlayarak, test ederek |
| `arazi.js` | Zemini (tepeler, kraterler) matematikle üretir | Tasarımcı + Kodcu | ✅ İsterseniz |
| `oyun.js` | Ekrana çizim, tuşlar, menüler | Kodcu | ✅ "ÖĞRENCİ:" yazan yerler |
| `gorevler.js` | Atölyedeki 7 hazır görev | — | ❌ Gerek yok |
| `index.html` | Sayfanın iskeleti ve görünüşü (renkler, panel yerleri) | Tasarımcı | ✅ İsterseniz |
| `FIZIK-HESAPLARI.md` | Fizik hesap defteri: formül → yerine koyma → sonuç | Kaptan + Bilim danışmanı | ✅ **Yapay zekâyla doldurup doğrulayın** |
| `hesap.html`, `hesap.js`, `hesapla.mjs` | Görevin bütün hesaplarını oyunun motoruyla adım adım üretir | Bilim danışmanı | ❌ Değiştirmeyin, doğrulamak için kullanın |
| `AGENTS.md`, `CLAUDE.md` | Depoda çalışan yapay zekâ ajanlarının kuralları | Takım kaptanı | ❌ Gerek yok |
| `veri-atolyesi.html`, `atmosfer.js`, `veri/` | Gerçek NASA ölçümlerinden atmosfer modeli eğitip oyuna bağlama (dijital ikiz) | Bilim danışmanı + Kodcu | ✅ Bonus görev: `VERI-IKIZI.md` |
| `fabrika.html` (+ `tasarim.js`, `malzemeler.js`, `otopilot.js`, `stres.js`, `optimize.js`, `fabrika.js`) | **Görev Fabrikası:** sistem tasarımı → cihaz tasarımı → yollama maliyeti → simülasyon → stres testi → oyun | Tüm takım | ✅ Sayfadan kullanın, rehber: `FABRIKA.md` |
| `KOMUT-KAYDI.md` | Ajanlara verilen her komutun kelimesi kelimesine kaydı: projenin şeffaflık belgesi | Ajan yazar, Sunucu kontrol eder | ✅ "Takımın kontrolü" satırlarını doldurun |
| `GOREV-TASARIMI.md` | Takımınızın tasarım belgesi | Tüm takım | ✅ **Doldurmanız gerekiyor** |
| `ROLLER.md` | Takımdaki görev dağılımı | Tüm takım | ✅ İsimleri yazın |
| `KOMUTLAR.md` | Yapay zekâya ne soracağınızın hazır örnekleri | Herkes | Okuyun, kullanın |
| `YZ-GUNLUGU.md` | Yapay zekâyı nerede, nasıl kullandığınızın kaydı | Herkes | ✅ **Her kullanımda doldurun** |
| `DEGERLENDIRME.md` | Projenizin nasıl puanlanacağı | — | Okuyun |
| `netlify.toml` | Netlify'a "bu klasörü olduğu gibi yayınla" der | — | ❌ |

---

## 2. Oyunu çalıştır

Tarayıcılar güvenlik nedeniyle `index.html` dosyasına **çift tıklayarak** açılan oyunları çalıştırmaz.
Oyunun küçük bir "web sunucusu" üzerinden açılması gerekir. Üç yol var, birini seçin:

### Yol A — Hiç kurulum yok: atölyedeki canlı demo
Öğretmeninizin verdiği atölye sayfasında **"Canlı demoyu aç"** düğmesine basın.
Görev kartlarındaki **"Bu görevi dene"** düğmesi o görevi doğrudan açar.
(Bu yol yalnızca denemek içindir; değişikliklerinizi görmek için B ya da C yolunu kullanın.)

### Yol B — Bilgisayarında, VS Code ile (önerilen)
1. Kit klasörünü (`gorev-kiti`) zip'ten çıkar.
2. **VS Code**'u aç → *File → Open Folder* → `gorev-kiti` klasörünü seç.
3. Sol taraftaki Eklentiler (Extensions) simgesine tıkla, **Live Server** yaz, kur.
   (Kurulum için öğretmeninden izin al.)
4. `index.html` dosyasına sağ tıkla → **Open with Live Server**.
5. Tarayıcıda oyun açılır. Artık `ayarlar.js` dosyasını değiştirip **Ctrl+S** ile kaydettiğinde
   oyun kendiliğinden yenilenir.

### Yol C — Komut satırıyla
Bilgisayarda Python ya da Node.js varsa, `gorev-kiti` klasörünün içinde:
```
python -m http.server 8000
```
ya da
```
npx serve .
```
yaz, sonra tarayıcıda `http://localhost:8000` adresini aç.

> 💡 Oyun, 3B çizim kütüphanesi **three.js**'i internetten indirir. İnternet yoksa oyun açılmaz.

---

## 3. İlk 10 dakika: ısınma alıştırmaları

Takımca sırayla yapın. Her birinden sonra kaydedip sayfayı yenileyin.

1. **Rengini seç.** `ayarlar.js` → `arac` → `renk: "#d9d9d9"` satırını `"#ff4fa0"` yap.
   Helikopter pembe oldu mu?
2. **Başlığı değiştir.** `baslik` satırına takımınızın görev adını yazın.
3. **Yeni bir hedef ekle.** `hedefler` listesindeki bir satırı kopyalayıp altına yapıştırın,
   adını ve `x`, `z` değerlerini değiştirin. Haritada yeni bir halka çıktı mı?
4. **Bilimsel deney:** `gezegen: "mars"` satırını `"dunya"` yapın. Oyunu başlatmadan önce
   giriş ekranındaki **"İtki / ağırlık"** ve **"Askıda kalma gücü"** değerlerine bakın.
   Neden değişti? Takımca tartışın, sonra geri alın.
5. **Kırmızı kutuyu tanı:** bilerek bir virgül silin ve kaydedin. Kırmızı hata kutusunu okuyun.
   Sonra virgülü geri koyun. Hata kutusundan korkmayın: size neyin bozulduğunu söyler.

---

## 4. Kendi görevinizi yapın

Atölye sayfasındaki **7 adımı** takip edin. Kısaca:

0. **Depoyu kur** — Takım kaptanı GitHub deposunu açar, kiti yükler; yapay zekâ `FIZIK-HESAPLARI.md`'yi doldurur, takım her sonucu **🧮 Hesaplar** sayfasıyla doğrular.
1. **Görevi anla** — Bir görev kartı seçin ya da kendi görevinizi uydurun.
2. **Tasarla** — `GOREV-TASARIMI.md` belgesini doldurun. Kod yazmadan önce!
3. **Kur** — Kiti çalıştırın (yukarıdaki Yol B), `ROLLER.md`'yi doldurun.
4. **Üret** — Yapay zekâ yardımıyla `ayarlar.js`'i, gerekirse `oyun.js`'i değiştirin.
   Her yapay zekâ kullanımını `YZ-GUNLUGU.md`'ye yazın.
5. **Test et** — Oyunu en az 3 kez oynayın, uçuş raporlarını tasarım belgesine yapıştırın.
   Bilim danışmanı bütün sayıları kaynağıyla kontrol eder.
6. **Yayınla ve sun** — Öğretmeniniz projeyi Netlify'da yayınlar, siz 5 dakikalık sunum yaparsınız.

---

## 4½. Fizik hesaplarını doğrula

Oyunun üst çubuğundaki **🧮 Hesaplar** düğmesi (`hesap.html`) görevinizin bütün hesaplarını,
oyunun kendi denklemleriyle, **formül → sayılar → sonuç** biçiminde gösterir. Bilgisayarda
Node.js varsa aynı rapor komut satırından da alınır:
```
node hesapla.mjs
```
`FIZIK-HESAPLARI.md`'ye yapay zekânın ya da sizin yazdığınız her sonucu bununla karşılaştırın.
Fark %1'den büyükse biri yanılmıştır: hangi adımda olduğunu bulun ve günlüğe yazın.

---

## 5. Yayınlama (öğretmen yapar)

**En hızlı yol:** Netlify'da öğretmen hesabıyla *Add new project → Deploy manually* ekranına
`gorev-kiti` klasörünü sürükleyip bırakın. Birkaç saniyede bir adres verilir.

**Sürekli güncellenen yol:** Klasör bir GitHub reposuna konur, Netlify o repoya bağlanır.
Takım her değişikliği **commit** edip **push** ettiğinde site kendiliğinden güncellenir.
`netlify.toml` dosyası hazırdır, ayar gerekmez.

---

## 6. Takıldıysan

| Sorun | Çözüm |
|---|---|
| Sayfa bembeyaz / siyah | Kırmızı kutu var mı? Yoksa F12 → *Console* sekmesindeki kırmızı yazıyı okuyun. |
| "Oyun yüklenemedi … file:" | Dosyaya çift tıklayarak açtınız. Bölüm 2'deki yollardan birini kullanın. |
| Araç kalkmıyor | Giriş ekranında "İtki / ağırlık" 1'den küçük mü? Rotoru büyütün ya da kütleyi azaltın. Havası olmayan yerde roket kullanın. |
| Hep sert iniş oluyor | Yere yaklaşırken S tuşunu bırakın; yardımcı pilot sizi yavaşlatır. Yatay hız 3 m/s'nin altında olmalı. |
| Gözlem çubuğu dolmuyor | Halkanın içinde, beyaz çizginin **altında** ve yavaş olmalısınız. |
| Değişiklik görünmüyor | Dosyayı kaydettiniz mi (Ctrl+S)? Sayfayı yenilediniz mi (F5)? |
| Yapay zekânın verdiği kod çalışmıyor | Hata mesajını ve kodu ona geri yapıştırın, "bu hatayı açıkla ve düzelt" deyin. Sonra **neden** çalışmadığını anlayın. |

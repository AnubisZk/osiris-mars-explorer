# Takım Rolleri

Takımlar **3–4 kişi** olur (5 kişilik takımda *Malzeme mühendisi* rolü eklenir; yoksa Bilim danışmanı üstlenir). 3 kişilik takımda *Sunucu* rolü diğerlerine paylaştırılır.
Herkesin bir ana rolü vardır ama **herkes her şeye yardım eder**. Roller, kimin neyden
*sorumlu* olduğunu belirler; kimin neyi *yasak* olduğunu değil.

| Rol | Adı | Ana sorumluluğu |
|---|---|---|
| 🎨 Tasarımcı | [ ... ] | Hikâye, hedefler, harita, görünüş |
| 💻 Kodcu | [ ... ] | Kodu değiştirmek, hataları ayıklamak |
| 🔬 Bilim danışmanı | [ ... ] | Her sayının doğru ve kaynaklı olması |
| 🎤 Sunucu ve kayıtçı | [ ... ] | YZ günlüğü, test raporları, sunum |
| 🧪 Malzeme mühendisi (isteğe bağlı) | [ ... ] | Malzeme günlüğü: yoğunluk, dayanım, sıcaklık sınırı, fiyat; Görev Fabrikası'nda maliyet |

**Takım kaptanı:** [ hangi rol? ] — İlk gün GitHub deposunu açar, kiti yükler ve yapay zekâyı
yönlendirerek `FIZIK-HESAPLARI.md`'yi doldurtur (atölyede "Aşama 0"). Genelde Kodcu kaptan olur.

---

## 🎨 Tasarımcı
- Görevin hikâyesini yazar, oyuncunun ne yapacağını tasarlar.
- Hedeflerin yerini kâğıt haritada belirler, `ayarlar.js` → `hedefler` listesine yazar.
- Aracın rengini, arazinin görünüşünü seçer (`arac.renk`, `arazi`).
- **Dosyaları:** `GOREV-TASARIMI.md` (bölüm 1, 4, 6), `ayarlar.js` (hikâye ve hedefler), `index.html` (renkler)
- **Yapay zekâya sorabileceği:** hikâye fikri, hedef isimleri, görsel fikirleri
- **Teslim:** dolu tasarım belgesi bölümleri + hedef haritası

## 💻 Kodcu
- Kiti bilgisayarda çalıştırır (README bölüm 2).
- Takımın istediği değişiklikleri koda işler; yapay zekâdan kod ister, **ne yaptığını anlamadan yapıştırmaz**.
- Bir hata çıktığında kırmızı kutuyu okur, düzeltir.
- **Dosyaları:** `ayarlar.js`, `oyun.js`, gerekirse `fizik.js` ve `arazi.js`
- **Yapay zekâya sorabileceği:** "bu kodu açıkla", "şu özelliği ekle", "bu hatayı düzelt"
- **Teslim:** çalışan oyun, her değişiklikten sonra kaydedilmiş hâli

## 🔬 Bilim danışmanı
- Görevin gezegeni ve aracı için gerçek sayıları bulur (NASA, ESA, TÜBİTAK kaynakları).
- Yapay zekânın verdiği **her sayıyı** bir kaynakla doğrular. Doğrulanamayan sayı oyuna girmez.
- Giriş ekranındaki "itki/ağırlık", "askıda kalma süresi" değerlerini elle hesaplar, oyunla karşılaştırır.
- **Dosyaları:** `GOREV-TASARIMI.md` (bölüm 2, 3), `gezegenler.js`, `ayarlar.js` (araç sayıları)
- **Yapay zekâya sorabileceği:** "bu değerin kaynağı ne?", "bu denklemi açıkla"
- **Teslim:** kaynaklı veri tablosu

## 🎤 Sunucu ve kayıtçı
- `YZ-GUNLUGU.md`'yi tutar: kim, ne zaman, hangi yapay zekâya, ne sordu, ne aldı, ne değiştirdi.
- `KOMUT-KAYDI.md`'yi denetler: ajanlara verilen her komut kelimesi kelimesine kaydedilmiş mi, commit'leri yazılmış mı? "Takımın kontrolü" satırlarını takımla birlikte doldurur.
- Test uçuşlarını yapar ya da izler, uçuş raporlarını tasarım belgesine yapıştırır.
- 5 dakikalık sunumu hazırlar ve takımı sunuma çalıştırır.
- **Dosyaları:** `YZ-GUNLUGU.md`, `KOMUT-KAYDI.md`, `GOREV-TASARIMI.md` (bölüm 7, 8)
- **Yapay zekâya sorabileceği:** sunum taslağı, anlatım sırası
- **Teslim:** dolu günlük + sunum

---

## Takım sözleşmesi (hep birlikte okuyup imzalayın)

1. Hiçbir yapay zekâ cevabını kontrol etmeden kullanmayacağız.
2. Her yapay zekâ kullanımını günlüğe yazacağız.
3. Kişisel bilgilerimizi (ad soyad, okul numarası, telefon, fotoğraf) yapay zekâya yazmayacağız.
4. Hesaplara yalnızca öğretmenimiz giriş yapacak.
5. Takılınca 10 dakikadan fazla tek başımıza uğraşmayıp takıma ya da öğretmene soracağız.

İmzalar: [ ... ]

## 🧪 Malzeme mühendisi
- Aracın gövdesi, pervaneleri ve bataryası için malzeme araştırır (MatWeb, üretici veri sayfaları, NASA/ESA raporları).
- Bulduğu her değeri **kaynağıyla** `MALZEME-GUNLUGU.md`'ye yazar: yoğunluk, çekme dayanımı, özgül enerji, en düşük çalışma sıcaklığı, fiyat.
- Görev Fabrikası bu günlüğü **hesaba katar**: yeni malzemeler seçeneklere eklenir, fiyatlar malzeme maliyetine, sıcaklık sınırları soğuk kontrolüne girer.
- Eski satırları silmez; bir değeri düzeltirken aynı kimlikle yeni satır ekler.
- **Dosyaları:** `MALZEME-GUNLUGU.md`, Fabrika'nın 2. ve 3. adımları, `TASARIM-RAPORU.md` (malzeme ve maliyet bölümleri)
- **Yapay zekâya sorabileceği:** "bu malzemenin özellikleri neler, hangi kaynakta bulurum?" (K2.4)
- **Teslim:** kaynaklı malzeme günlüğü + maliyet tablosunun yorumu

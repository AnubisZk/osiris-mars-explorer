# Yapay zekâ ajanları için talimatlar (AGENTS.md)

Bu depo, bir öğrenci takımının **Görev Kiti** projesidir: tarayıcıda çalışan, three.js ile
yazılmış bir uzay görevi uçuş simülatörü. Öğrenciler ortaokul/lise düzeyinde, Türkiye'de bir
Bilim ve Sanat Merkezi'nde (BİLSEM), **öğretmen gözetiminde** çalışıyor. Bu depoda çalışan her
yapay zekâ (Claude Code, Codex, GitHub Copilot ajanı vb.) aşağıdaki kurallara uyar.

## Dil ve üslup
- Bütün açıklamalar, kod yorumları, commit mesajları ve belgeler **Türkçe**.
- Öğrencinin anlayacağı sadelikte yaz. Ne yaptığını ve **neden** yaptığını açıkla.

## Dosya haritası
| Dosya | Ne | Kural |
|---|---|---|
| `ayarlar.js` | Görevin tamamı (hikâye, gezegen, araç, hedefler, rüzgâr, süre) | Alan adlarını ve yapıyı **değiştirme**; yalnızca değerleri değiştir. Birimler alan adındadır (`_kg`, `_m`, `_s`, `_W`, `_Wh`, `_N`). |
| `gezegenler.js` | Gezegenlerin bilimsel verileri | Bir değeri değiştirirsen `kaynak` alanına güvenilir kaynağı yaz (NASA, ESA). Kaynaksız sayı yazma. |
| `fizik.js` | Uçuş denklemleri (oyunun motoru) | Öğretmen ya da takım açıkça istemedikçe **değiştirme**. |
| `hesap.js`, `hesapla.mjs`, `hesap.html` | Hesapları fizik.js ile aynı denklemlerle üreten doğrulama motoru | Değiştirme; doğrulama için **kullan**. |
| `FIZIK-HESAPLARI.md` | Takımın fizik hesap defteri | Doldurulacak (aşağıya bak). |
| `GOREV-TASARIMI.md` | Takımın tasarım belgesi | Takımın kararlarının kaynağı. Oku; takım istemedikçe kendi kararını yazma. |
| `YZ-GUNLUGU.md` | Yapay zekâ kullanım günlüğü | Yaptığın her işi buraya bir satır olarak ekle. |
| `oyun.js`, `index.html`, `arazi.js` | Ekran, kontroller, arazi | "ÖĞRENCİ:" ile işaretli yerler değiştirilebilir. |

## Görev: depoyu doldurmak (ilk gün)
Takım kaptanı seni bu depoda şu işler için çalıştırır. Sırayla yap:

1. **Oku:** `README.md`, `GOREV-TASARIMI.md`, `ayarlar.js`, `fizik.js` (yalnızca denklemleri anlamak için), `gezegenler.js`.
2. **Görevi işle:** Kaptanın verdiği görev bilgileriyle (ya da GOREV-TASARIMI.md'deki kararlarla) `ayarlar.js`'teki değerleri güncelle. Bilmediğin bir değeri uydurma; takıma sor ya da `[ ... ]` olarak bırakıp nedenini yaz.
3. **Fizik hesap defterini doldur:** `FIZIK-HESAPLARI.md`'deki her satırı **formül → yerine koyma → sonuç (birimiyle)** biçiminde doldur. Kullanılmayan bölümü (3A rotor ya da 3B roket) sil.
4. **Doğrula:** `node hesapla.mjs` çalıştır (Node.js 18+). Çıktıdaki her sonucu defterdeki "Motorun sonucu" sütununa yaz ve farkı hesapla. Fark %1'den büyükse kendi hesabını düzelt; düzeltmeyi günlüğe yaz. Node yoksa takıma `hesap.html` sayfasını açmasını söyle.
5. **Kontrol et:** `node --check ayarlar.js` ile yazım hatası olmadığını doğrula. Giriş ekranında aracın "uçabilir" olması gerekir (itki/ağırlık > 1,05; rahat uçuş için > 1,5).
6. **Günlüğe yaz:** `YZ-GUNLUGU.md`'ye yaptığın her iş için bir satır ekle: saat, "Hangi araç" sütununa kendi adın, ne yapıldığı, nasıl kontrol edildiği ("hesapla.mjs ile karşılaştırıldı" gibi). "Kim" sütununu takım doldurur.
7. **Commit:** Küçük ve anlamlı commit'ler, Türkçe mesajlarla (ör. "ayarlar.js: Titan görevi işlendi", "FIZIK-HESAPLARI.md: rotor hesapları dolduruldu ve doğrulandı").

## Kesin kurallar
- **Sayı uydurma.** Bilimsel bir değer verdiysen kaynağını yaz. Emin değilsen "emin değilim" de.
- **Öğrencinin yerine öğrenme.** Hesapları açık yaz ki takım her adımı takip edip kendi hesap makinesiyle tekrarlayabilsin.
- **Kişisel bilgi yok.** Ad soyad, okul numarası, adres, telefon, fotoğraf yazma ve isteme. Takım üyelerini rolleriyle an.
- **Gizli bilgi yok.** API anahtarı, şifre, token gibi şeyleri depoya yazma.
- **Hesap ya da harici servis açma**, paket kurma, depoyu yayınlama gibi işleri yapma; bunları öğretmen yapar.
- Testler ya da `hesapla.mjs` başarısız olursa sorunu gizleme; açıkça raporla.

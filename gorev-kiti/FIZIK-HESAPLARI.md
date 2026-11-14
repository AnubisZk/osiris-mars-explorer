# Fizik Hesap Defteri

> Bu defteri **yapay zekâ ile birlikte** doldurun, ama her sonucu **siz kontrol edin**.
> Her hesap üç satırdan oluşur: **formül → sayıları yerine koyma → sonuç (birimiyle)**.
> Bitirince `hesap.html` sayfasını açın (ya da `node hesapla.mjs` çalıştırın) ve
> en sağdaki sütuna oyunun motorunun bulduğu sonucu yazın. Fark %1'den büyükse
> hatayı bulun ve **YZ-GUNLUGU.md** dosyasına yazın.

**Görev:** [ ayarlar.js → baslik ]
**Dolduran:** [ yapay zekâ aracının adı + kontrol eden takım üyesi ]
**Tarih:** [ ... ]

---

## 1. Ortam (Bilim danışmanı)

| Büyüklük | Sembol | Değer | Birim | Kaynak (bağlantı) |
|---|---|---|---|---|
| Gezegen / uydu | — | [ ... ] | — | — |
| Yerçekimi ivmesi | g | [ ... ] | m/s² | [ ... ] |
| Yüzeyde hava yoğunluğu | ρ | [ ... ] | kg/m³ | [ ... ] |
| Ses hızı | a | [ ... ] | m/s | [ ... ] |
| Dünya'dan ışık gecikmesi | — | [ ... ] | s / dk | [ ... ] |

## 2. Kütle ve ağırlık

| Hesap | Formül | Yerine koyma | Sonuç | Motorun sonucu | Fark |
|---|---|---|---|---|---|
| Toplam kütle | m = [ rotor: kutle_kg · roket: kuru + yakıt ] | [ ... ] | [ ... ] kg | [ ... ] | [ ... ] |
| Ağırlık | W = m × g | [ ... ] | [ ... ] N | [ ... ] | [ ... ] |
| Dünya'daki ağırlığı | W_D = m × 9,81 | [ ... ] | [ ... ] N | [ ... ] | — |

## 3A. Rotorlu araç (roketse başına "Bu görevde kullanılmıyor" yazın)

| Hesap | Formül | Yerine koyma | Sonuç | Motorun sonucu | Fark |
|---|---|---|---|---|---|
| En büyük itki | T = 0,012 × ρ × A × v_uç² | [ ... ] | [ ... ] N | [ ... ] | [ ... ] |
| İtki / ağırlık | T ÷ W | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| Disk yükü | W ÷ A | [ ... ] | [ ... ] N/m² | [ ... ] | [ ... ] |
| Uç Mach sayısı | v_uç ÷ a | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| İndüklenmiş hız | v_i = √(W ÷ (2ρA)) | [ ... ] | [ ... ] m/s | [ ... ] | [ ... ] |
| Askıda kalma gücü | P = W × v_i ÷ verim + avyonik | [ ... ] | [ ... ] W | [ ... ] | [ ... ] |
| Askıda kalma süresi | t = batarya × 3600 ÷ P | [ ... ] | [ ... ] s | [ ... ] | [ ... ] |

## 3B. Roketli araç (rotorsa başına "Bu görevde kullanılmıyor" yazın)

| Hesap | Formül | Yerine koyma | Sonuç | Motorun sonucu | Fark |
|---|---|---|---|---|---|
| İtki / ağırlık (dolu) | T_maks ÷ W | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| İtki / ağırlık (yakıt bitince) | T_maks ÷ (m_kuru × g) | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| Askıda yakıt tüketimi | ṁ = W ÷ (Isp × 9,807) | [ ... ] | [ ... ] kg/s | [ ... ] | [ ... ] |
| Askıda kalma süresi | t = yakıt ÷ ṁ | [ ... ] | [ ... ] s | [ ... ] | [ ... ] |
| Hız bütçesi | Δv = Isp × 9,807 × ln(m_dolu ÷ m_kuru) | [ ... ] | [ ... ] m/s | [ ... ] | [ ... ] |

## 4. Görev rotası

Üs (0, 0) → hedefler (ayarlar.js'teki sırayla) → Üs. Her ayak için Pisagor: mesafe = √(Δx² + Δz²)

| Ayak | Δx (m) | Δz (m) | Mesafe (m) | Motorun sonucu |
|---|---|---|---|---|
| Üs → [ 1. hedef ] | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| [ 1. hedef ] → [ 2. hedef ] | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| [ ... ] → Üs | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| **Toplam** | | | [ ... ] | [ ... ] |

## 5. Süre ve enerji / yakıt bütçesi (tahmini)

| Hesap | Formül | Yerine koyma | Sonuç | Motorun sonucu |
|---|---|---|---|---|
| Yatay uçuş süresi | toplam yol ÷ maksHiz | [ ... ] | [ ... ] s | [ ... ] |
| Tırmanış + iniş süresi | ayak sayısı × 2 × 25 m ÷ dikey hız (rotor 3, roket 4 m/s) | [ ... ] | [ ... ] s | [ ... ] |
| Gözlem süresi | gözlem sürelerinin toplamı | [ ... ] | [ ... ] s | [ ... ] |
| **Toplam süre** | toplamı | [ ... ] | [ ... ] s | [ ... ] |
| Gereken enerji (rotor) | P × süre ÷ 3600 | [ ... ] | [ ... ] Wh | [ ... ] |
| Gereken yakıt (roket) | ṁ × süre | [ ... ] | [ ... ] kg | [ ... ] |
| Bütçe oranı | gereken ÷ eldeki | [ ... ] | % [ ... ] | [ ... ] |

**Yorum:** Bütçe yetiyor mu? Süre sınırı varsa süre yetiyor mu? Yetmiyorsa ne değiştirirsiniz?
[ ... ]

---

## 6. Kontrol

- [ ] Bütün sonuçlar hesap.html (ya da `node hesapla.mjs`) ile karşılaştırıldı.
- [ ] Farkı %1'den büyük olan her satırın nedeni bulundu ve düzeltildi.
- [ ] Yapay zekânın yaptığı her hata YZ-GUNLUGU.md'ye yazıldı.
- [ ] Ortam tablosundaki her değerin kaynağı açılıp okundu.
- [ ] Bilim danışmanı imzası: [ ... ]

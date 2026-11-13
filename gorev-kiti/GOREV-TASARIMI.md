# Görev Tasarım Belgesi

> Bu belgeyi **kod yazmadan önce** doldurun. Gerçek uzay ajansları da önce görevi tasarlar,
> sonra aracı yapar. Köşeli parantezleri `[ ... ]` silip kendi cevaplarınızı yazın.

**Takım adı:** [ ... ]
**Takım üyeleri ve rolleri:** (ROLLER.md'deki gibi) [ ... ]
**Tarih:** [ ... ]

---

## 1. Görev özeti (Tasarımcı)

**Görevin adı:** [ ... ]

**Tek cümlede görev:** [ Örnek: "Titan'ın kumullarına inip üç bölgeden örnek gözlemleyen bir rotorlu araç." ]

**Hikâye (3–5 cümle):** Oyuncu oyuna başlarken bunu okuyacak.
[ ... ]

**Bu görev gerçek dünyada hangi göreve benziyor?** (Bilim danışmanı kaynağını bulsun)
[ ... ] — Kaynak: [ ... ]

---

## 2. Dünya (Bilim danışmanı)

| Özellik | Değer | Birim | Kaynak |
|---|---|---|---|
| Gezegen / uydu | [ ... ] | — | — |
| Yerçekimi | [ ... ] | m/s² | [ ... ] |
| Yüzeyde hava yoğunluğu | [ ... ] | kg/m³ | [ ... ] |
| Dünya'dan ışık gecikmesi | [ ... ] | s / dk | [ ... ] |
| Yüzey sıcaklığı (oyunda yok, bilgi için) | [ ... ] | °C | [ ... ] |

**Bu dünyada uçmayı zorlaştıran ya da kolaylaştıran ne?**
[ ... ]

---

## 3. Araç (Bilim danışmanı + Kodcu)

**Araç tipi:** ☐ rotor (havası olan yerler)  ☐ roket (her yerde)
**Neden bu tipi seçtiniz?** [ ... ]

| Özellik | Değer | Neden bu değer? |
|---|---|---|
| Kütle (kg) | [ ... ] | [ ... ] |
| Rotor alanı (m²) *ya da* en büyük itki (N) | [ ... ] | [ ... ] |
| Batarya (Wh) *ya da* yakıt (kg) | [ ... ] | [ ... ] |
| En yüksek hız (m/s) | [ ... ] | [ ... ] |

**Uçuştan önce tahmin (oyunu açmadan, hesap makinesiyle):**
- Ağırlık = kütle × yerçekimi = [ ... ] N
- Aracın kalkabilmesi için itki en az [ ... ] N olmalı.

**Oyunun giriş ekranında ölçülen (oyunu açınca doldurun):**
- İtki / ağırlık = [ ... ]
- Askıda kalma süresi = [ ... ] dakika
- Tahmininiz tuttu mu? Tutmadıysa neden? [ ... ]

---

## 4. Hedefler ve harita (Tasarımcı)

Kâğıda bir harita çizin: üs ortada (0, 0). Sağ = doğu (+x), aşağı = güney (+z). 100 m = 1 kare.

| # | Hedefin adı | x (m) | z (m) | Neden önemli? (bilimsel gerekçe) |
|---|---|---|---|---|
| 1 | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| 2 | [ ... ] | [ ... ] | [ ... ] | [ ... ] |
| 3 | [ ... ] | [ ... ] | [ ... ] | [ ... ] |

**Toplam rota uzunluğu (tahmini):** [ ... ] m
**En yüksek hızla bu rota kaç saniye sürer?** [ ... ] s → Batarya/yakıt yeter mi? [ ... ]

---

## 5. Zorluk ve kurallar (Tüm takım)

- Rüzgâr var mı? Ne kadar? [ ... ]
- Süre sınırı var mı? Neden? (hikâyeyle bağlayın: fırtına, gece, oksijen...) [ ... ]
- Işık gecikmesi oyunda olacak mı? [ ... ]
- Oyuncu neden kaybeder? [ ... ]

---

## 6. Görünüş (Tasarımcı)

- Araç rengi: [ ... ]   - Arazi: tohum [ ... ], krater sayısı [ ... ], tepe yüksekliği [ ... ] m
- Ek fikirler (yapay zekâyla yapılabilir): [ Örnek: ses efekti, yeni bir araç modeli, gece modu ]

---

## 7. Test sonuçları (Tüm takım)

Her denemeden sonra oyunun verdiği **uçuş raporunu** buraya yapıştırın. En az 3 deneme.

```
[ Deneme 1 raporu ]
```
```
[ Deneme 2 raporu ]
```
```
[ Deneme 3 raporu ]
```

**Denemeler arasında neyi değiştirdiniz, sonuç nasıl etkilendi?**
[ ... ]

---

## 8. Ne öğrendik? (Tüm takım, sunumdan önce)

- Bu görevde en şaşırtıcı bilimsel gerçek: [ ... ]
- Yapay zekâ nerede çok işe yaradı? [ ... ]
- Yapay zekâ nerede yanıldı ve bunu nasıl fark ettiniz? [ ... ]
- Bir gün daha olsaydı ne eklerdiniz? [ ... ]

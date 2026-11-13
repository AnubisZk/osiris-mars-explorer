# Komut Kaydı

> Bu dosya, takımın yapay zekâ **ajanlarına** (depoya erişip dosya değiştiren yapay zekâlar:
> Claude Code, Codex, GitHub Copilot ajanı vb.) verdiği **her komutun kelimesi kelimesine
> kaydıdır.** Projemizin şeffaflık belgesidir: kim, hangi komutu verdi, ajan ne yaptı, hangi
> commit'ler oluştu ve takım neyi kontrol etti.
>
> - Kaydı **ajan kendisi tutar** (AGENTS.md kuralı): komutu, işe başlamadan önce olduğu gibi
>   buraya ekler; kısaltmaz, düzeltmez, özetlemez.
> - Takım her kaydı okur ve **"Takımın kontrolü"** satırını kendisi doldurur.
> - Komut atölyedeki hazır komutlardan biriyse ilk satırında kodu vardır (ör. `[Hazır komut K0.1]`).
>   Takım komutu değiştirdiyse ne değiştirdiğini yazar.
> - Komutlara kişisel bilgi yazılmaz. Yanlışlıkla yazıldıysa ajan onu `[kişisel bilgi çıkarıldı]`
>   ile değiştirir ve takıma söyler.
>
> Sitedeki 🤖 Asistan'a (sohbet) sorulan sorular burada değil, asistanın indirilebilir
> günlüğünde tutulur; o günlüğü de YZ-GUNLUGU.md'ye ekleyin.

---

## Kayıt biçimi (her yeni komut için bu bloğu kopyalayın)

```
## Komut <sıra no> — <tarih saat>
- **Kim verdi (rol):** <ör. Takım kaptanı>
- **Ajan ve model:** <ör. Claude Code · claude-sonnet-5-5>
- **Kaynak:** <Atölye hazır komutu K0.1 "Ajanla depoyu doldur" — değiştirilmeden | şu değişikliklerle: ... | Takımın kendi komutu>
- **Komutun tam metni:**
  (dört ters tırnaklı blok içinde, kelimesi kelimesine)
- **Ajanın yaptıkları:** <değişen dosyalar, kısa açıklama>
- **Commit'ler:** <kısa hash'ler, ör. a1b2c3d, e4f5a6b>
- **Ajanın emin olmadıkları / takımın kontrol etmesi gerekenler:** <...>
- **Takımın kontrolü (takım doldurur):** <kim, neyi, nasıl kontrol etti; sonuç>
```

---

## Kayıtlar

<!-- Ajan yeni kayıtları bu satırın ALTINA, sırayla ekler. -->

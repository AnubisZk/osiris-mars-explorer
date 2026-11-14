"""Oyun içi mesajların İngilizce karşılıkları (web sürümündeki dil seçicisi için).

mars_core.py mesajları Türkçe üretir; bu dosya onları İngilizceye çevirir. Yeni bir mesaj
eklendiğinde buraya da bir satır eklenmeli: web/test_ceviri.py eksik çeviriyi yakalar.
Her satır: (Türkçe kalıp — düzenli ifade, İngilizce karşılık — \\1, \\2 yakalanan parçalar).
"""
import re

KAYALAR = {
    "Delta Tortusu": "Delta Deposit",
    "Koyu Bazalt": "Dark Basalt",
    "Katmanlı Kaya": "Layered Rock",
    "Arazi panoraması": "Terrain panorama",
}

_KALIPLAR = [
    # --- mars_core.py: görev
    (r"Görev: 3 kayayı tara, ardından üsse dön ve güvenle in\.", "Mission: scan 3 rocks, then return to base and land safely."),
    (r"Tarama için havalan ve en az 0,7 m yüksel\.", "Take off and climb to at least 0.7 m to scan."),
    (r"(.+) başarıyla tarandı! \((\d+)/3\)", r"\1 scanned successfully! (\2/3)"),
    (r"Tarama menzilinde henüz taranmamış kaya yok \(75 birim\)\.", "No unscanned rock within scan range (75 units)."),
    (r"Görev başarısız: araç hasarlı veya enerji tükendi\.", "Mission failed: vehicle damaged or out of energy."),
    (r"GÖREV BAŞARILI! Üç kaya tarandı, üsse güvenle dönüldü\.", "MISSION SUCCESS! Three rocks scanned, safely back at base."),
    (r"GÖREV TAMAMLANDI! Araştırma, veri aktarımı ve dönüş başarılı\.", "MISSION COMPLETE! Research, data uplink and return successful."),
    # --- mars_core.py: gezgin ve drone
    (r"Batarya değişimi için drone gezgin üzerine kenetlenmeli \(F\)\.", "The drone must be docked on the rover to swap batteries (F)."),
    (r"Batarya bölmesi çok soğuk\. Isıtıcıyı \(H\) etkinleştir\.", "Battery bay is too cold. Turn on the heater (H)."),
    (r"Depoda yedek batarya yok\.", "No spare battery in storage."),
    (r"Mevcut bataryadan daha dolu yedek bulunmuyor\.", "No spare is more charged than the current battery."),
    (r"Batarya değişti: ([\d.]+) Wh → ([\d.]+) Wh\. Eski pil depoda\.", r"Battery swapped: \1 Wh → \2 Wh. Old pack stored."),
    (r"Onarım için drone gezgine kenetlenmeli\.", "The drone must be docked on the rover for repair."),
    (r"Drone zaten sağlam\.", "The drone is already in good condition."),
    (r"Onarım için gezgin enerjisi yetersiz\.", "Not enough rover energy for repair."),
    (r"Drone bakımı tamamlandı: (\d+) → (\d+) dayanıklılık\.", r"Drone maintenance complete: \1 → \2 durability."),
    (r"Drone gezginin üstünde\. Space/↑ ile kalkış yap\.", "Drone is on the rover. Press Space/↑ to take off."),
    (r"Kontrol: GEZGİN \(WASD\)", "Control: ROVER (WASD)"),
    (r"Kontrol: DRONE \(WASD \+ ↑/↓\)", "Control: DRONE (WASD + ↑/↓)"),
    (r"Kalkış: drone gezginin platformundan ayrıldı\.", "Take-off: the drone left the rover's platform."),
    (r"Dünya'ya aktarılan simüle veri paketi: (\d+)/(\d+)", r"Simulated data packets sent to Earth: \1/\2"),
    (r"UYARI: Alçak uçuşta kayaya temas! Drone -15 dayanıklılık", "WARNING: Hit a rock while flying low! Drone −15 durability"),
    (r"Görev tamamlandı veya sonlandı\.", "Mission completed or ended."),
    (r"Drone gezgine kenetli\. Önce Space/↑ ile kalkış yap\.", "The drone is docked. Take off first with Space/↑."),
    (r"Drone taraması kaydedildi: (.+) \[Paket #(\d+)\]", r"Drone scan recorded: \1 [Packet #\2]"),
    (r"Gezgin kamerası ve sensör kaydı: (.+) \[Paket #(\d+)\]", r"Rover camera and sensor record: \1 [Packet #\2]"),
    (r"Gezgin (.+) konumunda araştırma tamamladı\.", r"Rover completed its survey at \1."),
    (r"Gezgin araştırması için taranmamış kayaya 66 harita birimi yaklaş \(R\)\.", "Move within 66 map units of an unsurveyed rock to survey (R)."),
    (r"Drone zaten gezginin üzerinde\.", "The drone is already on the rover."),
    (r"Kenetlenme için gezginin 35 birim yakınına ve 0,9 m altına yavaşça in\.", "To dock, come within 35 units of the rover and descend slowly below 0.9 m."),
    (r"Drone kenetlendi\. (\d+) görüntü/sensör paketi gezgine indirildi\.", r"Drone docked. \1 image/sensor packets transferred to the rover."),
    (r"Dünya veri bağlantısı AÇIK \(simülasyon\)\.", "Earth data link ON (simulation)."),
    (r"Dünya veri bağlantısı KAPALI\.", "Earth data link OFF."),
    (r"Batarya deposu ısıtması AÇIK\.", "Battery storage heater ON."),
    (r"Batarya deposu ısıtması KAPALI\.", "Battery storage heater OFF."),
    (r"Güneş paneli AÇIK\.", "Solar panel ON."),
    (r"Güneş paneli KAPALI\.", "Solar panel OFF."),
    (r"Görev artık aktif değil\.", "The mission is no longer active."),
    (r"Kamera veri deposu dolu \(80 paket\)\.", "Camera storage is full (80 packets)."),
    (r"Drone kamerasından görüntü alındı \[Paket #(\d+)\]\.", r"Image taken with the drone camera [Packet #\1]."),
    (r"Gezgin kamerasından görüntü alındı \[Paket #(\d+)\]\.", r"Image taken with the rover camera [Packet #\1]."),
    (r"Kamera görüntüsü ve konum verileri kaydedildi: #(\d+)\.", r"Camera image and position data saved: #\1."),
    # --- web/kopru.py
    (r"Başlat'a bas; drone gezginin üzerinde başlar\.", "Press Start; the drone starts on top of the rover."),
    (r"Gezginin önünde kayalık/harita sınırı var\. Etrafından dolaş\.", "Rocks or the map edge block the rover. Drive around."),
    (r"Görev sonlandı\. Yeni Görev düğmesine bas\.", "The mission has ended. Press New Mission."),
    (r"Görev sürüyor\.", "Mission running."),
    (r"Görev duraklatıldı\.", "Mission paused."),
    (r"Kontrol: GEZGİN — WASD kullan\.", "Control: ROVER — use WASD."),
    (r"Kontrol: DRONE — WASD kullan\.", "Control: DRONE — use WASD."),
    (r"Tarama için önce görevi başlat\.", "Start the mission before scanning."),
    (r"Araştırma için önce görevi başlat\.", "Start the mission before surveying."),
    (r"Kamera için önce görevi başlat\.", "Start the mission before using the camera."),
    (r"Kenetlenmek için görevi başlat\.", "Start the mission to dock."),
    (r"Batarya değişimi için görevi başlat\.", "Start the mission to swap batteries."),
    (r"Onarım için görevi başlat\.", "Start the mission to repair."),
    (r"Yeni görev: Drone gezgin üzerinde\. Başlat ve Space/↑ ile kalk\.", "New mission: the drone is on the rover. Press Start, then Space/↑ to take off."),
    (r"Görev yüklendi\. Başlat'a basıp kaldığın yerden devam et\.", "Mission loaded. Press Start to continue where you left off."),
    (r"Kayıt dosyası çok büyük \(en çok 4 MB\)\.", "Save file is too large (max 4 MB)."),
    (r"Önce görevi başlat ve kısa süre simülasyonu çalıştır\.", "Start the mission and let the simulation run for a moment first."),
    # --- kayıt doğrulama hataları (genel)
    (r"Desteklenmeyen kayıt sürümü \(1 veya 3 bekleniyor\)\.", "Unsupported save version (1 or 3 expected)."),
    (r"Kayıt alanı geçersiz: (.+)", r"Invalid save field: \1"),
    (r"NaN/Infinity yasak", "NaN/Infinity are not allowed"),
    (r"(.+) geçersiz\.", r"Invalid value: \1."),
]
_DERLENMIS = [(re.compile("^" + k + "$"), e) for k, e in _KALIPLAR]
_KAYA = re.compile("|".join(re.escape(k) for k in sorted(KAYALAR, key=len, reverse=True)))


def kaya(ad, dil):
    return KAYALAR.get(ad, ad) if dil == "en" else ad


def cevir(metin, dil):
    """Türkçe oyun mesajını seçilen dile çevirir. Çevirisi olmayan mesaj Türkçe kalır."""
    if dil != "en" or not metin:
        return metin
    for kalip, karsilik in _DERLENMIS:
        m = kalip.match(metin)
        if m:
            sonuc = m.expand(karsilik)
            return _KAYA.sub(lambda k: KAYALAR[k.group(0)], sonuc)
    return metin


def cevrildi_mi(metin):
    return any(k.match(metin) for k, _ in _DERLENMIS)

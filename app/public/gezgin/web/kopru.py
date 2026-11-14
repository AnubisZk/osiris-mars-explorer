"""Tarayıcı köprüsü: oyun/mars_core.py'yi (masaüstü oyunuyla AYNI dosya) web arayüzüne bağlar.

Tarayıcıda Pyodide (WebAssembly ile çalışan Python) bu dosyayı yükler. Fizik, enerji, görev ve
kayıt kuralları mars_core.py'den gelir; burada yalnızca masaüstü arayüzünün (mars_oyunu.py)
yaptığı işler tekrarlanır: duraklatma, zaman adımı, durum mesajları, kamera görüntüsü, kayıt.
"""
import csv
import io
import json
import math
from pathlib import Path

from mars_core import GameSession, WORLD_W, WORLD_H, BASE_X, BASE_Y
from kamera import create_capture
from ceviri import cevir, kaya

KAMERA_KLASORU = Path("/oyun/kamera_kayitlari")
ADIM_S = 0.02            # masaüstündeki gibi sabit 0,02 s fizik adımı
MAKS_KARE_S = 0.1


class Oyun:
    def __init__(self):
        self.yeni()

    # ------------------------------------------------------------------ durum
    def yeni(self):
        self.s = GameSession()
        self.duraklatildi = True
        self.biriken = 0.0
        self.son_ornek = -1.0
        self.son_engel = -10.0
        self.mesaj = "Başlat'a bas; drone gezginin üzerinde başlar."
        return self.mesaj

    def _durdur_bitince(self):
        m = self.s.mission
        if m.finished or m.failed:
            self.duraklatildi = True
            self.mesaj = m.message

    def ilerle(self, gecen_s, x, y, tirmanma):
        """Bir ekran karesi kadar zamanı 0,02 s'lik adımlarla işler (masaüstü loop() ile aynı)."""
        if self.duraklatildi:
            return
        self.biriken += min(MAKS_KARE_S, max(0.0, gecen_s))
        while self.biriken >= ADIM_S:
            self.s.step(ADIM_S, x, y, tirmanma)
            self.biriken -= ADIM_S
            if self.s.rover_model.last_move_blocked and self.s.elapsed - self.son_engel > 2:
                self.son_engel = self.s.elapsed
                self.mesaj = "Gezginin önünde kayalık/harita sınırı var. Etrafından dolaş."
            if self.s.mission.finished or self.s.mission.failed:
                self._durdur_bitince()
                break
        if self.s.elapsed - self.son_ornek >= 0.5:
            self.s.report.append(self.s.telemetry_row())
            self.s.report = self.s.report[-2500:]
            self.son_ornek = self.s.elapsed

    # ------------------------------------------------------------------ eylemler
    def _yakala(self, paket):
        s = self.s
        arac = s.drone if paket.source == "drone" else s.rover
        yol = create_capture(KAMERA_KLASORU, paket.source, paket.packet_id, arac.x, arac.y,
                             s.drone.altitude if paket.source == "drone" else 0.0, paket.target)
        paket.image_file = "kamera_kayitlari/" + Path(yol).name

    def _paketli(self, fn, bekleme_mesaji):
        if self.duraklatildi:
            return bekleme_mesaji
        once = len(self.s.packets)
        sonuc = fn()
        if len(self.s.packets) > once:
            self._yakala(self.s.packets[-1])
        return sonuc

    def eylem(self, ad):
        s = self.s
        if ad == "duraklat":
            if s.mission.finished or s.mission.failed:
                self.mesaj = "Görev sonlandı. Yeni Görev düğmesine bas."
            else:
                self.duraklatildi = not self.duraklatildi
                self.biriken = 0.0
                self.mesaj = "Görev sürüyor." if not self.duraklatildi else "Görev duraklatıldı."
        elif ad == "degistir":
            secili = s.switch_vehicle()
            self.mesaj = f"Kontrol: {'GEZGİN' if secili == 'rover' else 'DRONE'} — WASD kullan."
        elif ad == "tara":
            self.mesaj = self._paketli(s.scan_drone, "Tarama için önce görevi başlat.")
        elif ad == "arastir":
            self.mesaj = self._paketli(s.survey_rover, "Araştırma için önce görevi başlat.")
        elif ad == "kamera":
            self.mesaj = self._paketli(s.take_photo, "Kamera için önce görevi başlat.")
        elif ad == "kenetle":
            self.mesaj = "Kenetlenmek için görevi başlat." if self.duraklatildi else s.try_dock()
        elif ad == "pil":
            self.mesaj = "Batarya değişimi için görevi başlat." if self.duraklatildi else s.swap_battery()
        elif ad == "onar":
            self.mesaj = "Onarım için görevi başlat." if self.duraklatildi else s.repair()
        elif ad == "aktarim":
            s.toggle_uplink(); self.mesaj = s.events[-1]
        elif ad == "isi":
            s.toggle_heater(); self.mesaj = s.events[-1]
        elif ad == "gunes":
            s.toggle_solar(); self.mesaj = s.events[-1]
        elif ad == "yeni":
            self.yeni()
            self.mesaj = "Yeni görev: Drone gezgin üzerinde. Başlat ve Space/↑ ile kalk."
        else:
            raise ValueError(f"Bilinmeyen eylem: {ad}")
        return self.mesaj

    # ------------------------------------------------------------------ ekrana veri
    def durum(self, dil="tr"):
        s = self.s
        t = lambda m: cevir(m, dil)
        d, r, c, rm = s.drone, s.rover, s.model.config, s.rover_model
        a = s.model.analysis()
        return json.dumps({
            "dunya": {"w": WORLD_W, "h": WORLD_H, "us": [BASE_X, BASE_Y]},
            "duraklatildi": self.duraklatildi, "mesaj": t(self.mesaj), "secili": s.selected,
            "bitti": s.mission.finished, "basarisiz": s.mission.failed, "gorevMesaji": t(s.mission.message),
            "sure": s.elapsed, "olay": t(s.events[-1]) if s.events else "",
            "kayalar": [{"x": k.x, "y": k.y, "ad": kaya(k.label, dil), "tarandi": k.scanned, "arastirildi": k.surveyed}
                        for k in s.mission.rocks],
            "engeller": [list(h) for h in s.mission.hazards],
            "drone": {"x": d.x, "y": d.y, "irtifa": d.altitude, "dikeyHiz": d.vertical_speed,
                      "pil": d.battery_wh, "pilKapasite": c.battery_wh, "saglik": d.health,
                      "havada": d.airborne, "kenetli": d.docked, "kutle": c.mass,
                      "gerekliItki": a["gerekliItisN"], "itki": s.model.thrust_n, "itkiOrani": a["itisOrani"],
                      "guc": s.model.power_w, "bekleyenPaket": len(s.drone_packets)},
            "gezgin": {"x": r.x, "y": r.y, "pil": r.battery_wh, "pilKapasite": rm.config.battery_capacity_wh,
                       "gunes": rm.solar_w, "tuketim": rm.load_w, "yedekSarj": rm.charge_w,
                       "disOrtam": rm.ambient_c, "bolme": r.bay_temp_c, "isitici": r.heater_enabled,
                       "panel": r.solar_deployed, "yedekler": r.spare_batteries_wh,
                       "degisim": r.swapped_count, "saglik": r.health,
                       "aktariyor": rm.is_uplinking, "baglanti": rm.uplink_enabled, "firtina": rm.storm_active},
            "ilerleme": s.mission_progress(),
            "paketler": [{"no": p.packet_id, "kaynak": p.source, "hedef": kaya(p.target, dil), "saat": p.acquired_s,
                          "dosya": p.image_file, "aktarildi": p.delivered, "gezginde": p.transferred_to_rover,
                          "boyut": p.size_mb, "ilerleme": p.progress_mb}
                         for p in s.packets],
        }, ensure_ascii=False, allow_nan=False)

    # ------------------------------------------------------------------ kayıt
    def kaydet(self):
        return json.dumps(self.s.to_dict(), ensure_ascii=False, indent=2, allow_nan=False)

    def yukle(self, metin):
        if len(metin.encode("utf-8")) > 4_000_000:
            raise ValueError("Kayıt dosyası çok büyük (en çok 4 MB).")

        def yasak(v):
            raise ValueError("NaN/Infinity yasak")
        veri = json.loads(metin, parse_constant=yasak)
        taze = GameSession.from_dict(veri)       # hata olursa mevcut oyun bozulmaz
        self.s = taze
        self.duraklatildi = True
        self.biriken = 0.0
        self.son_ornek = taze.elapsed
        self.mesaj = "Görev yüklendi. Başlat'a basıp kaldığın yerden devam et."
        return self.mesaj

    def csv(self):
        if not self.s.report:
            raise ValueError("Önce görevi başlat ve kısa süre simülasyonu çalıştır.")
        tampon = io.StringIO()
        yazici = csv.DictWriter(tampon, fieldnames=list(self.s.telemetry_row()), extrasaction="ignore")
        yazici.writeheader()
        yazici.writerows(self.s.report)
        return tampon.getvalue()


oyun = Oyun()

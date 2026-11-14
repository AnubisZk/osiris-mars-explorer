"""MARS PATHFINDER — standart Python ile çalışan 2B keşif oyunu.
Python 3.10+, tkinter (Windows Python kurulumunda dahildir).
Model: öğretici/oyunlaştırılmış yaklaşık dinamik; gerçek uçuş sertifikasyonu değildir.
"""
from __future__ import annotations
import json
import math
import random
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
# Not: Bu çekirdek tkinter KULLANMAZ. Böylece aynı dosya hem masaüstü oyununda (mars_oyunu.py)
# hem de tarayıcıdaki web sürümünde (Pyodide ile, web/kopru.py) değiştirilmeden çalışır.

# --- Korunan JavaScript API'sinin Python karşılığı ---
INGENUITY_REFERANS = {"kutleKg": 1.8, "rotorCapM": 1.2, "marsYercekimiMps2": 3.71}

def _positive(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} pozitif ve sonlu bir sayı olmalıdır.")
    return float(value)

def gerekliHavadaKalmaItisi(kutleKg, yercekimiMps2=INGENUITY_REFERANS["marsYercekimiMps2"]):
    """Newton cinsinden ağırlık: F=m*g. Orijinal işlev korunur."""
    return _positive(kutleKg, "Kütle") * _positive(yercekimiMps2, "Yerçekimi")

def itisAnalizi(mevcutItisN, kutleKg=INGENUITY_REFERANS["kutleKg"]):
    """Orijinal anahtarları koruyan karşılaştırma."""
    gerekli = gerekliHavadaKalmaItisi(kutleKg)
    if isinstance(mevcutItisN, bool) or not isinstance(mevcutItisN, (int, float)) or not math.isfinite(mevcutItisN) or mevcutItisN < 0:
        raise ValueError("Mevcut itiş sıfır veya daha büyük sonlu bir sayı olmalıdır.")
    oran = mevcutItisN / gerekli
    return {"gerekliItisN": gerekli, "mevcutItisN": float(mevcutItisN),
            "itisOrani": oran, "havadaKalabilir": oran >= 1}

# Pythonik isimler; yukarıdaki orijinal isimler de kullanılabilir.
gerekli_havada_kalma_itisi = gerekliHavadaKalmaItisi
itis_analizi = itisAnalizi

@dataclass
class Config:
    mass: float = 1.8
    gravity: float = 3.71
    rotor_diameter: float = 1.2
    atmosphere_density: float = 0.020  # kg/m³, basitleştirilmiş varsayım
    efficiency: float = 0.65
    battery_wh: float = 40.0   # oyun parametresi, NASA ölçümü iddiası değil
    avionics_w: float = 35.0
    max_thrust_n: float = 13.0  # oyun parametresi
    max_horizontal_speed: float = 5.0
    max_vertical_speed: float = 2.5

    def validate(self):
        for key in ("mass", "gravity", "rotor_diameter", "atmosphere_density", "efficiency", "battery_wh", "max_thrust_n", "max_horizontal_speed", "max_vertical_speed"):
            _positive(getattr(self, key), key)
        if not 0 < self.efficiency <= 1:
            raise ValueError("Verim 0 ile 1 arasında olmalıdır.")
        if self.avionics_w < 0 or not math.isfinite(self.avionics_w):
            raise ValueError("Elektronik güç tüketimi geçersiz.")

@dataclass
class Vehicle:
    x: float = 75.0
    y: float = 500.0
    vx: float = 0.0
    vy: float = 0.0
    altitude: float = 0.0
    vertical_speed: float = 0.0
    battery_wh: float = 40.0
    health: float = 100.0
    airborne: bool = False
    docked: bool = False

@dataclass
class Rock:
    x: float
    y: float
    label: str
    scanned: bool = False
    surveyed: bool = False

WORLD_W, WORLD_H = 1100, 700
BASE_X, BASE_Y = 75.0, 500.0

class FlightModel:
    """Sabit zaman adımıyla güncellenen oyun fiziği. Dünya düzleminde x,y; yükseklik ayrı."""
    def __init__(self, config=None):
        self.config = config or Config()
        self.config.validate()
        self.vehicle = Vehicle(battery_wh=self.config.battery_wh)
        self.throttle = 0.0
        self.power_w = 0.0
        self.thrust_n = 0.0
        self.elapsed = 0.0

    def estimate_power(self, thrust_n):
        """İdeal aktüatör diski momentum teorisi; basitleştirilmiş tahmin.
        P_ideal=T^(3/2)/sqrt(2*rho*A); kayıplar için verime bölünür.
        """
        if thrust_n < 0 or not math.isfinite(thrust_n):
            raise ValueError("İtiş negatif olamaz.")
        c = self.config
        area = math.pi * (c.rotor_diameter / 2) ** 2
        induced = thrust_n ** 1.5 / math.sqrt(2 * c.atmosphere_density * area) / c.efficiency
        return induced + c.avionics_w

    def step(self, dt, horizontal_x=0.0, horizontal_y=0.0, climb=0.0):
        if not 0 < dt <= 0.2:
            raise ValueError("Zaman adımı 0 ile 0.2 saniye arasında olmalıdır.")
        v, c = self.vehicle, self.config
        if v.docked or v.health <= 0 or v.battery_wh <= 0:
            self.thrust_n = self.power_w = 0.0
            return
        horizontal_x = max(-1.0, min(1.0, horizontal_x))
        horizontal_y = max(-1.0, min(1.0, horizontal_y))
        climb = max(-1.0, min(1.0, climb))
        if not v.airborne:
            self.thrust_n = self.power_w = 0.0
            if climb > 0:
                v.airborne = True
                v.altitude = 0.08
            else:
                return
        # Basit irtifa kontrolü: nötr girişte ağırlığı dengeler.
        desired_accel = climb * 2.8 - 0.9 * v.vertical_speed
        target_thrust = c.mass * (c.gravity + desired_accel)
        self.thrust_n = max(0.0, min(c.max_thrust_n, target_thrust))
        actual_accel = self.thrust_n / c.mass - c.gravity
        v.vertical_speed = max(-c.max_vertical_speed, min(c.max_vertical_speed, v.vertical_speed + actual_accel * dt))
        v.altitude += v.vertical_speed * dt
        if v.altitude <= 0:
            if v.vertical_speed < -1.7:
                v.health = max(0.0, v.health - 22.0)
            v.altitude = 0.0
            v.vertical_speed = 0.0
            v.airborne = False
            self.thrust_n = self.power_w = 0.0
            return
        # Hızın ani değişmesini engelleyen yumuşatılmış kumanda.
        norm = max(1.0, math.hypot(horizontal_x, horizontal_y))
        desired_vx = horizontal_x / norm * c.max_horizontal_speed
        desired_vy = horizontal_y / norm * c.max_horizontal_speed
        responsiveness = min(1.0, dt * 2.4)
        v.vx += (desired_vx - v.vx) * responsiveness
        v.vy += (desired_vy - v.vy) * responsiveness
        v.x = min(WORLD_W - 25, max(25, v.x + v.vx * dt * 13))
        v.y = min(WORLD_H - 25, max(25, v.y + v.vy * dt * 13))
        self.power_w = self.estimate_power(self.thrust_n)
        v.battery_wh = max(0.0, v.battery_wh - self.power_w * dt / 3600.0)
        self.elapsed += dt
        if v.battery_wh == 0:
            v.health = max(0.0, v.health - 2.0)

    def analysis(self):
        result = itisAnalizi(self.thrust_n, self.config.mass)
        result.update({"gucW": self.power_w, "enerjiWh": self.vehicle.battery_wh,
                       "tahminiKalanSureS": self.vehicle.battery_wh * 3600 / self.power_w if self.power_w > 0 else None})
        return result

class Mission:
    def __init__(self, seed=42):
        rng = random.Random(seed)
        self.rocks = [Rock(x, y, name) for x, y, name in
                      ((300, 210, "Delta Tortusu"), (620, 455, "Koyu Bazalt"), (915, 245, "Katmanlı Kaya"))]
        self.hazards = [(rng.randint(190, 900), rng.randint(120, 580), rng.randint(17, 29)) for _ in range(9)]
        self.finished = False
        self.failed = False
        self.message = "Görev: 3 kayayı tara, ardından üsse dön ve güvenle in."

    def scan(self, v):
        if not v.airborne or v.altitude < 0.7:
            return "Tarama için havalan ve en az 0,7 m yüksel."
        for rock in self.rocks:
            if not rock.scanned and math.hypot(v.x - rock.x, v.y - rock.y) < 75:
                rock.scanned = True
                return f"{rock.label} başarıyla tarandı! ({sum(r.scanned for r in self.rocks)}/3)"
        return "Tarama menzilinde henüz taranmamış kaya yok (75 birim)."

    def update(self, v, *, extended=False, rover=None, packets=None):
        if v.health <= 0 or (v.battery_wh <= 0 and not v.docked):
            self.failed = True
            self.message = "Görev başarısız: araç hasarlı veya enerji tükendi."
        if not self.finished and not self.failed and all(r.scanned for r in self.rocks):
            if extended:
                ready = (rover is not None and packets is not None
                         and v.docked and sum(r.surveyed for r in self.rocks) >= 2
                         and len(packets) >= 5 and all(p.delivered for p in packets)
                         and math.hypot(rover.x - BASE_X, rover.y - BASE_Y) < 60)
            else:
                ready = math.hypot(v.x - BASE_X, v.y - BASE_Y) < 55 and not v.airborne
            if ready:
                self.finished = True
                self.message = "GÖREV BAŞARILI! Üç kaya tarandı, üsse güvenle dönüldü."


# ---------------------------------------------------------------------------
# ROVER DESTEK SİSTEMİ / OYUN MEKANİKLERİ
# NASA spesifikasyonu olmayan tüm sayısal değerler oyun dengesi varsayımıdır.
# Zaman ve enerji gerçek Wh/s birimleriyle tutarlı; hareket haritası şematiktir.
# ---------------------------------------------------------------------------

from typing import Optional


# Gezgin değerleri modeller/modeller.json ile (mimari çizimler v1.0) aynı tutulur;
# test_modeller.py bu uyumu denetler. Çizimde olmayan değerler oyun dengesi varsayımıdır.
@dataclass(frozen=True)
class RoverConfig:
    battery_capacity_wh: float = 1200.0   # çizim: batarya kapasitesi ≈ 1,2 kWh (modüler)
    initial_energy_wh: float = 900.0      # oyun varsayımı: görev %75 dolu pille başlar
    solar_peak_w: float = 120.0           # çizim: güneş paneli gücü ≈ 120 W
    wheels_w: float = 125.0
    electronics_w: float = 22.0
    heater_w: float = 42.0
    uplink_w: float = 70.0
    charger_w: float = 100.0              # çizim: drone şarj gücü ≈ 100 W (indüktif)
    rover_speed_world_s: float = 54.0
    rover_radius_world: float = 19.0
    uplink_mb_s: float = 1.8
    spare_capacity_wh: float = 40.0
    min_reserve_wh: float = 50.0

    def validate(self):
        for name in self.__dataclass_fields__:
            _positive(getattr(self, name), name)
        if self.initial_energy_wh > self.battery_capacity_wh:
            raise ValueError("Gezgin başlangıç enerjisi kapasiteyi aşamaz.")


@dataclass
class Rover:
    x: float = BASE_X
    y: float = BASE_Y
    battery_wh: float = 900.0
    health: float = 100.0
    bay_temp_c: float = -8.0
    heater_enabled: bool = True
    solar_deployed: bool = True
    spare_batteries_wh: list[float] = None
    swapped_count: int = 0
    distance_traveled_world: float = 0.0

    def __post_init__(self):
        if self.spare_batteries_wh is None:
            self.spare_batteries_wh = [40.0, 40.0, 12.0]


@dataclass
class DataPacket:
    packet_id: int
    source: str
    target: str
    description: str
    size_mb: float
    acquired_s: float
    image_file: str = ""
    progress_mb: float = 0.0
    delivered: bool = False
    transferred_to_rover: bool = False


class RoverModel:
    """Tekerlek hareketi, güneş, batarya rafı, aktif ısıtma ve veri uplink'i.

    Solar watts and consumption watts integrate over dt / 3600 to Wh.
    Planetary day length, battery insulation and atmosphere are GAME assumptions.
    """

    def __init__(self, config: Optional[RoverConfig] = None):
        self.config = config or RoverConfig()
        self.config.validate()
        self.state = Rover(battery_wh=self.config.initial_energy_wh)
        self.elapsed = 0.0
        self.solar_w = 0.0
        self.load_w = 0.0
        self.heater_active = False
        self.charge_w = 0.0
        self.ambient_c = -60.0
        self.last_move_blocked = False
        self.storm_active = False
        self.is_uplinking = False
        self.uplink_enabled = False
        self.packets: list[DataPacket] = []

    def sunlight(self, elapsed: float) -> float:
        # ~6 dakika ölçekli örnek gün-gece döngüsü: gerçek Mars günü değildir.
        return max(0.0, math.sin(math.pi * ((elapsed + 70) % 360) / 180.0))

    def ambient_temperature(self, elapsed: float) -> float:
        return -84.0 + 44.0 * self.sunlight(elapsed)

    def step(self, dt: float, move_x: float, move_y: float,
             hazards: list[tuple[float, float, int]], elapsed: float):
        if not 0 < dt <= 0.2:
            raise ValueError("Geçersiz gezgin zaman adımı.")
        r, c = self.state, self.config
        self.elapsed = elapsed
        self.ambient_c = self.ambient_temperature(elapsed)
        self.last_move_blocked = False
        moving = False
        if r.health > 0 and r.battery_wh > 0.2:
            magnitude = math.hypot(move_x, move_y)
            if magnitude:
                ux, uy = move_x / max(1.0, magnitude), move_y / max(1.0, magnitude)
                nx = r.x + ux * c.rover_speed_world_s * dt
                ny = r.y + uy * c.rover_speed_world_s * dt
                inside = (30 <= nx <= WORLD_W - 30 and 30 <= ny <= WORLD_H - 30)
                clear = all(math.hypot(nx - hx, ny - hy) >= hr + c.rover_radius_world
                            for hx, hy, hr in hazards)
                if inside and clear:
                    r.distance_traveled_world += math.hypot(nx - r.x, ny - r.y)
                    r.x, r.y = nx, ny
                    moving = True
                else:
                    self.last_move_blocked = True
        sunlight = self.sunlight(elapsed)
        # Temsili toz fırtınası, güneş üretimini azaltır ve dışarıdaki drone'a risk ekler.
        self.storm_active = 95 <= (elapsed % 240) < 130
        dust_factor = 0.40 if self.storm_active else 1.0
        self.solar_w = c.solar_peak_w * sunlight * dust_factor if r.solar_deployed else 0.0
        # Depo yalıtımlı olduğundan doğal ısı kaybı yavaştır. Isıtıcı açılırsa 0°C'ye yönelir.
        warm_target = -2.0 if r.heater_enabled and r.battery_wh > 0.1 else self.ambient_c
        thermal_rate = 0.012 if r.heater_enabled and r.battery_wh > 0.1 else 0.0015
        r.bay_temp_c += (warm_target - r.bay_temp_c) * min(1.0, dt * thermal_rate)
        self.heater_active = r.heater_enabled and r.bay_temp_c < -3.0 and r.battery_wh > 0.1
        self.is_uplinking = (self.uplink_enabled and r.battery_wh > 1.0
                            and any(p.transferred_to_rover and not p.delivered for p in self.packets))
        self.load_w = (c.electronics_w + (c.wheels_w if moving else 0.0)
                       + (c.heater_w if self.heater_active else 0.0)
                       + (c.uplink_w if self.is_uplinking else 0.0))
        net_wh = (self.solar_w - self.load_w) * dt / 3600.0
        r.battery_wh = min(c.battery_capacity_wh, max(0.0, r.battery_wh + net_wh))
        self.charge_w = 0.0
        if (r.battery_wh > c.min_reserve_wh and r.bay_temp_c >= -25.0
                and any(p < c.spare_capacity_wh - 0.001 for p in r.spare_batteries_wh)):
            # Depodaki boş bataryalara sırayla şarj aktarılır; enerji yoktan yaratılmaz.
            pack_idx = next(i for i, p in enumerate(r.spare_batteries_wh)
                            if p < c.spare_capacity_wh - 0.001)
            desired_wh = min(c.charger_w * dt / 3600.0,
                             c.spare_capacity_wh - r.spare_batteries_wh[pack_idx],
                             r.battery_wh - c.min_reserve_wh)
            if desired_wh > 0:
                r.spare_batteries_wh[pack_idx] += desired_wh
                r.battery_wh -= desired_wh
                self.charge_w = desired_wh * 3600.0 / dt
        # Soğuğa uzun süre maruz kalmanın batarya rafına simüle edilmiş etkisi.
        if r.bay_temp_c < -35.0:
            for i, amount in enumerate(r.spare_batteries_wh):
                r.spare_batteries_wh[i] = max(0.0, amount - 0.00016 * dt)
        if self.is_uplinking:
            remaining_mb = c.uplink_mb_s * dt
            for packet in self.packets:
                if not packet.transferred_to_rover or packet.delivered:
                    continue
                delta = min(remaining_mb, packet.size_mb - packet.progress_mb)
                packet.progress_mb += delta
                remaining_mb -= delta
                if packet.progress_mb + 1e-8 >= packet.size_mb:
                    packet.progress_mb = packet.size_mb
                    packet.delivered = True
                if remaining_mb <= 0.0:
                    break
        if r.battery_wh < 0.01:
            self.is_uplinking = False

    def store_packet(self, packet: DataPacket):
        if any(existing.packet_id == packet.packet_id for existing in self.packets):
            raise ValueError("Aynı veri paketi iki kez kaydedilemez.")
        packet.transferred_to_rover = True
        self.packets.append(packet)

    def swap_drone_battery(self, drone: Vehicle, capacity_wh: float) -> str:
        """Şarjlı yedek seçilir; çıkarılan pil depoya geri eklenir."""
        r = self.state
        if not drone.docked:
            return "Batarya değişimi için drone gezgin üzerine kenetlenmeli (F)."
        if r.bay_temp_c < -25.0:
            return "Batarya bölmesi çok soğuk. Isıtıcıyı (H) etkinleştir."
        if not r.spare_batteries_wh:
            return "Depoda yedek batarya yok."
        best_idx = max(range(len(r.spare_batteries_wh)), key=r.spare_batteries_wh.__getitem__)
        best = r.spare_batteries_wh[best_idx]
        if best <= drone.battery_wh + 0.5:
            return "Mevcut bataryadan daha dolu yedek bulunmuyor."
        old = drone.battery_wh
        drone.battery_wh = min(best, capacity_wh)
        r.spare_batteries_wh[best_idx] = old
        r.swapped_count += 1
        return f"Batarya değişti: {old:.1f} Wh → {drone.battery_wh:.1f} Wh. Eski pil depoda."

    def repair_drone(self, drone: Vehicle) -> str:
        if not drone.docked:
            return "Onarım için drone gezgine kenetlenmeli."
        if drone.health >= 99.9:
            return "Drone zaten sağlam."
        if self.state.battery_wh < 30:
            return "Onarım için gezgin enerjisi yetersiz."
        self.state.battery_wh -= 18.0
        old = drone.health
        drone.health = min(100.0, drone.health + 20.0)
        return f"Drone bakımı tamamlandı: {old:.0f} → {drone.health:.0f} dayanıklılık."


class GameSession:
    """Oyun modelini GUI'den ayrı tutar: otomatik test ve kayıt için uygun."""

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.model = FlightModel()
        self.rover_model = RoverModel()
        self.mission = Mission(seed)
        self.model.vehicle.docked = True
        self.model.vehicle.battery_wh = 24.0  # Görev başlangıcında kısmen dolu takılı pil
        self.model.vehicle.x = self.rover_model.state.x
        self.model.vehicle.y = self.rover_model.state.y
        self.selected = "drone"
        self.elapsed = 0.0
        self.packets: list[DataPacket] = []
        self.drone_packets: list[DataPacket] = []
        self.next_packet_id = 1
        self.last_collision = -10.0
        self.last_reported_delivered = 0
        self.events: list[str] = ["Drone gezginin üstünde. Space/↑ ile kalkış yap."]
        self.report: list[dict] = []

    @property
    def rover(self) -> Rover:
        return self.rover_model.state

    @property
    def drone(self) -> Vehicle:
        return self.model.vehicle

    def notify(self, message: str):
        self.events.append(message)
        self.events = self.events[-250:]
        self.mission.message = message

    def switch_vehicle(self):
        self.selected = "rover" if self.selected == "drone" else "drone"
        self.notify("Kontrol: " + ("GEZGİN (WASD)" if self.selected == "rover" else "DRONE (WASD + ↑/↓)"))
        return self.selected

    def step(self, dt: float, x: float = 0, y: float = 0, climb: float = 0):
        if not 0 < dt <= 0.2:
            raise ValueError("Zaman adımı geçersiz.")
        if self.mission.finished or self.mission.failed:
            return
        self.elapsed += dt
        if self.drone.docked:
            self.drone.x, self.drone.y = self.rover.x, self.rover.y
            if self.selected == "drone" and climb > 0 and self.drone.battery_wh > 0.3:
                self.drone.docked = False
                self.drone.airborne = True
                self.drone.altitude = 0.12
                self.notify("Kalkış: drone gezginin platformundan ayrıldı.")
        if not self.drone.docked:
            ux, uy, uz = (x, y, climb) if self.selected == "drone" else (0, 0, 0)
            self.model.step(dt, ux, uy, uz)
            self.check_drone_hazards()
        else:
            self.model.thrust_n = self.model.power_w = 0.0
            self.drone.vx = self.drone.vy = 0.0
        rx, ry = (x, y) if self.selected == "rover" else (0, 0)
        self.rover_model.step(dt, rx, ry, self.mission.hazards, self.elapsed)
        if self.rover_model.storm_active and not self.drone.docked:
            # Gezginin üstünde kenetliyse tozdan korunur.
            self.drone.health = max(0.0, self.drone.health - (0.16 if self.drone.airborne else 0.07) * dt)
        if self.drone.docked:
            self.drone.x, self.drone.y = self.rover.x, self.rover.y
        self.mission.update(self.drone, extended=True, rover=self.rover, packets=self.packets)
        delivered = sum(p.delivered for p in self.packets)
        if delivered != self.last_reported_delivered:
            self.last_reported_delivered = delivered
            self.notify(f"Dünya'ya aktarılan simüle veri paketi: {delivered}/{len(self.packets)}")
        if self.mission.finished:
            self.notify("GÖREV TAMAMLANDI! Araştırma, veri aktarımı ve dönüş başarılı.")

    def check_drone_hazards(self):
        d = self.drone
        if not d.airborne or d.altitude >= 1.6:
            return
        for hx, hy, radius in self.mission.hazards:
            if math.hypot(d.x - hx, d.y - hy) < radius + 12 and self.elapsed - self.last_collision > 2:
                d.health = max(0.0, d.health - 15.0)
                self.last_collision = self.elapsed
                self.notify("UYARI: Alçak uçuşta kayaya temas! Drone -15 dayanıklılık")
                break

    def _make_packet(self, source: str, rock: Rock, image_file: str = "") -> DataPacket:
        idx = self.next_packet_id
        self.next_packet_id += 1
        packet = DataPacket(idx, source, rock.label,
                            f"{rock.label}: {source} kamera görüntüsü ve sensör kaydı",
                            2.8 if source == "drone" else 1.4,
                            round(self.elapsed, 2), image_file=image_file)
        self.packets.append(packet)
        if source == "drone":
            self.drone_packets.append(packet)
        else:
            self.rover_model.store_packet(packet)
        return packet

    def scan_drone(self, image_file: str = "") -> str:
        if self.mission.failed or self.mission.finished:
            return "Görev tamamlandı veya sonlandı."
        if self.drone.docked:
            return "Drone gezgine kenetli. Önce Space/↑ ile kalkış yap."
        before = {r.label: r.scanned for r in self.mission.rocks}
        result = self.mission.scan(self.drone)
        for rock in self.mission.rocks:
            if not before[rock.label] and rock.scanned:
                packet = self._make_packet("drone", rock, image_file)
                self.notify(f"Drone taraması kaydedildi: {rock.label} [Paket #{packet.packet_id}]")
                break
        else:
            self.notify(result)
        return result

    def survey_rover(self, image_file: str = "") -> str:
        if self.mission.failed or self.mission.finished:
            return "Görev tamamlandı veya sonlandı."
        for rock in self.mission.rocks:
            if not rock.surveyed and math.hypot(self.rover.x - rock.x, self.rover.y - rock.y) < 66:
                rock.surveyed = True
                packet = self._make_packet("gezgin", rock, image_file)
                self.notify(f"Gezgin kamerası ve sensör kaydı: {rock.label} [Paket #{packet.packet_id}]")
                return f"Gezgin {rock.label} konumunda araştırma tamamladı."
        result = "Gezgin araştırması için taranmamış kayaya 66 harita birimi yaklaş (R)."
        self.notify(result)
        return result

    def try_dock(self) -> str:
        d, r = self.drone, self.rover
        if d.docked:
            return "Drone zaten gezginin üzerinde."
        if (math.hypot(d.x - r.x, d.y - r.y) > 35 or d.altitude > 0.90
                or abs(d.vertical_speed) > 1.8):
            result = "Kenetlenme için gezginin 35 birim yakınına ve 0,9 m altına yavaşça in."
            self.notify(result)
            return result
        d.x, d.y = r.x, r.y
        d.altitude = d.vertical_speed = d.vx = d.vy = 0.0
        d.docked = True
        d.airborne = False
        self.model.thrust_n = self.model.power_w = 0.0
        count = 0
        for packet in self.drone_packets[:]:
            self.rover_model.store_packet(packet)
            self.drone_packets.remove(packet)
            count += 1
        result = f"Drone kenetlendi. {count} görüntü/sensör paketi gezgine indirildi."
        self.notify(result)
        return result

    def swap_battery(self) -> str:
        result = self.rover_model.swap_drone_battery(self.drone, self.model.config.battery_wh)
        self.notify(result)
        return result

    def repair(self) -> str:
        result = self.rover_model.repair_drone(self.drone)
        self.notify(result)
        return result

    def toggle_uplink(self):
        self.rover_model.uplink_enabled = not self.rover_model.uplink_enabled
        self.notify("Dünya veri bağlantısı AÇIK (simülasyon)." if self.rover_model.uplink_enabled
                    else "Dünya veri bağlantısı KAPALI.")

    def toggle_heater(self):
        self.rover.heater_enabled = not self.rover.heater_enabled
        self.notify("Batarya deposu ısıtması AÇIK." if self.rover.heater_enabled else "Batarya deposu ısıtması KAPALI.")

    def toggle_solar(self):
        self.rover.solar_deployed = not self.rover.solar_deployed
        self.notify("Güneş paneli AÇIK." if self.rover.solar_deployed else "Güneş paneli KAPALI.")

    def mission_progress(self):
        return {
            "drone": sum(r.scanned for r in self.mission.rocks),
            "rover": sum(r.surveyed for r in self.mission.rocks),
            "transmitted": sum(p.delivered for p in self.packets),
            "total_packets": len(self.packets),
            "waiting_on_drone": len(self.drone_packets),
            "docked": self.drone.docked,
            "at_base": math.hypot(self.rover.x - BASE_X, self.rover.y - BASE_Y) < 60,
        }

    def telemetry_row(self):
        return {
            "time_s": round(self.elapsed, 2),
            "selected": self.selected,
            "drone_x": round(self.drone.x, 2), "drone_y": round(self.drone.y, 2),
            "drone_alt_m": round(self.drone.altitude, 3),
            "drone_battery_wh": round(self.drone.battery_wh, 3),
            "drone_thrust_n": round(self.model.thrust_n, 3),
            "rover_x": round(self.rover.x, 2), "rover_y": round(self.rover.y, 2),
            "rover_energy_wh": round(self.rover.battery_wh, 3),
            "rover_solar_w": round(self.rover_model.solar_w, 2),
            "battery_bay_c": round(self.rover.bay_temp_c, 2),
            "transmitted_packets": self.mission_progress()["transmitted"],
        }

    def to_dict(self):
        return {
            "version": 3, "seed": self.seed, "elapsed": self.elapsed,
            "drone": asdict(self.drone), "rover": asdict(self.rover),
            "rocks": [asdict(r) for r in self.mission.rocks],
            "packets": [asdict(p) for p in self.packets],
            "selected": self.selected, "uplink_enabled": self.rover_model.uplink_enabled,
            "next_packet_id": self.next_packet_id,
            "finished": self.mission.finished, "failed": self.mission.failed,
            "report": self.report[-2500:],
        }

    @classmethod
    def from_dict(cls, obj):
        """Kullanıcı kayıtlarını sınır kontrollü okur; çalıştırılabilir kod asla yüklemez."""
        if not isinstance(obj, dict) or obj.get("version") not in (1, 3):
            raise ValueError("Desteklenmeyen kayıt sürümü (1 veya 3 bekleniyor).")
        def num(value, low, high, name):
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not math.isfinite(value) or not low <= value <= high):
                raise ValueError(f"Kayıt alanı geçersiz: {name}")
            return float(value)
        if obj["version"] == 1:
            # Eski sürümün yalnızca bilinen güvenli alanlarını taşır.
            game = cls()
            v = obj.get("vehicle")
            if not isinstance(v, dict):
                raise ValueError("Eski drone kaydı geçersiz.")
            for key in ("x", "y", "vx", "vy", "altitude", "vertical_speed", "battery_wh", "health"):
                if key not in v:
                    raise ValueError(f"Eski kayıt alanı eksik: {key}")
            game.drone.x = num(v["x"], 25, WORLD_W - 25, "x")
            game.drone.y = num(v["y"], 25, WORLD_H - 25, "y")
            game.drone.altitude = num(v["altitude"], 0, 1000, "altitude")
            game.drone.battery_wh = num(v["battery_wh"], 0, 40, "battery")
            game.drone.health = num(v["health"], 0, 100, "health")
            game.drone.airborne = bool(v.get("airborne", False))
            game.drone.docked = False
            game.elapsed = num(obj.get("elapsed", 0), 0, 1e8, "elapsed")
            for i, saved in enumerate(obj.get("rocks", [])):
                if i >= len(game.mission.rocks):
                    break
                game.mission.rocks[i].scanned = saved.get("scanned") is True
            return game
        seed = obj.get("seed")
        if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 1_000_000:
            raise ValueError("Harita tohum değeri geçersiz.")
        game = cls(seed)
        game.elapsed = num(obj.get("elapsed"), 0, 1e8, "elapsed")
        d, r = obj.get("drone"), obj.get("rover")
        if not isinstance(d, dict) or not isinstance(r, dict):
            raise ValueError("Araç verisi bulunamadı.")
        for name, low, high in (("x", 25, WORLD_W-25), ("y", 25, WORLD_H-25),
                                ("vx", -100, 100), ("vy", -100, 100),
                                ("altitude", 0, 1000), ("vertical_speed", -100, 100),
                                ("battery_wh", 0, 40), ("health", 0, 100)):
            setattr(game.drone, name, num(d.get(name), low, high, "drone." + name))
        if not isinstance(d.get("airborne"), bool) or not isinstance(d.get("docked"), bool):
            raise ValueError("Drone durumu geçersiz.")
        game.drone.airborne, game.drone.docked = d["airborne"], d["docked"]
        for name, low, high in (("x", 25, WORLD_W-25), ("y", 25, WORLD_H-25),
                                ("battery_wh", 0, RoverConfig().battery_capacity_wh), ("health", 0, 100),
                                ("bay_temp_c", -200, 100),
                                ("distance_traveled_world", 0, 1e10)):
            setattr(game.rover, name, num(r.get(name), low, high, "rover." + name))
        for name in ("heater_enabled", "solar_deployed"):
            if not isinstance(r.get(name), bool):
                raise ValueError("Gezgin boole alanı geçersiz.")
            setattr(game.rover, name, r[name])
        spares = r.get("spare_batteries_wh")
        if not isinstance(spares, list) or len(spares) > 10:
            raise ValueError("Yedek bataryalar geçersiz.")
        game.rover.spare_batteries_wh = [num(b, 0, 40, "spare") for b in spares]
        count = r.get("swapped_count", 0)
        if type(count) is not int or count < 0 or count > 1_000_000:
            raise ValueError("Batarya değişim sayacı geçersiz.")
        game.rover.swapped_count = count
        rocks = obj.get("rocks")
        if not isinstance(rocks, list) or len(rocks) != 3:
            raise ValueError("Kaya verisi geçersiz.")
        for old, saved in zip(game.mission.rocks, rocks):
            if (not isinstance(saved, dict) or saved.get("label") != old.label
                    or not isinstance(saved.get("scanned"), bool)
                    or not isinstance(saved.get("surveyed"), bool)):
                raise ValueError("Kaya kimliği veya durumu geçersiz.")
            old.scanned, old.surveyed = saved["scanned"], saved["surveyed"]
        packets = obj.get("packets")
        if not isinstance(packets, list) or len(packets) > 100:
            raise ValueError("Paket kaydı geçersiz.")
        for row in packets:
            if not isinstance(row, dict):
                raise ValueError("Paket biçimi geçersiz.")
            pk_id = row.get("packet_id")
            if type(pk_id) is not int or not 1 <= pk_id <= 10000:
                raise ValueError("Paket kimliği geçersiz.")
            for attr in ("source", "target", "description", "image_file"):
                if not isinstance(row.get(attr), str) or len(row[attr]) > 255:
                    raise ValueError("Paket metni geçersiz.")
            if row["image_file"] and not re.fullmatch(
                    r"kamera_kayitlari/(?:drone|gezgin)_[0-9]{4}\.png", row["image_file"]):
                raise ValueError("Kamera dosyası güvenli klasörde bulunmalıdır.")
            size = num(row.get("size_mb"), 0.01, 1000, "size")
            progress = num(row.get("progress_mb"), 0, size, "progress")
            acquired = num(row.get("acquired_s"), 0, game.elapsed + .01, "acquired")
            for flag in ("delivered", "transferred_to_rover"):
                if not isinstance(row.get(flag), bool):
                    raise ValueError("Paket durumu geçersiz.")
            pkt = DataPacket(pk_id, row["source"], row["target"], row["description"],
                             size, acquired, row["image_file"], progress,
                             row["delivered"], row["transferred_to_rover"])
            game.packets.append(pkt)
            if pkt.transferred_to_rover:
                game.rover_model.packets.append(pkt)
            else:
                game.drone_packets.append(pkt)
        if len({p.packet_id for p in game.packets}) != len(game.packets):
            raise ValueError("Tekrarlı veri paketi kimliği.")
        nxt = obj.get("next_packet_id")
        if type(nxt) is not int or not 1 <= nxt <= 100000 or nxt <= max([p.packet_id for p in game.packets] + [0]):
            raise ValueError("Paket sayacı geçersiz.")
        game.next_packet_id = nxt
        game.selected = obj.get("selected")
        if game.selected not in ("drone", "rover"):
            raise ValueError("Kontrol seçimi geçersiz.")
        if not isinstance(obj.get("uplink_enabled"), bool):
            raise ValueError("Bağlantı durumu geçersiz.")
        game.rover_model.uplink_enabled = obj["uplink_enabled"]
        for attr in ("finished", "failed"):
            if not isinstance(obj.get(attr), bool):
                raise ValueError("Görev durumu geçersiz.")
        game.mission.finished = obj["finished"]
        game.mission.failed = obj["failed"]
        report = obj.get("report", [])
        if not isinstance(report, list) or len(report) > 2500:
            raise ValueError("Telemetri kaydı geçersiz.")
        # Raporlar yalnızca beklenen şemadaki temiz sayısal alanları içerir.
        game.report = []
        columns = game.telemetry_row().keys()
        for row in report:
            if not isinstance(row, dict) or set(row) != set(columns):
                continue
            if any((isinstance(v, (int, float)) and not math.isfinite(v))
                   or isinstance(v, (list, dict)) for v in row.values()):
                continue
            game.report.append(row)
        if game.drone.docked:
            if game.drone.airborne:
                raise ValueError("Drone kenetli ve havada olamaz.")
            game.drone.x, game.drone.y = game.rover.x, game.rover.y
            game.drone.altitude = 0.0
        return game

    def take_photo(self, image_file: str = "") -> str:
        """Saha kamerasının temsilî görüntüsü için aktarılabilir paket hazırlar."""
        if self.mission.finished or self.mission.failed:
            return "Görev artık aktif değil."
        source = "drone" if self.selected == "drone" and not self.drone.docked else "gezgin"
        if len(self.packets) >= 80:
            return "Kamera veri deposu dolu (80 paket)."
        idx = self.next_packet_id
        self.next_packet_id += 1
        p = DataPacket(idx, source, "Arazi panoraması",
                       f"{source}: şematik arazi kamerası görüntüsü",
                       1.0, round(self.elapsed, 2), image_file=image_file)
        self.packets.append(p)
        if source == "drone":
            self.drone_packets.append(p)
        else:
            self.rover_model.store_packet(p)
        self.notify(f"{source.title()} kamerasından görüntü alındı [Paket #{idx}].")
        return f"Kamera görüntüsü ve konum verileri kaydedildi: #{idx}."

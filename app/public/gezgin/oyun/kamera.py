"""Ek kütüphane gerektirmeyen, şematik sanal kamera PNG çıktısı.

Mars'tan veya NASA'dan alınmış gerçek görüntü değildir. Her fotoğraf oyun
konumuna, kaynağa, saate ve hedefine bağlı üretilen görsel canlandırmadır.
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

W, H = 240, 144


def _chunk(tag: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", zlib.crc32(tag + payload) & 0xffffffff)


def _clamp(x):
    return max(0, min(255, int(x)))


def create_capture(folder: Path, source: str, packet_id: int, x: float, y: float,
                   altitude: float, target: str) -> str:
    """Sınırlı kaynaklar kullanan deterministik RGB PNG üretir. Dosya adları güvenli."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    source = "drone" if source == "drone" else "gezgin"
    file_name = f"{source}_{packet_id:04d}.png"
    seed = packet_id * 19.7 + x * 0.03 + y * 0.055 + sum(map(ord, target)) * 0.003
    data = bytearray()
    center_x = 112 + 27 * math.sin(seed)
    center_y = 100 + 7 * math.cos(seed * .6)
    for py in range(H):
        data.append(0)  # PNG scanline filter: None
        for px in range(W):
            u = px / W
            v = py / H
            dune = 0.38 + .04 * math.sin(7*u + seed) + .025 * math.sin(17*u - seed * .4)
            if v < dune:
                light = 0.65 + 0.2 * v + .08 * math.cos(seed)
                rgb = (int(87*light), int(61*light), int(78*light))
            else:
                noise = (math.sin(px*.47+seed)*math.cos(py*.41-seed)) * 8
                ridges = 15 * math.sin(px*.052 + py*.037 + seed)
                depth = 1 - v
                rgb = (144 + 40*depth + noise + ridges,
                       76 + 28*depth + noise*.42 + ridges*.32,
                       59 + 31*depth + noise*.24)
            # Kaya yüzeyi: basit gölge ve katmanlar.
            dx = (px - center_x) / 49
            dy = (py - center_y) / 23
            if dx*dx + dy*dy < 1 and py > H*.40:
                band = 11 * math.sin(py * .31 + px*.028 + seed)
                shade = (1 - dx*dx) * 34
                rgb = (112 + band + shade, 75 + band*.48 + shade*.38, 72 + band*.45)
            # İrtifaya göre kamera nişangâhı; basit oyun göstergesi.
            if (abs(px - 120) < 1 and 62 <= py <= 74) or (abs(py - 68) < 1 and 114 <= px <= 126):
                rgb = (205, 231, 216) if altitude >= 0 else rgb
            data.extend((_clamp(rgb[0]), _clamp(rgb[1]), _clamp(rgb[2])))
    png = (b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", struct.pack(">2I5B", W, H, 8, 2, 0, 0, 0))
           + _chunk(b"IDAT", zlib.compress(bytes(data), 6)) + _chunk(b"IEND", b""))
    path = folder / file_name
    path.write_bytes(png)
    return str(path)

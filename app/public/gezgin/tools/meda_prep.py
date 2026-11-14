"""MEDA DER CSV → OSIRISZK oyun veri dosyası (assets/meda/meda_sols.json).

Kullanım: python tools/meda_prep.py <csv_klasörü> [<csv_klasörü> ...] assets/meda/meda_sols.json
Gerekenler: Python 3.9+, numpy, pandas (pip install numpy pandas). CSV'ler PDS'ten indirilen
WE__<sol>___..._DER_<PS|RHS|WS|TIRS|ANCILLARY>_..._P0x.csv dosyalarıdır (zip'ten çıkarılmış).

Her sol için 10 dakikalık LMST kutularında medyan değerler üretir.
Kaynak: NASA PDS Atmospheres Node, Mars 2020 MEDA Derived (DER) ürünleri.
"""
import sys, json, math, re, datetime as dt
from pathlib import Path
import numpy as np
import pandas as pd

FILL = 999999999
BIN_MIN = 10
NB = 24 * 60 // BIN_MIN
SIGMA = 5.670374419e-8
EPS = 0.95          # zemin yayıcılığı (varsayım)
R_CO2 = 191.8       # J/(kg·K) — oyunun sistemler.js değeriyle aynı (saf CO₂ 188,92)
SCLK_EPOCH = dt.datetime(2000, 1, 1, 11, 58, 55, 816000, tzinfo=dt.timezone.utc)


def lmst_seconds(s: pd.Series):
    m = s.str.extract(r"^(\d{5})M(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$")
    sol = m[0].astype(float)
    sec = m[1].astype(float) * 3600 + m[2].astype(float) * 60 + m[3].astype(float)
    return sol, sec


def load(path: Path, cols):
    df = pd.read_csv(path, usecols=["SCLK", "LMST"] + cols, low_memory=False)
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
        df.loc[df[c].abs() >= FILL, c] = np.nan
    sol, sec = lmst_seconds(df["LMST"].astype(str))
    df["sol"], df["sec"] = sol, sec
    df["bin"] = (sec // (BIN_MIN * 60)).clip(0, NB - 1)
    return df


def ls_from_utc(t: dt.datetime) -> float:
    """Allison & McEwen (2000) güneş boylamı Ls (derece)."""
    jd_utc = 2440587.5 + t.timestamp() / 86400.0
    jd_tt = jd_utc + (69.184 / 86400.0)
    d = jd_tt - 2451545.0
    M = math.radians(19.3871 + 0.52402073 * d)
    a_fms = 270.3871 + 0.524038496 * d
    pbs = sum(A * math.cos(math.radians(0.985626 * d / tau + phi)) for A, tau, phi in [
        (0.0071, 2.2353, 49.409), (0.0057, 2.7543, 168.173), (0.0039, 1.1177, 191.837),
        (0.0037, 15.7866, 21.736), (0.0021, 2.1354, 15.704), (0.0020, 2.4694, 95.528),
        (0.0018, 32.8493, 49.095)])
    eoc = ((10.691 + 3.0e-7 * d) * math.sin(M) + 0.623 * math.sin(2 * M) + 0.050 * math.sin(3 * M)
           + 0.005 * math.sin(4 * M) + 0.0005 * math.sin(5 * M) + pbs)
    return (a_fms + eoc) % 360.0


def binned(df, sol, col, how="median"):
    d = df[(df["sol"] == sol) & df[col].notna()]
    g = d.groupby("bin")[col]
    v = g.median() if how == "median" else g.quantile(0.95)
    out = [None] * NB
    cnt = [0] * NB
    for b, val in v.items():
        out[int(b)] = float(val)
    for b, n in g.size().items():
        cnt[int(b)] = int(n)
    return out, cnt


def circ_binned(df, sol, col):
    d = df[(df["sol"] == sol) & df[col].notna()]
    out = [None] * NB
    if d.empty:
        return out
    r = np.radians(d[col].values)
    tmp = pd.DataFrame({"bin": d["bin"].values, "s": np.sin(r), "c": np.cos(r)}).groupby("bin").mean()
    for b, row in tmp.iterrows():
        out[int(b)] = float((math.degrees(math.atan2(row.s, row.c)) + 360) % 360)
    return out


def rnd(arr, k):
    return [None if (v is None or not math.isfinite(v)) else round(v, k) for v in arr]


def main():
    args = sys.argv[1:]
    out = Path(args[-1])
    dirs = [Path(a) for a in args[:-1]]
    files = sorted(p for d in dirs for p in d.glob("WE__*.csv"))
    by = {}
    for p in files:
        m = re.match(r"WE__(\d{4})_+DER_([A-Z]+)_+(P\d{2})\.csv$", p.name)
        if m:
            by.setdefault(int(m.group(1)), {})[m.group(2)] = p
    sols = sorted(by)
    data, names = {}, []
    for s in sols:
        f = by[s]
        names += [f[k].name for k in sorted(f)]
        ps = load(f["PS"], ["PRESSURE"])
        rh = load(f["RHS"], ["LOCAL_RELATIVE_HUMIDITY", "HUMIDITY_LOCAL_TEMP", "VOLUME_MIXING_RATIO"])
        ws = load(f["WS"], ["HORIZONTAL_WIND_SPEED", "WIND_DIRECTION", "VERTICAL_WIND_SPEED"])
        ti = load(f["TIRS"], ["DOWNWARD_LW_IRRADIANCE", "UPWARD_LW_IRRADIANCE"])
        an = load(f["ANCILLARY"], ["SOLAR_ZENITHAL_ANGLE"])
        # TIRS'ten zemin sıcaklığı tahmini
        U, D = ti["UPWARD_LW_IRRADIANCE"], ti["DOWNWARD_LW_IRRADIANCE"]
        ti["TG"] = ((U - (1 - EPS) * D).clip(lower=1) / (EPS * SIGMA)) ** 0.25 - 273.15
        # yoğunluk: PS ile RHS sıcaklığını SCLK'ye göre en yakın eşle
        a = ps[["SCLK", "PRESSURE", "sol", "bin"]].sort_values("SCLK")
        b = rh[["SCLK", "HUMIDITY_LOCAL_TEMP"]].dropna().sort_values("SCLK")
        mm = pd.merge_asof(a, b, on="SCLK", direction="nearest", tolerance=5)
        mm["RHO"] = mm["PRESSURE"] / (R_CO2 * mm["HUMIDITY_LOCAL_TEMP"])
        rh["TC"] = rh["HUMIDITY_LOCAL_TEMP"] - 273.15

        p, n_p = binned(ps, s, "PRESSURE")
        t, n_t = binned(rh, s, "TC")
        hum, _ = binned(rh, s, "LOCAL_RELATIVE_HUMIDITY")
        vmr, _ = binned(rh, s, "VOLUME_MIXING_RATIO")
        wsp, n_w = binned(ws, s, "HORIZONTAL_WIND_SPEED")
        wmax, _ = binned(ws, s, "HORIZONTAL_WIND_SPEED", "p95")
        wd = circ_binned(ws, s, "WIND_DIRECTION")
        lwd, _ = binned(ti, s, "DOWNWARD_LW_IRRADIANCE")
        lwu, _ = binned(ti, s, "UPWARD_LW_IRRADIANCE")
        tg, n_g = binned(ti, s, "TG")
        sza, _ = binned(an, s, "SOLAR_ZENITHAL_ANGLE")
        rho, _ = binned(mm, s, "RHO")

        sclk0 = float(ps.loc[ps["sol"] == s, "SCLK"].min())
        sclk1 = float(ps.loc[ps["sol"] == s, "SCLK"].max())
        u0 = SCLK_EPOCH + dt.timedelta(seconds=sclk0)
        u1 = SCLK_EPOCH + dt.timedelta(seconds=sclk1)
        covered = [i for i in range(NB) if n_p[i] > 0]
        hours = sorted({i * BIN_MIN // 60 for i in covered})

        def st(arr):
            v = [x for x in arr if x is not None]
            return (round(min(v), 4), round(max(v), 4)) if v else (None, None)

        data[s] = {
            "sol": s, "ls": round(ls_from_utc(u0 + (u1 - u0) / 2), 2),
            "utcFirst": u0.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "utcLast": u1.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "hours": hours,
            "samples": {"PS": int(n_p and sum(n_p)), "RHS": int(sum(n_t)), "WS": int(sum(n_w)), "TIRS": int(sum(n_g))},
            "bins": {"p": rnd(p, 2), "t": rnd(t, 2), "rh": rnd(hum, 2), "vmr": rnd(vmr, 2), "ws": rnd(wsp, 2),
                     "wmax": rnd(wmax, 2), "wd": rnd(wd, 1), "lwd": rnd(lwd, 2), "lwu": rnd(lwu, 2),
                     "tg": rnd(tg, 2), "sza": rnd(sza, 2), "rho": rnd(rho, 5)},
            "summary": {"p": st(p), "t": st(t), "rh": st(hum), "ws": st(wsp), "wmax": st(wmax), "tg": st(tg), "rho": st(rho)},
        }
        print(f"sol {s}: Ls {data[s]['ls']}  saatler {hours[0]}-{hours[-1]} ({len(hours)})  "
              f"P {data[s]['summary']['p']}  T {data[s]['summary']['t']}  ρ {data[s]['summary']['rho']}  rüzgâr {data[s]['summary']['ws']}")

    # birleşik günlük döngü: 105-107 (tek/çift saatler birbirini tamamlar)
    comp_sols = [s for s in (105, 106, 107) if s in data]
    comp = {}
    if comp_sols:
        keys = data[comp_sols[0]]["bins"].keys()
        cb = {}
        for k in keys:
            arr = []
            for i in range(NB):
                vals = [data[s]["bins"][k][i] for s in comp_sols if data[s]["bins"][k][i] is not None]
                if not vals:
                    arr.append(None)
                elif k == "wd":
                    sx = sum(math.sin(math.radians(v)) for v in vals); cx = sum(math.cos(math.radians(v)) for v in vals)
                    arr.append(round((math.degrees(math.atan2(sx, cx)) + 360) % 360, 1))
                elif k == "wmax":
                    arr.append(max(vals))
                else:
                    arr.append(round(sum(vals) / len(vals), 5 if k == "rho" else 2))
            cb[k] = arr
        cov = sum(1 for v in cb["p"] if v is not None)
        comp = {"sols": comp_sols, "ls": round(sum(data[s]["ls"] for s in comp_sols) / len(comp_sols), 2),
                "coverage": round(cov / NB, 3), "bins": cb}
        print(f"birleşik {comp_sols}: kapsama {comp['coverage']:.0%}")

    res = {
        "version": 1,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "binMinutes": BIN_MIN, "nBins": NB,
        "site": "Jezero Krateri · Perseverance (Octavia E. Butler iniş bölgesi yakını)",
        "source": "NASA PDS Atmospheres Node — Mars 2020 MEDA Derived (DER) veri ürünleri",
        "sourceUrl": "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
        "files": names,
        "method": {
            "binning": "Her 10 dk'lık LMST kutusunda ~1 Hz örneklerin medyanı; 999999999 dolgu değerleri atıldı.",
            "wmax": "Ani rüzgâr: 10 dk içindeki yatay rüzgâr örneklerinin %95'lik değeri (tek örnek sıçramalarına dayanıklı).",
            "t": "RHS sensör yerel sıcaklığı (HUMIDITY_LOCAL_TEMP). Hava sıcaklığına yakındır, ATS ölçümü değildir.",
            "tg": f"TIRS uzun dalga ışınımından tahmin: T = ((U − (1−ε)·D)/(ε·σ))^¼, ε = {EPS} varsayımı.",
            "rho": f"ρ = P / (R·T), R = {R_CO2} J/(kg·K) (oyunla aynı), T = RHS sıcaklığı.",
            "ls": "SCLK → UTC → Allison & McEwen (2000) formülü.",
            "composite": "Sol 105–107 tek/çift saatlerde ölçüm yaptığı için birleşimleri tam bir günlük döngü verir.",
        },
        "vars": {
            "p": {"label": "Basınç", "unit": "Pa"}, "t": {"label": "Sıcaklık (RHS)", "unit": "°C"},
            "rh": {"label": "Bağıl nem", "unit": "%"}, "vmr": {"label": "Su buharı karışım oranı", "unit": "ppm"},
            "ws": {"label": "Yatay rüzgâr", "unit": "m/s"}, "wmax": {"label": "Ani rüzgâr (10 dk %95)", "unit": "m/s"},
            "wd": {"label": "Rüzgâr yönü", "unit": "°"}, "lwd": {"label": "Aşağı LW ışınım", "unit": "W/m²"},
            "lwu": {"label": "Yukarı LW ışınım", "unit": "W/m²"}, "tg": {"label": "Zemin sıcaklığı (TIRS tahmini)", "unit": "°C"},
            "sza": {"label": "Güneş zenit açısı", "unit": "°"}, "rho": {"label": "Hava yoğunluğu", "unit": "kg/m³"},
        },
        "sols": {str(s): data[s] for s in sols},
        "composite": comp,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ {out} · {out.stat().st_size/1024:.0f} KB")


if __name__ == "__main__":
    main()

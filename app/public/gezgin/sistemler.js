/* =============================================================================
 * OSIRISZK Mars Pathfinder 3D — FİZİK VE SİSTEM MODELİ (saf JavaScript, ekrandan bağımsız)
 *
 * Bu dosya oyunun "mühendislik çekirdeği"dir: atmosfer, güneş, enerji, rotor gücü, pil modülleri,
 * ısı, toz fırtınası, iletişim ve gezgin hareketi burada hesaplanır. Ekran (app.js) yalnızca bu
 * hesapları çağırır. Böylece her formül tek yerde durur ve otomatik testlerle denetlenir.
 *
 * KAYNAKLAR (sayılar uydurulmadı; varsayımlar "VARSAYIM" diye işaretlidir):
 *  [K1] NASA/JPL Ingenuity basın kiti: 90 s'ye kadar uçuşta harcanan güç ≈ 350 W.
 *  [K2] NASA, "Battery system design, testing and operation for the Mars Perseverance rover and
 *       Ingenuity helicopter" (2024): 6 × Sony VTC4 hücre; enerji 44,4 Wh (25 °C), 38,8 Wh (0 °C);
 *       sürekli 360 W, tepe 510 W.
 *  [K3] NASA Mars Fact Sheet: yerçekimi 3,71 m/s²; ortalama molar kütle 43,34 g/mol; sol 88 775 s;
 *       eğim (obliquity) 25,19°.
 *  [K4] Sánchez-Lavega vd. 2023 / NASA MEDA: Jezero basıncı 625–761 Pa (mevsimlik),
 *       hava sıcaklığı tipik −83 … −23 °C.
 *  [K5] Takımın mimari çizimleri v1.0 (modeller.json): gezgin 45 kg, 1,60 × 1,20 × 1,25 m,
 *       0,10 m/s, 120 W güneş, 1,2 kWh, 100 W indüktif şarj, 2–3 dk pil değişimi, 0,30 m engel,
 *       30° eğim; drone 1,8 kg, Ø1,20 m eş eksenli rotor, 2400 dev/dk.
 * ========================================================================== */

export const SABIT = Object.freeze({
  g: 3.71,                    // m/s² [K3]
  R_HAVA: 8.314462 / 0.04334, // J/(kg·K) ≈ 191,8 — Mars havası [K3]
  GAMMA: 1.29,                // CO₂ ağırlıklı havanın ısı sığası oranı (yaklaşık)
  SOL_S: 88775,               // bir Mars günü (s) [K3]
  EGIKLIK: 25.19,             // derece [K3]
  JEZERO_ENLEM: 18.44,        // derece K
  MEDA: { pMin: 625, pMax: 761, tMinC: -83, tMaxC: -23 }, // [K4]
});

// ------------------------------------------------------------------ yardımcılar
export const sinir = (v, a, b) => Math.max(a, Math.min(b, v));
const derece = (r) => (r * 180) / Math.PI;
const radyan = (d) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ ATMOSFER
/**
 * Hava durumu: { basincPa, minC, maxC, opaklik (τ), ls (güneş boylamı, °), kaynak }
 * Varsayılan: yayımlanmış MEDA aralığının ortası (çevrimdışı) [K4].
 */
export function varsayilanHava() {
  const M = SABIT.MEDA;
  return { basincPa: Math.round((M.pMin + M.pMax) / 2), minC: M.tMinC, maxC: M.tMaxC, opaklik: 0.6, ls: 60,
    kaynak: 'cevrimdisi', etiket: 'Yayımlanmış MEDA aralığı (çevrimdışı)' };
}

/** Yerel güneş saatine (0–24) göre hava sıcaklığı: en düşük ~05:30, en yüksek ~14:00 (MEDA günlük eğrisi biçiminde). */
export function havaSicakligiC(lst, hava) {
  const enDusuk = 5.5, enYuksek = 14;
  let t;
  if (lst >= enDusuk && lst <= enYuksek) t = (1 - Math.cos(Math.PI * (lst - enDusuk) / (enYuksek - enDusuk))) / 2;
  else { const s = (lst - enYuksek + 24) % 24, uz = 24 - (enYuksek - enDusuk); t = (1 + Math.cos(Math.PI * s / uz)) / 2; }
  return hava.minC + (hava.maxC - hava.minC) * t;
}

/** Hava yoğunluğu ρ = p / (R·T)  (ideal gaz) */
export function yogunluk(basincPa, sicaklikC) { return basincPa / (SABIT.R_HAVA * (sicaklikC + 273.15)); }
export function sesHizi(sicaklikC) { return Math.sqrt(SABIT.GAMMA * SABIT.R_HAVA * (sicaklikC + 273.15)); }

// ------------------------------------------------------------------ GÜNEŞ
/** Güneşin yükseklik açısının sinüsü (Jezero enlemi, güneş boylamına göre sapma açısı). */
export function gunesYukseklikSin(lst, ls) {
  const dek = Math.asin(Math.sin(radyan(SABIT.EGIKLIK)) * Math.sin(radyan(ls)));
  const enlem = radyan(SABIT.JEZERO_ENLEM), saatAcisi = radyan((lst - 12) * 15);
  return Math.sin(enlem) * Math.sin(dek) + Math.cos(enlem) * Math.cos(dek) * Math.cos(saatAcisi);
}
/**
 * Güneş paneli gücü (W). Tepe değer (120 W [K5]) öğle güneşinde, τ = 0,5 berrak gökte tanımlıdır.
 * Atmosferden geçiş Beer–Lambert yasasıyla: exp(−τ/μ), μ = sin(yükseklik).
 */
export function gunesGucu(tepeW, lst, hava, tozCarpani = 1) {
  const mu = gunesYukseklikSin(lst, hava.ls);
  if (mu <= 0.02) return 0;
  const tau = hava.opaklik * tozCarpani, tauRef = 0.5;
  return Math.max(0, tepeW * mu * Math.exp(-tau / mu) / Math.exp(-tauRef));
}

// ------------------------------------------------------------------ ROTOR (DRONE)
/**
 * Eş eksenli rotor gücü: momentum teorisi.
 *   İdeal güç  P_i = T · (V_c/2 + √((V_c/2)² + v_h²)),   v_h = √(T / (2ρA))
 *   Gerçek güç = P_i / FM + parazit sürükleme ½ρ f V³ + aviyonik
 * FM (verim) 0,27 olarak seçildi: Jezero'nun tipik havasında (≈0,016 kg/m³) havada asılı kalış
 * gücünü Ingenuity'nin ≈350 W'ına [K1] getirir. Bu bir KALİBRASYONdur, ölçülmüş FM değildir.
 */
export const ROTOR = Object.freeze({
  FM: 0.27, AVIYONIK_W: 10, F_SURUKLEME_M2: 0.05, // VARSAYIM (f: eşdeğer sürükleme alanı)
  DEVIR_NOMINAL: 2400, DEVIR_MAKS: 2700,        // dev/dk [K5]; 2700: Ingenuity'nin seyrek havada çıktığı devir
  TEPE_GUC_W: 510, SUREKLI_GUC_W: 360,          // [K2]
});
export function diskAlani(rotorCapM) { return Math.PI * (rotorCapM / 2) ** 2; }
export function rotorGucu({ itkiN, rho, rotorCapM, tirmanmaMs = 0, yatayHizMs = 0 }) {
  const A = diskAlani(rotorCapM);
  const vh = Math.sqrt(itkiN / (2 * rho * A));
  const vc = Math.max(0, tirmanmaMs);
  const ideal = itkiN * (vc / 2 + Math.sqrt((vc / 2) ** 2 + vh * vh));
  const parazit = 0.5 * rho * ROTOR.F_SURUKLEME_M2 * yatayHizMs ** 3;
  return ideal / ROTOR.FM + parazit + ROTOR.AVIYONIK_W;
}
/**
 * Rotorun en fazla itkisi: itki ∝ ρ·Ω². Referans: nominal devirde, referans yoğunlukta havada asılı
 * kalış itkisi (= ağırlık). Buradan en yüksek devirdeki itki ölçeklenir.
 */
export function maksItki({ kutleKg, rho, rhoRef = 0.016 }) {
  const W = kutleKg * SABIT.g;
  return W * (rho / rhoRef) * (ROTOR.DEVIR_MAKS / ROTOR.DEVIR_NOMINAL) ** 2;
}
/** Havada asılı kalmak için gereken devir (dev/dk). DEVIR_MAKS'ı aşarsa araç bu havada uçamaz. */
export function gerekliDevir({ rho, rhoRef = 0.016 }) { return ROTOR.DEVIR_NOMINAL * Math.sqrt(rhoRef / rho); }
export function ucMach(devir, rotorCapM, sicaklikC) { return (devir * 2 * Math.PI / 60) * (rotorCapM / 2) / sesHizi(sicaklikC); }

// ------------------------------------------------------------------ PİL
/** Li-ion paketin sıcaklığa göre kullanılabilir enerjisi: 25 °C'de 44,4 Wh, 0 °C'de 38,8 Wh [K2], arası doğrusal. */
export function pilKapasitesiWh(sicaklikC, nominal25 = 44.4) {
  const oran = 38.8 / 44.4;
  const k = sicaklikC >= 25 ? 1 : sicaklikC <= 0 ? oran - (0 - sicaklikC) * 0.006 : oran + (1 - oran) * sicaklikC / 25;
  return nominal25 * sinir(k, 0.5, 1);
}

// ------------------------------------------------------------------ GEZGİN HAREKETİ
/**
 * Tekerlek gücü: P = (C_rr·m·g·cosθ + m·g·sinθ)·v / η
 * C_rr = 0,15 (gevşek regolit) ve η = 0,35 (motor+dişli) VARSAYIMdır.
 */
export const GEZGIN = Object.freeze({ CRR: 0.15, VERIM: 0.35, AVIYONIK_W: 22, ISITICI_W: 42, UPLINK_W: 70 }); // 22/42/70 W: 2B Pathfinder ile aynı oyun varsayımları
export function tekerlekGucu({ kutleKg, hizMs, egimRad = 0 }) {
  const F = GEZGIN.CRR * kutleKg * SABIT.g * Math.cos(egimRad) + kutleKg * SABIT.g * Math.sin(egimRad);
  return Math.max(0, F * Math.abs(hizMs) / GEZGIN.VERIM);
}

// ------------------------------------------------------------------ ISI
/** Isı bölmesi: ortama doğru yavaşça soğur; ısıtıcı açıksa hedef sıcaklığa ısınır. */
export const ISI = Object.freeze({ HEDEF_C: 5, SOGUMA_HIZI: 0.00035, ISINMA_HIZI: 0.004, SARJ_MIN_C: 0, DEGISIM_MIN_C: -20 }); // VARSAYIM (Li-ion 0 °C altında şarj edilmez)
export function bolmeSicakligi({ bolmeC, ortamC, isiticiAcik, dt }) {
  const isiyor = isiticiAcik && bolmeC < ISI.HEDEF_C;
  const hedef = isiyor ? ISI.HEDEF_C + 3 : ortamC, hiz = isiyor ? ISI.ISINMA_HIZI : ISI.SOGUMA_HIZI;
  return { bolmeC: bolmeC + (hedef - bolmeC) * Math.min(1, dt * hiz), isiyor };
}

// ------------------------------------------------------------------ İLETİŞİM
/** UHF bağlantı kalitesi (%): 1000 m'de sınırda, araya arazi girerse kopar. VARSAYIM: menzil 1000 m. */
export function baglantiKalitesi(mesafeM, gorusVar = true, menzilM = 1000) {
  if (!gorusVar) return 0;
  return Math.round(sinir(100 * (1 - (mesafeM / menzilM) ** 2), 0, 100));
}

// ------------------------------------------------------------------ TOZ FIRTINASI
/** Tohumlu, tekrarlanabilir fırtına takvimi (görev saniyesine göre). */
export function firtinaDurumu(gorevS, tohum = 7) {
  const periyot = 9000, sure = 1400;
  const kaydir = ((tohum * 2654435761) % periyot + periyot) % periyot;
  const t = (gorevS + kaydir) % periyot;
  const aktif = t > periyot - sure;
  const siddet = aktif ? Math.sin(Math.PI * (t - (periyot - sure)) / sure) : 0;
  return { aktif, siddet, tozCarpani: 1 + 2.5 * siddet, ruzgarMs: 4 + 14 * siddet };
}

// ------------------------------------------------------------------ YOLLAMA
export function tahminiKalanUcusS(enerjiWh, gucW, rezervOrani = 0.3, kapasiteWh = 44.4) {
  const kullanilabilir = Math.max(0, enerjiWh - rezervOrani * kapasiteWh);
  return gucW > 0 ? (kullanilabilir * 3600) / gucW : Infinity;
}

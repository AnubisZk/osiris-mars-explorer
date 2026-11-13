// ============================================================================
//  FİZİK — aracın nasıl uçtuğunu hesaplayan motor
//  Sorumlu rol: BİLİM DANIŞMANI + KODCU
//
//  Bu dosya ekrana hiçbir şey çizmez; yalnızca hesap yapar. Bu yüzden
//  "node" ile test edilebilir (bkz. tests/ klasörü, öğretmenin sitesinde).
//
//  KULLANILAN FİZİK (sadeleştirilmiş ama gerçek denklemler):
//
//  1) Newton'un ikinci yasası:  ivme = toplam kuvvet / kütle
//     Kuvvetler: itki (motor), ağırlık (kütle × yerçekimi), hava direnci.
//
//  2) Rotor itkisi:  T_maks = C_T × ρ × A × (uç hızı)²
//     ρ (ro) = hava yoğunluğu, A = rotorların süpürdüğü alan.
//     Mars'ın havası Dünya'nınkinden ~60 kat seyrek olduğu için aynı rotor
//     Mars'ta ~60 kat az itki üretir. Ingenuity bu yüzden çok büyük rotorlarla
//     dakikada ~2400 devirle döndü.
//
//  3) Rotor gücü (momentum teorisi):  P = T × (v_i + tırmanma hızı) / verim
//     v_i = √( T / (2ρA) )  → seyrek havada rotor çok daha fazla güç harcar.
//
//  4) Roket:  yakıt tüketimi = itki / (Isp × g₀)
//     Isp (özgül itki) ne kadar büyükse motor yakıtı o kadar verimli kullanır.
//     Havası olmayan Ay ve Europa'da rotor çalışmaz; roket gerekir.
//
//  5) Hava direnci:  F = ½ × ρ × (Cd·A) × v²   (havası olmayan yerde sıfır)
// ============================================================================

import { GEZEGENLER } from './gezegenler.js';

export const G0 = 9.80665;          // Dünya'nın standart yerçekimi (Isp hesabında kullanılır)
export const ITKI_KATSAYISI = 0.012; // C_T: tipik bir rotorun ulaşabildiği en yüksek itki katsayısı
export const USS_YARICAPI = 10;      // üs pistinin yarıçapı (m)
const DERECE = Math.PI / 180;

// ---------------------------------------------------------------- ortam
export function ortam(gorev) {
  const gz = GEZEGENLER[gorev.gezegen];
  if (!gz) throw new Error(`Bilinmeyen gezegen: "${gorev.gezegen}". gezegenler.js içindeki adlardan birini yaz.`);
  return {
    ...gz,
    g: gorev.yercekimi_m_s2 ?? gz.yercekimi_m_s2,
    rho0: gorev.havaYogunlugu_kg_m3 ?? gz.havaYogunlugu_kg_m3,
  };
}

// Yükseklikle seyrelen hava (üstel atmosfer)
export function yogunluk(ort, irtifa) {
  return ort.rho0 * Math.exp(-Math.max(0, irtifa) / ort.olcekYuksekligi_m);
}

export function kutle(arac, d) {
  return arac.tip === 'roket' ? arac.kuruKutle_kg + Math.max(0, d ? d.yakit_kg : arac.yakit_kg) : arac.kutle_kg;
}

// Bu anda ulaşılabilecek en büyük itki (N)
export function maksItki(arac, rho, d) {
  if (arac.tip === 'roket') return (d ? d.yakit_kg : arac.yakit_kg) > 0 ? arac.maksItki_N : 0;
  if (d && d.enerji_Wh <= 0) return 0;
  return ITKI_KATSAYISI * rho * arac.rotorAlani_m2 * arac.ucHizi_m_s ** 2;
}

// Rotorun çektiği elektrik gücü (W)
export function rotorGucu(arac, itki, rho, tirmanma) {
  if (rho <= 0 || itki <= 0) return arac.avyonikGucu_W ?? 0;
  const vi = Math.sqrt(itki / (2 * rho * arac.rotorAlani_m2));
  return itki * (vi + Math.max(0, tirmanma)) / arac.rotorVerimi + (arac.avyonikGucu_W ?? 0);
}

// ---------------------------------------------------------------- özet
// Uçuştan önce "bu araç burada uçabilir mi?" sorusunun cevabı.
export function aracOzeti(gorev) {
  const ort = ortam(gorev), a = gorev.arac;
  const m = kutle(a), W = m * ort.g, rho = ort.rho0;
  const T = maksItki(a, rho);
  const o = { kutle_kg: m, agirlik_N: W, maksItki_N: T, itkiAgirlikOrani: W > 0 ? T / W : 0 };
  if (a.tip === 'roket') {
    const mdot = W / (a.isp_s * G0);
    o.askidaKalmaSuresi_s = a.yakit_kg / mdot;
    o.deltaV_m_s = a.isp_s * G0 * Math.log((a.kuruKutle_kg + a.yakit_kg) / a.kuruKutle_kg);
  } else {
    o.askidaGuc_W = rotorGucu(a, W, rho, 0);
    o.askidaKalmaSuresi_s = a.batarya_Wh * 3600 / o.askidaGuc_W;
    o.ucMach = ort.sesHizi_m_s > 0 ? a.ucHizi_m_s / ort.sesHizi_m_s : 0;
  }
  o.ucabilir = o.itkiAgirlikOrani > 1.05;
  return o;
}

// ---------------------------------------------------------------- durum
export function yeniDurum(gorev, zemin) {
  const a = gorev.arac;
  return {
    x: 0, z: 0, y: zemin(0, 0),
    vx: 0, vy: 0, vz: 0,
    egimX: 0, egimZ: 0,          // eğim açıları (radyan): itkinin yatay bileşenini verir
    gaz: 0,                      // 0..1: motorun ne kadar açık olduğu
    itki_N: 0, guc_W: 0,
    enerji_Wh: a.tip === 'roket' ? 0 : a.batarya_Wh,
    yakit_kg: a.tip === 'roket' ? a.yakit_kg : 0,
    yerde: true,
    zaman: 0,
    agl: 0,                      // yerden yükseklik (m)
    hedefler: gorev.hedefler.map(() => ({ ilerleme: 0, tamam: false })),
    sonuc: null,                 // null = uçuş sürüyor; yoksa {tur, mesaj}
  };
}

function sinirla(v, a, b) { return Math.min(b, Math.max(a, v)); }
function yaklas(v, hedef, adim) { return v + sinirla(hedef - v, -adim, adim); }

// ---------------------------------------------------------------- adım
// girdi: { x, z, y } her biri -1..1  (x,z: yatay yön dünyada; y: yukarı/aşağı)
//        yardimciPilot: true → x,z,y istenen HIZI belirtir (gerçek dronlar böyle uçar)
//                       false → y gazı artırır/azaltır, x,z eğimi doğrudan verir (zor mod)
export function adim(d, girdi, gorev, zemin, dt) {
  if (d.sonuc) return d;
  const ort = ortam(gorev), a = gorev.arac, g = ort.g;
  const m = kutle(a, d);
  const rho = yogunluk(ort, d.y);
  const Tmax = maksItki(a, rho, d);
  const maksEgim = (a.maksEgim_derece ?? 20) * DERECE;
  const egimHizi = 90 * DERECE * dt;
  const zg = zemin(d.x, d.z);
  d.agl = d.y - zg;

  // ---- rüzgâr (dakikada artabilir: fırtına yaklaşıyor)
  const rz = gorev.ruzgar ?? {};
  const ruzgarHiz = (rz.hiz_m_s ?? 0) + (rz.artis_m_s_dk ?? 0) * d.zaman / 60;
  const ryon = (rz.yon_derece ?? 0) * DERECE;  // rüzgârın ESTİĞİ yön (0 = kuzeye doğru)
  const wx = Math.sin(ryon) * ruzgarHiz, wz = -Math.cos(ryon) * ruzgarHiz;

  // ---- kontrol
  let hedefEgimX, hedefEgimZ, hedefGaz;
  if (girdi.yardimciPilot !== false) {
    const maksHiz = a.maksHiz_m_s ?? 8;
    const maksDikey = a.maksDikeyHiz_m_s ?? (a.tip === 'roket' ? 4 : 3);
    let vyIstek = (girdi.y ?? 0) * maksDikey;
    // yumuşak iniş yardımı: yere yaklaştıkça iniş hızını otomatik azalt
    if (vyIstek < 0) vyIstek = Math.max(vyIstek, -Math.max(0.6, d.agl * 0.4));
    const vxIstek = (girdi.x ?? 0) * maksHiz, vzIstek = (girdi.z ?? 0) * maksHiz;
    const ax = sinirla(0.8 * (vxIstek - d.vx), -g, g), az = sinirla(0.8 * (vzIstek - d.vz), -g, g);
    hedefEgimX = d.yerde ? 0 : sinirla(Math.atan2(ax, g), -maksEgim, maksEgim);
    hedefEgimZ = d.yerde ? 0 : sinirla(Math.atan2(az, g), -maksEgim, maksEgim);
    const cos = Math.cos(Math.hypot(d.egimX, d.egimZ));
    const istenen = m * (g + 1.5 * (vyIstek - d.vy)) / Math.max(0.5, cos);
    hedefGaz = (d.yerde && vyIstek <= 0) ? 0 : (Tmax > 0 ? sinirla(istenen / Tmax, 0, 1) : 0);
  } else {
    hedefEgimX = (girdi.x ?? 0) * maksEgim;
    hedefEgimZ = (girdi.z ?? 0) * maksEgim;
    hedefGaz = sinirla(d.gaz + (girdi.y ?? 0) * 0.6 * dt, 0, 1);
  }
  d.egimX = yaklas(d.egimX, hedefEgimX, egimHizi);
  d.egimZ = yaklas(d.egimZ, hedefEgimZ, egimHizi);
  d.gaz = girdi.yardimciPilot !== false ? yaklas(d.gaz, hedefGaz, 3 * dt) : hedefGaz;

  // ---- itki ve tüketim
  const T = d.gaz * Tmax;
  d.itki_N = T;
  if (a.tip === 'roket') {
    d.guc_W = 0;
    d.yakit_kg = Math.max(0, d.yakit_kg - T / (a.isp_s * G0) * dt);
  } else {
    d.guc_W = rotorGucu(a, T, rho, d.vy);
    d.enerji_Wh = Math.max(0, d.enerji_Wh - d.guc_W * dt / 3600);
  }

  // ---- kuvvetler → ivme
  const tx = Math.tan(d.egimX), tz = Math.tan(d.egimZ), n = Math.sqrt(1 + tx * tx + tz * tz);
  const rx = d.vx - wx, rzz = d.vz - wz, ry = d.vy;
  const vr = Math.sqrt(rx * rx + ry * ry + rzz * rzz);
  const k = 0.5 * rho * (a.suruklenmeAlani_m2 ?? 0) * vr;
  let axT = (T * tx / n - k * rx) / m;
  let ayT = (T / n - k * ry) / m - g;
  let azT = (T * tz / n - k * rzz) / m;

  if (d.yerde) {
    if (ayT <= 0) { d.vx = d.vy = d.vz = 0; d.y = zg; d.agl = 0; }
    else d.yerde = false;                 // kalkış!
  }
  if (!d.yerde) {
    d.vx += axT * dt; d.vy += ayT * dt; d.vz += azT * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    const zg2 = zemin(d.x, d.z);
    d.agl = d.y - zg2;
    if (d.agl <= 0) {                     // yere değdi
      const darbe = -d.vy, yatay = Math.hypot(d.vx, d.vz);
      const egim = Math.hypot(d.egimX, d.egimZ) / DERECE;
      d.y = zg2; d.agl = 0;
      if (darbe > (a.guvenliInis_m_s ?? 2) || yatay > 3 || egim > 20) {
        d.sonuc = { tur: 'kaza', mesaj: `Sert iniş! Çarpma hızı ${darbe.toFixed(1)} m/s (güvenli sınır ${a.guvenliInis_m_s ?? 2} m/s), yatay hız ${yatay.toFixed(1)} m/s.` };
      }
      d.vx = d.vy = d.vz = 0; d.yerde = true;
    }
  }

  // ---- görev kuralları
  d.zaman += dt;
  const hiz = Math.hypot(d.vx, d.vy, d.vz);
  gorev.hedefler.forEach((h, i) => {
    const s = d.hedefler[i];
    if (s.tamam) return;
    const yakin = Math.hypot(d.x - h.x, d.z - h.z) < (h.yaricap ?? 15);
    if (yakin && d.agl <= (h.maksIrtifa_m ?? 15) && hiz < 3) {
      s.ilerleme += dt;
      if (s.ilerleme >= (h.gozlemSuresi_s ?? 3)) s.tamam = true;
    } else s.ilerleme = Math.max(0, s.ilerleme - dt);   // uzaklaşınca gözlem bozulur
  });
  const hepsi = d.hedefler.every(s => s.tamam);
  const ussde = Math.hypot(d.x, d.z) < USS_YARICAPI;
  if (!d.sonuc && hepsi && d.yerde && ussde) d.sonuc = { tur: 'basari', mesaj: 'Tüm gözlemler tamam ve araç üsse güvenle döndü!' };
  if (!d.sonuc && d.yerde && Tmax <= 0 && d.zaman > 1) {
    d.sonuc = { tur: 'enerji', mesaj: a.tip === 'roket' ? 'Yakıt bitti, araç bir daha kalkamaz.'
      : rho <= 0 ? `${ort.ad} üzerinde hava yok: rotor itki üretemez. Roketli bir araç tasarla (arac.tip = 'roket').`
      : 'Batarya bitti, araç bir daha kalkamaz.' };
  }
  if (!d.sonuc && gorev.sureSiniri_s > 0 && d.zaman >= gorev.sureSiniri_s) {
    d.sonuc = { tur: 'zaman', mesaj: gorev.sureBittiMesaji ?? 'Süre doldu, görev tamamlanamadı.' };
  }
  return d;
}

// ---------------------------------------------------------------- puan
export function puan(d, gorev) {
  const tamam = d.hedefler.filter(s => s.tamam).length;
  let p = tamam * 100;
  if (d.sonuc?.tur === 'basari') {
    p += 300;
    const kalan = gorev.arac.tip === 'roket' ? d.yakit_kg / gorev.arac.yakit_kg : d.enerji_Wh / gorev.arac.batarya_Wh;
    p += Math.round(kalan * 200);                                          // tasarruf bonusu
    if (gorev.sureSiniri_s > 0) p += Math.round(100 * (1 - d.zaman / gorev.sureSiniri_s)); // hız bonusu
  }
  return { puan: p, tamamlanan: tamam, toplam: gorev.hedefler.length };
}

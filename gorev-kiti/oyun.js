// ============================================================================
//  OYUN — ekrana çizim, klavye/dokunmatik kontrol, ekranlar
//  Sorumlu rol: KODCU (Tasarımcı ile birlikte)
//
//  Bu dosyanın görevi: ayarlar.js'teki görevi alıp fizik.js'e uçurtmak ve
//  sonucu three.js ile 3B olarak çizmek. Fizik hesabı burada YOK; o fizik.js'te.
//
//  Değiştirmeyi deneyebileceğin yerler "ÖĞRENCİ:" ile işaretlendi.
// ============================================================================

import * as THREE from 'three';
import { GOREV as AYAR } from './ayarlar.js';
import { GOREVLER } from './gorevler.js';
import { araziKur } from './arazi.js';
import { ortam, aracOzeti, yeniDurum, adim, puan, USS_YARICAPI } from './fizik.js';
import { atmosferiBagla } from './atmosfer.js';
import { GEZEGENLER } from './gezegenler.js';

// ---------------------------------------------------------------- görevi seç
// Adres çubuğunda ?gorev=titan gibi bir ek varsa hazır görev, yoksa ayarlar.js
const ek = new URLSearchParams(location.search).get('gorev');
const GOREV = ek && GOREVLER[ek] ? structuredClone(GOREVLER[ek]) : AYAR;
dogrula(GOREV);
// Gerçek veriden eğitilmiş atmosfer modeli varsa (ayarlar.js → atmosfer) önce onu yükle
await atmosferiBagla(GOREV, async yol => {
  const r = await fetch(yol, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Atmosfer modeli bulunamadı: ${yol} (${r.status}). Dosyayı veri/ klasörüne koydunuz mu? Adı ayarlar.js'teki adla aynı mı?`);
  return r.json();
}, GEZEGENLER[GOREV.gezegen]?.gazSabiti_J_kgK);
const ORT = ortam(GOREV);
const ARAC = GOREV.arac;
const OZET = aracOzeti(GOREV);
const roket = ARAC.tip === 'roket';

// Ayarlarda eksik ya da yanlış bir şey varsa anlaşılır bir mesajla dur.
function dogrula(g) {
  const h = [];
  const sayi = (v, ad, pozitif = true) => { if (typeof v !== 'number' || Number.isNaN(v) || (pozitif && v <= 0)) h.push(`${ad} pozitif bir sayı olmalı (şu an: ${JSON.stringify(v)})`); };
  if (!g || typeof g !== 'object') throw new Error('ayarlar.js içinde "export const GOREV = { ... }" bulunamadı.');
  if (!['dunya', 'mars', 'ay', 'titan', 'europa'].includes(g.gezegen)) h.push(`gezegen şunlardan biri olmalı: 'dunya', 'mars', 'ay', 'titan', 'europa' (şu an: ${JSON.stringify(g.gezegen)})`);
  const a = g.arac;
  if (!a) h.push('arac bölümü eksik');
  else if (a.tip === 'roket') { sayi(a.kuruKutle_kg, 'arac.kuruKutle_kg'); sayi(a.yakit_kg, 'arac.yakit_kg'); sayi(a.maksItki_N, 'arac.maksItki_N'); sayi(a.isp_s, 'arac.isp_s'); }
  else if (a.tip === 'rotor') { sayi(a.kutle_kg, 'arac.kutle_kg'); sayi(a.rotorAlani_m2, 'arac.rotorAlani_m2'); sayi(a.ucHizi_m_s, 'arac.ucHizi_m_s'); sayi(a.rotorVerimi, 'arac.rotorVerimi'); sayi(a.batarya_Wh, 'arac.batarya_Wh'); if (a.rotorVerimi > 1) h.push('arac.rotorVerimi 1\'den büyük olamaz (verim %100\'ü geçemez)'); }
  else h.push(`arac.tip 'rotor' ya da 'roket' olmalı (şu an: ${JSON.stringify(a.tip)})`);
  if (!Array.isArray(g.hedefler) || g.hedefler.length === 0) h.push('en az bir hedef olmalı (hedefler: [ ... ])');
  else g.hedefler.forEach((t, i) => { if (typeof t.x !== 'number' || typeof t.z !== 'number') h.push(`hedefler[${i}] için x ve z sayı olmalı`); });
  if (g.atmosfer) {
    if (typeof g.atmosfer.model !== 'string' || !g.atmosfer.model.endsWith('.json')) h.push("atmosfer.model bir .json dosyasının yolu olmalı (ör. 'veri/jezero-atmosfer.json')");
    if (!(g.atmosfer.saat >= 0 && g.atmosfer.saat < 24)) h.push(`atmosfer.saat 0 ile 24 arasında olmalı (şu an: ${JSON.stringify(g.atmosfer.saat)})`);
  }
  if (h.length) throw new Error('ayarlar.js içinde düzeltilmesi gerekenler:\n • ' + h.join('\n • '));
}

// ---------------------------------------------------------------- arazi
const duzAlanlar = [{ x: 0, z: 0, yaricap: USS_YARICAPI + 4 }, ...GOREV.hedefler.map(t => ({ x: t.x, z: t.z, yaricap: t.yaricap ?? 15 }))];
const zemin = araziKur(GOREV.arazi, duzAlanlar);
const ALAN = 1000; // metre: arazinin bir kenarı

// ---------------------------------------------------------------- three.js sahne
const tuval = document.getElementById('sahne');
const cizici = new THREE.WebGLRenderer({ canvas: tuval, antialias: true });
cizici.setPixelRatio(Math.min(2, devicePixelRatio));
const sahne = new THREE.Scene();
const havasiz = ORT.rho0 <= 0;
sahne.background = new THREE.Color(ORT.gok);
if (!havasiz) sahne.fog = new THREE.Fog(ORT.sis, 120, 650);   // ÖĞRENCİ: sisi kalınlaştır/incelt
const kamera = new THREE.PerspectiveCamera(60, 1, 0.05, 3000);

sahne.add(new THREE.HemisphereLight(havasiz ? 0x404050 : ORT.gok, 0x201810, havasiz ? 0.35 : 0.8));
const gunes = new THREE.DirectionalLight(0xffffff, havasiz ? 2.2 : 1.6);
const gunesYuks = GOREV.gezegen === 'ay' ? 0.18 : 0.8;           // Ay'ın güney kutbunda Güneş ufka çok yakındır
gunes.position.set(Math.cos(0.6) * 300, gunesYuks * 300, Math.sin(0.6) * 300);
sahne.add(gunes);

if (havasiz) {                                                    // havası olmayan yerde gündüz de yıldızlar görünür
  const n = 1500, p = new Float32Array(n * 3), r = Math.random;
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); p.set([s * Math.cos(t) * 1500, Math.abs(u) * 1500, s * Math.sin(t) * 1500], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  sahne.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
}

// Zemin ağı: her köşenin yüksekliği zemin() fonksiyonundan gelir
{
  const N = 250, geo = new THREE.PlaneGeometry(ALAN, ALAN, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, renk = new Float32Array(pos.count * 3);
  const r1 = new THREE.Color(ORT.zemin1), r2 = new THREE.Color(ORT.zemin2), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = zemin(x, z);
    pos.setY(i, y);
    const egim = Math.min(1, Math.abs(zemin(x + 2, z) - y) + Math.abs(zemin(x, z + 2) - y));
    const k = Math.min(1, Math.max(0, 0.5 + y * 0.05 + (Math.sin(x * 0.37) * Math.cos(z * 0.41)) * 0.08 + egim * 0.3));
    c.copy(r1).lerp(r2, k);
    renk.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(renk, 3));
  geo.computeVertexNormals();
  sahne.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}

// Yazılı etiket (hedef adları için)
function etiket(yazi, renk = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = '600 44px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#000a'; const w = Math.min(500, x.measureText(yazi).width + 40); x.fillRect(256 - w / 2, 8, w, 80);
  x.fillStyle = renk; x.fillText(yazi, 256, 50);
  // sizeAttenuation: false → etiket uzaklıktan bağımsız, ekranda hep aynı boyda görünür
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, fog: false, sizeAttenuation: false }));
  s.scale.set(0.16, 0.03, 1); s.renderOrder = 10;
  return s;
}

// Üs (iniş pisti)
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#2b2f36'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
  x.strokeStyle = '#ffd34d'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
  x.fillStyle = '#ffffff'; x.font = 'bold 120px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 128, 136);
  const pist = new THREE.Mesh(new THREE.CircleGeometry(USS_YARICAPI, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
  pist.rotation.x = -Math.PI / 2; pist.position.set(0, zemin(0, 0) + 0.05, 0);
  sahne.add(pist);
  const e = etiket('ÜS', '#ffd34d'); e.position.set(0, zemin(0, 0) + 8, 0); sahne.add(e);
}

// Hedefler: yerde halka + gökyüzüne uzanan işaret ışığı
const hedefGorsel = GOREV.hedefler.map(t => {
  const y = zemin(t.x, t.z), R = t.yaricap ?? 15;
  const halka = new THREE.Mesh(new THREE.RingGeometry(R - 0.8, R, 64), new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  halka.rotation.x = -Math.PI / 2; halka.position.set(t.x, y + 0.1, t.z);
  const isik = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 120, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, depthWrite: false }));
  isik.position.set(t.x, y + 60, t.z);
  const yazi = etiket(t.ad); yazi.position.set(t.x, y + (t.maksIrtifa_m ?? 15) + 6, t.z);
  // gözlem tavanı: bu yüksekliğin altında kalmalısın
  const tavan = new THREE.Mesh(new THREE.RingGeometry(R - 0.3, R, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.25 }));
  tavan.rotation.x = -Math.PI / 2; tavan.position.set(t.x, y + (t.maksIrtifa_m ?? 15), t.z);
  sahne.add(halka, isik, yazi, tavan);
  return { halka, isik, tavan };
});

// ---------------------------------------------------------------- araç modeli
// ÖĞRENCİ: aracın görünüşünü burada değiştirebilirsin (renk ayarlar.js'te).
const arac3B = new THREE.Group();
const pervaneler = [];
let alev = null, boyut;
{
  const govdeMalz = new THREE.MeshStandardMaterial({ color: ARAC.renk ?? '#dddddd', metalness: 0.3, roughness: 0.5 });
  const koyu = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  if (roket) {
    const m = ARAC.kuruKutle_kg + ARAC.yakit_kg, R = 0.6 * Math.cbrt(m / 450) * 1.6;
    boyut = R * 2;
    const govde = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R, R * 1.4, 16), govdeMalz); govde.position.y = R * 1.3; arac3B.add(govde);
    const ust = new THREE.Mesh(new THREE.ConeGeometry(R * 0.8, R * 0.8, 16), govdeMalz); ust.position.y = R * 2.4; arac3B.add(ust);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const bacak = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * R, 0.05 * R, R * 1.3, 6), koyu);
      bacak.position.set(Math.cos(a) * R * 1.05, R * 0.5, Math.sin(a) * R * 1.05); bacak.rotation.z = Math.cos(a) * 0.5; bacak.rotation.x = -Math.sin(a) * 0.5;
      arac3B.add(bacak);
    }
    alev = new THREE.Mesh(new THREE.ConeGeometry(R * 0.35, R * 2, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 }));
    alev.rotation.x = Math.PI; alev.position.y = R * 0.2; arac3B.add(alev);
  } else {
    const A = ARAC.rotorAlani_m2, buyuk = A > 0.8;                // büyük rotor → eş eksenli (Ingenuity gibi), küçük → dört rotorlu
    const r = buyuk ? Math.sqrt(A / 2 / Math.PI) : Math.sqrt(A / 4 / Math.PI);
    const g = buyuk ? r * 0.35 : r * 1.4;
    boyut = buyuk ? r * 2 : r * 5;
    const govde = new THREE.Mesh(new THREE.BoxGeometry(g, g * 0.7, g), govdeMalz); govde.position.y = g * 0.9; arac3B.add(govde);
    const pervaneMalz = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const ekle = (x, y, z) => { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 32), pervaneMalz); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); arac3B.add(p); pervaneler.push(p); };
    if (buyuk) {
      const mil = new THREE.Mesh(new THREE.CylinderGeometry(g * 0.08, g * 0.08, r * 0.6, 8), koyu); mil.position.y = g * 1.25 + r * 0.3; arac3B.add(mil);
      ekle(0, g * 1.3 + r * 0.3, 0); ekle(0, g * 1.3 + r * 0.55, 0);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(g * 0.04, g * 0.04, g * 1.4, 6), koyu); b.position.set(Math.cos(a) * g * 0.7, g * 0.4, Math.sin(a) * g * 0.7); b.rotation.z = Math.cos(a) * 0.6; b.rotation.x = -Math.sin(a) * 0.6; arac3B.add(b); }
    } else {
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, d = r * 1.6; const kol = new THREE.Mesh(new THREE.BoxGeometry(d, g * 0.15, g * 0.2), koyu); kol.position.set(Math.cos(a) * d / 2, g * 0.9, Math.sin(a) * d / 2); kol.rotation.y = -a; arac3B.add(kol); ekle(Math.cos(a) * d, g * 1.15, Math.sin(a) * d); }
    }
  }
}
sahne.add(arac3B);
const golge = new THREE.Mesh(new THREE.CircleGeometry(boyut * 0.6, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
golge.rotation.x = -Math.PI / 2; sahne.add(golge);

// ---------------------------------------------------------------- girdi
const basili = new Set();
let kamYon = 0, kamMod = 'takip', yardimciPilot = true, duraklat = false, basladi = false;
const TUS = { ArrowUp: 'ileri', ArrowDown: 'geri', ArrowLeft: 'sol', ArrowRight: 'sag', KeyW: 'yukari', KeyS: 'asagi', Space: 'yukari', ShiftLeft: 'asagi', KeyQ: 'kamSol', KeyE: 'kamSag', KeyA: 'sol', KeyD: 'sag' };
addEventListener('keydown', e => {
  if (TUS[e.code]) { basili.add(TUS[e.code]); e.preventDefault(); }
  if (!basladi) return;
  if (e.code === 'KeyP') { yardimciPilot = !yardimciPilot; bildir(yardimciPilot ? 'Yardımcı pilot AÇIK: tuşlar istenen hızı belirler.' : 'Yardımcı pilot KAPALI: W/S gazı, oklar eğimi değiştirir. Zor mod!'); }
  if (e.code === 'KeyC') kamMod = kamMod === 'takip' ? 'tepe' : 'takip';
  if (e.code === 'KeyR') yenidenBasla();
  if (e.code === 'Escape') { duraklat = !duraklat; bildir(duraklat ? 'Duraklatıldı (Esc ile devam)' : ''); }
});
addEventListener('keyup', e => { if (TUS[e.code]) basili.delete(TUS[e.code]); });
addEventListener('blur', () => basili.clear());
for (const b of document.querySelectorAll('#dokunmatik button')) {
  const t = b.dataset.tus;
  b.addEventListener('pointerdown', e => { e.preventDefault(); basili.add(t); b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => basili.delete(t));
}
// fareyle sürükleyerek kamerayı döndür
let surukle = null;
tuval.addEventListener('pointerdown', e => { surukle = e.clientX; });
addEventListener('pointerup', () => { surukle = null; });
addEventListener('pointermove', e => { if (surukle != null) { kamYon -= (e.clientX - surukle) * 0.006; surukle = e.clientX; } });

// Tuşları kameraya göre dünya yönüne çevirir
function girdiOku() {
  const ileri = (basili.has('ileri') ? 1 : 0) - (basili.has('geri') ? 1 : 0);
  const sag = (basili.has('sag') ? 1 : 0) - (basili.has('sol') ? 1 : 0);
  const fx = -Math.sin(kamYon), fz = -Math.cos(kamYon), sx = Math.cos(kamYon), sz = -Math.sin(kamYon);
  let x = fx * ileri + sx * sag, z = fz * ileri + sz * sag;
  const n = Math.hypot(x, z); if (n > 1) { x /= n; z /= n; }
  return { x, z, y: (basili.has('yukari') ? 1 : 0) - (basili.has('asagi') ? 1 : 0), yardimciPilot };
}

// Işık gecikmesi: komut, gecikme_s kadar sonra araca ulaşır
const yoldakiKomutlar = [];
let etkinKomut = { x: 0, z: 0, y: 0, yardimciPilot: true };

// ---------------------------------------------------------------- simülasyon
let d, istatistik;
function yenidenBasla() {
  d = yeniDurum(GOREV, zemin);
  istatistik = { maksIrtifa: 0, mesafe: 0 };
  yoldakiKomutlar.length = 0; etkinKomut = { x: 0, z: 0, y: 0, yardimciPilot };
  document.getElementById('son').hidden = true;
  duraklat = false;
}
yenidenBasla();

const DT = 1 / 120;
let birikim = 0, onceki = performance.now(), sonBitis = null;
function dongu(simdi) {
  requestAnimationFrame(dongu);
  const gecen = Math.min(0.1, (simdi - onceki) / 1000); onceki = simdi;
  if (basili.has('kamSol')) kamYon += 1.6 * gecen;
  if (basili.has('kamSag')) kamYon -= 1.6 * gecen;
  if (basladi && !duraklat && !d.sonuc) {
    birikim += gecen;
    while (birikim >= DT) {
      birikim -= DT;
      yoldakiKomutlar.push({ t: d.zaman + (GOREV.gecikme_s ?? 0), k: girdiOku() });
      while (yoldakiKomutlar.length && yoldakiKomutlar[0].t <= d.zaman) etkinKomut = yoldakiKomutlar.shift().k;
      const ox = d.x, oz = d.z;
      adim(d, etkinKomut, GOREV, zemin, DT);
      istatistik.mesafe += Math.hypot(d.x - ox, d.z - oz);
      istatistik.maksIrtifa = Math.max(istatistik.maksIrtifa, d.agl);
      if (d.sonuc) { sonBitis = simdi; break; }
    }
  }
  if (d.sonuc && sonBitis && simdi - sonBitis > 900) { sonBitis = null; sonEkrani(); }
  ciz(gecen);
  if (simdi - sonPanel > 100) { sonPanel = simdi; paneller(); }
}
let sonPanel = 0;

// ---------------------------------------------------------------- çizim
const kamHedef = new THREE.Vector3(), kamKonum = new THREE.Vector3();
let pervaneAci = 0;
function ciz(gecen) {
  const w = innerWidth, h = innerHeight;
  if (tuval.width !== Math.floor(w * cizici.getPixelRatio()) || tuval.height !== Math.floor(h * cizici.getPixelRatio())) { cizici.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix(); }

  arac3B.position.set(d.x, d.y, d.z);
  arac3B.rotation.set(d.egimZ, 0, -d.egimX, 'XYZ');
  pervaneAci += gecen * (2 + d.gaz * 60);
  pervaneler.forEach((p, i) => { p.rotation.z = (i % 2 ? -1 : 1) * pervaneAci; p.material.opacity = 0.25 + 0.3 * (1 - d.gaz); });
  if (alev) { alev.visible = d.gaz > 0.02; alev.scale.set(1, 0.4 + d.gaz * 1.4 * (0.9 + Math.random() * 0.2), 1); }
  golge.position.set(d.x, zemin(d.x, d.z) + 0.08, d.z);
  golge.material.opacity = Math.max(0.1, 0.5 - d.agl * 0.01);

  hedefGorsel.forEach((g, i) => {
    const s = d.hedefler[i], renk = s.tamam ? 0x6fdc8c : (s.ilerleme > 0 ? 0x7ef0ff : 0xffd34d);
    g.halka.material.color.setHex(renk); g.isik.material.color.setHex(renk);
    g.isik.material.opacity = s.tamam ? 0.15 : 0.35;
  });

  const uzak = Math.max(6, boyut * 7);
  if (kamMod === 'takip') {
    // kamera aracın arkasında ve biraz yukarıda; aracın biraz önüne bakar ki gideceğin yeri gör
    kamHedef.set(d.x - Math.sin(kamYon) * uzak * 0.6, d.y + boyut * 0.5, d.z - Math.cos(kamYon) * uzak * 0.6);
    kamKonum.set(d.x + Math.sin(kamYon) * uzak, d.y + uzak * 0.6, d.z + Math.cos(kamYon) * uzak);
  } else {
    kamHedef.set(d.x, d.y, d.z);
    kamKonum.set(d.x + Math.sin(kamYon) * 2, d.y + 90, d.z + Math.cos(kamYon) * 2);
  }
  kamKonum.y = Math.max(kamKonum.y, zemin(kamKonum.x, kamKonum.z) + 1.5);
  kamera.position.lerp(kamKonum, Math.min(1, gecen * 6));
  kamera.lookAt(kamHedef);
  cizici.render(sahne, kamera);
}

// ---------------------------------------------------------------- paneller
const $ = id => document.getElementById(id);
const sayi = (v, b = 1) => (Math.round(v * 10 ** b) / 10 ** b).toLocaleString('tr-TR', { minimumFractionDigits: b, maximumFractionDigits: b });
const sure = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
$('baslik').textContent = GOREV.baslik;
$('dunyaYazi').textContent = `${ORT.ad} · g = ${sayi(ORT.g, 2)} m/s² · hava ${ORT.rho0 > 0 ? sayi(ORT.rho0, ORT.rho0 < 0.1 ? 3 : 2) + ' kg/m³' : 'yok'}`;
if (GOREV.gecikme_s > 0) { $('gecikmeYazi').style.display = 'block'; $('gecikmeYazi').textContent = `📡 Komutlar araca ${sayi(GOREV.gecikme_s, 1)} s gecikmeyle ulaşıyor`; }

let bildirim = '', bildirimSonu = 0;
function bildir(m) { bildirim = m; bildirimSonu = performance.now() + 3500; }

function paneller() {
  const kalanOran = roket ? d.yakit_kg / ARAC.yakit_kg : d.enerji_Wh / ARAC.batarya_Wh;
  const yatay = Math.hypot(d.vx, d.vz);
  const satirlar = [
    ['Yerden yükseklik', `${sayi(d.agl)} m`],
    ['Dikey hız', `${d.vy >= 0 ? '+' : ''}${sayi(d.vy)} m/s`],
    ['Yatay hız', `${sayi(yatay)} m/s`],
    ['İtki', `${sayi(d.itki_N, 0)} N  (%${sayi(d.gaz * 100, 0)})`],
    roket ? ['Yakıt', `${sayi(d.yakit_kg, 1)} kg`] : ['Güç', `${sayi(d.guc_W, 0)} W`],
    roket ? ['Kütle', `${sayi(ARAC.kuruKutle_kg + d.yakit_kg, 0)} kg`] : ['Kalan süre (bu güçle)', d.guc_W > 1 ? sure(d.enerji_Wh * 3600 / d.guc_W) : '—'],
    ['Pilot', yardimciPilot ? 'yardımcı pilot' : 'elle (zor mod)'],
  ];
  if (GOREV._atmosfer) {
    const a = ortam(GOREV, d.zaman).atm;
    satirlar.push(['Hava yoğunluğu (veri)', `${sayi(a.rho, 4)} kg/m³`], ['Rüzgâr (veri)', `${sayi(a.ruzgarHiz, 1)} m/s`]);
  } else if (GOREV.ruzgar?.hiz_m_s || GOREV.ruzgar?.artis_m_s_dk) satirlar.push(['Rüzgâr', `${sayi((GOREV.ruzgar.hiz_m_s ?? 0) + (GOREV.ruzgar.artis_m_s_dk ?? 0) * d.zaman / 60)} m/s`]);
  $('olcumIcerik').innerHTML = satirlar.map(([a, b]) => `<div class="satir"><span>${a}</span><b>${b}</b></div>`).join('') +
    `<div class="satir"><span>${roket ? 'Yakıt' : 'Batarya'}</span><b>%${sayi(kalanOran * 100, 0)}</b></div><div class="cubuk"><i style="width:${Math.max(0, kalanOran * 100)}%;background:${kalanOran < 0.25 ? 'var(--kotu)' : kalanOran < 0.5 ? 'var(--vurgu)' : 'var(--iyi)'}"></i></div>`;

  let uyari = '';
  if (performance.now() < bildirimSonu) uyari = bildirim;
  else if (kalanOran < 0.25) uyari = roket ? '⚠ Yakıt azaldı: üsse dön!' : '⚠ Batarya azaldı: üsse dön!';
  else if (d.hedefler.every(s => s.tamam)) uyari = '✓ Tüm gözlemler tamam: üsse (H) dön ve yavaşça in.';
  else if (d.yerde && d.zaman < 3) uyari = 'Kalkmak için W ya da Boşluk tuşuna bas.';
  $('uyari').textContent = uyari;

  $('hedefListe').innerHTML = GOREV.hedefler.map((t, i) => {
    const s = d.hedefler[i], oran = s.tamam ? 1 : s.ilerleme / (t.gozlemSuresi_s ?? 3);
    const uzak = Math.hypot(d.x - t.x, d.z - t.z);
    return `<div class="hedef ${s.tamam ? 'tamam' : ''}"><div class="ad"><span>${s.tamam ? '✓ ' : ''}${t.ad}</span><span>${s.tamam ? 'tamam' : sayi(uzak, 0) + ' m'}</span></div><div class="cubuk"><i style="width:${oran * 100}%"></i></div></div>`;
  }).join('');

  let saatYazi = sure(d.zaman);
  if (GOREV.sureSiniri_s > 0) saatYazi = `⏱ ${sure(Math.max(0, GOREV.sureSiniri_s - d.zaman))} kaldı`;
  $('saat').textContent = saatYazi;
  harita();
}

// Kuşbakışı harita: kuzey yukarıda
const hc = $('harita'), hx = hc.getContext('2d');
const haritaOlcek = Math.max(150, ...GOREV.hedefler.map(t => Math.max(Math.abs(t.x), Math.abs(t.z)))) * 1.25;
function harita() {
  const W = hc.width, k = W / 2 / haritaOlcek, X = v => W / 2 + v * k;
  hx.clearRect(0, 0, W, W);
  hx.strokeStyle = '#ffffff22'; hx.lineWidth = 1;
  for (let v = -400; v <= 400; v += 100) { hx.beginPath(); hx.moveTo(X(v), 0); hx.lineTo(X(v), W); hx.moveTo(0, X(v)); hx.lineTo(W, X(v)); hx.stroke(); }
  hx.fillStyle = '#ffd34d'; hx.beginPath(); hx.arc(X(0), X(0), Math.max(4, USS_YARICAPI * k), 0, 7); hx.fill();
  hx.fillStyle = '#1d1205'; hx.font = 'bold 14px system-ui'; hx.textAlign = 'center'; hx.textBaseline = 'middle'; hx.fillText('H', X(0), X(0) + 1);
  GOREV.hedefler.forEach((t, i) => {
    hx.strokeStyle = d.hedefler[i].tamam ? '#6fdc8c' : '#ffd34d'; hx.lineWidth = 3;
    hx.beginPath(); hx.arc(X(t.x), X(t.z), Math.max(5, (t.yaricap ?? 15) * k), 0, 7); hx.stroke();
    hx.fillStyle = '#fff'; hx.font = '12px system-ui'; hx.fillText(String(i + 1), X(t.x), X(t.z));
  });
  hx.fillStyle = '#ffffff'; hx.font = 'bold 13px system-ui'; hx.fillText('K', W / 2, 12);
  hx.save(); hx.translate(X(d.x), X(d.z)); hx.rotate(-kamYon);
  hx.fillStyle = '#7ef0ff'; hx.beginPath(); hx.moveTo(0, -9); hx.lineTo(6, 7); hx.lineTo(-6, 7); hx.closePath(); hx.fill();
  hx.restore();
}

// ---------------------------------------------------------------- ekranlar
const ZORLUK = ['', '★ kolay', '★★ orta', '★★★ zor'];
function girisEkrani() {
  const o = OZET;
  const bilgi = [
    ['Gezegen / uydu', ORT.ad], ['Yerçekimi', `${sayi(ORT.g, 2)} m/s² (Dünya'nın %${sayi(ORT.g / 9.81 * 100, 0)}'i)`],
    ['Hava yoğunluğu', ORT.rho0 > 0 ? `${sayi(ORT.rho0, ORT.rho0 < 0.1 ? 3 : 2)} kg/m³ (Dünya'nın %${sayi(ORT.rho0 / 1.225 * 100, ORT.rho0 < 0.1 ? 1 : 0)}'i)` : 'yok'],
    ['Işık gecikmesi (gerçekte)', ORT.isikGecikmesi], ['Araç', ARAC.ad], ['Kütle', `${sayi(o.kutle_kg, 1)} kg → ağırlık ${sayi(o.agirlik_N, 1)} N`],
    ['En büyük itki', `${sayi(o.maksItki_N, 1)} N`], ['İtki / ağırlık', sayi(o.itkiAgirlikOrani, 2)],
    roket ? ['Hız değişimi bütçesi (Δv)', `${sayi(o.deltaV_m_s, 0)} m/s`] : ['Askıda kalma gücü', `${sayi(o.askidaGuc_W, 0)} W`],
    ['Askıda kalma süresi', `${sayi(o.askidaKalmaSuresi_s / 60, 1)} dakika`],
  ];
  if (!roket && o.ucMach) bilgi.push(['Rotor ucu / ses hızı (Mach)', sayi(o.ucMach, 2) + (o.ucMach > 0.8 ? ' ⚠ çok yüksek' : '')]);
  if (ORT.atm) {
    const sa = GOREV.atmosfer.saat, b = GOREV._atmosfer.bilgi;
    bilgi.push(['Atmosfer', `🛰 veri modeli: ${b.ad ?? GOREV.atmosfer.model}`], ['Başlangıç saati (yerel)', `${String(Math.floor(sa)).padStart(2, '0')}:${String(Math.round(sa % 1 * 60)).padStart(2, '0')}`],
      ['O saatte', `p = ${sayi(ORT.atm.p, 0)} Pa · T = ${sayi(ORT.atm.T - 273.15, 0)} °C · rüzgâr ${sayi(ORT.atm.ruzgarHiz, 1)} m/s`], ['Modelin kaynağı', b.kaynak ?? '—']);
  }
  const ucar = o.ucabilir
    ? `<div class="durumKutu iyi">✓ Bu araç burada uçabilir: itkisi ağırlığının ${sayi(o.itkiAgirlikOrani, 1)} katı.</div>`
    : `<div class="durumKutu kotu">✗ Bu araç burada kalkamaz: itki/ağırlık oranı ${sayi(o.itkiAgirlikOrani, 2)}. Kalkmak için 1'den büyük olmalı. ${!roket && ORT.rho0 <= 0 ? 'Burada hava yok; rotor işe yaramaz, roket gerekir.' : roket ? 'Daha güçlü motor ya da daha hafif araç dene.' : 'Rotor alanını ya da uç hızını büyüt, kütleyi azalt.'}</div>`;
  $('girisKart').innerHTML = `
    <div class="soluk">${ZORLUK[GOREV.zorluk ?? 1] ?? ''}</div>
    <h2>${GOREV.baslik}</h2>
    <p>${GOREV.hikaye ?? ''}</p>
    ${GOREV.gercekGorev ? `<p class="soluk">🛰 Gerçek dünyada: ${GOREV.gercekGorev}</p>` : ''}
    <h3>Bilim notu</h3><p>${GOREV.bilimNotu ?? ''}</p>
    <h3>Ortam ve araç</h3><div class="izgara">${bilgi.map(([a, b]) => `<div><span class="soluk">${a}</span><span>${b}</span></div>`).join('')}</div>
    ${ucar}
    ${ORT.atm && /ALIŞTIRMA/i.test(GOREV._atmosfer.bilgi.kaynak ?? '') ? '<div class="durumKutu kotu">⚠ Bu atmosfer modeli ALIŞTIRMA verisiyle eğitilmiş: gerçek ölçüm değildir. Gerçek MEDA verisiyle yeniden eğitin.</div>' : ''}
    <h3>Görev</h3><p>${GOREV.hedefler.length} hedefin her birinde: sarı halkanın içinde, beyaz çizginin altında ve yavaşken bekle. Çubuk dolunca gözlem tamamlanır. Hepsi bitince üsse (H) dön ve yavaşça in.${GOREV.sureSiniri_s > 0 ? ` <b>Süre sınırı: ${sure(GOREV.sureSiniri_s)}.</b>` : ''}</p>
    <h3>Kontroller</h3>
    <div class="tuslar">
      <kbd>W</kbd><span>yüksel (Boşluk da olur)</span><kbd>S</kbd><span>alçal (Shift da olur)</span>
      <kbd>↑ ↓ ← →</kbd><span>ileri, geri, sola, sağa git (kameraya göre)</span>
      <kbd>Q</kbd> <span>kamerayı döndür (ya da fareyle sürükle) · <kbd>E</kbd> ters yöne</span>
      <kbd>C</kbd><span>takip kamerası / tepeden bakış</span>
      <kbd>P</kbd><span>yardımcı pilotu aç/kapa (kapalıyken çok zor!)</span>
      <kbd>R</kbd><span>baştan başla</span><kbd>Esc</kbd><span>duraklat</span>
    </div>
    <button class="dugme" id="basla">Göreve başla</button>`;
  $('basla').onclick = () => { $('giris').hidden = true; basladi = true; duraklat = false; tuval.focus(); };
}
$('yardimDugme').onclick = () => { duraklat = true; girisEkrani(); $('basla').textContent = 'Devam et'; $('giris').hidden = false; };

function sonEkrani() {
  const p = puan(d, GOREV), basari = d.sonuc.tur === 'basari';
  const kalan = roket ? `yakıt %${sayi(d.yakit_kg / ARAC.yakit_kg * 100, 0)}` : `batarya %${sayi(d.enerji_Wh / ARAC.batarya_Wh * 100, 0)}`;
  const rapor = [
    `Görev: ${GOREV.baslik} (${ORT.ad})`,
    `Araç: ${ARAC.ad}`,
    `Sonuç: ${basari ? 'BAŞARILI' : 'BAŞARISIZ'} — ${d.sonuc.mesaj}`,
    `Süre: ${sure(d.zaman)} · Gözlem: ${p.tamamlanan}/${p.toplam} · Kalan ${kalan}`,
    `Uçulan yol: ${sayi(istatistik.mesafe, 0)} m · En yüksek irtifa: ${sayi(istatistik.maksIrtifa, 1)} m`,
    `Pilot: ${yardimciPilot ? 'yardımcı pilot' : 'elle'} · Puan: ${p.puan}`,
    `Tarih: ${new Date().toLocaleString('tr-TR')}`,
  ].join('\n');
  $('sonKart').innerHTML = `
    <h2>${basari ? '🎉 Görev başarılı!' : '💥 Görev başarısız'}</h2>
    <div class="durumKutu ${basari ? 'iyi' : 'kotu'}">${d.sonuc.mesaj}</div>
    <h3>Puan: ${p.puan}</h3>
    <p class="soluk">Her gözlem 100 · başarı 300 · artan ${roket ? 'yakıt' : 'batarya'} en çok 200${GOREV.sureSiniri_s > 0 ? ' · hız bonusu en çok 100' : ''}</p>
    <h3>Uçuş raporu</h3>
    <p class="soluk">Bu satırları kopyala ve takımınızın raporuna (GOREV-TASARIMI.md, "Test sonuçları") yapıştır.</p>
    <textarea readonly id="raporYazi">${rapor}</textarea>
    <button class="dugme" id="tekrar">Tekrar dene</button><button class="dugme ikincil" id="kopyala">Raporu kopyala</button>`;
  $('tekrar').onclick = () => { yenidenBasla(); tuval.focus(); };
  $('kopyala').onclick = async () => {
    try { await navigator.clipboard.writeText(rapor); $('kopyala').textContent = 'Kopyalandı ✓'; }
    catch { $('raporYazi').select(); $('kopyala').textContent = 'Seçildi: Ctrl+C ile kopyala'; }
  };
  $('son').hidden = false;
}

girisEkrani();
requestAnimationFrame(dongu);

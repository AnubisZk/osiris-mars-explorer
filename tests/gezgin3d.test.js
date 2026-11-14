// Mars Pathfinder 3D (app/public/gezgin) — fizik, dil, yapay zekâ ve veri modülleri
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kok = new URL('../app/public/gezgin/', import.meta.url);
const S = await import(new URL('sistemler.js', kok));
const Y = await import(new URL('yz.js', kok));
const { DILLER } = await import(new URL('dil.js', kok));
const V = await import(new URL('veri.js', kok));
const MODEL = JSON.parse(readFileSync(new URL('modeller.json', kok), 'utf8'));

const W = MODEL.drone.kutle_kg * S.SABIT.g;
const CAP = MODEL.drone.rotor_capi_m;

test('hava yoğunluğu ideal gaz yasasıyla Jezero aralığında', () => {
  const h = S.varsayilanHava();
  for (const lst of [6, 9, 14, 20]) {
    const r = S.yogunluk(h.basincPa, S.havaSicakligiC(lst, h));
    assert.ok(r > 0.012 && r < 0.022, `ρ=${r} @${lst}`);
  }
  assert.ok(S.havaSicakligiC(14, h) > S.havaSicakligiC(6, h));
});

test('askıda kalış gücü Ingenuity ≈350 W civarında (momentum teorisi, FM 0,27)', () => {
  const h = S.varsayilanHava();
  for (const lst of [8, 10, 12, 14]) {
    const P = S.rotorGucu({ itkiN: W, rho: S.yogunluk(h.basincPa, S.havaSicakligiC(lst, h)), rotorCapM: CAP });
    assert.ok(P > 300 && P < 380, `P=${P} @${lst}`);
  }
  const tirman = S.rotorGucu({ itkiN: W, rho: 0.017, rotorCapM: CAP, tirmanmaMs: 1 });
  assert.ok(tirman > S.rotorGucu({ itkiN: W, rho: 0.017, rotorCapM: CAP }));
});

test('seyrek havada gereken devir 2700 sınırını aşar', () => {
  assert.ok(S.gerekliDevir({ rho: 0.017 }) < S.ROTOR.DEVIR_MAKS);
  assert.ok(S.gerekliDevir({ rho: 0.0115 }) > S.ROTOR.DEVIR_MAKS);
  assert.ok(S.ucMach(2700, CAP, -40) < 0.8);
});

test('Li-ion kapasitesi: 25 °C 44,4 Wh, 0 °C 38,8 Wh', () => {
  assert.equal(+S.pilKapasitesiWh(25).toFixed(1), 44.4);
  assert.equal(+S.pilKapasitesiWh(0).toFixed(1), 38.8);
  assert.ok(S.pilKapasitesiWh(-30) < 38.8);
});

test('güneş paneli: gece sıfır, toz fırtınası gücü düşürür', () => {
  const h = S.varsayilanHava();
  assert.equal(S.gunesGucu(120, 0, h), 0);
  const ogle = S.gunesGucu(120, 12, h);
  assert.ok(ogle > 80 && ogle < 140, `öğle ${ogle}`);
  assert.ok(S.gunesGucu(120, 12, h, 3.5) < ogle / 2);
});

test('gezgin tekerlek gücü eğimle artar; bağlantı görüş hattına bağlı', () => {
  const duz = S.tekerlekGucu({ kutleKg: MODEL.gezgin.kutle_kg, hizMs: 0.1 });
  assert.ok(duz > 5 && duz < 10, `düz ${duz}`);
  assert.ok(S.tekerlekGucu({ kutleKg: 45, hizMs: 0.1, egimRad: 0.3 }) > duz * 2);
  assert.equal(S.baglantiKalitesi(50, false), 0);
  assert.ok(S.baglantiKalitesi(50, true) > 95);
});

test('fırtına takvimi tohumla tekrarlanabilir', () => {
  const a = Array.from({ length: 50 }, (_, i) => S.firtinaDurumu(i * 400, 7).aktif);
  const b = Array.from({ length: 50 }, (_, i) => S.firtinaDurumu(i * 400, 7).aktif);
  assert.deepEqual(a, b);
  assert.ok(a.includes(true) && a.includes(false));
});

test('ML: RLS enerji modeli fizik modelini öğrenir', () => {
  const m = new Y.EnerjiModeli(), r = Y.rastgele(3);
  for (let i = 0; i < 600; i++) {
    const k = { yatayHiz: r() * 5, dikeyHiz: (r() - 0.5) * 2, rho: 0.014 + r() * 0.006, ruzgar: r() * 8 };
    m.ogren(k, S.rotorGucu({ itkiN: W, rho: k.rho, rotorCapM: CAP, tirmanmaMs: k.dikeyHiz, yatayHizMs: k.yatayHiz }));
  }
  assert.ok(m.hazir);
  const k = { yatayHiz: 4, dikeyHiz: 0, rho: 0.017 };
  const gercek = S.rotorGucu({ itkiN: W, rho: k.rho, rotorCapM: CAP, yatayHizMs: 4 });
  assert.ok(Math.abs(m.tahmin(k) - gercek) / gercek < 0.05);
  const e = m.bacakEnerjisi({ mesafeM: 40, irtifaDegisimM: 5, rho: 0.017 });
  assert.ok(e > 0.5 && e < 2, `bacak ${e} Wh`);
});

test('DL: spektrum sınıflandırıcı ayrı test kümesinde ≥%85', () => {
  const clf = Y.siniflandiriciHazirla();
  assert.ok(clf.dogruluk >= 0.85, `doğruluk ${clf.dogruluk}`);
  const r = Y.rastgele(11);
  for (const s of Y.SINIFLAR) assert.equal(clf.siniflandir(Y.spektrumUret(s, r, 0.01)).sinif, s);
});

test('TR/EN anahtarları birebir aynı ve boş değer yok', () => {
  const tr = Object.keys(DILLER.tr).sort(), en = Object.keys(DILLER.en).sort();
  assert.deepEqual(tr, en);
  for (const d of ['tr', 'en']) for (const [k, v] of Object.entries(DILLER[d])) assert.ok(v && v.trim(), `${d}:${k}`);
});

test('HTML ve oyun kodundaki her data-t / t() anahtarı sözlükte var', () => {
  const html = readFileSync(new URL('index.html', kok), 'utf8'), js = readFileSync(new URL('app.js', kok), 'utf8');
  const anahtarlar = new Set([...html.matchAll(/data-t="([^"]+)"/g)].map((m) => m[1]));
  for (const m of js.matchAll(/\bt\('([a-zA-Z.]+)'/g)) anahtarlar.add(m[1]);
  const eksik = [...anahtarlar].filter((k) => (k.endsWith('.') ? !Object.keys(DILLER.tr).some((x) => x.startsWith(k)) : !(k in DILLER.tr)));
  assert.deepEqual(eksik, []);
});

test('MEDA akışı ayrıştırılır; ulaşılamazsa veri uydurulmaz', async () => {
  const s = V.enSonSol({ sols: [
    { sol: '1000', pressure: '6.9', min_temp: '-80', max_temp: '-20', terrestrial_date: '2024-01-01', atmo_opacity: 'Sunny' },
    { sol: '1001', pressure: '--', min_temp: '-81', max_temp: '-21' }] });
  assert.equal(s.sol, 1000); assert.equal(s.p, 690);
  const h = await V.canliHavaAl({ fetchImpl: async () => { throw new Error('ağ yok'); }, zamanAsimi: 50 });
  assert.equal(h.kaynak, 'cevrimdisi'); assert.ok(h.hata);
  const c = await V.canliHavaAl({ fetchImpl: async () => ({ ok: true, json: async () => ({ sols: [{ sol: 5, pressure: 700, min_temp: -70, max_temp: -10 }] }) }) });
  assert.equal(c.kaynak, 'canli'); assert.equal(c.basincPa, 700);
});

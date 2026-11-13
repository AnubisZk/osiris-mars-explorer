// Görev Kiti (gorev-kiti/): every mission card is flyable and completable by a simple autopilot,
// the physics behaves as documented, the student's default ayarlar.js matches the generator,
// and every AI prompt placeholder resolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GOREVLER, ayarlarDosyasi } from '../gorev-kiti/gorevler.js';
import { KOMUTLAR, ASAMALAR, komutuDoldur, komutlarMd } from '../gorev-kiti/komutlar.js';
import { GEZEGENLER } from '../gorev-kiti/gezegenler.js';
import { aracOzeti, yeniDurum, adim, puan, ortam, maksItki } from '../gorev-kiti/fizik.js';
import { araziKur } from '../gorev-kiti/arazi.js';
import { GOREV as VARSAYILAN } from '../gorev-kiti/ayarlar.js';

const zeminOf = g => araziKur(g.arazi, [{ x: 0, z: 0, yaricap: 14 }, ...g.hedefler.map(h => ({ x: h.x, z: h.z, yaricap: h.yaricap }))]);

// A scripted pilot: climb to 25 m, fly to each target, descend, observe, return and land.
function otopilot(g) {
  const zemin = zeminOf(g), d = yeniDurum(g, zemin), dt = 1 / 120;
  const rota = [...g.hedefler.map((h, i) => ({ x: h.x, z: h.z, i })), { x: 0, z: 0, i: -1 }];
  let k = 0;
  while (!d.sonuc && d.zaman < 900) {
    const w = rota[k], dx = w.x - d.x, dz = w.z - d.z, uzak = Math.hypot(dx, dz);
    const alc = w.i < 0 ? 0 : g.hedefler[w.i].maksIrtifa_m * 0.5, inp = { x: 0, z: 0, y: 0 };
    if (uzak > 8) {
      const s = Math.min(1, uzak / 40); inp.x = dx / uzak * s; inp.z = dz / uzak * s;
      inp.y = d.agl < 25 ? Math.min(1, (25 - d.agl) / 5) : -Math.min(1, (d.agl - 25) / 5);
      if (uzak < 60 && d.agl > alc + 3) inp.y = -1;
    } else {
      inp.x = dx / 8 * 0.3; inp.z = dz / 8 * 0.3;
      if (w.i < 0) inp.y = -1; else { inp.y = d.agl > alc ? -0.6 : 0.2; if (d.hedefler[w.i].tamam) k++; }
    }
    adim(d, inp, g, zemin, dt);
  }
  return d;
}

test('every mission card: vehicle can lift off with margin and the autopilot completes the mission', () => {
  assert.equal(Object.keys(GOREVLER).length, 7);
  for (const [id, g] of Object.entries(GOREVLER)) {
    assert.equal(g.kimlik, id);
    assert.ok(GEZEGENLER[g.gezegen], `${id}: planet`);
    const o = aracOzeti(g);
    assert.ok(o.itkiAgirlikOrani >= 1.5, `${id}: T/W ${o.itkiAgirlikOrani}`);
    if (g.arac.tip === 'rotor') {
      assert.ok(ortam(g).rho0 > 0, `${id}: rotor needs air`);
      assert.ok(o.ucMach < 0.8, `${id}: tip Mach ${o.ucMach}`);
    }
    const d = otopilot(g);
    assert.equal(d.sonuc?.tur, 'basari', `${id}: ${d.sonuc?.mesaj}`);
    assert.ok(puan(d, g).puan >= 600, `${id}: score`);
  }
});

test('physics: Ingenuity-like hover power is near the published ~350 W; Mars thrust scales with density', () => {
  const o = aracOzeti(GOREVLER.jezero);
  assert.ok(o.askidaGuc_W > 250 && o.askidaGuc_W < 400, `${o.askidaGuc_W} W`);
  const a = GOREVLER.jezero.arac;
  assert.ok(Math.abs(maksItki(a, 1.225) / maksItki(a, 0.020) - 1.225 / 0.020) < 1e-9);
});

test('physics: a rotor on an airless world cannot lift off and the game says why', () => {
  const g = structuredClone(GOREVLER.jezero); g.gezegen = 'ay';
  assert.equal(aracOzeti(g).ucabilir, false);
  const zemin = zeminOf(g), d = yeniDurum(g, zemin);
  for (let i = 0; i < 240 && !d.sonuc; i++) adim(d, { x: 0, z: 0, y: 1 }, g, zemin, 1 / 120);
  assert.equal(d.sonuc?.tur, 'enerji'); assert.match(d.sonuc.mesaj, /hava yok/);
});

test('physics: dropping from height without thrust is a crash; the soft-landing helper lands gently', () => {
  const g = GOREVLER.ankara, zemin = zeminOf(g);
  const d = yeniDurum(g, zemin); d.y += 20; d.yerde = false; d.enerji_Wh = 0;
  while (!d.sonuc) adim(d, { x: 0, z: 0, y: 0 }, g, zemin, 1 / 120);
  assert.equal(d.sonuc.tur, 'kaza');
  const e = yeniDurum(g, zemin); e.y += 20; e.yerde = false;
  for (let i = 0; i < 120 * 30 && !e.yerde; i++) adim(e, { x: 0, z: 0, y: -1 }, g, zemin, 1 / 120);
  assert.equal(e.yerde, true); assert.equal(e.sonuc, null);
});

test('physics: rocket fuel use follows T/(Isp·g0); time limit ends the mission', () => {
  const g = GOREVLER['ay-guney'], zemin = zeminOf(g), d = yeniDurum(g, zemin);
  for (let i = 0; i < 120 * 10; i++) adim(d, { x: 0, z: 0, y: 0.5 }, g, zemin, 1 / 120);
  assert.ok(d.yakit_kg < g.arac.yakit_kg && d.yakit_kg > 0);
  const t = GOREVLER['toz-firtinasi'], z2 = zeminOf(t), s = yeniDurum(t, z2);
  while (!s.sonuc) adim(s, { x: 0, z: 0, y: 0 }, t, z2, 1 / 30);
  assert.equal(s.sonuc.tur, 'zaman'); assert.match(s.sonuc.mesaj, /fırtına/);
});

test('ayarlar.js: the kit default is the Jezero card exactly as the generator writes it', () => {
  const metin = readFileSync(new URL('../gorev-kiti/ayarlar.js', import.meta.url), 'utf8');
  assert.equal(metin, ayarlarDosyasi(GOREVLER.jezero));
  assert.deepEqual(VARSAYILAN, GOREVLER.jezero);
});

test('ayarlar.js generator round-trips every mission', async () => {
  for (const g of Object.values(GOREVLER)) {
    const url = 'data:text/javascript;base64,' + Buffer.from(ayarlarDosyasi(g)).toString('base64');
    const { GOREV } = await import(url);
    assert.deepEqual(GOREV, g, g.kimlik);
  }
});

test('prompts: every stage has prompts, every placeholder resolves, KOMUTLAR.md is current', () => {
  for (const a of ASAMALAR) assert.ok(KOMUTLAR.some(k => k.asama === a.no), `stage ${a.no}`);
  for (const g of Object.values(GOREVLER)) {
    const c = { ...g, _g: '3,71' };
    for (const k of KOMUTLAR) assert.doesNotMatch(komutuDoldur(k.metin, c, ortam(g).ad), /\{\w+\}/, `${g.kimlik}/${k.baslik}`);
  }
  assert.equal(readFileSync(new URL('../gorev-kiti/KOMUTLAR.md', import.meta.url), 'utf8'), komutlarMd());
});

test('hesap.js: the verification report uses the same numbers as the game engine, for every mission', async () => {
  const { hesapla, hesapRaporu, rota } = await import('../gorev-kiti/hesap.js');
  for (const g of Object.values(GOREVLER)) {
    const h = hesapla(g), o = aracOzeti(g);
    assert.equal(h.ozet.agirlik_N, o.agirlik_N);
    assert.equal(h.ozet.askidaKalmaSuresi_s, o.askidaKalmaSuresi_s);
    const r = rota(g);
    assert.equal(r.ayaklar.length, g.hedefler.length + 1);
    assert.ok(Math.abs(r.toplam - r.ayaklar.reduce((t, a) => t + Math.hypot(a.dx, a.dz), 0)) < 1e-9);
    assert.ok(h.butceOrani > 0 && h.butceOrani < 1, `${g.kimlik}: every mission card fits its own budget (${h.butceOrani})`);
    const md = hesapRaporu(g);
    assert.doesNotMatch(md, /NaN|undefined|Infinity/, g.kimlik);
    assert.match(md, g.arac.tip === 'roket' ? /Δv = / : /v_i = √/);
  }
  // Rotor indüced-velocity hover power written out step by step equals fizik.js's rotorGucu at T = W
  const h = hesapla(GOREVLER.jezero), a = GOREVLER.jezero.arac;
  assert.ok(Math.abs(h.ozet.agirlik_N * h.vi / a.rotorVerimi + a.avyonikGucu_W - h.ozet.askidaGuc_W) < 1e-9);
});

test('kit ships the agent rules, the calculation notebook and the stage-0 prompts', () => {
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'FIZIK-HESAPLARI.md', 'hesap.html', 'hesapla.mjs'])
    assert.ok(readFileSync(new URL(`../gorev-kiti/${f}`, import.meta.url), 'utf8').length > 50, f);
  assert.equal(ASAMALAR[0].no, 0);
  assert.ok(KOMUTLAR.filter(k => k.asama === 0).length >= 2);
});

test('transparency: every prepared prompt has a stable code; agents must log prompts verbatim in KOMUT-KAYDI.md', async () => {
  const { komutBasligi } = await import('../gorev-kiti/komutlar.js');
  const kodlar = KOMUTLAR.map(k => k.kod);
  assert.equal(new Set(kodlar).size, kodlar.length);
  assert.ok(kodlar.every(k => /^K\d+\.\d+$/.test(k)));
  assert.match(komutBasligi(KOMUTLAR[0]), /^\[Hazır komut K0\.1 · /);
  const agents = readFileSync(new URL('../gorev-kiti/AGENTS.md', import.meta.url), 'utf8');
  assert.match(agents, /KOMUT-KAYDI\.md/); assert.match(agents, /kelimesi kelimesine/);
  assert.match(KOMUTLAR.find(k => k.kod === 'K0.1').metin, /KOMUT-KAYDI\.md'ye kelimesi kelimesine kaydet/);
  assert.match(readFileSync(new URL('../gorev-kiti/KOMUT-KAYDI.md', import.meta.url), 'utf8'), /## Kayıtlar/);
});

test('atmosfer.js: least squares recovers a known daily cycle; ρ = p/(R·T); the game physics uses the model', async () => {
  const { egit, hesapla, atmosferModeli, atmosferiBagla } = await import('../gorev-kiti/atmosfer.js');
  const gercek = t => 730 + 10 * Math.cos(2 * Math.PI * t / 24) - 4 * Math.sin(4 * Math.PI * t / 24);
  const saat = Array.from({ length: 480 }, (_, i) => i * 0.05);
  const m = egit(saat, saat.map(gercek), 2);
  assert.ok(Math.abs(m.k[0] - 730) < 1e-6 && Math.abs(m.k[1] - 10) < 1e-6 && Math.abs(m.k[4] + 4) < 1e-6);
  assert.ok(m.rmse < 1e-6 && m.r2 > 0.999999);
  assert.ok(Math.abs(hesapla(m.k, 6) - gercek(6)) < 1e-9);
  assert.throws(() => egit([1, 2, 3], [1, 2, 3], 2), /az ölçüm/);

  // Constant model p = 700 Pa, T = 200 K on Mars → ρ = 700 / (191.8 × 200)
  const sabit = v => ({ k: [v, 0, 0] });
  const json = { ad: 'test', gezegen: 'mars', kaynak: 'test', basinc_Pa: sabit(700), sicaklik_K: sabit(200), ruzgarDogu_m_s: sabit(3), ruzgarKuzey_m_s: sabit(0) };
  const model = atmosferModeli(json, GEZEGENLER.mars.gazSabiti_J_kgK);
  assert.ok(Math.abs(model(10).rho - 700 / (191.8 * 200)) < 1e-12);

  const g = structuredClone(GOREVLER.jezero); g.atmosfer = { model: 'veri/test.json', saat: 9 };
  await atmosferiBagla(g, async () => json, GEZEGENLER.mars.gazSabiti_J_kgK);
  assert.ok(Math.abs(ortam(g).rho0 - 700 / (191.8 * 200)) < 1e-12);
  assert.ok(Math.abs(aracOzeti(g).maksItki_N / aracOzeti(GOREVLER.jezero).maksItki_N - ortam(g).rho0 / 0.020) < 1e-9);
  const d = otopilot(g);
  assert.equal(d.sonuc?.tur, 'basari', d.sonuc?.mesaj);
  const json2 = { ...json, gezegen: 'titan' };
  await assert.rejects(atmosferiBagla(structuredClone(g), async () => json2, 191.8), /titan/);
});

test('ayarlar.js generator writes the optional atmosfer line, commented by default', async () => {
  assert.match(ayarlarDosyasi(GOREVLER.jezero), /\/\/ atmosfer: \{ model: 'veri\/jezero-atmosfer\.json', saat: 10 \},/);
  const g = { ...GOREVLER.jezero, atmosfer: { model: 'veri/x.json', saat: 7.5 } };
  const { GOREV } = await import('data:text/javascript;base64,' + Buffer.from(ayarlarDosyasi(g)).toString('base64'));
  assert.deepEqual(GOREV.atmosfer, { model: 'veri/x.json', saat: 7.5 });
});

test('atmosfer.js: held-out evaluation exposes overfitting that the training error hides', async () => {
  const { egit, degerlendir } = await import('../gorev-kiti/atmosfer.js');
  let t = 3; const r = () => ((t = (t * 16807) % 2147483647) / 2147483647) - 0.5;
  const gercek = h => 730 + 10 * Math.cos(2 * Math.PI * h / 24);
  const egitimSaat = Array.from({ length: 40 }, () => (r() + 0.5) * 24), testSaat = Array.from({ length: 400 }, (_, i) => i * 0.06);
  const egitimY = egitimSaat.map(h => gercek(h) + r() * 6), testY = testSaat.map(h => gercek(h) + r() * 6);
  const az = egit(egitimSaat, egitimY, 1), cok = egit(egitimSaat, egitimY, 4);
  assert.ok(cok.rmse <= az.rmse, 'more harmonics never raise the training error');
  const tAz = degerlendir(az.k, testSaat, testY), tCok = degerlendir(cok.k, testSaat, testY);
  assert.ok(tCok.rmse > cok.rmse, 'test error is worse than training error for the flexible model');
  assert.ok(tAz.rmse < tCok.rmse, 'on unseen data the simpler (correct) model wins');
  assert.ok(tAz.n === 400 && Number.isFinite(tAz.r2));
});

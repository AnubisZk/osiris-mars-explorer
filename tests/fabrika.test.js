// Görev Fabrikası: sizing model, stress test, optimizer, AI prompt parsing, report and the
// rule that student work is never deleted or overwritten.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOREVLER, ayarlarDosyasi } from '../gorev-kiti/gorevler.js';
import * as T from '../gorev-kiti/tasarim.js';
import * as S from '../gorev-kiti/stres.js';
import * as O from '../gorev-kiti/optimize.js';
import * as F from '../gorev-kiti/fabrika.js';
import { otopilotlaUc } from '../gorev-kiti/otopilot.js';
import { atmosferModeli } from '../gorev-kiti/atmosfer.js';
import { GEZEGENLER } from '../gorev-kiti/gezegenler.js';

const INGENUITY_BENZERI = { tip: 'rotor', rotorSayisi: 2, yaricap_m: 0.6, ucHizi_m_s: 150, batarya_Wh: 30, bataryaTipi: 'liion', yapiMalzemesi: 'karbon', kanatMalzemesi: 'karbon', maksEgim_derece: 20 };
const gr = id => T.varsayilanGereksinim(GOREVLER[id]);

test('sizing loop converges; an Ingenuity-like design lands near the real mass and passes', () => {
  const e = T.degerlendir(gr('jezero'), INGENUITY_BENZERI);
  assert.ok(e.kutle_kg > 1.4 && e.kutle_kg < 2.0, `mass ${e.kutle_kg}`);       // Ingenuity ≈ 1.8 kg
  const toplam = Object.values(e.parcalar).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(toplam - e.kutle_kg) / e.kutle_kg < 0.01, 'breakdown sums to total');
  assert.ok(e.uygun, e.sorunlar.join('; '));
  assert.equal(e.arac.kutle_kg, e.kutle_kg);
});

test('weaker materials cost mass; PLA makes the same design unflyable', () => {
  const m = k => T.degerlendir(gr('jezero'), { ...INGENUITY_BENZERI, yapiMalzemesi: k });
  assert.ok(m('aluminyum').kutle_kg > m('karbon').kutle_kg);
  assert.ok(!m('pla').uygun);
  assert.ok(m('pla').ozet.itkiAgirlikOrani < 1.5);
});

test('rocket design: mass budget includes engine, tank, structure and fuel', () => {
  const e = T.degerlendir(gr('ay-guney'), { tip: 'roket', yakit_kg: 40, maksItki_N: 900, motorTipi: 'bi', yapiMalzemesi: 'aluminyum' });
  assert.equal(e.arac.tip, 'roket');
  assert.ok(Math.abs(e.arac.kuruKutle_kg + e.arac.yakit_kg - e.kutle_kg) < 1e-9);
  assert.ok(e.parcalar['Yakıt'] === 40);
  assert.equal(gr('ay-guney').minItkiAgirlik, 2.5);
});

test('designed vehicle is a valid game vehicle: generated ayarlar.js parses and the autopilot completes it', async () => {
  const e = T.degerlendir(gr('jezero'), INGENUITY_BENZERI);
  const g = F.oyunGorevi(GOREVLER.jezero, e.arac, { baslik: 'Test tasarımı' });
  assert.equal(g.kimlik, 'fabrika');
  const metin = ayarlarDosyasi(g);
  const mod = await import('data:text/javascript;base64,' + Buffer.from(metin).toString('base64'));
  assert.deepEqual(mod.GOREV.arac, g.arac);
  assert.equal(otopilotlaUc(g, { dt: 1 / 60 }).sonuc.tur, 'basari');
});

test('Wilson interval behaves', () => {
  const [a, b] = S.wilson(46, 50);
  assert.ok(a < 0.92 && b > 0.92 && a > 0.75 && b < 1);
  assert.deepEqual(S.wilson(0, 0), [0, 1]);
  assert.ok(S.wilson(500, 500)[0] > S.wilson(50, 50)[0]);
});

test('stress test is reproducible and separates good from bad designs', async () => {
  const iyi = T.degerlendir(gr('jezero'), INGENUITY_BENZERI).gorev;
  const k1 = await S.stresTesti(iyi, { n: 8, bekle: async () => {} });
  const k2 = await S.stresTesti(iyi, { n: 8, bekle: async () => {} });
  assert.deepEqual(k1.toplam, k2.toplam, 'same seed → same result');
  assert.ok(k1.toplam.oran >= 0.9, `good design ${k1.toplam.oran}`);
  const kotu = T.degerlendir(gr('jezero'), { ...INGENUITY_BENZERI, yaricap_m: 0.3, batarya_Wh: 15, bataryaTipi: 'lipo', yapiMalzemesi: 'aluminyum', rotorSayisi: 4, ucHizi_m_s: 120 }).gorev;
  const k3 = await S.stresTesti(kotu, { n: 6, bekle: async () => {} });
  assert.ok(k3.toplam.oran < 0.2, `bad design ${k3.toplam.oran}`);
  assert.ok(Object.keys(k3.nedenler).length > 0);
});

test('stress uncertainty comes from the digital-twin test error when available', () => {
  const sabit = v => ({ k: [v, 0, 0] });
  const json = { ad: 't', gezegen: 'mars', basinc_Pa: sabit(700), sicaklik_K: sabit(200), ruzgarDogu_m_s: sabit(3), ruzgarKuzey_m_s: sabit(0),
    hata: { basinc_Pa: { test: { rmse: 7 } }, sicaklik_K: { test: { rmse: 4 } }, ruzgarDogu_m_s: { test: { rmse: 3 } }, ruzgarKuzey_m_s: { test: { rmse: 4 } } } };
  const g = structuredClone(GOREVLER.jezero); g.atmosfer = { model: 'veri/t.json', saat: 10 };
  Object.defineProperty(g, '_atmosfer', { value: atmosferModeli(json, GEZEGENLER.mars.gazSabiti_J_kgK), enumerable: false });
  const b = S.belirsizlik(g);
  assert.ok(Math.abs(b.yogunlukSapma - Math.hypot(0.01, 0.02)) < 1e-12);
  assert.equal(b.ruzgarSapma_m_s, 5);
  assert.match(b.kaynak, /test hatası/);
  assert.match(S.belirsizlik(GOREVLER.jezero).kaynak, /varsayılan/);
});

test('optimizer finds a lighter design that satisfies every rule; picks rockets where there is no air', () => {
  const g = gr('jezero');
  const o = O.optimizeEt(g, { tohumlar: [INGENUITY_BENZERI], nesil: 25 });
  assert.ok(o.adaylar.length > 0);
  assert.ok(o.adaylar[0].e.uygun);
  assert.ok(o.adaylar[0].e.kutle_kg <= T.degerlendir(g, INGENUITY_BENZERI).kutle_kg + 1e-9);
  assert.equal(O.uygunTip(GOREVLER.europa), 'roket');
  assert.equal(O.uygunTip(GOREVLER.titan), 'rotor');
});

test('autonomous loop: optimise → stress test → passes on Mars', async () => {
  const r = await O.otonomTasarim(gr('jezero'), { n: 8, bekle: async () => {} });
  assert.ok(r.basarili);
  assert.ok(r.stres.toplam.oran >= 0.9);
});

test('AI prompt lists every variable; replies are parsed and clamped', () => {
  const k = F.yzKomutu(gr('jezero'), 'rotor');
  for (const a of Object.keys(O.ARALIK.rotor)) assert.ok(k.includes(a), a);
  assert.doesNotMatch(k, /undefined|NaN/);
  const c = F.yzCevabiniOku('İşte: {"rotorSayisi":3,"yaricap_m":9,"ucHizi_m_s":150,"batarya_Wh":30,"bataryaTipi":"nükleer","yapiMalzemesi":"karbon","kanatMalzemesi":"karbon"} çünkü...', 'rotor');
  assert.equal(c.tasarim.yaricap_m, O.ARALIK.rotor.yaricap_m[1]);
  assert.equal(c.tasarim.rotorSayisi, 2);
  assert.equal(c.tasarim.bataryaTipi, 'liion');
  assert.deepEqual(c.duzeltilen.sort(), ['bataryaTipi', 'rotorSayisi', 'yaricap_m']);
  assert.deepEqual(c.eksik, ['maksEgim_derece']);
  assert.throws(() => F.yzCevabiniOku('JSON yok', 'rotor'), /JSON/);
});

test('report contains every section and the verbatim AI prompt', () => {
  const g = gr('jezero'), e = T.degerlendir(g, INGENUITY_BENZERI);
  const r = F.tasarimRaporu({ gereksinim: g, tasarim: INGENUITY_BENZERI, degerlendirme: e, kaynak: 'test', yz: { arac: 'Claude', komut: 'KOMUT METNİ', duzeltilen: [], eksik: [] },
    optimizasyon: ['Tur 1'], maliyet: { ad: 'x', usd_kg: 1000, kaynak: 'y' }, sim: { mesaj: 'ok', zaman: 60, kalan: 0.5, puan: 700 }, stres: null });
  for (const b of ['1. Sistem', '2. Cihaz', '3. Yollama', '4. Simülasyon', '6. Oyun', 'Takımın kontrolü', 'KOMUT METNİ']) assert.ok(r.includes(b), b);
  assert.doesNotMatch(r, /undefined|NaN/);
});

test('student work is never deleted: the design archive only grows, a full store loses nothing', () => {
  const kutu = new Map();
  const depo = { getItem: k => kutu.get(k) ?? null, setItem: (k, v) => kutu.set(k, String(v)) };
  for (let i = 0; i < 5; i++) assert.ok(F.arsiveEkle(depo, { gorev: { baslik: `T${i}` } }).tamam);
  assert.deepEqual(F.arsiv(depo).map(k => k.no), [1, 2, 3, 4, 5]);
  F.oyundaAc(depo, { baslik: 'oyna' });
  assert.equal(F.arsiv(depo).length, 5, 'opening a game does not touch the archive');
  const dolu = { getItem: depo.getItem, setItem: () => { throw new Error('QuotaExceededError'); } };
  const r = F.arsiveEkle(dolu, { gorev: { baslik: 'T6' } });
  assert.equal(r.tamam, false);
  assert.equal(F.arsiv(depo).length, 5, 'nothing removed when storage is full');
});

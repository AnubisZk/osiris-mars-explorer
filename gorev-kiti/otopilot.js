// ============================================================================
//  OTOPİLOT — görevi kendi kendine uçan basit bir otonom pilot
//
//  Görev Fabrikası'nın stres testi bir tasarımı yüzlerce kez uçurur; bunu bir insan
//  yapamaz. Bu pilot, gerçek bir otonom araç gibi şunu yapar:
//    1. 25 m seyir yüksekliğine tırman
//    2. sıradaki hedefe yönel, yaklaşınca yavaşla ve alçal
//    3. gözlem tamamlanana kadar hedefin üstünde bekle
//    4. bütün hedeflerden sonra üsse dön ve in
//  Pilot oyunun kendi fizik motorunu (fizik.js) kullanır; hileli değildir.
// ============================================================================

import { yeniDurum, adim } from './fizik.js';
import { araziKur } from './arazi.js';
import { USS_YARICAPI } from './fizik.js';

export function gorevArazisi(g) {
  return araziKur(g.arazi, [{ x: 0, z: 0, yaricap: USS_YARICAPI + 4 }, ...g.hedefler.map(h => ({ x: h.x, z: h.z, yaricap: h.yaricap ?? 15 }))]);
}

// Bir görevi baştan sona uçurur. dt: fizik adımı (s). zemin verilmezse görevin arazisi kurulur.
// iz: bir dizi verilirse yarım saniyede bir {t, x, z, agl, enerji} kaydı eklenir (grafik için).
export function otopilotlaUc(g, { dt = 1 / 120, zemin = gorevArazisi(g), maksSure = 900, seyir = 25, iz = null } = {}) {
  const d = yeniDurum(g, zemin);
  const rota = [...g.hedefler.map((h, i) => ({ x: h.x, z: h.z, i })), { x: 0, z: 0, i: -1 }];
  let k = 0;
  while (!d.sonuc && d.zaman < maksSure) {
    const w = rota[k], dx = w.x - d.x, dz = w.z - d.z, uzak = Math.hypot(dx, dz);
    const alc = w.i < 0 ? 0 : (g.hedefler[w.i].maksIrtifa_m ?? 15) * 0.5, inp = { x: 0, z: 0, y: 0 };
    if (uzak > 8) {
      const s = Math.min(1, uzak / 40); inp.x = dx / uzak * s; inp.z = dz / uzak * s;
      inp.y = d.agl < seyir ? Math.min(1, (seyir - d.agl) / 5) : -Math.min(1, (d.agl - seyir) / 5);
      if (uzak < 60 && d.agl > alc + 3) inp.y = -1;
    } else {
      inp.x = dx / 8 * 0.3; inp.z = dz / 8 * 0.3;
      if (w.i < 0) inp.y = -1;
      else { inp.y = d.agl > alc ? -0.6 : 0.2; if (d.hedefler[w.i].tamam) k++; }
    }
    adim(d, inp, g, zemin, dt);
    if (iz && d.zaman - (iz.at(-1)?.t ?? -1) >= 0.5) iz.push({ t: d.zaman, x: d.x, z: d.z, agl: d.agl, enerji: g.arac.tip === 'roket' ? d.yakit_kg / g.arac.yakit_kg : d.enerji_Wh / g.arac.batarya_Wh });
  }
  if (!d.sonuc) d.sonuc = { tur: 'zaman', mesaj: 'Otopilot görevi zamanında bitiremedi.' };
  return d;
}

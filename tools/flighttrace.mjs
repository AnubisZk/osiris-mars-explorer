// 5" referans uçuş izi: her 240 Hz fizik adımında tam durum → SHA-256.
// Kullanım: node tools/flighttrace.mjs          → reference/trace-5inch.json ile karşılaştırır (fark varsa çıkış kodu 1)
//           node tools/flighttrace.mjs --write  → referansı yeniden yazar (yalnız bilerek fizik değiştirildiğinde)
// Referans, ZSK-FPV v0.7.0 → Tur 3 boyunca değişmeyen izdir; bu paketteki çekirdekle birebir aynı üretilir.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {FlightPhysics,initializeRapier} from '../src/physics/FlightPhysics.js';
import {FLIGHT} from '../src/physics/config.js';
import {trainingThrottle} from '../src/controllers/TrainingThrottle.js';
await initializeRapier();
const out = {};
const state = (f) => [f.position.x, f.position.y, f.position.z, f.rotation.x, f.rotation.y, f.rotation.z, f.rotation.w,
  f.velocity.x, f.velocity.y, f.velocity.z, ...Object.values(f.body.angvel()), ...f.motorOmega, ...f.motorThrust, f.health, f.contacts, f.crashes, f.respawnIn, +f.armed, f.collective ?? 0].join(',');
function run(name, setup, input, steps) {
  const f = new FlightPhysics([0, 0.2, 0], 0);
  const h = createHash('sha256');
  try {
    setup(f);
    for (let i = 0; i < steps; i++) { f.step(FLIGHT.fixedDt, input(i * FLIGHT.fixedDt, f)); h.update(state(f)); }
    out[name] = h.digest('hex').slice(0, 16) + ' @ ' + [f.position.x, f.position.y, f.position.z].map((v) => v.toFixed(4)).join(',');
  } finally { f.dispose(); }
}
const wave = (t, a, w) => a * Math.sin(w * t);
run('angle-soft', (f) => { f.controller.profile = 'soft'; f.toggleArm(0); },
  (t) => ({ throttle: t < 1 ? 0.2 : 0.11 + wave(t, 0.03, 1.3), pitch: wave(t, 0.6, 0.9), roll: wave(t, 0.5, 1.7), yaw: wave(t, 0.4, 0.5) }), 240 * 6);
run('acro-sport', (f) => { f.controller.profile = 'sport'; f.controller.setMode('ACRO'); f.toggleArm(0); },
  (t) => ({ throttle: t < 0.8 ? 0.3 : 0.18, pitch: t > 1 && t < 1.4 ? 1 : 0, roll: t > 2 && t < 2.5 ? -1 : wave(t, 0.2, 3), yaw: wave(t, 0.3, 2) }), 240 * 4);
run('training', (f) => { f.controller.profile = 'soft'; f.toggleArm(0); },
  (t) => ({ throttle: 0, verticalCommand: t < 2 ? 0.6 : t < 3 ? 0 : -0.5, pitch: wave(t, 0.3, 1), roll: 0, yaw: 0 }), 240 * 5);
run('motorstop', (f) => { f.motorStop = true; f.controller.profile = 'sport'; f.toggleArm(0); },
  (t) => ({ throttle: t < 1.5 ? 0.25 : t < 2 ? 0 : 0.2, pitch: 0, roll: wave(t, 0.4, 2), yaw: 0 }), 240 * 3);
run('wall-damage', (f) => { f.addBox([0, 0, -4], [8, 40, 0.2]); f.collisionMode = 'damage'; f.controller.profile = 'sport'; f.toggleArm(0); },
  (t) => ({ throttle: t < 0.6 ? 0.3 : 0.16, pitch: t > 0.6 ? 0.9 : 0, roll: 0, yaw: 0 }), 240 * 4);
run('wall-respawn', (f) => { f.addBox([0, 0, -4], [8, 40, 0.2]); f.collisionMode = 'respawn'; f.controller.profile = 'sport'; f.toggleArm(0); },
  (t) => ({ throttle: t < 0.6 ? 0.3 : 0.16, pitch: t > 0.6 ? 1 : 0, roll: 0, yaw: 0 }), 240 * 4);
const h2 = createHash('sha256');
for (let u = -1; u <= 1; u += 0.05) for (let v = -6; v <= 6; v += 0.5) h2.update(String(trainingThrottle(u, v, { x: 0.05, y: 0, z: 0.02, w: 0.998 })));
out.trainingThrottle = h2.digest('hex').slice(0, 16);
const refPath = fileURLToPath(new URL('../reference/trace-5inch.json', import.meta.url));
if (process.argv.includes('--write')) { writeFileSync(refPath, JSON.stringify(out, null, 2) + '\n'); console.log('Referans yazıldı:', refPath); }
else {
  const ref = JSON.parse(readFileSync(refPath, 'utf8')); let bad = 0;
  for (const [k, v] of Object.entries(ref)) { const ok = out[k] === v; if (!ok) bad++; console.log(`${ok ? 'AYNI ' : 'FARKLI'} ${k}  ${out[k]}${ok ? '' : `  (referans ${v})`}`); }
  console.log(bad ? `\n${bad} iz farklı: fizik davranışı değişti.` : '\n5" uçuş izi referansla birebir aynı.'); process.exit(bad ? 1 : 0);
}

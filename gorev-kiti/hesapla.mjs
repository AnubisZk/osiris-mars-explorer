// Komut satırından görevin fizik hesaplarını yazdırır (Node.js 18 ya da üstü):
//   node hesapla.mjs            → ayarlar.js'teki görev
//   node hesapla.mjs titan      → hazır görevlerden biri (gorevler.js)
//   node hesapla.mjs > HESAP-RAPORU.md   → raporu dosyaya kaydet
import { GOREV } from './ayarlar.js';
import { GOREVLER } from './gorevler.js';
import { hesapRaporu } from './hesap.js';
import { atmosferiBagla } from './atmosfer.js';
import { GEZEGENLER } from './gezegenler.js';
import { readFile } from 'node:fs/promises';

const ad = process.argv[2];
if (ad && !GOREVLER[ad]) {
  console.error(`Bilinmeyen görev: ${ad}. Seçenekler: ${Object.keys(GOREVLER).join(', ')}`);
  process.exit(1);
}
const gorev = ad ? GOREVLER[ad] : GOREV;
await atmosferiBagla(gorev, async yol => JSON.parse(await readFile(new URL(yol, import.meta.url), 'utf8')), GEZEGENLER[gorev.gezegen]?.gazSabiti_J_kgK);
process.stdout.write(hesapRaporu(gorev));

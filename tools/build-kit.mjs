// Görev Kiti'ni siteye hazırlar (npm run build bunu vite'tan önce çalıştırır):
//  1. gorev-kiti/KOMUTLAR.md dosyasını komutlar.js'ten yeniden üretir
//  2. gorev-kiti/ klasörünü app/public/atolye/kit/ altına kopyalar (canlı demo)
//  3. app/public/atolye/gorev-kiti.zip dosyasını yazar (öğrencilerin indireceği kit)
// Ek bağımlılık yok: zip, Node'un zlib modülüyle yazılır.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const kaynak = join(kok, 'gorev-kiti');
const hedef = join(kok, 'app/public/atolye/kit');
const zipYolu = join(kok, 'app/public/atolye/gorev-kiti.zip');

const { komutlarMd } = await import(pathToFileURL(join(kaynak, 'komutlar.js')).href);
writeFileSync(join(kaynak, 'KOMUTLAR.md'), komutlarMd());

function dosyalar(klasor) {
  return readdirSync(klasor).sort().flatMap(ad => {
    const yol = join(klasor, ad);
    return statSync(yol).isDirectory() ? dosyalar(yol) : [yol];
  });
}
const liste = dosyalar(kaynak);

rmSync(hedef, { recursive: true, force: true });
for (const yol of liste) {
  const cikti = join(hedef, relative(kaynak, yol));
  mkdirSync(dirname(cikti), { recursive: true });
  writeFileSync(cikti, readFileSync(yol));
}

// ---- en basit zip: her dosya için yerel başlık + veri, sonda merkez dizin
const parcalar = [], merkez = [];
let konum = 0;
const zaman = new Date(), dosTarih = ((zaman.getFullYear() - 1980) << 9) | ((zaman.getMonth() + 1) << 5) | zaman.getDate();
const dosSaat = (zaman.getHours() << 11) | (zaman.getMinutes() << 5) | (zaman.getSeconds() >> 1);
for (const yol of liste) {
  const ad = Buffer.from('gorev-kiti/' + relative(kaynak, yol).split('\\').join('/'), 'utf8');
  const veri = readFileSync(yol), sikis = deflateRawSync(veri, { level: 9 }), crc = crc32(veri);
  const yerel = Buffer.alloc(30);
  yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(0x0800, 6); // UTF-8 dosya adı
  yerel.writeUInt16LE(8, 8); yerel.writeUInt16LE(dosSaat, 10); yerel.writeUInt16LE(dosTarih, 12);
  yerel.writeUInt32LE(crc, 14); yerel.writeUInt32LE(sikis.length, 18); yerel.writeUInt32LE(veri.length, 22);
  yerel.writeUInt16LE(ad.length, 26); yerel.writeUInt16LE(0, 28);
  parcalar.push(yerel, ad, sikis);
  const m = Buffer.alloc(46);
  m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8);
  m.writeUInt16LE(8, 10); m.writeUInt16LE(dosSaat, 12); m.writeUInt16LE(dosTarih, 14);
  m.writeUInt32LE(crc, 16); m.writeUInt32LE(sikis.length, 20); m.writeUInt32LE(veri.length, 24);
  m.writeUInt16LE(ad.length, 28); m.writeUInt32LE(konum, 42);
  merkez.push(m, ad);
  konum += 30 + ad.length + sikis.length;
}
const merkezBuf = Buffer.concat(merkez), son = Buffer.alloc(22);
son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(liste.length, 8); son.writeUInt16LE(liste.length, 10);
son.writeUInt32LE(merkezBuf.length, 12); son.writeUInt32LE(konum, 16);
writeFileSync(zipYolu, Buffer.concat([...parcalar, merkezBuf, son]));
console.log(`Görev Kiti: ${liste.length} dosya → app/public/atolye/kit/ ve gorev-kiti.zip`);

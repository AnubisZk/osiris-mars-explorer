> Bu belge ZSK uçuş çekirdeğinin özgün README'sidir (içeriği değiştirilmeden taşındı). Proje için `../README.md`, Mars katmanı için `../MARS-ILERLEME.md`.

# ZSK uçuş çekirdeği (zsk-flight-core)

ZSK FPV simülatörünün uçuş çekirdeği: Rapier ile 240 Hz sabit adımlı fizik, uçuş
kontrolcüsü (ANGLE / ACRO / KONUM), altı drone türü, kumanda (klavye, standart kumanda,
FPV vericisi), rüzgâr ve batarya. **Çizimden bağımsızdır**: Three.js'ten yalnız matematik
sınıfları (Vector3, Quaternion, Euler) kullanılır; sahne, ağaç, arazi, arayüz yoktur.

Kaynak: ZSK-FPV, commit `309b265` (Tur 3 + altı drone türü). Dosyalar değiştirilmeden alındı.

## Hızlı başlangıç

```bash
npm install
npm run check   # 46 test + 5" referans uçuş izi (hepsi "AYNI" olmalı)
npm run dev     # examples/minimal: kutulardan oluşan bir sahnede uçuş
```

Örnekte: Space motorlar · W/S gaz · H hover · oklar eğim · A/D dönüş · M mod ·
C FPV/takip · R sıfırla · Q motorları kes.

## Klasörler

| Yol | İçerik |
|---|---|
| `src/physics/FlightPhysics.js` | Rapier dünyası, drone gövdesi, itki, sürükleme, çarpışma, batarya, olaylar |
| `src/physics/config.js` | v0.7.0 5" sabitleri, motor karıştırıcı (`mixMotors`), `FixedStepper` |
| `src/physics/Wind.js` | Belirlenimci rüzgâr ve türbülans |
| `src/drone/DroneTypes.js` | Altı drone türünün tanımı |
| `src/drone/FlightController.js` | ANGLE / ACRO / KONUM kontrolcüsü (PID) |
| `src/controllers/*` | Kumanda, eşleme, profiller, eğitim gazı |
| `src/flight/*` | Uçuş kaydı (CSV), hayalet tur (isteğe bağlı) |
| `src/drone/DroneModel.js`, `DroneEffects.js`, `src/audio/MotorSound.js` | İsteğe bağlı görsel model, efektler, ses (fiziği yalnız okur) |
| `tools/flighttrace.mjs`, `reference/trace-5inch.json` | Fizik değişmezlik kontrolü |
| `examples/minimal/` | En küçük entegrasyon örneği |

## Temel döngü

```js
import {FlightPhysics,initializeRapier,FixedStepper,InputManager,getDrone} from 'zsk-flight-core';
await initializeRapier();
const flight=new FlightPhysics([0,.15,0],0,getDrone('freestyle5'));
for(const b of COLLISION)flight.addBox(b.pos,b.half);           // çarpışma: veri düzeninden
const stepper=new FixedStepper(),input=new InputManager(()=>{});input.active=true;

function frame(dt){
  const s=input.update(dt);
  if(s.arm)flight.toggleArm(s.throttle);
  const alpha=stepper.advance(dt,step=>flight.step(step,s));    // fizik her zaman 240 Hz
  renderPos.lerpVectors(flight.previousPosition,flight.position,alpha);
  renderRot.slerpQuaternions(flight.previousRotation,flight.rotation,alpha);
  // ... çizim: renderPos / renderRot ile
}
```

`flight.step(dt, input)` girişi: `throttle` 0…1, `pitch` / `roll` / `yaw` −1…1,
isteğe bağlı `verticalCommand` −1…1 (eğitim gazı: dikey hız isteği).

## Kurallar ve birimler

- Metre, saniye, kilogram, newton. Y yukarı. **Kuzey = −Z, doğu = +X**; dronun burnu −Z.
  Rüzgâr yönü ve pusula aynı tanımı kullanır.
- Fizik `FLIGHT.fixedDt = 1/240` sn sabit adımla ilerler. Kare hızı ne olursa olsun aynı
  giriş aynı yörüngeyi verir (testli: 30/60/144/240 Hz).
- **Çizim fiziğe asla yazmaz.** Çizim yalnız `previousPosition/position`,
  `previousRotation/rotation`, `velocity`, `motorOmega` vb. okur.
- Olaylar: `flight.addEventListener('contact' | 'impact' | 'crash' | 'reset', …)`.
- Çarpışma modu: `flight.collisionMode = 'damage'` (sağlık azalır) ya da `'respawn'`.
- Salt okunur sorgular: `flight.canSee(from,to)`, `flight.probeDown(maxDist)`. Araya
  girmeleri fizik izini değiştirmez (testli).

## Çarpışma: görsel LOD'dan bağımsız

ZSK-FPV'de çarpışma kutuları açılışta sahnedeki görsel nesnelerden üretiliyordu
(`SceneColliders.js`; bu pakette yok). Küme (cluster) LOD, impostor ya da GPU culling
kullanan bir çizicide bunu **yapmayın**: görsel ağlar sürekli değişir.

- Çarpışmayı ayrı bir **çarpışma düzeninden** kurun: kutular (`addBox`), silindirler
  (`addCylinder`), gerekirse sabit ve sade bir üçgen ağı (`addTrimesh`).
- Görsel sistem aynı düzenden beslenebilir. Ama LOD, culling ve impostor değişimleri
  fizik dünyasına hiç ulaşmaz.
- Ağaçlar gibi binlerce görsel nesne için ya çarpışma hiç yoktur, ya da yalnız gövde için
  basit silindirler kullanılır. Sayıları sabittir.
- Rapier dünyası çizimden önce, ayrı bir döngüde güncellenir (`FixedStepper`).

## Drone türleri

| Kimlik | Ad | Kütle | İtki/ağırlık | Açıklık | Modlar |
|---|---|---|---|---|---|
| `freestyle5` | 5" freestyle (v0.7.0 ile birebir) | 650 g | 9,5 | 35 cm | ANGLE, ACRO |
| `race5` | 5" yarış | 460 g | 12,2 | 35 cm | ACRO, ANGLE |
| `whoop3` | 3" cinewhoop | 320 g | 5,6 | 21 cm | ANGLE, ACRO |
| `tiny65` | 65 mm tiny whoop | 27 g | 3,7 | 10 cm | ANGLE, ACRO |
| `longrange7` | 7" uzun menzil | 950 g | 5,9 | 47 cm | ANGLE, ACRO |
| `hex` | Denetim hexacopter | 2,4 kg | 4,0 | 96 cm | KONUM, ANGLE |

**Yeni tür eklemek:** `DroneTypes.js` içinde `define({...})` ile tanımlayın ve
`DRONE_ORDER`'a ekleyin. `gain` ≈ `inertia.x / 0.0035` olmalı (PID ölçeği). Testler bütün
türlerde otomatik çalışır:
- hover gazı %8–45
- itki/ağırlık ≥ 3,5
- eğitim gazı hedefine 0,25 m/sn yakın tırmanış
- kararlı ANGLE adım tepkisi
- ACRO tepe hızı hedefin 0,85–1,2 katı

## Değişmezlik kontrolü

`npm run trace` altı uçuş senaryosunu çalıştırır ve her 240 Hz adımda tam fizik durumunun
SHA-256 izini referansla karşılaştırır. Referans, ZSK-FPV v0.7.0'dan bu yana değişmeyen
izdir. Fiziği bilerek değiştirirseniz `node tools/flighttrace.mjs --write` ile yeniden
yazın ve nedenini kayda geçirin.

## Sürümler ve uyumluluk

- `@dimforge/rapier3d-compat` 0.21.0 ve `three` 0.186.1 ile test edildi.
- Başka bir Three.js sürümü ya da WebGPU çizicisi kullanılacaksa: çekirdek yalnız
  matematik sınıflarını kullanır. Projede tek bir `three` kopyası olmasına dikkat edin
  (Vite: `resolve.dedupe: ['three']`).
- `DroneModel` / `DroneEffects` WebGL malzemeleri kullanır. WebGPU çizicide kendi drone
  modelinizi kullanın ya da TSL'e taşıyın.

## Kapsam ve sınırlar

Bu çekirdek genel amaçlı drone uçuş fiziğidir. Türetilen askerî görev projelerinde şu
çerçeve geçerlidir:
- sistemler ve adlar hayalîdir; gerçek silah sistemlerinin adları ve performans değerleri kullanılmaz
- insan hedef yoktur; hedefler araç, yapı ve hedef panolarıdır
- gerçekçi patlayıcı ya da hasar modellemesi yapılmaz
- gerçek yerler kullanılmaz

## Bilinen sınırlar

- Fiziksel kumanda (Xbox / PS / FPV vericisi) ile test yapılmadı; klavye ve otomatik
  testlerle doğrulandı.
- Drone parametreleri gerçekçi aralıklardan seçildi; belirli bir ticari ürünün ölçümü değildir.
- Lisans belirtilmedi (ZSK-FPV ile aynı, proje sahibine ait). Başka bir projeyle
  birleştirmeden önce o projenin lisansını kontrol edin.

/** Basitleştirilmiş Mars helikopteri fizik hesapları — SI birimleri. */
export const INGENUITY_REFERANS = Object.freeze({
  kutleKg: 1.8, rotorCapM: 1.2, marsYercekimiMps2: 3.71,
  rotorDevirRpm: 2400, rotorSayisi: 2,
});
function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} pozitif sonlu sayı olmalıdır`);
  return value;
}
export function gerekliHavadaKalmaItisi(kutleKg, yercekimiMps2=INGENUITY_REFERANS.marsYercekimiMps2) {
  return positive(kutleKg, 'Kütle') * positive(yercekimiMps2, 'Yerçekimi');
}
export function itisAnalizi(mevcutItisN, kutleKg=INGENUITY_REFERANS.kutleKg) {
  if (!Number.isFinite(mevcutItisN) || mevcutItisN < 0) throw new RangeError('İtiş negatif olamaz');
  const gerekliItisN = gerekliHavadaKalmaItisi(kutleKg);
  const itisOrani = mevcutItisN / gerekliItisN;
  return {gerekliItisN, mevcutItisN, itisOrani, havadaKalabilir: itisOrani >= 1};
}
export function rotorDiskAlani(capM=INGENUITY_REFERANS.rotorCapM) {
  return Math.PI * (positive(capM, 'Rotor çapı')/2)**2;
}
export function gucTahmini(itisN, yogunlukKgM3=0.015, verimlilik=0.6) {
  if (!Number.isFinite(itisN)||itisN<0) throw new RangeError('İtiş geçersiz');
  if (!(verimlilik>0&&verimlilik<=1)) throw new RangeError('Verimlilik 0-1 arası olmalı');
  return Math.pow(itisN,1.5)/Math.sqrt(2*positive(yogunlukKgM3,'Hava yoğunluğu')*rotorDiskAlani())/verimlilik;
}
export function bataryaSureDakika(enerjiWh, gucW, oran=0.8) {
  if (!(oran>0&&oran<=1)) throw new RangeError('Oran geçersiz');
  if (!Number.isFinite(enerjiWh)||enerjiWh<0) throw new RangeError('Enerji geçersiz');
  return enerjiWh*oran/positive(gucW,'Güç')*60;
}

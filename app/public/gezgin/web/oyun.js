// OSIRISZK Mars Pathfinder — web sürümü.
// Oyun motoru: oyun/mars_core.py (masaüstü oyunuyla AYNI Python dosyası), tarayıcıda Pyodide ile çalışır.
// Bu dosya yalnızca ekranı çizer, klavye/dokunmatik girişi okur ve düğmeleri Python'a iletir.
import { YAZILAR } from './dil.js';

const PYODIDE = 'https://cdn.jsdelivr.net/npm/pyodide@314.0.7/';
const PY_DOSYALARI = ['oyun/mars_core.py', 'oyun/kamera.py', 'web/kopru.py', 'web/ceviri.py'];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- dil
let dil = (() => {
  const u = new URLSearchParams(location.search).get('dil');
  if (u === 'en' || u === 'tr') return u;
  try { const k = localStorage.getItem('osiriszk:dil'); if (k === 'en' || k === 'tr') return k; } catch {}
  return (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
})();
const Y = () => YAZILAR[dil];

function yazilariUygula() {
  document.documentElement.lang = dil;
  document.querySelectorAll('[data-y]').forEach((el) => {
    const yol = el.dataset.y.split('.');
    let v = Y(); for (const p of yol) v = v?.[p];
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-dil]').forEach((b) => b.classList.toggle('secili', b.dataset.dil === dil));
  document.title = dil === 'tr' ? 'OSIRISZK | Mars Pathfinder — Gezgin + Drone' : 'OSIRISZK | Mars Pathfinder — Rover + Drone';
}
document.querySelectorAll('[data-dil]').forEach((b) => b.addEventListener('click', () => {
  dil = b.dataset.dil;
  try { localStorage.setItem('osiriszk:dil', dil); } catch {}
  const u = new URL(location.href); u.searchParams.set('dil', dil); history.replaceState(null, '', u);
  yazilariUygula(); ciz(true);
}));
yazilariUygula();

// ---------------------------------------------------------------- Python'u yükle
let py, oyun, ceviri;
async function motoruYukle() {
  const ilerleme = (m) => { $('#yukleDurum').textContent = m; };
  try {
    ilerleme('Pyodide…');
    if (!window.loadPyodide) await new Promise((ok, hata) => {
      const s = document.createElement('script'); s.src = PYODIDE + 'pyodide.js'; s.onload = ok; s.onerror = hata; document.head.append(s);
    });
    py = await window.loadPyodide({ indexURL: PYODIDE });
    py.FS.mkdirTree('/oyun/kamera_kayitlari');
    for (const yol of PY_DOSYALARI) {
      ilerleme(yol);
      const r = await fetch(yol, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${yol}: ${r.status}`);
      py.FS.writeFile('/oyun/' + yol.split('/').pop(), await r.text());
    }
    py.runPython("import sys; sys.path.insert(0, '/oyun')");
    oyun = py.pyimport('kopru').oyun;
    ceviri = py.pyimport('ceviri');
    $('#yukleme').hidden = true;
    basla();
  } catch (e) {
    console.error(e);
    $('#yukleMesaj').textContent = Y().yuklenemedi;
    $('#yukleDurum').textContent = String(e.message ?? e).slice(0, 300);
    $('#yukleme').classList.add('hata');
  }
}

// Python hatasının son satırını ("ValueError: ...") seçili dile çevirir
function pyHata(e) {
  const satir = String(e.message ?? e).trim().split('\n').pop().replace(/^\w+Error:\s*/, '');
  return ceviri ? ceviri.cevir(satir, dil) : satir;
}

// ---------------------------------------------------------------- giriş
const tuslar = new Set();
const TEK_SEFER = { KeyP: 'duraklat', Tab: 'degistir', KeyE: 'tara', KeyR: 'arastir', KeyF: 'kenetle', KeyB: 'pil', KeyT: 'aktarim',
  KeyH: 'isi', KeyG: 'gunes', KeyC: 'kamera', KeyK: 'onar' };
const SUREKLI = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'];
addEventListener('keydown', (e) => {
  if (!oyun || e.target.closest('input, textarea, select')) return;
  if (SUREKLI.includes(e.code) || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyV') return galeriAc();
  if (e.code === 'Escape') return galeriKapat();
  if (TEK_SEFER[e.code]) eylem(TEK_SEFER[e.code]);
  if (SUREKLI.includes(e.code)) tuslar.add(e.code);
});
addEventListener('keyup', (e) => tuslar.delete(e.code));
addEventListener('blur', () => tuslar.clear());

// Dokunmatik ekran (tablet) kumandası
document.querySelectorAll('[data-tus]').forEach((b) => {
  const kod = b.dataset.tus;
  const bas = (e) => { e.preventDefault(); tuslar.add(kod); b.classList.add('basili'); };
  const birak = (e) => { e.preventDefault(); tuslar.delete(kod); b.classList.remove('basili'); };
  b.addEventListener('pointerdown', bas); b.addEventListener('pointerup', birak);
  b.addEventListener('pointerleave', birak); b.addEventListener('pointercancel', birak);
});

function eksenler() {
  const k = tuslar;
  return [
    (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0),
    (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0),
    (k.has('ArrowUp') || k.has('Space') ? 1 : 0) - (k.has('ArrowDown') || k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0),
  ];
}

function eylem(ad) {
  if (!oyun) return;
  try { oyun.eylem(ad); } catch (e) { bildir(pyHata(e)); }
  ciz(true);
}

// ---------------------------------------------------------------- döngü
let S = null, sonZaman = performance.now(), panelZamani = 0;
function basla() {
  document.querySelectorAll('[data-eylem]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.eylem;
    if (a === 'galeri') galeriAc(); else if (a === 'kaydet') kaydet(); else if (a === 'yukle') $('#dosyaSec').click();
    else if (a === 'csv') csvIndir(); else eylem(a);
    b.blur();
  }));
  $('#dosyaSec').addEventListener('change', yukle);
  requestAnimationFrame(kare);
}
function kare(t) {
  const gecen = Math.min(0.1, (t - sonZaman) / 1000); sonZaman = t;
  try { oyun.ilerle(gecen, ...eksenler()); } catch (e) { bildir(pyHata(e)); }
  ciz(t - panelZamani > 150);
  if (t - panelZamani > 150) panelZamani = t;
  requestAnimationFrame(kare);
}

// ---------------------------------------------------------------- çizim
const tuval = $('#harita'), ctx = tuval.getContext('2d');
const RENK = { cyan: '#77ded0', turuncu: '#ffb678', kaya: '#ad725f' };
function boyutla() {
  const r = tuval.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  tuval.width = Math.round(r.width * dpr); tuval.height = Math.round(r.height * dpr);
}
new ResizeObserver(() => { boyutla(); ciz(false); }).observe(tuval);

function ciz(panel) {
  if (!oyun) return;
  S = JSON.parse(oyun.durum(dil));
  const W = tuval.width, H = tuval.height, dpr = W / tuval.getBoundingClientRect().width || 1;
  const sx = W / S.dunya.w, sy = H / S.dunya.h, p = (x, y) => [x * sx, y * sy];
  const yazi = (m, x, y, renk, boyut = 9, hiza = 'left', kalin = true) => {
    ctx.font = `${kalin ? '700 ' : ''}${boyut * dpr}px system-ui, "Segoe UI", sans-serif`; ctx.fillStyle = renk; ctx.textAlign = hiza; ctx.fillText(m, x, y);
  };
  const daire = (x, y, r, dolgu, cizgi, kalinlik = 1, kesik) => {
    ctx.beginPath(); ctx.ellipse(x, y, Math.abs(r), Math.abs(r), 0, 0, 7);
    if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(); }
    if (cizgi) { ctx.setLineDash(kesik ? kesik.map((v) => v * dpr) : []); ctx.lineWidth = kalinlik * dpr; ctx.strokeStyle = cizgi; ctx.stroke(); ctx.setLineDash([]); }
  };
  ctx.fillStyle = '#34262c'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {
    const x1 = (i * 0.22 * W) % W, y1 = H * (0.12 + 0.115 * i);
    ctx.beginPath(); ctx.ellipse(x1 + 60 * sx, y1 + 34 * sy, 240 * sx, 86 * sy, 0, 0, 7); ctx.fillStyle = i % 2 ? '#3e2c30' : '#412e2d'; ctx.fill();
  }
  ctx.strokeStyle = '#594042'; ctx.lineWidth = dpr; ctx.setLineDash([dpr, 8 * dpr]);
  for (let i = 0; i < S.dunya.w; i += 80) { ctx.beginPath(); ctx.moveTo(i * sx, 0); ctx.lineTo(i * sx, H); ctx.stroke(); }
  for (let j = 0; j < S.dunya.h; j += 80) { ctx.beginPath(); ctx.moveTo(0, j * sy); ctx.lineTo(W, j * sy); ctx.stroke(); }
  ctx.setLineDash([]);
  const k = Math.min(sx, sy);               // dünya birimi → piksel
  const [ux, uy] = p(...S.dunya.us);
  daire(ux, uy, 37 * k, '#245e5c', RENK.cyan, 2); daire(ux, uy, 27 * k, null, '#9aead9', 2, [3, 6]);
  yazi(Y().us, ux + 35 * k, uy + 57 * k, RENK.cyan);
  for (const [hx, hy, r] of S.engeller) {
    const [x, y] = p(hx, hy), b = r * (sx + sy) * 0.5;
    ctx.beginPath(); ctx.moveTo(x - b, y + b * 0.6); ctx.lineTo(x - b * 0.35, y - b * 0.6); ctx.lineTo(x + b * 0.37, y - b * 0.8); ctx.lineTo(x + b, y + b * 0.45); ctx.closePath();
    ctx.fillStyle = '#80504a'; ctx.fill(); ctx.strokeStyle = '#a37067'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
  }
  for (const kaya of S.kayalar) {
    const [x, y] = p(kaya.x, kaya.y), renk = kaya.tarandi ? RENK.cyan : RENK.turuncu;
    daire(x, y, 66 * k, null, renk, 1, [2, 7]); daire(x, y, 14 * k, RENK.kaya, renk, 2);
    yazi(`${kaya.tarandi ? '✓ ' : '○ '}${kaya.ad}${kaya.arastirildi ? ' • R' : ''}`, x, y + 30 * k, renk, 9, 'center');
  }
  gezginCiz(p, k, dpr, yazi, daire);
  droneCiz(p, k, dpr, yazi, daire);
  if (S.gezgin.baglanti) {
    const [rx, ry] = p(S.gezgin.x, S.gezgin.y);
    if (S.gezgin.aktariyor) { ctx.setLineDash([6 * dpr, 5 * dpr]); ctx.strokeStyle = RENK.cyan; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(W - 45 * dpr, 55 * dpr); ctx.stroke(); ctx.setLineDash([]); }
    daire(W - 45 * dpr, 53 * dpr, 22 * dpr, null, RENK.cyan, 2); yazi('D', W - 45 * dpr, 58 * dpr, '#effef9', 12, 'center');
    yazi(Y().dunya, W - 70 * dpr, 92 * dpr, RENK.cyan, 8, 'right');
  }
  yazi(Y().haritaBaslik, 14 * dpr, 22 * dpr, '#f3c8b0', 10);
  yazi(Y().secili(S.secili), 14 * dpr, H - 13 * dpr, RENK.cyan, 10);
  if (panel) panelGuncelle();
}

// Gezgin, modeller/gezgin-mimari.jpg ÜST GÖRÜNÜŞÜNE göre: 1,60 × 1,20 m gövde, arkada güneş paneli,
// önde 0,60 × 0,60 m drone platformu, her yanda 3 teker. Ölçek: 1,20 m = 40 harita birimi.
const GEZGIN_YARI_BOY = 27, GEZGIN_YARI_EN = 20;
function gezginCiz(p, k, dpr, yazi, daire) {
  const g = S.gezgin, [x, y] = p(g.x, g.y), L = GEZGIN_YARI_BOY * k, Wn = GEZGIN_YARI_EN * k;
  const kutu = (x1, y1, x2, y2, dolgu, cizgi, kal = 1) => { ctx.fillStyle = dolgu; ctx.fillRect(x1, y1, x2 - x1, y2 - y1); if (cizgi) { ctx.strokeStyle = cizgi; ctx.lineWidth = kal * dpr; ctx.strokeRect(x1, y1, x2 - x1, y2 - y1); } };
  if (S.secili === 'rover') { ctx.beginPath(); ctx.ellipse(x, y, L + 9 * k, Wn + 12 * k, 0, 0, 7); ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.strokeStyle = RENK.cyan; ctx.lineWidth = 2 * dpr; ctx.stroke(); ctx.setLineDash([]); }
  for (const dx of [-19, 0, 19]) for (const yy of [-GEZGIN_YARI_EN - 7, GEZGIN_YARI_EN - 1]) kutu(x + (dx - 6) * k, y + yy * k, x + (dx + 6) * k, y + (yy + 8) * k, '#101a22', '#8d9194');
  kutu(x - L, y - Wn, x + L, y + Wn, '#a58b78', '#f0d3ae', 2);
  kutu(x - L + 3 * k, y - Wn + 3 * k, x - 2 * k, y + Wn - 3 * k, g.panel ? '#215979' : '#3a3f44', g.panel ? '#80badc' : '#666');
  if (g.panel) {
    ctx.strokeStyle = '#6a9fbf'; ctx.lineWidth = dpr;
    for (let i = 1; i < 4; i++) { const xx = x - L + 3 * k + i * (L - 5 * k) / 4; ctx.beginPath(); ctx.moveTo(xx, y - Wn + 3 * k); ctx.lineTo(xx, y + Wn - 3 * k); ctx.stroke(); }
    for (let j = 1; j < 5; j++) { const yy = y - Wn + 3 * k + j * (2 * Wn - 6 * k) / 5; ctx.beginPath(); ctx.moveTo(x - L + 3 * k, yy); ctx.lineTo(x - 2 * k, yy); ctx.stroke(); }
  }
  const px = x + L / 2, yarim = Wn / 2;
  kutu(px - yarim, y - yarim, px + yarim, y + yarim, '#5b6867', RENK.cyan);
  daire(px, y, yarim - 2 * k, null, '#f7eec8');
  yazi('H', px, y + 3 * k, '#f7eec8', Math.max(6, 8 * k / dpr), 'center');
  daire(x + L - 3 * k, y - Wn + 3 * k, 4 * k, '#c6e4f3', '#294b59');
  ctx.strokeStyle = '#d2c9a6'; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.moveTo(x + L, y + Wn - 6 * k); ctx.lineTo(x + L + 11 * k, y + Wn - 2 * k); ctx.stroke();
  if (g.isitici) daire(x - L + 8 * k, y + Wn - 6 * k, 3 * k, '#ffb36e');
  yazi(Y().gezginEtiket, x + L + 6 * k, y + Wn + 16 * k, '#f4e6d7', 8);
}

// Drone, modeller/drone-mimari.jpg'e göre: Ø1,20 m eş eksenli iki rotor (gezgin genişliğiyle aynı).
function droneCiz(p, k, dpr, yazi, daire) {
  const d = S.drone; let [x, y] = p(d.x, d.y); const rotor = GEZGIN_YARI_EN * k;
  let offset = 0, aci = 0.6;
  if (d.kenetli) x += (GEZGIN_YARI_BOY * k) / 2;
  else {
    const g = (9 + Math.min(27, d.irtifa * 2)) * k;
    ctx.beginPath(); ctx.ellipse(x, y, g, g * 0.4, 0, 0, 7); ctx.fillStyle = '#1b1b20'; ctx.fill();
    offset = Math.min(30, d.irtifa * 2.5) * k;
    if (d.havada) aci = S.sure * 9;
  }
  if (S.secili === 'drone') daire(x, y - offset, rotor + 5 * k, null, RENK.cyan, 2, [3, 4]);
  for (const [a, renk] of [[aci, '#f9fafb'], [-aci + 1.2, '#cfe0ee']]) {
    const dx = Math.cos(a) * rotor, dy = Math.sin(a) * rotor;
    ctx.strokeStyle = renk; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.moveTo(x - dx, y - dy - offset); ctx.lineTo(x + dx, y + dy - offset); ctx.stroke();
  }
  ctx.fillStyle = '#e1e5e6'; ctx.fillRect(x - 4 * k, y - 4 * k - offset, 8 * k, 8 * k);
  ctx.strokeStyle = '#87b3c4'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(x - 4 * k, y - 4 * k - offset, 8 * k, 8 * k);
  ctx.fillStyle = '#215979'; ctx.fillRect(x - 2 * k, y - 2 * k - offset, 4 * k, 4 * k);
  if (!d.kenetli) yazi(`${d.irtifa.toFixed(1)} m`, x, y - rotor - offset - 8 * k, '#fff', 9, 'center');
}

// ---------------------------------------------------------------- paneller
const sayi = (v, b = 1) => (Number.isFinite(v) ? v.toLocaleString(dil === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: b, maximumFractionDigits: b }) : '—');
const satirlar = (liste) => liste.map(([a, b]) => `<div class="satir"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
function panelGuncelle() {
  const y = Y(), d = S.drone, g = S.gezgin, i = S.ilerleme;
  $('#durumBaslik').textContent = y.durumBaslik(S.duraklatildi, S.secili, d.kenetli);
  $('#durumBaslik').classList.toggle('aktif', !S.duraklatildi);
  $('#dronePanel').innerHTML = satirlar([
    [y.d.durum, d.kenetli ? y.d.kenetli : d.havada ? y.d.havada : y.d.yerde], [y.d.sure, `${sayi(S.sure)} s`],
    [y.d.irtifa, `${sayi(d.irtifa, 2)} m`], [y.d.dikey, `${sayi(d.dikeyHiz, 2)} m/s`], [y.d.kutle, `${sayi(d.kutle, 2)} kg`],
    [y.d.gerekli, `${sayi(d.gerekliItki, 2)} N`], [y.d.itki, `${sayi(d.itki, 2)} N`], [y.d.oran, sayi(d.itkiOrani, 2)],
    [y.d.guc, `${sayi(d.guc)} W`], [y.d.pil, `${sayi(d.pil, 2)} / ${sayi(d.pilKapasite, 0)} Wh`], [y.d.saglik, `${sayi(d.saglik, 0)} / 100`],
    [y.d.paket, d.bekleyenPaket], [y.d.konum, `${sayi(d.x, 0)} / ${sayi(d.y, 0)}`],
  ]);
  const ac = (v) => (v ? y.g.acik : y.g.kapali);
  $('#gezginPanel').innerHTML = satirlar([
    [y.g.konum, `${sayi(g.x, 0)} / ${sayi(g.y, 0)}`], [y.g.pil, `${sayi(g.pil)} / ${sayi(g.pilKapasite, 0)} Wh`],
    [y.g.gunes, `${sayi(g.gunes)} W`], [y.g.tuketim, `${sayi(g.tuketim)} W`], [y.g.yedekSarj, `${sayi(g.yedekSarj)} W`],
    [y.g.dis, `${sayi(g.dis ?? g.disOrtam)} °C`], [y.g.bolme, `${sayi(g.bolme)} °C`], [y.g.isitici, ac(g.isitici)], [y.g.panel, ac(g.panel)],
    [y.g.yedekler, g.yedekler.length ? `[${g.yedekler.map((b) => sayi(b, 0)).join(', ')}] Wh` : y.g.bos], [y.g.degisim, g.degisim],
    [y.g.saglik, `${sayi(g.saglik, 0)} / 100`], [y.g.radyo, g.aktariyor ? y.g.aktariyor : ac(g.baglanti)], [y.g.firtina, g.firtina ? y.g.var : y.g.yok],
  ]);
  const t = (ok) => (ok ? '✓' : '○');
  $('#gorevPanel').innerHTML = satirlar([
    [`${t(i.drone === 3)} ${y.gorev.tarama}`, `${i.drone}/3`],
    [`${t(i.rover >= 2)} ${y.gorev.yakin}`, `${i.rover}/2 ${y.gorev.enAz}`],
    [`${t(i.total_packets >= 5 && i.transmitted === i.total_packets)} ${y.gorev.iletim}`, `${i.transmitted}/${i.total_packets} ${y.gorev.paket}`],
    [`${t(i.docked)} ${y.gorev.platform}`, i.docked ? y.gorev.evet : y.gorev.hayir],
    [`${t(i.at_base)} ${y.gorev.usde}`, i.at_base ? y.gorev.evet : y.gorev.hayir],
  ]) + `<p class="sira"><b>${esc(y.gorev.siraBaslik)}</b><br>${y.gorev.sira.map(esc).join('<br>')}</p>`;
  $('#sonOlay').textContent = S.olay;
  $('#bildirim').textContent = S.mesaj;
  $('#bildirim').classList.toggle('basari', S.bitti); $('#bildirim').classList.toggle('kotu', S.basarisiz);
}
function bildir(m) { $('#bildirim').textContent = m; }

// Sekmeler
document.querySelectorAll('[data-sekme]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-sekme]').forEach((x) => x.classList.toggle('secili', x === b));
  document.querySelectorAll('.sekmeIcerik').forEach((x) => { x.hidden = x.id !== b.dataset.sekme; });
}));

// ---------------------------------------------------------------- kayıt, CSV, galeri
function indir(ad, metin, tur) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([metin], { type: tur })); a.download = ad; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function kaydet() { try { indir('osiriszk_kayit_v3.json', oyun.kaydet(), 'application/json'); bildir(Y().kayitTamam); } catch (e) { bildir(`${Y().hata}: ${pyHata(e)}`); } }
function csvIndir() { try { indir('osiriszk_telemetri.csv', '﻿' + oyun.csv(), 'text/csv'); bildir(Y().csvTamam); } catch (e) { bildir(pyHata(e)); } }
async function yukle(e) {
  const f = e.target.files?.[0]; e.target.value = '';
  if (!f) return;
  try { oyun.yukle(await f.text()); } catch (er) { bildir(`${Y().hata}: ${pyHata(er)}`); return; }
  ciz(true);
}
const resimler = new Map();
function resim(dosya) {
  if (!resimler.has(dosya)) {
    try { resimler.set(dosya, URL.createObjectURL(new Blob([py.FS.readFile('/oyun/' + dosya)], { type: 'image/png' }))); } catch { return null; }
  }
  return resimler.get(dosya);
}
function galeriAc() {
  if (!S) return;
  const y = Y().galeri, liste = S.paketler.filter((p) => p.dosya && resim(p.dosya));
  $('#galeriBaslik').textContent = y.baslik; $('#galeriNot').textContent = y.not; $('#galeriKapat').textContent = y.kapat;
  const sol = $('#galeriListe'), sag = $('#galeriOnizleme');
  if (!liste.length) { sol.innerHTML = ''; sag.innerHTML = `<p>${esc(y.bos)}</p>`; }
  else {
    sol.innerHTML = liste.map((p, i) => `<button data-i="${i}">#${String(p.no).padStart(3, '0')} • ${esc(y[p.kaynak] ?? p.kaynak)} • ${esc(p.hedef.slice(0, 16))}</button>`).join('');
    const goster = (i) => {
      const p = liste[i];
      sol.querySelectorAll('button').forEach((b) => b.classList.toggle('secili', +b.dataset.i === i));
      sag.innerHTML = `<img src="${resim(p.dosya)}" alt="${esc(p.hedef)}"><p>${esc(y.kaynak)}: ${esc(y[p.kaynak] ?? p.kaynak)}<br>${esc(y.hedef)}: ${esc(p.hedef)}<br>${esc(y.saat)}: ${sayi(p.saat)} s<br>${esc(y.durum)}: ${esc(p.aktarildi ? y.dunyada : p.gezginde ? y.gezginde : y.dronede)}</p>`;
    };
    sol.onclick = (e) => { const b = e.target.closest('button'); if (b) goster(+b.dataset.i); };
    goster(liste.length - 1);
  }
  $('#galeri').showModal();
}
function galeriKapat() { $('#galeri').open && $('#galeri').close(); }
$('#galeriKapat').addEventListener('click', galeriKapat);

motoruYukle();

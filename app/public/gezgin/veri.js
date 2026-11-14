/* =============================================================================
 * GERÇEK ZAMANLI VERİ — Perseverance MEDA hava istasyonu (Jezero), NASA/JPL Mars 2020 hava akışı.
 * Akış kamuoyu ürünüdür: günler-haftalar gecikebilir, boşlukları olabilir. Ulaşılamazsa oyun
 * yayımlanmış MEDA aralığıyla (sistemler.js → varsayilanHava) çalışmaya devam eder; veri UYDURULMAZ.
 *
 * Adresler sırayla denenir:
 *  1) ../nasa/mars/...  — OsirisZk sitesinin Netlify vekil adresi (tarayıcının CORS sınırını aşmak için)
 *  2) mars.nasa.gov     — doğrudan (yerelde baslat.py ile açıldığında çoğu tarayıcı CORS nedeniyle engeller)
 * ========================================================================== */
import { varsayilanHava, medaHava, SABIT } from './sistemler.js';

const YOL = 'rss/api/?feed=weather&category=mars2020&feedtype=json';
export const ADRESLER = [`../nasa/mars/${YOL}`, `https://mars.nasa.gov/${YOL}`];

const sayi = (v) => { if (v == null) return null; const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };

/** Akıştan en son eksiksiz sol (basınç + en düşük + en yüksek sıcaklık). */
export function enSonSol(json) {
  const liste = json?.sols ?? json?.soles;
  if (!Array.isArray(liste)) throw new Error('beklenmeyen biçim');
  const sollar = liste.map((s) => {
    let p = sayi(s.pressure); if (p != null && p >= 4 && p <= 12) p *= 100;          // hPa → Pa
    let lo = sayi(s.min_temp), hi = sayi(s.max_temp);
    const gecerli = (v) => v != null && v > -140 && v < 45;
    if (!gecerli(lo)) lo = null; if (!gecerli(hi)) hi = null;
    if (p != null && (p < 300 || p > 1300)) p = null;
    return { sol: sayi(s.sol), tarih: s.terrestrial_date ?? '', ls: sayi(s.ls), p, lo, hi, opaklik: s.atmo_opacity ?? null };
  }).filter((s) => s.sol != null).sort((a, b) => b.sol - a.sol);
  return sollar.find((s) => s.p != null && s.lo != null && s.hi != null && s.lo < s.hi) ?? null;
}

/** "Sunny" gibi niteliksel opaklığı yaklaşık τ değerine çevirir (VARSAYIM: Jezero tipik τ ≈ 0,5–0,8). */
function tau(nitelik) {
  const n = String(nitelik ?? '').toLowerCase();
  if (/dust|storm|toz/.test(n)) return 1.8;
  if (/cloud|haz|bulut/.test(n)) return 0.9;
  if (/sunny|clear|güneş/.test(n)) return 0.5;
  return 0.6;
}

export async function canliHavaAl({ zamanAsimi = 8000, fetchImpl = globalThis.fetch } = {}) {
  const hatalar = [];
  for (const url of ADRESLER) {
    const ctl = new AbortController(), zam = setTimeout(() => ctl.abort(), zamanAsimi);
    try {
      const r = await fetchImpl(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = enSonSol(await r.json());
      if (!s) throw new Error('eksiksiz sol yok');
      return { basincPa: s.p, minC: s.lo, maxC: s.hi, opaklik: tau(s.opaklik), ls: s.ls ?? varsayilanHava().ls,
        kaynak: 'canli', sol: s.sol, tarih: s.tarih, etiket: `NASA/JPL Mars 2020 MEDA · sol ${s.sol} (${s.tarih})`, url };
    } catch (e) { hatalar.push(`${url}: ${e.name === 'AbortError' ? 'zaman aşımı' : e.message}`); }
    finally { clearTimeout(zam); }
  }
  const h = medaHava(); h.hata = hatalar.join(' · '); return h;
}
export { SABIT };

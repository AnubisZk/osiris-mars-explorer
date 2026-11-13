// Görev Atölyesi yapay zekâ asistanı: /api/yz
//
// Üç modeli (Claude, ChatGPT, Gemini) Netlify AI Gateway üzerinden çağırır. Gateway, sağlayıcı
// anahtarlarını çalışma anında kendisi ekler; kodda ve tarayıcıda hiçbir anahtar yoktur.
// Öğretmen isterse Netlify'da kendi sağlayıcı anahtarını da tanımlayabilir; SDK'lar onu kullanır.
//
// Ortam değişkenleri (Netlify → Project configuration → Environment variables, kapsam: Functions):
//   ATOLYE_KODU   zorunlu. Öğrencilerin asistanı kullanmak için girdiği sınıf kodu.
//                 Tanımlı değilse asistan kapalıdır (açık bir sitede kredilerin harcanmaması için).
//   GUNLUK_SINIR  isteğe bağlı. Bir günde (İstanbul saatiyle) en çok kaç istek. Varsayılan 300.
//   YZ_MODEL_CLAUDE / YZ_MODEL_CHATGPT / YZ_MODEL_GEMINI  isteğe bağlı model adları.
//
// Gizlilik: istek ve cevap metinleri saklanmaz. Yalnızca günlük istek sayısı tutulur.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getStore } from '@netlify/blobs';

const env = k => (globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? '').trim();

const MODELLER = {
  claude: { ad: 'Claude', sirket: 'Anthropic', model: () => env('YZ_MODEL_CLAUDE') || 'claude-haiku-5-5', hazir: () => !!(env('ANTHROPIC_BASE_URL') || env('ANTHROPIC_API_KEY')) },
  chatgpt: { ad: 'ChatGPT', sirket: 'OpenAI', model: () => env('YZ_MODEL_CHATGPT') || 'gpt-6-luna', hazir: () => !!(env('OPENAI_BASE_URL') || env('OPENAI_API_KEY')) },
  gemini: { ad: 'Gemini', sirket: 'Google', model: () => env('YZ_MODEL_GEMINI') || 'gemini-3.8-flash', hazir: () => !!(env('GOOGLE_GEMINI_BASE_URL') || env('GEMINI_API_KEY') || env('GOOGLE_API_KEY')) },
};

const MAKS_CEVAP = 1500;          // token
const MAKS_MESAJ = 14;            // sohbet geçmişi
const MAKS_KARAKTER = 16000;      // bir istekteki toplam metin

function sistemMetni(gorev) {
  const g = gorev && typeof gorev === 'object'
    ? `\nTakımın seçtiği görev: "${String(gorev.baslik ?? '').slice(0, 80)}" (${String(gorev.gezegen ?? '').slice(0, 40)}, araç: ${String(gorev.arac ?? '').slice(0, 80)}).` : '';
  return `Sen "Görev Atölyesi" adlı bir okul etkinliğinde öğrencilere yardım eden bir asistansın. Öğrenciler ortaokul ve lise düzeyinde, Türkiye'deki bir Bilim ve Sanat Merkezi'nde (BİLSEM), öğretmenlerinin gözetiminde, 3–4 kişilik takımlar hâlinde çalışıyor. Takımlar, "Görev Kiti" adlı hazır bir three.js projesini kullanarak bir uzay görevi simülasyon oyunu yapıyor. Kitte görevin tamamı ayarlar.js dosyasında, fizik fizik.js'te, gezegen verileri gezegenler.js'te, ekran ve kontroller oyun.js'te.${g}

Kurallar:
- Türkçe, sade ve cesaretlendirici yaz. Kısa tut; gerekirse maddeler ve küçük başlıklar kullan.
- Bilimsel bir sayı verdiğinde birimini ve hangi güvenilir kaynağa (NASA, ESA vb.) bakılabileceğini yaz. Emin değilsen bunu açıkça söyle, asla uydurma. Öğrencileri sayıları kendilerinin doğrulamasına teşvik et.
- Kod istendiğinde tüm dosyayı yeniden yazma: yalnızca eklenecek ya da değişecek satırları göster, hangi satırın altına gideceğini söyle ve her satırı Türkçe yorumla açıkla. Dosyaların yapısını ve alan adlarını koru.
- Öğrencinin öğrenmesini önemse: cevabın sonunda, gerekiyorsa, öğrencinin kendi başına kontrol edebileceği bir şey öner.
- Öğrencilerden ad soyad, okul numarası, adres, telefon ya da fotoğraf gibi kişisel bilgi isteme. Paylaşırlarsa kullanma ve paylaşmamalarını nazikçe hatırlat.
- Konu dışı ya da yaşa uygun olmayan isteklerde nazikçe projeye dön.`;
}

const json = (veri, durum = 200) => Response.json(veri, { status: durum });

function bugun() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

async function sayacArtir(model) {
  const sinir = parseInt(env('GUNLUK_SINIR') || '300', 10);
  try {
    const depo = getStore({ name: 'yz-kullanim', consistency: 'strong' });
    const anahtar = bugun();
    const kayit = (await depo.get(anahtar, { type: 'json' })) ?? { toplam: 0 };
    if (kayit.toplam >= sinir) return { tamam: false, sinir };
    kayit.toplam += 1; kayit[model] = (kayit[model] ?? 0) + 1;
    await depo.setJSON(anahtar, kayit);
    return { tamam: true, kalan: sinir - kayit.toplam, sinir };
  } catch {
    return { tamam: true, kalan: null, sinir };   // sayaç çalışmazsa isteği engelleme
  }
}

function esit(a, b) {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

// Her sağlayıcı için: düz metin parçaları üreten bir akış
async function* claudeAkis(model, sistem, mesajlar) {
  const istemci = new Anthropic();
  const akis = await istemci.messages.create({
    model, max_tokens: MAKS_CEVAP, system: sistem, stream: true,
    messages: mesajlar.map(m => ({ role: m.rol === 'asistan' ? 'assistant' : 'user', content: m.metin })),
  });
  for await (const olay of akis) {
    if (olay.type === 'content_block_delta' && olay.delta?.type === 'text_delta') yield olay.delta.text;
  }
}

async function* chatgptAkis(model, sistem, mesajlar) {
  const istemci = new OpenAI();
  const akis = await istemci.responses.create({
    model, instructions: sistem, stream: true, max_output_tokens: MAKS_CEVAP + 1000,
    reasoning: { effort: 'low' },
    input: mesajlar.map(m => ({ role: m.rol === 'asistan' ? 'assistant' : 'user', content: m.metin })),
  });
  for await (const olay of akis) {
    if (olay.type === 'response.output_text.delta') yield olay.delta;
    else if (olay.type === 'error') throw new Error(olay.message ?? 'OpenAI hatası');
  }
}

async function* geminiAkis(model, sistem, mesajlar) {
  const istemci = new GoogleGenAI({});
  const akis = await istemci.models.generateContentStream({
    model,
    contents: mesajlar.map(m => ({ role: m.rol === 'asistan' ? 'model' : 'user', parts: [{ text: m.metin }] })),
    config: { systemInstruction: sistem, maxOutputTokens: MAKS_CEVAP + 1000 },
  });
  for await (const parca of akis) { const t = parca.text; if (t) yield t; }
}

const AKISLAR = { claude: claudeAkis, chatgpt: chatgptAkis, gemini: geminiAkis };

export default async (req, context) => {
  const kod = env('ATOLYE_KODU');

  if (req.method === 'GET') {
    return json({
      kodTanimli: !!kod,
      modeller: Object.fromEntries(Object.entries(MODELLER).map(([k, m]) => [k, { ad: m.ad, sirket: m.sirket, model: m.model(), hazir: m.hazir() }])),
    });
  }
  if (req.method !== 'POST') return json({ hata: 'Yalnızca GET ve POST.' }, 405);

  if (!kod) return json({ hata: 'Asistan henüz açılmadı: öğretmen Netlify\'da ATOLYE_KODU değişkenini tanımlamalı.' }, 503);

  let govde;
  try { govde = await req.json(); } catch { return json({ hata: 'İstek okunamadı.' }, 400); }
  if (!esit(String(govde?.kod ?? '').trim(), kod)) return json({ hata: 'Sınıf kodu yanlış. Kodu öğretmenine sor.' }, 401);

  const secim = MODELLER[govde?.model];
  if (!secim) return json({ hata: 'Bilinmeyen model.' }, 400);
  if (!secim.hazir()) return json({ hata: `${secim.ad} şu anda kullanılamıyor (AI Gateway etkin değil ya da anahtar yok).` }, 503);

  const mesajlar = Array.isArray(govde.mesajlar) ? govde.mesajlar.slice(-MAKS_MESAJ) : [];
  if (!mesajlar.length || mesajlar.some(m => typeof m?.metin !== 'string' || !m.metin.trim()) || mesajlar.at(-1).rol === 'asistan')
    return json({ hata: 'Boş mesaj gönderilemez.' }, 400);
  if (mesajlar.reduce((t, m) => t + m.metin.length, 0) > MAKS_KARAKTER)
    return json({ hata: `Mesaj çok uzun (en çok ${MAKS_KARAKTER.toLocaleString('tr-TR')} karakter). Yeni bir sohbet başlat ya da yalnızca ilgili kodu yapıştır.` }, 413);

  const sayac = await sayacArtir(govde.model);
  if (!sayac.tamam) return json({ hata: `Bugünkü kullanım sınırına (${sayac.sinir} istek) ulaşıldı. Yarın yeniden dene ya da öğretmenine haber ver.` }, 429);

  const uretici = AKISLAR[govde.model](secim.model(), sistemMetni(govde.gorev), mesajlar);
  // İlk parçayı beklemek: model adı yanlışsa ya da gateway kapalıysa anlaşılır bir hata dönebilmek için
  let ilk;
  try { ilk = await uretici.next(); }
  catch (e) {
    console.error('yz başlangıç hatası', govde.model, e?.status, e?.message);
    const neden = e?.status === 401 || e?.status === 403 ? 'yetki sorunu (AI Gateway ya da anahtar)'
      : e?.status === 404 ? `model bulunamadı (${secim.model()})` : e?.status === 429 ? 'sağlayıcı şu an çok yoğun' : 'beklenmeyen bir hata';
    return json({ hata: `${secim.ad} cevap veremedi: ${neden}. Biraz sonra yeniden dene ya da başka bir model seç.` }, 502);
  }
  const kodlayici = new TextEncoder();
  const govdeAkis = new ReadableStream({
    start(denetleyici) {
      if (ilk.done) denetleyici.close();
      else denetleyici.enqueue(kodlayici.encode(ilk.value));
    },
    async pull(denetleyici) {
      try {
        const { value, done } = await uretici.next();
        if (done) denetleyici.close();
        else denetleyici.enqueue(kodlayici.encode(value));
      } catch (e) {
        console.error('yz hata', govde.model, e?.status, e?.message);
        denetleyici.enqueue(kodlayici.encode(`\n\n⚠ ${secim.ad} cevap verirken bir hata oluştu${e?.status ? ` (${e.status})` : ''}. Biraz sonra yeniden dene.`));
        denetleyici.close();
      }
    },
    cancel() { uretici.return?.(); },
  });
  return new Response(govdeAkis, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-yz-model': secim.model(),
      ...(sayac.kalan != null ? { 'x-yz-kalan': String(sayac.kalan) } : {}),
    },
  });
};

export const config = {
  path: '/api/yz',
  method: ['GET', 'POST'],
  // Aynı IP'den dakikada en çok 20 istek: kredilerin kötüye kullanımını sınırlar
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

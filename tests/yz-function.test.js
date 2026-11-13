// /api/yz (netlify/functions/yz.mjs): access code, validation, and streaming from all three providers.
// A local mock server speaks each provider's streaming format; the SDKs are pointed at it through
// the same *_BASE_URL variables Netlify AI Gateway injects in production.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const istekler = [];
const sunucu = http.createServer((req, res) => {
  let govde = '';
  req.on('data', c => (govde += c));
  req.on('end', () => {
    istekler.push({ url: req.url, govde: govde ? JSON.parse(govde) : null });
    const sse = satirlar => { res.writeHead(200, { 'content-type': 'text/event-stream' }); for (const s of satirlar) res.write(s); res.end(); };
    if (req.url.includes('/v1/messages')) {
      if (istekler.at(-1).govde.model === 'yok-model') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"type":"error","error":{"type":"not_found_error","message":"model"}}'); }
      return sse([
        'event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"x","content":[],"stop_reason":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Mars\'ta "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"g = 3,71 m/s²."}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]);
    }
    if (req.url.includes('/responses')) {
      return sse([
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","item_id":"i","output_index":0,"content_index":0,"delta":"Merhaba ","sequence_number":1}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","item_id":"i","output_index":0,"content_index":0,"delta":"takım!","sequence_number":2}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","sequence_number":3,"response":{"id":"r","object":"response","output":[],"status":"completed"}}\n\n',
      ]);
    }
    if (req.url.includes('streamGenerateContent')) {
      return sse([
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Titan "}]}}]}\r\n\r\n',
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"çok soğuk."}]},"finishReason":"STOP"}]}\r\n\r\n',
      ]);
    }
    res.writeHead(404); res.end();
  });
});
await new Promise(r => sunucu.listen(0, r));
const taban = `http://127.0.0.1:${sunucu.address().port}`;
Object.assign(process.env, {
  ANTHROPIC_API_KEY: 'test', ANTHROPIC_BASE_URL: taban,
  OPENAI_API_KEY: 'test', OPENAI_BASE_URL: taban + '/v1',
  GEMINI_API_KEY: 'test', GOOGLE_GEMINI_BASE_URL: taban,
  ATOLYE_KODU: 'mars-2026',
});
const { default: yz, config } = await import('../netlify/functions/yz.mjs');
test.after(() => sunucu.close());

const post = govde => yz(new Request('https://x/api/yz', { method: 'POST', body: JSON.stringify(govde) }), {});
const soru = { kod: 'mars-2026', mesajlar: [{ rol: 'kullanici', metin: 'Mars yerçekimi?' }], gorev: { baslik: 'Jezero', gezegen: 'Mars', arac: 'helikopter' } };

test('config: served at /api/yz with a per-IP rate limit', () => {
  assert.equal(config.path, '/api/yz');
  assert.ok(config.rateLimit.windowLimit > 0);
});

test('GET reports which models are ready, without leaking the class code', async () => {
  const r = await (await yz(new Request('https://x/api/yz'), {})).json();
  assert.equal(r.kodTanimli, true);
  assert.deepEqual(Object.keys(r.modeller), ['claude', 'chatgpt', 'gemini']);
  assert.ok(Object.values(r.modeller).every(m => m.hazir));
  assert.doesNotMatch(JSON.stringify(r), /mars-2026/);
});

test('rejects a wrong class code, an unknown model, empty and oversized messages', async () => {
  assert.equal((await post({ ...soru, model: 'claude', kod: 'yanlis' })).status, 401);
  assert.equal((await post({ ...soru, model: 'baska' })).status, 400);
  assert.equal((await post({ ...soru, model: 'claude', mesajlar: [{ rol: 'kullanici', metin: '  ' }] })).status, 400);
  assert.equal((await post({ ...soru, model: 'claude', mesajlar: [{ rol: 'kullanici', metin: 'a'.repeat(20000) }] })).status, 413);
});

test('streams text from Claude, ChatGPT and Gemini, with the Turkish system prompt and mission context', async () => {
  const beklenen = { claude: "Mars'ta g = 3,71 m/s².", chatgpt: 'Merhaba takım!', gemini: 'Titan çok soğuk.' };
  for (const [model, metin] of Object.entries(beklenen)) {
    const r = await post({ ...soru, model });
    assert.equal(r.status, 200, model);
    assert.match(r.headers.get('content-type'), /text\/plain/);
    assert.equal(await r.text(), metin, model);
  }
  const claude = istekler.find(i => i.url.includes('/v1/messages')).govde;
  assert.match(claude.system, /BİLSEM/); assert.match(claude.system, /Jezero/);
  assert.equal(claude.messages[0].role, 'user');
  const openai = istekler.find(i => i.url.includes('/responses')).govde;
  assert.match(openai.instructions, /Görev Kiti/);
});

test('a provider error before any text becomes a clear 502, not a broken stream', async () => {
  process.env.YZ_MODEL_CLAUDE = 'yok-model';
  const r = await post({ ...soru, model: 'claude' });
  delete process.env.YZ_MODEL_CLAUDE;
  assert.equal(r.status, 502);
  assert.match((await r.json()).hata, /model bulunamadı/);
});

test('without ATOLYE_KODU the assistant stays closed', async () => {
  const eski = process.env.ATOLYE_KODU; delete process.env.ATOLYE_KODU;
  const r = await post({ ...soru, model: 'claude' });
  process.env.ATOLYE_KODU = eski;
  assert.equal(r.status, 503);
});

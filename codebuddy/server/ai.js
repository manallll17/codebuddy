import { HttpError } from './util.js';

const KEY = () => process.env.GEMINI_API_KEY;

// If a model is overloaded, rate-limited or unavailable, try the next one automatically.
const MODELS = () =>
  [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'].filter(Boolean))];
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);
const TIMEOUT_MS = 40000;

const clip = (s, n) => String(s ?? '').slice(0, n);

async function callModel(model, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 504, data: { error: { message: 'AI took too long to respond.' } } };
  } finally {
    clearTimeout(timer);
  }
}

/** Calls Google Gemini. messages: [{role: 'user'|'assistant', content}] */
export async function gemini({ system, messages, json = false }) {
  if (!KEY()) throw new HttpError(503, 'AI is not configured yet (missing GEMINI_API_KEY on the server).');
  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clip(m.content, 20000) }],
    })),
    generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };

  let last;
  for (const model of MODELS()) {
    last = await callModel(model, payload);
    if (last.ok) break;
    console.warn(`Gemini model ${model} failed (${last.status}): ${last.data?.error?.message || ''}`);
    if (!RETRYABLE.has(last.status)) break; // e.g. bad API key – no point trying other models
  }

  if (!last.ok) {
    if (last.status === 429 || last.status === 503) throw new HttpError(503, 'AI is very busy right now. Please try again in a minute.');
    if (last.status === 504) throw new HttpError(504, 'AI took too long to respond. Please try again.');
    throw new HttpError(502, last.data?.error?.message || 'AI request failed');
  }

  const text = last.data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new HttpError(502, 'AI returned an empty answer. Try rephrasing.');
  if (!json) return text;
  try {
    return JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    throw new HttpError(502, 'AI returned an invalid response. Please try again.');
  }
}

import { HttpError } from './util.js';

const KEY = () => process.env.GEMINI_API_KEY;
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-flash-latest';

const clip = (s, n) => String(s ?? '').slice(0, n);

/** Calls Google Gemini. messages: [{role: 'user'|'assistant', content}] */
export async function gemini({ system, messages, json = false }) {
  if (!KEY()) throw new HttpError(503, 'AI is not configured yet (missing GEMINI_API_KEY on the server).');
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: clip(m.content, 20000) }],
  }));
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.7, ...(json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
  } catch {
    throw new HttpError(502, 'Could not reach the AI service.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 429) throw new HttpError(429, 'AI is busy (free-tier limit). Try again in a minute.');
    throw new HttpError(502, data?.error?.message || 'AI request failed');
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new HttpError(502, 'AI returned an empty answer. Try rephrasing.');
  if (!json) return text;
  try {
    return JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch {
    throw new HttpError(502, 'AI returned an invalid response. Please try again.');
  }
}

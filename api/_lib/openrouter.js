// api/_lib/openrouter.js
// Thin wrapper around the OpenRouter chat-completions API.
// Docs: https://openrouter.ai/docs

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

/**
 * Calls OpenRouter and returns the parsed JSON object from the model's reply.
 * The caller supplies a system prompt that forces JSON-only output; we still
 * defensively strip code fences and validate with JSON.parse.
 */
async function callStructuredLLM({ system, user, model = DEFAULT_MODEL, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter asks for these two headers to identify your app (optional but recommended)
      'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://abem.vercel.app',
      'X-Title': 'ABEM - Autonomous Business Exception Manager',
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse LLM JSON output: ${e.message}\nRaw: ${raw}`);
  }
}

module.exports = { callStructuredLLM };

// Portfolio AI Chat Proxy
// Priority: Anthropic → OpenRouter → Groq (silent fallback on exhaustion)
//
// GET /api/chat  → health check (shows configured providers)
// POST /api/chat → chat request

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    const configured = [];
    if (process.env.ANTHROPIC_API_KEY) configured.push('anthropic');
    if (process.env.OPENROUTER_API_KEY) configured.push('openrouter');
    if (process.env.GROQ_API_KEY) configured.push('groq');
    return res.status(200).json({
      status: 'ok',
      configured,
      fallbackOrder: ['anthropic', 'openrouter', 'groq'],
      note: configured.length === 0 ? 'No API keys configured. Add env vars in Vercel dashboard.' : undefined
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const system = body.system || '';
  const messages = body.messages;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const trimmed = messages.slice(-40);
  const errors = [];

  // === ANTHROPIC (primary) ===
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system,
          messages: trimmed
        })
      });
      if (r.ok) {
        const d = await r.json();
        const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        if (text) return res.status(200).json({ content: [{ type: 'text', text }] });
        errors.push('anthropic: empty response');
      } else {
        errors.push('anthropic: ' + r.status);
      }
    } catch (e) {
      errors.push('anthropic: ' + e.message);
    }
  }

  // === OPENROUTER (secondary) ===
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
          'HTTP-Referer': 'https://3xd-chi.vercel.app',
          'X-Title': 'Chiranjeet Banerjee Portfolio'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-haiku',
          messages: [{ role: 'system', content: system }, ...trimmed],
          max_tokens: 500,
          temperature: 0.7
        })
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (text) return res.status(200).json({ content: [{ type: 'text', text }] });
        errors.push('openrouter: empty response');
      } else {
        errors.push('openrouter: ' + r.status);
      }
    } catch (e) {
      errors.push('openrouter: ' + e.message);
    }
  }

  // === GROQ (final) ===
  if (process.env.GROQ_API_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: system }, ...trimmed],
          max_tokens: 500,
          temperature: 0.7
        })
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
        if (text) return res.status(200).json({ content: [{ type: 'text', text }] });
        errors.push('groq: empty response');
      } else {
        errors.push('groq: ' + r.status);
      }
    } catch (e) {
      errors.push('groq: ' + e.message);
    }
  }

  // All failed - return graceful message (200 so widget displays it, not catch block)
  console.error('All chat providers failed:', errors);
  return res.status(200).json({
    content: [{
      type: 'text',
      text: 'I am temporarily unable to respond. You can reach Chiranjeet directly at be.chiranjeet@outlook.com or book a call at calendly.com/meetchiranjeet/30min'
    }],
    _debug: errors
  });
}

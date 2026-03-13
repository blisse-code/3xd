// Portfolio AI Chat Proxy - Multi-provider with silent fallback
//
// Priority: Anthropic (primary) → OpenRouter (secondary) → Groq (final)
// Switches silently when a provider is exhausted (rate limit / token limit).
// User never sees an error, just gets a response from the next provider.
//
// ENV VARS (Vercel dashboard → Settings → Environment Variables):
//   ANTHROPIC_API_KEY   = from console.anthropic.com
//   OPENROUTER_API_KEY  = from openrouter.ai/keys
//   GROQ_API_KEY        = from console.groq.com (free, no credit card)

const PROVIDERS = [
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    body: (system, messages) => ({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system,
      messages
    }),
    extract: (data) => {
      if (data.content) {
        return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
      }
      return null;
    },
    isExhausted: (status, body) => {
      // 429 = rate limit, 529 = overloaded, 400 with credit/billing = out of tokens
      if (status === 429 || status === 529) return true;
      if (status === 400 && body && (body.includes('credit') || body.includes('billing') || body.includes('limit'))) return true;
      return false;
    }
  },
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-3.5-haiku',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://3xd-chi.vercel.app',
      'X-Title': 'Chiranjeet Banerjee Portfolio'
    }),
    body: (system, messages) => ({
      model: 'anthropic/claude-3.5-haiku',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 500,
      temperature: 0.7
    }),
    extract: (data) => data.choices?.[0]?.message?.content || null,
    isExhausted: (status, body) => {
      if (status === 429) return true;
      if (status === 402) return true; // payment required / credits exhausted
      if (body && (body.includes('rate_limit') || body.includes('quota') || body.includes('credits'))) return true;
      return false;
    }
  },
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    body: (system, messages) => ({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 500,
      temperature: 0.7
    }),
    extract: (data) => data.choices?.[0]?.message?.content || null,
    isExhausted: (status, body) => {
      if (status === 429) return true;
      if (body && body.includes('rate_limit')) return true;
      return false;
    }
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const trimmedMessages = messages.slice(-40);
  let lastError = null;

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue; // Skip unconfigured providers

    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers(apiKey),
        body: JSON.stringify(provider.body(system || '', trimmedMessages))
      });

      // If exhausted (rate limit / token limit), silently try next provider
      if (!response.ok) {
        const errorBody = await response.text();
        if (provider.isExhausted(response.status, errorBody)) {
          lastError = `${provider.name}: exhausted (${response.status})`;
          continue; // Silent fallback to next provider
        }
        // Non-exhaustion error (bad request, auth error, etc.)
        lastError = `${provider.name}: ${response.status}`;
        continue;
      }

      const data = await response.json();
      const text = provider.extract(data);

      if (!text) {
        lastError = `${provider.name}: empty response`;
        continue; // Try next provider
      }

      // Return in Anthropic-compatible format (chat-widget.js expects this)
      return res.status(200).json({
        content: [{ type: 'text', text }]
      });

    } catch (e) {
      lastError = `${provider.name}: ${e.message}`;
      continue; // Network error, try next provider
    }
  }

  // All providers failed - return a graceful message the widget can display
  return res.status(200).json({
    content: [{
      type: 'text',
      text: 'I am temporarily unable to respond. You can reach Chiranjeet directly at hello@chiranjeetbanerjee.com or book a call at calendly.com/meetchiranjeet/30min'
    }]
  });
}

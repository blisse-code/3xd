// Proxies image generation requests to NanoBanana API.
// Requires NANOBANANA_API_KEY env var in Vercel.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = process.env.ADMIN_DEPLOY_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'NANOBANANA_API_KEY not configured' });

  try {
    const { prompt, width, height, style } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const response = await fetch('https://api.nanobanana.com/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        width: width || 1200,
        height: height || 675,
        style: style || 'professional',
        num_images: 1
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'NanoBanana API error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: 'Generation failed', detail: e.message });
  }
}

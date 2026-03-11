export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Supports multiple providers via FAL_KEY or NANOBANANA_KEY
  const falKey = process.env.FAL_KEY;
  const nanoBananaKey = process.env.NANOBANANA_KEY;

  try {
    const { prompt, provider, width, height } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const w = width || 1024;
    const h = height || 768;

    // NanoBanana provider
    if ((provider === 'nanobanana' || !provider) && nanoBananaKey) {
      const nbRes = await fetch('https://api.nanobanana.com/v1/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nanoBananaKey}`
        },
        body: JSON.stringify({
          prompt,
          width: w,
          height: h,
          num_images: 1
        })
      });

      if (!nbRes.ok) {
        const err = await nbRes.text();
        return res.status(nbRes.status).json({ error: 'NanoBanana error', detail: err });
      }

      const nbData = await nbRes.json();
      return res.status(200).json({
        provider: 'nanobanana',
        images: nbData.images || nbData.output || [nbData],
        prompt
      });
    }

    // Fal.ai provider (fallback)
    if (falKey) {
      const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`
        },
        body: JSON.stringify({
          prompt,
          image_size: { width: w, height: h },
          num_images: 1
        })
      });

      if (!falRes.ok) {
        const err = await falRes.text();
        return res.status(falRes.status).json({ error: 'Fal.ai error', detail: err });
      }

      const falData = await falRes.json();
      return res.status(200).json({
        provider: 'fal',
        images: falData.images || [],
        prompt
      });
    }

    return res.status(500).json({ error: 'No image generation API key configured. Set NANOBANANA_KEY or FAL_KEY in Vercel environment variables.' });

  } catch (e) {
    return res.status(500).json({ error: 'Image generation failed', detail: e.message });
  }
}

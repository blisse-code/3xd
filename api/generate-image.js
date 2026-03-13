// Portfolio AI Image Generation - Multi-provider with silent fallback
//
// Priority: Gemini Nano Banana (free 500/day) → Leonardo (free ~30/day) → Fal.ai (paid)
// Switches silently when a provider's quota is exhausted.
//
// ENV VARS (Vercel dashboard):
//   GEMINI_API_KEY     = from aistudio.google.com (free, 500 images/day)
//   LEONARDO_API_KEY   = from leonardo.ai (free tier: ~30 images/day)
//   FAL_API_KEY        = from fal.ai (paid, fast FLUX Schnell)
//   ADMIN_DEPLOY_KEY   = your chosen secret (protects this endpoint)

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

  const { prompt, width, height, style } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  // Try providers in order, skip silently on exhaustion
  const providers = [
    { name: 'gemini', fn: geminiGenerate, key: 'GEMINI_API_KEY' },
    { name: 'leonardo', fn: leonardoGenerate, key: 'LEONARDO_API_KEY' },
    { name: 'fal', fn: falGenerate, key: 'FAL_API_KEY' }
  ];

  let lastError = null;

  for (const p of providers) {
    const apiKey = process.env[p.key];
    if (!apiKey) continue;

    try {
      const result = await p.fn(apiKey, prompt, width || 1024, height || 576, style);
      if (result.exhausted) {
        lastError = `${p.name}: quota exhausted`;
        continue; // Silent fallback
      }
      if (result.error) {
        lastError = `${p.name}: ${result.error}`;
        continue;
      }
      return res.status(200).json({ provider: p.name, image: result.image });
    } catch (e) {
      lastError = `${p.name}: ${e.message}`;
      continue;
    }
  }

  return res.status(500).json({ error: 'All image providers exhausted or unconfigured', detail: lastError });
}

// ===== GEMINI (Nano Banana) - 500 free/day =====
async function geminiGenerate(apiKey, prompt, w, h) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageDimensions: { width: Math.min(w, 1024), height: Math.min(h, 1024) }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || body.includes('quota') || body.includes('RESOURCE_EXHAUSTED')) {
      return { exhausted: true };
    }
    return { error: `${response.status}: ${body.slice(0, 200)}` };
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);

  if (imagePart) {
    return { image: { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png' } };
  }
  return { error: 'No image in response' };
}

// ===== LEONARDO - ~30 free/day =====
async function leonardoGenerate(apiKey, prompt, w, h, style) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

  const genRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      width: Math.min(w, 1024),
      height: Math.min(h, 1024),
      num_images: 1,
      modelId: 'b2614463-296c-462a-9586-aafdb8f00e36',
      photoReal: style === 'photorealistic'
    })
  });

  if (!genRes.ok) {
    const body = await genRes.text();
    if (genRes.status === 429 || genRes.status === 402 || body.includes('tokens') || body.includes('limit')) {
      return { exhausted: true };
    }
    return { error: `${genRes.status}` };
  }

  const genData = await genRes.json();
  const generationId = genData.sdGenerationJob?.generationId;
  if (!generationId) return { error: 'No generation ID' };

  // Poll (max 30s)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const checkRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, { headers });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      const images = checkData.generations_by_pk?.generated_images;
      if (images?.length > 0) {
        return { image: { url: images[0].url } };
      }
    }
  }
  return { error: 'Generation timed out' };
}

// ===== FAL.AI (FLUX Schnell) - paid =====
async function falGenerate(apiKey, prompt, w, h) {
  const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
    body: JSON.stringify({
      prompt,
      image_size: { width: Math.min(w, 1024), height: Math.min(h, 1024) },
      num_images: 1
    })
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || response.status === 402) return { exhausted: true };
    return { error: `${response.status}` };
  }

  const data = await response.json();
  const imageUrl = data.images?.[0]?.url;
  return imageUrl ? { image: { url: imageUrl } } : { error: 'No image returned' };
}

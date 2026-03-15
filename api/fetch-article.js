// Fetches an article URL and extracts title, excerpt, date, source.
// Works with Substack, Medium, LinkedIn articles, and generic pages.

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

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PortfolioCMS/1.0)',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Could not fetch URL: ' + response.status });
    }

    const html = await response.text();

    // Extract metadata
    const title = extractMeta(html, 'og:title') ||
                  extractMeta(html, 'twitter:title') ||
                  extractTag(html, 'title') ||
                  'Untitled';

    const excerpt = extractMeta(html, 'og:description') ||
                    extractMeta(html, 'description') ||
                    extractMeta(html, 'twitter:description') ||
                    '';

    const dateStr = extractMeta(html, 'article:published_time') ||
                    extractMeta(html, 'datePublished') ||
                    extractJsonLd(html, 'datePublished') ||
                    '';

    const image = extractMeta(html, 'og:image') ||
                  extractMeta(html, 'twitter:image') ||
                  '';

    const author = extractMeta(html, 'author') ||
                   extractMeta(html, 'article:author') ||
                   extractJsonLd(html, 'author') ||
                   '';

    // Detect source
    let source = 'Article';
    if (url.includes('substack.com')) source = 'Substack';
    else if (url.includes('medium.com')) source = 'Medium';
    else if (url.includes('linkedin.com')) source = 'LinkedIn';
    else if (url.includes('dev.to')) source = 'Dev.to';

    // Format date
    let date = '';
    if (dateStr) {
      try {
        const d = new Date(dateStr);
        date = d.toISOString().slice(0, 10);
      } catch (e) {
        date = dateStr;
      }
    }

    return res.status(200).json({
      title: cleanText(title),
      excerpt: cleanText(excerpt).slice(0, 300),
      url,
      source,
      date,
      image,
      author: cleanText(author)
    });

  } catch (e) {
    return res.status(500).json({ error: 'Fetch failed: ' + e.message });
  }
}

function extractMeta(html, name) {
  // Try property first, then name
  const propMatch = html.match(new RegExp('<meta[^>]+(?:property|name)=["\'](?:og:|twitter:|article:)?' + escapeRegex(name) + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'));
  if (propMatch) return propMatch[1];
  // Try reverse order (content before property)
  const revMatch = html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:|twitter:|article:)?' + escapeRegex(name) + '["\']', 'i'));
  if (revMatch) return revMatch[1];
  return '';
}

function extractTag(html, tag) {
  const match = html.match(new RegExp('<' + tag + '[^>]*>([^<]+)</' + tag + '>', 'i'));
  return match ? match[1] : '';
}

function extractJsonLd(html, field) {
  const match = html.match(/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return '';
  try {
    const data = JSON.parse(match[1]);
    if (typeof data[field] === 'string') return data[field];
    if (data[field] && data[field].name) return data[field].name;
    if (Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        if (item[field]) return typeof item[field] === 'string' ? item[field] : item[field].name || '';
      }
    }
  } catch (e) {}
  return '';
}

function cleanText(text) {
  return (text || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

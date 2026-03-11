// Commits multiple files to GitHub in a single commit.
// Requires GITHUB_TOKEN and GITHUB_REPO env vars in Vercel.
// GITHUB_REPO format: "owner/repo" e.g. "blisse-code/3xd"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Simple admin auth
  const adminKey = process.env.ADMIN_DEPLOY_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ghToken = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;
  if (!ghToken || !ghRepo) {
    return res.status(500).json({ error: 'GITHUB_TOKEN or GITHUB_REPO not configured' });
  }

  try {
    const { files, message } = req.body;
    // files: [{ path: "case-studies/manifest.json", content: "..." }, ...]
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array required' });
    }

    const branch = 'main';
    const apiBase = `https://api.github.com/repos/${ghRepo}`;
    const headers = {
      'Authorization': `token ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // 1. Get latest commit SHA on branch
    const refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error('Failed to get branch ref: ' + await refRes.text());
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree of the latest commit
    const commitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error('Failed to get commit');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      // Check if content is base64 (for binary files like images)
      const isBase64 = file.encoding === 'base64';
      const blobRes = await fetch(`${apiBase}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: file.content,
          encoding: isBase64 ? 'base64' : 'utf-8'
        })
      });
      if (!blobRes.ok) throw new Error('Failed to create blob for ' + file.path);
      const blobData = await blobRes.json();

      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // 4. Create new tree
    const treeRes = await fetch(`${apiBase}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    if (!treeRes.ok) throw new Error('Failed to create tree');
    const treeData = await treeRes.json();

    // 5. Create commit
    const newCommitRes = await fetch(`${apiBase}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: message || 'Update from Portfolio CMS',
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Failed to create commit');
    const newCommitData = await newCommitRes.json();

    // 6. Update branch ref
    const updateRefRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha })
    });
    if (!updateRefRes.ok) throw new Error('Failed to update ref');

    return res.status(200).json({
      success: true,
      commit: newCommitData.sha,
      message: `Committed ${files.length} file(s). Vercel will auto-deploy.`
    });

  } catch (e) {
    return res.status(500).json({ error: 'Deploy failed', detail: e.message });
  }
}

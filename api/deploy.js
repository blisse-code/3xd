export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin passphrase
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const ghToken = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO || 'blisse-code/3xd';
  if (!ghToken) return res.status(500).json({ error: 'GitHub token not configured' });

  try {
    const { files, message } = req.body;
    // files: [{ path: 'public-knowledge.json', content: '...' }, ...]
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

    // Step 1: Get current commit SHA
    const refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error('Failed to get branch ref');
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // Step 2: Get the tree of the latest commit
    const commitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error('Failed to get commit');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // Step 3: Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blobRes = await fetch(`${apiBase}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8'
        })
      });
      if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
      const blobData = await blobRes.json();
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // Step 4: Create a new tree
    const treeRes = await fetch(`${apiBase}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    if (!treeRes.ok) throw new Error('Failed to create tree');
    const treeData = await treeRes.json();

    // Step 5: Create a new commit
    const newCommitRes = await fetch(`${apiBase}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: message || 'Update from CMS admin',
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Failed to create commit');
    const newCommitData = await newCommitRes.json();

    // Step 6: Update branch reference
    const updateRefRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha })
    });
    if (!updateRefRes.ok) throw new Error('Failed to update branch ref');

    return res.status(200).json({
      success: true,
      commitSha: newCommitData.sha,
      filesUpdated: files.length,
      message: message || 'Update from CMS admin'
    });

  } catch (e) {
    return res.status(500).json({ error: 'Deploy failed', detail: e.message });
  }
}

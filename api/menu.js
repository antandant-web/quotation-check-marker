import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const repo = process.env.GITHUB_REPO; // e.g. "username/design-quote-menu"
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD || '8888';
  const filePath = 'data/menu.json';

  // GET /api/menu -> Fetch latest menu.json (catalog + paymentModes) from GitHub API
  if (req.method === 'GET') {
    if (repo && token) {
      try {
        const ghUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
        const ghRes = await fetch(ghUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Design-Quote-Menu'
          }
        });
        if (ghRes.ok) {
          const fileData = await ghRes.json();
          const content = Buffer.from(fileData.content, 'base64').toString('utf8');
          return res.status(200).json(JSON.parse(content));
        }
      } catch (err) {
        // Fallback to local file below
      }
    }

    try {
      const localPath = path.join(process.cwd(), filePath);
      const raw = fs.readFileSync(localPath, 'utf8');
      return res.status(200).json(JSON.parse(raw));
    } catch (e) {
      return res.status(200).json({ catalog: [], paymentModes: {} });
    }
  }

  // POST /api/menu -> Verify password & commit updated catalog + paymentModes to GitHub
  if (req.method === 'POST') {
    const providedPwd = req.headers['x-admin-password'] || '';
    if (providedPwd !== adminPassword) {
      return res.status(401).json({ error: '管理員密碼錯誤 (Invalid ADMIN_PASSWORD)' });
    }

    const { catalog, paymentModes } = req.body || {};
    if (!Array.isArray(catalog)) {
      return res.status(400).json({ error: '無效的菜單資料格式 (Invalid catalog array)' });
    }

    if (!repo || !token) {
      return res.status(500).json({
        error: '尚未在 Vercel 設定 GITHUB_REPO 與 GITHUB_TOKEN 環境變數'
      });
    }

    try {
      const ghUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
      const getRes = await fetch(`${ghUrl}?ref=${branch}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Vercel-Design-Quote-Menu'
        }
      });

      let sha = undefined;
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }

      const newContentBase64 = Buffer.from(
        JSON.stringify({ catalog, paymentModes: paymentModes || {}, updatedAt: new Date().toISOString() }, null, 2),
        'utf8'
      ).toString('base64');

      const putRes = await fetch(ghUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Design-Quote-Menu'
        },
        body: JSON.stringify({
          message: 'chore(menu): update design quote menu & payment modes via web admin',
          content: newContentBase64,
          branch,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        return res.status(500).json({ error: `GitHub API 寫入失敗: ${errText}` });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

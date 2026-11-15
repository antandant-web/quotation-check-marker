import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// SHA-256 of initial password "123456"
const DEFAULT_PWD_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

export default async function handler(req, res) {
  const repo = process.env.GITHUB_REPO; // e.g. "username/design-quote-menu"
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;
  const envAdminPassword = process.env.ADMIN_PASSWORD;
  const filePath = 'data/menu.json';

  async function readExistingMenuData() {
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
          return { data: JSON.parse(content), sha: fileData.sha };
        }
      } catch (err) {
        // Fallback to local file
      }
    }

    try {
      const localPath = path.join(process.cwd(), filePath);
      const raw = fs.readFileSync(localPath, 'utf8');
      return { data: JSON.parse(raw), sha: undefined };
    } catch (e) {
      return { data: { catalog: [], paymentModes: {}, adminPasswordHash: DEFAULT_PWD_HASH }, sha: undefined };
    }
  }

  // GET /api/menu -> Fetch latest menu.json (catalog + paymentModes + adminPasswordHash)
  if (req.method === 'GET') {
    const { data } = await readExistingMenuData();
    return res.status(200).json(data);
  }

  // POST /api/menu -> Verify password & commit updated catalog + paymentModes + adminPasswordHash to GitHub
  if (req.method === 'POST') {
    const { data: existingData, sha } = await readExistingMenuData();
    const storedHash = existingData.adminPasswordHash || (envAdminPassword ? sha256(envAdminPassword) : DEFAULT_PWD_HASH);

    const providedPwd = req.headers['x-admin-password'] || '';
    const providedHash = req.headers['x-admin-password-hash'] || '';

    const isValid =
      (providedPwd && sha256(providedPwd) === storedHash) ||
      (providedPwd && envAdminPassword && providedPwd === envAdminPassword) ||
      (providedHash && providedHash === storedHash);

    if (!isValid) {
      return res.status(401).json({ error: '管理員密碼驗證失敗' });
    }

    const { catalog, paymentModes, adminPasswordHash } = req.body || {};
    if (!Array.isArray(catalog)) {
      return res.status(400).json({ error: '無效的菜單資料格式' });
    }

    if (!repo || !token) {
      return res.status(500).json({
        error: '尚未在 Vercel 設定 GITHUB_REPO 與 GITHUB_TOKEN 環境變數'
      });
    }

    try {
      const ghUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
      const newPayload = {
        catalog,
        paymentModes: paymentModes || existingData.paymentModes || {},
        adminPasswordHash: adminPasswordHash || storedHash,
        updatedAt: new Date().toISOString()
      };

      const newContentBase64 = Buffer.from(JSON.stringify(newPayload, null, 2), 'utf8').toString('base64');

      const putRes = await fetch(ghUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Design-Quote-Menu'
        },
        body: JSON.stringify({
          message: 'chore(menu): update design quote menu, payment modes & admin settings',
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

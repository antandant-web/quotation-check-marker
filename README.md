# 設計報價菜單 (Vercel + GitHub 自動儲存後端版)

這套專案讓你直接在網頁右上角「改價與菜單管理」調整底價、新增或刪除服務與加購規格，按下 **「同步儲存至 GitHub 雲端」** 後，Vercel Serverless API (`/api/menu.js`) 就會自動驗證你的密碼並將最新菜單寫回 GitHub 的 `data/menu.json`，完全不需要手動改 HTML！

## 部署步驟 (GitHub + Vercel)

1. **上傳至 GitHub**：將此資料夾內的所有檔案（`index.html`、`api/menu.js`、`data/menu.json`、`vercel.json`）上傳到你的 GitHub Repository。
2. **匯入至 Vercel**：在 Vercel 點擊 `Add New Project` 並連結該 GitHub Repository。
3. **設定 3 個環境變數 (`Settings -> Environment Variables`)**：
   - `ADMIN_PASSWORD`：設定你專屬的後台管理密碼（例如 `mySecret2026`）。
   - `GITHUB_REPO`：你的 GitHub 帳號與倉庫名稱（格式如 `yourname/design-quote-menu`）。
   - `GITHUB_TOKEN`：到 GitHub `Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens` 產生一組對該 Repo 具備 `Contents: Read and write` 權限的 Token。
   - `GITHUB_BRANCH`：（選填）預設為 `main`。

# Daily AI v0.1 Alpha

Daily AI 是一個 mobile-first、local-first 的個人事件日誌 PWA。它使用 React、TypeScript、Vite 與 IndexedDB，安裝後可在支援的 Android、iPhone 與 Windows 裝置上以獨立 App 形式啟動。

## 主要功能

- 新增、檢視、編輯與刪除每日事件
- 關鍵字、分類、Tag 與日期範圍組合篩選
- 月份、分類與最近六個月事件統計 Dashboard
- 照片與附件的本機新增、預覽、下載與移除
- `Daily.xlsx` 事件資料匯出／匯入
- 包含事件與原始附件的 ZIP 完整備份／還原
- PWA 安裝提示、離線操作與使用者確認後才套用的新版本更新
- 淺色／深色模式與行動裝置 safe-area 支援

## 安裝

網站部署到 GitHub Pages 後會使用免費 HTTPS。PWA 安裝需要 HTTPS（本機開發的 `localhost` 除外）。

- Android Chrome：開啟網站後使用 App 內的「安裝 Daily AI」，或瀏覽器選單的「安裝應用程式」。
- Windows Chrome／Edge：開啟網站後使用 App 內的安裝按鈕，或網址列的安裝圖示。
- iPhone Safari：點選「分享」，再選擇「加入主畫面」。iOS 不提供標準的程式化安裝提示，因此 App 會顯示操作說明。

安裝完成並至少成功載入一次後，App Shell 可離線重新開啟。事件與附件功能本身使用本機資料庫，不依賴網路連線。

## 資料儲存與備份

事件、Tags、照片與附件全部儲存在目前瀏覽器／PWA 安裝項目的 IndexedDB。資料不會自動上傳，也不會跨瀏覽器或跨裝置同步。

> **重要：** 清除網站資料、瀏覽器儲存空間或移除 PWA 時選擇刪除資料，可能永久刪除所有本機事件與附件。請定期建立完整 ZIP 備份。

- **Excel 備份**：`Daily.xlsx` 包含事件、Tags 與附件 metadata，但**不包含實際照片或附件檔案**。
- **完整備份**：`Daily-AI-Backup-YYYY-MM-DD.zip` 包含 `Daily.xlsx`、`manifest.json` 與所有照片／附件原始檔案。

還原完整備份前，App 會先驗證 ZIP 結構、版本、路徑、附件數量與大小；損壞或不安全的備份不會覆蓋既有資料。

### 備份與還原操作

1. 開啟 **Settings**。
2. 日常資料交換可使用「匯出備份」建立 Excel；選取 `Daily.xlsx` 後按「匯入備份」即可還原事件資料。
3. 要保留照片與附件時，請使用「匯出完整備份」建立 ZIP；選取 ZIP 後按「完整還原」。
4. 匯入前確認提示中的事件與附件範圍，完成後再到 Daily Timeline 抽查資料。

## 本機開發

需求：Node.js 20+ 與 pnpm。

```bash
pnpm install
pnpm dev
```

完整檢查與正式建置：

```bash
pnpm test
pnpm build
pnpm preview
```

`dist/` 是可部署的靜態 PWA。部署平台必須提供 HTTPS，並將未知的 SPA 路徑回退到 `/index.html`。

## GitHub Pages 部署

專案包含 `.github/workflows/deploy-pages.yml`。Workflow 會自動判斷 GitHub Pages 專案子路徑，執行測試及 PWA build，再部署 `dist/`。`404.html` 提供 React Router 深層路由重新整理 fallback；localhost 仍使用 `/` 作為 base path。

1. 在 GitHub 建立 Repository，將本機專案推送到 `main` 或 `master`。
2. Repository → **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 到 **Actions** 查看 `Deploy Daily AI to GitHub Pages`，成功後由該次 deployment 開啟 HTTPS 網址。

不需要 Azure、Microsoft Entra、API Key 或部署用 `.env`。若 Repository 是 private，請先確認你的 GitHub 方案是否允許該 Repository 使用 Pages；公開 Repository 可直接使用 GitHub Pages。

## 已知限制

- AI Parsing 目前使用固定規則的 Mock Provider，沒有呼叫 OpenAI。
- 尚未啟用 OneDrive。
- 沒有跨裝置同步；每個瀏覽器／安裝項目的資料彼此獨立。
- iPhone 的安裝動作必須由使用者透過 Safari「加入主畫面」完成。

完整發布內容請見 [RELEASE_NOTES.md](./RELEASE_NOTES.md)。

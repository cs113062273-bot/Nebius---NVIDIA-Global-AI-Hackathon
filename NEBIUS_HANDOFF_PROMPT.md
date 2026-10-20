# Claude / 下一位代理交接：把 Tabstitch 變成真正的 Nemotron 修復作品

你現在接手 Tabstitch。使用者於 **2026-10-21（台灣時間）表示已取得 Nebius**。請直接推進實作，不要只回覆計畫或再次解釋 API 的價值。

目標是提高 Nebius × NVIDIA Global AI Hackathon 的得獎競爭力。**最重要的成果是一段真的由模型提出修補、真的重播成功、評審容易看懂的完整流程。** 不保證得獎，不捏造數字。

## 先掌握現況

工作區：`C:\Users\c9408\Desktop\Nebius × NVIDIA Global AI Hackathon`

遠端：`https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon.git`

先看 `git status`、`AGENTS.md`、`README.md`，再針對需要讀程式。`FINAL_AUDIT.md` 的數字是 10 月 20 日的歷史紀錄，不是請你重跑全部測試的清單。舊 prompt 的大量測試要求已被使用者最新偏好取代。

目前可用：

- Node 24、Playwright、axe-core 的本機工作台；`npm start` → `http://127.0.0.1:4317`。
- 鍵盤旅程、焦點／AX／截圖證據、隔離修補、同一旅程重播、功能結果判定及證據下載。
- 首頁三個錄製案例：掃描零違規卻無法鍵盤送出、可操作但結果錯誤的修補、a11y-dialog 真實歷史焦點缺陷。附來源差異與 Presentation view。
- Token Factory 客戶端已有模型 catalog、JSON 修補契約、快取、額度限制與失敗來源紀錄。

必須承認的差距：主要成功路徑仍是作者參考修補；歷史案例是公開人工修補重播；沒有已證實的 Nebius/NVIDIA 自主修復。React/Next.js 完整流程與公開 live demo 尚未完成。不要把這些已知缺口藏在漂亮介面後。

## 第一步：取得第一個真實修補結果

1. 安全檢查 `.env` 或環境變數是否已設定。**不要印出、貼上、提交 API Key，也不要要求使用者把金鑰貼到聊天。** 此交接建立時工作區未發現 `.env`，相關環境變數也未出現；使用者取得 Nebius 不代表已完成本機設定。
2. 僅用免費／贊助額度；確認對應設定，保留 US$0 現金支出約束。不擅自開啟付費或充值。若缺憑證，只指出缺少的設定項，繼續其他有價值工作。
3. 核對當前官方文件與帳號實際 catalog，選擇可用的 NVIDIA Nemotron；不要憑記憶硬填模型 ID。
4. 先做一次有界的 live 修復。看實際錯誤修客戶端／提示／來源定位，不要首先擴充測試套件或跑多模型大型比較。
5. 成功與失敗都保留真實模型提案、來源差異、回應 ID、模型 ID、用量、耗時及重播結果。模型不能改掉任務或功能驗收來獲得通過。

現有設定模板：`.env.example`。必要欄位：

```dotenv
NEBIUS_API_KEY=<只在本機設定>
LIVE_NEBIUS_TESTS=true
NEBIUS_SPONSOR_CREDITS_CONFIRMED=true
NEBIUS_MODEL=<帳號 catalog 實際回傳的 NVIDIA Nemotron ID>
```

只有確認免費／贊助額度條件後，才將確認旗標設為 true。不要把上述說明用的尖括號文字當成真正值。

現有入口：

```powershell
npm run live:smoke
# 上一行查 catalog；設定精確模型 ID 後：
npm run live:smoke -- --repair
```

`--repair` 目前固定以 checkout 做一次模型修補嘗試。若另一個案例更適合先獲得有意義的成果，請把入口改為可選擇案例，而不是繼續堆合成 fixtures。

主要檔案：`src/nebius.js`、`src/engine.js`、`src/repair.js`、`src/runner.js`、`src/verifier.js`、`scripts/live-smoke.js`。

## 有幾個值得直接檢查的整合點

- 現有請求固定 `temperature: 0`、`max_tokens`、strict `json_schema`、45 秒逾時。這些尚未用真實帳號驗證；依官方文件與實際端點行為調整，不要假設每個 Nemotron 模型支援相同參數。失敗不可以偷偷改走另一家 API 或 reference patch。
- token 預留用 UTF-8 byte 數加輸出上限，可能比實際 token 保守很多。若單次任務被擋，先縮小輸入，勿刪掉 ledger 或直接取消預算限制。
- `artifacts/inference/budget.json` 記錄推論預留；失敗／未知用量不會自動退回。快取回應必須標為快取，不能算新的 runtime 呼叫。
- 來源修補採 allowlist、原始 hash 與唯一文字匹配。若 patch 不適用，查明來源與輸出差異；不要為了通過而移除邊界或更改 oracle。
- 真實成功後再更新 live status、首頁案例與提交素材。錄製的真實推論可以展示，但必須清楚區分「錄製 runtime 證據」與「訪客即時執行」。

## 每個重大改動先看外面

有界地比較最新強作與直接競品，讀原始來源；別複製程式。既有比較在 `docs/competitive_landscape.md`。起點：

- MUTINY：https://devpost.com/software/mutiny — 真實 PR、模型生成輸入與可檢查的執行差異。
- Mender：https://devpost.com/software/mender-kubernetes-incident-to-fix-agent — 實際診斷／修補流程與模型用量。
- PortVerdict：https://devpost.com/software/portverdict — 真實 sponsor 執行、候選拒絕與公開回放。
- AccessPatch：https://devpost.com/software/accesspatch
- AccessPatch EU：https://devpost.com/software/accesspatch-eu
- AccessPilot：https://github.com/joinarun/accesspilot

後三者與無障礙修補／重播直接重疊，不一定是同場參賽者。「有 evidence bundle、有 deterministic gate」已不足以宣稱獨特。比較對方公開證據、我們已執行的內容與未知事項；不要編造對手缺點。

官方規則：https://nebiusglobalaihackathon.devpost.com/rules

FAQ：https://nebiusglobalaihackathon.devpost.com/details/faqs

核對最新截止、評分與 sponsor 要求，不要只靠舊文件。

## 使用者最在意的工作方式

- **不要以新增 tests、benchmark 數、文件頁數或 audit 輪數交差。** 一般修改簡短實跑；有實際風險再做針對性檢查。不重下載瀏覽器、不重跑 clean room，除非新問題確實需要。
- 優先順序：真實模型修復 → 有說服力的實際用途／案例 → 三分鐘展示 → 清楚的評審存取方式。不是先把支援框架名稱湊滿。
- 做出第一個真實結果後，選最多兩個最有價值的差距繼續改善。多個簡單範例不能取代一個有深度的流程。
- 不把作者 patch／人工歷史修補說成 AI 自主成果；不虛構 benchmark／用戶回饋，不宣稱完整 WCAG conformance 或實際螢幕閱讀器驗證。
- 不盲目執行第三方 repository 安裝腳本；金鑰不進前端、prompt、輸出或 Git。保留使用者既有修改。此交接的 Git 推送不代表雲端付費或公開部署授權。

## 最後交付

短報告即可：模型實際做了什麼、哪個任務從失敗變成功、具體優於目前競品展示之處、實際用量／耗時與未解缺口。給最短啟動／展示步驟。

不要只列待辦，也不要再問「要不要開始」。先完成一個有份量、來源可信的 Nebius/Nemotron 修補流程。

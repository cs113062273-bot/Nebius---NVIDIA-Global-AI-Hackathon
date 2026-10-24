# Claude / 下一位代理交接：延續 Tabstitch 已驗證的 Nemotron 修復成果

你現在接手 Tabstitch。**2026-10-21（台灣時間）已有 checkout 與 a11y-dialog 歷史缺陷兩個 Nemotron 修補通過 VERIFIED_PASS。** 使用者追加授權的 3 次／US$0.25 credits 已執行完畢，估算使用 US$0.082961 credits；其中兩次失敗、一個歷史修補成功。不要繼續新增推論。使用者最新要求是作品本身達高品質完整水準；影片由使用者處理，不要延伸影片、訪談或投稿包裝工作。

目標是提高 Nebius × NVIDIA Global AI Hackathon 的得獎競爭力。**最重要的成果是一段真的由模型提出修補、真的重播成功、評審容易看懂的完整流程。** 不保證得獎，不捏造數字。

## 先掌握現況

工作區：`C:\Users\chinh\Desktop\Nebius---NVIDIA-Global-AI-Hackathon`

遠端：`https://github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon.git`

先看 `git status`、`AGENTS.md`、`README.md`，再針對需要讀程式。`FINAL_AUDIT.md` 的數字是 10 月 20 日的歷史紀錄，不是請你重跑全部測試的清單。舊 prompt 的大量測試要求已被使用者最新偏好取代。

目前可用：

- Node 24、Playwright、axe-core 的本機工作台；`npm start` → `http://127.0.0.1:4317`。
- 鍵盤旅程、焦點／AX／截圖證據、隔離修補、同一旅程重播、功能結果判定及證據下載。
- 首頁已改為同步逐步重播兩個模型修補，顯示真實焦點座標、差異、驗收、所有四次呼叫（含失敗）與完整 proof 下載。`/cases.html` 保留舊案例。
- `/project.html` 可選擇原始及修改後的靜態專案資料夾，編輯鍵盤步驟與功能契約，再驗證修補；不改原始檔案、不安裝依賴、不執行專案伺服器。只限本機；公開模式禁止匯入。
- `/workbench.html` 可對 checkout／a11y-dialog 選 Recorded Nemotron patch，重新跑瀏覽器而不新增推論。這是既有模型計畫重驗，不是新的模型成果。
- Token Factory 客戶端已有模型 catalog、JSON 修補契約、快取、額度限制與失敗來源紀錄。

成果範圍：一個合成 checkout 與一個非盲測的公開歷史缺陷。歷史案例使用 pinned upstream 的去型別 JS 與重建 notice 任務；不是新發現或已提交上游的修補。不能推算通用修復成功率。產品支援靜態 HTML/CSS/JS/SVG，沒有框架建置或真實螢幕閱讀器驗證。

## 已驗證的推論成果與下一步邊界

已觀察到的事實（2026-10-21）：

- 金鑰已存本機 `.env`；`git check-ignore .env` 確認 Git 忽略此檔，未上傳 GitHub。**不要印出、貼上或提交金鑰，也不要要求使用者再次貼到聊天。**
- 連線檢查曾收到 HTTP 200、28 個模型；總共四次真實 completion，兩個已知案例成功。Checkout 證據：`benchmarks/live/f79fedbc-405f-4f47-9297-1ece840b5d09/`。歷史修補：`benchmarks/live/fa95dcbd-3dd6-4451-9cd9-aafd690606e8/`。
- 模型 `nvidia/Nemotron-3-Ultra-550b-a55b`；`cacheHit=false`、`attemptedCompletions=1`、`retries=0`。固定 checkout 旅程及功能驗收為 `VERIFIED_PASS`，不代表完整無障礙合規。
- 用量 2,381 prompt tokens、4,222 completion tokens（含 3,065 reasoning tokens），模型耗時 12,971 ms。報告按 catalog 價格估算約 US$0.015 credits，並非帳單扣款證明。
- `benchmarks/live/` 是精簡歸檔；`public/recordings/<id>/proof.tar.gz` 則包含完整原始 manifest 對應檔案，完整性已驗證。歷史案例的 request.json 是由凍結輸入重建且 prompt hash 匹配，不得稱成從 HTTP transport 擷取的原始封包。
- 使用者提供的帳戶截圖顯示 Account balance $50，另有 Trial $1；截圖不能證明餘額全部來自贊助，也不能證明已停用超額計費。
- 本機 `LIVE_NEBIUS_TESTS=false`，總呼叫上限 4 已用完；追加授權 scope 為 real-case-20261021，USD ceiling 0.25。不要提高上限或刪 ledger。已保存的模型計畫可零推論重驗。

目前可推進不新增推論的工作。`npm run live:catalog` 可獨立檢查連線，不需要開啟推論旗標；不要輸出 Authorization 或金鑰。

### 取得新增推論授權後，才考慮其他案例

1. 安全檢查本機金鑰是否仍存在，不顯示內容；不要重建或覆寫使用者既有設定。
2. 僅用免費／贊助額度；確認額度來源與不產生現金支出的條件，保留 US$0 約束。不擅自開啟付費或充值。若尚未確認，繼續其他有價值工作。
3. 核對當前官方文件與帳號實際 catalog，選擇可用的 NVIDIA Nemotron；不要憑記憶硬填模型 ID。
4. 第一個真實修復已完成。新增推論要針對有價值的案例或具體未知事項，不要重跑成功案例、先擴充測試套件或跑多模型大型比較。
5. 成功與失敗都保留真實模型提案、來源差異、回應 ID、模型 ID、用量、耗時及重播結果。模型不能改掉任務或功能驗收來獲得通過。

現有設定模板：`.env.example`。以下僅為**獲准推論並確認額度條件後**的設定，不是目前值：

```dotenv
NEBIUS_API_KEY=<只在本機設定>
LIVE_NEBIUS_TESTS=true
NEBIUS_SPONSOR_CREDITS_CONFIRMED=true
NEBIUS_MODEL=<帳號 catalog 實際回傳的 NVIDIA Nemotron ID>
```

只有獲得明確推論授權並確認免費／贊助額度條件後，才將旗標設為 true。保留現有單次呼叫上限與 token 預算；不要把上述尖括號文字當成真正值。

現有入口：

```powershell
npm run live:catalog
npm run live:smoke -- --dry-run --fixture checkout
# 以下會呼叫模型：只在取得新增授權與確認預算後執行
npm run live:smoke -- --repair --fixture <已選案例ID>
```

`--fixture` 已支援選案例，`--dry-run` 只在本機重現並估算請求預算。展示既有成果：`npm start` → `http://127.0.0.1:4317` → case 01 → Presentation view。

主要檔案：`src/nebius.js`、`src/engine.js`、`src/repair.js`、`src/runner.js`、`src/verifier.js`、`scripts/live-smoke.js`。

## 有幾個值得直接檢查的整合點

- structured output 已依 catalog 能力決定；不支援時把 schema 放入 prompt，仍嚴格驗證輸出。此次 Ultra 呼叫 `structuredOutput=false`，不可宣稱供應商保證 JSON schema。輸出上限已支援 8,000 tokens，逾時預設 120 秒。
- 有收到 completion payload 的呼叫，在 schema 解析前保存原始內容、reasoning、request ID 與 finish reason；HTTP 錯誤或網路中斷未必有完整回應，不宣稱所有失敗都能取得上述欄位。
- token 預留用 UTF-8 byte 數加輸出上限，可能比實際 token 保守很多。若單次任務被擋，先縮小輸入，勿刪掉 ledger 或直接取消預算限制。
- `artifacts/inference/budget.json` 記錄推論預留；失敗／未知用量不會自動退回。快取回應必須標為快取，不能算新的 runtime 呼叫。
- 來源修補採 allowlist、原始 hash 與唯一文字匹配。若 patch 不適用，查明來源與輸出差異；不要為了通過而移除邊界或更改 oracle。
- live status 與首頁首例已更新。錄製的真實推論可以展示，但必須清楚區分「錄製 runtime 證據」與「訪客即時執行」。舊三個案例原始 artifacts 不在本機；builder 保留發布條目，不代表重新執行成功。

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
- 優先改善作品本身：使用者帶入專案、定義任務、得到可檢查結果的完整體驗。不要把影片、上架或訪談當作品分數的前置條件；影片由使用者處理。不是先把支援框架名稱湊滿。
- 做出第一個真實結果後，選最多兩個最有價值的差距繼續改善。多個簡單範例不能取代一個有深度的流程。
- 不把作者 patch／人工歷史修補說成 AI 自主成果；不虛構 benchmark／用戶回饋，不宣稱完整 WCAG conformance 或實際螢幕閱讀器驗證。
- 不盲目執行第三方 repository 安裝腳本；金鑰不進前端、prompt、輸出或 Git。保留使用者既有修改。此交接的 Git 推送不代表雲端付費或公開部署授權。

## 最後交付

短報告即可：模型實際做了什麼、哪個任務從失敗變成功、具體優於目前競品展示之處、實際用量／耗時與未解缺口。給最短啟動／展示步驟。

不要只列待辦；完成已授權的產品工作，保留真實修補與失敗證據。沒有新增推論授權就不增加模型呼叫。不要重做已完成的歷史模型修補，不要去做影片或訪談；重大實作前先比較當前競品證據。

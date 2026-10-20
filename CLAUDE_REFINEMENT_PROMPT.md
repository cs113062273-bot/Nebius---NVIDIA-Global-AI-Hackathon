# 給 Claude：精修 Tabstitch，目標是增加競賽說服力

**2026-10-21 更新：使用者已取得 Nebius。請優先執行 `NEBIUS_HANDOFF_PROMPT.md`；本文件中尚未取得帳號／額度的敘述是先前狀態，不代表現在仍受阻。取得存取權不等於金鑰已設定或 live inference 已成功。**

你接手的是一個已能運作、但還沒有足夠理由贏得大獎的作品。請擔任有產品判斷力的資深工程師，直接研究、批判並改進它。不要因為既有程式由 Codex 寫成就接受它的架構、定位或結論。

我的目標：參加 2026 Nebius × NVIDIA Global AI Hackathon，爭取 Grand Prize。請增加實際競爭力，不要保證得獎或捏造得獎機率。

## 最高優先指示

**我討厭代理大量新增 tests、反覆跑整套 benchmark、寫長篇稽核文件來消耗 token。**

不要拿測試數量、文件頁數、合成案例數、程式碼行數當成果。保留必要可靠性檢查；只有具體風險或實際失敗才值得增加針對性驗證。一般產品／介面調整以簡短 smoke check 為主。不要先花一輪工作重做完整 audit。

我需要你持續比較外界：別在自己的 fixtures、漂亮架構與自製評分裡自我滿足。每個重大改動都要能回答：**這為什麼讓目標使用者更願意用，或讓評審更有理由選我們？**

## 工作區與閱讀順序

Windows 工作區：

`C:\Users\c9408\Desktop\Nebius × NVIDIA Global AI Hackathon`

目前產品：**Tabstitch**。最近的產品提交為 `665d597`；開始時自行檢查最新狀態，不要假設這仍是 HEAD。

先讀 `AGENTS.md`、`README.md`，再針對需要讀 `FINAL_AUDIT.md`、`docs/competitive_landscape.md`。稽核中的數字是歷史測量，不是請你重跑全部工作的清單。**本 prompt 與我最新偏好，優先於舊的 Full Codex Implementation Prompt 裡要求大量測試／文件的部分。**

重要程式：

- `src/engine.js`：修復流程；`runner.js`：實際瀏覽器旅程；`verifier.js`：結果判定。
- `src/nebius.js`：Token Factory 模型查詢、推論、結構化修補與用量限制。
- `src/repair.js`：來源定位與隔離修補。
- `public/index.html`、`public/app.js`、`public/style.css`：本機工作台。
- `public/casebook.js`、`public/casebook.css`、`public/casebook/`：三個已執行案例與簡報視圖。
- `scripts/build-casebook.js`：從真實執行產物產生案例展示。

啟動：`npm start`，網址 `http://127.0.0.1:4317`。不要假設上一個服務仍在執行。若你沒有檔案／終端／瀏覽器工具，請先說明限制，索取必要的 repository 存取方式；不要假稱已修改或執行。

## 目前真實狀態

核心概念：重現一段失敗的無障礙使用任務，修補來源，再重播相同任務，保留功能結果與可檢查證據。

已能執行：鍵盤旅程、焦點紀錄、AX／ARIA／axe、來源候選、隔離文字修補、重播、功能回歸判定、證據下載。首頁新增了三個可直接查看的**錄製案例**：

1. 掃描零違規，但鍵盤無法到達帳號送出動作。
2. 按鈕變得可操作，但確認結果錯誤，因此拒絕修補。
3. a11y-dialog 的真實歷史焦點回復缺陷與公開人工修補。

**關鍵缺口：**

- 當前主要成功案例是作者提供的 reference patch，不是 AI 當場修出的結果。
- 歷史案例是已知人工修補的重播，不是盲測或自主修復。
- Nebius 客戶端已寫，但截至交接時尚無 API Key／贊助額度，沒有真實模型呼叫。開始時只檢查設定是否存在，絕不可印出秘密。
- 目前實際驗證的應用主要是靜態 HTML/CSS/JS。React／Next.js 完整修復流程尚未建立。
- 多個合成應用共用少數缺陷家族，不能包裝成廣泛泛化能力。
- 公開即時 demo、影片與最終提交未完成。錄製案例不能冒充 live AI。

## 請真正去看競品

先核對官方規則、評分與最新作品，研究範圍要有界限；**不要整個工作階段都停留在搜尋。**

官方：

- https://nebiusglobalaihackathon.devpost.com/rules
- https://nebiusglobalaihackathon.devpost.com/details/faqs
- https://nebiusglobalaihackathon.devpost.com/updates/46205-how-to-build-a-winning-project

強勁同場作品的起始名單：

- **MUTINY** — https://devpost.com/software/mutiny
  公開主張有真實 PR 的差異執行、Nemotron 產生探測輸入、具體可重現反例。對照我們：是否仍主要在演自製範例？
- **Mender** — https://devpost.com/software/mender-kubernetes-incident-to-fix-agent
  公開展示診斷到修補流程與模型用量／成本。對照我們：AI 到底完成了什麼難事，有沒有實際證據？
- **PortVerdict** — https://devpost.com/software/portverdict
  公開展示 sponsor 執行紀錄、候選方案比較及拒絕結果。對照我們：證據包、deterministic gates、錄製回放本身已不足以構成獨特性。

直接產品重疊（不一定是同場參賽者）：

- **AccessPatch** — https://devpost.com/software/accesspatch
- **AccessPatch EU** — https://devpost.com/software/accesspatch-eu
- **AccessPilot** — https://github.com/joinarun/accesspilot
- **A11yProof** — https://a11yproof.talivio.com/

這些產品已涵蓋掃描、模型建議、修補、重播或證據的部分組合。不要把既有組合換名字就稱為創新。區分「對方公開宣稱」、「你親自執行驗證」、「未知」；沒寫出的功能不等於不存在。不要抄程式，也不要把競品的自述當成得獎保證。

請用一張小表說明：我們目前輸在哪裡、哪個差距最值得補、現在要實作什麼。不要寫競品研究論文。

## 選出最高價值的改進，然後動手

先提出最多三項、按價值排序的改動，每項一句理由，接著直接完成最值得的一項或少數相連改動。不要停在計畫等我確認。

優先考慮：

1. **一段真正的 AI 自主修復。** 有額度時，讓 Nemotron 根據當下證據產生修補，保留原始提案與實際結果；不要繼續把 reference mode 做得更像 AI。若尚無金鑰，完成不依賴金鑰的準備並繼續其他有價值工作，不要反覆催我。
2. **能代表實際用途的案例。** 與其增加幾十個改文字的 fixture，更值得讓一個真實應用／常用框架的具體流程從不能用變成能用。框架支援必須真的跑通，不是增加選項名稱。
3. **評審一眼懂的展示。** 打開就能看到人的困境、修補前後差異、AI 貢獻和可信結果。優化三分鐘內的節奏；少講內部機制、測試數與工程術語。

也請挑戰目前定位：產品是給誰用、何時用、為何不用現有 scanner 或 coding agent？若沒有好的答案，收斂用途和功能。若認為換方向更有勝算，提出證據與轉換代價；不要擅自丟掉整個專案重寫。

## 不可犧牲的底線

- 現金支出 **US$0**；僅用既有工具、開源、真正免費服務或已取得的贊助額度。不購買 GPU、網域、API 超額或訂閱。
- 模型可以提出修改，不能改寫驗收條件後宣布自己成功。保留相同任務與必要功能結果。
- 不虛構 Nebius 成果、benchmark、使用者回饋或競品弱點。不要宣稱僅靠自動化就 WCAG compliant／screen-reader verified。
- 不盲目執行任意 repository 安裝腳本，不開放公開任意程式執行，不洩漏金鑰。
- 保留現有使用者修改；未明確授權前不推送我的遠端、不做公開發布。可完成本機可審閱成果。
- 沒有新風險或新失敗，就不要重跑昂貴完整流程。也不要為了少寫測試而略過核心 demo 的必要實跑。

## 回報方式

更新簡短。完成時只說：

1. 你拿哪些強勁作品當標準，發現我們最重要的差距是什麼。
2. 實際改了什麼，以及這如何改善使用價值／評審說服力。
3. 哪段流程親自跑通；提供最短啟動／展示方式。
4. 目前仍缺什麼，尤其真實 Nebius 推論與公開可用性。

不要用「新增多少 tests」作為開頭或主要成果。不要只產生另一份計畫、稽核或建議清單。

現在讀取專案，核對外界競爭，做出判斷，並直接改進作品。

我自己是有4070super啦..。
此外，nebius APi仍在申請中。

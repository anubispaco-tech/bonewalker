# 亡骨行者 Online

不死族骨法師的單機 MMORPG。手機直式、低多邊形 3D、Tab-Target 讀條戰鬥，10 級職業任務後選擇冰霜、火焰或奧術專精。

## 檔案結構

| 路徑 | 內容 |
|---|---|
| `index.html` | 頁面骨架與 UI |
| `css/style.css` | 介面樣式 |
| `js/config.js` | 設定：GAS 網址、版本號 |
| `js/data.js` | **遊戲內容**：任務、地區、專精、天賦、物品、NPC、怪物營地。調數值、加任務只改這裡 |
| `js/game.js` | 遊戲引擎：渲染、戰鬥、AI、UI |
| `assets/` | KayKit 角色與武器模型（CC0） |
| `gas/Code.gs` | 遊玩數據與天梯後端（Google Apps Script） |
| `sw.js`、`manifest.webmanifest`、`icons/` | 加到主畫面、離線快取 |

## 開啟天梯與數據收集

1. 新建一份 Google 試算表 → 擴充功能 → Apps Script → 貼上 `gas/Code.gs`
2. 部署 → 新增部署作業 → 網頁應用程式（執行身分：我；存取權：所有人）
3. 把網址貼到 `js/config.js` 的 `GAS_URL`

## 改版注意

改了 `js/`、`css/` 或 `index.html` 後，把 `js/config.js` 的 `VERSION` 與 `sw.js` 的 `CACHE` 一起加一版，玩家才會拿到新檔案。

## 素材授權

角色與武器模型來自 Kay Lousberg 的 KayKit Character Pack: Skeletons 與 Adventurers，採 CC0 授權。

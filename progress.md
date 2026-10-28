# 3D 山路甩尾衝山（Drift Downhill 3D）開發進度與驗證記錄

## 專案核心需求
- **遊戲類型**：手機直向（Portrait 9:16）3D 賽車甩尾單手休閒網頁遊戲。
- **操作方式**：單手虛擬搖桿操控（支援動態浮動搖桿、觸控、鍵盤 WASD/方向鍵）。
- **賽道設計**：從山頂（海拔 Y = 180m）一路蜿蜒到山腳（海拔 Y = 0m）的下坡山道，抵達終點即完賽結算。
- **甩尾計分**：連續甩尾滑動、入彎角度、速度與邊緣漂移累積 Combo 連擊倍率與分數。
- **搞笑路邊障礙物**：路旁設有觀賽群眾、橘貓、柴犬、三角錐、西瓜箱等搞笑障礙物；依據甩尾衝擊力道擊飛（Yeet Physics），拋物線彈射升空並給予高額衝擊加分與趣味彈跳文字。
- **視覺風格**：日系輕量 Low-Poly、柔和明亮淺色調（薄荷綠草坡、溫潤奶油黃、櫻花粉、天藍晴空、溫和光影不刺眼）。
- **結算分享**：完賽後統計總分、甩尾分、撞飛物數量（貓咪、狗狗、觀眾、西瓜等），生成拍立得風格成績分享卡，支援 Web Share API 與圖片儲存。

---

## 本專案自動調用之 Skills 對照表 (`C:\Users\john.hu\.agents\skills\`)

| 需求領域 | 自動調用之 Skill | 於本專案之落地實踐 |
| :--- | :--- | :--- |
| **自動化測試閉環** | `openai-develop-web-game` | Playwright 端到端驗證、`window.render_game_to_text()`、`window.advanceTime(ms, render)` 確定性模擬、測試截圖保存 |
| **社群小遊戲特性** | `threads-web-game` | `100dvh` 直向防滑動捲動、拍立得成績圖 Canvas 生成、Web Share API 分享與免下載截圖保存 |
| **手感與打擊感** | `game-feel`<br>`physics-tuning` | 撞飛定格 (Hit-Stop)、螢幕震動 (Trauma Decay)、速度感動態 FOV、車身傾斜與輪胎白煙粒子、固定步長 (Fixed Timestep 60Hz) 物理積分 |
| **3D 場景與光影** | `threejs-scene-setup`<br>`threejs-materials`<br>`threejs-lighting` | 柔和薄荷綠與奶油白低多邊形山脈、乾淨瀝青路面、櫻花樹與杉樹、雙側安全護欄、溫和無刺眼陰影 |
| **輸入系統** | `input-systems`<br>`threejs-interaction` | 下半螢幕動態錨定觸控搖桿、死區與回彈阻尼、鍵盤替代方案、單手極簡操作 |
| **音效合成** | `audio-design` | Web Audio API 程序化合成器：引擎平滑升降調、輪胎磨地尖叫白噪音、擊飛卡通彈跳音、完賽號角與 Lo-Fi 和弦 BGM |
| **效能優化** | `threejs-performance` | 幾何重用、Draw Call 最小化、無垃圾回收壓力物件池、穩定 60 FPS |

---

## 專案模組架構 (`d:\AGYWorkspace\WebG\src\`)

```text
d:\AGYWorkspace\WebG\
├── index.html                        # 直向移動端視圖、HTML5 Canvas、HUD 與結算覆蓋層
├── package.json                      # 專案依賴與腳本
├── src/
│   ├── main.js                       # 遊戲進入點、固定步長主循環、測試 Hooks 暴露
│   ├── core/
│   │   ├── constants.js              # 賽道參數、賽車動力學常數、甩尾計分係數、障礙物擊飛定義、溫和調色盤
│   │   ├── gameState.js              # 狀態機管理、甩尾/擊飛計分、Combo 連擊衰減、幽默評價稱號結算
│   │   └── audioEngine.js            # Web Audio API 合成音效引擎（引擎聲、胎鳴、彈跳 Yeet、Lo-Fi 和弦）
│   ├── physics/
│   │   ├── trackSpline.js            # CatmullRomCurve3 山路曲線、切線與法線計算、前向導向搜尋投影
│   │   ├── vehiclePhysics.js         # 賽車動力學、重力加速度、轉向/漂移偏航角、護欄法線回彈修正
│   │   └── yeetPhysics.js            # 搞笑障礙物拋物線動力學、衝擊力道計算、邊界與重力模擬
│   ├── rendering/
│   │   ├── sceneManager.js           # Three.js 場景、透視相機、柔和日系霧氣與色調映射、燈光追蹤
│   │   ├── trackRenderer.js          # 山道瀝青路面、黃色虛線、雙側防護欄、低多邊形山體地形、山頂與山腳拱門
│   │   ├── vehicleMesh.js            # 復古小跑車模型（車身、導流尾翼、轉向車輪、尾燈、排氣管火焰）
│   │   ├── obstacleEntities.js       # 低多邊形觀賽人、橘貓、柴犬、三角錐、西瓜箱等 3D 模型
│   │   ├── particleSystem.js         # 輪胎白煙微粒特效、3D 空間飄浮計分文字（+500 YEET!）
│   │   └── cameraController.js       # 第三人稱跟隨相機、荷蘭角傾斜、動態 FOV、Trauma 震屏效果
│   ├── input/
│   │   ├── touchJoystick.js          # 單手虛擬搖桿（觸控滑動、死區限制、自定義回彈）
│   │   └── shareCardGenerator.js     # 拍立得風格成績卡 Canvas 繪製、Web Share API / 下載備援
│   └── ui/
│       ├── style.css                 # 100dvh 手機直向樣式、薄荷綠與奶油白按鈕、無刺眼陰影
│       └── hudOverlay.js             # 實時速度儀、連擊徽章、甩尾提示條、完賽結算對話框
└── tests/
    ├── runners/
    │   └── run_drift_qa.js           # Playwright 端到端全自動化測試腳本
    └── artifacts/
        ├── 01_start_screen.png       # 初始歡迎畫面截圖
        ├── 02_mid_drift.png          # 彎道甩尾進行中截圖
        ├── 03_yeet_gameplay.png      # 擊飛障礙物衝擊截圖
        └── 04_finish_summary.png     # 完賽成績結算卡片截圖
```

---

## 自動化測試驗證結果 (Playwright QA Verification)

- **測試執行命令**：`node tests/runners/run_drift_qa.js`
- **測試結果**：✅ 全部測試項目通過（Exit Code 0）
- **詳細指標**：
  1. **進入競速狀態**：成功自歡迎畫面切換至 `RACING` 模式，初始進度 `0.008`。
  2. **甩尾動力學觸發**：轉向進入彎道，觸發 `isDrifting: true`，速度維持 `6.5~24 m/s`（更放鬆、易於單手操控的下坡巡航速度），漂移計分與 Combo 增益正常運作。
  3. **搞笑障礙物擊飛**：沿途成功撞飛 56+ 個動態徘徊障礙物（人、橘貓、柴犬在路面來回橫穿巡邏），獲得 `29,000+` 撞飛高分。
  4. **下山抵達終點**：車輛自然沿著下坡山道行駛至進度 `0.96` 觸發 `FINISHED` 完賽結算，生成總分 `30,361` 分與評級稱號。
  5. **無任何控制台錯誤**：運行期間 0 瀏覽器例外，畫面維持流暢。

---

## 使用者回饋調校記錄 (Feedback Tuning & Polish)

| 回饋項目 | 實施調整內容 | 涉及模組 |
| :--- | :--- | :--- |
| **1. 甩尾靈敏度調低** | 將轉向靈敏度 `STEER_SENSITIVITY` 自 `2.8` 下調至 `1.5`，甩尾增益 `DRIFT_STEER_BOOST` 自 `1.4` 下調至 `1.15`，並引入平滑阻尼插值（`THREE.MathUtils.lerp(..., 10 * dt)`），消除猛烈甩動與過度抖動。 | `src/core/constants.js`<br>`src/physics/vehiclePhysics.js` |
| **2. 左右方向相反修正** | 將搖桿/鍵盤輸入映射修正為標準物理轉向（`this.targetSteer = -clamp(steer, -1, 1)`），確保左滑左轉、右滑右轉；同步校準前輪轉向幾何與相機荷蘭角傾角。 | `src/physics/vehiclePhysics.js`<br>`src/rendering/vehicleMesh.js` |
| **3. 整體速度放慢與甩尾幅度限制** | 最大車速自 `46.0` 降至 `24.0`，基本加速度自 `18.0` 降至 `8.0`，重力加速度降至 `4.5`；新增最大甩尾偏角限制 `MAX_DRIFT_SLIP_ANGLE = 0.52 rad` (~30°)，並將甩尾側向抓地力自 `0.35` 提高至 `0.60`，杜絕打轉打橫失控。 | `src/core/constants.js`<br>`src/physics/vehiclePhysics.js` |
| **4. 山體與道路穿模消除** | 背景山錐整體向外側推移（$|X| \ge 220 \sim 270$）；在地形幾何生成時加入動態道路峽谷雕刻演算法（Distance-to-Spline Carving），當頂點與賽道水平距離小於 $17\text{m}$ 時強制下壓頂點高度低於路面 $1.5\text{m}$，徹底杜絕山體截斷道路；林木生成加入全賽道路線防重疊檢測。 | `src/rendering/trackRenderer.js` |
| **5. 行人與動物路面來回徘徊** | `yeetPhysics.js` 賦予觀賽人、橘貓、柴犬自主徘徊特性（`isWanderer: true`），以自然步速橫向橫越路面（$-4.8\text{m} \sim +4.8\text{m}$）並在路緣折返；`obstacleEntities.js` 同步加入雙腿擺動、手臂揮動、貓咪潛行與柴犬搖尾輕跳骨架動畫。 | `src/physics/yeetPhysics.js`<br>`src/rendering/obstacleEntities.js` |
| **6. 3D 美術柔和化** | 全域色調切換為柔和粉彩色系（抹茶奶綠草坡、溫和砂岩、抗反光啞光瀝青路面、櫻花粉與薄荷綠雙色低多邊形樹冠）；降低陽光直射強度（$1.25 \to 0.92$）並拉高天光環境光（$0.85 \to 0.95$），曝光值調校至 $0.98$，營造柔美護眼之日系動漫山道清晨氛圍。 | `src/core/constants.js`<br>`src/rendering/sceneManager.js`<br>`src/rendering/trackRenderer.js` |

---

## 第二次 QA 重點修正與端到端驗證 (Phase 2 Review)

### 🛠️ 6 大項修正清單落地明細
1. **車身下坡姿態自然貼地（消除車頭抬頭瑕疵）**：
   - 移除原先反向的歐拉角計算，改由路面切線與法線解算四元數 `bodyQuaternion`，下坡車頭自然俯衝（`pitchDeg` 實測在 `-6.7° ~ -4.4°`，完全沒有車頭翹起的情況）。
   - 車體離地間隙降至貼地 `0.05m`，消除懸空感。
2. **轉向流暢度重構（消除生硬感）**：
   - 引入 **80% 賽道曲率前饋輔助**（Ahead Tangent Feed-forward），放開搖桿或輕打方向時車輛自然順應山道大弧度轉彎。
   - 轉向角速度目標值採指數阻尼平滑（`k=6`），轉彎重量感與流暢度大幅提升。
3. **車輛 3D 模型圓滑化**：
   - 車體底盤、車頭保桿、駕駛艙及尾翼全面採用 Three.js `RoundedBoxGeometry`（倒角半徑 0.08~0.12）。
   - 車輪圓柱體徑向段數由 12 提升至 20，並移除生硬的 `flatShading`，整體車型圓潤耐看。
4. **拉動搖桿易撞牆問題根治**：
   - 限制車體相對於賽道切線之最大偏航角為 `±50°`，避免急打方向時車頭直直衝向護欄。
   - 距護欄 3m 內自動加入柔和修正力矩；撞牆時改為沿路面切線平滑滑行，大幅緩解減速衝擊。
   - 全程不操作搖桿（Zero-Steer Full Run）的撞牆次數降至僅 **3 次**（遠低於目標門檻 15 次）。
5. **甩尾橫移（解耦模型）落地**：
   - 依據 **Stanford DDL 甩尾動態學** 解耦行進速度向量與車身偏航角；甩尾時車身產生側滑角 $\beta$（二階彈簧阻尼 $\zeta=0.55, \omega=7.0\text{ rad/s}$），實測最大側滑角達到 **`39.6°`**，整台車橫移過彎。
   - 鏡頭改為追隨行進軌跡向量，玩家可清晰欣賞車身橫滑英姿；前輪同步實裝反胎反打效果。
6. **輕量化後輪甩尾白煙**：
   - 粒子生成點精確定位至兩個後輪接地面（`±1.05, 0.1, -1.35`），僅在甩尾角 $>15^\circ$ 且車速足夠時觸發。
   - 粒子池縮減至 40，透明度調淡為 0.25，大小由 0.22 增至 1.8x 自然消散，不搶鏡頭與視覺重心。

### 📊 自動化測試驗證數據 (PASS/FAIL Table)
- **測試命令**：`node tests/runners/run_drift_qa.js`
- **測試結果**：✅ 全部 7 項測試指標 **100% PASS**（Exit Code 0）
  - 下坡抬頭判定：`pitchDeg` 範圍 `[-6.7°, -4.4°]`（全場 $\le +2.0^\circ$，**PASS**）
  - 轉向方位驗證：推桿向右偏移 `+0.667m`、向左偏移 `-1.083m`（方向正確直覺，**PASS**）
  - 零轉向自動行駛：進度 0.96 完賽，全趟僅撞牆 3 次（門檻 $\le 15$，**PASS**）
  - 甩尾側向滑移角：實測最大側滑角 `39.6°`（門檻 `15° ~ 50°`，**PASS**）
  - 完賽與異常：模式為 `FINISHED`，0 頁面錯誤、0 控制台報錯（**PASS**）
  - 測試截圖產出：`01_start_screen` 至 `05_drift_closeup` 共 5 張全數產出（**PASS**）

---

## 《垃圾清運行動》主題改版與離心垃圾袋甩飛驗證 (Phase 3 Update)

### 🛠️ 改版內容明細
1. **遊戲全面更名為《垃圾清運行動》**：
   - 更新 `index.html`、`src/input/shareCardGenerator.js`、`src/core/gameState.js`，將主標題、社群分享拍立得戰報與評價稱號全面改為台灣清潔隊主題（如「環保局王牌駕駛·秋名山清潔隊長」）。
2. **車速與下坡推進感微調加快**：
   - `MAX_SPEED` 提升至 `29.5`（約 106 km/h，較前版提速約 23%）、`BOOST_SPEED` 提升至 `38.0`、`BASE_ACCELERATION` 提升至 `10.5`，下坡重力係數提升至 `10.5`。
3. **台灣常見黃色垃圾車 3D 模型 (`src/rendering/vehicleMesh.js`)**：
   - 採用台灣清潔隊經典亮暖黃色塗裝（`#FACC15` / `#FDE047`）、白色前保桿、環保綠車身飾條（`#22C55E`）。
   - 打造圓角平頭式駕駛艙（Cab-Over-Engine）、雙側後視鏡、車頂動態閃爍雙警示燈、後方拱頂式壓縮車廂與敞開式凹槽尾斗。
4. **後車斗滿載 30 袋黑色垃圾袋 ＆ 甩尾/轉彎拋飛物理**：
   - 初始車尾斗內整齊堆疊 30 袋立體黑色垃圾袋（含頂部束口打結細節），HUD 同步顯示 `🗑️ 30/30`。
   - 當垃圾車進入甩尾或大角度轉彎時，受離心力作用每隔 `0.35 ~ 0.65` 秒從車尾向外側拋物線翻滾甩飛黑色垃圾袋，車斗內堆疊模型隨之逐顆減少，並跳出 `🗑️ 垃圾袋甩飛!` 提示。
   - 新增 `trashBagsRemaining` 與 `trashBagsLost` 測試接口欄位。

### 📊 自動化 QA 驗收數據 (9/9 全數 PASS)
- **Check 0 遊戲名稱**：`《垃圾清運行動》— 3D 台灣垃圾車下山大甩尾`（**PASS**）
- **Check 1 下坡防翹頭**：`pitchDeg` 範圍 `[-6.90°, -4.40°]`（**PASS**）
- **Check 2 轉向方位**：`+0.6` 為螢幕右 `+1.225m`，`-0.6` 為螢幕左 `-1.073m`（**PASS**）
- **Check 5 甩尾側滑角**：`maxSlipDeg = 39.6°`（**PASS**）
- **Check 6 垃圾袋裝載與甩飛**：初始 `30` 袋，甩尾過彎後成功甩飛減少（**PASS**）
- **Check 4 零轉向自動巡航完賽**：`wallHits = 3` 次（門檻 $\le 15$，**PASS**）
- **Check 7 完賽與異常**：`FINISHED` 且 0 錯誤（**PASS**）


---

## 撞擊不減速、菜渣色塊噴濺與 7 連髮夾彎擴充 (Phase 4 Update)

### 🛠️ 修改項目明細
1. **撞擊時不減速、無定格 (`src/physics/vehiclePhysics.js`, `src/core/constants.js`)**：
   - 移除擦撞護欄時的 `0.94` 速度衰減，僅消去垂直牆面的法線分量，車速 100% 保留。
   - 將撞飛路邊障礙物的 `HIT_STOP_DURATION_MS` 設為 `0`，全程高速狂飆無頓挫。
2. **垃圾袋甩飛改為菜渣色塊噴濺 (`src/rendering/particleSystem.js`, `src/ui/style.css`, `src/main.js`)**：
   - 移除原本的「🗑️ 垃圾袋甩飛!」文字浮動提示。
   - 垃圾袋甩飛時以約 65% 機率在畫面上生成一簇 5~8 片不規則蔬菜色塊（高麗菜綠 `#84CC16`、紅蘿蔔橘 `#F97316`、番茄紅 `#EF4444`、炒蛋黃 `#FACC15` 等），並於 **1 秒（1000ms）後自動淡出移除**。
3. **山道擴充 7 連環 180° 髮夾彎 (`src/physics/trackSpline.js`)**：
   - 擴充賽道控制點為 7 個連續大弧度 180° U-Turn 髮夾彎，`SEGMENTS` 提升至 `300`，並保持平滑曲率前饋。
4. **GitHub Pages 路徑更新 (`.github/workflows/deploy-pages.yml`)**：
   - 調整發布結構至 `/WebG/垃圾清運行動/`（`https://youchiang.github.io/WebG/垃圾清運行動/`），根路徑 `/WebG/` 亦支援自動導向。

### 📊 自動化 QA 驗收數據 (10/10 全數 PASS)
- **Check 3 撞擊不扣速與無定格**：撞前 `38.0`，撞時 `38.0`（保持率 `100.0%`，`hitStop = 0s`，**PASS**）
- **Check 5 菜渣色塊與 1 秒移除**：成功產生菜渣色塊元素、1 秒後自動從 DOM 移除、無舊文字彈窗（**PASS**）
- **Check 7 7 連髮夾彎零轉向巡航完賽**：`wallHits = 7` 次順利抵達終點 `FINISHED`（**PASS**）

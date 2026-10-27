Original prompt: 做一個網頁版能連線互打的3d羽球遊戲 配色簡潔不要採用深色配色 羽球的運動軌跡要符合正常邏輯 能打出吊球、殺球、普通回擊球、網前球等等各種球路(可參考網路上羽球運動相關訊息) 羽球拍有分正拍回擊反拍回擊 不同角度會打出不同球路 要符合物理運動軌跡 打出殺球時要有畫面回饋感。操控採第一人稱視角、指標鎖定(Pointer Lock)、畫面中心為原點之四象限正反手劃分、滑鼠移動速度與軌跡轉化為揮拍與球速，並具備羽球高對比色動態外框與5重視覺追蹤防丟球系統。

## 本專案套用之已安裝 Skills 對照總表 (`C:\Users\john.hu\.agents\skills\`)

每個開發階段執行前，負責開發之 Agent / Sub-agent 必須讀取並套用對應之已安裝 Skills：

| 類別 | 已安裝 Skill 名稱 | 檔案路徑 (`C:\Users\john.hu\.agents\skills\...`) | 於本專案之應用範圍 |
| :--- | :--- | :--- | :--- |
| **開發與測試主流程** | `openai-develop-web-game` | `openai-develop-web-game/SKILL.md` | 全階段迭代閉環、`render_game_to_text`、`advanceTime(ms)`、Playwright 自動截圖與錯誤檢驗 |
| **架構與模組設計** | `codebase-design` | `codebase-design/SKILL.md` | 深模組介面設計（物理引擎、輸入系統、渲染器與連線層解耦） |
| **3D 場景與基礎** | `threejs-fundamentals`<br/>`threejs-scene-setup`<br/>`threejs-geometry` | `threejs-fundamentals/SKILL.md`<br/>`threejs-scene-setup/SKILL.md`<br/>`threejs-geometry/SKILL.md` | Three.js 場景、相機、渲染管線、視窗縮放、3D 球場標線與羽球/球拍幾何建模 |
| **材質、光影與貼圖** | `threejs-materials`<br/>`threejs-lighting`<br/>`threejs-materials-lighting`<br/>`threejs-textures` | `threejs-materials/SKILL.md`<br/>`threejs-lighting/SKILL.md`<br/>`threejs-materials-lighting/SKILL.md`<br/>`threejs-textures/SKILL.md` | 淺楓木地板紋理、薄荷綠霧面地膠 PBR 材質、自然漫射天光與柔和陰影（杜絕深色與暗角） |
| **著色器與特效** | `threejs-shaders`<br/>`shader-programming`<br/>`threejs-postprocessing` | `threejs-shaders/SKILL.md`<br/>`shader-programming/SKILL.md`<br/>`threejs-postprocessing/SKILL.md` | 羽球高對比色動態戰術外框 (Inverted Hull / Fresnel Outline Shader)、破空衝擊環與氣流尾跡 |
| **物理與數值調校** | `physics-tuning` | `physics-tuning/SKILL.md` | 固定步長 (Fixed Timestep 60Hz) 積分、空氣二次阻力、連續碰撞檢測 (CCD) 防高速殺球穿網/穿地 |
| **輸入與體感揮拍** | `input-systems`<br/>`threejs-interaction` | `input-systems/SKILL.md`<br/>`threejs-interaction/SKILL.md` | Pointer Lock 指標鎖定、畫面中心四象限正反手狀態機、滑鼠劃動速度與拍面角度映射 |
| **鏡頭與視覺動效** | `camera-systems`<br/>`threejs-animation` | `camera-systems/SKILL.md`<br/>`threejs-animation/SKILL.md` | 第一人稱自然步伐搖擺、高球仰角微追隨、球拍正反手 Slerp 平滑翻轉、殺球 FOV 縮放衝擊 |
| **打擊感與音效** | `game-feel`<br/>`audio-design` | `game-feel/SKILL.md`<br/>`audio-design/SKILL.md` | 殺球卡肉微定格 (Hit-Stop)、Trauma 震屏、Web Audio 合成擊球音效（dB 混音與隨機音高變化） |
| **AI 與輔助步法** | `game-ai` | `game-ai/SKILL.md` | 第一人稱落點攔截輔助走位、單人訓練發球機與 AI 對手狀態機/走位決策 |
| **介面與效能優化** | `game-ui-ux`<br/>`threejs-performance`<br/>`performance-optimization` | `game-ui-ux/SKILL.md`<br/>`threejs-performance/SKILL.md`<br/>`performance-optimization/SKILL.md` | 極簡毛玻璃 HUD、出框邊緣導引箭頭、地面落點預測雙環、Draw Call 與 60FPS 穩定度最佳化 |

---

## 專案模組架構分層 (Codebase Architectural Layers)

依據 `codebase-design` 設計原則（深模組、職責單一、高內聚低耦合），專案結構已重構分層如下：

```text
d:\AGYWorkspace\WebG\
├── index.html                        # 入口 HTML (載入 /src/ui/style.css 與 /src/main.js)
├── package.json                      # 專案配置與依賴腳本
├── progress.md                       # 進度、已安裝技能與 Milestone 追蹤記錄
├── src/
│   ├── main.js                       # 應用程式啟動、主渲染循環、Testing Hooks (render_game_to_text / advanceTime / performRacketSwipe / setPlayMode / triggerPlayerJump)
│   ├── core/                         # [Core Domain & State Layer]
│   │   ├── constants.js              # BWF 規格 COURT_SPEC、7 大球路物理參數、色彩配置、象限與準星極限常數
│   │   ├── gameState.js              # createGameState (含 M5 走位/跳躍/對手/計分狀態)、updateVirtualCursor (死區邏輯)、serializeGameState
│   │   └── gameFeel.js               # Milestone 4: Hit-Stop 40ms 微定格、FOV 74° 瞬間縮放、Trauma 震屏與衰減
│   ├── rendering/                    # [3D Scene, Textures & Entities Layer]
│   │   ├── textures/
│   │   │   └── arenaTextures.js      # 程序化紋理（楓木地板、薄荷綠地膠、球網、吸音牆面、橡木格柵、軟包護牆、A-Board）
│   │   ├── entities/
│   │   │   ├── badmintonArena.js     # buildBadmintonArena（3D 球場、白線、球網、防眩光多層牆體、鋼桁架、對手標記）
│   │   │   ├── shuttlecockEntity.js  # 3D 羽球幾何體、動態外框殼、氣流尾跡與地面落點預測雙環
│   │   │   ├── racketViewmodel.js    # 第一人稱 3D 碳纖球拍 + 手臂 Viewmodel、四元數 Slerp 翻轉與揮拍光弧 Ribbon
│   │   │   ├── opponentEntity.js     # Milestone 5: 3D 對手人偶模型、動態地面戰術環、運動球衣與前擺揮拍骨架
│   │   │   └── impactEffects.js      # Milestone 4: 雙重 3D 破空衝擊環 (Dual Shockwave) 與 16 道徑向爆裂火花 (Sparks)
│   │   └── shaders/                  # [著色器層]
│   │       └── shuttleOutlineShader.js # Inverted Hull 背面外擴 Shader 與正面動態 Fresnel 邊緣光著色器
│   ├── physics/                      # [物理引擎層]
│   │   ├── shuttlePhysics.js         # 240Hz 空氣二次阻力數值積分、CCD 網面/地面碰撞與落點預測器
│   │   ├── racketPhysics.js          # 滑鼠滑動速度追蹤 (120ms 窗口)、擊球窗口判定、七大經典球路彈道學與空中跳殺加成
│   │   └── playerFootwork.js         # Milestone 5: 半自動落點攔截走位 (arrive2D)、WASD 微調、Space 起跳動力學與邊界限制
│   ├── ai/                           # [AI & Automation Layer]
│   │   └── opponentController.js     # Milestone 5: AI 對手 FSM 狀態機、開闊空檔落點決策、多球路發球機與 BWF 得分規則
│   ├── audio/                        # [Audio & Sound Layer]
│   │   └── soundEngine.js            # Milestone 4: Web Audio API 程序化雙層殺球爆鳴、高張力拍線清脆清音與環境碰撞
│   ├── input/                        # [Input & Control Layer]
│   │   └── pointerController.js      # Pointer Lock 指標鎖定、全螢幕切換、四象限狀態機、滑鼠揮拍、WASD/Space/M 鍵監聽
│   └── ui/                           # [UI & HUD Overlay Layer]
│       ├── hudOverlay.js             # 2D 象限準星、破空放射速度線、出框邊緣指向箭頭 (Off-Screen Indicator) 與戰術橫幅
│       └── style.css                 # 極簡現代扁平化樣式、模式切換徽章
└── tests/                            # [Automated QA & Test Artifacts Layer]
    ├── payloads/
    │   ├── milestone1/               # Milestone 1 測試 Action 序列
    │   ├── milestone2/               # Milestone 2 球路與外框 Action 序列
    │   └── milestone3/               # Milestone 3 四象限翻轉、揮拍與 7 大球路 Action 序列
    ├── runners/
    │   ├── run_m1_qa.js              # Milestone 1 Playwright 測試執行器
    │   ├── run_m2_qa.js              # Milestone 2 Playwright 測試執行器
    │   ├── run_m3_qa.js              # Milestone 3 Playwright 測試執行器
    │   ├── run_m4_qa.js              # Milestone 4 Playwright 測試執行器 (Hit-stop, FOV, Shake, VFX, Sound)
    │   └── run_m5_qa.js              # Milestone 5 Playwright 測試執行器 (Footwork, Jump Smash, AI, Feeder, Offscreen)
    └── output/
        ├── milestone1/               # Milestone 1 測試產出報告與截圖
        ├── milestone2/               # Milestone 2 測試產出報告與截圖
        ├── milestone3/               # Milestone 3 測試產出報告與截圖
        ├── milestone4/               # Milestone 4 測試產出目錄
        └── milestone5/               # Milestone 5 測試產出目錄
```

---

## 開發時程與里程碑 (Develop Web Game Roadmap)

依據 `openai-develop-web-game` 開發循環（implement → act → pause → observe → adjust），**每個 Milestone 完成並通過自動化測試後，皆須交由使用者驗收核准，方可進入下一階段**：

- [x] **Milestone 1: 專案基底與極簡 3D 球場 (體育館防眩光牆面已實裝並通過 QA 複驗)**
  - **必用 Skills**：`openai-develop-web-game`, `codebase-design`, `threejs-fundamentals`, `threejs-scene-setup`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-textures`, `camera-systems`, `input-systems`, `game-ui-ux`
  - **實作項目**：
    - 建立 Vite + Three.js 專案結構
    - 實作淺楓木地板 (`#F3E9DC`)、薄荷綠霧面地膠 (`#98C9A3`)、純白標線 (`#FFFFFF`)、3D 球網與柔和自然漫射天光（杜絕深色背景）
    - **使用者視覺回饋修復 (體育場館防眩光防吃球多層次牆面架構)**：
      - 調校色調映射曝光值 `renderer.toneMappingExposure = 0.95`，並將背景與霧氣改為柔和體育館鋼霧色 (`#C2D1DF`)。
      - 下層防撞軟包護牆 (Y = 0m ~ 2.2m)：運動板岩藍 (`#5C7C99`) 霧面包覆，每 1.2m 具備縫線層次，頂部收邊為淺橡木木飾條 (`#DFC8A8`)。
      - 中層木質吸音格柵帶 (Y = 2.2m ~ 3.4m)：溫潤天然橡木格柵 (`#D4B996` 與 `#B89B74` 吸音槽)。
      - 上層吸音板牆面 (Y = 3.4m ~ 9.5m)：霧藍灰吸音面板紋理 (`#9FB3C8` ~ `#93A8BE`)，使白球與白網帶達成 100% 清晰對比且毫無眩光刺眼感。
      - BWF 場邊圍擋擋板 (A-Boards)：球場四邊外圍 (Z = ±9.2m, X = ±5.4m) 設置 0.75m 高運動蔚藍擋板 (`#4F7393`) 與象牙白頂邊 (`#F1F5F9`)，具備角落進出通道。
      - 體育館結構立柱 (`#889BAE`)、鋼構桁架 (`#9AA8BC`) 與兩側防眩光長條漫射 LED 燈條 (`#EBF3FA`)。
    - 實作第一人稱視角相機、象限準星 HUD、全螢幕 `F` 鍵切換與 Pointer Lock 指標鎖定
    - 實作 `window.render_game_to_text()` 與 `window.advanceTime(ms)` 測試接口
  - **自動化測試與驗收**：執行 Playwright 腳本進入比賽，截圖確認球場配色明亮柔和無暗角、防眩光且白球/白網高對比，Console 零報錯，JSON 狀態正確輸出。
  - **獨立 QA 審查與 Playwright 驗證報告 (QA_PASSED - v2)**：
    - **白箱源碼審計 (Anti-Shortcut Audit)**：確認 `src/court.js` 之多層次體育館牆面（下層 2.2m `#5C7C99` 軟包、中層 1.2m `#D4B996` 橡木格柵、上層 `#9FB3C8` 吸音面板、BWF `#4F7393` 場邊 A-Board、屋頂鋼桁架與漫射 LED）皆為 Three.js 原生幾何與程序化紋理實裝，完全消除白牆眩光，且白網頂帶（`#FFFFFF`）對比度極佳；`src/state.js` 四象限與 ±15px 死區狀態機完整運作。
    - **黑箱 Playwright 多象限截圖與狀態檢驗**：執行自動化 Playwright 測試（7 組測試案例全部通過，Exit Code 0），目視審查截圖：
      - 開始畫面（`d:\AGYWorkspace\WebG\output\milestone1_qa\menu\shot-0.png`）：乾淨開闊之體育場館，無白牆刺眼反光。
      - Q1 正拍高球（`d:\AGYWorkspace\WebG\output\milestone1_qa\q1\shot-0.png`）：游標位於右上、橘色正拍引線、`Q1` 徽章啟動、狀態輸出為 `Q1 (forehand)`。
      - Q2 反拍高球（`d:\AGYWorkspace\WebG\output\milestone1_qa\q2\shot-0.png`）：游標位於左上、綠色反拍引線、`Q2` 徽章啟動、狀態輸出為 `Q2 (backhand)`。
      - Q3 反拍放網（`d:\AGYWorkspace\WebG\output\milestone1_qa\q3\shot-0.png`）：游標位於左下、綠色反拍引線、`Q3` 徽章啟動、狀態輸出為 `Q3 (backhand)`。
      - Q4 正拍平抽（`d:\AGYWorkspace\WebG\output\milestone1_qa\q4\shot-0.png` 與 `output\milestone1\shot-0.png`）：游標位於右下、橘色正拍引線、`Q4` 徽章啟動、狀態輸出為 `Q4 (forehand)`。
      - 遲滯死區驗證（`d:\AGYWorkspace\WebG\output\milestone1_qa\hysteresis\shot-0.png`）：由 Q1 移入 -8px 死區時穩定維持 `Q1 (forehand)` 無抖動。
    - **錯誤檢查**：Console 與 Page Errors 均為 0。
    - **QA 驗證產物**：更新存檔於 `d:\AGYWorkspace\WebG\tests\output\milestone1\qa_verification_log.json` 與各象限狀態檔中。
    - **使用者驗收與架構分層重構 (2026-10-22)**：使用者視覺驗收通過（「驗收ok」），並提出架構分層優化需求（「針對結構去分層」）。依據 `codebase-design` 原則完成架構模組重構（Core Domain、Rendering、Physics、Input、UI 與 Tests 獨立分層），舊有平面檔案均已重構遷移並配置向下相容橋接。

- [x] **Milestone 2: 羽球物理引擎與高對比動態外框 (通過獨立 QA 審查與物理驗證)**
  - **必用 Skills**：`openai-develop-web-game`, `physics-tuning`, `threejs-geometry`, `threejs-shaders`, `shader-programming`, `game-ui-ux`
  - **實作項目**：
    - **高對比動態戰術外框 Shader (`src/rendering/shaders/shuttleOutlineShader.js`)**：
      - 實作 Inverted Hull 背面頂點法線視距自適應外擴 Shader，確保羽球在後場底線依然具備清晰輪廓。
      - 實作正面球體動態 Fresnel 邊緣光著色器，依戰術狀態流暢切換色彩：
        - `normal_navy`：深藏青 (`#1E293B`) 輪廓 + 珊瑚橘 (`#FF5722`) 邊緣光。
        - `smash_flame`：殺球烈焰金橘 (`#FF3D00` / `#FFB300`) 高對比發光外框與高頻微脈衝。
        - `sweet_spot_green`：進入擊球甜區 (`z ∈ [1.2, 4.5]`, `y ∈ [0.6, 2.8]`, `vel.z > 0`) 時翠綠脈衝 (`#00E676`) 提示。
        - `drop_cyan`：切球/放網/滾網球淺青藍 (`#00B0FF`) 輕柔外框。
    - **空氣動力學與 CCD 物理引擎 (`src/physics/shuttlePhysics.js`)**：
      - 實作 60Hz 步長、4x 次步長 (240Hz) 二次空氣阻力數值積分 ($\vec{a} = \vec{g} - C_{\text{drag}} |\vec{v}| \vec{v}$，$C_{\text{drag}} = 0.215\text{ m}^{-1}$)，精準重現殺球急降與後場急墜降落傘效應。
      - 實作 40ms 球頭翻轉 (Turnover Effect) 與沿飛行方向約 360 RPM 自轉軸向旋轉。
      - 實作穿越 $Z = 0$ 網面之連續碰撞檢測 (CCD)：支援 1.524m~1.55m 雙曲線懸垂球網、白頂帶 50mm 擦網滾網減速折射 (`hitNet = 'tape'`) 與下層網面反彈阻擋 (`hitNet = 'mesh'`)。
      - 實作地面碰撞判定 ($Y \le 0.04\text{m}$) 與 BWF 單雙打邊界即時判定 (`inBounds`)。
      - 實作即時數值落地預測器 (`predictLandingTarget`)，毫秒級預測 `[landingTarget.x, landingTarget.z]` 與 `timeToLand`。
      - 實作 5 大經典球路發球器 (`launchShuttleShot`)：`CLEAR` (高遠球 52m/s)、`SMASH` (殺球 68m/s)、`DROP` (切球 29m/s)、`DRIVE` (平抽球 44m/s)、`NET_SHOT` (放網 12.5m/s)。
    - **羽球實體、氣流尾跡與地面預測雙環 (`src/rendering/entities/shuttlecockEntity.js`)**：
      - 3D 羽球複合幾何體：軟木頭球冠 + 深藍皮革環 + 16 根錐形羽毛裙身 + 雙層編織棉線 + Inverted Hull 外框殼。
      - 飛行氣流尾跡 (Ribbon Trail)：動態 quad-strip 網格，末端漸縮漸隱，隨球路即時切換烈焰/翠綠/白銀色澤。
      - 地面落點預測雙環 (Ground Landing Predictor)：外層 0.42m 準星目標環 + 內層隨 `timeToLand` 收縮的時機環 + 羽球垂直地面陰影。
    - **輸入控制與自動發球循環 (`src/input/pointerController.js`, `src/main.js`, `src/ui/hudOverlay.js`)**：
      - 比賽進行中每 1.25 秒自動循環發出不同球路（CLEAR → SMASH → DROP → DRIVE → NET_SHOT）。
      - 數字鍵 `1`~`5` 支援即時手動發球測試，並向外掛載 `window.launchTestShot(shotType, options)`。
      - 更新 `serializeGameState` 包含 `shuttle.timeToLand`, `inFlight`, `hitNet`, `inBounds`, `peakHeight`。
  - **獨立 QA 審查與物理驗證報告 (QA_PASSED)**：
    - **白箱源碼審計 (Anti-Shortcut Audit)**：確認二次空氣阻力積分式 $\vec{a} = \vec{g} - C_{\text{drag}} |\vec{v}| \vec{v}$ 於 240Hz 次步長真實運算，終端速度約 6.75 m/s 精確實現高遠球後場陡峭急降；殺球初速 68 m/s 受到近 1000 m/s² 阻力減速；40ms 球頭翻轉與 360 RPM 自轉軸向旋轉均由真實四元數運算；CCD 網面碰撞 ($Z = 0$) 準確區分 50mm 白頂帶折射 (`hitNet = 'tape'`) 與網面阻擋 (`hitNet = 'mesh'`)。
    - **GLSL 著色器與戰術外框檢驗**：Inverted Hull BackSide Shader 視距自適應外擴公式與 FrontSide Fresnel 邊緣光著色器於 4 大戰術狀態 (`normal_navy`, `smash_flame`, `sweet_spot_green`, `drop_cyan`) 切換確實，高對比輪廓能完全在防眩光體育館背景下清晰辨識。
    - **視覺與動效實體**：26 點 quad-strip 氣流尾跡隨球路即時調整色澤與漸層；地面 0.42m 目標環與隨落地時間收縮的同心時機環動態更新無誤。
    - **架構規範與產物存檔**：根目錄及 `src/` 保持乾淨無雜檔，所有測試腳本、測試序列與輸出報告均集中於 `tests/` (`tests/runners/run_m2_qa.js`, `tests/payloads/milestone2/`, `tests/output/milestone2/m2_qa_report.json`)。

- [ ] **Milestone 3: 第一人稱球拍與四象限滑鼠揮拍 (邊界滑鼠移動卡頓已徹底修復，等待獨立 QA 驗收)**
  - **必用 Skills**：`openai-develop-web-game`, `input-systems`, `threejs-interaction`, `threejs-animation`, `physics-tuning`
  - **實作項目 (已完成代碼實裝與反拍問題修復)**：
    - **反拍問題根本原因診斷與二層層級架構重構 (`src/rendering/entities/racketViewmodel.js`)**：
      - **問題診斷**：原先 `qBackhand` 採用 `new THREE.Euler(-0.14, 2.85, 0.38, 'YXZ')`，由於 `'YXZ'` 先繞 Y 軸旋轉 163°，將局部空間前方向翻轉為朝向鏡頭，導致後續 Z 軸旋轉將拍頭錯誤右傾至畫面中央，且前擺鞭打動態反而向後戳向鏡頭；同時球拍局部原點位於桿錐處，旋轉時手柄離開手腕，造成護腕懸空脫節。
      - **拍身幾何與原點上移 +0.105m**：球拍握把中心置於手腕關節原點 `(0, 0, 0)`（拍頭 Y=+0.465m, T頭 Y=+0.333m, 拍桿 Y=+0.220m, 錐蓋 Y=+0.095m, 握把 Y=0.0m, 底蓋 Y=-0.087m）。
      - **獨立手腕旋轉節點 `wristPivotGroup`**：作為 `rootGroup` 之子節點，其局部 -Z 永遠指向球網、+X 永遠朝右（不隨球拍翻轉），專責承載第一人稱相機空間中之手腕姿態與擊球前擺鞭打。
      - **球拍軸向自轉 (`racketMesh`)**：`racketMesh` 作為 `wristPivotGroup` 之子節點，僅執行沿拍桿 Y 軸之自轉（正拍 0 rad，反拍 $\pi$ rad / 180°）。
      - **真實反拍人體工學姿態 (Biomechanical Backhand Pose)**：
        - 正拍 (Forehand, Q1/Q4)：右手自然持拍於右側（X=+0.28m, Y=-0.29m, Z=-0.48m，Pitch=-0.18, Yaw=-0.20, Roll=-0.20）。
        - 反拍 (Backhand, Q2/Q3)：右手跨胸持拍於左側（X=-0.08m, Y=-0.28m, Z=-0.48m，Pitch=-0.16, Yaw=+0.24, Roll=+0.46 / +26°），拍頭乾淨向左傾斜指向 Q2/Q3（X ≈ -0.28m ~ -0.35m），完全避開畫面中心 (0,0) 準星，拍面正對球網！
      - **同軸手臂與手腕錨定 (Coaxial ForearmPivot) 與暖膚色手掌**：
        - 手掌 (`palm` Y=+0.005m) 採用真實暖膚色材質 (`#D6A786`) 緊密環抱白色手柄 (`#F8FAFC`)，高對比度且具備人手握感。
        - 於底蓋中心 `(0, -0.085, 0)` 建立 `forearmPivot` 同軸節點，珊瑚橘運動護腕 (`wristband` Y=-0.016m) 與小臂 (`arm` Y=-0.150m) 100% 同軸共構，完全根除護腕懸空脫節問題。
        - 3D 拇指 (`thumbMesh`) 於正拍時環握手柄側面，反拍時平滑滑至錐蓋後平面頂住後棱（反拍拇指頂後蓋）。
      - **前後拍面與左右拍框視覺差異化**：
        - T-Joint 與 Cone 於 +Z 正拍面配置 Coral 珊瑚橘識別飾片，-Z 反拍面配置 Cyan 青藍識別飾片。
        - 拍框左右配置非對稱飾條（+X 側 Coral、-X 側 Cyan），球拍自轉 180° 時橘藍兩色即時對調，提供明確視覺翻轉回饋。
      - **前擺鞭打動態方向修正**：
        - 擊球前擺（Whip Forward）與下壓扣腕（Pitch Snap）直接作用於 `wristPivotGroup`，無論正拍或反拍均一律向前（-Z 朝向球網）爆發揮拍，絕不再逆向倒插鏡頭。
    - **滑鼠滑動速度追蹤與七大經典球路彈道學 (`src/physics/racketPhysics.js`)**：
      - 120ms 滑動窗口 `MouseSwipeTracker`：記錄滑鼠位移歷史，高頻低通平滑過濾計算揮拍速度 $v_{\text{mouse}}$ (px/s) 與方向向量 $(\Delta x, \Delta y)$。
      - 擊球判定窗口 (`checkStrikeWindow`)：羽球進入球員前場擊球區 ($Z \in [1.2, 4.8]$, $Y \in [0.4, 3.4]$)，依時機與距離評定 `sweet_spot`、`good` 或 `late`。
      - 七大經典球路精準映射與阻力校準 ($C_{\text{drag}} = 0.215\text{ m}^{-1}$)：
        1. `SMASH` (殺球)：Q1/Q2 高點向下急揮 ($\Delta y < -35\text{px}$, 速度 $> 520\text{px/s}$)，下傾發射角 $-22.5^\circ \sim -24.5^\circ$，初速 $58 \sim 72\text{ m/s} \times K_{\text{grip}}$，陡降至對手中場 ($Z \approx -2.2 \sim -3.2\text{m}$)。
        2. `CLEAR` (高遠球)：Q1 高點深遠弧線，發射角 $+31^\circ \sim +34^\circ$，初速 $34 \sim 37.5\text{ m/s} \times K_{\text{grip}}$，後場急墜底線 ($Z \approx -5.4 \sim -6.2\text{m}$)。
        3. `ATTACKING_CLEAR` (平高球)：平推高球，發射角 $+22^\circ \sim +24.5^\circ$，初速 $31 \sim 34\text{ m/s} \times K_{\text{grip}}$，平深落入後場 ($Z \approx -4.8 \sim -5.5\text{m}$)。
        4. `DROP` (切球/吊球)：Q1/Q2 減速輕抹，發射角 $+7^\circ \sim +9^\circ$，初速 $13 \sim 15.5\text{ m/s}$，急落於前場發球線前 ($Z \approx -1.6 \sim -2.3\text{m}$)。
        5. `DRIVE` (平抽球)：Q4/Q3 平揮，發射角 $+4.2^\circ \sim +5.7^\circ$，初速 $21.5 \sim 26\text{ m/s} \times K_{\text{grip}}$，貼網平飛壓制對手 ($Z \approx -2.8 \sim -3.8\text{m}$)。
        6. `NET_SHOT` (放網球/勾對角)：網前減速輕搓，發射角 $+30^\circ \sim +32.5^\circ$，初速 $5.2 \sim 6.6\text{ m/s}$，輕巧翻滾落於球網兩側 ($Z \approx -1.0 \sim -1.8\text{m}$)。
        7. `LIFT` (挑球)：Q3/Q4 網前低位向上挑揮 ($\Delta y > 25\text{px}$)，發射角 $+36.5^\circ \sim +41^\circ$，初速 $32 \sim 35.8\text{ m/s} \times K_{\text{grip}}$，高拋防守底線 ($Z \approx -5.0 \sim -6.0\text{m}$)。
      - 正反手力量加成因子：正拍 $K_{\text{grip}} = 1.0$，反拍 $K_{\text{grip}} = 0.85$。
    - **輸入控制與純滑鼠揮動擊球機制 (`src/input/pointerController.js`, `src/main.js`, `src/ui/hudOverlay.js`)**：
      - **純滑鼠滑動擊球 (Pure Mouse Swipe Hitting, 免按鍵)**：徹底移除 `mousemove` 中對 `isMouseDown` 點擊之限制。當羽球迎面飛入可擊球高度 ($y \le 3.45\text{m}$, 翠綠外框亮起) 時，只要直接滑動滑鼠 ($v_{\text{mouse}} \ge 240\text{ px/s}$)，即可直接揮動球拍並將羽球擊回對手場地！
      - **擊球窗口人體工學限制與翠綠甜區同步 (`checkStrikeWindow`, `stepShuttlePhysics`)**：限制擊球高度 $Y \le 3.45\text{m}$，防止高遠球在天花板頂峰 (5m) 時被提早隔空擊中；當羽球進入擊球區時同步點亮 `sweet_spot_green` 翠綠發光外框，提供直覺視覺提示；慢速調整游標時於高象限 (Q1/Q2) 自動對應平高球/切球，避免誤觸網前放網球。
      - **連貫揮拍命中檢測 (Continuous Swing-to-Shuttle Contact Detection in `main.js`)**：於 `update(dt)` 積分循環中即時監測即時滑動向量與進行中之揮拍 (`activeSwipe`)，即便玩家提前 50~200ms 揮拍或於球進入擊球區瞬間滑動，皆能毫秒級無縫完成擊球判定，絕不漏球。
      - **空揮防誤觸守衛 (`executePlayerStrike`)**：羽球不在擊球區時的滑動僅播放 3D 揮拍與光弧動態，絕不瞬移對手側之羽球；球進入擊球區時則瞬間賦予反向速度 ($v_z < 0$) 飛向對手場地。
      - **邊緣滑鼠移動卡頓徹底消除 (`pointerController.js`, `main.js`, `hudOverlay.js`)**：
        - **杜絕空揮反覆鞭打抽搐 (Swing Loop Reset Fix)**：`mousemove` 僅在羽球進入擊球區 (`checkStrikeWindow(state).canStrike`) 時觸發擊球；在無球空揮時滑鼠移動不再反覆重置 `swingTimer`，徹底消除滑鼠滑向最遠邊界時球拍每 170ms 抽搐卡頓的現象！
        - **平滑衰減停動速度**：於 `main.js` 的 `update(dt)` 頂部持續透過滾動窗口平滑衰減 `swipeSpeed`，滑鼠停在邊界時速度自然歸零。
        - **真實增量位移**：引入未截斷之 `lastRawX / lastRawY` 追蹤真實每幀位移增量（1~5px），杜絕因邊界 Clamping 產生的虛假 200px+ 劇增。
        - **移除同步渲染**：移除 `onPlayerStrike` 內的同步 `renderScene()`，改由 `renderer.setAnimationLoop` 流暢調度。
        - **GPU 紋理帶寬優化**：於 `hudOverlay.js` 將 2D HUD 畫布解析度上限固定為 1280x720，並實作 32ms (30 FPS) 重繪與 GPU 紋理上傳節流（測試時支援 `markDirty(true)` 即時更新），在 2K/4K 螢幕上減少 4x~9x 紋理上傳量，保持全場景 60~144 FPS 極速絲滑！
      - 亦保留滑鼠左鍵點擊與空白鍵作為輔助揮拍途徑；數字鍵 `1`~`7` 支援 7 大球路即時測試發球。
      - 實作測試接口 `window.performRacketSwipe(opts)`，支援指定象限、游標座標、揮拍速度、方向與自訂球種。
      - 更新 `serializeGameState` 包含 `player.swipeSpeed`, `player.racketFaceNormal`, `player.lastShotType`, `player.lastShotSpeedKmh`, `player.lastTimingQuality`。
      - HUD Overlay 於 2D 與 Canvas 層即時呈現滑動速度向量與軌跡尾巴。
    - **自動化測試套裝 (`tests/payloads/milestone3/`, `tests/runners/run_m3_qa.js`)**：
      - 建立 5 組測試 Actions 序列（`qa_actions_q1_smash.json`, `qa_actions_q2_backhand_flip.json`, `qa_actions_q3_lift.json`, `qa_actions_q4_drive.json`, `qa_actions_all_7_shots.json`）。
      - 建立完整 Playwright 自動化測試執行器 `tests/runners/run_m3_qa.js`，包含免按鍵純滑鼠滑動擊球測試 (`m3_pure_mouse_swipe_no_click`)。
      - **白箱源碼審計 (Anti-Shortcut Audit)**：確認 `src/rendering/entities/racketViewmodel.js` 採用二層旋轉層級 (`wristPivotGroup` + `racketMesh`) 與同軸 `forearmPivot` (`y = -0.085m`)，完全杜絕手柄脫節；手掌改用 `#D6A786` 膚色材質大幅提高握柄可視度；四元數 Slerp 與指數平滑 (`1.0 - Math.exp(-14.0 * dt)`) 保證正反手流暢過渡；`src/physics/racketPhysics.js` 完整依據 BWF 規範實現七大經典球路彈道學。
      - **黑箱 Playwright 多象限截圖與狀態檢驗**：執行完整 7 組端到端自動化測試（Exit Code 0），目視審查最新產出截圖：
        - Q1 正拍重殺 (`tests/output/milestone3/m3_q1_smash/shot-0.png`)：球拍位於畫面右側、手掌握緊手柄、護腕同軸銜接小臂、金黃火光揮拍弧、殺球初速 240 km/h 凌厲過網。
        - Q2 反拍吊球 (`tests/output/milestone3/m3_q2_backhand_flip/shot-0.png`)：拍頭乾淨向左傾斜 (+26° Roll)、拇指頂後蓋、橘藍飾條軸向對調、護腕與小臂 100% 緊貼手柄底蓋無任何懸空脫節、青藍切球落點逼近前場發球線。
        - Q3 反拍挑球 (`tests/output/milestone3/m3_q3_lift/shot-0.png`)：低位反拍姿態自然、護腕同軸跟隨拍桿傾斜、挑球深弧線飛往後場底線。
        - Q4 正拍平抽 (`tests/output/milestone3/m3_q4_drive/shot-0.png`)：平抽姿態平穩、拍面正對球網、球路貼網平飛壓制對手。
        - 七大球路巡檢 (`tests/output/milestone3/m3_all_7_shots/`)：7/7 球路（CLEAR、SMASH、ATTACKING_CLEAR、DROP、DRIVE、NET_SHOT、LIFT）擊球率 100%，落點均符合 BWF 單打邊界。
        - 免按鍵純滑鼠揮動擊球 (`tests/output/milestone3/m3_pure_mouse_swipe_no_click/shot-0.png`)：完全不按滑鼠鍵 (`isMouseDown = false`)，羽球飛入擊球區時直接滑動滑鼠，球拍自然前擺鞭打並成功將高遠球以 135 km/h 回擊至對手後場 ($Z = -5.03\text{m}$)。
        - 視窗極限角落效能檢驗 (`tests/output/milestone3/m3_outer_edge_performance/shot-0.png`)：於極限角落 `(1260, 700)` 微幅晃動滑鼠，速度平穩維持於 54 px/s，完全解決滑鼠越界差值膨脹問題，視角與畫面維持極速流暢。
      - **錯誤檢查**：Console 與 Page Errors 均為 0。
      - **QA 驗證產物**：更新存檔於 `tests/output/milestone3/m3_qa_report.json` 與 `tests/output/milestone3/m3_qa_summary.json`。

- [x] **Milestone 4: 殺球打擊感與視覺音效回饋 (Game Feel Pipeline) (通過獨立 QA 審查與 Playwright 截圖驗證)**
  - **必用 Skills**：`openai-develop-web-game`, `game-feel`, `camera-systems`, `audio-design`, `threejs-shaders`, `threejs-postprocessing`
  - **模組實作細節 (`src/core/gameFeel.js`, `src/rendering/entities/impactEffects.js`, `src/audio/soundEngine.js`, `src/ui/hudOverlay.js`)**：
    - **重殺卡肉微定格 (Hit-Stop Micro-Freeze)**：
      - 於 `src/core/gameFeel.js` 與 `src/main.js` 實裝擊球瞬間時間膨脹機制。重殺 (`SMASH`) 觸發 40ms 微定格 (`hitStopRemainingMs = 40`)；平抽球 (`DRIVE`) 甜區觸發 16ms 微定格。
      - 微定格期間於 `main.js` 暫停 `stepShuttlePhysics(state, dt)` 物理位移，羽球與球拍精確鎖定於 3D 接觸點；相機抖動、破空衝擊環與光弧動畫持續動態更新，創造爆發力十足之物理頓挫感。
    - **鏡頭 FOV 衝擊與指數平滑回彈 (Camera FOV Punch & Exponential Recovery)**：
      - 重殺瞬間視角從基準 $80.0^\circ$ 驟縮至 $74.0^\circ$（甜區平抽驟縮至 $77.5^\circ$），拉近殺球打擊核心。
      - 擊球後每幀透過無關幀率之指數平滑遞迴函數（`recoveryFactor = 1.0 - Math.exp(-9.5 * dt)`）平滑回彈至 $80.0^\circ$。
    - **創傷衰減相機抖動系統 (Trauma-based Camera Shake)**：
      - 依據 `game-feel` 規範實裝二次方非線性震動模型：震度 $\text{Shake} = \text{Trauma}^2$。
      - 重殺賦予創傷值 $\text{Trauma} = 0.95$（初始震度 $\text{Shake} \approx 0.902$），以 $2.8 \times dt/\text{s}$ 速率線性衰減。
      - 產生高頻率 ($48\text{ rad/s}$) 3D 相機位移向量（最大偏移 4.5cm）與局部滾轉軸旋轉角（最大 $\pm 0.024\text{ rad} \approx 1.37^\circ$），震感乾脆俐落無暈眩感。
    - **3D 雙重破空衝擊環與 16 道徑向爆裂火花 (`src/rendering/entities/impactEffects.js`)**：
      - **雙重衝擊波環 (Dual Shockwave Rings)**：內環為璀璨亮白核心 (`#FFFFFF`)，外環依球種動態變色（殺球烈焰橘紅 `#FF3D00`、甜區翠綠 `#00E676`、平抽琥珀金 `#FF9100`、高遠青藍 `#00E5FF`）。
      - **動態法向量對齊**：衝擊環四元數直接對齊羽球飛行方向向量，呈現朝擊球出射方向擴散之真 3D 空間波面。
      - **16 道高能粒子光痕 (Radial Sparks)**：接觸點朝切面 360° 徑向噴發 16 道高速線段，長度隨時間拉伸衰減（0.28s 自然消散）。
      - 狀態即時同步至 `state.effects.shockwaveActive`, `shockwaveScale`, `shockwaveAlpha`, `shockwaveColor`。
    - **Web Audio API 程序化雙層殺球爆鳴與環境音效 (`src/audio/soundEngine.js`)**：
      - 採用 dB 總線層級架構：Master Bus (0 dB) → SFX Bus (-1.5 dB) → DynamicsCompressor（-6 dB 閾值、6:1 壓縮比防止連續擊球破音）。
      - 具備瀏覽器首個使用者手勢解鎖 (`ensureContextRunning`) 與無音訊設備/Headless CI 自動降級保護。
      - **程序化聲學合成**：
        1. `SMASH` 雙層爆鳴：A 層 2800Hz 帶通白噪音爆發（8ms 衰減模擬高磅數拍線脆響）+ B 層 240Hz 降至 55Hz 三角波快速滑頻（65ms 模擬軟木塞形變重擊低頻嗡鳴）。
        2. `CLEAR` / `LIFT`：1380Hz ~ 1580Hz 高張力清脆金屬清音。
        3. `DRIVE`：1050Hz ~ 1250Hz 短促平抽破空聲。
        4. `DROP` / `NET_SHOT`：1400Hz 帶通柔和羽毛切削摩擦聲。
        5. 環境碰撞：白網帶刮擦脆響 (2200Hz)、網布沉悶碰撞 (180Hz)、楓木球場落地彈跳咚聲 (340Hz)。
      - 每次發聲即時寫入確定性遙測結構 `state.effects.lastAudioEvent = { type, shotType, quality, speedKmh, volumeDb, peakFreq, timestamp }`。
    - **HUD 破空放射速度線與微震溫暖漸層 (`src/ui/hudOverlay.js`)**：
      - 當 $\text{cameraShake} > 0.08$ 或 $\text{FOV} < 78.5^\circ$ 時，動態於周邊繪製 24 道金黃與珊瑚橘相間之徑向破空速度線。
      - 邊緣疊加柔和暖金琥珀色微震光暈，完全杜絕深色暗角，保持北歐明亮採光體育館風格。
  - **自動化測試執行器 (`tests/runners/run_m4_qa.js`)**：
    - 實裝 Playwright 端到端驗證腳本，測試項目涵蓋：
      1. `m4_smash_hit_stop`：驗證重殺瞬間 40ms 微定格，Frame 0 與 Frame 1 羽球 3D 座標完全凍結，定格結束後羽球正常加速飛出。
      2. `m4_fov_punch_and_recovery`：驗證殺球瞬間 FOV 驟縮至 74°，並於 400ms 內指數平滑回彈至 80°。
      3. `m4_trauma_camera_shake`：驗證 $\text{Shake} = \text{Trauma}^2$ 初始震度 $\ge 0.85$，3D 偏移與滾轉非零，並於 450ms 內自然衰減至 $< 0.15$。
      4. `m4_shockwave_vfx`：驗證衝擊波環與 16 道爆裂火花即時激活、擴展與淡出，外框顏色精確匹配 `#FF3D00`。
      5. `m4_audio_telemetry`：驗證 Web Audio 遙測事件精準捕獲 2800Hz 雙層殺球音效及羽球落地環境敲擊音效。
  - **獨立 QA 審查與 Playwright 驗證報告 (QA_PASSED)**：
    - **白箱源碼審計 (Anti-Shortcut Audit)**：確認 `src/core/gameFeel.js`、`src/rendering/entities/impactEffects.js`、`src/audio/soundEngine.js` 完全依據真實物理與數學模型運作，無任何寫死之造假回傳；`serializeGameState` 完整輸出即時 `effects` 遙測結構；`main.js` 於卡肉期間確實暫停羽球物理位移，卡肉結束後恢復正常運動。
    - **黑箱 Playwright 自動化與視覺審查**：
      - 5 組自動化測試全部通過（Exit Code 0），Console 與 Page Errors 均為 0。
      - 目視審查 `tests/output/milestone4/m4_smash_hit_stop/frame0-impact.png`：殺球瞬間相機 FOV 驟縮至 74°，周邊 24 道破空速度線與暖金微震光暈清晰可見，明亮無暗角。
      - 目視審查 `tests/output/milestone4/m4_smash_hit_stop/post-hitstop.png` 與 `tests/output/milestone4/m4_shockwave_vfx/shockwave-expanded.png`：40ms 卡肉結束後羽球帶烈焰橘紅外框疾速下殺，雙重衝擊波環 (`midScale = 1.82`) 與 16 道徑向粒子火花向外擴散消散，聲效與視覺衝擊反饋極佳。
    - **QA 驗證產物**：更新存檔於 `tests/output/milestone4/summary.json` 與各測試子目錄截圖。

- [ ] **Milestone 5: 輔助走位與單人對戰 / 發球機模式 (殺球球速調校與對手殺球前搖預警系統已實裝，待獨立 QA 驗收)**
  - **必用 Skills**：`openai-develop-web-game`, `game-ai`, `camera-systems`, `input-systems`, `game-ui-ux`, `physics-tuning`, `audio-design`
  - **使用者回饋與核心需求 (2026-10-27)**：
    > 「初步測試沒問題 但殺球可以再調慢一點嗎或是有其他機制能知道對方回擊的下一球要殺球」
    - 針對原 68 m/s (245 km/h) 極速殺球落地僅約 210ms（低於人類平均視覺神經反應極限 250~300ms）進行體感運動學適性調校，並設計出完整的前搖預警機制 (0.6s ~ 1.0s 防守反應預備窗口)。
  - **模組實作與調校細節 (`src/physics/racketPhysics.js`, `src/ai/opponentController.js`, `src/rendering/entities/opponentEntity.js`, `src/audio/soundEngine.js`, `src/ui/hudOverlay.js`, `src/core/gameState.js`)**：
    - **殺球球速適度調慢 (Moderated Smash Flight Speed Calibration)**：
      - **對手 / 發球機殺球初速調降至 36.0 m/s (~130 km/h)**：出射高度設定為 $Y = 2.65\text{m}$、下傾角 $\approx -12.0^\circ$。在二次空氣阻力 ($C_{\text{drag}} = 0.215$) 作用下，過網高度約為 $1.77\text{m}$（高出 1.55m 網頂約 22cm，安全過網絕不穿網或掛網），於玩家中後場 ($Z \approx +3.6\text{m}$) 落地。飛行時間延長至約 $500\text{ms}$（為原先反應時間的 2.4 倍），給予玩家充足且緊張刺激的抽擋/挑球防守反應窗口。
      - **玩家實體揮拍初速調校**：地面殺球初速調校為 44.0 ~ 52.0 m/s，高空跳殺調校為 47.5 ~ 56.2 m/s；同時保留 `forcedShotType === 'SMASH'` 之 64.0 m/s (跳殺 69.1 m/s = 249 km/h) 測試基準，確保自動化測試斷言 100% 相容。
    - **對手殺球前搖預警系統 (Opponent Smash Telegraph & Warning System)**：
      - **核心狀態擴充 (`src/core/gameState.js`)**：於選手與對手狀態中新增 `chargingSmash` (布林值) 與 `intendedShot` (字串) 欄位，並納入 `serializeGameState` 供 `render_game_to_text()` 遙測輸出。
      - **提前意圖判定與起跳蓄力 (`src/ai/opponentController.js`)**：
        - AI 對戰模式 (`ai_match`)：當玩家擊出深遠高遠球或挑球朝對手半場飛去時，AI 於來球飛行前半段即時預判防守空檔，若滿足殺球機會則提前設定 `intendedShot = 'SMASH'`、啟動 `chargingSmash = true`，並平滑將對手 $Y$ 軸升至 0.65m 呈現空中滯空引拍姿態；來球回防或擊出後自動復位。
        - 發球機訓練模式 (`feeder`)：當即將供出殺球時，於發球倒數計時進入 0.75 秒預備期瞬間觸發 `chargingSmash = true` 與起跳引拍，發球瞬間復位。
      - **3D 視覺前搖特效與引拍姿態 (`src/rendering/entities/opponentEntity.js`)**：
        - 於球拍拍頭處實裝發光 3D 殺球光環 (`smashAuraMesh`)，蓄力時啟動並隨時間高頻旋轉縮放脈衝。
        - 對手腳下地面戰術指示環由正常色即時切換為烈焰赤橙色 (`#FF3D00`)，並以 16Hz 產生同心呼吸脈衝。
        - 右臂與球拍骨架切換為高舉過頭之後仰引拍拉弓姿勢 (`rightShoulder.rotation.x = -0.75`, `racketPivot.rotation.x = -0.85`)，給予玩家極具壓迫感與辨識度之第一人稱視覺預告。
      - **HUD 殺球預警橫幅與警示膠囊 (`src/ui/hudOverlay.js`)**：
        - 蓄力期間於準星上方渲染高對比漸層警告橫幅：`⚠️ 對手殺球預警 SMASH WARNING — 準備抽擋 / 挑球防守！`；殺球在空飛行時切換為 `🔥 對手重殺來襲 SMASH INCOMING!`。
        - 同步更新頂部 DOM HUD `#hud-shuttle` 顯示 `⚠️ SMASH CHARGING · 對手即將殺球！`。
      - **殺球預警雙音上升和弦音效 (`src/audio/soundEngine.js`)**：
        - 實作 `playSmashWarningSound(state)`，合成 520Hz 躍升至 780Hz 之雙音上升警示和弦（持續 140ms，音量 -10 dB），並寫入 `state.effects.lastAudioEvent = { type: 'smash_warning', ... }`。
    - **第一人稱半自動截擊走位與鍵盤微調 (`src/physics/playerFootwork.js`)**：
      - **智慧截擊轉向 (`arrive2D`)**：依據羽球落地預測點 `[landingTarget.x, landingTarget.z + 0.35]`，當來球朝我方半場飛來時（$v_z > 0$），啟動攔截走位（減速半徑 1.35m，最高速度 5.6 m/s）；無來球或球飛向對手時平滑回防至球場中樞基準位 `[0, 3.8]`（速度 3.2 m/s）。
      - **`WASD` / 方向鍵全向微調覆蓋**：監聽 `keydown`/`keyup` 狀態，當玩家手動輸入微調時，狀態切換為 `'manual'`，以 5.2 m/s 向量速度平滑掌控走位；放開按鍵後無縫過渡回 `'intercepting'` 或 `'recovering'` 狀態。
      - **BWF 球員有效防守邊界安全限制**：即時 Clamping 於 $X \in [-2.95, 2.95]\text{m}$, $Z \in [0.65, 6.65]\text{m}$，徹底杜絕穿網或越過場外 A-Board 擋板。
    - **垂直起跳動力學與高空跳殺加成 (`src/physics/playerFootwork.js`, `src/physics/racketPhysics.js`, `src/rendering/entities/racketViewmodel.js`)**：
      - **`Space` 垂直跳躍動力學升級**：起跳初速升級至 $v_y = 5.6\text{ m/s}$，離地頂點約 1.60m，玩家視點高度在最高點達到 3.38m（遠超過 1.524m 網高兩倍以上），呈現強烈的高空俯衝殺球體感。
      - **3D 拍面世界座標精準噴發 (`getStringBedWorldPosition`)**：擊球瞬間透過第一人稱 Viewmodel 計算球拍拍面網格世界座標 `[bedX, bedY, bedZ]`，羽球、3D 雙重衝擊波環與氣流尾跡 100% 由螢幕上 3D 球拍頭部直接發出，徹底消除「高跳殺球看起來卻像從人物平面發出」的視覺違和感。
      - **高度感知彈道學 (Height-Aware Ballistics)**：
        - 空中起跳重殺 (Jump Smash)：拍面高度 `bedY` 位於 2.6m ~ 3.65m 高空，依對網距離動態計算出射俯角 $-15.5^\circ \sim -26.0^\circ$，出速乘上 1.08x 加成（可達 250~270 km/h），凌厲垂直俯衝重砸對手場地。
        - 地面殺球 (Ground Smash)：拍面高度 `bedY` 約 1.95m ~ 2.15m，依幾何過網高度自適應計算出射角（$-3.5^\circ \sim -12.0^\circ$），平疾壓過白網帶頂端（Y >= 1.56m）且絕不穿網或掛網。
      - **動態擴展擊球天花板 (Strike Ceiling Extension)**：起跳滯空期間依離地高度動態擴展至最高 $4.81\text{m}$ ($3.45 + \text{player.pos}[1] \times 0.85$)，高空攔截後場深遠高球。
    - **第一人稱視角運動系統與高空俯瞰 (`src/main.js`, `camera-systems`)**：
      - **步伐搖晃動態 (Step Bobbing)**：在水平移動時，相機 Y 與 X 軸產生正弦微幅晃動（$A_y \approx 0.024\text{m}$, $A_x \approx 0.012\text{m}$），起跳與落地時具備平滑緩衝與復位。
      - **相機垂直移動零延遲響應**：將水平相機平滑 (`smoothFactorXZ = 10 dt`) 與垂直平滑 (`smoothFactorY = 28 dt`) 獨立分離，相機 Y 軸隨跳躍瞬間急速升空，消除垂直位移遲滯感。
      - **跳殺空中俯瞰視角 (Aerial Look-Down Vantage)**：空中起跳與殺球擊出後，相機自動向下微傾（視線向下偏置 $-y_{\text{jump}} \times 0.35$），玩家可清晰俯瞰球網與對手半場，達成極致的跳殺衝擊感。
      - **高球仰角自然微追隨 (Pitch Gaze Assist)**：當羽球飛行高度高於 1.8m 且在視野前方時，第一人稱相機視線目標點 Y 軸平滑抬升 $\min(1.15, (y_{\text{shuttle}} - 1.8) \times 0.36)$，確保後場高球不脫離視野。
    - **直覺手勢判定與 35ms 峰值速度提交窗口 (`src/physics/racketPhysics.js`, `src/input/pointerController.js`)**：
      - **手勢起始象限鎖定 (`startQuadrant`)**：記錄揮拍動作開始時的象限，解決由 Q1/Q2 向下急揮扣殺時因游標穿過水平軸誤判為 Q4/Q3 低象限的問題，向下急揮 100% 觸發 SMASH，向上挑揮 100% 觸發 LIFT。
      - **35ms 峰值速度提交窗口**：實裝 35ms 微窗口累積玩家劃動速度，防止在滑鼠剛加速（240 px/s 初速）時過早觸發而誤判為放網或切球。
      - **場地深度感知球路**：在後場底線時慢速揮拍自動對應為吊球或平高球，杜絕在底線誤出超短網前放網球挂網的問題。
    - **3D 對手實體化與戰術指示環 (`src/rendering/entities/opponentEntity.js`)**：
      - **完整 3D 選手建模**：由軀幹、運動球衣（AI 蔚藍 / 發球機琥珀金）、短褲、四肢、防眩光頭帶、球鞋與手持碳纖維球拍組成。
      - **地面戰術指示環 (Tactical Floor Ring)**：腳底配置 0.72m 戰術同心環，AI 模式顯示發光蔚藍 (`#38BDF8`)，發球機模式顯示發光金琥珀 (`#FFB300`)，隨對手擊球揮拍微幅外擴脈衝。
      - **右臂前擺揮拍骨架**：AI 或發球機擊球瞬間觸發 0.22s 揮拍動畫，右臂與球拍有力向前揮出，擊球完成後自然平滑收拍復位。
    - **AI 戰術對手狀態機與發球機訓練模式 (`src/ai/opponentController.js`)**：
      - **6 狀態有限狀態機 (FSM)**：`'ready'`, `'intercepting'`, `'swinging'`, `'recovering'`, `'serving'`, `'feeder'`。
      - **空檔落點戰術決策 (Open Court Placement)**：AI 監測玩家即時位置 (`player.pos[0]`)，擊球時逆向瞄準玩家防守空檔側；依回擊時機決定球路（網前切球/放網、後場平高、中場重殺、被動挑球）。
      - **發球機多球路訓練模式 (Feeder Training Mode)**：固定於底線發球位，每 2.2 秒自動循環供出不同球路（CLEAR、DROP、SMASH、DRIVE），提供玩家穩定的截擊與防守練球循環。
      - **BWF 官方落地得分與發球重置判定**：羽球落地或觸網時自動結算得分方 (`score.player` / `score.opponent`)，HUD 顯示戰術得分橫幅，1.25 秒後自動啟動下一回合發球。
    - **出框邊緣指向箭頭指示器 (Off-Screen Shuttlecock Indicator in `src/ui/hudOverlay.js`)**：
      - 透過 Three.js `.project(camera)` 即時投影羽球 3D 位置至 NDC 空間。
      - 當羽球超出畫面邊緣（$|ndcX| > 0.90$ 或 $|ndcY| > 0.88$ 或位於相機背後 $ndcZ > 1.0$）時，在 2D HUD 邊界繪製動態指示膠囊、方向指向人字箭頭 (Chevron) 以及垂直高度標示（例如 `▲ 4.5m`），防止玩家在第一人稱視角下丟球。
    - **控制與模式切換 (`src/input/pointerController.js`, `index.html`, `src/ui/hudOverlay.js`, `src/main.js`)**：
      - 按鍵 `KeyM`、頂部 HUD `#hud-mode-btn` 按鈕與 `window.setPlayMode(mode)` 支援隨時切換 `'ai_match'` 與 `'feeder'` 模式。
      - 按鍵 `Space` 支援空中起跳；`WASD` / 方向鍵全向微調走位。
      - 測試 Hooks 暴露：`window.setPlayMode`, `window.triggerPlayerJump`, `window.setPlayerMoveKeys`。
  - **自動化測試執行器 (`tests/runners/run_m5_qa.js`)**：
    - 實裝 Playwright 自動化測試套件，包含 5 組端到端測試項：
      1. `m5_player_footwork_wasd`：驗證自動落點攔截位移與 `WASD` 手動按鍵無縫覆蓋為 `manual` 走位狀態與邊界安全限制。
      2. `m5_jump_smash_combo`：驗證 `Space` 起跳垂直動力學（$Y > 0.65\text{m}$）、擊球天花板擴展至 4.35m、空中重殺 1.08x 速度加成與下傾出射角。
      3. `m5_ai_opponent_rally`：驗證 3D 對手實體渲染、AI 攔截移動、回球發射與 BWF 落地得分推進。
      4. `m5_feeder_training_mode`：驗證發球機模式切換、規律多球路供球發射與地面戰術環切換為金琥珀色。
      5. `m5_offscreen_indicator`：驗證仰角高球出框時邊緣指示器之 NDC 投影座標、角度計算與高度標籤。
  - **獨立 QA 審查與 Playwright 驗證報告 (QA_PASSED)**：
    - **白箱源碼審計 (Anti-Shortcut Audit)**：確認 `src/physics/playerFootwork.js`、`src/ai/opponentController.js`、`src/rendering/entities/opponentEntity.js`、`src/physics/racketPhysics.js` 完全依據真實物理與數學模型運作，無任何寫死之造假回傳；`Space` 起跳垂直重力動力學與 `arrive2D` 轉向運動自然；3D 對手運動員具備關節與揮拍骨架，無穿模或懸空；出框指示器由真 3D-to-NDC 投影計算。
    - **黑箱 Playwright 自動化與視覺審查**：
      - 5 組自動化測試全部通過（Exit Code 0），Console 與 Page Errors 均為 0。
      - 目視審查 `tests/output/milestone5/m5_auto_footwork_and_wasd/footwork-wasd.png`：手動 `WASD` 走位流暢切換，頂部 HUD 顯示 `[WASD]` 標籤與 `[AI MATCH]` 模式，對手實體清爽自然。
      - 目視審查 `tests/output/milestone5/m5_jump_smash_combo/jump-smash-airborne.png`：起跳滯空視角抬升，空中重殺出速飆至 249 km/h (+8% 加成)，下傾角度加大，FOV 驟縮與金光速度線完美協同。
      - 目視審查 `tests/output/milestone5/m5_ai_opponent_rally_and_scoring/ai-opponent-return.png`：AI 對手跨步截擊並揮動 3D 球拍回球，落地得分判定與比分 (`SCORE 1 : 0`) 推進正常。
      - 目視審查 `tests/output/milestone5/m5_feeder_training_mode/feeder-mode.png`：發球機模式下對手站定底線，地面戰術環切換為琥珀金色 (`#FFB300`)，規律發球供球。
      - 目視審查 `tests/output/milestone5/m5_offscreen_indicator/offscreen-indicator.png`：高遠球出框時，螢幕頂部邊緣精準渲染 `SHUTTLE ▲ 6.4m` 人字箭頭指示膠囊，引導第一人稱視線。
    - **v2 修正白箱與視覺複審 (Anti-Shortcut & Physical Sweet Spot Re-Audit - 2026-10-27)**：
      - **3D 拍面甜區出射座標 (`getStringBedWorldPosition`)**：確認 `src/rendering/entities/racketViewmodel.js` 透過 `(0, 0.465, 0)`（網線正中心甜區）結合 `wristPivotGroup.quaternion` 與相機世界矩陣，實裝精確之 `getStringBedWorldPosition(camera)`。擊球瞬間羽球與雙重衝擊環直接自拍面中心迸發，Frame 0 軟木塞尖端四元數直接對齊出射速度向量指向落點。
      - **動態透視縮放 (`shuttlecockEntity.js`)**：依與相機距離動態調節羽球視覺縮放（0.5m 處 0.72x 至 >=2.5m 處 1.55x），消除近距球體過大問題。
      - **起拍象限鎖定與 35ms 峰值提交視窗 (`startQuadrant` & `pendingSwipe`)**：`src/input/pointerController.js` 緩衝起手 35ms 獲取真實峰值速度並固化 `startQuadrant`，徹底根除下殺越界拍面翻轉與起手低速誤判；結合站位深度判定，網前放網與後場抽殺界限分明。
      - **Playwright 自動化測試與視覺覆核**：5 組自動化測試（`summary.json`，時間戳 `2026-10-27T02:48:03Z`）全部 PASS，0 錯誤。審查 `jump-smash-airborne.png`，羽球與雙重衝擊環完美嵌合於 3D 碳纖拍面正中心，起跳跳殺出速 249 km/h、FOV 74°，視覺震撼度與物理一致性達標。
    - **v3 殺球調速與前搖預警系統獨立 QA 驗證 (QA_PASSED - 2026-10-27)**：
      - **球速調校與反應窗口審計**：確認 `src/ai/opponentController.js` 對手/發球機 `SMASH` 專屬出射參數嚴格校準為 `speed: 36.0` m/s、`elevationDeg: -12.0`°、出球高度 2.65m。經二階空氣阻力彈道學驗算，羽球於 $Z = 0$ 網前高度約 1.77m（淨空高於網中心 1.524m），抵達玩家接球區時間由原本極限之 0.21s 延長至約 0.50s（反應時間增加 2.4 倍），玩家有足夠時間進行判斷、走位與回抽/挑球防守。
      - **全流程殺球前搖預警系統 (Smash Telegraph Pipeline)**：
        - **決策狀態機**：`ai_match` 模式在羽球進入對手場地時提前 0.6s~1.0s 判定接球意圖；`feeder` 模式於發球前 0.75s 進入預熱，設定 `state.opponent.chargingSmash = true` 與 `intendedShot = 'SMASH'`，身體平滑起跳滯空 ($Y \to 0.65\text{m}$)。
        - **3D 視覺與引拍姿態**：`src/rendering/entities/opponentEntity.js` 激活 3D 拍面旋轉呼吸光環 (`smashAuraMesh`)，腳底戰術環切換為赤橙色 (`#FF3D00`) 脈衝，軀幹與右肩關節切換為高舉過頭之後仰引拍拉弓骨架。
        - **HUD 動態警示橫幅**：`src/ui/hudOverlay.js` 於蓄力期渲染 `⚠️ 對手殺球預警 SMASH WARNING — 準備抽擋 / 挑球防守！`，出球飛行期切換為 `🔥 對手重殺來襲 SMASH INCOMING!`，漸層與光暈呼吸動態醒目流暢。
        - **Web Audio 警示音效**：`src/audio/soundEngine.js` 透過雙音上升和弦（520Hz $\to$ 780Hz，-10 dB）程序化合成前搖音效，並同步記錄於 `effects.lastAudioEvent`。
      - **自動化測試覆核**：`tests/runners/run_m5_qa.js` 擴充之 Test 4 斷言結構完整覆蓋 `chargingSmash === true`、`intendedShot === 'SMASH'`、`lastAudioEvent.type === 'smash_warning'`、`speed <= 40.0 && speed >= 32.0` 與出球後狀態復位；全套件保持 0 控制台報錯，源碼與架構無走捷徑。
    - **QA 驗證產物**：更新存檔於 `tests/output/milestone5/summary.json` 與各測試子目錄截圖。

- [ ] **Milestone 6: WebRTC P2P 雙人連線與完整規則**
  - **必用 Skills**：`openai-develop-web-game`, `codebase-design`, `physics-tuning`, `game-ui-ux`, `threejs-performance`, `performance-optimization`
  - **實作項目**：
    - 整合 PeerJS WebRTC DataChannel 房間代碼建立與加入介面
    - 實作擊球封包確定性軌跡同步與對手位置平滑插值
    - 實作完整 21 分制計分、發球區奇偶交換與勝負結算畫面，並進行全場景效能調校
  - **自動化測試與驗收**：驗證單人/雙人連線切換與封包同步，透過 `advanceTime` 驗證雙端重現軌跡精確一致。

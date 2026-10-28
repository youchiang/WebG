# WebG 專案規範與 Skill 自動調度指南 (AGENTS.md)

本文件是專案的最高原則。開發時**使用者不需要手動指定任何 Skill 名稱**，Agent 必須根據使用者的自然語言需求，自動匹配並讀取以下對應的 Skill 實施最佳實踐。

---

## 🎯 Skill 自動調度矩陣 (Skill Routing Matrix)

當使用者提出以下領域的需求時，Agent **必須主動讀取對應的 `SKILL.md`**：

| 使用者需求領域 (自然語言關鍵字) | 自動調用之 Skill | Skill 實體檔案路徑 |
| :--- | :--- | :--- |
| **手感、打擊感、打擊反饋**<br>（卡肉、定格 Hit-Stop、震屏 Trauma、FOV 縮放） | `game-feel`<br>`physics-tuning` | `C:\Users\john.hu\.agents\skills\game-feel\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\physics-tuning\SKILL.md` |
| **音效、打擊聲、背景音樂**<br>（Web Audio 合成、dB 混音、隨機音高變化） | `audio-design` | `C:\Users\john.hu\.agents\skills\audio-design\SKILL.md` |
| **鏡頭、視覺晃動、視角追隨**<br>（第一人稱步態搖擺、高球仰角追隨、球拍翻轉） | `camera-systems`<br>`threejs-animation` | `C:\Users\john.hu\.agents\skills\camera-systems\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\threejs-animation\SKILL.md` |
| **3D 場景、幾何建模、材質光影**<br>（球場、球網、球拍模型、PBR 地膠材質、天光） | `threejs-scene-setup`<br>`threejs-materials`<br>`threejs-lighting` | `C:\Users\john.hu\.agents\skills\threejs-scene-setup\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\threejs-materials\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\threejs-lighting\SKILL.md` |
| **著色器、殘影、光弧與特效**<br>（羽球動態外框 Shader、Fresnel 輪廓、揮拍光弧） | `threejs-shaders`<br>`shader-programming` | `C:\Users\john.hu\.agents\skills\threejs-shaders\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\shader-programming\SKILL.md` |
| **輸入控制、滑鼠鎖定、正反手切換**<br>（Pointer Lock、滑鼠速度向量、體感揮拍判定） | `input-systems`<br>`threejs-interaction` | `C:\Users\john.hu\.agents\skills\input-systems\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\threejs-interaction\SKILL.md` |
| **AI 對手、發球機、走位演算法**<br>（狀態機、擊球決策、落點攔截輔助） | `game-ai` | `C:\Users\john.hu\.agents\skills\game-ai\SKILL.md` |
| **Threads/社群小遊戲特性、手機適配、上線部署**<br>（防下拉重整、100dvh、拍立得成績截圖、Web Share API、Vercel 一鍵部署） | `threads-web-game` | `C:\Users\john.hu\.agents\skills\threads-web-game\SKILL.md` |
| **效能調校、穩定 60 FPS、記憶體優化**<br>（Draw Call 合併、幾何快取、垃圾回收管理） | `threejs-performance`<br>`performance-optimization` | `C:\Users\john.hu\.agents\skills\threejs-performance\SKILL.md`<br>`C:\Users\john.hu\.agents\skills\performance-optimization\SKILL.md` |
| **自動化測試、Playwright 驗證閉環**<br>（`advanceTime` 推進、`render_game_to_text`） | `openai-develop-web-game` | `C:\Users\john.hu\.agents\skills\openai-develop-web-game\SKILL.md` |

---

## 🛠️ 開發與驗證守則
1. **主動透明化報備（Skill Transparency）**：
   在回答使用者需求或開始修改程式碼時，**必須在回應開頭或思考中清楚標註：`🎯 自動調用 Skill: [已讀取的技能名稱]`**，讓使用者清楚知道當前採用了哪一門專業實踐。
2. **深模組設計**：維持 `src/physics/`、`src/rendering/`、`src/core/` 職責分離，禁止在渲染層直接寫入物理狀態。
3. **測試驅動**：任何球路或操控邏輯變更後，優先使用 `npm run test:m5` 或 Playwright 腳本驗證。

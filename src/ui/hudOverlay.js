import { audioEngine } from '../core/audioEngine.js';
import { generateDriftShareCard, shareDriftScore } from '../input/shareCardGenerator.js';

export class HudOverlay {
  constructor(gameCanvas, gameStateManager) {
    this.canvas = gameCanvas;
    this.gsm = gameStateManager;

    // Cache DOM Elements
    this.topHud = document.getElementById('top-hud');
    this.scoreValEl = document.getElementById('hud-score-val');
    this.comboBadgeEl = document.getElementById('hud-combo-badge');
    this.comboTextEl = document.getElementById('hud-combo-text');
    this.trashTextEl = document.getElementById('hud-trash-text');
    this.speedBadgeEl = document.getElementById('hud-speed-badge');
    this.progressFillEl = document.getElementById('hud-progress-fill');
    this.driftCalloutEl = document.getElementById('drift-callout');

    // Screens
    this.startScreen = document.getElementById('start-screen');
    this.startBtn = document.getElementById('start-race-btn');

    this.finishScreen = document.getElementById('finish-screen');
    this.finishScoreEl = document.getElementById('finish-score-val');
    this.finishTitleEl = document.getElementById('finish-title-val');
    this.statDriftPtsEl = document.getElementById('stat-drift-pts');
    this.statYeetCountEl = document.getElementById('stat-yeet-count');
    this.statLongestDriftEl = document.getElementById('stat-longest-drift');
    this.statRaceTimeEl = document.getElementById('stat-race-time');
    this.shareBtn = document.getElementById('share-btn');
    this.restartBtn = document.getElementById('restart-btn');

    this.bindEvents();
  }

  bindEvents() {
    // Start button
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        audioEngine.unlock();
        this.gsm.startRace();
        this.startScreen.classList.add('hidden');
        this.topHud.classList.remove('hidden');
      });
    }

    // Restart button
    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', () => {
        this.finishScreen.classList.add('hidden');
        this.gsm.reset();
        this.gsm.startRace();
        this.topHud.classList.remove('hidden');
      });
    }

    // Share button
    if (this.shareBtn) {
      this.shareBtn.addEventListener('click', async () => {
        this.shareBtn.innerText = '🖼️ 產生戰報中...';
        try {
          const blob = await generateDriftShareCard({
            gameCanvas: this.canvas,
            state: this.gsm.state,
          });
          await shareDriftScore({ imageBlob: blob, state: this.gsm.state });
        } catch (e) {
          console.warn('Share card failed:', e);
        } finally {
          this.shareBtn.innerText = '✨ 分享我的甩尾戰報 (Threads / IG)';
        }
      });
    }

    // Subscribe to game state changes
    this.gsm.subscribe((event, payload, state) => {
      if (event === 'RACE_FINISHED') {
        this.showFinish(state);
      }
    });
  }

  update(state) {
    if (state.mode !== 'RACING') return;

    // 1. Live Score
    if (this.scoreValEl) {
      this.scoreValEl.innerText = Math.floor(state.totalScore).toLocaleString();
    }

    // 2. Combo
    if (this.comboBadgeEl && this.comboTextEl) {
      if (state.combo > 1.05) {
        this.comboBadgeEl.classList.remove('hidden');
        this.comboBadgeEl.classList.add('active');
        this.comboTextEl.innerText = `x${state.combo.toFixed(1)}`;
      } else {
        this.comboBadgeEl.classList.remove('active');
        this.comboBadgeEl.classList.add('hidden');
      }
    }

    // 3. Trash Bags Remaining & Speed & Progress
    if (this.trashTextEl) {
      const rem = state.trashBagsRemaining !== undefined ? state.trashBagsRemaining : 30;
      this.trashTextEl.innerText = `${rem}/30`;
    }

    if (this.speedBadgeEl) {
      const speedKmh = Math.round(state.speed * 3.6);
      this.speedBadgeEl.innerText = `${speedKmh} km/h`;
    }

    if (this.progressFillEl) {
      const pct = Math.min(100, Math.max(0, state.progress * 100));
      this.progressFillEl.style.width = `${pct.toFixed(1)}%`;
    }

    // 4. Drift Callout
    if (this.driftCalloutEl) {
      if (state.isDrifting) {
        if (state.dangerDriftActive) {
          this.driftCalloutEl.innerText = `🔥 貼欄極限甩尾! (${state.driftAngleDeg}°)`;
        } else {
          this.driftCalloutEl.innerText = `💨 漂移中! (${state.driftAngleDeg}°)`;
        }
        this.driftCalloutEl.classList.add('show');
      } else {
        this.driftCalloutEl.classList.remove('show');
      }
    }
  }

  showFinish(state) {
    if (this.topHud) this.topHud.classList.add('hidden');
    if (this.finishScreen) {
      this.finishScoreEl.innerText = Math.floor(state.totalScore).toLocaleString();
      this.finishTitleEl.innerText = state.evaluationTitle;

      if (this.statDriftPtsEl) {
        this.statDriftPtsEl.innerText = Math.floor(state.driftScore).toLocaleString();
      }
      if (this.statYeetCountEl) {
        this.statYeetCountEl.innerText = `${state.totalYeeted} 次`;
      }
      if (this.statLongestDriftEl) {
        this.statLongestDriftEl.innerText = `${state.longestDriftDuration.toFixed(1)} 秒`;
      }
      if (this.statRaceTimeEl) {
        this.statRaceTimeEl.innerText = `${state.elapsedRaceTime.toFixed(1)} 秒`;
      }

      this.finishScreen.classList.remove('hidden');
    }
  }
}

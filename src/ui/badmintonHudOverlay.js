import * as THREE from 'three';
import { HYSTERESIS_PX } from '../core/badmintonConstants.js';

/**
 * Deep module managing both the DOM HUD elements and the in-canvas Orthographic HUD overlay
 * (so canvas.toDataURL() screenshots include the quadrant hairlines, (0,0) origin,
 * virtual cursor indicator, swipe velocity vector, and minimalist status bar).
 * Follows `game-ui-ux` event-driven update pattern (redraws only when dirty).
 */
export function createHudSystem(state) {
  const topHudEl = document.getElementById('top-hud');
  const startScreenEl = document.getElementById('start-screen');
  const scoreEl = document.getElementById('hud-score');
  const quadrantEl = document.getElementById('hud-quadrant');
  const cursorEl = document.getElementById('hud-cursor');
  const shuttleEl = document.getElementById('hud-shuttle');
  const modeBtnEl = document.getElementById('hud-mode-btn');
  const courtBadgeEl = document.getElementById('hud-court-badge');

  // Milestone 6: Match Settlement & P2P Lobby DOM Elements
  const matchOverScreenEl = document.getElementById('match-over-screen');
  const matchWinnerTitleEl = document.getElementById('match-winner-title');
  const matchWinnerSubtitleEl = document.getElementById('match-winner-subtitle');
  const finalScorePlayerEl = document.getElementById('final-score-player');
  const finalScoreOpponentEl = document.getElementById('final-score-opponent');
  const matchStatRalliesEl = document.getElementById('match-stat-rallies');
  const matchStatMaxSmashEl = document.getElementById('match-stat-max-smash');
  const matchStatDeuceEl = document.getElementById('match-stat-deuce');
  const rematchBtnEl = document.getElementById('rematch-btn');

  const tabAiBtn = document.getElementById('tab-ai-btn');
  const tabFeederBtn = document.getElementById('tab-feeder-btn');
  const tabP2pBtn = document.getElementById('tab-p2p-btn');

  const p2pLobbyPanel = document.getElementById('p2p-lobby-panel');
  const createRoomBtn = document.getElementById('create-room-btn');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const joinRoomInput = document.getElementById('join-room-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const p2pStatusBadge = document.getElementById('p2p-status-badge');

  // Mode Toggle Button click listener (cycles ai_match -> feeder -> p2p_multiplayer)
  modeBtnEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    let nextMode = 'ai_match';
    if (state.playMode === 'ai_match') nextMode = 'feeder';
    else if (state.playMode === 'feeder') nextMode = 'p2p_multiplayer';
    else nextMode = 'ai_match';

    state.playMode = nextMode;
    state.opponent.state = nextMode === 'feeder' ? 'feeder' : 'ready';
    state.rallyResetTimer = 0.8;
    markDirty(true);
  });

  // Start Screen Mode Tabs
  tabAiBtn?.addEventListener('click', () => {
    state.playMode = 'ai_match';
    state.opponent.state = 'ready';
    markDirty(true);
  });
  tabFeederBtn?.addEventListener('click', () => {
    state.playMode = 'feeder';
    state.opponent.state = 'feeder';
    markDirty(true);
  });
  tabP2pBtn?.addEventListener('click', () => {
    state.playMode = 'p2p_multiplayer';
    markDirty(true);
  });

  // P2P Room Lobby Handlers
  createRoomBtn?.addEventListener('click', async () => {
    if (typeof window.createP2PRoom === 'function') {
      const code = await window.createP2PRoom();
      if (roomCodeDisplay) roomCodeDisplay.textContent = `ROOM: ${code}`;
      markDirty(true);
    }
  });

  joinRoomBtn?.addEventListener('click', async () => {
    const code = joinRoomInput?.value?.trim();
    if (code && typeof window.joinP2PRoom === 'function') {
      await window.joinP2PRoom(code);
      markDirty(true);
    }
  });

  // Rematch Button Handler
  rematchBtnEl?.addEventListener('click', () => {
    if (typeof window.resetMatch === 'function') {
      window.resetMatch();
      markDirty(true);
    }
  });

  // Offscreen 2D canvas for crisp Orthographic HUD overlay inside WebGL canvas
  let logicalWidth = window.innerWidth || 1280;
  let logicalHeight = window.innerHeight || 720;

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = Math.min(1280, logicalWidth);
  overlayCanvas.height = Math.min(720, logicalHeight);
  const ctx = overlayCanvas.getContext('2d');

  const overlayTexture = new THREE.CanvasTexture(overlayCanvas);
  overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.generateMipmaps = false;
  overlayTexture.minFilter = THREE.LinearFilter;
  overlayTexture.magFilter = THREE.LinearFilter;

  const hudScene = new THREE.Scene();
  const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);

  const hudQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: overlayTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  hudScene.add(hudQuad);

  let isDirty = true;
  let forceImmediate = true;
  let lastHudDrawMs = 0;
  let lastHudMode = null;

  function markDirty(immediate = false) {
    isDirty = true;
    if (immediate) {
      forceImmediate = true;
    }
  }

  function resize(width, height) {
    logicalWidth = Math.max(1, width);
    logicalHeight = Math.max(1, height);
    overlayCanvas.width = Math.min(1280, logicalWidth);
    overlayCanvas.height = Math.min(720, logicalHeight);
    isDirty = true;
    forceImmediate = true;
  }

  function getQuadrantLabel(q, grip) {
    const gripText = grip === 'forehand' ? '正拍 Forehand' : '反拍 Backhand';
    return `${q} · ${gripText}`;
  }

  function syncDom() {
    if (state.mode === 'match_over') {
      matchOverScreenEl?.classList.remove('hidden');
      startScreenEl?.classList.add('hidden');
      topHudEl?.classList.remove('hidden');

      if (matchWinnerTitleEl) {
        if (state.score.matchWinner === 'player') {
          matchWinnerTitleEl.textContent = '🏆 恭喜獲勝！PLAYER WINS';
          matchWinnerTitleEl.style.color = '#047857';
        } else {
          matchWinnerTitleEl.textContent = '比賽結束 · OPPONENT WINS';
          matchWinnerTitleEl.style.color = '#c2410c';
        }
      }
      if (finalScorePlayerEl) finalScorePlayerEl.textContent = state.score.player;
      if (finalScoreOpponentEl) finalScoreOpponentEl.textContent = state.score.opponent;
      if (matchStatRalliesEl) matchStatRalliesEl.textContent = state.score.totalRallies || 0;
      if (matchStatMaxSmashEl) matchStatMaxSmashEl.textContent = `${state.score.maxSmashSpeedKmh || 0} km/h`;
      if (matchStatDeuceEl) matchStatDeuceEl.textContent = state.score.isDeuce ? '是 (曾追平)' : '無';
    } else if (state.mode === 'playing') {
      matchOverScreenEl?.classList.add('hidden');
      startScreenEl?.classList.add('hidden');
      topHudEl?.classList.remove('hidden');
    } else {
      matchOverScreenEl?.classList.add('hidden');
      startScreenEl?.classList.remove('hidden');
      topHudEl?.classList.add('hidden');
    }

    if (tabAiBtn && tabFeederBtn && tabP2pBtn) {
      tabAiBtn.classList.toggle('active', state.playMode === 'ai_match');
      tabFeederBtn.classList.toggle('active', state.playMode === 'feeder');
      tabP2pBtn.classList.toggle('active', state.playMode === 'p2p_multiplayer');
    }
    if (p2pLobbyPanel) {
      p2pLobbyPanel.classList.toggle('hidden', state.playMode !== 'p2p_multiplayer');
      if (state.playMode === 'p2p_multiplayer') {
        if (roomCodeDisplay && state.network?.roomCode) {
          roomCodeDisplay.textContent = `ROOM: ${state.network.roomCode}`;
        }
        if (p2pStatusBadge) {
          if (state.network.status === 'hosting') {
            p2pStatusBadge.textContent = `等待對手加入中... (Hosting: ${state.network.roomCode})`;
            p2pStatusBadge.style.color = '#0284c7';
          } else if (state.network.status === 'connected') {
            p2pStatusBadge.textContent = `🟢 P2P 已連線 (${(state.network.transport || '').toUpperCase()}) | ${state.network.pingMs}ms`;
            p2pStatusBadge.style.color = '#059669';
          } else if (state.network.status === 'joining') {
            p2pStatusBadge.textContent = `正在連線中... (Joining: ${state.network.roomCode})`;
            p2pStatusBadge.style.color = '#f59e0b';
          } else {
            p2pStatusBadge.textContent = '未連線 Offline';
            p2pStatusBadge.style.color = '#64748b';
          }
        }
      }
    }

    if (scoreEl) {
      scoreEl.textContent = `${state.score.player} : ${state.score.opponent}`;
    }
    if (courtBadgeEl) {
      if (state.score.isDeuce) {
        courtBadgeEl.textContent = '★ DEUCE 20:20';
        courtBadgeEl.className = 'hud-badge court-badge deuce';
      } else if (state.score.isGamePoint) {
        const holder = state.score.gamePointHolder === 'player' ? ' (我方賽點)' : (state.score.gamePointHolder === 'opponent' ? ' (對方賽點)' : '');
        courtBadgeEl.textContent = `★ GAME POINT${holder}`;
        courtBadgeEl.className = 'hud-badge court-badge deuce';
      } else if (state.score.serviceCourt === 'left_odd') {
        courtBadgeEl.textContent = '奇數左區 Left (Odd)';
        courtBadgeEl.className = 'hud-badge court-badge odd';
      } else {
        courtBadgeEl.textContent = '偶數右區 Right (Even)';
        courtBadgeEl.className = 'hud-badge court-badge';
      }
    }
    if (modeBtnEl) {
      if (state.playMode === 'feeder') {
        modeBtnEl.textContent = '發球機模式 [M]';
        modeBtnEl.className = 'hud-badge mode-badge feeder';
      } else if (state.playMode === 'p2p_multiplayer') {
        const role = state.network?.role === 'host' ? 'HOST' : (state.network?.role === 'guest' ? 'GUEST' : 'P2P');
        const ping = state.network?.peerConnected ? ` | ${state.network.pingMs}ms` : '';
        modeBtnEl.textContent = `P2P [${role}${ping}] [M]`;
        modeBtnEl.className = 'hud-badge mode-badge p2p';
      } else {
        modeBtnEl.textContent = 'AI 對戰模式 [M]';
        modeBtnEl.className = 'hud-badge mode-badge';
      }
    }
    if (quadrantEl) {
      const jumpTag = state.player.isJumping ? ' · JUMP▲' : '';
      quadrantEl.textContent = `${getQuadrantLabel(state.player.racketQuadrant, state.player.grip)}${jumpTag}`;
    }
    if (cursorEl) {
      const [cx, cy] = state.player.virtualCursor;
      const swipeInfo = state.player.swipeSpeed > 50 ? ` | ${Math.round(state.player.swipeSpeed)} px/s` : '';
      cursorEl.textContent = `(${cx}, ${cy})${swipeInfo}`;
    }
    if (shuttleEl) {
      if (state.opponent?.chargingSmash && !state.shuttle.inFlight) {
        shuttleEl.textContent = '⚠️ SMASH CHARGING · 對手即將殺球！';
        shuttleEl.style.background = 'rgba(255, 61, 0, 0.38)';
        shuttleEl.style.color = '#bf360c';
      } else {
        const kmh = Math.round((state.shuttle.speed || 0) * 3.6);
        const shot = state.shuttle.shotType || 'IDLE';
        const isSweet = state.shuttle.outlineState === 'sweet_spot_green';
        const hitInfo = state.player.lastShotType
          ? ` | HIT: ${state.player.lastShotType} (${state.player.lastShotSpeedKmh || 0} km/h)`
          : '';
        shuttleEl.textContent = `${shot} · ${kmh} km/h${isSweet ? ' ★ SWEET SPOT' : ''}${hitInfo}`;
        if (isSweet) {
          shuttleEl.style.background = 'rgba(0, 230, 118, 0.32)';
          shuttleEl.style.color = '#006030';
        } else if (state.shuttle.outlineState === 'smash_flame') {
          shuttleEl.style.background = 'rgba(255, 61, 0, 0.28)';
          shuttleEl.style.color = '#bf360c';
        } else if (state.shuttle.outlineState === 'drop_cyan') {
          shuttleEl.style.background = 'rgba(0, 176, 255, 0.28)';
          shuttleEl.style.color = '#01579b';
        } else {
          shuttleEl.style.background = 'rgba(152, 201, 163, 0.28)';
          shuttleEl.style.color = '#1b4332';
        }
      }
    }
  }

  function drawCanvasOverlay() {
    const w = logicalWidth;
    const h = logicalHeight;
    const cx = w / 2;
    const cy = h / 2;

    const scaleX = overlayCanvas.width / logicalWidth;
    const scaleY = overlayCanvas.height / logicalHeight;

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Always draw subtle quadrant origin reticle so court center is clear;
    // when playing, draw full interactive quadrant hairlines + virtual cursor + top HUD pill.
    const crosshairRadius = Math.min(w, h) * 0.34;

    ctx.save();

    // 1. Quadrant Divider Hairlines centered at (0,0)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.22)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 6]);

    // Horizontal axis (Y = 0 divider between high shots Q1/Q2 and low shots Q3/Q4)
    ctx.beginPath();
    ctx.moveTo(cx - crosshairRadius, cy);
    ctx.lineTo(cx + crosshairRadius, cy);
    ctx.stroke();

    // Vertical axis (X = 0 divider between Backhand Q2/Q3 and Forehand Q1/Q4)
    ctx.beginPath();
    ctx.moveTo(cx, cy - crosshairRadius * 0.78);
    ctx.lineTo(cx, cy + crosshairRadius * 0.78);
    ctx.stroke();

    ctx.setLineDash([]);

    // 2. Hysteresis Deadzone ticks at X = ±15px
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.28)';
    ctx.lineWidth = 1;
    [-HYSTERESIS_PX, HYSTERESIS_PX].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - 8);
      ctx.lineTo(cx + dx, cy + 8);
      ctx.stroke();
    });

    // 3. Center Origin (0,0) Ring
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.fillText('(0,0)', cx + 8, cy + 14);

    // 4. Quadrant Labels around the reticle perimeter
    const activeQ = state.player.racketQuadrant;
    const quadLabels = [
      { id: 'Q1', text: 'Q1 正拍高球/重殺', x: cx + 115, y: cy - 85 },
      { id: 'Q2', text: 'Q2 反拍高球/擋殺', x: cx - 115, y: cy - 85 },
      { id: 'Q3', text: 'Q3 反拍放網/抽挑', x: cx - 115, y: cy + 95 },
      { id: 'Q4', text: 'Q4 正拍平抽/切放', x: cx + 115, y: cy + 95 },
    ];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ql of quadLabels) {
      const isActive = state.mode === 'playing' && activeQ === ql.id;
      ctx.font = isActive
        ? '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

      const padX = 8;
      const boxW = 118;
      const boxH = 22;

      ctx.fillStyle = isActive
        ? 'rgba(255, 255, 255, 0.88)'
        : 'rgba(255, 255, 255, 0.52)';
      ctx.beginPath();
      ctx.roundRect(ql.x - boxW / 2, ql.y - boxH / 2, boxW, boxH, 11);
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = isActive ? '#FF5722' : 'rgba(30, 41, 59, 0.62)';
      ctx.fillText(ql.text, ql.x, ql.y, boxW - padX);
    }

    // 5. Virtual Cursor, Top HUD & Match Settlement Overlay (when playing or match_over)
    if (state.mode === 'playing' || state.mode === 'match_over') {
      const [vx, vy] = state.player.virtualCursor;
      // Convert virtualCursor (+X right, +Y up) to screen coords (+X right, +Y down)
      const targetScreenX = cx + vx;
      const targetScreenY = cy - vy;

      // Vector line from origin (0,0) to virtual cursor
      ctx.strokeStyle =
        state.player.grip === 'forehand'
          ? 'rgba(255, 87, 34, 0.55)'
          : 'rgba(45, 106, 79, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(targetScreenX, targetScreenY);
      ctx.stroke();

      // Swipe Vector Trail (when mouse swiping or swinging)
      if (state.player.swipeSpeed > 60 || state.player.swingTimer > 0) {
        const normal = state.player.racketFaceNormal || [0, 0, -1];
        const trailLen = Math.min(80, (state.player.swipeSpeed / 500) * 45 + 20);
        // Normal points outward towards shuttle; project to 2D screen direction
        const trailDx = -normal[0] * trailLen;
        const trailDy = -normal[1] * trailLen;

        ctx.strokeStyle = state.player.grip === 'forehand' ? '#FF5722' : '#2D6A4F';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(targetScreenX, targetScreenY);
        ctx.lineTo(targetScreenX + trailDx, targetScreenY + trailDy);
        ctx.stroke();

        ctx.fillStyle = state.player.lastTimingQuality === 'sweet_spot' ? '#00E676' : '#FFD600';
        ctx.beginPath();
        ctx.arc(targetScreenX + trailDx, targetScreenY + trailDy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Virtual Cursor Outer Ring
      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(targetScreenX, targetScreenY, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Virtual Cursor Center Dot
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(targetScreenX, targetScreenY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw Top Frosted HUD Pill inside Canvas as well so canvas.toDataURL() captures it
      const pillW = Math.min(840, w - 32);
      const pillH = 38;
      const pillX = cx - pillW / 2;
      const pillY = 14;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 19);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      const gripStr = state.player.grip === 'forehand' ? '正拍 Forehand' : '反拍 Backhand';
      const jumpTag = state.player.isJumping ? ' · JUMP' : '';
      const footTag = state.player.footworkState === 'manual' ? ' · WASD' : '';
      const kmh = Math.round((state.shuttle.speed || 0) * 3.6);
      const shotStr = state.shuttle.shotType || 'IDLE';
      const swipeStr = state.player.swipeSpeed > 50 ? ` | SWIPE ${Math.round(state.player.swipeSpeed)} px/s` : '';
      const lastHitStr = state.player.lastShotType ? ` | HIT: ${state.player.lastShotType} (${state.player.lastShotSpeedKmh || 0} km/h)` : '';
      const modeStr =
        state.playMode === 'feeder'
          ? 'FEEDER'
          : state.playMode === 'p2p_multiplayer'
          ? state.network?.role === 'host'
            ? 'P2P HOST'
            : 'P2P GUEST'
          : 'AI MATCH';
      const courtStr =
        state.score.isDeuce
          ? ' [DEUCE 20:20]'
          : state.score.isGamePoint
          ? ' [GAME POINT]'
          : ` [${state.score.serviceCourt === 'right_even' ? 'RIGHT' : 'LEFT'}]`;
      const hudText = `[${modeStr}] SCORE ${state.score.player} : ${state.score.opponent}${courtStr}   |   ${state.player.racketQuadrant} (${gripStr}${jumpTag}${footTag})   |   CURSOR (${vx}, ${vy})   |   ${shotStr} (${kmh} km/h)${swipeStr}${lastHitStr}`;
      ctx.fillText(hudText, cx, pillY + pillH / 2 + 1);

      // 5B. Opponent Smash Warning Banner (Telegraph early warning & in-flight alert)
      const isOpponentChargingSmash = Boolean(state.opponent && state.opponent.chargingSmash);
      const isOpponentSmashFlying = Boolean(
        state.shuttle.inFlight &&
        state.shuttle.originSide === 'opponent' &&
        state.shuttle.shotType === 'SMASH'
      );

      if (isOpponentChargingSmash || isOpponentSmashFlying) {
        ctx.save();
        const bannerW = Math.min(520, w - 40);
        const bannerH = 34;
        const bannerX = cx - bannerW / 2;
        const bannerY = pillY + pillH + 10;

        // Animated pulse effect
        const pulse = Math.sin((state.elapsedTime || 0) * 12) * 0.12 + 0.88;

        // Gradient background
        const grad = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY);
        if (isOpponentChargingSmash) {
          grad.addColorStop(0, `rgba(255, 61, 0, ${0.92 * pulse})`);
          grad.addColorStop(0.5, `rgba(255, 109, 0, ${0.96 * pulse})`);
          grad.addColorStop(1, `rgba(255, 61, 0, ${0.92 * pulse})`);
        } else {
          grad.addColorStop(0, `rgba(213, 0, 0, ${0.94 * pulse})`);
          grad.addColorStop(0.5, `rgba(255, 23, 68, ${0.98 * pulse})`);
          grad.addColorStop(1, `rgba(213, 0, 0, ${0.94 * pulse})`);
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 17);
        ctx.fill();

        ctx.strokeStyle = '#FFE57F';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const warningMsg = isOpponentChargingSmash
          ? '⚠️ 對手殺球預警 SMASH WARNING — 準備抽擋 / 挑球防守！'
          : '🔥 對手重殺來襲 SMASH INCOMING!';
        ctx.fillText(warningMsg, cx, bannerY + bannerH / 2);
        ctx.restore();
      }

      // 5C. Match Settlement Overlay inside Canvas (for screenshots & direct canvas view)
      if (state.mode === 'match_over' || state.score.matchWinner !== 'none') {
        ctx.save();
        const cardW = Math.min(560, w - 40);
        const cardH = 140;
        const cardX = cx - cardW / 2;
        const cardY = cy - cardH / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 20);
        ctx.fill();

        ctx.strokeStyle = state.score.matchWinner === 'player' ? '#10B981' : '#FF5722';
        ctx.lineWidth = 3.0;
        ctx.stroke();

        ctx.fillStyle = state.score.matchWinner === 'player' ? '#047857' : '#C2410C';
        ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        const winTitle = state.score.matchWinner === 'player' ? '🏆 恭喜獲勝！PLAYER WINS MATCH' : '比賽結束 · OPPONENT WINS';
        ctx.fillText(winTitle, cx, cardY + 34);

        ctx.fillStyle = '#1E293B';
        ctx.font = '900 36px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(`FINAL SCORE ${state.score.player} : ${state.score.opponent}`, cx, cardY + 76);

        ctx.fillStyle = '#64748B';
        ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`總回合 ${state.score.totalRallies || 0}   |   最高殺球 ${state.score.maxSmashSpeedKmh || 0} km/h   |   按 [R] 鍵重新開始`, cx, cardY + 114);
        ctx.restore();
      }
    }

    // 6. Milestone 4: Golden Impact Speed-Lines & Warm Perimeter Pulse
    const shake = state.effects?.cameraShake || 0;
    const fov = state.effects?.fov || 80;
    const impactIntensity = Math.min(1.0, Math.max(shake, (79.0 - fov) / 5.0));

    if (impactIntensity > 0.05) {
      ctx.save();
      // A. Warm perimeter pulse (soft golden-coral glow around edges, keeping court bright)
      const maxDim = Math.hypot(w, h) / 2;
      const grad = ctx.createRadialGradient(cx, cy, maxDim * 0.45, cx, cy, maxDim);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0)');
      grad.addColorStop(0.7, `rgba(255, 179, 0, ${impactIntensity * 0.12})`);
      grad.addColorStop(1.0, `rgba(255, 87, 34, ${impactIntensity * 0.22})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // B. Dynamic Radial Golden Speed-Lines radiating from screen edges toward center
      const lineCount = 24;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2 + ((i * 13) % 7) * 0.04;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const outerR = maxDim * (0.95 + ((i * 17) % 5) * 0.02);
        const lineLen = maxDim * (0.16 + ((i * 23) % 7) * 0.03) * impactIntensity;
        const innerR = outerR - lineLen;

        const x1 = cx + cosA * outerR;
        const y1 = cy + sinA * outerR;
        const x2 = cx + cosA * innerR;
        const y2 = cy + sinA * innerR;

        const alpha = impactIntensity * (0.35 + ((i * 31) % 5) * 0.1);
        ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 179, 0, ${alpha})` : `rgba(255, 87, 34, ${alpha * 0.85})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Milestone 5: Off-Screen Shuttlecock Indicator
    const offScreen = state.effects?.offScreenIndicator;
    if (offScreen && offScreen.active) {
      ctx.save();
      const angle = offScreen.angleRad || 0;
      const maxRx = w * 0.44;
      const maxRy = h * 0.42;

      // Position pill at screen perimeter along direction angle
      const indX = cx + Math.cos(angle) * maxRx;
      const indY = cy - Math.sin(angle) * maxRy;

      const pillW = 148;
      const pillH = 32;

      // Frosted rounded pill background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(indX - pillW / 2, indY - pillH / 2, pillW, pillH, 16);
      ctx.fill();

      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Rotating directional arrow pointer pointing toward shuttle
      ctx.save();
      ctx.translate(indX - pillW / 2 + 18, indY);
      ctx.rotate(-angle + Math.PI / 2);
      ctx.fillStyle = '#FF5722';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Shuttle height & distance text
      ctx.fillStyle = '#1E293B';
      ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`SHUTTLE ▲ ${Number(offScreen.heightM || 0).toFixed(1)}m`, indX - pillW / 2 + 30, indY + 1);

      ctx.restore();
    }

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    overlayTexture.needsUpdate = true;
  }

  function renderOverlay(renderer) {
    const now = performance.now();
    const isImpactActive = Boolean(state.effects && (state.effects.cameraShake > 0.02 || state.effects.fov < 79.5));
    const isOffScreenActive = Boolean(state.effects?.offScreenIndicator?.active);
    const isSmashWarningActive = Boolean(
      state.opponent?.chargingSmash ||
      (state.shuttle.inFlight && state.shuttle.originSide === 'opponent' && state.shuttle.shotType === 'SMASH')
    );
    const isMatchOverActive = Boolean(state.mode === 'match_over' || state.score.matchWinner !== 'none');
    const shouldRedraw =
      isDirty ||
      isImpactActive ||
      isOffScreenActive ||
      isSmashWarningActive ||
      isMatchOverActive ||
      forceImmediate ||
      now - lastHudDrawMs >= 32 ||
      state.mode !== lastHudMode;

    if (shouldRedraw) {
      syncDom();
      drawCanvasOverlay();
      isDirty = false;
      forceImmediate = false;
      lastHudDrawMs = now;
      lastHudMode = state.mode;
    }
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hudScene, hudCamera);
    renderer.autoClear = prevAutoClear;
  }

  return {
    markDirty,
    resize,
    renderOverlay,
  };
}

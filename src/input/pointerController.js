import { updateVirtualCursor } from '../core/badmintonGameState.js';
import { swipeTracker, checkStrikeWindow } from '../physics/racketPhysics.js';
import { triggerPlayerJump } from '../physics/playerFootwork.js';
import { setPlayMode } from '../ai/opponentController.js';

export const KEY_BINDINGS = {
  KeyF: 'toggle_fullscreen',
  Escape: 'pause_or_unlock',
  Space: 'jump_or_start',
  KeyM: 'toggle_play_mode',
  Digit1: 'launch_clear',
  Digit2: 'launch_smash',
  Digit3: 'launch_drop',
  Digit4: 'launch_drive',
  Digit5: 'launch_net_shot',
  Digit6: 'launch_attacking_clear',
  Digit7: 'launch_lift',
};

/**
 * Initializes Pointer Lock, fullscreen toggle, keyboard bindings, and mouse movement
 * mapping to the 4-Quadrant virtual cursor state machine and rolling swipe velocity tracker.
 */
export function setupPointerController({
  canvas,
  startBtn,
  state,
  hud,
  onRenderNeeded,
  onLaunchShot,
  onPlayerStrike,
}) {
  let isMouseDown = false;
  let lastRawX = null;
  let lastRawY = null;
  let lastSwipeTriggerMs = 0;

  function requestPointerLock() {
    if (!canvas || typeof canvas.requestPointerLock !== 'function') return;
    try {
      const lockPromise = canvas.requestPointerLock();
      if (lockPromise && typeof lockPromise.catch === 'function') {
        lockPromise.catch(() => {
          // Headless Chromium may reject pointer lock; fallback cursor tracking handles this cleanly
        });
      }
    } catch {
      // Ignore synchronous pointer lock errors in headless test environments
    }
  }

  function startMatch() {
    state.mode = 'playing';
    hud.markDirty();
    requestPointerLock();
    if (onRenderNeeded) onRenderNeeded();
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const p = document.documentElement.requestFullscreen?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        state.isFullscreen = true;
      } else {
        const p = document.exitFullscreen?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        state.isFullscreen = false;
      }
    } catch {
      state.isFullscreen = !state.isFullscreen;
    }
    hud.markDirty();
  }

  function pauseMatch() {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
    if (state.mode === 'playing') {
      state.mode = 'paused';
      if (startBtn) {
        startBtn.textContent = '繼續比賽 / 重新鎖定滑鼠';
      }
      hud.markDirty();
    }
  }

  function handleAction(action) {
    if (action === 'toggle_fullscreen') {
      toggleFullscreen();
    } else if (action === 'pause_or_unlock') {
      pauseMatch();
    } else if (action === 'jump_or_start') {
      if (state.mode !== 'playing') {
        startMatch();
      } else {
        triggerPlayerJump(state);
      }
    } else if (action === 'toggle_play_mode') {
      const nextMode = state.playMode === 'ai_match' ? 'feeder' : 'ai_match';
      setPlayMode(state, nextMode);
      hud.markDirty(true);
    } else if (action === 'launch_clear') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('CLEAR');
    } else if (action === 'launch_smash') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('SMASH');
    } else if (action === 'launch_drop') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('DROP');
    } else if (action === 'launch_drive') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('DRIVE');
    } else if (action === 'launch_net_shot') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('NET_SHOT');
    } else if (action === 'launch_attacking_clear') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('ATTACKING_CLEAR');
    } else if (action === 'launch_lift') {
      if (state.mode !== 'playing') startMatch();
      if (onLaunchShot) onLaunchShot('LIFT');
    }
  }

  startBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    startMatch();
  });

  canvas?.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    if (state.mode === 'playing') {
      if (document.pointerLockElement !== canvas) {
        requestPointerLock();
      }
      if (onPlayerStrike) {
        const swipe = swipeTracker.getSwipeData();
        // Fallback swipe parameters if stationary click
        if (swipe.speed < 200) {
          const isHigh = state.player.racketQuadrant === 'Q1' || state.player.racketQuadrant === 'Q2';
          swipe.speed = isHigh ? 1650 : 850;
          swipe.dy = isHigh ? -70 : 45;
          swipe.dx = 10;
        }
        onPlayerStrike(swipe);
      }
    }
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  document.addEventListener('pointerlockchange', () => {
    state.pointerLocked = document.pointerLockElement === canvas;
    lastRawX = null;
    lastRawY = null;
    hud.markDirty(true);
  });

  document.addEventListener('pointerlockerror', () => {
    state.pointerLocked = false;
  });

  window.addEventListener('keydown', (e) => {
    // Continuous WASD & Arrow Keys movement state
    if (state.player && state.player.moveKeys) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') state.player.moveKeys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') state.player.moveKeys.back = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.player.moveKeys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') state.player.moveKeys.right = true;
    }

    if (e.repeat) return;
    const action = KEY_BINDINGS[e.code];
    if (action) {
      handleAction(action);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (state.player && state.player.moveKeys) {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') state.player.moveKeys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') state.player.moveKeys.back = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.player.moveKeys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') state.player.moveKeys.right = false;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (state.mode !== 'playing') return;

    let movementX = e.movementX || 0;
    let movementY = e.movementY || 0;

    let nextX = state.player.virtualCursor[0];
    let nextY = state.player.virtualCursor[1];

    if (document.pointerLockElement === canvas) {
      nextX += movementX;
      nextY -= movementY; // Screen +Y is down; quadrant +Y is up
    } else {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const curX = e.clientX - centerX;
      const curY = centerY - e.clientY;
      movementX = lastRawX !== null ? curX - lastRawX : (e.movementX || 0);
      movementY = lastRawY !== null ? -(curY - lastRawY) : (e.movementY || 0);
      lastRawX = curX;
      lastRawY = curY;
      nextX = curX;
      nextY = curY;
    }

    const now = performance.now();
    // Record swipe sample in screen coordinates (+Y down, standard mouse) with current quadrant
    swipeTracker.addSample(movementX, -movementY, now, state.player.racketQuadrant);
    const currentSwipe = swipeTracker.getSwipeData(now);
    state.player.swipeSpeed = Math.round(currentSwipe.speed);

    // 35ms Peak-Velocity Swing Commit Window for Live Mouse Swipes:
    // Avoid firing on the initial 240 px/s acceleration ramp so fast smashes aren't misclassified
    if (checkStrikeWindow(state).canStrike && onPlayerStrike) {
      if (currentSwipe.speed >= 260) {
        if (!state.player.pendingSwipe) {
          state.player.pendingSwipe = {
            startTime: now,
            startQuadrant: currentSwipe.startQuadrant || state.player.racketQuadrant,
            speed: currentSwipe.speed,
            peakSpeed: currentSwipe.speed,
            dx: currentSwipe.dx,
            dy: currentSwipe.dy,
          };
        } else {
          state.player.pendingSwipe.speed = Math.max(state.player.pendingSwipe.speed, currentSwipe.speed);
          state.player.pendingSwipe.peakSpeed = Math.max(state.player.pendingSwipe.peakSpeed, currentSwipe.speed);
          state.player.pendingSwipe.dx = currentSwipe.dx;
          state.player.pendingSwipe.dy = currentSwipe.dy;
        }

        const elapsedMs = now - state.player.pendingSwipe.startTime;
        const reachedTerminalSpeed = state.player.pendingSwipe.peakSpeed >= 1050;
        const windowExpired = elapsedMs >= 35;
        const shuttleLeaving = (state.shuttle.pos[1] < 0.65 || state.shuttle.pos[2] > state.player.pos[2] + 0.45);

        if (reachedTerminalSpeed || windowExpired || shuttleLeaving) {
          const swipeToExecute = { ...state.player.pendingSwipe };
          state.player.pendingSwipe = null;
          onPlayerStrike(swipeToExecute);
        }
      }
    } else {
      state.player.pendingSwipe = null;
    }

    updateVirtualCursor(state, nextX, nextY);
    hud.markDirty();
  });

  document.addEventListener('fullscreenchange', () => {
    state.isFullscreen = Boolean(document.fullscreenElement);
  });

  return {
    requestPointerLock,
    startMatch,
    pauseMatch,
    toggleFullscreen,
    handleAction,
  };
}

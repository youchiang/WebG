import * as THREE from 'three';
import { Timer } from 'three/addons/misc/Timer.js';
import {
  createGameState,
  serializeGameState,
} from './core/badmintonGameState.js';
import { buildBadmintonArena } from './rendering/entities/badmintonArena.js';
import { createShuttlecockSystem } from './rendering/entities/shuttlecockEntity.js';
import { createRacketViewmodel } from './rendering/entities/racketViewmodel.js';
import {
  stepShuttlePhysics,
  launchShuttleShot,
} from './physics/shuttlePhysics.js';
import {
  executePlayerStrike,
  checkStrikeWindow,
  swipeTracker,
} from './physics/racketPhysics.js';
import {
  updatePlayerFootwork,
  triggerPlayerJump,
  setPlayerMoveKeys,
} from './physics/playerFootwork.js';
import { createImpactEffects } from './rendering/entities/impactEffects.js';
import { createOpponentEntity } from './rendering/entities/opponentEntity.js';
import {
  createOpponentController,
  setPlayMode,
} from './ai/opponentController.js';
import { updateGameFeel } from './core/gameFeel.js';
import { soundEngine } from './audio/soundEngine.js';
import { createHudSystem } from './ui/badmintonHudOverlay.js';
import { setupPointerController } from './input/pointerController.js';
import { createP2PNetworkManager } from './network/p2pNetwork.js';
import { setMatchScore, resetMatch } from './core/matchRules.js';

const canvas = document.getElementById('game-canvas');
const startBtn = document.getElementById('start-btn');

// 1. Initialize Core Domain Game State & Event-Driven HUD
const state = createGameState();
const hud = createHudSystem(state);

// Milestone 6: P2P Network Manager
const p2pNetwork = createP2PNetworkManager(state, {
  onRemoteStrike: () => {
    shuttleSystem.resetTrail(state.shuttle.pos);
    hud.markDirty();
  },
  onStatusChange: () => {
    hud.markDirty(true);
  },
});
state._p2pNetwork = p2pNetwork;
state._broadcastLocalStrike = p2pNetwork.broadcastLocalStrike;

// 2. Initialize Three.js Renderer, Scene & First-Person Camera
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#C2D1DF');
scene.fog = new THREE.Fog('#C2D1DF', 22, 52);

// Build the bright tournament badminton arena, maple floor, mint court, raised white lines, and 3D net
buildBadmintonArena(scene);

// Build the 3D Shuttlecock visual system (cork, feathers, outline shell, air trail, landing predictor rings)
const shuttleSystem = createShuttlecockSystem(scene);

// Build the First-Person Racket + Arm Viewmodel system (isometric head, strings, shaft, grip, forearm, swing arc)
const racketViewmodel = createRacketViewmodel(scene);
state._racketViewmodel = racketViewmodel;

// Build 3D Impact Effects system (dual shockwave rings and 16 radial sparks)
const impactEffects = createImpactEffects(scene);
state._impactEffects = impactEffects;

// Build 3D Opponent Player Avatar and AI Controller
const opponentEntity = createOpponentEntity(scene);
const opponentController = createOpponentController();

const _tmpShuttleNDC = new THREE.Vector3();

// Unlock Web Audio context upon first user gesture
function unlockAudio() {
  soundEngine.ensureContextRunning();
}
startBtn?.addEventListener('click', unlockAudio, { once: true });
canvas?.addEventListener('pointerdown', unlockAudio, { once: true });

// First-Person Camera: [0, 1.78, 5.0] (standard singles ready stance), FOV 80 deg, looking across net toward [0, 0.95, -1.5]
const camera = new THREE.PerspectiveCamera(
  state.effects.fov,
  window.innerWidth / window.innerHeight,
  0.08,
  80
);
const currentCamPos = new THREE.Vector3(0, 1.78, 5.0);
const currentLookAt = new THREE.Vector3(0, 0.95, -1.5);
camera.position.copy(currentCamPos);
camera.lookAt(currentLookAt);
state._camera = camera;

function renderScene() {
  renderer.clear();
  renderer.render(scene, camera);
  hud.renderOverlay(renderer);

  // Milestone 6: Performance telemetry from renderer.info
  state.performance = {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}

// 3. Continuous Opponent Auto-Feed Mechanism & Preset Shot Launcher
const SHOT_CYCLE = ['CLEAR', 'SMASH', 'ATTACKING_CLEAR', 'DROP', 'DRIVE', 'NET_SHOT', 'LIFT'];
let shotCycleIndex = 0;
let autoFeedTimer = 0.6; // Launch initial shot 0.6s after entering match

function triggerShot(shotType = 'CLEAR', customOpts = {}) {
  const origin = customOpts.originSide || 'opponent';
  launchShuttleShot(state, shotType, origin, customOpts);
  shuttleSystem.resetTrail(state.shuttle.pos);
  hud.markDirty();
  renderScene();
  return state.shuttle;
}

// 4. Input & Control Layer (Pointer Lock, Fullscreen, Keyboard & Mouse)
const inputController = setupPointerController({
  canvas,
  startBtn,
  state,
  hud,
  onRenderNeeded: renderScene,
  onLaunchShot: (shotType) => {
    triggerShot(shotType);
  },
  onPlayerStrike: (swipeData) => {
    const strikeResult = executePlayerStrike(state, swipeData, racketViewmodel, impactEffects);
    if (strikeResult.hit) {
      shuttleSystem.resetTrail(state.shuttle.pos);
      autoFeedTimer = 1.6; // Give ample time for player shot to land
      state.player.activeSwipe = null;
    }
    hud.markDirty();
    return strikeResult;
  },
});

// Responsive resize handling
function handleResize() {
  const width = window.innerWidth || 1280;
  const height = window.innerHeight || 720;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  hud.resize(width, height);
  renderScene();
}

window.addEventListener('resize', handleResize);
document.addEventListener('fullscreenchange', () => {
  state.isFullscreen = Boolean(document.fullscreenElement);
  handleResize();
});

// Compute Off-Screen Shuttlecock Indicator (Normalized Device Coordinates)
function updateOffScreenIndicator() {
  if (state.shuttle.inFlight) {
    _tmpShuttleNDC.set(state.shuttle.pos[0], state.shuttle.pos[1], state.shuttle.pos[2]).project(camera);
    const isOffScreen =
      Math.abs(_tmpShuttleNDC.x) > 0.90 ||
      Math.abs(_tmpShuttleNDC.y) > 0.88 ||
      _tmpShuttleNDC.z > 1.0;

    if (isOffScreen) {
      let angleRad = Math.atan2(_tmpShuttleNDC.y, _tmpShuttleNDC.x);
      if (_tmpShuttleNDC.z > 1.0) angleRad += Math.PI;

      const distM = Math.hypot(
        state.shuttle.pos[0] - camera.position.x,
        state.shuttle.pos[1] - camera.position.y,
        state.shuttle.pos[2] - camera.position.z
      );

      state.effects.offScreenIndicator = {
        active: true,
        ndcX: Math.round(_tmpShuttleNDC.x * 100) / 100,
        ndcY: Math.round(_tmpShuttleNDC.y * 100) / 100,
        angleRad: Math.round(angleRad * 100) / 100,
        heightM: Math.round(state.shuttle.pos[1] * 100) / 100,
        distanceM: Math.round(distM * 100) / 100,
      };
    } else {
      state.effects.offScreenIndicator = {
        active: false,
        ndcX: Math.round(_tmpShuttleNDC.x * 100) / 100,
        ndcY: Math.round(_tmpShuttleNDC.y * 100) / 100,
        angleRad: 0,
        heightM: Math.round(state.shuttle.pos[1] * 100) / 100,
        distanceM: 0,
      };
    }
  } else {
    state.effects.offScreenIndicator = {
      active: false,
      ndcX: 0,
      ndcY: 0,
      angleRad: 0,
      heightM: 0,
      distanceM: 0,
    };
  }
}

// 5. Deterministic Fixed-Step Update, Aerodynamics, & Camera Smoothing
function update(dt) {
  state.elapsedTime += dt;

  // 1. Check Hit-Stop status BEFORE updating/decrementing Hit-Stop remaining duration!
  const isHitStopped = Boolean(state.effects && state.effects.hitStopRemainingMs > 0);

  // 2. Update Game Feel Pipeline (Hit-stop countdown, trauma decay, camera shake, FOV recovery)
  updateGameFeel(state, dt);

  // 3. Player Footwork, Manual WASD & Space Jump Kinematics
  updatePlayerFootwork(state, dt);

  // Cleanly decay swipe speed as 120ms window expires when mouse stops moving
  const currentLiveSwipe = swipeTracker.getSwipeData(performance.now());
  state.player.swipeSpeed = Math.round(currentLiveSwipe.speed);

  // 4. Step 60Hz physics (aerodynamics, quadratic drag, turnover, CCD)
  // Paused during Hit-Stop micro-freeze (40ms on SMASH, 16ms on sweet-spot DRIVE)
  if (!isHitStopped) {
    stepShuttlePhysics(state, dt);
  }

  // 5. AI Opponent FSM & Multi-Shot Feeder Update (paused during hit-stop)
  if (!isHitStopped) {
    opponentController.update(state, dt, (shotType) => {
      shuttleSystem.resetTrail(state.shuttle.pos);
      hud.markDirty();
    });
  }

  // Update 3D opponent avatar & racket swing animation
  opponentEntity.update(state, dt);

  // Milestone 6: P2P Multiplayer Network Manager Update
  p2pNetwork.update(dt);

  // 6. Camera Position, Breathing, Bobbing, LookAt, FOV, Shake & Viewmodel Update
  // Must execute BEFORE swing detection so getStringBedWorldPosition uses frame N's exact transform!
  const breathY = Math.sin(state.elapsedTime * 2.1) * 0.008;
  const breathX = Math.cos(state.elapsedTime * 1.05) * 0.004;

  const horizSpeed = Math.hypot(state.player.vel[0], state.player.vel[2]);
  const stepBobY = (horizSpeed > 0.3 && !state.player.isJumping)
    ? Math.sin(state.elapsedTime * 11.5) * 0.016 * Math.min(1.0, horizSpeed / 4.5)
    : 0;

  const [vx, vy] = state.player.virtualCursor;
  const gazeOffsetX = (vx / 360) * 0.18;
  const gazeOffsetY = (vy / 220) * 0.14;

  let pitchGazeAssist = 0;
  if (state.shuttle.inFlight && state.shuttle.pos[1] > 1.8) {
    pitchGazeAssist = Math.min(1.15, (state.shuttle.pos[1] - 1.8) * 0.36);
  }

  const targetCamX = state.player.pos[0] + breathX;
  const targetCamY = state.player.pos[1] + state.player.eyeHeight + breathY + stepBobY;
  const targetCamZ = state.player.pos[2];

  const targetLookX = 0 + gazeOffsetX;
  const targetLookY = 0.95 + gazeOffsetY + pitchGazeAssist;
  const targetLookZ = -1.5;

  const smoothFactorXZ = 1.0 - Math.exp(-10.0 * dt);
  const smoothFactorY = 1.0 - Math.exp(-28.0 * dt);

  currentCamPos.x = THREE.MathUtils.lerp(currentCamPos.x, targetCamX, smoothFactorXZ);
  currentCamPos.y = THREE.MathUtils.lerp(currentCamPos.y, targetCamY, smoothFactorY);
  currentCamPos.z = THREE.MathUtils.lerp(currentCamPos.z, targetCamZ, smoothFactorXZ);

  // Aerial Vantage Look-Down Offset during jump:
  let aerialLookDown = 0;
  if (state.player.pos[1] > 0.05) {
    const isShuttleReturning = (state.shuttle.inFlight && state.shuttle.vel[2] < 0);
    const isPostSmash = state.player.lastJumpSmash || (state.player.activeSwipe && state.player.activeSwipe.shotType === 'SMASH');
    if (isShuttleReturning || isPostSmash) {
      aerialLookDown = -state.player.pos[1] * 0.35;
    }
  }

  const finalLookY = targetLookY + aerialLookDown;
  currentLookAt.x = THREE.MathUtils.lerp(currentLookAt.x, targetLookX, smoothFactorXZ);
  currentLookAt.y = THREE.MathUtils.lerp(currentLookAt.y, finalLookY, smoothFactorY);
  currentLookAt.z = THREE.MathUtils.lerp(currentLookAt.z, targetLookZ, smoothFactorXZ);

  if (Math.abs(camera.fov - state.effects.fov) > 0.01) {
    camera.fov = state.effects.fov;
    camera.updateProjectionMatrix();
  }

  const [shakeX, shakeY, shakeZ] = state.effects.shakeOffset || [0, 0, 0];
  camera.position.set(
    currentCamPos.x + shakeX,
    currentCamPos.y + shakeY,
    currentCamPos.z + shakeZ
  );
  camera.lookAt(currentLookAt);

  if (state.effects.shakeRoll) {
    camera.rotation.z += state.effects.shakeRoll;
  }

  state.effects.cameraPos = [camera.position.x, camera.position.y, camera.position.z];
  state.effects.cameraLookAt = [currentLookAt.x, currentLookAt.y, currentLookAt.z];

  // Update Racket + Arm Viewmodel (transforms match new camera pose)
  racketViewmodel.update(camera, state, dt);

  // 7. Continuous Swing-to-Shuttle Contact Detection:
  // Now getStringBedWorldPosition(camera) uses the exact current-frame camera & racket pose!
  if (state.mode === 'playing' && checkStrikeWindow(state).canStrike) {
    const now = performance.now();
    const liveSwipe = swipeTracker.getSwipeData(now);

    // If a pending swipe is accumulating, check if it should commit now
    if (state.player.pendingSwipe) {
      const elapsedMs = now - state.player.pendingSwipe.startTime;
      const reachedTerminalSpeed = state.player.pendingSwipe.peakSpeed >= 1050;
      const windowExpired = elapsedMs >= 35;
      const shuttleLeaving = (state.shuttle.pos[1] < 0.65 || state.shuttle.pos[2] > state.player.pos[2] + 0.45);

      if (reachedTerminalSpeed || windowExpired || shuttleLeaving) {
        const swipeToExecute = { ...state.player.pendingSwipe };
        state.player.pendingSwipe = null;
        const strikeResult = executePlayerStrike(state, swipeToExecute, racketViewmodel, impactEffects);
        if (strikeResult.hit) {
          shuttleSystem.resetTrail(state.shuttle.pos);
          state.player.activeSwipe = null;
          hud.markDirty();
        }
      }
    } else if (liveSwipe.speed >= 280 || (state.player.swingTimer > 0 && state.player.activeSwipe)) {
      const active = state.player.activeSwipe;
      const chosenSwipe = (active && active.speed > liveSwipe.speed) ? active : liveSwipe;
      const strikeResult = executePlayerStrike(state, chosenSwipe, racketViewmodel, impactEffects);
      if (strikeResult.hit) {
        shuttleSystem.resetTrail(state.shuttle.pos);
        state.player.activeSwipe = null;
        hud.markDirty();
      }
    }
  } else {
    state.player.pendingSwipe = null;
  }

  // 8. Update 3D shuttlecock model, ribbon trail, and landing rings
  // This immediately moves 3D shuttlecock to [bedX, bedY, bedZ] on the very same frame as the hit!
  shuttleSystem.update(state, state.elapsedTime);

  // Update 3D impact shockwave rings & radial sparks
  impactEffects.update(state, dt);

  // 9. Compute Off-Screen Shuttlecock Indicator (Normalized Device Coordinates)
  updateOffScreenIndicator();
}

// 6. Animation Loop using Timer (`threejs-fundamentals` / `threejs-scene-setup`)
let manualStepLockUntil = 0;
const timer = new Timer();
if (typeof timer.connect === 'function') {
  timer.connect(document);
}

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  // Prevent background requestAnimationFrame from racing with deterministic test stepping
  if (performance.now() < manualStepLockUntil) {
    return;
  }
  const dt = Math.min(timer.getDelta(), 0.1);
  update(dt);
  renderScene();
});

// 7. Testing & Integration Hooks (openai-develop-web-game & QA automation)
window.state = state;
window.render_game_to_text = () => serializeGameState(state);

window.advanceTime = (ms) => {
  manualStepLockUntil = performance.now() + 2500;
  const fixedStep = 1 / 60;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) {
    update(fixedStep);
  }
  hud.markDirty();
  renderScene();
  return Promise.resolve();
};

window.launchTestShot = (shotType = 'CLEAR', customOpts = {}) => {
  manualStepLockUntil = performance.now() + 2500;
  if (state.mode !== 'playing') {
    state.mode = 'playing';
  }
  return triggerShot(shotType, customOpts);
};

window.setPlayMode = (mode) => {
  manualStepLockUntil = performance.now() + 2500;
  const res = setPlayMode(state, mode);
  hud.markDirty(true);
  renderScene();
  return res;
};

window.triggerPlayerJump = () => {
  manualStepLockUntil = performance.now() + 2500;
  const res = triggerPlayerJump(state);
  hud.markDirty();
  renderScene();
  return res;
};

window.setPlayerMoveKeys = (keys = {}) => {
  manualStepLockUntil = performance.now() + 2500;
  setPlayerMoveKeys(state, keys);
  hud.markDirty();
  renderScene();
};

// Milestone 6: P2P Multiplayer & BWF 21-Point Match Hooks
window.createP2PRoom = (code) => p2pNetwork.createRoom(code);
window.joinP2PRoom = (code) => p2pNetwork.joinRoom(code);
window.injectRemotePacket = (packet) => {
  p2pNetwork.handleIncomingMessage(packet, 'simulated');
  hud.markDirty(true);
  renderScene();
};
window.setMatchScore = (playerScore, opponentScore, server = null) => {
  manualStepLockUntil = performance.now() + 2500;
  const res = setMatchScore(state, playerScore, opponentScore, server);
  p2pNetwork.broadcastScoreSync();
  hud.markDirty(true);
  renderScene();
  return res;
};
window.resetMatch = () => {
  manualStepLockUntil = performance.now() + 2500;
  const res = resetMatch(state);
  p2pNetwork.broadcastMatchReset();
  hud.markDirty(true);
  renderScene();
  return res;
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && (state.mode === 'match_over' || e.shiftKey)) {
    window.resetMatch();
  }
});

/**
 * Milestone 3 Testing Hook: Programmatically simulate mouse swipe strike
 * @param {Object} opts
 * @param {string} [opts.quadrant] - 'Q1' | 'Q2' | 'Q3' | 'Q4'
 * @param {number[]} [opts.cursor] - [vx, vy]
 * @param {number} [opts.dx] - mouse delta X (px)
 * @param {number} [opts.dy] - mouse delta Y (px)
 * @param {number} [opts.speed] - swipe speed (px/s)
 * @param {string} [opts.shotType] - override shot type
 * @param {boolean} [opts.forceHit] - position incoming shuttle inside strike sweet spot window
 */
window.performRacketSwipe = (opts = {}) => {
  manualStepLockUntil = performance.now() + 2500;
  if (state.mode !== 'playing') {
    state.mode = 'playing';
  }

  // 1. Configure Quadrant & Virtual Cursor
  if (opts.quadrant) {
    state.player.racketQuadrant = opts.quadrant;
    state.player.grip = (opts.quadrant === 'Q1' || opts.quadrant === 'Q4') ? 'forehand' : 'backhand';
    if (opts.quadrant === 'Q1') state.player.virtualCursor = [120, 80];
    else if (opts.quadrant === 'Q2') state.player.virtualCursor = [-120, 80];
    else if (opts.quadrant === 'Q3') state.player.virtualCursor = [-120, -80];
    else if (opts.quadrant === 'Q4') state.player.virtualCursor = [120, -80];
  } else if (Array.isArray(opts.cursor)) {
    state.player.virtualCursor = [...opts.cursor];
    const [cx, cy] = opts.cursor;
    const q = (cx >= 0 ? (cy >= 0 ? 'Q1' : 'Q4') : (cy >= 0 ? 'Q2' : 'Q3'));
    state.player.racketQuadrant = q;
    state.player.grip = (q === 'Q1' || q === 'Q4') ? 'forehand' : 'backhand';
  }

  // 2. If forceHit or shuttle not in strike zone, setup an incoming shuttle in hitting range
  if (opts.forceHit || !state.shuttle.inFlight || state.shuttle.pos[2] < 2.0) {
    state.shuttle.inFlight = true;
    // Set position right inside strike sweet spot range relative to player.pos!
    const px = (state.player && state.player.pos && state.player.pos[0]) || 0;
    const py = (state.player && state.player.pos && state.player.pos[1]) || 0;
    const pz = (state.player && state.player.pos && state.player.pos[2]) || 3.8;
    state.shuttle.pos = [px + 0.25, 2.25 + py * 0.75, Math.max(1.0, pz - 0.35)];
    state.shuttle.vel = [0, -1.0, 4.5];
    state.shuttle.speed = 4.6;
    state.shuttle.flightPhase = 'in_play';
    state.shuttle.outlineState = 'sweet_spot_green';
    state.shuttle.shotType = 'CLEAR';
  }

  // 3. Construct swipe data
  const dx = typeof opts.dx === 'number' ? opts.dx : 0;
  const dy = typeof opts.dy === 'number' ? opts.dy : -120;
  const speed = typeof opts.speed === 'number' ? opts.speed : 850;
  const swipeData = {
    dx,
    dy,
    speed,
    forcedShotType: opts.shotType || null,
    forceHit: Boolean(opts.forceHit),
    startQuadrant: opts.quadrant || state.player.racketQuadrant,
  };

  // Synchronize Camera position and Racket Viewmodel BEFORE strike execution
  const targetCamX = state.player.pos[0];
  const targetCamY = state.player.pos[1] + state.player.eyeHeight;
  const targetCamZ = state.player.pos[2];
  currentCamPos.set(targetCamX, targetCamY, targetCamZ);
  camera.position.copy(currentCamPos);
  camera.lookAt(currentLookAt);
  racketViewmodel.update(camera, state, 0);

  const strikeResult = executePlayerStrike(state, swipeData, racketViewmodel, impactEffects);
  if (strikeResult.hit) {
    shuttleSystem.resetTrail(state.shuttle.pos);
    autoFeedTimer = 1.6;
  }

  // Immediately synchronize Camera FOV punch, Racket Viewmodel, and 3D Shuttle Mesh so Frame 0 renders them
  camera.fov = state.effects.fov;
  camera.updateProjectionMatrix();
  racketViewmodel.update(camera, state, 0);
  shuttleSystem.update(state, state.elapsedTime);
  impactEffects.update(state, 0.016);
  updateOffScreenIndicator();

  hud.markDirty();
  renderScene();

  return {
    success: strikeResult.hit,
    shotType: state.player.lastShotType,
    speedKmh: state.player.lastShotSpeedKmh,
    timingQuality: state.player.lastTimingQuality,
    strikeResult,
    state: serializeGameState(state),
  };
};

// Initial render
renderScene();

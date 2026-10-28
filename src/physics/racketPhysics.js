import * as THREE from 'three';
import {
  SHUTTLE_PHYSICS,
  SHOT_PRESETS,
  COURT_SPEC,
} from '../core/badmintonConstants.js';
import {
  predictLandingTarget,
} from './shuttlePhysics.js';
import { triggerImpactGameFeel } from '../core/gameFeel.js';
import { soundEngine } from '../audio/soundEngine.js';

// Rolling buffer for continuous mouse swipe tracking (120ms sliding window)
class MouseSwipeTracker {
  constructor(windowMs = 120) {
    this.windowMs = windowMs;
    this.samples = [];
  }

  addSample(dx, dy, timestampMs, currentQuadrant = null) {
    this.samples.push({ dx, dy, t: timestampMs, quadrant: currentQuadrant });
    // Remove samples older than windowMs
    const cutoff = timestampMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  getSwipeData(nowMs = performance.now()) {
    const cutoff = nowMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    if (this.samples.length < 2) {
      return { speed: 0, dx: 0, dy: 0, dt: 0.016, startQuadrant: null, peakSpeed: 0 };
    }

    let totalDx = 0;
    let totalDy = 0;
    let peakSpeed = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      totalDx += s.dx;
      totalDy += s.dy;
      if (i > 0) {
        const segDt = Math.max(0.005, (s.t - this.samples[i - 1].t) / 1000);
        const segSpeed = Math.hypot(s.dx, s.dy) / segDt;
        if (segSpeed > peakSpeed) peakSpeed = segSpeed;
      }
    }

    const dt = Math.max(0.016, (this.samples[this.samples.length - 1].t - this.samples[0].t) / 1000);
    const dist = Math.hypot(totalDx, totalDy);
    const speed = dist / dt; // pixels per second
    if (speed > peakSpeed) peakSpeed = speed;

    const startQuadrant = this.samples[0].quadrant || null;

    return { speed, dx: totalDx, dy: totalDy, dt, startQuadrant, peakSpeed };
  }

  clear() {
    this.samples.length = 0;
  }
}

export const swipeTracker = new MouseSwipeTracker(120);

/**
 * Maps player quadrant, grip, swipe speed and swipe vector into the 7 classic badminton shots.
 * Calibrated specifically for C_drag = 0.215 m^-1 to cross the net and land in opponent court!
 */
export function computeRacketStrike(state, swipeData) {
  const { speed: swipeSpeed, dx, dy } = swipeData;

  // Track the quadrant where the swipe started to prevent quadrant flipping mid-stroke
  const effectiveQuad = swipeData.startQuadrant || state.player.racketQuadrant;
  const isHighQuad = effectiveQuad === 'Q1' || effectiveQuad === 'Q2';
  const isLowQuad = effectiveQuad === 'Q3' || effectiveQuad === 'Q4';

  const isForehand = (effectiveQuad === 'Q1' || effectiveQuad === 'Q4');
  const gripPower = isForehand ? 1.0 : 0.85; // Backhand power multiplier

  const playerPos = (state.player && state.player.pos) ? state.player.pos : [0, 0, 3.8];
  const shuttlePos = (state.shuttle && state.shuttle.pos) ? state.shuttle.pos : [0, 2.0, 3.0];
  const isOverheadShuttle = (shuttlePos[1] >= 1.65) || Boolean(state.player && state.player.isJumping);
  const isNearNet = (playerPos[2] <= 2.45);

  let shotType = 'CLEAR';
  let exitSpeed = 35.5 * gripPower;
  let elevationDeg = 31.0;
  let outlineState = 'normal_navy';

  // Support explicit preset override if provided in testing / input mapping
  if (swipeData.forcedShotType) {
    shotType = swipeData.forcedShotType;
    if (shotType === 'SMASH') {
      exitSpeed = 64.0 * gripPower;
      elevationDeg = -22.5;
      outlineState = 'smash_flame';
    } else if (shotType === 'CLEAR') {
      exitSpeed = 35.5 * gripPower;
      elevationDeg = 32.0;
      outlineState = 'normal_navy';
    } else if (shotType === 'ATTACKING_CLEAR') {
      exitSpeed = 32.5 * gripPower;
      elevationDeg = 23.0;
      outlineState = 'normal_navy';
    } else if (shotType === 'DROP') {
      exitSpeed = 14.5;
      elevationDeg = 8.0;
      outlineState = 'drop_cyan';
    } else if (shotType === 'DRIVE') {
      exitSpeed = 23.5 * gripPower;
      elevationDeg = 4.8;
      outlineState = 'normal_navy';
    } else if (shotType === 'NET_SHOT') {
      exitSpeed = 5.8;
      elevationDeg = 31.0;
      outlineState = 'drop_cyan';
    } else if (shotType === 'LIFT') {
      exitSpeed = 33.5 * gripPower;
      elevationDeg = 38.0;
      outlineState = 'normal_navy';
    }
  }
  // 1. Downward Swipe: dy < -22 && Math.abs(dy) >= Math.abs(dx) * 0.7
  else if (dy < -22 && Math.abs(dy) >= Math.abs(dx) * 0.7) {
    if (swipeSpeed >= 800 && (isHighQuad || isOverheadShuttle)) {
      // SMASH (重扣殺球 - 調校為人類舒適反應初速 44 ~ 52 m/s)
      shotType = 'SMASH';
      const speedFactor = Math.min(1.0, Math.max(0, (swipeSpeed - 800) / 1200));
      exitSpeed = (44.0 + speedFactor * 8.0) * gripPower;
      elevationDeg = -22.5 - speedFactor * 2.0;
      outlineState = 'smash_flame';
    } else if (isNearNet && !isHighQuad && swipeSpeed < 550) {
      // NET_SHOT (網前放網)
      shotType = 'NET_SHOT';
      exitSpeed = 5.5 + Math.max(0, playerPos[2] - 1.0) * 3.0;
      elevationDeg = 30.0 + (swipeSpeed / 550) * 3.0;
      outlineState = 'drop_cyan';
    } else {
      // DROP (切球 / 吊球)
      shotType = 'DROP';
      const speedFactor = Math.min(1.0, Math.max(0, (swipeSpeed - 400) / 700));
      exitSpeed = 13.5 + Math.max(0, playerPos[2] - 2.5) * 2.2 + speedFactor * 2.0;
      elevationDeg = 7.0 + speedFactor * 2.0;
      outlineState = 'drop_cyan';
    }
  }
  // 2. Horizontal Swipe: Math.abs(dx) > Math.abs(dy) * 1.15 && swipeSpeed >= 500
  else if (Math.abs(dx) > Math.abs(dy) * 1.15 && swipeSpeed >= 500) {
    if (isNearNet && swipeSpeed < 620) {
      // NET_SHOT (網前勾對角放網)
      shotType = 'NET_SHOT';
      exitSpeed = 5.8 + Math.max(0, playerPos[2] - 1.0) * 3.0;
      elevationDeg = 29.0;
      outlineState = 'drop_cyan';
    } else if (isHighQuad && dy < -12 && swipeSpeed < 850) {
      // DROP (劈吊切球)
      shotType = 'DROP';
      exitSpeed = 14.0 + Math.max(0, playerPos[2] - 2.5) * 2.0;
      elevationDeg = 7.5;
      outlineState = 'drop_cyan';
    } else {
      // DRIVE (平抽球)
      shotType = 'DRIVE';
      const speedFactor = Math.min(1.0, (swipeSpeed - 500) / 1100);
      exitSpeed = (21.5 + speedFactor * 5.0) * gripPower;
      elevationDeg = 4.2 + speedFactor * 1.5;
      outlineState = 'normal_navy';
    }
  }
  // 3. Upward Swipe: dy > 20 && Math.abs(dy) >= Math.abs(dx) * 0.7
  else if (dy > 20 && Math.abs(dy) >= Math.abs(dx) * 0.7) {
    if (isNearNet && swipeSpeed < 480) {
      // NET_SHOT (網前輕挑放小球)
      shotType = 'NET_SHOT';
      exitSpeed = 5.5 + Math.max(0, playerPos[2] - 1.0) * 2.8;
      elevationDeg = 32.0;
      outlineState = 'drop_cyan';
    } else if (isLowQuad || shuttlePos[1] < 1.70) {
      // LIFT (防守挑球)
      shotType = 'LIFT';
      const speedFactor = Math.min(1.0, Math.max(0, (swipeSpeed - 600) / 1000));
      exitSpeed = (32.0 + speedFactor * 4.2 + Math.max(0, playerPos[2] - 2.5) * 1.8) * gripPower;
      elevationDeg = 36.5 + speedFactor * 4.5;
      outlineState = 'normal_navy';
    } else if (swipeSpeed >= 950) {
      // CLEAR (高遠球)
      shotType = 'CLEAR';
      const speedFactor = Math.min(1.0, (swipeSpeed - 950) / 1200);
      exitSpeed = (34.0 + speedFactor * 4.0 + Math.max(0, playerPos[2] - 3.5) * 1.5) * gripPower;
      elevationDeg = 31.0 + speedFactor * 3.0;
      outlineState = 'normal_navy';
    } else {
      // ATTACKING_CLEAR (平高球)
      shotType = 'ATTACKING_CLEAR';
      const speedFactor = Math.min(1.0, Math.max(0, (swipeSpeed - 600) / 400));
      exitSpeed = (31.0 + speedFactor * 3.0 + Math.max(0, playerPos[2] - 3.5) * 1.2) * gripPower;
      elevationDeg = 22.0 + speedFactor * 2.5;
      outlineState = 'normal_navy';
    }
  }
  // 4. Gentle Touch Fallback: swipeSpeed < 500 or ambiguous angle
  else if (swipeSpeed < 500) {
    if (isNearNet) {
      shotType = 'NET_SHOT';
      exitSpeed = 5.5 + Math.max(0, playerPos[2] - 1.0) * 3.0;
      elevationDeg = 30.0;
      outlineState = 'drop_cyan';
    } else if (dy < 0) {
      shotType = 'DROP';
      exitSpeed = 13.5 + Math.max(0, playerPos[2] - 2.5) * 2.2;
      elevationDeg = 8.0;
      outlineState = 'drop_cyan';
    } else {
      shotType = 'ATTACKING_CLEAR';
      exitSpeed = 31.5 * gripPower;
      elevationDeg = 23.0;
      outlineState = 'normal_navy';
    }
  }
  // General Fallback
  else {
    shotType = 'CLEAR';
    exitSpeed = 34.5 * gripPower;
    elevationDeg = 31.5;
    outlineState = 'normal_navy';
  }

  // Lateral angle azimuth from dx: allows cross-court and down-the-line placement
  const azimuthDeg = Math.max(-14.0, Math.min(14.0, dx * 0.04));

  return {
    shotType,
    speed: Math.round(exitSpeed * 10) / 10,
    elevationDeg: Math.round(elevationDeg * 10) / 10,
    azimuthDeg: Math.round(azimuthDeg * 10) / 10,
    outlineState,
  };
}

/**
 * Checks whether an incoming shuttlecock is within the player's strike window.
 * Reachable window checks distance relative to player's current footwork pos,
 * and vertical ceiling extends up to 4.35m during Space-key aerial jumps!
 */
export function checkStrikeWindow(state) {
  const shuttle = state.shuttle;
  const player = state.player || { pos: [0, 0, 5.0] };

  if (
    !shuttle.inFlight ||
    shuttle.vel[2] <= 0 ||
    shuttle.pos[2] < 0.35 ||
    shuttle.pos[2] > 6.8 ||
    shuttle.pos[1] < 0.15
  ) {
    return { canStrike: false, quality: 'NONE' };
  }

  // Reachable vertical ceiling increases with jump height!
  const jumpHeight = Math.max(0, player.pos[1] || 0);
  const maxStrikeY = 3.45 + jumpHeight * 0.85;
  if (shuttle.pos[1] > maxStrikeY) {
    return { canStrike: false, quality: 'NONE' };
  }

  // Reachable horizontal distance relative to player's current footwork position
  const dx = Math.abs(shuttle.pos[0] - player.pos[0]);
  const dz = Math.abs(shuttle.pos[2] - player.pos[2]);
  const canReachHoriz = dx <= 2.2 && dz <= 2.4;
  if (!canReachHoriz) {
    return { canStrike: false, quality: 'NONE' };
  }

  let quality = 'good';
  const inSweetSpot = dx <= 0.95 && dz <= 1.45 && shuttle.pos[1] >= 0.8 && shuttle.pos[1] <= maxStrikeY;
  if (inSweetSpot) {
    quality = 'sweet_spot';
  } else if (shuttle.pos[2] > player.pos[2] + 0.35) {
    quality = 'late';
  }

  return { canStrike: true, quality };
}

/**
 * Executes a player racket strike toward the opponent court (Z < 0).
 * Supports pure mouse movement (no click required) and prevents ghost hits when shuttle is out of range.
 */
export function executePlayerStrike(state, swipeData, racketViewmodel = null, impactEffects = null) {
  const strikeInfo = computeRacketStrike(state, swipeData);
  const timing = checkStrikeWindow(state);

  const canExecuteHit = timing.canStrike || Boolean(swipeData.forceHit);
  const isPracticingSwipe = (swipeData.speed >= 240 || Boolean(swipeData.forceHit));

  // Trigger visual 3D racket swing animation on any valid swipe
  if (isPracticingSwipe) {
    state.player.swipeSpeed = Math.round(swipeData.speed || 0);
    // If practicing in mid-air, only restart animation if previous swing completed
    if (canExecuteHit || state.player.swingTimer <= 0.05) {
      state.player.swingTimer = 0.22;
      state.player.activeSwipe = swipeData;
      if (racketViewmodel && typeof racketViewmodel.triggerSwing === 'function') {
        racketViewmodel.triggerSwing(strikeInfo.shotType, 0.22);
      }
    }
  }

  // Guard: if shuttle is not currently in hitting range and not forceHit, DO NOT touch shuttle!
  if (!canExecuteHit) {
    return {
      hit: false,
      swung: isPracticingSwipe,
      shotType: strikeInfo.shotType,
      speed: 0,
      speedKmh: 0,
      quality: 'NONE',
      landingTarget: state.shuttle.landingTarget,
    };
  }

  // --- Physical Strike on Incoming Shuttle ---
  // 1. Obtain Exact 3D String Bed World Position on screen
  let bedX, bedY, bedZ;
  const vm = racketViewmodel || state._racketViewmodel;
  const cam = state._camera || null;
  if (vm && typeof vm.getStringBedWorldPosition === 'function') {
    [bedX, bedY, bedZ] = vm.getStringBedWorldPosition(cam);
  } else {
    const p = state.player.pos;
    bedX = p[0] + (state.player.virtualCursor[0] / 360) * 0.35 + 0.25;
    bedY = p[1] + state.player.eyeHeight + 0.35;
    bedZ = p[2] - 0.45;
  }

  // Milestone 5: Height-Aware Ballistics for Ground Smash vs Aerial Jump Smash
  const isAerialJump = Boolean(state.player.isJumping && state.player.pos[1] > 0.25);
  let finalSpeed = strikeInfo.speed;
  let finalElevDeg = strikeInfo.elevationDeg;

  // Geometric distance to net plane (Z = 0)
  const distToNet = Math.max(0.6, bedZ);

  if (strikeInfo.shotType === 'SMASH') {
    if (isAerialJump) {
      // Aerial Jump Smash:
      // bedY is elevated (2.6m ~ 3.65m), looking down over the net!
      state.player.lastJumpSmash = true;
      const baseSmashSpeed = swipeData.forcedShotType === 'SMASH' ? Math.max(strikeInfo.speed, 64.0) : strikeInfo.speed;
      finalSpeed = baseSmashSpeed * 1.08; // 8% speed bonus
      const netClearanceDeg = Math.atan2(1.62 - bedY, distToNet) * (180 / Math.PI);
      // Steep downward dive slamming into opponent court
      finalElevDeg = Math.max(-26.0, Math.min(-15.5, netClearanceDeg + 1.5));
      strikeInfo.elevationDeg = finalElevDeg;
      strikeInfo.speed = Math.round(finalSpeed * 10) / 10;
    } else {
      // Ground Level Smash:
      // bedY is around 1.95m ~ 2.15m.
      // Must skim flat just over the net tape and dive into opponent mid-court without hitting mesh!
      state.player.lastJumpSmash = false;
      const netClearanceDeg = Math.atan2(1.68 - bedY, distToNet) * (180 / Math.PI);
      finalElevDeg = Math.max(-12.0, Math.min(-3.5, netClearanceDeg + 2.2));
      finalSpeed = swipeData.forcedShotType === 'SMASH' ? Math.max(54.0, strikeInfo.speed) : strikeInfo.speed;
      strikeInfo.elevationDeg = finalElevDeg;
      strikeInfo.speed = Math.round(finalSpeed * 10) / 10;
    }
  } else {
    state.player.lastJumpSmash = false;

    // Height-aware elevation for other shots
    if (strikeInfo.shotType === 'DRIVE') {
      const netClearanceDeg = Math.atan2(1.62 - bedY, distToNet) * (180 / Math.PI);
      finalElevDeg = Math.max(1.5, Math.min(8.0, netClearanceDeg + 2.2));
      strikeInfo.elevationDeg = finalElevDeg;
    } else if (strikeInfo.shotType === 'DROP') {
      const netClearanceDeg = Math.atan2(1.68 - bedY, distToNet) * (180 / Math.PI);
      finalElevDeg = Math.max(5.5, Math.min(14.0, netClearanceDeg + 3.8));
      strikeInfo.elevationDeg = finalElevDeg;
    }
  }

  const elevRad = (finalElevDeg * Math.PI) / 180;

  // Convergent Horizontal Aiming From [bedX, bedZ] Toward Opponent Court Target
  const targetCourtX = Math.max(
    -2.20,
    Math.min(2.20, (state.player.virtualCursor[0] / 360) * 1.25 + (swipeData.dx || 0) * 0.006)
  );
  const approxTargetZ =
    strikeInfo.shotType === 'NET_SHOT'
      ? -1.2
      : strikeInfo.shotType === 'DROP'
      ? -2.0
      : strikeInfo.shotType === 'SMASH'
      ? -3.2
      : -4.8;
  const azimRad = Math.atan2(targetCourtX - bedX, Math.max(1.0, bedZ - approxTargetZ));
  strikeInfo.azimuthDeg = Math.round(azimRad * (180 / Math.PI) * 10) / 10;

  const speed = finalSpeed;

  // Direction toward opponent: Z component is negative!
  const cosElev = Math.cos(elevRad);
  const vx = speed * cosElev * Math.sin(azimRad);
  const vy = speed * Math.sin(elevRad);
  const vz = -speed * cosElev * Math.cos(azimRad);

  // LAUNCH DIRECTLY FROM THE 3D RACKET STRING BED ON SCREEN!
  state.shuttle.pos = [bedX, bedY, bedZ];
  state.shuttle.vel = [vx, vy, vz];

  // Immediately orient shuttle on Frame 0 so cork nose points along exit velocity
  const outDir = new THREE.Vector3(vx, vy, vz).normalize();
  const outQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), outDir);
  state.shuttle.rot = [outQuat.x, outQuat.y, outQuat.z, outQuat.w];

  state.shuttle.speed = speed;
  state.shuttle.shotType = strikeInfo.shotType;
  state.shuttle.outlineState = strikeInfo.outlineState;
  state.shuttle.inFlight = true;
  state.shuttle.hitNet = null;
  state.shuttle.flightTime = 0.0;
  state.shuttle.peakHeight = bedY;
  state.shuttle.turnoverTimer = 0.0;
  state.shuttle.turnoverProgress = 0.0;
  state.shuttle.originSide = 'player';

  // Compute immediate landing prediction toward opponent baseline
  const prediction = predictLandingTarget(state.shuttle.pos, state.shuttle.vel);
  state.shuttle.landingTarget = prediction.landingTarget;
  state.shuttle.timeToLand = prediction.timeToLand;
  state.shuttle.inBounds = prediction.inBounds;

  // Update player state
  state.player.swipeSpeed = Math.round(swipeData.speed || 0);
  state.player.lastShotType = strikeInfo.shotType;
  state.player.lastShotSpeedKmh = Math.round(speed * 3.6);
  state.player.lastTimingQuality = timing.quality;

  if (strikeInfo.shotType === 'SMASH') {
    state.score.maxSmashSpeedKmh = Math.max(state.score.maxSmashSpeedKmh || 0, state.player.lastShotSpeedKmh);
  }

  // Milestone 6: Broadcast strike over P2P network if in multiplayer mode
  if (typeof state._broadcastLocalStrike === 'function' && state.playMode === 'p2p_multiplayer') {
    state._broadcastLocalStrike(strikeInfo.shotType, speed, Boolean(state.player.lastJumpSmash));
  }

  // Milestone 4: Trigger Game Feel Pipeline (Hit-Stop, Camera FOV Punch, Trauma Shake, Web Audio, Shockwave)
  triggerImpactGameFeel(state, strikeInfo.shotType, timing.quality, Math.round(speed * 3.6));
  soundEngine.playStrikeSound(strikeInfo.shotType, timing.quality, Math.round(speed * 3.6), state);

  const fx = impactEffects || (state._impactEffects || null);
  if (fx && typeof fx.triggerImpact === 'function') {
    fx.triggerImpact(state.shuttle.pos, state.shuttle.vel, strikeInfo.shotType, timing.quality);
  }

  return {
    hit: true,
    swung: true,
    shotType: strikeInfo.shotType,
    speed: strikeInfo.speed,
    speedKmh: Math.round(speed * 3.6),
    quality: timing.quality,
    landingTarget: state.shuttle.landingTarget,
  };
}

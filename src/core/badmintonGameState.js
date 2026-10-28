// Core Domain Game State & Quadrant Logic
import {
  COURT_SPEC,
  HYSTERESIS_PX,
  CURSOR_LIMIT_X,
  CURSOR_LIMIT_Y,
} from './badmintonConstants.js';

export function createGameState() {
  return {
    mode: 'menu', // 'menu' | 'playing' | 'paused'
    playMode: 'ai_match', // 'ai_match' | 'feeder'
    elapsedTime: 0,
    rallyResetTimer: 0,
    isFullscreen: false,
    pointerLocked: false,
    player: {
      pos: [0, 0, 5.0],
      eyeHeight: 1.78,
      vel: [0, 0, 0],
      isJumping: false,
      footworkState: 'ready', // 'ready' | 'intercepting' | 'recovering' | 'manual'
      moveKeys: { forward: false, back: false, left: false, right: false },
      lastJumpSmash: false,
      racketQuadrant: 'Q1',
      grip: 'forehand', // 'forehand' | 'backhand'
      gripPower: 1.0,
      virtualCursor: [40, 30], // Default in Q1 (top-right forehand)
      swipeSpeed: 0,
      racketFaceNormal: [0, 0.35, -0.94],
      lastShotType: 'NONE',
      lastShotSpeedKmh: 0,
      lastTimingQuality: 'READY',
      swingTimer: 0,
      swingDuration: 0.18,
      activeSwipe: null,
    },
    opponent: {
      pos: [0, 0, -3.5],
      vel: [0, 0, 0],
      state: 'ready', // 'ready' | 'intercepting' | 'swinging' | 'recovering' | 'serving' | 'feeder'
      swingTimer: 0,
      rallyCount: 0,
      lastReturnType: 'NONE',
      chargingSmash: false,
      intendedShot: 'NONE',
    },
    shuttle: {
      pos: [0, 1.55, 0],
      vel: [0, 0, 0],
      speed: 0,
      shotType: 'IDLE',
      outlineState: 'normal_navy',
      landingTarget: [0, 1.98],
      timeToLand: 0,
      inFlight: false,
      hitNet: null,         // null | 'tape' | 'mesh'
      inBounds: true,
      peakHeight: 1.55,
      flightTime: 0,
      turnoverTimer: 0,
      turnoverProgress: 1.0,
      originSide: 'opponent',
      rot: [0, 0, 0, 1],     // Quaternion [x, y, z, w]
    },
    score: {
      player: 0,
      opponent: 0,
      server: 'player',
      serviceCourt: 'right_even', // 'right_even' | 'left_odd'
      serverBoxCoords: [1.15, 3.45],
      receiverBoxCoords: [-1.15, -3.45],
      isDeuce: false,
      isGamePoint: false,
      gamePointHolder: 'none', // 'none' | 'player' | 'opponent' | 'both'
      matchWinner: 'none',     // 'none' | 'player' | 'opponent'
      totalRallies: 0,
      maxSmashSpeedKmh: 0,
      lastPointWinner: null,
    },
    network: {
      status: 'offline', // 'offline' | 'hosting' | 'joining' | 'connected'
      role: 'none',      // 'none' | 'host' | 'guest'
      roomCode: '',
      peerConnected: false,
      transport: 'none', // 'none' | 'webrtc' | 'broadcast' | 'simulated'
      pingMs: 0,
      packetsSent: 0,
      packetsReceived: 0,
      lastRemoteStrikeSeq: 0,
      remoteTargetPos: [0, 0, -3.8],
      remoteTargetVel: [0, 0, 0],
    },
    performance: {
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
    },
    effects: {
      hitStopRemainingMs: 0,
      trauma: 0,
      cameraShake: 0,
      shakeOffset: [0, 0, 0],
      shakeRoll: 0,
      targetFov: 80,
      fov: 80,
      shockwaveActive: false,
      shockwaveScale: 1.0,
      shockwaveAlpha: 0,
      shockwavePos: [0, 0, 0],
      shockwaveColor: '#FF3D00',
      lastAudioEvent: null,
      offScreenIndicator: { active: false, ndcX: 0, ndcY: 0, angleRad: 0, heightM: 0, distanceM: 0 },
      cameraLookAt: [0, 1.2, -3.0],
      cameraPos: [0, 1.7, 3.5],
    },
  };
}

/**
 * Updates virtualCursor and determines quadrant (Q1-Q4) and grip (forehand/backhand)
 * with [-15px, +15px] X-axis hysteresis deadzone to prevent center jitter.
 */
export function updateVirtualCursor(state, newX, newY) {
  const clampedX = Math.max(-CURSOR_LIMIT_X, Math.min(CURSOR_LIMIT_X, newX));
  const clampedY = Math.max(-CURSOR_LIMIT_Y, Math.min(CURSOR_LIMIT_Y, newY));

  state.player.virtualCursor[0] = Math.round(clampedX);
  state.player.virtualCursor[1] = Math.round(clampedY);

  // Hysteresis Deadzone on X: [-15px, +15px] retains current grip
  if (clampedX > HYSTERESIS_PX) {
    state.player.grip = 'forehand';
    state.player.gripPower = 1.0;
  } else if (clampedX < -HYSTERESIS_PX) {
    state.player.grip = 'backhand';
    state.player.gripPower = 0.85;
  }

  const isForehandSide =
    Math.abs(clampedX) <= HYSTERESIS_PX
      ? state.player.grip === 'forehand'
      : clampedX >= 0;

  const isUpperHalf = clampedY >= 0;

  if (isForehandSide && isUpperHalf) {
    state.player.racketQuadrant = 'Q1';
  } else if (!isForehandSide && isUpperHalf) {
    state.player.racketQuadrant = 'Q2';
  } else if (!isForehandSide && !isUpperHalf) {
    state.player.racketQuadrant = 'Q3';
  } else {
    state.player.racketQuadrant = 'Q4';
  }
}

export function serializeGameState(state) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const payload = {
    mode: state.mode,
    playMode: state.playMode || 'ai_match',
    coordSystem:
      'Origin(0,0,0) at net center floor; +X right, +Y up, +Z toward player baseline; virtualCursor origin(0,0) at screen center (+X right, +Y up)',
    player: {
      pos: state.player.pos.map(round2),
      eyePos: state.effects.cameraPos.map(round2),
      vel: state.player.vel.map(round2),
      isJumping: state.player.isJumping,
      footworkState: state.player.footworkState || 'ready',
      lastJumpSmash: Boolean(state.player.lastJumpSmash),
      racketQuadrant: state.player.racketQuadrant,
      grip: state.player.grip,
      gripPower: state.player.gripPower,
      virtualCursor: [...state.player.virtualCursor],
      swipeSpeed: round2(state.player.swipeSpeed || 0),
      racketFaceNormal: (state.player.racketFaceNormal || [0, 0.35, -0.94]).map(round2),
      lastShotType: state.player.lastShotType || 'NONE',
      lastShotSpeedKmh: round2(state.player.lastShotSpeedKmh || 0),
      lastTimingQuality: state.player.lastTimingQuality || 'READY',
    },
    opponent: {
      pos: state.opponent.pos.map(round2),
      vel: (state.opponent.vel || [0, 0, 0]).map(round2),
      state: state.opponent.state,
      lastReturnType: state.opponent.lastReturnType || 'NONE',
      rallyCount: state.opponent.rallyCount || 0,
      chargingSmash: Boolean(state.opponent.chargingSmash),
      intendedShot: state.opponent.intendedShot || 'NONE',
    },
    shuttle: {
      pos: state.shuttle.pos.map(round2),
      vel: state.shuttle.vel.map(round2),
      speed: round2(state.shuttle.speed),
      shotType: state.shuttle.shotType,
      outlineState: state.shuttle.outlineState,
      landingTarget: state.shuttle.landingTarget.map(round2),
      timeToLand: round2(state.shuttle.timeToLand || 0),
      originSide: state.shuttle.originSide || 'opponent',
      inFlight: Boolean(state.shuttle.inFlight),
      hitNet: state.shuttle.hitNet,
      inBounds: state.shuttle.inBounds,
      peakHeight: round2(state.shuttle.peakHeight || 0),
    },
    score: {
      player: state.score.player,
      opponent: state.score.opponent,
      server: state.score.server,
      serviceCourt: state.score.serviceCourt || 'right_even',
      serverBoxCoords: (state.score.serverBoxCoords || [1.15, 3.45]).map(round2),
      receiverBoxCoords: (state.score.receiverBoxCoords || [-1.15, -3.45]).map(round2),
      isDeuce: Boolean(state.score.isDeuce),
      isGamePoint: Boolean(state.score.isGamePoint),
      gamePointHolder: state.score.gamePointHolder || 'none',
      matchWinner: state.score.matchWinner || 'none',
      totalRallies: state.score.totalRallies || 0,
      maxSmashSpeedKmh: round2(state.score.maxSmashSpeedKmh || 0),
      lastPointWinner: state.score.lastPointWinner || null,
    },
    network: {
      status: state.network?.status || 'offline',
      role: state.network?.role || 'none',
      roomCode: state.network?.roomCode || '',
      peerConnected: Boolean(state.network?.peerConnected),
      transport: state.network?.transport || 'none',
      pingMs: round2(state.network?.pingMs || 0),
      packetsSent: state.network?.packetsSent || 0,
      packetsReceived: state.network?.packetsReceived || 0,
      lastRemoteStrikeSeq: state.network?.lastRemoteStrikeSeq || 0,
      remoteTargetPos: (state.network?.remoteTargetPos || [0, 0, -3.8]).map(round2),
    },
    performance: {
      drawCalls: state.performance?.drawCalls || 0,
      triangles: state.performance?.triangles || 0,
      geometries: state.performance?.geometries || 0,
      textures: state.performance?.textures || 0,
    },
    effects: {
      hitStopRemainingMs: round2(state.effects.hitStopRemainingMs || 0),
      trauma: round2(state.effects.trauma || 0),
      cameraShake: round2(state.effects.cameraShake || 0),
      shakeOffset: (state.effects.shakeOffset || [0, 0, 0]).map(round2),
      shakeRoll: round2(state.effects.shakeRoll || 0),
      fov: round2(state.effects.fov || 80),
      targetFov: round2(state.effects.targetFov || 80),
      shockwaveActive: Boolean(state.effects.shockwaveActive),
      shockwaveScale: round2(state.effects.shockwaveScale || 1.0),
      shockwaveAlpha: round2(state.effects.shockwaveAlpha || 0),
      shockwavePos: (state.effects.shockwavePos || [0, 0, 0]).map(round2),
      shockwaveColor: state.effects.shockwaveColor || '#FF3D00',
      lastAudioEvent: state.effects.lastAudioEvent ? { ...state.effects.lastAudioEvent } : null,
      offScreenIndicator: state.effects.offScreenIndicator ? { ...state.effects.offScreenIndicator } : null,
    },
    court: {
      length: COURT_SPEC.length,
      width: COURT_SPEC.width,
      singlesWidth: COURT_SPEC.singlesWidth,
      shortServiceLine: COURT_SPEC.shortServiceDist,
      longServiceLineDoubles: COURT_SPEC.doublesLongServiceDist,
      netHeightPosts: COURT_SPEC.netHeightPosts,
      netHeightCenter: COURT_SPEC.netHeightCenter,
      palette: COURT_SPEC.palette,
    },
  };
  return JSON.stringify(payload);
}

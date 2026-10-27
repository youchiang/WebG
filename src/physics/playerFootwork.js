/**
 * Player Footwork & Kinematics Module (Milestone 5)
 * Implements:
 * - Semi-Automatic Intercept Footwork using 'arrive' steering (from game-ai)
 * - WASD / Arrow Keys responsive manual fine-tuning
 * - Court boundary clamping (x in [-2.95, 2.95], z in [0.65, 6.65])
 * - Space key jump kinematics & hangtime
 */

import { soundEngine } from '../audio/soundEngine.js';

/**
 * 2D Arrive steering behavior (decelerates smoothly inside slowRadius).
 */
function arrive2D(currentPos, currentVel, targetPos, maxSpeed, maxForce, slowRadius) {
  const dx = targetPos[0] - currentPos[0];
  const dz = targetPos[1] - currentPos[1];
  const dist = Math.hypot(dx, dz);

  if (dist < 0.001) {
    return [-currentVel[0], -currentVel[1]];
  }

  const ramped = maxSpeed * Math.min(dist / slowRadius, 1.0);
  const desiredX = (dx / dist) * ramped;
  const desiredZ = (dz / dist) * ramped;

  let steerX = desiredX - currentVel[0];
  let steerZ = desiredZ - currentVel[1];
  const steerLen = Math.hypot(steerX, steerZ);

  if (steerLen > maxForce) {
    steerX = (steerX / steerLen) * maxForce;
    steerZ = (steerZ / steerLen) * maxForce;
  }

  return [steerX, steerZ];
}

/**
 * Triggers a player vertical jump if on the ground.
 */
export function triggerPlayerJump(state) {
  if (!state.player) return false;
  if (!state.player.isJumping && state.player.pos[1] <= 0.02) {
    state.player.isJumping = true;
    state.player.vel[1] = 5.6; // Vertical jump velocity -> ~1.60m peak height (eye height up to 3.38m)
    return true;
  }
  return false;
}

/**
 * Sets manual movement key states.
 */
export function setPlayerMoveKeys(state, keys = {}) {
  if (!state.player) return;
  state.player.moveKeys = {
    forward: Boolean(keys.forward),
    back: Boolean(keys.back),
    left: Boolean(keys.left),
    right: Boolean(keys.right),
  };
}

/**
 * Updates player footwork, jump kinematics, and court position clamping.
 */
export function updatePlayerFootwork(state, dt) {
  const player = state.player;
  if (!player) return;

  // 1. Vertical Jump Kinematics Integration
  if (player.isJumping) {
    player.pos[1] += player.vel[1] * dt;
    player.vel[1] -= 9.81 * dt; // Gravity

    if (player.pos[1] <= 0) {
      player.pos[1] = 0;
      player.vel[1] = 0;
      player.isJumping = false;
      soundEngine.playEnvironmentSound('floor', { landing: true }, state);
    }
  } else {
    player.pos[1] = 0;
    player.vel[1] = 0;
  }

  // 2. Check for Active Manual WASD / Arrow Keys Input
  const keys = player.moveKeys || {};
  let manualDx = 0;
  let manualDz = 0;

  if (keys.forward) manualDz -= 1; // Toward net (-Z)
  if (keys.back) manualDz += 1;    // Toward baseline (+Z)
  if (keys.left) manualDx -= 1;    // Left (-X)
  if (keys.right) manualDx += 1;   // Right (+X)

  const isManualActive = manualDx !== 0 || manualDz !== 0;

  if (isManualActive) {
    const len = Math.hypot(manualDx, manualDz);
    const manualSpeed = 5.2; // 5.2 m/s athletic sprint
    player.vel[0] = (manualDx / len) * manualSpeed;
    player.vel[2] = (manualDz / len) * manualSpeed;
    player.footworkState = 'manual';
  } else {
    // 3. Semi-Automatic Intercept Footwork
    const shuttle = state.shuttle;
    const isIncoming = Boolean(
      shuttle.inFlight &&
      shuttle.vel[2] > 0 &&
      shuttle.landingTarget &&
      shuttle.landingTarget[1] >= 0
    );

    if (isIncoming) {
      // Calculate ideal intercept target slightly behind landing point
      const targetX = Math.max(-2.6, Math.min(2.6, shuttle.landingTarget[0]));
      const targetZ = Math.max(1.15, Math.min(5.85, shuttle.landingTarget[1] + 0.35));

      const [steerX, steerZ] = arrive2D(
        [player.pos[0], player.pos[2]],
        [player.vel[0], player.vel[2]],
        [targetX, targetZ],
        5.6,   // max speed 5.6 m/s
        22.0,  // max acceleration 22.0 m/s^2
        0.85   // slow radius 0.85m
      );

      player.vel[0] += steerX * dt;
      player.vel[2] += steerZ * dt;
      player.footworkState = 'intercepting';
    } else {
      // Shuttle flying to opponent side or rally ended: return smoothly to base ready spot [0, 3.8]
      const distToBase = Math.hypot(player.pos[0] - 0, player.pos[2] - 3.8);

      if (distToBase < 0.15) {
        player.vel[0] *= 0.6;
        player.vel[2] *= 0.6;
        player.footworkState = 'ready';
      } else {
        const [steerX, steerZ] = arrive2D(
          [player.pos[0], player.pos[2]],
          [player.vel[0], player.vel[2]],
          [0, 3.8],
          3.8,  // recovery speed 3.8 m/s
          16.0,
          0.75
        );

        player.vel[0] += steerX * dt;
        player.vel[2] += steerZ * dt;
        player.footworkState = 'recovering';
      }
    }
  }

  // 4. Integrate Horizontal Position
  player.pos[0] += player.vel[0] * dt;
  player.pos[2] += player.vel[2] * dt;

  // 5. Strict Court Boundaries Clamping (Player Side: X in [-2.95, 2.95], Z in [0.65, 6.65])
  player.pos[0] = Math.max(-2.95, Math.min(2.95, player.pos[0]));
  player.pos[2] = Math.max(0.65, Math.min(6.65, player.pos[2]));
}

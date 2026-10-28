import * as THREE from 'three';
import {
  SHUTTLE_PHYSICS,
  SHOT_PRESETS,
  COURT_SPEC,
} from '../core/badmintonConstants.js';
import { soundEngine } from '../audio/soundEngine.js';

const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _upVec = new THREE.Vector3(0, 1, 0);

/**
 * Computes exact catenary top height of the badminton net at lateral coordinate x.
 * BWF standard: 1.55m at posts (x = ±3.05m), dips smoothly to 1.524m at center (x = 0).
 */
export function calculateNetHeight(x) {
  const halfW = COURT_SPEC.halfWidth; // 3.05m
  const clampedX = Math.max(-halfW, Math.min(halfW, x));
  const t = Math.abs(clampedX) / halfW;
  return (
    SHUTTLE_PHYSICS.netCatenaryCenter +
    (SHUTTLE_PHYSICS.netCatenaryPosts - SHUTTLE_PHYSICS.netCatenaryCenter) * (t * t)
  );
}

/**
 * Evaluates whether an (x, z) coordinate is inside standard BWF singles and doubles court lines.
 */
export function evaluateCourtBounds(x, z) {
  const isSingles =
    Math.abs(x) <= SHUTTLE_PHYSICS.singlesHalfWidth + COURT_SPEC.lineWidth / 2 &&
    Math.abs(z) <= SHUTTLE_PHYSICS.courtHalfLength + COURT_SPEC.lineWidth / 2;

  const isDoubles =
    Math.abs(x) <= SHUTTLE_PHYSICS.doublesHalfWidth + COURT_SPEC.lineWidth / 2 &&
    Math.abs(z) <= SHUTTLE_PHYSICS.courtHalfLength + COURT_SPEC.lineWidth / 2;

  return { isSingles, isDoubles, inBounds: isSingles };
}

/**
 * Fast numerical forward-integration of quadratic drag equation to predict exact
 * ground landing coordinate [targetX, targetZ] and flight duration timeToLand.
 */
export function predictLandingTarget(startPos, startVel, maxSimulationSec = 4.0) {
  let [px, py, pz] = startPos;
  let [vx, vy, vz] = startVel;

  const dt = 0.016; // 60Hz step for prediction
  const cDrag = SHUTTLE_PHYSICS.dragCoeff;
  const g = SHUTTLE_PHYSICS.gravity;
  const floorY = SHUTTLE_PHYSICS.floorY;

  let timeAccum = 0.0;
  let hitNet = null;

  const maxSteps = Math.round(maxSimulationSec / dt);

  for (let s = 0; s < maxSteps; s++) {
    const prevZ = pz;
    const prevY = py;
    const prevX = px;

    const speed = Math.hypot(vx, vy, vz);
    const dragAcc = cDrag * speed;

    vx -= dragAcc * vx * dt;
    vy -= (g + dragAcc * vy) * dt;
    vz -= dragAcc * vz * dt;

    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    timeAccum += dt;

    // Check net crossing during prediction
    if ((prevZ < 0 && pz >= 0) || (prevZ > 0 && pz <= 0)) {
      const denom = pz - prevZ;
      const tCross = Math.abs(denom) > 1e-6 ? (0 - prevZ) / denom : 0.5;
      const xCross = prevX + tCross * (px - prevX);
      const yCross = prevY + tCross * (py - prevY);

      if (Math.abs(xCross) <= COURT_SPEC.halfWidth) {
        const netTop = calculateNetHeight(xCross);
        if (yCross < netTop - SHUTTLE_PHYSICS.netTapeThickness) {
          // Blocked by net mesh: drop near net
          hitNet = 'mesh';
          px = xCross;
          pz = prevZ > 0 ? 0.35 : -0.35;
          timeAccum += Math.max(0.1, yCross / 4.0);
          break;
        } else if (yCross < netTop) {
          // Net tape deflection
          hitNet = 'tape';
          vx *= 0.35;
          vz *= 0.35;
        }
      }
    }

    // Floor contact reached
    if (py <= floorY) {
      py = floorY;
      break;
    }
  }

  const bounds = evaluateCourtBounds(px, pz);
  return {
    landingTarget: [Math.round(px * 100) / 100, Math.round(pz * 100) / 100],
    timeToLand: Math.round(timeAccum * 100) / 100,
    inBounds: bounds.inBounds,
    hitNet,
  };
}

/**
 * Launches a high-fidelity badminton shot trajectory from either opponent or player side.
 * Populates state.shuttle with authentic 3D initial velocities, outline states, and landing predictions.
 */
export function launchShuttleShot(
  state,
  shotType = 'CLEAR',
  originSide = 'opponent',
  customOpts = {}
) {
  const preset = SHOT_PRESETS[shotType] || SHOT_PRESETS.CLEAR;

  const defaultPos =
    originSide === 'opponent'
      ? preset.defaultOpponentPos
      : preset.defaultPlayerPos;

  const startPos = customOpts.pos || [...defaultPos];
  const speed = customOpts.speed || preset.speed;
  const elevDeg = customOpts.elevationDeg !== undefined ? customOpts.elevationDeg : preset.elevationDeg;
  const azimDeg = customOpts.azimuthDeg !== undefined ? customOpts.azimuthDeg : preset.azimuthDeg;

  const elevRad = (elevDeg * Math.PI) / 180;
  const azimRad = (azimDeg * Math.PI) / 180;

  // Z travel direction: Opponent (+Z toward player baseline); Player (-Z toward opponent baseline)
  const zSign = originSide === 'opponent' ? 1.0 : -1.0;
  const cosElev = Math.cos(elevRad);

  const vx = speed * cosElev * Math.sin(azimRad);
  const vy = speed * Math.sin(elevRad);
  const vz = speed * cosElev * Math.cos(azimRad) * zSign;

  state.shuttle.pos = [startPos[0], startPos[1], startPos[2]];
  state.shuttle.vel = [vx, vy, vz];
  state.shuttle.speed = speed;
  state.shuttle.shotType = preset.type;
  state.shuttle.outlineState = customOpts.outlineState || preset.outlineState;
  state.shuttle.inFlight = true;
  state.shuttle.hitNet = null;
  state.shuttle.flightTime = 0.0;
  state.shuttle.peakHeight = startPos[1];
  state.shuttle.turnoverTimer = 0.0;
  state.shuttle.turnoverProgress = 0.0;
  state.shuttle.originSide = originSide;

  // Compute immediate landing prediction
  const prediction = predictLandingTarget(state.shuttle.pos, state.shuttle.vel);
  state.shuttle.landingTarget = prediction.landingTarget;
  state.shuttle.timeToLand = prediction.timeToLand;
  state.shuttle.inBounds = prediction.inBounds;

  return state.shuttle;
}

/**
 * 60Hz Fixed-Step Physical Simulation Integration.
 * Employs 4x sub-stepping (240Hz sub-ticks) for absolute numerical stability at high smash speeds (up to 85m/s).
 * Evaluates turnover rotation, CCD net collision, floor bounce/settle, and sweet spot detection.
 */
export function stepShuttlePhysics(state, dt) {
  const shuttle = state.shuttle;
  if (!shuttle.inFlight) return;

  const subSteps = SHUTTLE_PHYSICS.subSteps;
  const subDt = dt / subSteps;
  const cDrag = SHUTTLE_PHYSICS.dragCoeff;
  const g = SHUTTLE_PHYSICS.gravity;
  const floorY = SHUTTLE_PHYSICS.floorY;

  for (let step = 0; step < subSteps; step++) {
    const prevX = shuttle.pos[0];
    const prevY = shuttle.pos[1];
    const prevZ = shuttle.pos[2];

    const vx = shuttle.vel[0];
    const vy = shuttle.vel[1];
    const vz = shuttle.vel[2];

    const speed = Math.hypot(vx, vy, vz);
    shuttle.speed = speed;

    // Turnover effect progress (40ms transition to nose-forward orientation)
    shuttle.turnoverTimer += subDt;
    shuttle.turnoverProgress = Math.min(1.0, shuttle.turnoverTimer / SHUTTLE_PHYSICS.turnoverDuration);

    // Quadratic air drag acceleration vector
    const dragAcc = cDrag * speed;
    const ax = -dragAcc * vx;
    const ay = -g - dragAcc * vy;
    const az = -dragAcc * vz;

    // Semi-implicit Euler integration
    shuttle.vel[0] += ax * subDt;
    shuttle.vel[1] += ay * subDt;
    shuttle.vel[2] += az * subDt;

    shuttle.pos[0] += shuttle.vel[0] * subDt;
    shuttle.pos[1] += shuttle.vel[1] * subDt;
    shuttle.pos[2] += shuttle.vel[2] * subDt;

    shuttle.flightTime += subDt;
    shuttle.peakHeight = Math.max(shuttle.peakHeight, shuttle.pos[1]);

    const currX = shuttle.pos[0];
    const currY = shuttle.pos[1];
    const currZ = shuttle.pos[2];

    // 1. Continuous Collision Detection (CCD) with Badminton Net Plane (Z = 0)
    if ((prevZ < 0 && currZ >= 0) || (prevZ > 0 && currZ <= 0)) {
      const denom = currZ - prevZ;
      const tCross = Math.abs(denom) > 1e-6 ? (0 - prevZ) / denom : 0.5;
      const xCross = prevX + tCross * (currX - prevX);
      const yCross = prevY + tCross * (currY - prevY);

      if (Math.abs(xCross) <= COURT_SPEC.halfWidth) {
        const netTop = calculateNetHeight(xCross);

        if (yCross >= netTop) {
          // Clean clearance over the net top cord
        } else if (yCross >= netTop - SHUTTLE_PHYSICS.netTapeThickness) {
          // Net-cord hit on the 50mm white tape: horizontal speed dampens 65%, pops upward, tumbles over
          shuttle.hitNet = 'tape';
          shuttle.outlineState = 'drop_cyan';
          shuttle.vel[0] *= 0.35;
          shuttle.vel[2] *= 0.35;
          shuttle.vel[1] = Math.max(shuttle.vel[1], 0.65);
          // Nudge past net plane
          shuttle.pos[2] = prevZ > 0 ? -0.04 : 0.04;
          soundEngine.playEnvironmentSound('net_tape', { pos: [xCross, yCross, 0] }, state);
        } else {
          // Blocked by net mesh: bounce backward softly and drop
          shuttle.hitNet = 'mesh';
          shuttle.vel[2] *= -0.15;
          shuttle.vel[0] *= 0.30;
          shuttle.vel[1] *= 0.25;
          shuttle.pos[2] = prevZ > 0 ? 0.06 : -0.06;
          soundEngine.playEnvironmentSound('net_mesh', { pos: [xCross, yCross, 0] }, state);
        }
      }
    }

    // 2. Floor Collision Detection (Y <= floorY)
    if (shuttle.pos[1] <= floorY) {
      shuttle.pos[1] = floorY;
      const bounds = evaluateCourtBounds(shuttle.pos[0], shuttle.pos[2]);
      shuttle.inBounds = bounds.inBounds;

      // Settle on ground
      shuttle.vel[0] = 0;
      shuttle.vel[1] = 0;
      shuttle.vel[2] = 0;
      shuttle.speed = 0;
      shuttle.inFlight = false;
      shuttle.timeToLand = 0;

      soundEngine.playEnvironmentSound('floor', { pos: [...shuttle.pos], inBounds: bounds.inBounds }, state);
      break;
    }
  }

  // 3. Dynamic Sweet Spot Detection (when incoming toward player reachable strike zone)
  if (shuttle.inFlight && shuttle.vel[2] > 0) {
    const [sx, sy, sz] = shuttle.pos;
    const inSweetSpot =
      sz >= 0.45 &&
      sz <= 6.5 &&
      sy >= 0.20 &&
      sy <= 3.45 &&
      Math.abs(sx) <= SHUTTLE_PHYSICS.doublesHalfWidth;

    if (inSweetSpot) {
      if (
        shuttle.shotType !== 'SMASH' &&
        shuttle.shotType !== 'DROP' &&
        shuttle.shotType !== 'NET_SHOT' &&
        shuttle.hitNet !== 'tape'
      ) {
        shuttle.outlineState = 'sweet_spot_green';
      }
    } else if (shuttle.outlineState === 'sweet_spot_green') {
      shuttle.outlineState = 'normal_navy';
    }
  }

  // 4. Update Remaining Flight Time and 3D Rotation Quaternion
  if (shuttle.inFlight) {
    const livePrediction = predictLandingTarget(shuttle.pos, shuttle.vel);
    shuttle.landingTarget = livePrediction.landingTarget;
    shuttle.timeToLand = livePrediction.timeToLand;

    // Calculate cork nose orientation aligned with velocity vector
    _tmpV1.set(shuttle.vel[0], shuttle.vel[1], shuttle.vel[2]);
    if (_tmpV1.lengthSq() > 0.01) {
      _tmpV1.normalize();
      // Shuttle geometry standard: cork points forward along -Z
      _tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), _tmpV1);

      // Axial spin around flight direction (~360 rpm aerodynamic counter-clockwise rotation)
      const spinAngle = shuttle.flightTime * 22.0;
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(_tmpV1, spinAngle);
      _tmpQuat.premultiply(spinQuat);

      shuttle.rot = [_tmpQuat.x, _tmpQuat.y, _tmpQuat.z, _tmpQuat.w];
    }
  }
}

/**
 * AI Opponent Controller & Single-Player Game Modes (Milestone 5)
 * Implements:
 * - Selectable Play Modes: 'ai_match' (AI Opponent Rally) vs 'feeder' (Multi-shot Feeder)
 * - AI Opponent Finite State Machine: 'ready' | 'intercepting' | 'swinging' | 'recovering' | 'serving' | 'feeder'
 * - 'arrive' steering toward predicted landing target (from game-ai)
 * - Tactical return shot selection & open court placement
 * - Official BWF Rally Point Scoring system & auto-serve reset
 */

import { launchShuttleShot } from '../physics/shuttlePhysics.js';
import { soundEngine } from '../audio/soundEngine.js';

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

export function setPlayMode(state, mode = 'ai_match') {
  if (mode !== 'ai_match' && mode !== 'feeder') {
    mode = 'ai_match';
  }
  state.playMode = mode;
  state.opponent.state = mode === 'feeder' ? 'feeder' : 'ready';
  state.opponent.chargingSmash = false;
  state.opponent.intendedShot = 'NONE';
  state.opponent.pos[1] = 0;
  if (state.opponent._intentDecidedForBall !== undefined) {
    state.opponent._intentDecidedForBall = false;
  }
  if (state.shuttle) {
    state.shuttle.inFlight = false;
  }
  state.opponent.rallyCount = 0;
  state.rallyResetTimer = 0.8;
  return state.playMode;
}

export function createOpponentController() {
  const FEEDER_CYCLE = ['CLEAR', 'SMASH', 'ATTACKING_CLEAR', 'DROP', 'DRIVE', 'NET_SHOT', 'LIFT'];
  const FEEDER_AZIMUTHS = [0, -6.5, 6.5, -4.0, 4.0, -8.0, 8.0];
  let feederIndex = 0;
  let rallyScoredForCurrentBall = false;

  function update(state, dt, onShotLaunched = null) {
    if (state.mode !== 'playing') return;

    const opponent = state.opponent;
    const shuttle = state.shuttle;

    if (!opponent.vel) opponent.vel = [0, 0, 0];
    opponent.swingTimer = Math.max(0, (opponent.swingTimer || 0) - dt);

    // ==========================================
    // MODE 1: FEEDER TRAINING MODE
    // ==========================================
    if (state.playMode === 'feeder') {
      opponent.state = 'feeder';

      // Keep feeder at stationary center-rear post [0, 0, -4.2]
      opponent.pos[0] = 0;
      opponent.pos[2] = -4.2;
      opponent.vel[0] = 0;
      opponent.vel[2] = 0;

      // Auto-feed cycle when shuttle lands or idle
      if (!shuttle.inFlight) {
        state.rallyResetTimer = (state.rallyResetTimer || 0) - dt;
        const nextFeederShot = FEEDER_CYCLE[feederIndex % FEEDER_CYCLE.length];

        // Pre-strike telegraph phase (0.0 < timer <= 0.75s)
        if (nextFeederShot === 'SMASH' && state.rallyResetTimer <= 0.75 && state.rallyResetTimer > 0) {
          if (!opponent.chargingSmash) {
            opponent.chargingSmash = true;
            opponent.intendedShot = 'SMASH';
            soundEngine.playSmashWarningSound(state);
          }
          // Elevate feeder smoothly for jump smash windup
          opponent.pos[1] = Math.min(0.65, (opponent.pos[1] || 0) + 2.2 * dt);
        } else if (state.rallyResetTimer > 0) {
          opponent.chargingSmash = false;
          opponent.intendedShot = nextFeederShot;
          opponent.pos[1] = Math.max(0, (opponent.pos[1] || 0) - 3.5 * dt);
        }

        if (state.rallyResetTimer <= 0) {
          const shotType = FEEDER_CYCLE[feederIndex % FEEDER_CYCLE.length];
          const azim = FEEDER_AZIMUTHS[feederIndex % FEEDER_AZIMUTHS.length];
          feederIndex++;

          const isSmash = shotType === 'SMASH';
          const launchOpts = {
            pos: [0, isSmash ? 2.65 : 1.85, -4.2],
            azimuthDeg: azim,
          };
          if (isSmash) {
            // Moderated opponent smash speed to 36 m/s (~0.50s reaction flight)
            launchOpts.speed = 36.0;
            launchOpts.elevationDeg = -12.0;
          }

          launchShuttleShot(state, shotType, 'opponent', launchOpts);

          opponent.chargingSmash = false;
          opponent.intendedShot = 'NONE';
          opponent.swingTimer = 0.22;
          soundEngine.playStrikeSound(shotType, 'good', Math.round(state.shuttle.speed * 3.6), state);

          if (typeof onShotLaunched === 'function') {
            onShotLaunched(shotType);
          }

          state.rallyResetTimer = 1.15;
          rallyScoredForCurrentBall = false;
        }
      } else {
        opponent.chargingSmash = false;
        opponent.pos[1] = Math.max(0, (opponent.pos[1] || 0) - 3.5 * dt);
      }
      return;
    }

    // ==========================================
    // MODE 2: AI MATCH RALLY MODE
    // ==========================================
    const isPlayerShotFlyingToOpponent = Boolean(
      shuttle.inFlight &&
      shuttle.vel[2] < 0 &&
      shuttle.originSide === 'player'
    );

    const isShuttleReturningToPlayer = Boolean(
      shuttle.inFlight &&
      shuttle.vel[2] > 0
    );

    // 1. IN FLIGHT: Player shot incoming toward Opponent Court (Z < 0)
    if (isPlayerShotFlyingToOpponent) {
      rallyScoredForCurrentBall = false;
      opponent.state = 'intercepting';

      // Early intent decision for telegraphing smash
      if (!opponent._intentDecidedForBall) {
        opponent._intentDecidedForBall = true;
        const landingZ = (shuttle.landingTarget && shuttle.landingTarget[1]) || -3.5;
        const isHighBackcourt = (landingZ <= -2.4 && (shuttle.pos[1] > 2.0 || shuttle.vel[1] > 0)) ||
                                (shuttle.shotType === 'CLEAR' || shuttle.shotType === 'ATTACKING_CLEAR' || shuttle.shotType === 'LIFT');
        if (isHighBackcourt && Math.random() < 0.65) {
          opponent.intendedShot = 'SMASH';
          opponent.chargingSmash = true;
          soundEngine.playSmashWarningSound(state);
        } else {
          opponent.intendedShot = 'CLEAR';
          opponent.chargingSmash = false;
        }
      }

      if (opponent.chargingSmash) {
        // Smoothly elevate opponent for jump smash anticipation
        opponent.pos[1] = Math.min(0.65, (opponent.pos[1] || 0) + 2.2 * dt);
      } else {
        opponent.pos[1] = Math.max(0, (opponent.pos[1] || 0) - 3.5 * dt);
      }

      // Target position derived from predicted landing target
      const targetX = Math.max(-2.6, Math.min(2.6, shuttle.landingTarget[0] || 0));
      const targetZ = Math.max(-6.2, Math.min(-1.0, (shuttle.landingTarget[1] || -3.5) - 0.25));

      const [steerX, steerZ] = arrive2D(
        [opponent.pos[0], opponent.pos[2]],
        [opponent.vel[0], opponent.vel[2]],
        [targetX, targetZ],
        6.2,  // athletic sprint 6.2 m/s
        24.0, // agile acceleration 24 m/s^2
        0.90  // slow down radius 0.9m
      );

      opponent.vel[0] += steerX * dt;
      opponent.vel[2] += steerZ * dt;

      // Check Opponent Strike Reach Window
      const distToShuttle = Math.hypot(
        opponent.pos[0] - shuttle.pos[0],
        opponent.pos[2] - shuttle.pos[2]
      );

      const inOpponentStrikeZone =
        shuttle.pos[2] >= -6.5 &&
        shuttle.pos[2] <= -0.35 &&
        shuttle.pos[1] >= 0.25 &&
        shuttle.pos[1] <= 3.45 &&
        distToShuttle <= 1.85;

      if (inOpponentStrikeZone) {
        // --- AI Executes Tactical Return Strike ---
        opponent.state = 'swinging';
        opponent.swingTimer = 0.24;

        // Tactical Shot Selection:
        let chosenShot = opponent.intendedShot && opponent.intendedShot !== 'NONE' ? opponent.intendedShot : 'CLEAR';
        const sy = shuttle.pos[1];
        const sz = shuttle.pos[2];

        if (!opponent.intendedShot || opponent.intendedShot === 'NONE') {
          if (sz > -1.9) {
            // Near the net: Net tumbling shot or aggressive Lift/Drive
            chosenShot = Math.random() < 0.5 ? 'LIFT' : 'NET_SHOT';
          } else if (sy > 2.35) {
            // High overhead ball in midcourt/backcourt: Smash or attacking clear
            chosenShot = Math.random() < 0.55 ? 'SMASH' : (Math.random() < 0.5 ? 'DROP' : 'ATTACKING_CLEAR');
          } else {
            // Mid-height rally: Crisp Drive or deep Clear
            chosenShot = Math.random() < 0.6 ? 'DRIVE' : 'CLEAR';
          }
        }

        // Tactical Direction: aim toward open court space away from player position!
        const playerX = state.player ? state.player.pos[0] : 0;
        let aimAzimuth = 0;
        if (playerX > 0.4) {
          aimAzimuth = -(4.5 + Math.random() * 4.0); // Player is on right, return to left
        } else if (playerX < -0.4) {
          aimAzimuth = 4.5 + Math.random() * 4.0;   // Player is on left, return to right
        } else {
          aimAzimuth = (Math.random() - 0.5) * 8.0;  // Aim toward sidelines
        }

        const isSmash = chosenShot === 'SMASH';
        const returnPos = [
          opponent.pos[0],
          isSmash ? 2.65 : Math.max(1.25, Math.min(2.8, sy)),
          opponent.pos[2] + 0.35,
        ];

        const launchOpts = {
          pos: returnPos,
          azimuthDeg: aimAzimuth,
        };
        if (isSmash) {
          // Moderated opponent smash speed to 36 m/s (~0.50s reaction flight)
          launchOpts.speed = 36.0;
          launchOpts.elevationDeg = -12.0;
        }

        launchShuttleShot(state, chosenShot, 'opponent', launchOpts);

        opponent.chargingSmash = false;
        opponent.intendedShot = 'NONE';
        opponent._intentDecidedForBall = false;

        soundEngine.playStrikeSound(chosenShot, 'good', Math.round(state.shuttle.speed * 3.6), state);

        opponent.rallyCount = (opponent.rallyCount || 0) + 1;
        opponent.lastReturnType = chosenShot;

        if (typeof onShotLaunched === 'function') {
          onShotLaunched(chosenShot);
        }
      }
    } else if (isShuttleReturningToPlayer) {
      // 2. IN FLIGHT: Shuttle returned toward Player side (Z > 0)
      opponent.chargingSmash = false;
      opponent.intendedShot = 'NONE';
      opponent._intentDecidedForBall = false;
      opponent.pos[1] = Math.max(0, (opponent.pos[1] || 0) - 3.5 * dt);

      // Opponent recovers smoothly toward tactical base position [0, -3.6]
      const distToBase = Math.hypot(opponent.pos[0] - 0, opponent.pos[2] - (-3.6));

      if (distToBase < 0.2) {
        opponent.vel[0] *= 0.5;
        opponent.vel[2] *= 0.5;
        if ((opponent.swingTimer || 0) <= 0.08) {
          opponent.state = 'ready';
        } else {
          opponent.state = 'swinging';
        }
      } else {
        const [steerX, steerZ] = arrive2D(
          [opponent.pos[0], opponent.pos[2]],
          [opponent.vel[0], opponent.vel[2]],
          [0, -3.6],
          4.2,  // recovery speed
          18.0,
          0.80
        );

        opponent.vel[0] += steerX * dt;
        opponent.vel[2] += steerZ * dt;
        if ((opponent.swingTimer || 0) <= 0.08) {
          opponent.state = 'recovering';
        } else {
          opponent.state = 'swinging';
        }
      }
    }

    // Integrate Opponent Horizontal Movement
    opponent.pos[0] += opponent.vel[0] * dt;
    opponent.pos[2] += opponent.vel[2] * dt;

    // Strict Court Boundary Clamping on Opponent side (X in [-2.95, 2.95], Z in [-6.65, -0.65])
    opponent.pos[0] = Math.max(-2.95, Math.min(2.95, opponent.pos[0]));
    opponent.pos[2] = Math.max(-6.65, Math.min(-0.65, opponent.pos[2]));

    // 3. RALLY END: Point Evaluation & BWF Scoring System
    if (!shuttle.inFlight) {
      opponent.chargingSmash = false;
      opponent.intendedShot = 'NONE';
      opponent._intentDecidedForBall = false;
      opponent.pos[1] = Math.max(0, (opponent.pos[1] || 0) - 3.5 * dt);
      if (!rallyScoredForCurrentBall) {
        rallyScoredForCurrentBall = true;
        opponent.state = 'serving';

        // Evaluate point winner based on last shot origin and landing point
        if (shuttle.originSide === 'player') {
          // Player hit the shot: lands on opponent side (Z < 0), in bounds, and didn't fail at net mesh
          const wonPoint = shuttle.pos[2] < 0 && shuttle.inBounds && shuttle.hitNet !== 'mesh';
          if (wonPoint) {
            state.score.player++;
            state.score.lastPointWinner = 'player';
            state.score.server = 'player';
          } else {
            state.score.opponent++;
            state.score.lastPointWinner = 'opponent';
            state.score.server = 'opponent';
          }
        } else if (shuttle.originSide === 'opponent') {
          // Opponent hit the shot: lands on player side (Z > 0), in bounds, and didn't fail at net mesh
          const wonPoint = shuttle.pos[2] > 0 && shuttle.inBounds && shuttle.hitNet !== 'mesh';
          if (wonPoint) {
            state.score.opponent++;
            state.score.lastPointWinner = 'opponent';
            state.score.server = 'opponent';
          } else {
            state.score.player++;
            state.score.lastPointWinner = 'player';
            state.score.server = 'player';
          }
        }

        state.rallyResetTimer = 1.10;
      }

      // Auto-serve countdown to start next rally
      state.rallyResetTimer = (state.rallyResetTimer || 0) - dt;
      if (state.rallyResetTimer <= 0) {
        state.rallyResetTimer = 1.10;
        rallyScoredForCurrentBall = false;

        // Launch serve from server side
        const serveShot = Math.random() < 0.65 ? 'CLEAR' : 'ATTACKING_CLEAR';
        launchShuttleShot(state, serveShot, 'opponent', {
          pos: [opponent.pos[0], 1.65, opponent.pos[2]],
          azimuthDeg: (Math.random() - 0.5) * 6.0,
        });

        opponent.swingTimer = 0.22;
        soundEngine.playStrikeSound(serveShot, 'good', Math.round(state.shuttle.speed * 3.6), state);

        if (typeof onShotLaunched === 'function') {
          onShotLaunched(serveShot);
        }
      }
    }
  }

  return {
    update,
  };
}

/**
 * BWF Official 21-Point Match Rules, Deuce, Service Court Switching, & Settlement (Milestone 6)
 * Implements:
 * - Official BWF 21-Point Rally Point scoring system
 * - Deuce at 20:20 (requires 2-point margin to win)
 * - 30-Point Sudden Death Cap (first to 30 wins, e.g. 30:29)
 * - Odd / Even Service Court alternating (0, 2, 4... -> Right Court, 1, 3, 5... -> Left Court)
 * - Diagonal service box coordinates for Server & Receiver
 * - Match settlement state transitions (state.mode = 'match_over')
 */

import { MATCH_RULES } from './badmintonConstants.js';

export function updateServiceCourtState(state) {
  const score = state.score;
  const serverScore = score.server === 'player' ? score.player : score.opponent;

  // Even score: Right Service Court; Odd score: Left Service Court
  const isEven = serverScore % 2 === 0;
  score.serviceCourt = isEven ? 'right_even' : 'left_odd';

  // Player side (Z > 0): Right is X > 0, Left is X < 0
  // Opponent side (Z < 0): Diagonally opposite court
  if (score.server === 'player') {
    score.serverBoxCoords = isEven ? [1.15, 3.45] : [-1.15, 3.45];
    score.receiverBoxCoords = isEven ? [-1.15, -3.45] : [1.15, -3.45];
  } else {
    score.serverBoxCoords = isEven ? [-1.15, -3.45] : [1.15, -3.45];
    score.receiverBoxCoords = isEven ? [1.15, 3.45] : [-1.15, 3.45];
  }

  // Deuce Evaluation: >= 20 and equal
  const p = score.player;
  const o = score.opponent;
  score.isDeuce = p >= 20 && o >= 20 && p === o;

  // Match Winner Evaluation
  let winner = 'none';
  if ((p >= 21 || o >= 21) && Math.abs(p - o) >= 2) {
    winner = p > o ? 'player' : 'opponent';
  } else if (p >= 30) {
    winner = 'player'; // 30-point sudden death cap
  } else if (o >= 30) {
    winner = 'opponent';
  }
  score.matchWinner = winner;

  // Game Point Evaluation (one point away from victory)
  if (winner !== 'none') {
    score.isGamePoint = false;
    score.gamePointHolder = 'none';
  } else {
    const playerNeedsOne = (p >= 20 && p > o) || (p === 29 && o === 29);
    const opponentNeedsOne = (o >= 20 && o > p) || (p === 29 && o === 29);

    if (playerNeedsOne && opponentNeedsOne) {
      score.isGamePoint = true;
      score.gamePointHolder = 'both';
    } else if (playerNeedsOne) {
      score.isGamePoint = true;
      score.gamePointHolder = 'player';
    } else if (opponentNeedsOne) {
      score.isGamePoint = true;
      score.gamePointHolder = 'opponent';
    } else {
      score.isGamePoint = false;
      score.gamePointHolder = 'none';
    }
  }

  return score;
}

export function evaluateMatchPoint(state, pointWinner) {
  if (state.score.matchWinner !== 'none') {
    return state.score;
  }

  const score = state.score;
  if (pointWinner === 'player') {
    score.player++;
    score.server = 'player';
    score.lastPointWinner = 'player';
  } else if (pointWinner === 'opponent') {
    score.opponent++;
    score.server = 'opponent';
    score.lastPointWinner = 'opponent';
  }

  score.totalRallies = (score.totalRallies || 0) + 1;
  updateServiceCourtState(state);

  if (score.matchWinner !== 'none') {
    state.mode = 'match_over';
    if (typeof document !== 'undefined' && document.exitPointerLock) {
      document.exitPointerLock();
    }
    state.pointerLocked = false;
  }

  return score;
}

export function setMatchScore(state, playerScore, opponentScore, server = null) {
  state.score.player = Math.max(0, Math.floor(playerScore));
  state.score.opponent = Math.max(0, Math.floor(opponentScore));
  if (server === 'player' || server === 'opponent') {
    state.score.server = server;
  } else {
    state.score.server = state.score.player >= state.score.opponent ? 'player' : 'opponent';
  }
  state.score.lastPointWinner = state.score.server;

  updateServiceCourtState(state);

  if (state.score.matchWinner !== 'none') {
    state.mode = 'match_over';
    if (typeof document !== 'undefined' && document.exitPointerLock) {
      document.exitPointerLock();
    }
    state.pointerLocked = false;
  } else if (state.mode === 'match_over') {
    state.mode = 'playing';
  }

  return state.score;
}

export function resetMatch(state) {
  const score = state.score;
  score.player = 0;
  score.opponent = 0;
  score.server = 'player';
  score.lastPointWinner = null;
  score.matchWinner = 'none';
  score.isDeuce = false;
  score.isGamePoint = false;
  score.gamePointHolder = 'none';
  score.totalRallies = 0;
  score.maxSmashSpeedKmh = 0;

  updateServiceCourtState(state);

  // Position player & opponent into initial Right Service Courts (0:0 even)
  state.player.pos[0] = 1.15;
  state.player.pos[1] = 0;
  state.player.pos[2] = 3.45;
  state.player.vel = [0, 0, 0];
  state.player.footworkState = 'ready';

  state.opponent.pos[0] = -1.15;
  state.opponent.pos[1] = 0;
  state.opponent.pos[2] = -3.45;
  state.opponent.vel = [0, 0, 0];
  state.opponent.state = state.playMode === 'feeder' ? 'feeder' : 'ready';
  state.opponent.chargingSmash = false;
  state.opponent.intendedShot = 'NONE';

  state.shuttle.inFlight = false;
  state.shuttle.pos = [1.15, 1.55, 3.45];
  state.shuttle.vel = [0, 0, 0];
  state.shuttle.speed = 0;
  state.shuttle.shotType = 'IDLE';

  state.rallyResetTimer = 0.8;
  state.mode = 'playing';

  return state.score;
}

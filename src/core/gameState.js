import { GAME_CONSTANTS } from './constants.js';

export function createGameState() {
  return {
    mode: 'READY', // 'READY' | 'RACING' | 'FINISHED'
    
    // Scoring & Combo
    driftScore: 0,
    yeetScore: 0,
    totalScore: 0,
    combo: 1.0,
    comboTimer: 0,
    isDrifting: false,
    currentDriftDuration: 0,
    longestDriftDuration: 0,
    dangerDriftActive: false,

    // Yeeted stats count
    yeetCounts: {
      human: 0,
      cat: 0,
      shiba: 0,
      cone: 0,
      watermelon: 0,
    },
    totalYeeted: 0,

    // Trash Truck Cargo
    trashBagsRemaining: 30,
    trashBagsLost: 0,

    // Vehicle Telemetry
    speed: 0,              // in units/sec
    speedKmh: 0,           // in km/h display
    driftAngleDeg: 0,
    progress: 0.0,         // 0.0 (summit) to 1.0 (finish)
    roadOffset: 0,         // Lateral distance from track centerline
    altitude: GAME_CONSTANTS.TRACK.SUMMIT_ELEVATION,

    // Time Tracking
    raceStartTime: 0,
    raceFinishTime: 0,
    elapsedRaceTime: 0,

    // Screen Trauma / Juice
    trauma: 0.0,
    hitStopTimer: 0,

    // Evaluation Title
    evaluationTitle: '',
    ratingLetter: 'B',
  };
}

export class GameStateManager {
  constructor() {
    this.state = createGameState();
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange(event, payload) {
    for (const listener of this.listeners) {
      listener(event, payload, this.state);
    }
  }

  startRace() {
    this.state.mode = 'RACING';
    this.state.raceStartTime = performance.now();
    this.emitChange('RACE_STARTED');
  }

  finishRace() {
    if (this.state.mode !== 'RACING') return;
    this.state.mode = 'FINISHED';
    this.state.raceFinishTime = performance.now();
    this.state.elapsedRaceTime = (this.state.raceFinishTime - this.state.raceStartTime) / 1000;
    this.state.totalScore = Math.floor(this.state.driftScore + this.state.yeetScore);

    this.computeEvaluation();
    this.emitChange('RACE_FINISHED', {
      totalScore: this.state.totalScore,
      title: this.state.evaluationTitle,
      rank: this.state.ratingLetter,
    });
  }

  reset() {
    this.state = createGameState();
    this.emitChange('RESET');
  }

  updateDrift(dt, isDrifting, slipAngleRad, speed, isNearEdge) {
    if (this.state.mode !== 'RACING') return;

    this.state.isDrifting = isDrifting;
    this.state.driftAngleDeg = Math.round((Math.abs(slipAngleRad) * 180) / Math.PI);
    this.state.dangerDriftActive = isNearEdge;

    if (isDrifting) {
      this.state.currentDriftDuration += dt;
      if (this.state.currentDriftDuration > this.state.longestDriftDuration) {
        this.state.longestDriftDuration = this.state.currentDriftDuration;
      }

      this.state.comboTimer = GAME_CONSTANTS.DRIFT_SCORING.COMBO_TIMEOUT_SEC;
      this.state.combo = Math.min(
        GAME_CONSTANTS.DRIFT_SCORING.MAX_COMBO,
        this.state.combo + GAME_CONSTANTS.DRIFT_SCORING.COMBO_STEP * dt
      );

      const angleFactor = Math.pow(Math.abs(slipAngleRad), GAME_CONSTANTS.DRIFT_SCORING.ANGLE_EXPONENT);
      const edgeFactor = isNearEdge ? GAME_CONSTANTS.DRIFT_SCORING.EDGE_BONUS_MULTIPLIER : 1.0;
      const points = GAME_CONSTANTS.DRIFT_SCORING.BASE_POINTS_PER_SEC * (speed / 30) * angleFactor * edgeFactor * this.state.combo * dt;

      this.state.driftScore += points;
      this.state.totalScore = Math.floor(this.state.driftScore + this.state.yeetScore);

      this.emitChange('DRIFT_TICK', { points, combo: this.state.combo });
    } else {
      this.state.currentDriftDuration = 0;
      if (this.state.comboTimer > 0) {
        this.state.comboTimer -= dt;
        if (this.state.comboTimer <= 0) {
          this.state.combo = 1.0;
          this.emitChange('COMBO_LOST');
        }
      }
    }
  }

  recordYeet(obstacleType, impactImpulse) {
    if (this.state.mode !== 'RACING') return;

    const obstacleDef = GAME_CONSTANTS.OBSTACLES.TYPES[obstacleType.toUpperCase()] || {
      id: obstacleType,
      name: '障礙物',
      baseScore: 200,
      launchImpulse: 15,
      text: 'YEET! +200',
    };

    const impulseBonusMultiplier = Math.max(1.0, impactImpulse / obstacleDef.launchImpulse);
    const scoreAdd = Math.floor(obstacleDef.baseScore * impulseBonusMultiplier * this.state.combo);

    this.state.yeetScore += scoreAdd;
    this.state.totalScore = Math.floor(this.state.driftScore + this.state.yeetScore);
    if (this.state.yeetCounts[obstacleDef.id] !== undefined) {
      this.state.yeetCounts[obstacleDef.id]++;
    }
    this.state.totalYeeted++;

    this.addTrauma(0.45);
    this.state.hitStopTimer = (GAME_CONSTANTS.JUICE.HIT_STOP_DURATION_MS || 0) / 1000;

    this.emitChange('YEET_EVENT', {
      type: obstacleDef.id,
      name: obstacleDef.name,
      score: scoreAdd,
      text: obstacleDef.text,
      combo: this.state.combo,
    });
  }

  addTrauma(amount) {
    this.state.trauma = Math.min(GAME_CONSTANTS.JUICE.MAX_TRAUMA, this.state.trauma + amount);
  }

  updateTrauma(dt) {
    if (this.state.trauma > 0) {
      this.state.trauma = Math.max(0, this.state.trauma - GAME_CONSTANTS.JUICE.TRAUMA_DECAY * dt);
    }
  }

  updateHitStop(dt) {
    if (this.state.hitStopTimer > 0) {
      this.state.hitStopTimer = Math.max(0, this.state.hitStopTimer - dt);
    }
  }

  isHitStopped() {
    return this.state.hitStopTimer > 0;
  }

  computeEvaluation() {
    const s = this.state.totalScore;
    const cats = this.state.yeetCounts.cat;
    const humans = this.state.yeetCounts.human;
    const remaining = this.state.trashBagsRemaining;
    const lost = this.state.trashBagsLost;

    if (cats >= 5) {
      this.state.evaluationTitle = '🐱 貓咪太空總署署長';
      this.state.ratingLetter = 'SSS';
    } else if (humans >= 10 && s > 25000) {
      this.state.evaluationTitle = '🎳 秋名山保齡球球王';
      this.state.ratingLetter = 'SS';
    } else if (remaining >= 25 && s > 20000) {
      this.state.evaluationTitle = '🚛 環保局王牌駕駛·秋名山清潔隊長';
      this.state.ratingLetter = 'SSS';
    } else if (lost >= 15) {
      this.state.evaluationTitle = '💥 沿路天女散花隊員';
      this.state.ratingLetter = 'B';
    } else if (s > 20000) {
      this.state.evaluationTitle = '💨 給愛麗絲狂飆清運手';
      this.state.ratingLetter = 'S';
    } else if (s > 12000) {
      this.state.evaluationTitle = '🚛 熟練的清潔隊老司機';
      this.state.ratingLetter = 'A';
    } else if (s > 6000) {
      this.state.evaluationTitle = '🚙 悠閒的下坡收運工';
      this.state.ratingLetter = 'B';
    } else {
      this.state.evaluationTitle = '🔰 護欄親善大使 (垃圾袋噴光了)';
      this.state.ratingLetter = 'C';
    }
  }
}

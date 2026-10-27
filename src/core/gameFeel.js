/**
 * Game Feel Pipeline (Milestone 4)
 * Follows patterns from `game-feel` & `camera-systems`:
 * - Hit-Stop micro-freeze on powerful impacts (40ms on SMASH, 16ms on sweet-spot DRIVE)
 * - Dynamic Camera FOV Punch (80° -> 74° on SMASH, exponential recovery back to 80°)
 * - Trauma-based Camera Shake: Shake = Trauma^2, high-frequency deterministic offsets
 */

/**
 * Triggers game feel sensations upon player racket strike.
 * @param {Object} state - Core game state
 * @param {string} shotType - SMASH | CLEAR | ATTACKING_CLEAR | DROP | DRIVE | NET_SHOT | LIFT
 * @param {string} quality - 'sweet_spot' | 'good' | 'late'
 * @param {number} speedKmh - Exit speed in km/h
 */
export function triggerImpactGameFeel(state, shotType, quality = 'good', speedKmh = 120) {
  if (!state.effects) return;

  const isSweet = quality === 'sweet_spot';

  if (shotType === 'SMASH') {
    // 40ms Hit-Stop (~2.5 frames at 60Hz)
    state.effects.hitStopRemainingMs = 40;
    // FOV punch down to 74.0°
    state.effects.fov = 74.0;
    // High trauma on SMASH (Shake = 0.95^2 ≈ 0.90)
    state.effects.trauma = 0.95;
    state.effects.shockwaveColor = '#FF3D00';
  } else if (shotType === 'DRIVE' || shotType === 'ATTACKING_CLEAR') {
    state.effects.hitStopRemainingMs = isSweet ? 16 : 0;
    state.effects.fov = 77.5;
    state.effects.trauma = Math.min(1.0, (state.effects.trauma || 0) + (isSweet ? 0.65 : 0.45));
    state.effects.shockwaveColor = isSweet ? '#00E676' : '#FF9100';
  } else if (shotType === 'CLEAR' || shotType === 'LIFT') {
    state.effects.hitStopRemainingMs = 0;
    state.effects.fov = 78.5;
    state.effects.trauma = Math.min(1.0, (state.effects.trauma || 0) + (isSweet ? 0.50 : 0.35));
    state.effects.shockwaveColor = isSweet ? '#00E676' : '#00E5FF';
  } else {
    // DROP or NET_SHOT (delicate touch)
    state.effects.hitStopRemainingMs = 0;
    state.effects.fov = 79.5;
    state.effects.trauma = Math.min(1.0, (state.effects.trauma || 0) + 0.15);
    state.effects.shockwaveColor = isSweet ? '#00E676' : '#76FF03';
  }

  // Set shockwave state
  state.effects.shockwaveActive = true;
  state.effects.shockwaveScale = 1.0;
  state.effects.shockwaveAlpha = 1.0;
  if (state.shuttle && Array.isArray(state.shuttle.pos)) {
    state.effects.shockwavePos = [...state.shuttle.pos];
  }

  // Pre-calculate initial shake intensity
  const trauma = state.effects.trauma || 0;
  state.effects.cameraShake = Math.round(trauma * trauma * 1000) / 1000;
}

/**
 * Updates Game Feel effects each frame:
 * - Decrements Hit-Stop remaining duration
 * - Decays trauma (Trauma -= 2.8 * dt) and updates cameraShake = Trauma^2
 * - Calculates high-frequency 3D camera shake offsets and roll
 * - Smoothly recovers FOV toward targetFov (80.0°) using exponential recovery
 * @param {Object} state - Core game state
 * @param {number} dt - Frame delta time in seconds
 */
export function updateGameFeel(state, dt) {
  if (!state.effects) return;

  // 1. Decrement Hit-Stop timer (if active)
  if (state.effects.hitStopRemainingMs > 0) {
    state.effects.hitStopRemainingMs = Math.max(0, state.effects.hitStopRemainingMs - dt * 1000);
  }

  // 2. Trauma decay & Camera Shake calculation (Shake = Trauma^2)
  if (state.effects.trauma > 0) {
    state.effects.trauma = Math.max(0, state.effects.trauma - 2.8 * dt);
    const trauma = state.effects.trauma;
    state.effects.cameraShake = Math.round(trauma * trauma * 1000) / 1000;
  } else {
    state.effects.trauma = 0;
    state.effects.cameraShake = 0;
  }

  // 3. High-frequency 3D camera shake displacement & roll
  const shake = state.effects.cameraShake || 0;
  if (shake > 0.001) {
    const t = state.elapsedTime * 48.0; // High frequency ~48 rad/s
    const maxOffset = 0.045; // 4.5 cm maximum position displacement
    const maxRoll = 0.024;   // ~1.37 degrees maximum roll

    const offsetX = Math.sin(t * 1.31) * maxOffset * shake;
    const offsetY = Math.cos(t * 1.73) * maxOffset * shake;
    const offsetZ = Math.sin(t * 2.19) * (maxOffset * 0.4) * shake;
    const roll = Math.sin(t * 1.57) * maxRoll * shake;

    state.effects.shakeOffset = [offsetX, offsetY, offsetZ];
    state.effects.shakeRoll = roll;
  } else {
    state.effects.shakeOffset = [0, 0, 0];
    state.effects.shakeRoll = 0;
  }

  // 4. Smooth FOV recovery toward targetFov (80.0°)
  const targetFov = state.effects.targetFov || 80.0;
  const currFov = state.effects.fov || targetFov;
  if (Math.abs(currFov - targetFov) > 0.02) {
    // Frame-rate independent exponential recovery (`camera-systems` pattern)
    const recoveryFactor = 1.0 - Math.exp(-9.5 * dt);
    state.effects.fov = currFov + (targetFov - currFov) * recoveryFactor;
  } else {
    state.effects.fov = targetFov;
  }
}

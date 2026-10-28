import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

/**
 * Arcade Downhill Drift Car Physics Model
 * Fixed timestep, responsive single-hand control, intuitive power slide dynamics.
 */
export class VehiclePhysics {
  constructor(trackSpline) {
    this.track = trackSpline;

    // Transform State
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);       // Body heading
    this.travelForward = new THREE.Vector3(0, 0, 1); // Velocity / travel direction
    this.right = new THREE.Vector3(-1, 0, 0);        // Screen-right
    this.up = new THREE.Vector3(0, 1, 0);
    this.bodyQuaternion = new THREE.Quaternion();

    // Orientation & Angles
    this.travelYaw = 0;        // Velocity heading around Y
    this.bodyYaw = 0;          // Vehicle body heading around Y
    this.yaw = 0;              // Current heading angle (= bodyYaw for compatibility)
    this.angularVelocity = 0;
    this.steerYawRate = 0;     // Damped yaw rate from joystick input
    this.roll = 0;             // Body lean into corners
    this.pitch = 0;            // Road slope incline (positive = nose up, negative = downhill)

    // Drift Dynamics (Stanford DDL / Arcade equilibrium model)
    this.beta = 0;             // Sideslip angle (radians)
    this.betaVel = 0;          // Sideslip angular velocity for spring-damper
    this.slipAngle = 0;        // Radians (= beta, used by scoring & audio)
    this.maxSlipAngle = 0;     // Max slip angle recorded during run
    this.isDrifting = false;
    this.isNearEdge = false;

    // Telemetry & Track Positioning
    this.progressU = 0.002;
    this.lateralOffset = 0;
    this.speed = 0;
    this.wallHits = 0;         // Wall collision counter

    // Trash Cargo State
    this.trashBagsRemaining = 30; // 30 bags initially
    this.trashBagsLost = 0;
    this.trashEjectTimer = 0;
    this.onTrashBagEjected = null; // Callback for rendering/particle effects

    // Controls
    this.targetSteer = 0;
    this.steerInput = 0;       // -1 (Left) to +1 (Right)
    this.throttleInput = 0;    // -1 (Brake) to +1 (Boost)

    // Boundaries & Feel (keep angled truck body & wheels cleanly inside the guardrail)
    this.guardRailLimit = GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET - 1.55;
    this.bumpCooldown = 0;

    this.resetToStart();
  }

  resetToStart() {
    this.progressU = 0.002;
    this.lateralOffset = 0;
    this.speed = 0;
    this.velocity.set(0, 0, 0);

    this.steerYawRate = 0;
    this.targetSteer = 0;
    this.steerInput = 0;
    this.throttleInput = 0;

    this.beta = 0;
    this.betaVel = 0;
    this.slipAngle = 0;
    this.maxSlipAngle = 0;
    this.isDrifting = false;
    this.isNearEdge = false;
    this.wallHits = 0;
    this.trashBagsRemaining = 30;
    this.trashBagsLost = 0;
    this.trashEjectTimer = 0;
    this.roll = 0;
    this.pitch = 0;

    // Position at summit start
    const startPos = this.track.getPointAt(this.progressU);
    const startTangent = this.track.getTangentAt(this.progressU);
    const startNormal = this.track.getNormalAt(this.progressU);
    const startYaw = Math.atan2(startTangent.x, startTangent.z);

    this.travelYaw = startYaw;
    this.bodyYaw = startYaw;
    this.yaw = startYaw;

    this.position.copy(startPos);
    this.travelForward.set(Math.sin(startYaw), 0, Math.cos(startYaw)).normalize();

    this.updateOrientation(startTangent, startNormal, 0.016);
  }

  setInput(steer, throttle) {
    // Steer convention: -1 = Left (screen left), +1 = Right (screen right)
    this.targetSteer = THREE.MathUtils.clamp(steer, -1, 1);
    this.throttleInput = THREE.MathUtils.clamp(throttle, -1, 1);
  }

  /**
   * Fixed Timestep Update (dt = 1/60 typical)
   */
  update(dt, gsm) {
    const state = gsm.state || gsm;
    if (state.mode !== 'RACING') {
      if (state.mode === 'FINISHED') {
        // Slow down smoothly after crossing line
        this.speed = Math.max(0, this.speed - 15 * dt);
        this.velocity.copy(this.forward).multiplyScalar(this.speed);
        this.position.addScaledVector(this.velocity, dt);

        const proj = this.track.projectPoint(this.position, this.progressU, 0.05);
        this.updateOrientation(proj.tangent, proj.normal, dt);
      }
      return;
    }

    if (this.bumpCooldown > 0) {
      this.bumpCooldown -= dt;
    }

    // Smooth steering input interpolation
    this.steerInput = THREE.MathUtils.lerp(this.steerInput, this.targetSteer, Math.min(1.0, 10.0 * dt));

    // 1. Spline projection & track slope
    const proj = this.track.projectPoint(this.position, this.progressU, 0.05);
    this.progressU = Math.max(this.progressU, proj.u);
    const tangent = proj.tangent;
    const normal = proj.normal; // Points to Road Right (-1, 0, 0 when tangent is 0, 0, 1)

    // 2. Downhill Gravity and Forward Drive
    // Spline Y slope gradient provides gentle natural downhill gravity acceleration
    const slopeGravity = Math.max(0.05, -tangent.y) * 10.5;
    let targetForwardAccel = GAME_CONSTANTS.VEHICLE.BASE_ACCELERATION + slopeGravity;

    // Up/Down joystick modulation
    let maxSpeed = GAME_CONSTANTS.VEHICLE.MAX_SPEED;
    if (this.throttleInput > 0.1) {
      // Boost
      targetForwardAccel += this.throttleInput * 12.0;
      maxSpeed = GAME_CONSTANTS.VEHICLE.BOOST_SPEED;
    } else if (this.throttleInput < -0.1) {
      // Brake
      targetForwardAccel += this.throttleInput * GAME_CONSTANTS.VEHICLE.BRAKE_FORCE;
    }

    // Accelerate speed along current motion
    this.speed = THREE.MathUtils.clamp(
      this.speed + targetForwardAccel * dt,
      GAME_CONSTANTS.VEHICLE.MIN_SPEED,
      maxSpeed
    );

    // 3. Smooth Cornering & Steering Dynamics
    // A. Curvature feed-forward: sample road tangent ahead to auto-follow ~80% of curve
    const deltaU = 0.008;
    const uAhead = Math.min(0.999, this.progressU + deltaU);
    const tangentAhead = this.track.getTangentAt(uAhead);
    const currentTrackYaw = Math.atan2(tangent.x, tangent.z);
    const aheadTrackYaw = Math.atan2(tangentAhead.x, tangentAhead.z);
    let dTrackYaw = aheadTrackYaw - currentTrackYaw;
    while (dTrackYaw > Math.PI) dTrackYaw -= Math.PI * 2;
    while (dTrackYaw < -Math.PI) dTrackYaw += Math.PI * 2;

    const distAhead = Math.max(1.0, (uAhead - this.progressU) * this.track.totalLength);
    const roadCurvature = dTrackYaw / distAhead;
    const roadYawRate = roadCurvature * this.speed;
    const feedforwardYawRate = roadYawRate * 0.92; // 92% road curve auto-follow for dense switchbacks

    // B. Drift detection
    const steerDeflection = Math.abs(this.steerInput);
    const wantsDrift = steerDeflection > GAME_CONSTANTS.VEHICLE.DRIFT_STICK_THRESHOLD;
    if (wantsDrift && this.speed > 10.0) {
      this.isDrifting = true;
    } else if (steerDeflection < 0.20 || this.speed < 8.0) {
      this.isDrifting = false;
    }

    // C. Joystick target extra yaw rate (max ~1.0 rad/s, reduced at high speed)
    // Note Three.js coordinate sign: steer +1 (right) -> negative yaw rate (turns toward -X, screen right)
    const maxJoyYawRate = 1.0;
    const speedDamping = THREE.MathUtils.clamp(
      1.0 - (this.speed - GAME_CONSTANTS.VEHICLE.MIN_SPEED) / (GAME_CONSTANTS.VEHICLE.MAX_SPEED * 2.2),
      0.65,
      1.0
    );
    let targetExtraYawRate = -this.steerInput * maxJoyYawRate * speedDamping;
    if (this.isDrifting) {
      // While drifting, travel path turns tighter
      targetExtraYawRate *= 1.25;
      // Slight speed bleed during drift (~2%/s)
      this.speed *= (1.0 - 0.02 * dt);
    }

    // Exponential smoothing for yaw rate (k ≈ 6)
    this.steerYawRate = THREE.MathUtils.lerp(
      this.steerYawRate,
      targetExtraYawRate,
      1.0 - Math.exp(-6.0 * dt)
    );

    // D. Soft wall avoidance: gentle corrective yaw rate when near guardrail
    let correctiveYawRate = 0;
    const softWallDist = Math.max(1.0, this.guardRailLimit - 3.0);
    if (this.lateralOffset > softWallDist) {
      // Car is towards right guardrail (+offset, screen right, negative yaw)
      let relHeading = this.travelYaw - currentTrackYaw;
      while (relHeading > Math.PI) relHeading -= Math.PI * 2;
      while (relHeading < -Math.PI) relHeading += Math.PI * 2;
      if (relHeading < 0) {
        const severity = (this.lateralOffset - softWallDist) / 3.0;
        correctiveYawRate += THREE.MathUtils.clamp(severity, 0, 1.2) * 1.0;
      }
    } else if (this.lateralOffset < -softWallDist) {
      // Car is towards left guardrail (-offset, screen left, positive yaw)
      let relHeading = this.travelYaw - currentTrackYaw;
      while (relHeading > Math.PI) relHeading -= Math.PI * 2;
      while (relHeading < -Math.PI) relHeading += Math.PI * 2;
      if (relHeading > 0) {
        const severity = (-this.lateralOffset - softWallDist) / 3.0;
        correctiveYawRate -= THREE.MathUtils.clamp(severity, 0, 1.2) * 1.0;
      }
    }

    // E. Total Travel Yaw Integration
    const totalTravelYawRate = feedforwardYawRate + this.steerYawRate + correctiveYawRate;
    this.travelYaw += totalTravelYawRate * dt;

    // F. Heading relative to road clamped to ±50°
    let relTravel = this.travelYaw - currentTrackYaw;
    while (relTravel > Math.PI) relTravel -= Math.PI * 2;
    while (relTravel < -Math.PI) relTravel += Math.PI * 2;
    const maxRel = (50.0 * Math.PI) / 180.0;
    if (relTravel > maxRel) {
      this.travelYaw = currentTrackYaw + maxRel;
    } else if (relTravel < -maxRel) {
      this.travelYaw = currentTrackYaw - maxRel;
    }

    // 4. Drift Sideslip β (Spring-Damper: ζ ≈ 0.55, ω ≈ 7.0 rad/s)
    let targetBeta = 0;
    if (this.isDrifting) {
      const stickDepth = THREE.MathUtils.clamp(
        (steerDeflection - GAME_CONSTANTS.VEHICLE.DRIFT_STICK_THRESHOLD) /
          (1.0 - GAME_CONSTANTS.VEHICLE.DRIFT_STICK_THRESHOLD),
        0,
        1
      );
      const betaMag = THREE.MathUtils.lerp(
        (20.0 * Math.PI) / 180.0,
        (40.0 * Math.PI) / 180.0,
        stickDepth
      );
      // Nose points into turn: steer > 0 (right) -> negative yaw -> targetBeta is negative
      targetBeta = -Math.sign(this.steerInput) * betaMag;
    }

    const omega = 7.0;
    const zeta = 0.55;
    const betaAccel = (omega * omega) * (targetBeta - this.beta) - (2.0 * zeta * omega) * this.betaVel;
    this.betaVel += betaAccel * dt;
    this.beta += this.betaVel * dt;

    this.slipAngle = this.beta;
    this.maxSlipAngle = Math.max(this.maxSlipAngle, Math.abs(this.beta));
    this.bodyYaw = this.travelYaw + this.beta;
    this.yaw = this.bodyYaw;

    // 4b. Trash Bag Ejection on Drift / Hard Cornering (Centrifugal Fly-out)
    const isHardTurning = Math.abs(this.steerYawRate) > 0.38 || Math.abs(this.slipAngle) > 0.22;
    if ((this.isDrifting || isHardTurning) && this.speed > 10.0 && this.trashBagsRemaining > 0) {
      const driftIntensity = THREE.MathUtils.clamp(
        Math.max(
          Math.abs(this.slipAngle) / 0.5,
          Math.abs(this.steerYawRate) / 0.7,
          (this.speed - 10.0) / 19.5
        ),
        0,
        1
      );
      // Intensity-based drop interval: ~0.35s to 0.65s (higher intensity = faster loss)
      const dropInterval = THREE.MathUtils.lerp(0.65, 0.35, driftIntensity);
      this.trashEjectTimer += dt;
      if (this.trashEjectTimer >= dropInterval) {
        this.trashEjectTimer = 0;
        this.trashBagsRemaining--;
        this.trashBagsLost++;

        if (this.onTrashBagEjected) {
          // Centrifugal throw outward from turn
          const outwardSign = Math.sign(this.steerInput) || (this.slipAngle > 0 ? 1 : -1);
          this.onTrashBagEjected({
            remaining: this.trashBagsRemaining,
            lost: this.trashBagsLost,
            outwardSign,
          });
        }
      }
    } else {
      this.trashEjectTimer = Math.max(0, this.trashEjectTimer - dt * 0.5);
    }

    // 5. Velocity and Position Integration
    this.travelForward.set(Math.sin(this.travelYaw), 0, Math.cos(this.travelYaw)).normalize();

    const motionDir = new THREE.Vector3(
      this.travelForward.x,
      tangent.y,
      this.travelForward.z
    ).normalize();

    this.velocity.copy(motionDir).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);

    // Frame-rate independent Y-snap to road surface (offset 0.05 so wheels touch road)
    const roadSurfacePos = this.track.getWorldPosition(this.progressU, proj.roadOffset);
    const ySnapFactor = 1.0 - Math.exp(-20.0 * dt);
    this.position.y = THREE.MathUtils.lerp(this.position.y, roadSurfacePos.y + 0.05, ySnapFactor);

    // 6. Guardrail Collision and Edge Detection
    this.lateralOffset = proj.roadOffset;
    this.isNearEdge =
      Math.abs(this.lateralOffset) >
      this.guardRailLimit - GAME_CONSTANTS.DRIFT_SCORING.EDGE_PROXIMITY_THRESHOLD;

    if (Math.abs(this.lateralOffset) > this.guardRailLimit) {
      // Reached guardrail! Slide along wall
      const pushSign = Math.sign(this.lateralOffset);
      const penetration = Math.abs(this.lateralOffset) - this.guardRailLimit;
      this.position.addScaledVector(normal, -pushSign * penetration);

      // Remove velocity component into wall
      const velNormal = this.velocity.dot(normal);
      if (pushSign * velNormal > 0) {
        this.velocity.addScaledVector(normal, -velNormal);
      }
      // Slide along wall without speed reduction
      this.travelYaw = currentTrackYaw;

      if (this.bumpCooldown <= 0) {
        this.bumpCooldown = 0.35;
        this.wallHits++;
        if (gsm.addTrauma) gsm.addTrauma(0.3);
        else if (state.trauma !== undefined) state.trauma = Math.min(1.0, state.trauma + 0.3);
      }
    }

    // 7. Orientation & Body Quaternion
    this.updateOrientation(tangent, normal, dt);

    // 8. Check Finish Line
    if (this.progressU >= 0.96) {
      if (gsm.finishRace) gsm.finishRace();
      else state.mode = 'FINISHED';
    }
  }

  /**
   * Compute full 3D body orientation from road plane, body heading, and roll
   */
  updateOrientation(tangent, normal, dt) {
    // Body roll lean (centrifugal lean into drift / corner)
    const targetRoll = -this.steerInput * (this.isDrifting ? 0.10 : 0.04);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, 1.0 - Math.exp(-10.0 * dt));

    // Road surface normal pointing UP perpendicular to track
    const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    // Body heading vector projected onto road plane
    const fwdH = new THREE.Vector3(Math.sin(this.bodyYaw), 0, Math.cos(this.bodyYaw)).normalize();
    const bodyFwd = new THREE.Vector3()
      .copy(fwdH)
      .addScaledVector(roadUp, -fwdH.dot(roadUp))
      .normalize();

    let bodyRight = new THREE.Vector3().crossVectors(bodyFwd, roadUp).normalize();
    let bodyUp = new THREE.Vector3().crossVectors(bodyRight, bodyFwd).normalize();

    // Apply roll around bodyFwd
    if (Math.abs(this.roll) > 0.0001) {
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(bodyFwd, this.roll);
      bodyRight.applyQuaternion(rollQuat);
      bodyUp.applyQuaternion(rollQuat);
    }

    this.forward.copy(bodyFwd);
    this.right.copy(bodyRight);
    this.up.copy(bodyUp);

    // Pitch angle: positive = nose up, negative = nose down (downhill)
    this.pitch = Math.asin(bodyFwd.y);

    // Build body quaternion: local +Z = bodyFwd, local +Y = bodyUp, local +X = cross(bodyUp, bodyFwd)
    const localX = new THREE.Vector3().crossVectors(bodyUp, bodyFwd).normalize();
    const rotMatrix = new THREE.Matrix4().makeBasis(localX, bodyUp, bodyFwd);
    this.bodyQuaternion.setFromRotationMatrix(rotMatrix);
  }
}

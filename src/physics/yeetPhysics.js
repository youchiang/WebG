import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

export class YeetPhysics {
  constructor(trackSpline) {
    this.track = trackSpline;
    this.obstacles = [];
    this.activeYeets = [];

    this.spawnObstaclesAlongTrack();
  }

  spawnObstaclesAlongTrack() {
    this.obstacles = [];
    const types = ['human', 'cat', 'shiba', 'cone', 'watermelon'];

    // Spawn obstacles along both sides of track at corners and straights
    for (let u = 0.025; u <= 0.95; u += 0.012) {
      [-1, 1].forEach((side) => {
        const typeIndex = Math.floor(Math.abs(Math.sin(u * 88.8 + side * 12.3)) * types.length);
        const typeKey = types[typeIndex];
        const def = GAME_CONSTANTS.OBSTACLES.TYPES[typeKey.toUpperCase()];

        const isWanderer = (typeKey === 'human' || typeKey === 'cat' || typeKey === 'shiba');

        // Wanderers pace back and forth across the road (-4.8 to +4.8)!
        // Static cones/watermelons sit beside the road
        const offset = isWanderer
          ? ((Math.sin(u * 43.1 + side * 17.5) * 4.8))
          : side * (GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET - 1.2);

        const pos = this.track.getWorldPosition(u, offset, 0.4);

        // Wander speed: humans stroll ~1.4m/s, cats dart ~2.2m/s, shibas trot ~2.6m/s
        let wanderSpeed = 0;
        if (typeKey === 'human') wanderSpeed = 1.2 + Math.random() * 0.8;
        else if (typeKey === 'cat') wanderSpeed = 1.8 + Math.random() * 1.0;
        else if (typeKey === 'shiba') wanderSpeed = 2.0 + Math.random() * 1.2;

        this.obstacles.push({
          id: `obs_${this.obstacles.length}`,
          type: typeKey,
          def,
          u,
          offset,
          isWanderer,
          wanderDir: side, // +1 or -1 along road normal
          wanderSpeed,
          minOffset: -GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET + 1.2,
          maxOffset: GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET - 1.2,
          animTime: Math.random() * 10,
          initialPos: pos.clone(),
          initialOffset: offset,
          position: pos.clone(),
          rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
          scale: new THREE.Vector3(1, 1, 1),
          isYeeted: false,
          radius: def.radius,
        });
      });
    }
  }

  reset() {
    for (const obs of this.obstacles) {
      obs.isYeeted = false;
      obs.offset = obs.initialOffset !== undefined ? obs.initialOffset : obs.offset;
      obs.position.copy(obs.initialPos);
      obs.rotation.set(0, Math.random() * Math.PI * 2, 0);
    }
    this.activeYeets = [];
  }

  /**
   * Check collision with car and simulate airborne yeeted bodies
   */
  update(dt, vehiclePhysics, gameState, onYeetCallback) {
    // 0. Update wandering humans and animals pacing back and forth across the road!
    for (const obs of this.obstacles) {
      if (obs.isYeeted) continue;
      if (obs.isWanderer) {
        obs.animTime += dt;
        obs.offset += obs.wanderDir * obs.wanderSpeed * dt;

        // Bounce back when reaching road edges/guardrails
        if (obs.offset >= obs.maxOffset) {
          obs.offset = obs.maxOffset;
          obs.wanderDir = -1;
        } else if (obs.offset <= obs.minOffset) {
          obs.offset = obs.minOffset;
          obs.wanderDir = 1;
        }

        // Update world position on road surface
        const newPos = this.track.getWorldPosition(obs.u, obs.offset, 0.4);
        obs.position.copy(newPos);

        // Rotate to face walking direction (along normal * wanderDir)
        const normal = this.track.getNormalAt(obs.u);
        const walkHeading = normal.clone().multiplyScalar(obs.wanderDir);
        obs.rotation.y = Math.atan2(walkHeading.x, walkHeading.z);
      }
    }

    // 1. Check collisions with active non-yeeted obstacles near car
    const carPos = vehiclePhysics.position;
    const carU = vehiclePhysics.progressU;

    for (const obs of this.obstacles) {
      if (obs.isYeeted) continue;

      // Only check obstacles within progress window
      if (Math.abs(obs.u - carU) > 0.03) continue;

      const dist = carPos.distanceTo(obs.position);
      const hitThreshold = 1.8 + obs.radius; // car half-width + obstacle radius

      if (dist < hitThreshold) {
        // HIT! Launch obstacle!
        obs.isYeeted = true;

        // Calculate impact velocity based on car speed and drift whip
        const carVel = vehiclePhysics.velocity;
        const driftMultiplier = vehiclePhysics.isDrifting ? 1.8 : 1.0;
        const speedRatio = Math.max(0.5, vehiclePhysics.speed / 28);

        // Direction: upward + outward + along car momentum
        const launchDir = new THREE.Vector3()
          .copy(carVel)
          .normalize()
          .multiplyScalar(0.4)
          .add(new THREE.Vector3(0, 1.2, 0)) // Strong upward yeet!
          .addScaledVector(vehiclePhysics.right, Math.sign(obs.offset) * 0.7)
          .normalize();

        const impulseMagnitude = obs.def.launchImpulse * driftMultiplier * speedRatio;
        const launchVelocity = launchDir.multiplyScalar(impulseMagnitude);

        const yeetRecord = {
          obstacle: obs,
          velocity: launchVelocity,
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 35,
            (Math.random() - 0.5) * 20
          ),
          lifetime: 3.5, // seconds before despawn
        };

        this.activeYeets.push(yeetRecord);

        // Notify state & audio
        if (gameState.recordYeet) {
          gameState.recordYeet(obs.type, impulseMagnitude);
        }
        if (onYeetCallback) {
          onYeetCallback(obs, impulseMagnitude, obs.position.clone());
        }
      }
    }

    // 2. Simulate active flying yeets with gravity
    const gravity = -38;
    for (let i = this.activeYeets.length - 1; i >= 0; i--) {
      const y = this.activeYeets[i];
      y.lifetime -= dt;

      // Integrate parabolic trajectory
      y.velocity.y += gravity * dt;
      y.obstacle.position.addScaledVector(y.velocity, dt);

      // Comical high-speed tumbling
      y.obstacle.rotation.x += y.spin.x * dt;
      y.obstacle.rotation.y += y.spin.y * dt;
      y.obstacle.rotation.z += y.spin.z * dt;

      if (y.lifetime <= 0) {
        // Hide far away
        y.obstacle.position.set(0, -999, 0);
        this.activeYeets.splice(i, 1);
      }
    }
  }
}

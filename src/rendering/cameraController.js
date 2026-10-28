import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.targetPos = new THREE.Vector3();
    this.currentCamPos = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    // Camera Rig offsets
    this.followDistance = 7.5;
    this.followHeight = 3.6;
    this.lookAhead = 3.5;

    // Trauma state
    this.noiseTime = 0;
  }

  reset(vehiclePhysics) {
    const travelForward = vehiclePhysics.travelForward || vehiclePhysics.forward;
    const behindPos = new THREE.Vector3()
      .copy(vehiclePhysics.position)
      .addScaledVector(travelForward, -this.followDistance)
      .add(new THREE.Vector3(0, this.followHeight, 0));

    this.currentCamPos.copy(behindPos);
    this.currentLookAt.copy(vehiclePhysics.position).addScaledVector(travelForward, this.lookAhead);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  update(dt, vehiclePhysics, gameState) {
    // 1. Calculate desired camera position behind the car along travelForward
    const carPos = vehiclePhysics.position;
    const travelForward = vehiclePhysics.travelForward || vehiclePhysics.forward;
    const carRight = vehiclePhysics.right;

    // Subtle lateral swing during drift to show car sideways slide
    const driftSwing = vehiclePhysics.isDrifting ? -vehiclePhysics.steerInput * 0.35 : 0;

    const desiredCamPos = new THREE.Vector3()
      .copy(carPos)
      .addScaledVector(travelForward, -this.followDistance)
      .addScaledVector(carRight, driftSwing)
      .add(new THREE.Vector3(0, this.followHeight, 0));

    const desiredLookAt = new THREE.Vector3()
      .copy(carPos)
      .addScaledVector(travelForward, this.lookAhead)
      .add(new THREE.Vector3(0, 1.0, 0));

    // 2. Smooth Damping (Lerp)
    const posLerpFactor = 1.0 - Math.exp(-9.0 * dt);
    const lookLerpFactor = 1.0 - Math.exp(-12.0 * dt);

    this.currentCamPos.lerp(desiredCamPos, posLerpFactor);
    this.currentLookAt.lerp(desiredLookAt, lookLerpFactor);

    // 3. Dynamic FOV
    const speedRatio = THREE.MathUtils.clamp((vehiclePhysics.speed - 15) / 35, 0, 1);
    const targetFOV = 62 + speedRatio * 10; // 62 to 72 deg
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
    this.camera.updateProjectionMatrix();

    // 4. Apply Screen Shake Trauma (Game Feel)
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeRoll = 0;

    if (gameState.trauma > 0.001) {
      this.noiseTime += dt * 32.0;
      const shake = gameState.trauma * gameState.trauma; // quadratic
      shakeOffsetX = GAME_CONSTANTS.JUICE.MAX_SHAKE_OFFSET * shake * Math.sin(this.noiseTime * 1.7);
      shakeOffsetY = GAME_CONSTANTS.JUICE.MAX_SHAKE_OFFSET * shake * Math.cos(this.noiseTime * 2.3);
      shakeRoll = GAME_CONSTANTS.JUICE.MAX_SHAKE_ROLL * shake * Math.sin(this.noiseTime * 1.1);
    }

    // Apply to camera transform
    this.camera.position.set(
      this.currentCamPos.x + shakeOffsetX,
      this.currentCamPos.y + shakeOffsetY,
      this.currentCamPos.z
    );

    this.camera.lookAt(this.currentLookAt);

    // Subtle Dutch Angle during drift + shake roll
    const driftDutch = vehiclePhysics.isDrifting ? -vehiclePhysics.steerInput * 0.02 : 0;
    this.camera.rotation.z += driftDutch + shakeRoll;
  }
}

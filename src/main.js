import * as THREE from 'three';
import { GameStateManager } from './core/gameState.js';
import { audioEngine } from './core/audioEngine.js';
import { TrackSpline } from './physics/trackSpline.js';
import { VehiclePhysics } from './physics/vehiclePhysics.js';
import { YeetPhysics } from './physics/yeetPhysics.js';
import { SceneManager } from './rendering/sceneManager.js';
import { TrackRenderer } from './rendering/trackRenderer.js';
import { VehicleMesh } from './rendering/vehicleMesh.js';
import { ObstacleEntities } from './rendering/obstacleEntities.js';
import { ParticleSystem } from './rendering/particleSystem.js';
import { CameraController } from './rendering/cameraController.js';
import { TouchJoystick } from './input/touchJoystick.js';
import { HudOverlay } from './ui/hudOverlay.js';

class DriftDownhillApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.gsm = new GameStateManager();

    // 1. Rendering Scene & Camera
    this.sceneManager = new SceneManager(this.canvas);
    this.cameraController = new CameraController(this.sceneManager.camera);

    // 2. Physics & Spline
    this.trackSpline = new TrackSpline();
    this.vehiclePhysics = new VehiclePhysics(this.trackSpline);
    this.yeetPhysics = new YeetPhysics(this.trackSpline);

    // 3. 3D Meshes & Particles
    this.trackRenderer = new TrackRenderer(this.sceneManager.scene, this.trackSpline);
    this.vehicleMesh = new VehicleMesh(this.sceneManager.scene);
    this.obstacleEntities = new ObstacleEntities(this.sceneManager.scene, this.yeetPhysics);
    this.particleSystem = new ParticleSystem(this.sceneManager.scene);

    // 4. Input & HUD
    this.joystick = new TouchJoystick(document.getElementById('app-container'));
    this.hud = new HudOverlay(this.canvas, this.gsm);

    // Fixed timestep loop variables
    this.fixedDt = 1 / 60;
    this.accumulator = 0;
    this.lastTime = performance.now();

    this.simulatedSteer = null;
    this.simulatedThrottle = null;

    this.init();
  }

  init() {
    // Initial camera position
    this.cameraController.reset(this.vehiclePhysics);
    this.vehicleMesh.update(this.vehiclePhysics, 0.016);

    // Listen to Game Events
    this.gsm.subscribe((event, payload, state) => {
      if (event === 'RACE_STARTED') {
        this.vehiclePhysics.resetToStart();
        this.yeetPhysics.reset();
        this.cameraController.reset(this.vehiclePhysics);
        this.gsm.state.trashBagsRemaining = 30;
        this.gsm.state.trashBagsLost = 0;
        this.particleSystem.veggieSplatsCount = 0;
      } else if (event === 'RACE_FINISHED') {
        audioEngine.playFinishFanfare();
      } else if (event === 'RESET') {
        this.vehiclePhysics.resetToStart();
        this.yeetPhysics.reset();
        this.cameraController.reset(this.vehiclePhysics);
        this.gsm.state.trashBagsRemaining = 30;
        this.gsm.state.trashBagsLost = 0;
        this.particleSystem.veggieSplatsCount = 0;
      }
    });

    // Wire Trash Bag Ejection Effects
    this.vehiclePhysics.onTrashBagEjected = (ejectionData) => {
      this.vehicleMesh.ejectTrashBag(ejectionData, this.vehiclePhysics);
      this.gsm.state.trashBagsRemaining = ejectionData.remaining;
      this.gsm.state.trashBagsLost = ejectionData.lost;

      // 65% probability (or at least every 2 bags) trigger screen veggie splatter
      if (Math.random() < 0.65 || ejectionData.lost % 2 === 1) {
        this.particleSystem.showVeggieSplat();
      }
    };

    // Setup Testing Hooks for Playwright
    this.setupTestHooks();

    // Start requestAnimationFrame loop
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  setupTestHooks() {
    // 1. render_game_to_text (Required by web-game skill)
    window.render_game_to_text = () => {
      const state = this.gsm.state;
      const pos = this.vehiclePhysics.position;
      const vp = this.vehiclePhysics;
      return JSON.stringify({
        mode: state.mode,
        progress: Number((state.progress || 0).toFixed(3)),
        totalScore: Math.floor(state.totalScore || 0),
        driftScore: Math.floor(state.driftScore || 0),
        yeetScore: Math.floor(state.yeetScore || 0),
        combo: Number((state.combo || 1).toFixed(1)),
        isDrifting: Boolean(state.isDrifting),
        speed: Number((state.speed || 0).toFixed(1)),
        totalYeeted: state.totalYeeted || 0,
        yeetCounts: state.yeetCounts || {},
        carPos: {
          x: Number((pos ? pos.x : 0).toFixed(1)),
          y: Number((pos ? pos.y : 0).toFixed(1)),
          z: Number((pos ? pos.z : 0).toFixed(1)),
        },
        wallHits: vp.wallHits || 0,
        trashBagsRemaining: vp.trashBagsRemaining !== undefined ? vp.trashBagsRemaining : 30,
        trashBagsLost: vp.trashBagsLost || 0,
        veggieSplats: this.particleSystem.veggieSplatsCount || 0,
        slipDeg: Number(((Math.abs(vp.slipAngle || 0) * 180) / Math.PI).toFixed(1)),
        maxSlipDeg: Number(((vp.maxSlipAngle || 0) * 180 / Math.PI).toFixed(1)),
        pitchDeg: Number(((vp.pitch || 0) * 180 / Math.PI).toFixed(1)),
      });
    };

    // 2. advanceTime(ms, render) (Deterministic stepping hook for Playwright)
    window.advanceTime = (ms, render = true) => {
      const seconds = ms / 1000;
      const steps = Math.ceil(seconds / this.fixedDt);
      const stepDt = seconds / steps;
      for (let i = 0; i < steps; i++) {
        this.tickPhysics(stepDt);
      }
      if (render) {
        this.tickRender(stepDt);
      }
    };

    // 3. programmatic inputs
    window.simulateJoystick = (steer, throttle = 0) => {
      this.simulatedSteer = steer;
      this.simulatedThrottle = throttle;
    };

    window.startRace = () => {
      this.gsm.startRace();
      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.classList.add('hidden');
      const topHud = document.getElementById('top-hud');
      if (topHud) topHud.classList.remove('hidden');
    };
  }

  tickPhysics(dt) {
    const state = this.gsm.state;

    // Hit-stop skip
    if (this.gsm.isHitStopped()) {
      this.gsm.updateHitStop(dt);
      return;
    }

    // 1. Gather Input
    let inputs = this.joystick.getInputs();
    if (this.simulatedSteer !== null) {
      inputs = { steer: this.simulatedSteer, throttle: this.simulatedThrottle || 0 };
    }
    this.vehiclePhysics.setInput(inputs.steer, inputs.throttle);

    // 2. Update Vehicle Physics
    this.vehiclePhysics.update(dt, this.gsm);

    // 3. Update Obstacles & Check Collisions
    this.yeetPhysics.update(dt, this.vehiclePhysics, this.gsm, (obs, impulse, hitPos) => {
      // Audio
      audioEngine.playYeet(obs.type);
      // Floating score popup in 3D/Screen space
      this.particleSystem.showScorePopup(obs.def.text, hitPos, this.sceneManager.camera, obs.def.color);
    });

    // 4. Update Game State Drift Scores & Progress
    this.gsm.updateDrift(
      dt,
      this.vehiclePhysics.isDrifting,
      this.vehiclePhysics.slipAngle,
      this.vehiclePhysics.speed,
      this.vehiclePhysics.isNearEdge
    );

    state.progress = this.vehiclePhysics.progressU;
    state.speed = this.vehiclePhysics.speed;
    state.trashBagsRemaining = this.vehiclePhysics.trashBagsRemaining;
    state.trashBagsLost = this.vehiclePhysics.trashBagsLost;
    this.gsm.updateTrauma(dt);

    // 5. Audio Telemetry
    const speedRatio = this.vehiclePhysics.speed / 46.0;
    audioEngine.updateCarTelemetry(speedRatio, this.vehiclePhysics.isDrifting, this.vehiclePhysics.slipAngle);
  }

  tickRender(dt) {
    // Sync 3D Meshes
    this.vehicleMesh.update(this.vehiclePhysics, dt);
    this.obstacleEntities.update();
    this.particleSystem.update(dt, this.vehiclePhysics);

    // Camera & Lighting follow
    this.cameraController.update(dt, this.vehiclePhysics, this.gsm.state);
    this.sceneManager.updateLightTarget(this.vehiclePhysics.position);

    // HUD Update
    this.hud.update(this.gsm.state);

    // Render WebGL
    this.sceneManager.render();
  }

  renderLoop(now) {
    const frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp dt to avoid spiral of death on tab switch
    const clampedFrameTime = Math.min(frameTime, 0.1);
    this.accumulator += clampedFrameTime;

    while (this.accumulator >= this.fixedDt) {
      this.tickPhysics(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.tickRender(clampedFrameTime);

    requestAnimationFrame(this.renderLoop.bind(this));
  }
}

// Auto-boot on load
window.addEventListener('DOMContentLoaded', () => {
  window.driftGameApp = new DriftDownhillApp();
});

import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Soft sky and light anime fog (never harsh or dark)
    this.scene.background = new THREE.Color(GAME_CONSTANTS.COLORS.SKY);
    this.scene.fog = new THREE.FogExp2(GAME_CONSTANTS.COLORS.FOG, 0.0030);

    // Camera (Portrait Mobile 9:16 optimized, FOV 65)
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 1200);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.setupResizeListener();
  }

  setupLighting() {
    // 1. Hemisphere Light: soft ambient sky tone & ground warmth
    const hemiLight = new THREE.HemisphereLight(
      GAME_CONSTANTS.COLORS.SKY,
      GAME_CONSTANTS.COLORS.MOUNTAIN_GRASS,
      0.95
    );
    this.scene.add(hemiLight);

    // 2. Main Soft Sunlight
    this.sunLight = new THREE.DirectionalLight(GAME_CONSTANTS.COLORS.SUNLIGHT, 0.92);
    this.sunLight.position.set(120, 240, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 600;
    const shadowDist = 80;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // 3. Subtle Fill Light
    const fillLight = new THREE.DirectionalLight(0xE0F2FE, 0.45);
    fillLight.position.set(-80, 100, -60);
    this.scene.add(fillLight);
  }

  setupResizeListener() {
    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 100));
  }

  updateLightTarget(targetPos) {
    if (this.sunLight) {
      this.sunLight.position.set(targetPos.x + 60, targetPos.y + 120, targetPos.z + 40);
      this.sunLight.target.position.copy(targetPos);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

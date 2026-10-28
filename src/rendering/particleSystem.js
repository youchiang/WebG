import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 1. Subtle Smoke Particles (Instanced)
    this.maxSmoke = 40;
    this.smokeGeo = new THREE.DodecahedronGeometry(0.35, 1);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(this.smokeGeo, this.smokeMat, this.maxSmoke);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.smokeMesh);

    this.smokePool = [];
    for (let i = 0; i < this.maxSmoke; i++) {
      this.smokePool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 0.22,
        life: 0,
        maxLife: 0.5,
      });
    }

    this.dummy = new THREE.Object3D();
    this.smokeTimer = 0;

    // 2. Screen Floating Score Text Container
    this.textContainer = document.getElementById('floating-popups-container');
    if (!this.textContainer) {
      this.textContainer = document.createElement('div');
      this.textContainer.id = 'floating-popups-container';
      document.body.appendChild(this.textContainer);
    }
  }

  emitSmoke(pos, carVel) {
    for (const p of this.smokePool) {
      if (!p.active) {
        p.active = true;
        p.pos.copy(pos);
        // Light upward puff (0.6 - 1.2 m/s) with minimal lateral spread
        p.vel.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * 0.6 + 0.6,
          (Math.random() - 0.5) * 0.4
        ).addScaledVector(carVel, 0.05);
        p.scale = 0.22;
        p.life = 0;
        p.maxLife = 0.5;
        break;
      }
    }
  }

  showScorePopup(text, worldPos, camera, color = '#FFD43B') {
    if (!this.textContainer) return;

    // Convert 3D world position to 2D screen coordinates
    const screenPos = worldPos.clone().project(camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'yeet-popup-pill';
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    this.textContainer.appendChild(el);

    // Fade out and remove
    setTimeout(() => {
      el.classList.add('fly-up');
    }, 20);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1100);
  }

  update(dt, vehiclePhysics) {
    // 1. Emit smoke only when drifting && |beta| > 15° && speed > 10
    const betaDeg = (Math.abs(vehiclePhysics.slipAngle || 0) * 180) / Math.PI;
    if (vehiclePhysics.isDrifting && betaDeg > 15 && vehiclePhysics.speed > 10) {
      this.smokeTimer += dt;
      if (this.smokeTimer >= 0.05) {
        this.smokeTimer = 0;

        // Emit only from the two rear wheel positions
        // Body-local (±1.05, 0.1, -1.35) transformed by body orientation
        const carPos = vehiclePhysics.position;
        const q = vehiclePhysics.bodyQuaternion;

        const leftTire = new THREE.Vector3(-1.05, 0.1, -1.35);
        const rightTire = new THREE.Vector3(1.05, 0.1, -1.35);

        if (q) {
          leftTire.applyQuaternion(q);
          rightTire.applyQuaternion(q);
        }
        leftTire.add(carPos);
        rightTire.add(carPos);

        this.emitSmoke(leftTire, vehiclePhysics.velocity);
        this.emitSmoke(rightTire, vehiclePhysics.velocity);
      }
    }

    // 2. Update active smoke particles
    for (let i = 0; i < this.maxSmoke; i++) {
      const p = this.smokePool[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          this.dummy.position.set(0, -999, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
          continue;
        }

        p.pos.addScaledVector(p.vel, dt);
        const progress = p.life / p.maxLife; // 0 to 1

        // Base scale ~0.22, grows to ~1.8x, then cleanly vanishes near end of life
        let currentScale = p.scale * (1.0 + progress * 0.8);
        if (progress > 0.75) {
          currentScale *= (1.0 - progress) / 0.25;
        }

        this.dummy.position.copy(p.pos);
        this.dummy.scale.setScalar(Math.max(0.001, currentScale));
        this.dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
      } else {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }
}

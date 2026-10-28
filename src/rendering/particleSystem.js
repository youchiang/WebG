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
    this.veggieSplatsCount = 0;

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

  showVeggieSplat() {
    this.veggieSplatsCount++;
    if (!this.textContainer) return;

    const group = document.createElement('div');
    group.className = 'veggie-splat-group';

    // Random position in central/surrounding screen (15% ~ 85%, 20% ~ 75%)
    const leftPct = 15 + Math.random() * 70;
    const topPct = 20 + Math.random() * 55;
    group.style.left = `${leftPct.toFixed(1)}%`;
    group.style.top = `${topPct.toFixed(1)}%`;

    // 5 ~ 8 organic vegetable scrap pieces
    const scrapCount = 5 + Math.floor(Math.random() * 4);
    const colors = [
      '#84CC16', // 高麗菜綠
      '#4D7C0F', // 深菜葉綠
      '#F97316', // 紅蘿蔔橘
      '#EF4444', // 番茄紅
      '#FACC15', // 炒蛋黃
      '#365314', // 海帶深綠
      '#CA8A04', // 醬汁金褐
    ];

    for (let i = 0; i < scrapCount; i++) {
      const scrap = document.createElement('div');
      scrap.className = 'veggie-scrap';

      const color = colors[Math.floor(Math.random() * colors.length)];
      const w = 12 + Math.floor(Math.random() * 18);
      const h = 8 + Math.floor(Math.random() * 14);
      const rot = (Math.random() - 0.5) * 80;
      const offsetX = (Math.random() - 0.5) * 48;
      const offsetY = (Math.random() - 0.5) * 48;

      scrap.style.backgroundColor = color;
      scrap.style.width = `${w}px`;
      scrap.style.height = `${h}px`;
      scrap.style.left = `${offsetX.toFixed(1)}px`;
      scrap.style.top = `${offsetY.toFixed(1)}px`;
      scrap.style.transform = `rotate(${rot.toFixed(1)}deg)`;

      // Organic irregular scrap corners
      const r1 = 30 + Math.floor(Math.random() * 40);
      const r2 = 30 + Math.floor(Math.random() * 40);
      const r3 = 30 + Math.floor(Math.random() * 40);
      const r4 = 30 + Math.floor(Math.random() * 40);
      scrap.style.borderRadius = `${r1}% ${r2}% ${r3}% ${r4}% / ${r4}% ${r3}% ${r2}% ${r1}%`;

      group.appendChild(scrap);
    }

    this.textContainer.appendChild(group);

    // Auto remove after 1.0s (1000ms)
    setTimeout(() => {
      if (group.parentNode) {
        group.parentNode.removeChild(group);
      }
    }, 1000);
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

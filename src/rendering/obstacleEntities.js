import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

export class ObstacleEntities {
  constructor(scene, yeetPhysics) {
    this.scene = scene;
    this.yeetPhysics = yeetPhysics;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.meshMap = new Map();
    this.createAllMeshes();
  }

  createAllMeshes() {
    for (const obs of this.yeetPhysics.obstacles) {
      let mesh = null;
      switch (obs.type) {
        case 'cat':
          mesh = this.buildCatMesh();
          break;
        case 'shiba':
          mesh = this.buildShibaMesh();
          break;
        case 'cone':
          mesh = this.buildConeMesh();
          break;
        case 'watermelon':
          mesh = this.buildWatermelonMesh();
          break;
        case 'human':
        default:
          mesh = this.buildHumanMesh();
          break;
      }

      mesh.position.copy(obs.position);
      mesh.rotation.copy(obs.rotation);
      this.group.add(mesh);
      this.meshMap.set(obs.id, mesh);
    }
  }

  buildHumanMesh() {
    const group = new THREE.Group();
    const shirtColors = [0xEF4444, 0x3B82F6, 0x10B981, 0xF59E0B, 0x8B5CF6];
    const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xFDE047, flatShading: true });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor, flatShading: true });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1E293B, flatShading: true });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirtMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    group.add(torso);

    // Arms waving or holding phone
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.48, 1.25, 0.1);
    leftArm.rotation.z = 0.6; // Waving high
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.48, 1.25, 0.1);
    rightArm.rotation.z = -0.6;
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.2, 0.35, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.2, 0.35, 0);
    group.add(leftLeg);
    group.add(rightLeg);

    group.userData = {
      type: 'human',
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      torso,
      head,
    };

    return group;
  }

  buildCatMesh() {
    const group = new THREE.Group();
    const catMat = new THREE.MeshLambertMaterial({ color: 0xFB923C, flatShading: true }); // Orange tabby
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.7), catMat);
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.35), catMat);
    head.position.set(0, 0.45, 0.4);
    group.add(head);

    // Ears
    [-0.12, 0.12].forEach((x) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 4), catMat);
      ear.position.set(x, 0.68, 0.4);
      group.add(ear);
    });

    // Curled Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 5), whiteMat);
    tail.position.set(0, 0.45, -0.4);
    tail.rotation.x = 0.7;
    group.add(tail);

    group.userData = {
      type: 'cat',
      body,
      head,
      tail,
    };

    return group;
  }

  buildShibaMesh() {
    const group = new THREE.Group();
    const shibaMat = new THREE.MeshLambertMaterial({ color: 0xD97706, flatShading: true }); // Shiba gold
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFBEB });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), shibaMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    // White chest
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.2), whiteMat);
    chest.position.set(0, 0.42, 0.35);
    group.add(chest);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), shibaMat);
    head.position.set(0, 0.75, 0.45);
    group.add(head);

    // Pointy Ears
    [-0.16, 0.16].forEach((x) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), shibaMat);
      ear.position.set(x, 1.02, 0.45);
      group.add(ear);
    });

    // Curled Tail
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 4, 8, Math.PI * 1.5), shibaMat);
    tail.position.set(0, 0.7, -0.42);
    tail.rotation.y = Math.PI / 2;
    group.add(tail);

    group.userData = {
      type: 'shiba',
      body,
      head,
      tail,
    };

    return group;
  }

  buildConeMesh() {
    const group = new THREE.Group();
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xEA580C });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

    // Cluster of 3 cones (Bowling pin arrangement)
    const offsets = [
      { x: 0, z: 0.3 },
      { x: -0.3, z: -0.2 },
      { x: 0.3, z: -0.2 },
    ];

    offsets.forEach((pos) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.75, 8), coneMat);
      cone.position.set(pos.x, 0.38, pos.z);
      cone.castShadow = true;

      // Base plate
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), coneMat);
      base.position.set(pos.x, 0.03, pos.z);

      // White reflective band
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8), whiteMat);
      band.position.set(pos.x, 0.38, pos.z);

      group.add(base);
      group.add(cone);
      group.add(band);
    });

    return group;
  }

  buildWatermelonMesh() {
    const group = new THREE.Group();
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xB45309 });
    const melonMat = new THREE.MeshLambertMaterial({ color: 0x15803D });

    // Wooden crate
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), crateMat);
    crate.position.y = 0.25;
    crate.castShadow = true;
    group.add(crate);

    // 4 juicy watermelons
    const melonPos = [
      { x: -0.3, y: 0.45, z: -0.3 },
      { x: 0.3, y: 0.45, z: -0.3 },
      { x: -0.3, y: 0.45, z: 0.3 },
      { x: 0.3, y: 0.45, z: 0.3 },
    ];

    melonPos.forEach((p) => {
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), melonMat);
      melon.position.set(p.x, p.y, p.z);
      group.add(melon);
    });

    return group;
  }

  update() {
    for (const obs of this.yeetPhysics.obstacles) {
      const mesh = this.meshMap.get(obs.id);
      if (!mesh) continue;

      mesh.position.copy(obs.position);
      mesh.rotation.copy(obs.rotation);

      // Cute lively pacing animation for humans and animals
      if (!obs.isYeeted && obs.isWanderer && mesh.userData) {
        const t = obs.animTime || 0;
        const d = mesh.userData;

        if (d.type === 'human') {
          // Strolling leg and arm swing
          const swing = Math.sin(t * 7.0) * 0.45;
          if (d.leftLeg) d.leftLeg.rotation.x = swing;
          if (d.rightLeg) d.rightLeg.rotation.x = -swing;
          if (d.leftArm) d.leftArm.rotation.x = -swing * 0.7;
          if (d.rightArm) d.rightArm.rotation.x = swing * 0.7;
          if (d.torso) d.torso.position.y = 1.1 + Math.abs(Math.sin(t * 14.0)) * 0.04;
          if (d.head) d.head.position.y = 1.7 + Math.abs(Math.sin(t * 14.0)) * 0.04;
        } else if (d.type === 'cat') {
          // Playful cat prowl
          if (d.body) d.body.position.y = 0.3 + Math.abs(Math.sin(t * 9.0)) * 0.05;
          if (d.tail) d.tail.rotation.z = Math.sin(t * 5.0) * 0.35;
        } else if (d.type === 'shiba') {
          // Energetic dog trot bounce & tail wag
          if (d.body) d.body.position.y = 0.45 + Math.abs(Math.sin(t * 11.0)) * 0.07;
          if (d.tail) d.tail.rotation.y = Math.PI / 2 + Math.sin(t * 14.0) * 0.4;
        }
      }
    }
  }
}

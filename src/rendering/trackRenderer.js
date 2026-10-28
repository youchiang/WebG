import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

export class TrackRenderer {
  constructor(scene, trackSpline) {
    this.scene = scene;
    this.track = trackSpline;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildRoadMesh();
    this.buildGuardrails();
    this.buildMountainTerrain();
    this.buildStartFinishArches();
    this.buildSceneryTrees();
  }

  buildRoadMesh() {
    const segments = 400;
    const roadWidth = GAME_CONSTANTS.TRACK.WIDTH;
    const halfW = roadWidth / 2;

    const vertices = [];
    const uvs = [];
    const indices = [];

    // Road ribbon vertices
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const center = this.track.getPointAt(u);
      const normal = this.track.getNormalAt(u); // road left

      const leftPt = new THREE.Vector3().copy(center).addScaledVector(normal, -halfW);
      const rightPt = new THREE.Vector3().copy(center).addScaledVector(normal, halfW);

      vertices.push(leftPt.x, leftPt.y, leftPt.z);
      vertices.push(rightPt.x, rightPt.y, rightPt.z);

      uvs.push(0, u * 80);
      uvs.push(1, u * 80);

      if (i < segments) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;

        indices.push(v0, v1, v2);
        indices.push(v1, v3, v2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.ROAD_ASPHALT,
      roughness: 0.8,
    });

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // Yellow Center Dashed Line Ribbon
    this.buildCenterDashedLine(segments);
  }

  buildCenterDashedLine(segments) {
    const vertices = [];
    const indices = [];
    const halfLineW = 0.25;

    for (let i = 0; i <= segments; i++) {
      // Dashes: draw for 2 steps, skip 1 step
      if ((i % 4) === 3) continue;

      const u = i / segments;
      const center = this.track.getPointAt(u);
      const normal = this.track.getNormalAt(u);

      const leftPt = new THREE.Vector3().copy(center).addScaledVector(normal, -halfLineW);
      const rightPt = new THREE.Vector3().copy(center).addScaledVector(normal, halfLineW);

      leftPt.y += 0.04; // Slightly above road to prevent z-fighting
      rightPt.y += 0.04;

      const baseIdx = vertices.length / 3;
      vertices.push(leftPt.x, leftPt.y, leftPt.z);
      vertices.push(rightPt.x, rightPt.y, rightPt.z);

      if (i < segments && (i % 4) < 2) {
        vertices.push(leftPt.x, leftPt.y, leftPt.z);
        vertices.push(rightPt.x, rightPt.y, rightPt.z);
      }
    }

    // Connect sequential pairs
    for (let i = 0; i < (vertices.length / 3) - 2; i += 2) {
      indices.push(i, i + 1, i + 2);
      indices.push(i + 1, i + 3, i + 2);
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    lineGeo.setIndex(indices);
    lineGeo.computeVertexNormals();

    const lineMat = new THREE.MeshBasicMaterial({
      color: GAME_CONSTANTS.COLORS.ROAD_LINE_YELLOW,
    });

    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    this.group.add(lineMesh);
  }

  buildGuardrails() {
    const railOffset = GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET;
    const segments = 350;

    const railMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.GUARD_RAIL,
    });

    // Build left and right rails
    [-railOffset, railOffset].forEach((offset) => {
      const railCurvePts = [];
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const pt = this.track.getWorldPosition(u, offset, 0.7);
        railCurvePts.push(pt);
      }

      const railCurve = new THREE.CatmullRomCurve3(railCurvePts);
      const railGeo = new THREE.TubeGeometry(railCurve, segments, 0.16, 6, false);
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.castShadow = true;
      this.group.add(railMesh);

      // Add vertical posts every 4 segments
      const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
      const postInstanced = new THREE.InstancedMesh(postGeo, railMat, Math.floor(segments / 3));
      const dummy = new THREE.Object3D();

      let postCount = 0;
      for (let i = 0; i < segments; i += 3) {
        const u = i / segments;
        const pt = this.track.getWorldPosition(u, offset, 0.5);
        dummy.position.copy(pt);
        dummy.updateMatrix();
        postInstanced.setMatrixAt(postCount++, dummy.matrix);
      }
      postInstanced.instanceMatrix.needsUpdate = true;
      postInstanced.castShadow = true;
      this.group.add(postInstanced);
    });
  }

  buildMountainTerrain() {
    // Low-poly layered mountain peaks with soft pastel palette
    const mountainMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.MOUNTAIN_GRASS,
      flatShading: true,
    });

    const rockMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.MOUNTAIN_ROCK,
      flatShading: true,
    });

    const trackSamplePoints = this.track.cachePoints;

    // Mountain cones along the compact descent (Z: 0 -> 720), pushed out to frame the 10 hairpins
    const peaks = [
      // Left side mountain ridges
      { x: -195, y: 95, z: 60, r: 145, h: 185 },
      { x: -205, y: 70, z: 220, r: 155, h: 175 },
      { x: -200, y: 45, z: 400, r: 155, h: 165 },
      { x: -185, y: 20, z: 580, r: 145, h: 145 },
      // Right side mountain ridges
      { x: 195, y: 90, z: 120, r: 145, h: 190 },
      { x: 205, y: 65, z: 300, r: 155, h: 180 },
      { x: 200, y: 40, z: 480, r: 155, h: 160 },
      { x: 185, y: 15, z: 640, r: 145, h: 140 },
    ];

    peaks.forEach((p, idx) => {
      const geo = new THREE.ConeGeometry(p.r, p.h, 8, 4);
      const pos = geo.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        let lx = pos.getX(i) + (Math.random() - 0.5) * 8;
        let ly = pos.getY(i);
        let lz = pos.getZ(i) + (Math.random() - 0.5) * 8;

        // World coordinates
        const wx = p.x + lx;
        let wy = p.y + ly;
        const wz = p.z + lz;

        // Anti-clipping road canyon carving: ensure terrain NEVER intersects the road
        let minTrackDistSq = Infinity;
        let nearestTrackY = 0;
        for (let k = 0; k < trackSamplePoints.length; k++) {
          const tPt = trackSamplePoints[k];
          const dx = wx - tPt.x;
          const dz = wz - tPt.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < minTrackDistSq) {
            minTrackDistSq = dSq;
            nearestTrackY = tPt.y;
          }
        }

        const dist = Math.sqrt(minTrackDistSq);
        const roadBuffer = GAME_CONSTANTS.TRACK.WIDTH / 2 + 5.0; // ~12m
        if (dist < roadBuffer) {
          // Inside or right next to road: carve terrain down below road level
          wy = Math.min(wy, nearestTrackY - 1.5);
        } else if (dist < roadBuffer + 25.0) {
          // Smooth hillside slope rising away from road
          const factor = (dist - roadBuffer) / 25.0;
          const targetY = Math.min(wy, nearestTrackY - 1.5);
          wy = THREE.MathUtils.lerp(targetY, wy, factor);
        }

        pos.setX(i, lx);
        pos.setY(i, wy - p.y);
        pos.setZ(i, lz);
      }

      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, idx % 2 === 0 ? mountainMat : rockMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    });

    // Vast soft valley ground plane at base level
    const groundGeo = new THREE.PlaneGeometry(1600, 2400, 24, 24);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.MOUNTAIN_GRASS,
      flatShading: true,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -2, 500);
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);
  }

  buildStartFinishArches() {
    // 1. Start Arch (Summit)
    const startPos = this.track.getPointAt(0.002);
    const startNormal = this.track.getNormalAt(0.002);
    const startTangent = this.track.getTangentAt(0.002);

    const archMat = new THREE.MeshLambertMaterial({ color: 0x38BDF8 });
    const archGeo = new THREE.BoxGeometry(GAME_CONSTANTS.TRACK.WIDTH + 2, 0.8, 1.2);
    const archMesh = new THREE.Mesh(archGeo, archMat);
    archMesh.position.copy(startPos).add(new THREE.Vector3(0, 5, 0));
    archMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNormal);
    this.group.add(archMesh);

    // Pillars
    [-GAME_CONSTANTS.TRACK.WIDTH / 2 - 0.8, GAME_CONSTANTS.TRACK.WIDTH / 2 + 0.8].forEach((offset) => {
      const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 5, 8);
      const pillar = new THREE.Mesh(pillarGeo, archMat);
      pillar.position.copy(startPos).addScaledVector(startNormal, offset).add(new THREE.Vector3(0, 2.5, 0));
      this.group.add(pillar);
    });

    // 2. Finish Arch (Base)
    const finishPos = this.track.getPointAt(0.96);
    const finishNormal = this.track.getNormalAt(0.96);

    const finishMat = new THREE.MeshLambertMaterial({ color: 0xF59E0B });
    const finishMesh = new THREE.Mesh(archGeo, finishMat);
    finishMesh.position.copy(finishPos).add(new THREE.Vector3(0, 5, 0));
    finishMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), finishNormal);
    this.group.add(finishMesh);

    [-GAME_CONSTANTS.TRACK.WIDTH / 2 - 0.8, GAME_CONSTANTS.TRACK.WIDTH / 2 + 0.8].forEach((offset) => {
      const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 5, 8);
      const pillar = new THREE.Mesh(pillarGeo, finishMat);
      pillar.position.copy(finishPos).addScaledVector(finishNormal, offset).add(new THREE.Vector3(0, 2.5, 0));
      this.group.add(pillar);
    });
  }

  buildSceneryTrees() {
    // Low-poly Japanese alpine pine & cherry blossom (sakura) trees scattered beside the road
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0xA07855 });
    const pineMat1 = new THREE.MeshLambertMaterial({ color: 0x93E3B6, flatShading: true }); // Soft mint green
    const pineMat2 = new THREE.MeshLambertMaterial({ color: 0x6EE7B7, flatShading: true });
    const sakuraMat1 = new THREE.MeshLambertMaterial({ color: 0xFBCFE8, flatShading: true }); // Soft sakura pink
    const sakuraMat2 = new THREE.MeshLambertMaterial({ color: 0xF9A8D4, flatShading: true });

    const treeGroup = new THREE.Group();
    const trackSamplePoints = this.track.cachePoints;

    for (let u = 0.02; u < 0.98; u += 0.015) {
      // Plant on left and right outside guardrails
      [-1, 1].forEach((side) => {
        const distOffset = side * (GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET + 3.8 + Math.random() * 7);
        const pos = this.track.getWorldPosition(u, distOffset, 0);

        // Anti-clipping check: make sure tree is not accidentally on an adjacent hairpin road segment
        let minRoadDistSq = Infinity;
        for (let k = 0; k < trackSamplePoints.length; k++) {
          const tPt = trackSamplePoints[k];
          const dx = pos.x - tPt.x;
          const dz = pos.z - tPt.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < minRoadDistSq) minRoadDistSq = dSq;
        }

        if (minRoadDistSq < (GAME_CONSTANTS.TRACK.GUARD_RAIL_OFFSET + 1.8) ** 2) {
          return; // Skip planting tree too close to another road turn
        }

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.4, 5), trunkMat);
        trunk.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
        trunk.castShadow = true;

        const isSakura = Math.random() < 0.35;
        const mainFoliageMat = isSakura
          ? (Math.random() > 0.5 ? sakuraMat1 : sakuraMat2)
          : (Math.random() > 0.5 ? pineMat1 : pineMat2);

        const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.0, 5), mainFoliageMat);
        f1.position.copy(pos).add(new THREE.Vector3(0, 3.0, 0));
        f1.castShadow = true;

        const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.2, 5), mainFoliageMat);
        f2.position.copy(pos).add(new THREE.Vector3(0, 4.6, 0));

        treeGroup.add(trunk);
        treeGroup.add(f1);
        treeGroup.add(f2);
      });
    }

    this.group.add(treeGroup);
  }
}

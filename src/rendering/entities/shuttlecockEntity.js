import * as THREE from 'three';
import {
  createShuttleOutlineMaterial,
  createShuttleBodyMaterial,
  updateShuttleShaderUniforms,
  OUTLINE_PALETTE,
} from '../shaders/shuttleOutlineShader.js';

const TRAIL_MAX_POINTS = 26;

/**
 * Creates the complete 3D Shuttlecock visual system, featuring:
 * 1. Dual-shell 3D Shuttlecock mesh (cork, leather collar, 16-feather conical skirt, inverted hull outline)
 * 2. Aerodynamic Ribbon Trail (dynamic air trail fading from head to tail)
 * 3. Ground Landing Predictor Dual-Ring & Contact Shadow (outer crosshair target + inner shrinking timing ring)
 */
export function createShuttlecockSystem(scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'ShuttlecockSystem';

  // -------------------------------------------------------------
  // 1. 3D Shuttlecock Model (Cork Nose forward along -Z)
  // -------------------------------------------------------------
  const shuttleMesh = new THREE.Group();
  shuttleMesh.name = 'ShuttlecockModel';

  const bodyMat = createShuttleBodyMaterial('#F8FAFC');
  const outlineMat = createShuttleOutlineMaterial();

  const corkMat = new THREE.MeshStandardMaterial({
    color: '#F4ECE1',
    roughness: 0.55,
    metalness: 0.02,
  });

  const collarMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.35,
    metalness: 0.1,
  });

  // A. Cork Dome (Radius 13.5mm, facing -Z)
  const corkGeo = new THREE.SphereGeometry(0.0135, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const corkMesh = new THREE.Mesh(corkGeo, corkMat);
  corkMesh.rotation.x = -Math.PI / 2;
  corkMesh.position.set(0, 0, -0.024);
  corkMesh.castShadow = true;
  shuttleMesh.add(corkMesh);

  // B. Navy Leather Collar Band
  const collarGeo = new THREE.CylinderGeometry(0.0136, 0.0142, 0.005, 20);
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 0, -0.018);
  collarMesh.castShadow = true;
  shuttleMesh.add(collarMesh);

  // C. 16-Feather Conical Skirt (Inner Body)
  // Tapers from radius 0.014m at collar to 0.033m at skirt rim, length 0.065m
  const skirtGeo = new THREE.CylinderGeometry(0.0325, 0.0142, 0.065, 16, 1, true);
  const skirtMesh = new THREE.Mesh(skirtGeo, bodyMat);
  skirtMesh.rotation.x = Math.PI / 2;
  skirtMesh.position.set(0, 0, 0.016);
  skirtMesh.castShadow = true;
  shuttleMesh.add(skirtMesh);

  // D. Feather Retaining Thread Rings (Two thin string loops)
  const threadMat = new THREE.MeshBasicMaterial({ color: '#E2E8F0' });
  [0.008, 0.028].forEach((zPos, idx) => {
    const ringRad = 0.018 + idx * 0.008;
    const ringGeo = new THREE.TorusGeometry(ringRad, 0.0007, 8, 20);
    const ringMesh = new THREE.Mesh(ringGeo, threadMat);
    ringMesh.position.set(0, 0, zPos);
    shuttleMesh.add(ringMesh);
  });

  // E. Inverted Hull Outline Shell (Closed cylinder + cork dome so BackSide forms a complete 360-deg silhouette)
  const outlineSkirtGeo = new THREE.CylinderGeometry(0.0345, 0.0152, 0.068, 20, 1, false);
  const outlineSkirtMesh = new THREE.Mesh(outlineSkirtGeo, outlineMat);
  outlineSkirtMesh.rotation.x = Math.PI / 2;
  outlineSkirtMesh.position.set(0, 0, 0.016);
  shuttleMesh.add(outlineSkirtMesh);

  const outlineCorkGeo = new THREE.SphereGeometry(0.0152, 20, 14);
  const outlineCorkMesh = new THREE.Mesh(outlineCorkGeo, outlineMat);
  outlineCorkMesh.position.set(0, 0, -0.024);
  shuttleMesh.add(outlineCorkMesh);

  shuttleMesh.scale.setScalar(1.55);
  rootGroup.add(shuttleMesh);

  // -------------------------------------------------------------
  // 2. Dynamic Aerodynamic Ribbon Trail
  // -------------------------------------------------------------
  const trailPositions = [];
  const trailTimes = [];
  for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
    trailPositions.push(new THREE.Vector3(0, 1.55, 0));
    trailTimes.push(0);
  }

  // Ribbon quad-strip geometry: (TRAIL_MAX_POINTS - 1) quads = 2 triangles per segment
  const ribbonSegmentCount = TRAIL_MAX_POINTS - 1;
  const ribbonVertexCount = TRAIL_MAX_POINTS * 2;
  const ribbonIndexCount = ribbonSegmentCount * 6;

  const ribbonPositions = new Float32Array(ribbonVertexCount * 3);
  const ribbonColors = new Float32Array(ribbonVertexCount * 4);
  const ribbonIndices = new Uint16Array(ribbonIndexCount);

  let idxOffset = 0;
  for (let i = 0; i < ribbonSegmentCount; i++) {
    const v = i * 2;
    ribbonIndices[idxOffset++] = v;
    ribbonIndices[idxOffset++] = v + 1;
    ribbonIndices[idxOffset++] = v + 2;

    ribbonIndices[idxOffset++] = v + 1;
    ribbonIndices[idxOffset++] = v + 3;
    ribbonIndices[idxOffset++] = v + 2;
  }

  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPositions, 3));
  ribbonGeo.setAttribute('color', new THREE.BufferAttribute(ribbonColors, 4));
  ribbonGeo.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));

  const ribbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.name = 'ShuttleAirTrail';
  rootGroup.add(ribbonMesh);

  // -------------------------------------------------------------
  // 3. Ground Landing Predictor Dual-Ring & Contact Shadow
  // -------------------------------------------------------------
  const predictorGroup = new THREE.Group();
  predictorGroup.name = 'GroundLandingPredictor';

  // A. Soft Fill Disc + Outer Static Target Ring (Radius 0.45m) + 4 Crosshair Ticks
  const fillDiscGeo = new THREE.CircleGeometry(0.42, 36);
  const fillDiscMat = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const fillDisc = new THREE.Mesh(fillDiscGeo, fillDiscMat);
  fillDisc.rotation.x = -Math.PI / 2;
  predictorGroup.add(fillDisc);

  const outerRingGeo = new THREE.RingGeometry(0.38, 0.45, 40);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: '#FF5722',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.001;
  predictorGroup.add(outerRing);

  // 4 Crosshair Ticks
  const tickMat = new THREE.MeshBasicMaterial({
    color: '#FF5722',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  [
    { x: 0, z: 0.52, w: 0.035, l: 0.12 },
    { x: 0, z: -0.52, w: 0.035, l: 0.12 },
    { x: 0.52, z: 0, w: 0.12, l: 0.035 },
    { x: -0.52, z: 0, w: 0.12, l: 0.035 },
  ].forEach((t) => {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.l), tickMat);
    tick.rotation.x = -Math.PI / 2;
    tick.position.set(t.x, 0.0015, t.z);
    predictorGroup.add(tick);
  });

  // B. Inner Contracting Timing Ring (Shrinks as timeToLand approaches 0)
  const innerRingGeo = new THREE.RingGeometry(0.045, 0.075, 36);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: '#00E676',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.002;
  predictorGroup.add(innerRing);

  // C. Ground Contact Shadow directly under the shuttlecock
  const shadowGeo = new THREE.CircleGeometry(0.08, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#1E293B',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, 0.004, 0);
  rootGroup.add(shadowMesh);

  rootGroup.add(predictorGroup);
  scene.add(rootGroup);

  // -------------------------------------------------------------
  // Internal Helpers for Trail & Orientation
  // -------------------------------------------------------------
  const _tangent = new THREE.Vector3();
  const _binormal = new THREE.Vector3();
  const _upAxis = new THREE.Vector3(0, 1, 0);

  function resetTrail(pos) {
    for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
      trailPositions[i].set(pos[0], pos[1], pos[2]);
    }
  }

  /**
   * Updates the 3D entity positions, orientation, outline shader, air trail, and landing rings.
   */
  function update(state, timeSeconds) {
    const shuttle = state.shuttle;
    const [sx, sy, sz] = shuttle.pos;

    // 1. Position & Rotation of 3D Shuttlecock Mesh
    shuttleMesh.position.set(sx, sy, sz);

    if (shuttle.rot) {
      shuttleMesh.quaternion.set(
        shuttle.rot[0],
        shuttle.rot[1],
        shuttle.rot[2],
        shuttle.rot[3]
      );
    }

    // Dynamic perspective scale: scales down when close to camera on viewmodel strings (0.72 at 0.5m -> 1.55 at >= 2.5m)
    const camPos = state.effects?.cameraPos || [0, 1.78, 5.0];
    const distToCam = Math.hypot(sx - camPos[0], sy - camPos[1], sz - camPos[2]);
    const dynamicScale = THREE.MathUtils.clamp(0.72 + (distToCam - 0.5) * 0.42, 0.72, 1.55);
    shuttleMesh.scale.setScalar(dynamicScale);

    // 2. Update Shader Uniforms (Outline & Fresnel Rim)
    updateShuttleShaderUniforms(outlineMat, bodyMat, shuttle.outlineState, timeSeconds);

    // 3. Update Ribbon Air Trail
    if (shuttle.inFlight) {
      // Shift points
      for (let i = TRAIL_MAX_POINTS - 1; i > 0; i--) {
        trailPositions[i].copy(trailPositions[i - 1]);
      }
      trailPositions[0].set(sx, sy, sz);
      ribbonMesh.visible = true;
    } else {
      ribbonMesh.visible = false;
    }

    // Rebuild ribbon geometry attributes
    const palette = OUTLINE_PALETTE[shuttle.outlineState] || OUTLINE_PALETTE.normal_navy;
    const trailCol = palette.trail;
    const posArr = ribbonGeo.attributes.position.array;
    const colArr = ribbonGeo.attributes.color.array;

    for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
      const p = trailPositions[i];
      const nextP = i < TRAIL_MAX_POINTS - 1 ? trailPositions[i + 1] : trailPositions[i];

      _tangent.subVectors(p, nextP);
      if (_tangent.lengthSq() < 1e-6) {
        _tangent.set(0, 0, 1);
      } else {
        _tangent.normalize();
      }

      _binormal.crossVectors(_tangent, _upAxis);
      if (_binormal.lengthSq() < 1e-6) {
        _binormal.set(1, 0, 0);
      } else {
        _binormal.normalize();
      }

      // Width tapers from 0.034m at head to 0.002m at tail
      const progress = i / (TRAIL_MAX_POINTS - 1);
      const halfWidth = (1.0 - progress * 0.92) * 0.018;

      // Vertex left
      const vLeft = i * 2;
      posArr[vLeft * 3] = p.x - _binormal.x * halfWidth;
      posArr[vLeft * 3 + 1] = p.y - _binormal.y * halfWidth;
      posArr[vLeft * 3 + 2] = p.z - _binormal.z * halfWidth;

      // Vertex right
      const vRight = i * 2 + 1;
      posArr[vRight * 3] = p.x + _binormal.x * halfWidth;
      posArr[vRight * 3 + 1] = p.y + _binormal.y * halfWidth;
      posArr[vRight * 3 + 2] = p.z + _binormal.z * halfWidth;

      // Alpha fades from 0.82 near head to 0.0 at tail
      const alpha = Math.max(0.0, (1.0 - progress) * 0.85);

      colArr[vLeft * 4] = trailCol.r;
      colArr[vLeft * 4 + 1] = trailCol.g;
      colArr[vLeft * 4 + 2] = trailCol.b;
      colArr[vLeft * 4 + 3] = alpha;

      colArr[vRight * 4] = trailCol.r;
      colArr[vRight * 4 + 1] = trailCol.g;
      colArr[vRight * 4 + 2] = trailCol.b;
      colArr[vRight * 4 + 3] = alpha;
    }

    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonGeo.attributes.color.needsUpdate = true;

    // 4. Update Ground Landing Predictor Rings
    if (shuttle.inFlight && shuttle.landingTarget) {
      predictorGroup.visible = true;
      const [tx, tz] = shuttle.landingTarget;
      predictorGroup.position.set(tx, 0.012, tz);

      // Contracting ring radius based on remaining timeToLand or height
      const tNorm = Math.min(1.0, Math.max(0.05, (shuttle.timeToLand || 0) / 1.4));
      const contractedRadius = 0.08 + tNorm * 0.32;
      innerRing.scale.set(contractedRadius / 0.05, contractedRadius / 0.05, 1);

      // Color feedback on landing ring
      if (shuttle.outlineState === 'sweet_spot_green') {
        innerRingMat.color.set('#00E676');
        outerRingMat.color.set('#00E676');
        tickMat.color.set('#00E676');
      } else if (shuttle.outlineState === 'smash_flame') {
        innerRingMat.color.set('#FF3D00');
        outerRingMat.color.set('#FF9100');
        tickMat.color.set('#FF9100');
      } else if (shuttle.outlineState === 'drop_cyan') {
        innerRingMat.color.set('#00B0FF');
        outerRingMat.color.set('#00B0FF');
        tickMat.color.set('#00B0FF');
      } else {
        innerRingMat.color.set('#FF5722');
        outerRingMat.color.set('#FF5722');
        tickMat.color.set('#FF5722');
      }
    } else {
      predictorGroup.visible = false;
    }

    // 5. Update Contact Shadow under shuttlecock
    shadowMesh.position.set(sx, 0.005, sz);
    const shadowScale = Math.max(0.4, Math.min(2.8, 0.6 + sy * 0.35));
    shadowMesh.scale.set(shadowScale, shadowScale, 1);
    shadowMat.opacity = Math.max(0.08, Math.min(0.55, 0.55 - sy * 0.08));
  }

  return {
    rootGroup,
    shuttleMesh,
    predictorGroup,
    resetTrail,
    update,
  };
}

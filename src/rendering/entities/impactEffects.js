import * as THREE from 'three';

/**
 * 3D Impact VFX System (Dual Shockwave Rings & 16 Radial Streak Sparks)
 * Renders high-fidelity kinetic impact bursts facing the shot velocity vector.
 * Synchronizes with state.effects for deterministic testing & telemetry.
 */
export function createImpactEffects(scene) {
  const container = new THREE.Group();
  container.name = 'impact-effects-system';
  scene.add(container);

  // 1. Dual Shockwave Rings Geometry & Materials
  // Inner Ring: Sleek razor-thin core wavefront ring
  const innerRingGeom = new THREE.RingGeometry(0.042, 0.050, 48);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);

  // Outer Ring: Sleek razor-thin outer wavefront ring
  const outerRingGeom = new THREE.RingGeometry(0.075, 0.086, 48);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xff3d00,
    transparent: true,
    opacity: 0.80,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);

  const ringGroup = new THREE.Group();
  ringGroup.add(innerRing);
  ringGroup.add(outerRing);
  ringGroup.visible = false;
  container.add(ringGroup);

  // 2. 16 Radial Sparks Geometry & Material
  const SPARK_COUNT = 16;
  const sparkPositions = new Float32Array(SPARK_COUNT * 2 * 3); // 2 vertices per line, 3 coords
  const sparkColors = new Float32Array(SPARK_COUNT * 2 * 3);

  const sparkGeom = new THREE.BufferGeometry();
  sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeom.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));

  const sparkMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    linewidth: 2,
  });

  const sparksMesh = new THREE.LineSegments(sparkGeom, sparkMat);
  sparksMesh.visible = false;
  container.add(sparksMesh);

  // Spark velocity vectors and length scalars
  const sparkData = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkData.push({
      dirX: 0,
      dirY: 0,
      dirZ: 0,
      speed: 1.0,
      length: 0.12,
    });
  }

  let active = false;
  let timer = 0.0;
  let duration = 0.28;
  const originPos = new THREE.Vector3();
  const normalVec = new THREE.Vector3(0, 0, -1);
  const tangentU = new THREE.Vector3();
  const tangentV = new THREE.Vector3();

  function getShotColor(shotType, quality) {
    // SMASH outer wavefront is ALWAYS radiant orange-coral (#FF3D00)
    if (shotType === 'SMASH') {
      return 0xff3d00;
    }
    // DRIVE outer wavefront is electric amber (#FF9100)
    if (shotType === 'DRIVE') {
      return 0xff9100;
    }
    // Sweet spot quality for other shots uses bright emerald mint
    if (quality === 'sweet_spot') {
      return 0x00e676;
    }
    switch (shotType) {
      case 'CLEAR':
      case 'ATTACKING_CLEAR':
        return 0x00e5ff; // Nordic cyan
      case 'DROP':
      case 'NET_SHOT':
        return 0x76ff03; // Lime green
      case 'LIFT':
      default:
        return 0x29b6f6; // Sky blue
    }
  }

  function triggerImpact(pos, vel, shotType = 'CLEAR', quality = 'normal') {
    active = true;
    timer = 0.0;
    duration = shotType === 'SMASH' ? 0.32 : 0.24;

    originPos.set(pos[0], pos[1], pos[2]);
    ringGroup.position.copy(originPos);

    // Orient shockwave ring to face velocity or flight vector
    if (vel && (vel[0] !== 0 || vel[1] !== 0 || vel[2] !== 0)) {
      normalVec.set(vel[0], vel[1], vel[2]).normalize();
    } else {
      normalVec.set(0, 0, -1);
    }

    // Orient ring so its normal matches flight direction
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const ringQuat = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normalVec);
    ringGroup.quaternion.copy(ringQuat);

    // Compute tangent coordinate frame perpendicular to normal for radial sparks
    if (Math.abs(normalVec.y) < 0.95) {
      tangentU.crossVectors(normalVec, new THREE.Vector3(0, 1, 0)).normalize();
    } else {
      tangentU.crossVectors(normalVec, new THREE.Vector3(1, 0, 0)).normalize();
    }
    tangentV.crossVectors(normalVec, tangentU).normalize();

    // Set ring colors
    const shotColorHex = getShotColor(shotType, quality);
    const shotColor = new THREE.Color(shotColorHex);
    outerRingMat.color.copy(shotColor);

    if (shotType === 'SMASH') {
      innerRingMat.color.setHex(quality === 'sweet_spot' ? 0xffd54f : 0xffffff);
    } else if (quality === 'sweet_spot') {
      innerRingMat.color.setHex(0x00e676);
    } else {
      innerRingMat.color.setHex(0xfff9c4);
    }

    ringGroup.scale.set(1.0, 1.0, 1.0);
    ringGroup.visible = true;
    innerRingMat.opacity = 0.85;
    outerRingMat.opacity = 0.80;

    // Initialize 16 radial sparks expanding radially outwards
    const speedBase = shotType === 'SMASH' ? 4.8 : 3.2;
    const posArr = sparkGeom.attributes.position.array;
    const colArr = sparkGeom.attributes.color.array;

    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Radial direction along tangent plane with slight forward cone
      const rX = tangentU.x * cosA + tangentV.x * sinA + normalVec.x * 0.18;
      const rY = tangentU.y * cosA + tangentV.y * sinA + normalVec.y * 0.18;
      const rZ = tangentU.z * cosA + tangentV.z * sinA + normalVec.z * 0.18;

      const len = Math.hypot(rX, rY, rZ) || 1;
      const dirX = rX / len;
      const dirY = rY / len;
      const dirZ = rZ / len;

      sparkData[i].dirX = dirX;
      sparkData[i].dirY = dirY;
      sparkData[i].dirZ = dirZ;
      sparkData[i].speed = speedBase * (0.8 + Math.random() * 0.5);
      sparkData[i].length = 0.08 + Math.random() * 0.08;

      const idx = i * 6;
      // Start vertex
      posArr[idx] = originPos.x;
      posArr[idx + 1] = originPos.y;
      posArr[idx + 2] = originPos.z;
      // End vertex
      posArr[idx + 3] = originPos.x;
      posArr[idx + 4] = originPos.y;
      posArr[idx + 5] = originPos.z;

      // Inner color: brilliant white
      colArr[idx] = 1.0;
      colArr[idx + 1] = 1.0;
      colArr[idx + 2] = 0.95;

      // Outer color: shot accent color
      colArr[idx + 3] = shotColor.r;
      colArr[idx + 4] = shotColor.g;
      colArr[idx + 5] = shotColor.b;
    }

    sparkGeom.attributes.position.needsUpdate = true;
    sparkGeom.attributes.color.needsUpdate = true;
    sparkMat.opacity = 0.9;
    sparksMesh.visible = true;
  }

  function update(state, dt) {
    if (!active) return;

    timer += dt;
    const progress = Math.min(1.0, timer / duration);

    if (progress >= 1.0) {
      active = false;
      ringGroup.visible = false;
      sparksMesh.visible = false;
      if (state && state.effects) {
        state.effects.shockwaveActive = false;
        state.effects.shockwaveAlpha = 0.0;
      }
      return;
    }

    // Expanding scale: rapid burst initially, supersonic wavefront expanding cleanly to ~3.2x
    const easeOutQuad = 1 - (1 - progress) * (1 - progress);
    const ringScale = 1.0 + easeOutQuad * 2.2;
    ringGroup.scale.set(ringScale, ringScale, ringScale);

    // Alpha decay: quadratic falloff
    const alpha = (1.0 - progress) * (1.0 - progress);
    innerRingMat.opacity = alpha * 0.85;
    outerRingMat.opacity = alpha * 0.80;
    sparkMat.opacity = alpha * 0.85;

    // Update 16 radial sparks positions
    const posArr = sparkGeom.attributes.position.array;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const sp = sparkData[i];
      const travelDist = sp.speed * timer;
      const tailDist = Math.max(0, travelDist - sp.length);

      const idx = i * 6;
      // Head of spark
      posArr[idx] = originPos.x + sp.dirX * travelDist;
      posArr[idx + 1] = originPos.y + sp.dirY * travelDist;
      posArr[idx + 2] = originPos.z + sp.dirZ * travelDist;

      // Tail of spark
      posArr[idx + 3] = originPos.x + sp.dirX * tailDist;
      posArr[idx + 4] = originPos.y + sp.dirY * tailDist;
      posArr[idx + 5] = originPos.z + sp.dirZ * tailDist;
    }
    sparkGeom.attributes.position.needsUpdate = true;

    // Synchronize to state.effects for deterministic verification
    if (state && state.effects) {
      state.effects.shockwaveActive = true;
      state.effects.shockwaveScale = Number(ringScale.toFixed(3));
      state.effects.shockwaveAlpha = Number(alpha.toFixed(3));
    }
  }

  function reset() {
    active = false;
    ringGroup.visible = false;
    sparksMesh.visible = false;
  }

  return {
    triggerImpact,
    update,
    reset,
    container,
  };
}

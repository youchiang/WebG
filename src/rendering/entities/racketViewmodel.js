import * as THREE from 'three';

/**
 * 3D Ellipse Curve for isometric badminton racket frame.
 */
class RacketHeadCurve extends THREE.Curve {
  constructor(xRadius = 0.10, yRadius = 0.128) {
    super();
    this.xRadius = xRadius;
    this.yRadius = yRadius;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const angle = 2 * Math.PI * t;
    return optionalTarget.set(
      this.xRadius * Math.sin(angle),
      this.yRadius * Math.cos(angle),
      0
    );
  }
}

/**
 * Creates the First-Person 3D Badminton Racket & Arm Viewmodel.
 *
 * Refactored 2-level hierarchy:
 * rootGroup (syncs with camera world transform)
 *   └── wristPivotGroup (wrist joint in camera space; NEVER spins 180° around Y)
 *         ├── racketMesh (performs axial shaft spin 0 rad Forehand <-> Math.PI rad Backhand)
 *         │     ├── headGroup (carbon isometric oval frame + asymmetric accents + string bed)
 *         │     ├── tJoint + Front/Back color badges
 *         │     ├── shaft
 *         │     ├── cone + Front/Back color badges
 *         │     ├── grip (centered at y = 0.0, which is the wrist pivot)
 *         │     └── butt cap
 *         └── armGroup (anchored at (0, 0, 0) wrist pivot; 100% locked to grip handle)
 *               ├── palm (wrapped around grip)
 *               ├── thumbMesh (slides up to press cone back in Backhand "反拍拇指頂後蓋")
 *               ├── wristband (Coral athletic band right below butt cap)
 *               └── arm (forearm cylinder extending toward player shoulder)
 *   └── swingArcMesh (translucent 3D swing ribbon)
 */
export function createRacketViewmodel(scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'RacketViewmodel';

  // Wrist joint pivot in camera space
  const wristPivotGroup = new THREE.Group();
  wristPivotGroup.name = 'WristPivotGroup';
  rootGroup.add(wristPivotGroup);

  const racketMesh = new THREE.Group();
  racketMesh.name = 'BadmintonRacket';
  wristPivotGroup.add(racketMesh);

  // -------------------------------------------------------------
  // 1. Materials
  // -------------------------------------------------------------
  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.35,
    metalness: 0.25,
  });

  const accentCoralMat = new THREE.MeshStandardMaterial({
    color: '#FF5722',
    roughness: 0.3,
    metalness: 0.2,
  });

  const accentCyanMat = new THREE.MeshStandardMaterial({
    color: '#00E5FF',
    roughness: 0.3,
    metalness: 0.2,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.65,
    metalness: 0.05,
  });

  const armMat = new THREE.MeshStandardMaterial({
    color: '#D6A786',
    roughness: 0.72,
    metalness: 0.02,
  });

  const wristbandMat = new THREE.MeshStandardMaterial({
    color: '#FF5722',
    roughness: 0.5,
    metalness: 0.05,
  });

  // -------------------------------------------------------------
  // 2. 3D Racket Geometry (Shifted so (0,0,0) is Center of Grip)
  // -------------------------------------------------------------
  // Head at y = +0.465
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.465, 0);

  // Isometric Oval Carbon Frame
  const headCurve = new RacketHeadCurve(0.10, 0.128);
  const frameGeo = new THREE.TubeGeometry(headCurve, 48, 0.0048, 10, true);
  const frameMesh = new THREE.Mesh(frameGeo, carbonMat);
  frameMesh.castShadow = true;
  headGroup.add(frameMesh);

  // Asymmetric Frame Accents so 180° shaft spin visibly flips Coral and Cyan sides:
  // Right side (+X): Coral accents
  const accentRightTop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.045, 0.012), accentCoralMat);
  accentRightTop.position.set(0.095, 0.065, 0);
  accentRightTop.rotation.z = -0.4;
  headGroup.add(accentRightTop);

  const accentRightBottom = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.035, 0.012), accentCoralMat);
  accentRightBottom.position.set(0.092, -0.065, 0);
  accentRightBottom.rotation.z = 0.4;
  headGroup.add(accentRightBottom);

  // Left side (-X): Cyan accents
  const accentLeftTop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.045, 0.012), accentCyanMat);
  accentLeftTop.position.set(-0.095, 0.065, 0);
  accentLeftTop.rotation.z = 0.4;
  headGroup.add(accentLeftTop);

  const accentLeftBottom = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.035, 0.012), accentCyanMat);
  accentLeftBottom.position.set(-0.092, -0.065, 0);
  accentLeftBottom.rotation.z = -0.4;
  headGroup.add(accentLeftBottom);

  // Crossed String Bed (14 mains + 16 crosses with center logo)
  const stringPositions = [];
  const stringColors = [];
  const whiteCol = new THREE.Color('#FFFFFF');
  const logoCol = new THREE.Color('#FF5722');

  const mainCount = 14;
  for (let i = 0; i < mainCount; i++) {
    const x = -0.082 + (i / (mainCount - 1)) * 0.164;
    const normX = x / 0.10;
    if (Math.abs(normX) < 0.98) {
      const h = 0.128 * Math.sqrt(Math.max(0, 1.0 - normX * normX));
      stringPositions.push(x, -h, 0, x, h, 0);
      const isCenter = Math.abs(x) < 0.035;
      const c = isCenter ? logoCol : whiteCol;
      stringColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }

  const crossCount = 16;
  for (let i = 0; i < crossCount; i++) {
    const y = -0.11 + (i / (crossCount - 1)) * 0.22;
    const normY = y / 0.128;
    if (Math.abs(normY) < 0.98) {
      const w = 0.10 * Math.sqrt(Math.max(0, 1.0 - normY * normY));
      stringPositions.push(-w, y, 0, w, y, 0);
      const isCenter = Math.abs(y) < 0.035;
      const c = isCenter ? logoCol : whiteCol;
      stringColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }

  const stringGeo = new THREE.BufferGeometry();
  stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(stringPositions, 3));
  stringGeo.setAttribute('color', new THREE.Float32BufferAttribute(stringColors, 3));
  const stringMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
  });
  const stringBed = new THREE.LineSegments(stringGeo, stringMat);
  headGroup.add(stringBed);
  racketMesh.add(headGroup);

  // T-Joint at y = +0.333
  const tJointGeo = new THREE.CylinderGeometry(0.007, 0.0055, 0.028, 14);
  const tJoint = new THREE.Mesh(tJointGeo, carbonMat);
  tJoint.position.set(0, 0.333, 0);
  racketMesh.add(tJoint);

  // T-Joint front (+Z Coral) and back (-Z Cyan) badges
  const tJointBadgeF = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.022, 0.003), accentCoralMat);
  tJointBadgeF.position.set(0, 0.333, 0.006);
  racketMesh.add(tJointBadgeF);

  const tJointBadgeB = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.022, 0.003), accentCyanMat);
  tJointBadgeB.position.set(0, 0.333, -0.006);
  racketMesh.add(tJointBadgeB);

  // Carbon Slim Shaft at y = +0.220
  const shaftGeo = new THREE.CylinderGeometry(0.0035, 0.0038, 0.22, 14);
  const shaft = new THREE.Mesh(shaftGeo, carbonMat);
  shaft.position.set(0, 0.220, 0);
  shaft.castShadow = true;
  racketMesh.add(shaft);

  // Cone at y = +0.095
  const coneGeo = new THREE.CylinderGeometry(0.0042, 0.0125, 0.03, 14);
  const cone = new THREE.Mesh(coneGeo, carbonMat);
  cone.position.set(0, 0.095, 0);
  racketMesh.add(cone);

  // Cone front (+Z Coral) and back (-Z Cyan) badges
  const coneBadgeF = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.004), accentCoralMat);
  coneBadgeF.position.set(0, 0.095, 0.009);
  racketMesh.add(coneBadgeF);

  const coneBadgeB = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.004), accentCyanMat);
  coneBadgeB.position.set(0, 0.095, -0.009);
  racketMesh.add(coneBadgeB);

  // Grip at y = 0.0 (Wrist Pivot Point!)
  const gripGeo = new THREE.CylinderGeometry(0.013, 0.0142, 0.165, 8);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.set(0, 0.0, 0);
  grip.castShadow = true;
  racketMesh.add(grip);

  // Butt Cap at y = -0.087
  const buttGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.012, 8);
  const butt = new THREE.Mesh(buttGeo, carbonMat);
  butt.position.set(0, -0.087, 0);
  racketMesh.add(butt);

  // -------------------------------------------------------------
  // 3. Hand & Arm Viewmodel (Child of wristPivotGroup, Locked to Grip)
  // -------------------------------------------------------------
  const armGroup = new THREE.Group();
  armGroup.name = 'PlayerArm';
  wristPivotGroup.add(armGroup);

  // Stylized Palm centered coaxially on grip at (0, 0.005, 0)
  const palmGeo = new THREE.CylinderGeometry(0.018, 0.019, 0.075, 14);
  const palm = new THREE.Mesh(palmGeo, armMat);
  palm.position.set(0, 0.005, 0);
  armGroup.add(palm);

  // 3D Thumb mesh (slides between Forehand side-wrap and Backhand thumb-up ridge)
  const thumbGeo = new THREE.CylinderGeometry(0.0065, 0.0075, 0.045, 12);
  const thumbMesh = new THREE.Mesh(thumbGeo, armMat);
  armGroup.add(thumbMesh);

  // Forearm pivot anchored at exact center of butt cap (0, -0.085, 0)
  const forearmPivot = new THREE.Group();
  forearmPivot.name = 'ForearmPivot';
  forearmPivot.position.set(0, -0.085, 0);
  armGroup.add(forearmPivot);

  // Athletic Coral Wristband coaxially inside forearmPivot (x=0, z=0, rot 0,0,0)
  const wristGeo = new THREE.CylinderGeometry(0.023, 0.025, 0.042, 16);
  const wristband = new THREE.Mesh(wristGeo, wristbandMat);
  wristband.position.set(0, -0.016, 0);
  wristband.rotation.set(0, 0, 0);
  forearmPivot.add(wristband);

  // Forearm cylinder extending coaxially seamlessly from wristband (x=0, z=0, rot 0,0,0)
  const armGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.28, 16);
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(0, -0.150, 0);
  arm.rotation.set(0, 0, 0);
  forearmPivot.add(arm);

  // -------------------------------------------------------------
  // 4. Translucent 3D Swing Arc Ribbon
  // -------------------------------------------------------------
  const arcSegments = 16;
  const arcPositions = new Float32Array(arcSegments * 2 * 3);
  const arcColors = new Float32Array(arcSegments * 2 * 4);
  const arcIndices = new Uint16Array((arcSegments - 1) * 6);

  let aIdx = 0;
  for (let i = 0; i < arcSegments - 1; i++) {
    const v = i * 2;
    arcIndices[aIdx++] = v;
    arcIndices[aIdx++] = v + 1;
    arcIndices[aIdx++] = v + 2;
    arcIndices[aIdx++] = v + 1;
    arcIndices[aIdx++] = v + 3;
    arcIndices[aIdx++] = v + 2;
  }

  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
  arcGeo.setAttribute('color', new THREE.BufferAttribute(arcColors, 4));
  arcGeo.setIndex(new THREE.BufferAttribute(arcIndices, 1));

  const arcMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const swingArcMesh = new THREE.Mesh(arcGeo, arcMat);
  swingArcMesh.name = 'RacketSwingArc';
  swingArcMesh.visible = false;
  rootGroup.add(swingArcMesh);

  scene.add(rootGroup);

  // -------------------------------------------------------------
  // Dynamic State & Interpolation Trackers
  // -------------------------------------------------------------
  let currentSpinY = 0.0;
  const currentWristPos = new THREE.Vector3(0.28, -0.32, -0.48);
  const currentWristQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, -0.20, -0.20, 'YXZ'));

  const currentThumbPos = new THREE.Vector3(-0.015, 0.02, 0.012);
  const currentThumbQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, -0.5));

  const _targetWristQuat = new THREE.Quaternion();
  const _thumbTargetPos = new THREE.Vector3();
  const _thumbTargetQuat = new THREE.Quaternion();

  let activeSwingType = 'NONE';
  let activeSwingDuration = 0.18;

  function triggerSwing(shotType = 'SMASH', duration = 0.18) {
    activeSwingType = shotType;
    activeSwingDuration = duration;
  }

  /**
   * Updates racket viewmodel pose, slerp/lerp transition, dynamic face tilts,
   * swing whip animation, and syncs rootGroup to camera world space.
   */
  function update(camera, state, dt) {
    const isForehand = state.player.grip === 'forehand';
    const [vx, vy] = state.player.virtualCursor;

    // 1. Calculate Biomechanically Accurate Target Wrist Position & Euler Angles
    let targetWristPosX = 0;
    let targetWristPosY = 0;
    let targetWristPosZ = -0.48;
    let targetPitchX = 0;
    let targetYawY = 0;
    let targetRollZ = 0;

    if (isForehand) {
      // Forehand (Q1 / Q4): Right side of screen, open palm
      targetWristPosX = 0.28 + (vx / 360) * 0.09;
      targetWristPosY = -0.29 + (vy / 220) * 0.10;
      targetPitchX = -0.18 + (vy / 220) * 0.28;
      targetYawY = -0.20 - (vx / 360) * 0.20;
      targetRollZ = -0.20;
    } else {
      // Backhand (Q2 / Q3): Reaching across chest to left-center, head tilted to the LEFT
      targetWristPosX = -0.08 + (vx / 360) * 0.10;
      targetWristPosY = -0.28 + (vy / 220) * 0.10;
      targetPitchX = -0.16 + (vy / 220) * 0.28;
      targetYawY = +0.24 - (vx / 360) * 0.20;
      targetRollZ = +0.46; // +26° tilts shaft & head cleanly to LEFT (x ≈ -0.28 to -0.35)
    }

    // 2. Swing Whip Animation on wristPivotGroup (Local -Z is ALWAYS forward toward net!)
    if (state.player.swingTimer > 0) {
      state.player.swingTimer = Math.max(0, state.player.swingTimer - dt);
      const progress = 1.0 - (state.player.swingTimer / activeSwingDuration);

      let whipForward = 0.0;
      let whipPitch = 0.0;
      let whipRoll = 0.0;

      if (progress < 0.25) {
        const p1 = progress / 0.25;
        whipForward = -0.05 * p1; // cock back
        whipPitch = 0.15 * p1;
      } else if (progress < 0.65) {
        const p2 = (progress - 0.25) / 0.40;
        whipForward = -0.05 + 0.22 * Math.sin(p2 * Math.PI * 0.5); // explode forward toward -Z
        whipPitch = 0.15 - 0.65 * p2; // downward snap
        whipRoll = (isForehand ? -0.35 : 0.35) * p2;
      } else {
        const p3 = (progress - 0.65) / 0.35;
        whipForward = 0.17 * (1.0 - p3);
        whipPitch = -0.50 * (1.0 - p3);
        whipRoll = (isForehand ? -0.35 : 0.35) * (1.0 - p3);
      }

      targetWristPosZ -= whipForward; // -whipForward drives in -Z direction (forward toward net)
      targetPitchX += whipPitch;
      targetRollZ += whipRoll;

      // Update 3D Swing Arc Ribbon
      if (progress >= 0.25 && progress <= 0.75) {
        swingArcMesh.visible = true;
        const arcCol =
          activeSwingType === 'SMASH'
            ? new THREE.Color('#FF9100')
            : activeSwingType === 'DROP' || activeSwingType === 'NET_SHOT'
            ? new THREE.Color('#00E5FF')
            : isForehand
            ? new THREE.Color('#FF5722')
            : new THREE.Color('#2D6A4F');

        // Tip position in camera local space
        const tipLocal = new THREE.Vector3(0, 0.593, 0);
        tipLocal.applyEuler(racketMesh.rotation);
        tipLocal.applyQuaternion(wristPivotGroup.quaternion);
        tipLocal.add(wristPivotGroup.position);

        const arcP = swingArcMesh.geometry.attributes.position.array;
        const arcC = swingArcMesh.geometry.attributes.color.array;

        for (let i = 0; i < arcSegments; i++) {
          const t = i / (arcSegments - 1);
          const ang = (t - 0.5) * 1.5;
          const px = tipLocal.x + Math.sin(ang) * (isForehand ? 0.16 : -0.16);
          const py = tipLocal.y + Math.cos(ang) * 0.14 - 0.10;
          const pz = tipLocal.z - t * 0.22;

          const v0 = i * 2;
          arcP[v0 * 3] = px;
          arcP[v0 * 3 + 1] = py;
          arcP[v0 * 3 + 2] = pz;

          arcP[(v0 + 1) * 3] = px;
          arcP[(v0 + 1) * 3 + 1] = py - 0.04;
          arcP[(v0 + 1) * 3 + 2] = pz;

          const alpha = Math.sin(t * Math.PI) * 0.8;
          arcC[v0 * 4] = arcCol.r;
          arcC[v0 * 4 + 1] = arcCol.g;
          arcC[v0 * 4 + 2] = arcCol.b;
          arcC[v0 * 4 + 3] = alpha;

          arcC[(v0 + 1) * 4] = arcCol.r;
          arcC[(v0 + 1) * 4 + 1] = arcCol.g;
          arcC[(v0 + 1) * 4 + 2] = arcCol.b;
          arcC[(v0 + 1) * 4 + 3] = alpha * 0.5;
        }
        swingArcMesh.geometry.attributes.position.needsUpdate = true;
        swingArcMesh.geometry.attributes.color.needsUpdate = true;
      } else {
        swingArcMesh.visible = false;
      }
    } else {
      swingArcMesh.visible = false;
    }

    // 3. Smooth Frame-Rate Independent Slerp/Lerp on Wrist Pivot
    const smoothFactor = 1.0 - Math.exp(-14.0 * dt);
    currentWristPos.lerp(new THREE.Vector3(targetWristPosX, targetWristPosY, targetWristPosZ), smoothFactor);
    _targetWristQuat.setFromEuler(new THREE.Euler(targetPitchX, targetYawY, targetRollZ, 'YXZ'));
    currentWristQuat.slerp(_targetWristQuat, smoothFactor);

    wristPivotGroup.position.copy(currentWristPos);
    wristPivotGroup.quaternion.copy(currentWristQuat);

    // 4. Axial Shaft Spin on Racket Mesh (0.0 in Forehand <-> Math.PI in Backhand)
    const targetSpinY = isForehand ? 0.0 : Math.PI;
    currentSpinY = THREE.MathUtils.lerp(currentSpinY, targetSpinY, smoothFactor);
    racketMesh.rotation.y = currentSpinY;

    // 5. Thumb Grip Morphing (Forehand wrap <-> Backhand thumb-up ridge)
    if (isForehand) {
      _thumbTargetPos.set(-0.015, 0.02, 0.012);
      _thumbTargetQuat.setFromEuler(new THREE.Euler(0.2, 0, -0.5));
    } else {
      _thumbTargetPos.set(0.0, 0.055, 0.016);
      _thumbTargetQuat.setFromEuler(new THREE.Euler(0.1, 0, 0));
    }
    currentThumbPos.lerp(_thumbTargetPos, smoothFactor);
    currentThumbQuat.slerp(_thumbTargetQuat, smoothFactor);
    thumbMesh.position.copy(currentThumbPos);
    thumbMesh.quaternion.copy(currentThumbQuat);

    // 6. Gentle wrist bend on forearmPivot so forearm stays aligned with wrist in both poses
    forearmPivot.rotation.set(0.08, 0, isForehand ? -0.06 : -0.14);

    // 7. Transform Root Group from Camera Space to World Space
    rootGroup.position.copy(camera.position);
    rootGroup.quaternion.copy(camera.quaternion);
    rootGroup.updateMatrixWorld();

    // 8. Compute Derived 3D Racket Face Normal for state reflection
    const faceNormalCamera = new THREE.Vector3(0, 0, -1).applyQuaternion(wristPivotGroup.quaternion);
    const worldFaceNormal = faceNormalCamera.applyQuaternion(camera.quaternion).normalize();
    state.player.racketFaceNormal = [worldFaceNormal.x, worldFaceNormal.y, worldFaceNormal.z];
  }

  /**
   * Computes the exact 3D world-space coordinate of the center of the racket string bed on screen.
   * This is where the shuttlecock, dual shockwave rings, and ribbon trail visually erupt from!
   */
  function getStringBedWorldPosition(camera = null) {
    if (camera) {
      rootGroup.position.copy(camera.position);
      rootGroup.quaternion.copy(camera.quaternion);
      rootGroup.updateMatrixWorld();
    }
    const stringBedLocal = new THREE.Vector3(0, 0.465, 0.0);
    stringBedLocal.applyQuaternion(wristPivotGroup.quaternion);
    stringBedLocal.add(wristPivotGroup.position);
    const worldPos = stringBedLocal.applyMatrix4(rootGroup.matrixWorld);
    return [worldPos.x, worldPos.y, worldPos.z];
  }

  return {
    rootGroup,
    wristPivotGroup,
    racketMesh,
    armGroup,
    forearmPivot,
    swingArcMesh,
    triggerSwing,
    update,
    getStringBedWorldPosition,
  };
}

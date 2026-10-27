import * as THREE from 'three';

/**
 * 3D Opponent Player Avatar & Racket System (Milestone 5)
 * Renders an articulated opponent player across the net (Z < 0):
 * - Dynamic ground tactical ring (#38BDF8 in AI Match mode, #FFB300 in Feeder mode)
 * - Athletic shoes, shorts, Nordic slate-blue jersey (#2B5B84), headband
 * - Articulated right arm and 3D badminton racket that swings on returns!
 */
export function createOpponentEntity(scene) {
  const opponentGroup = new THREE.Group();
  opponentGroup.name = 'opponent-entity';
  scene.add(opponentGroup);

  // 1. Tactical Ground Indicator Ring (changes color based on playMode)
  const ringGeo = new THREE.RingGeometry(0.36, 0.44, 36);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#38BDF8',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.008;
  opponentGroup.add(ringMesh);

  // 2. Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#D6A786',
    roughness: 0.75,
    metalness: 0.05,
  });
  const jerseyMat = new THREE.MeshStandardMaterial({
    color: '#2B5B84',
    roughness: 0.65,
    metalness: 0.08,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.70,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    roughness: 0.50,
  });
  const whiteTrimMat = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.40,
  });
  const racketFrameMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.35,
    metalness: 0.5,
  });
  const stringMat = new THREE.MeshBasicMaterial({
    color: '#F1F5F9',
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });

  // 3. Body Hierarchy
  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0;
  opponentGroup.add(bodyRoot);

  // Shoes & Feet
  [-0.14, 0.14].forEach((xOffset) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), shoeMat);
    shoe.position.set(xOffset, 0.04, 0.02);
    shoe.castShadow = true;
    bodyRoot.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.02, 0.225), whiteTrimMat);
    sole.position.set(xOffset, 0.01, 0.02);
    bodyRoot.add(sole);
  });

  // Legs
  [-0.14, 0.14].forEach((xOffset) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.042, 0.45, 16), skinMat);
    leg.position.set(xOffset, 0.30, 0);
    leg.castShadow = true;
    bodyRoot.add(leg);
  });

  // Shorts
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.26, 18), shortsMat);
  shorts.position.set(0, 0.65, 0);
  shorts.castShadow = true;
  bodyRoot.add(shorts);

  // Torso / Jersey
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.52, 18), jerseyMat);
  torso.position.set(0, 1.02, 0);
  torso.castShadow = true;
  bodyRoot.add(torso);

  // White Jersey Stripe
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.214, 0.214, 0.06, 18), whiteTrimMat);
  stripe.position.set(0, 1.15, 0);
  bodyRoot.add(stripe);

  // Neck & Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.10, 14), skinMat);
  neck.position.set(0, 1.32, 0);
  bodyRoot.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 20), skinMat);
  head.position.set(0, 1.48, 0);
  head.scale.set(1.0, 1.15, 1.05);
  head.castShadow = true;
  bodyRoot.add(head);

  // Sporty Headband
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.02, 12, 24), whiteTrimMat);
  headband.rotation.x = Math.PI / 2;
  headband.position.set(0, 1.51, 0);
  bodyRoot.add(headband);

  // Left Arm (Relaxed balance arm)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.25, 1.20, 0);
  bodyRoot.add(leftShoulder);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.42, 12), skinMat);
  leftArm.position.set(-0.06, -0.18, 0.06);
  leftArm.rotation.z = 0.25;
  leftArm.rotation.x = -0.3;
  leftShoulder.add(leftArm);

  // Right Arm & Racket (Striking Arm)
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.25, 1.22, 0);
  bodyRoot.add(rightShoulder);

  const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.28, 12), skinMat);
  rightUpperArm.position.set(0.06, -0.12, 0.06);
  rightUpperArm.rotation.z = -0.4;
  rightUpperArm.rotation.x = -0.3;
  rightShoulder.add(rightUpperArm);

  const elbowPivot = new THREE.Group();
  elbowPivot.position.set(0.12, -0.24, 0.12);
  rightShoulder.add(elbowPivot);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.26, 12), skinMat);
  rightForearm.position.set(0.04, 0.10, 0.08);
  rightForearm.rotation.x = 0.8;
  elbowPivot.add(rightForearm);

  // Racket Pivot held in right hand
  const racketPivot = new THREE.Group();
  racketPivot.position.set(0.06, 0.22, 0.18);
  elbowPivot.add(racketPivot);

  // 3D Miniature Racket Model
  // Grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 12), whiteTrimMat);
  grip.position.set(0, 0.08, 0);
  racketPivot.add(grip);

  // Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.38, 10), racketFrameMat);
  shaft.position.set(0, 0.35, 0);
  racketPivot.add(shaft);

  // Head Frame (Isometric oval ring)
  const headFrame = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.009, 12, 32), racketFrameMat);
  headFrame.position.set(0, 0.64, 0);
  headFrame.scale.set(1.0, 1.28, 1.0);
  racketPivot.add(headFrame);

  // String Bed
  const stringBed = new THREE.Mesh(new THREE.CircleGeometry(0.105, 24), stringMat);
  stringBed.position.set(0, 0.64, 0);
  stringBed.scale.set(1.0, 1.26, 1.0);
  racketPivot.add(stringBed);

  // Smash Warning Aura (Glowing halo around racket head)
  const auraGeo = new THREE.TorusGeometry(0.22, 0.028, 12, 32);
  const auraMat = new THREE.MeshBasicMaterial({
    color: '#FF3D00',
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const smashAuraMesh = new THREE.Mesh(auraGeo, auraMat);
  smashAuraMesh.position.set(0, 0.64, 0);
  smashAuraMesh.visible = false;
  racketPivot.add(smashAuraMesh);

  // Initial ready posture (holding racket upright forward)
  racketPivot.rotation.x = 0.45;
  racketPivot.rotation.z = -0.25;

  let swingTimer = 0;
  const swingDuration = 0.24;

  function update(state, dt) {
    if (!state.opponent) return;

    // 1. Sync World Position [X, Y, Z]
    const [ox, oy, oz] = state.opponent.pos;
    opponentGroup.position.set(ox, oy, oz);

    // Opponent faces player (toward +Z direction)
    opponentGroup.rotation.y = 0;

    // 2. Tactical Ring Color according to playMode & Smash Charging
    const isChargingSmash = Boolean(state.opponent.chargingSmash);
    if (isChargingSmash) {
      ringMat.color.set('#FF3D00'); // Blazing crimson-orange
      const pulse = 1.0 + Math.sin(state.elapsedTime * 16) * 0.22;
      ringMesh.scale.set(pulse, pulse, 1.0);

      smashAuraMesh.visible = true;
      smashAuraMesh.rotation.z += dt * 6.5;
      const auraPulse = 1.0 + Math.sin(state.elapsedTime * 20) * 0.25;
      smashAuraMesh.scale.set(auraPulse, auraPulse, auraPulse);
    } else {
      ringMesh.scale.set(1.0, 1.0, 1.0);
      smashAuraMesh.visible = false;
      if (state.playMode === 'feeder') {
        ringMat.color.set('#FFB300'); // Amber in Feeder mode
      } else {
        ringMat.color.set('#38BDF8'); // Cyan in AI Match mode
      }
    }

    // 3. Dynamic Racket Swing & Smash Windup Animation
    if (state.opponent.swingTimer > 0) {
      swingTimer = state.opponent.swingTimer;
      state.opponent.swingTimer = Math.max(0, state.opponent.swingTimer - dt);
      const progress = 1.0 - Math.min(1.0, state.opponent.swingTimer / swingDuration);

      // Snappy forward whip swing arc (ready -> forward snap -> follow through)
      const swingAngle = Math.sin(progress * Math.PI) * 1.6;
      racketPivot.rotation.x = 0.45 + swingAngle * 1.1;
      racketPivot.rotation.y = Math.sin(progress * Math.PI) * 0.8;
      elbowPivot.rotation.x = -Math.sin(progress * Math.PI) * 0.6;
      rightShoulder.rotation.set(0, 0, 0);
    } else if (isChargingSmash) {
      // Cocked-back overhead smash preparation posture!
      rightShoulder.rotation.x = -0.75; // cocked back overhead
      rightShoulder.rotation.z = -0.65; // elbow raised high
      elbowPivot.rotation.x = -0.55;
      racketPivot.rotation.x = -0.85;   // racket poised behind head
      racketPivot.rotation.y = 0.25;
    } else {
      // Idle ready breathing / balance
      rightShoulder.rotation.set(0, 0, 0);
      const idleSway = Math.sin(state.elapsedTime * 3.2) * 0.05;
      racketPivot.rotation.x = 0.45 + idleSway;
      racketPivot.rotation.y = 0;
      elbowPivot.rotation.x = 0;
    }
  }

  return {
    group: opponentGroup,
    update,
  };
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GAME_CONSTANTS } from '../core/constants.js';

export class VehicleMesh {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.wheelMeshes = [];
    this.frontWheelGroups = [];
    this.taillightMat = null;
    this.boostFlames = [];

    // Roof Beacons
    this.beaconMatLeft = null;
    this.beaconMatRight = null;
    this.beaconTime = 0;

    // Stacked Trash Bags inside Hopper
    this.hopperBags = [];

    // Airborne Flung Trash Bags Pool
    this.flyingBags = [];
    this.flyingBagsGroup = new THREE.Group();
    this.scene.add(this.flyingBagsGroup);

    this.buildCarModel();
    this.buildHopperTrashBags();
    this.initFlyingTrashBagsPool();
  }

  buildCarModel() {
    // 1. Materials (Taiwan Trash Truck Pastel/Anime Aesthetic)
    const truckYellowMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_PRIMARY || 0xFACC15,
    });
    const cabYellowMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_CABIN || 0xFDE047,
    });
    const whiteMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_SECONDARY || 0xFAFBFD,
    });
    const greenStripeMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_STRIPE || 0x22C55E,
    });
    const glassMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_GLASS || 0x93C5FD,
    });
    const darkChassisMat = new THREE.MeshLambertMaterial({
      color: 0x1E293B,
    });
    this.taillightMat = new THREE.MeshBasicMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_TAILLIGHT || 0xF87171,
    });
    this.beaconMatLeft = new THREE.MeshBasicMaterial({
      color: 0xF59E0B,
    });
    this.beaconMatRight = new THREE.MeshBasicMaterial({
      color: 0xEF4444,
    });

    // 2. Heavy Truck Frame / Chassis
    const chassisGeo = new RoundedBoxGeometry(2.1, 0.35, 4.4, 2, 0.08);
    const chassis = new THREE.Mesh(chassisGeo, darkChassisMat);
    chassis.position.y = 0.42;
    chassis.castShadow = true;
    this.group.add(chassis);

    // 3. Flat-Face Front Cab (平頭式駕駛艙: z: +0.8 ~ +2.1)
    const cabGeo = new RoundedBoxGeometry(2.05, 1.15, 1.35, 2, 0.10);
    const cab = new THREE.Mesh(cabGeo, cabYellowMat);
    cab.position.set(0, 1.25, 1.45);
    cab.castShadow = true;
    this.group.add(cab);

    // Front Bumper (White)
    const bumperGeo = new RoundedBoxGeometry(2.18, 0.36, 0.38, 2, 0.08);
    const bumper = new THREE.Mesh(bumperGeo, whiteMat);
    bumper.position.set(0, 0.50, 2.15);
    bumper.castShadow = true;
    this.group.add(bumper);

    // Front Grille & Face Plate
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.28, 0.06), whiteMat);
    grille.position.set(0, 0.95, 2.14);
    this.group.add(grille);

    // Headlights (Warm Yellow/White)
    [-0.75, 0.75].forEach((x) => {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.16, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xFEF08A })
      );
      light.position.set(x, 0.85, 2.15);
      this.group.add(light);
    });

    // Front Windshield (Large panoramic front glass)
    const windshieldGeo = new THREE.BoxGeometry(1.85, 0.55, 0.06);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.45, 2.14);
    this.group.add(windshield);

    // Side Windows
    [-1.04, 1.04].forEach((x) => {
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.65), glassMat);
      sideWin.position.set(x, 1.45, 1.5);
      this.group.add(sideWin);
    });

    // Side Mirrors (Brackets + Mirror head)
    [-1.15, 1.15].forEach((x) => {
      const mirrorBracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), darkChassisMat);
      mirrorBracket.position.set(x * 0.95, 1.38, 1.85);
      this.group.add(mirrorBracket);

      const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.12), whiteMat);
      mirrorHead.position.set(x, 1.38, 1.85);
      this.group.add(mirrorHead);
    });

    // Roof Warning Beacons (雙旋轉閃爍警示燈)
    const beaconBaseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.08, 12);
    const beaconDomeGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.15, 12);

    [-0.55, 0.55].forEach((x, idx) => {
      const base = new THREE.Mesh(beaconBaseGeo, darkChassisMat);
      base.position.set(x, 1.85, 1.45);
      this.group.add(base);

      const dome = new THREE.Mesh(beaconDomeGeo, idx === 0 ? this.beaconMatLeft : this.beaconMatRight);
      dome.position.set(x, 1.95, 1.45);
      this.group.add(dome);
    });

    // 4. Rear Compactor Body (後方壓縮車斗: z: -1.2 ~ +0.7)
    const compactorGeo = new RoundedBoxGeometry(2.18, 1.35, 2.15, 2, 0.12);
    const compactor = new THREE.Mesh(compactorGeo, truckYellowMat);
    compactor.position.set(0, 1.35, -0.25);
    compactor.castShadow = true;
    this.group.add(compactor);

    // Compactor Side Stripes (White banner + Eco green stripe)
    const whiteStripe = new THREE.Mesh(new THREE.BoxGeometry(2.21, 0.18, 2.05), whiteMat);
    whiteStripe.position.set(0, 1.42, -0.25);
    this.group.add(whiteStripe);

    const greenStripe = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.09, 2.05), greenStripeMat);
    greenStripe.position.set(0, 1.25, -0.25);
    this.group.add(greenStripe);

    // 5. Open Rear Hopper (敞開式尾斗: z: -2.3 ~ -1.3)
    // Hopper Floor
    const hopperFloor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.32, 1.15), darkChassisMat);
    hopperFloor.position.set(0, 0.68, -1.82);
    hopperFloor.castShadow = true;
    this.group.add(hopperFloor);

    // Hopper Side Walls (Yellow)
    [-1.02, 1.02].forEach((x) => {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 1.15), truckYellowMat);
      sideWall.position.set(x, 1.10, -1.82);
      this.group.add(sideWall);
    });

    // Top Angled Hood / Canopy above Hopper
    const hopperCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 0.65), truckYellowMat);
    hopperCanopy.position.set(0, 1.70, -1.60);
    hopperCanopy.rotation.x = 0.22;
    this.group.add(hopperCanopy);

    // Worker Footplate / Rear Bumper
    const footplate = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.35), darkChassisMat);
    footplate.position.set(0, 0.45, -2.42);
    this.group.add(footplate);

    // Taillights
    [-0.75, 0.75].forEach((x) => {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.06), this.taillightMat);
      light.position.set(x, 0.65, -2.43);
      this.group.add(light);
    });

    // 6. Wheels (Front-Left, Front-Right, Rear-Left, Rear-Right)
    const wheelPositions = [
      { x: -1.05, y: 0.38, z: 1.45, isFront: true },
      { x: 1.05, y: 0.38, z: 1.45, isFront: true },
      { x: -1.05, y: 0.38, z: -1.35, isFront: false },
      { x: 1.05, y: 0.38, z: -1.35, isFront: false },
    ];

    // Radial segments 20 for smoother round tires
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 20);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1E293B });

    wheelPositions.forEach((pos) => {
      const wheelMount = new THREE.Group();
      wheelMount.position.set(pos.x, pos.y, pos.z);

      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      wheelMount.add(tireMesh);

      // White Wheel Hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), whiteMat);
      hub.rotateZ(Math.PI / 2);
      wheelMount.add(hub);

      this.group.add(wheelMount);
      this.wheelMeshes.push(tireMesh);

      if (pos.isFront) {
        this.frontWheelGroups.push(wheelMount);
      }
    });

    // 7. Boost Flames at Exhausts
    [-0.45, 0.45].forEach((x) => {
      const flameGeo = new THREE.ConeGeometry(0.18, 0.7, 8);
      flameGeo.rotateX(-Math.PI / 2);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, 0.38, -2.55);
      this.group.add(flame);
      this.boostFlames.push(flame);
    });
  }

  /**
   * Build 30 stacked black trash bags tightly nestled in the rear hopper
   */
  buildHopperTrashBags() {
    this.hopperBags = [];

    // Distinct black/charcoal plastic shades with subtle specular highlights
    const bagColors = [0x1E293B, 0x0F172A, 0x27272A, 0x334155, 0x18181B];
    const bagMaterials = bagColors.map(c => new THREE.MeshLambertMaterial({ color: c }));

    const lumpGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const knotGeo = new THREE.ConeGeometry(0.06, 0.08, 5);
    knotGeo.rotateX(Math.PI);

    // 30 structured slot positions in the hopper (-0.75..0.75, z: -2.25..-1.45, y: 0.85..1.55)
    // Layer 0: 12 bags (bottom)
    // Layer 1: 10 bags (middle)
    // Layer 2: 8 bags (top mound)
    const positions = [];

    // Bottom layer (4 across x, 3 along z = 12)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = -0.65 + col * 0.43 + (Math.random() - 0.5) * 0.05;
        const z = -2.15 + row * 0.36 + (Math.random() - 0.5) * 0.05;
        const y = 0.86 + (Math.random() - 0.5) * 0.04;
        positions.push({ x, y, z });
      }
    }

    // Middle layer (10 bags)
    for (let row = 0; row < 3; row++) {
      const cols = row === 1 ? 4 : 3;
      const xStart = row === 1 ? -0.60 : -0.45;
      for (let col = 0; col < cols; col++) {
        const x = xStart + col * 0.42 + (Math.random() - 0.5) * 0.05;
        const z = -2.05 + row * 0.34 + (Math.random() - 0.5) * 0.05;
        const y = 1.14 + (Math.random() - 0.5) * 0.04;
        positions.push({ x, y, z });
      }
    }

    // Top layer (8 bags, visible on top)
    for (let i = 0; i < 8; i++) {
      const x = -0.50 + (i % 3) * 0.46 + (Math.random() - 0.5) * 0.06;
      const z = -2.00 + Math.floor(i / 3) * 0.38 + (Math.random() - 0.5) * 0.06;
      const y = 1.40 + (Math.random() - 0.5) * 0.05;
      positions.push({ x, y, z });
    }

    // Create the 30 bag meshes inside the vehicle group
    positions.forEach((pos, idx) => {
      const bagGroup = new THREE.Group();
      bagGroup.position.set(pos.x, pos.y, pos.z);

      const mat = bagMaterials[idx % bagMaterials.length];
      const lump = new THREE.Mesh(lumpGeo, mat);
      // Slight non-uniform squishing for plastic bag feel
      lump.scale.set(1.08 + Math.random() * 0.12, 0.88 + Math.random() * 0.12, 1.05 + Math.random() * 0.12);
      lump.castShadow = true;
      bagGroup.add(lump);

      // Tied plastic knot on top
      const knot = new THREE.Mesh(knotGeo, mat);
      knot.position.y = 0.18;
      knot.rotation.z = (Math.random() - 0.5) * 0.4;
      bagGroup.add(knot);

      this.group.add(bagGroup);
      this.hopperBags.push(bagGroup);
    });
  }

  /**
   * Pre-allocate pool of 25 flying trash bags for parabolic ejection animation
   */
  initFlyingTrashBagsPool() {
    this.flyingBags = [];
    const lumpGeo = new THREE.DodecahedronGeometry(0.20, 1);
    const knotGeo = new THREE.ConeGeometry(0.07, 0.09, 5);
    knotGeo.rotateX(Math.PI);

    const bagMat = new THREE.MeshLambertMaterial({ color: 0x1E293B });

    for (let i = 0; i < 25; i++) {
      const bagGroup = new THREE.Group();
      bagGroup.visible = false;

      const lump = new THREE.Mesh(lumpGeo, bagMat);
      lump.scale.set(1.1, 0.88, 1.05);
      bagGroup.add(lump);

      const knot = new THREE.Mesh(knotGeo, bagMat);
      knot.position.y = 0.20;
      bagGroup.add(knot);

      this.flyingBagsGroup.add(bagGroup);

      this.flyingBags.push({
        active: false,
        group: bagGroup,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 2.2,
      });
    }
  }

  /**
   * Eject a trash bag from the rear hopper along a dynamic parabolic trajectory
   */
  ejectTrashBag(ejectionData, vehiclePhysics) {
    for (const b of this.flyingBags) {
      if (!b.active) {
        b.active = true;
        b.life = 0;
        b.group.visible = true;
        b.group.scale.set(1, 1, 1);

        // Spawn position: rear hopper in world coordinates
        const localOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 1.0,
          1.1 + Math.random() * 0.4,
          -2.1
        );
        if (vehiclePhysics.bodyQuaternion) {
          localOffset.applyQuaternion(vehiclePhysics.bodyQuaternion);
        }
        b.pos.copy(vehiclePhysics.position).add(localOffset);
        b.group.position.copy(b.pos);

        // Calculate exit velocity
        // 1. Inherit forward vehicle velocity
        b.vel.copy(vehiclePhysics.velocity).multiplyScalar(0.72);

        // 2. Centrifugal outward fling along vehicle right
        const sideSign = ejectionData.outwardSign || (Math.random() > 0.5 ? 1 : -1);
        const sideSpeed = sideSign * (3.5 + Math.random() * 2.8);
        b.vel.addScaledVector(vehiclePhysics.right, sideSpeed);

        // 3. Upward parabolic bounce (3.2 ~ 5.6 m/s)
        b.vel.y += 3.4 + Math.random() * 2.2;

        // Rapid tumble spin
        b.spin.set(
          (Math.random() - 0.5) * 14.0,
          (Math.random() - 0.5) * 18.0,
          (Math.random() - 0.5) * 14.0
        );

        break;
      }
    }
  }

  update(vehiclePhysics, dt) {
    // 1. Sync position and orientation
    this.group.position.copy(vehiclePhysics.position);

    if (vehiclePhysics.bodyQuaternion) {
      this.group.quaternion.copy(vehiclePhysics.bodyQuaternion);
    } else {
      this.group.rotation.set(0, 0, 0);
      this.group.rotation.y = vehiclePhysics.yaw;
      this.group.rotation.x = vehiclePhysics.pitch;
      this.group.rotation.z = vehiclePhysics.roll;
    }

    // 2. Roof Warning Beacons Flashing Animation
    this.beaconTime += dt * 8.0;
    const pulseLeft = Math.sin(this.beaconTime);
    const pulseRight = Math.sin(this.beaconTime + Math.PI);

    if (this.beaconMatLeft) {
      this.beaconMatLeft.color.setHex(pulseLeft > 0 ? 0xFBBF24 : 0x78350F);
    }
    if (this.beaconMatRight) {
      this.beaconMatRight.color.setHex(pulseRight > 0 ? 0xEF4444 : 0x7F1D1D);
    }

    // 3. Spin wheels
    const rollAngle = (vehiclePhysics.speed * dt) / 0.38;
    this.wheelMeshes.forEach((wheel) => {
      wheel.rotation.x += rollAngle;
    });

    // 4. Steer front wheels
    // During drift: show countersteer (wheel angle opposite to beta, scaled)
    // Normal: turn wheels into the turn (negative rotation.y points to -X / screen right)
    let wheelAngle = 0;
    if (vehiclePhysics.isDrifting) {
      wheelAngle = -vehiclePhysics.slipAngle * 0.65 - vehiclePhysics.steerInput * 0.15;
    } else {
      wheelAngle = -vehiclePhysics.steerInput * 0.45;
    }

    this.frontWheelGroups.forEach((mount) => {
      mount.rotation.y = wheelAngle;
    });

    // 5. Update Stacked Trash Bags Visibility
    // Hide bags from top to bottom as trashBagsRemaining decreases
    const remaining = vehiclePhysics.trashBagsRemaining !== undefined ? vehiclePhysics.trashBagsRemaining : 30;
    const totalBags = this.hopperBags.length;
    for (let i = 0; i < totalBags; i++) {
      // Bags at higher indices are at the top and disappear first
      this.hopperBags[i].visible = (i < remaining);
    }

    // 6. Update Airborne Flung Trash Bags
    const roadY = vehiclePhysics.position.y;
    for (const b of this.flyingBags) {
      if (b.active) {
        b.life += dt;
        if (b.life >= b.maxLife) {
          b.active = false;
          b.group.visible = false;
          continue;
        }

        // Gravity pull
        b.vel.y -= 15.0 * dt;
        b.pos.addScaledVector(b.vel, dt);

        // Ground bounce on road surface
        if (b.pos.y < roadY - 0.2) {
          b.pos.y = roadY - 0.2;
          b.vel.y = Math.max(0, -b.vel.y * 0.32); // Restitution bounce
          b.vel.x *= 0.88; // Friction
          b.vel.z *= 0.88;
        }

        b.group.position.copy(b.pos);
        b.group.rotation.x += b.spin.x * dt;
        b.group.rotation.y += b.spin.y * dt;
        b.group.rotation.z += b.spin.z * dt;

        // Graceful fade/shrink in last 0.35s of life
        const timeLeft = b.maxLife - b.life;
        if (timeLeft < 0.35) {
          const s = Math.max(0.01, timeLeft / 0.35);
          b.group.scale.set(s, s, s);
        }
      }
    }

    // 7. Boost flames
    const isBoosting = vehiclePhysics.throttleInput > 0.2;
    this.boostFlames.forEach((flame) => {
      flame.material.opacity = isBoosting ? 0.85 + Math.random() * 0.15 : 0;
      if (isBoosting) {
        flame.scale.setScalar(0.8 + Math.random() * 0.5);
      }
    });

    // 8. Taillight glow on drift/brake
    if (this.taillightMat) {
      if (vehiclePhysics.isDrifting || vehiclePhysics.throttleInput < -0.1) {
        this.taillightMat.color.setHex(0xFF1E1E);
      } else {
        this.taillightMat.color.setHex(0xB91C1C);
      }
    }
  }
}

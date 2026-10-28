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

    this.buildCarModel();
  }

  buildCarModel() {
    // 1. Materials (smooth shading without flatShading for rounded modern anime car)
    const bodyMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_PRIMARY,
    });
    const whiteMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_SECONDARY,
    });
    const glassMat = new THREE.MeshLambertMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_GLASS,
      roughness: 0.1,
    });
    const darkMat = new THREE.MeshLambertMaterial({
      color: 0x1E293B,
    });
    this.taillightMat = new THREE.MeshBasicMaterial({
      color: GAME_CONSTANTS.COLORS.CAR_TAILLIGHT,
    });

    // 2. Main Lower Body Chassis (Rounded Box)
    const lowerBodyGeo = new RoundedBoxGeometry(2.1, 0.65, 4.3, 2, 0.12);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
    lowerBody.position.y = 0.55;
    lowerBody.castShadow = true;
    this.group.add(lowerBody);

    // Front Bumper Wedge (Rounded Box)
    const noseGeo = new RoundedBoxGeometry(2.0, 0.45, 1.0, 2, 0.08);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.45, 2.2);
    this.group.add(nose);

    // 3. Cabin & White Roof (Rounded Box)
    const cabinGeo = new RoundedBoxGeometry(1.7, 0.75, 2.3, 2, 0.10);
    const cabin = new THREE.Mesh(cabinGeo, whiteMat);
    cabin.position.set(0, 1.15, -0.2);
    cabin.castShadow = true;
    this.group.add(cabin);

    // Windshield (Front angled glass)
    const windshieldGeo = new THREE.BoxGeometry(1.6, 0.65, 0.1);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.15, 0.95);
    windshield.rotation.x = 0.35;
    this.group.add(windshield);

    // Rear Window
    const rearWinGeo = new THREE.BoxGeometry(1.6, 0.65, 0.1);
    const rearWin = new THREE.Mesh(rearWinGeo, glassMat);
    rearWin.position.set(0, 1.15, -1.35);
    rearWin.rotation.x = -0.35;
    this.group.add(rearWin);

    // 4. Rear Drift Spoiler / Wing (Rounded Box)
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x0F172A });
    const wingGeo = new RoundedBoxGeometry(2.2, 0.08, 0.45, 2, 0.03);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 1.35, -2.1);
    this.group.add(wing);

    // Spoiler Struts
    [-0.6, 0.6].forEach((x) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.15), wingMat);
      strut.position.set(x, 1.1, -2.1);
      this.group.add(strut);
    });

    // 5. Taillights
    [-0.75, 0.75].forEach((x) => {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), this.taillightMat);
      light.position.set(x, 0.65, -2.18);
      this.group.add(light);
    });

    // 6. Wheels (Front-Left, Front-Right, Rear-Left, Rear-Right)
    const wheelPositions = [
      { x: -1.05, y: 0.38, z: 1.35, isFront: true },
      { x: 1.05, y: 0.38, z: 1.35, isFront: true },
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

      // Hubcap
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
      flame.position.set(x, 0.35, -2.4);
      this.group.add(flame);
      this.boostFlames.push(flame);
    });
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

    // 2. Spin wheels
    const rollAngle = (vehiclePhysics.speed * dt) / 0.38;
    this.wheelMeshes.forEach((wheel) => {
      wheel.rotation.x += rollAngle;
    });

    // 3. Steer front wheels
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

    // 4. Boost flames
    const isBoosting = vehiclePhysics.throttleInput > 0.2;
    this.boostFlames.forEach((flame) => {
      flame.material.opacity = isBoosting ? 0.85 + Math.random() * 0.15 : 0;
      if (isBoosting) {
        flame.scale.setScalar(0.8 + Math.random() * 0.5);
      }
    });

    // 5. Taillight glow on drift/brake
    if (this.taillightMat) {
      if (vehiclePhysics.isDrifting || vehiclePhysics.throttleInput < -0.1) {
        this.taillightMat.color.setHex(0xFF1E1E);
      } else {
        this.taillightMat.color.setHex(0xB91C1C);
      }
    }
  }
}

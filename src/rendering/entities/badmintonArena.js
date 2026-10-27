import * as THREE from 'three';
import { COURT_SPEC } from '../../core/constants.js';
import {
  createMapleWoodTexture,
  createCourtMatTexture,
  createNetMeshTexture,
  createArenaWallTexture,
  createAcousticSlatTexture,
  createDadoPadTexture,
  createABoardTexture,
} from '../textures/arenaTextures.js';

/**
 * Builds the complete realistic sports arena, lighting, court, lines, and net.
 */
export function buildBadmintonArena(scene) {
  const arenaGroup = new THREE.Group();
  arenaGroup.name = 'BadmintonArena';

  // 1. Calibrated Tournament Arena Lighting (anti-glare, rich mid-tones, no wash-out)
  const hemiLight = new THREE.HemisphereLight(0xf4f7fa, 0xd8cfc2, 0.95);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  // Main directional light
  const sunLight = new THREE.DirectionalLight(0xfffdf7, 1.05);
  sunLight.position.set(5.5, 13.5, 6.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 30;
  sunLight.shadow.camera.left = -9;
  sunLight.shadow.camera.right = 9;
  sunLight.shadow.camera.top = 9;
  sunLight.shadow.camera.bottom = -9;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  // Secondary gentle counter-fill light
  const fillLight = new THREE.DirectionalLight(0xe8f0f8, 0.30);
  fillLight.position.set(-5.0, 10.0, -5.0);
  scene.add(fillLight);

  // 2. Outer Warm Maple Wood Floor (#F3E9DC -> #EAD7C3)
  const woodTexture = createMapleWoodTexture();
  const woodFloorGeo = new THREE.PlaneGeometry(26, 30);
  const woodFloorMat = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.6,
    metalness: 0.02,
  });
  const woodFloor = new THREE.Mesh(woodFloorGeo, woodFloorMat);
  woodFloor.rotation.x = -Math.PI / 2;
  woodFloor.position.y = -0.004;
  woodFloor.receiveShadow = true;
  woodFloor.name = 'MapleWoodFloor';
  arenaGroup.add(woodFloor);

  // 3. Badminton Court PVC Mat (#98C9A3 classic mint/sage green)
  const courtMatTexture = createCourtMatTexture();

  // Outer safety margin of the court mat (7.6m x 15.0m)
  const outerMatGeo = new THREE.PlaneGeometry(7.6, 15.0);
  const outerMatMaterial = new THREE.MeshStandardMaterial({
    color: '#8FC29B',
    roughness: 0.85,
    metalness: 0.0,
  });
  const outerMat = new THREE.Mesh(outerMatGeo, outerMatMaterial);
  outerMat.rotation.x = -Math.PI / 2;
  outerMat.position.y = 0.001;
  outerMat.receiveShadow = true;
  arenaGroup.add(outerMat);

  // Main BWF Court Surface (6.1m x 13.4m)
  const courtGeo = new THREE.PlaneGeometry(COURT_SPEC.width, COURT_SPEC.length);
  const courtMaterial = new THREE.MeshStandardMaterial({
    map: courtMatTexture,
    color: '#98C9A3',
    roughness: 0.82,
    metalness: 0.0,
  });
  const courtSurface = new THREE.Mesh(courtGeo, courtMaterial);
  courtSurface.rotation.x = -Math.PI / 2;
  courtSurface.position.y = 0.002;
  courtSurface.receiveShadow = true;
  courtSurface.name = 'MintCourtMat';
  arenaGroup.add(courtSurface);

  // 4. Crisp Pure White (#FFFFFF) 3D Raised Boundary Lines (40mm wide)
  const linesGroup = new THREE.Group();
  linesGroup.name = 'CourtWhiteLines';
  const lineMaterial = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const lw = COURT_SPEC.lineWidth; // 0.04m
  const lh = 0.0025; // 2.5mm raised 3D line
  const ly = 0.0038;

  function addLine(width, length, x, z, name) {
    const geo = new THREE.BoxGeometry(width, lh, length);
    const mesh = new THREE.Mesh(geo, lineMaterial);
    mesh.position.set(x, ly, z);
    if (name) mesh.name = name;
    linesGroup.add(mesh);
  }

  const fullW = COURT_SPEC.width; // 6.10m
  const fullL = COURT_SPEC.length; // 13.40m
  const halfW = COURT_SPEC.halfWidth; // 3.05m
  const halfSinglesW = COURT_SPEC.halfSinglesWidth; // 2.59m
  const halfL = COURT_SPEC.halfLength; // 6.70m
  const shortS = COURT_SPEC.shortServiceDist; // 1.98m
  const longSDoubles = COURT_SPEC.doublesLongServiceDist; // 5.94m

  // Horizontal lines (along X axis)
  // Baselines (Z = ±6.70m, line center at ±(6.70 - 0.02))
  addLine(fullW, lw, 0, halfL - lw / 2, 'BaselinePlayer');
  addLine(fullW, lw, 0, -(halfL - lw / 2), 'BaselineOpponent');

  // Doubles Long Service Lines (Z = ±5.94m)
  addLine(fullW, lw, 0, longSDoubles, 'DoublesLongServicePlayer');
  addLine(fullW, lw, 0, -longSDoubles, 'DoublesLongServiceOpponent');

  // Short Service Lines (Z = ±1.98m)
  addLine(fullW, lw, 0, shortS, 'ShortServicePlayer');
  addLine(fullW, lw, 0, -shortS, 'ShortServiceOpponent');

  // Longitudinal lines (along Z axis)
  // Doubles Sidelines (X = ±3.05m)
  addLine(lw, fullL, halfW - lw / 2, 0, 'DoublesSidelineRight');
  addLine(lw, fullL, -(halfW - lw / 2), 0, 'DoublesSidelineLeft');

  // Singles Sidelines (X = ±2.59m)
  addLine(lw, fullL, halfSinglesW, 0, 'SinglesSidelineRight');
  addLine(lw, fullL, -halfSinglesW, 0, 'SinglesSidelineLeft');

  // Center Service Lines (X = 0, from short service line 1.98m to baseline 6.70m)
  const centerLineLen = halfL - shortS; // 4.72m
  const centerLineMidZ = shortS + centerLineLen / 2; // 4.34m
  addLine(lw, centerLineLen, 0, centerLineMidZ, 'CenterLinePlayer');
  addLine(lw, centerLineLen, 0, -centerLineMidZ, 'CenterLineOpponent');

  // Center floor reference marks at Z = 0
  addLine(0.18, 0.02, 0, 0, 'NetCenterFloorMark');

  arenaGroup.add(linesGroup);

  // 5. 3D Net & Posts (1.55m at sidelines, 1.524m at center)
  const netGroup = new THREE.Group();
  netGroup.name = 'BadmintonNetGroup';

  const postMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    roughness: 0.35,
    metalness: 0.3,
  });
  const basePlateMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.5,
    metalness: 0.2,
  });

  [-halfW, halfW].forEach((xPos, idx) => {
    // Cylindrical vertical post (1.55m height)
    const postGeo = new THREE.CylinderGeometry(0.032, 0.038, COURT_SPEC.netHeightPosts, 20);
    const postMesh = new THREE.Mesh(postGeo, postMat);
    postMesh.position.set(xPos, COURT_SPEC.netHeightPosts / 2, 0);
    postMesh.castShadow = true;
    postMesh.name = idx === 0 ? 'NetPostLeft' : 'NetPostRight';
    netGroup.add(postMesh);

    // Post top cap
    const capGeo = new THREE.SphereGeometry(0.034, 16, 12);
    const capMesh = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
    capMesh.position.set(xPos, COURT_SPEC.netHeightPosts, 0);
    netGroup.add(capMesh);

    // Weighted floor base
    const baseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.03, 20);
    const baseMesh = new THREE.Mesh(baseGeo, basePlateMat);
    baseMesh.position.set(xPos, 0.015, 0);
    netGroup.add(baseMesh);
  });

  // Delicate White Woven Net Mesh (Y from 0.76m to 1.524m)
  const netHeight = COURT_SPEC.netHeightCenter - COURT_SPEC.netBottomHeight; // 0.764m
  const netCenterY = COURT_SPEC.netBottomHeight + netHeight / 2; // 1.142m
  const netMeshTexture = createNetMeshTexture();
  const netPlaneGeo = new THREE.PlaneGeometry(COURT_SPEC.width, netHeight, 24, 4);

  // Apply gentle catenary dip to net geometry vertices so center is 1.524m and edges are 1.55m
  const posAttr = netPlaneGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const t = Math.abs(vx) / halfW; // 0 at center, 1 at posts
    const sagLift = (COURT_SPEC.netHeightPosts - COURT_SPEC.netHeightCenter) * (t * t);
    posAttr.setY(i, vy + sagLift);
  }
  netPlaneGeo.computeVertexNormals();

  const netMeshMat = new THREE.MeshStandardMaterial({
    map: netMeshTexture,
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.9,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const netMesh = new THREE.Mesh(netPlaneGeo, netMeshMat);
  netMesh.position.set(0, netCenterY, 0);
  netMesh.castShadow = false;
  netMesh.name = 'NetWovenMesh';
  netGroup.add(netMesh);

  // Crisp White Top Tape (#FFFFFF, 75mm height) with catenary curve
  const tapeSegments = 20;
  const segWidth = COURT_SPEC.width / tapeSegments;
  const whiteTapeMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const bottomRopeMat = new THREE.MeshBasicMaterial({ color: '#F1F5F9' });

  for (let i = 0; i < tapeSegments; i++) {
    const xCenter = -halfW + (i + 0.5) * segWidth;
    const t = Math.abs(xCenter) / halfW;
    const topY =
      COURT_SPEC.netHeightCenter +
      (COURT_SPEC.netHeightPosts - COURT_SPEC.netHeightCenter) * (t * t);

    // Top 75mm white tape
    const tapeGeo = new THREE.BoxGeometry(segWidth + 0.002, 0.075, 0.016);
    const tapeSeg = new THREE.Mesh(tapeGeo, whiteTapeMat);
    tapeSeg.position.set(xCenter, topY - 0.075 / 2, 0);
    netGroup.add(tapeSeg);

    // Bottom cord trim
    const botGeo = new THREE.BoxGeometry(segWidth + 0.002, 0.02, 0.01);
    const botSeg = new THREE.Mesh(botGeo, bottomRopeMat);
    botSeg.position.set(xCenter, COURT_SPEC.netBottomHeight + topY - COURT_SPEC.netHeightCenter, 0);
    netGroup.add(botSeg);
  }

  // Vertical white side tapes next to the posts
  [-halfW + 0.02, halfW - 0.02].forEach((xPos) => {
    const sideTapeGeo = new THREE.BoxGeometry(0.04, netHeight, 0.014);
    const sideTape = new THREE.Mesh(sideTapeGeo, whiteTapeMat);
    sideTape.position.set(xPos, netCenterY + 0.015, 0);
    netGroup.add(sideTape);
  });

  arenaGroup.add(netGroup);

  // 6. Realistic Sports Arena Multi-Tier Wall Architecture
  // Y = 0m to 2.2m: Lower Padded Dado Protection Wall (Sporty Slate-Blue #5C7C99)
  // Y = 2.2m to 3.4m: Mid-Wall Warm Wood Acoustic Slat Band (#D4B996 with #B89B74 grooves)
  // Y = 3.4m to 9.5m: Upper Acoustic Wall Panels (Soft Mist Steel-Blue #9FB3C8)
  const hallHalfW = 11.5;
  const hallHalfL = 14.0;
  const wallHeight = 9.5;

  const dadoHeight = 2.2;
  const slatHeight = 1.2;
  const upperHeight = wallHeight - (dadoHeight + slatHeight); // 6.1m

  const dadoTex = createDadoPadTexture();
  const slatTex = createAcousticSlatTexture();
  const upperTex = createArenaWallTexture();

  const dadoMat = new THREE.MeshStandardMaterial({
    map: dadoTex,
    color: '#5C7C99',
    roughness: 0.82,
    metalness: 0.02,
  });
  const dadoRailMat = new THREE.MeshStandardMaterial({
    color: '#DFC8A8',
    roughness: 0.65,
    metalness: 0.05,
  });
  const slatMat = new THREE.MeshStandardMaterial({
    map: slatTex,
    roughness: 0.70,
    metalness: 0.02,
  });
  const slatRailMat = new THREE.MeshStandardMaterial({
    color: '#DFC8A8',
    roughness: 0.65,
    metalness: 0.05,
  });
  const upperWallMat = new THREE.MeshStandardMaterial({
    map: upperTex,
    color: '#9FB3C8',
    roughness: 0.88,
    metalness: 0.02,
  });
  const columnMat = new THREE.MeshStandardMaterial({
    color: '#889BAE',
    roughness: 0.80,
    metalness: 0.05,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: '#CFDCE8',
    roughness: 0.92,
    metalness: 0.0,
  });

  const wallsGroup = new THREE.Group();
  wallsGroup.name = 'ArenaWallArchitecture';

  // Helper to add a 3-tier wall face
  function addWallFace(width, pos, rotY) {
    const faceGroup = new THREE.Group();
    faceGroup.position.copy(pos);
    faceGroup.rotation.y = rotY;

    // 1. Lower Padded Dado Wall (0 to 2.2m)
    const dadoMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, dadoHeight), dadoMat);
    dadoMesh.position.set(0, dadoHeight / 2, 0);
    faceGroup.add(dadoMesh);

    // Dado top oak trim rail (Y = 2.2m)
    const dadoRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 0.08), dadoRailMat);
    dadoRail.position.set(0, dadoHeight, 0.04);
    faceGroup.add(dadoRail);

    // 2. Mid-Wall Warm Wood Acoustic Slat Band (2.2m to 3.4m)
    const slatMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, slatHeight), slatMat);
    slatMesh.position.set(0, dadoHeight + slatHeight / 2, 0);
    faceGroup.add(slatMesh);

    // Slat top oak trim rail (Y = 3.4m)
    const slatRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.06), slatRailMat);
    slatRail.position.set(0, dadoHeight + slatHeight, 0.03);
    faceGroup.add(slatRail);

    // 3. Upper Acoustic Wall Panels (3.4m to 9.5m)
    const upperMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, upperHeight), upperWallMat);
    upperMesh.position.set(0, dadoHeight + slatHeight + upperHeight / 2, 0);
    faceGroup.add(upperMesh);

    wallsGroup.add(faceGroup);
  }

  // Back wall (-Z) & Front wall (+Z)
  addWallFace(hallHalfW * 2, new THREE.Vector3(0, 0, -hallHalfL), 0);
  addWallFace(hallHalfW * 2, new THREE.Vector3(0, 0, hallHalfL), Math.PI);

  // Left wall (-X) & Right wall (+X)
  addWallFace(hallHalfL * 2, new THREE.Vector3(-hallHalfW, 0, 0), Math.PI / 2);
  addWallFace(hallHalfL * 2, new THREE.Vector3(hallHalfW, 0, 0), -Math.PI / 2);

  arenaGroup.add(wallsGroup);

  // Structural Pilasters / Columns along the walls
  const colGroup = new THREE.Group();
  colGroup.name = 'ArenaColumns';
  [-9, -4.5, 0, 4.5, 9].forEach((x) => {
    // Back wall columns
    const colBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, wallHeight, 0.24), columnMat);
    colBack.position.set(x, wallHeight / 2, -hallHalfL + 0.12);
    colGroup.add(colBack);

    // Front wall columns
    const colFront = new THREE.Mesh(new THREE.BoxGeometry(0.38, wallHeight, 0.24), columnMat);
    colFront.position.set(x, wallHeight / 2, hallHalfL - 0.12);
    colGroup.add(colFront);
  });

  [-9, -4.5, 0, 4.5, 9].forEach((z) => {
    // Left wall columns
    const colLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, wallHeight, 0.38), columnMat);
    colLeft.position.set(-hallHalfW + 0.12, wallHeight / 2, z);
    colGroup.add(colLeft);

    // Right wall columns
    const colRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, wallHeight, 0.38), columnMat);
    colRight.position.set(hallHalfW - 0.12, wallHeight / 2, z);
    colGroup.add(colRight);
  });
  arenaGroup.add(colGroup);

  // Ceiling (#CFDCE8)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(hallHalfW * 2, hallHalfL * 2), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, wallHeight, 0);
  arenaGroup.add(ceiling);

  // Steel Roof Trusses & Anti-Glare Indirect LED Gymnasium Lighting
  const trussGroup = new THREE.Group();
  trussGroup.name = 'ArenaRoofTrusses';
  const trussMat = new THREE.MeshStandardMaterial({
    color: '#9AA8BC',
    metalness: 0.35,
    roughness: 0.55,
  });
  const ledBodyMat = new THREE.MeshStandardMaterial({
    color: '#889BAE',
    roughness: 0.6,
  });
  const ledDiffuserMat = new THREE.MeshStandardMaterial({
    color: '#EBF3FA',
    emissive: '#EBF3FA',
    emissiveIntensity: 0.32,
    roughness: 0.25,
  });

  [-9.0, -4.5, 0, 4.5, 9.0].forEach((z) => {
    // Top steel chord
    const topChord = new THREE.Mesh(
      new THREE.BoxGeometry(hallHalfW * 2 - 0.5, 0.12, 0.12),
      trussMat
    );
    topChord.position.set(0, wallHeight - 0.15, z);
    trussGroup.add(topChord);

    // Bottom steel chord
    const botChord = new THREE.Mesh(
      new THREE.BoxGeometry(hallHalfW * 2 - 0.5, 0.12, 0.12),
      trussMat
    );
    botChord.position.set(0, wallHeight - 0.75, z);
    trussGroup.add(botChord);

    // Vertical web struts
    for (let x = -9; x <= 9; x += 3) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), trussMat);
      strut.position.set(x, wallHeight - 0.45, z);
      trussGroup.add(strut);
    }
  });

  // Anti-Glare LED Strips mounted along the trusses parallel to court (X = ±4.2m)
  [-4.2, 4.2].forEach((xPos) => {
    [-6.75, -2.25, 2.25, 6.75].forEach((zPos) => {
      // Fixture housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 3.2), ledBodyMat);
      housing.position.set(xPos, wallHeight - 0.79, zPos);
      trussGroup.add(housing);

      // Diffuser face pointing down
      const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 3.16), ledDiffuserMat);
      diffuser.rotation.x = Math.PI / 2;
      diffuser.position.set(xPos, wallHeight - 0.835, zPos);
      trussGroup.add(diffuser);
    });
  });
  arenaGroup.add(trussGroup);

  // 7. BWF Court Perimeter A-Boards (0.75m high surround barriers)
  // Placed cleanly around outer perimeter at Z = ±9.2m and X = ±5.4m with corner gaps
  const aBoardGroup = new THREE.Group();
  aBoardGroup.name = 'CourtPerimeterABoards';
  const aBoardMat = new THREE.MeshStandardMaterial({
    map: createABoardTexture(),
    color: '#4F7393',
    roughness: 0.78,
    metalness: 0.05,
  });
  const aBoardTrimMat = new THREE.MeshBasicMaterial({ color: '#F1F5F9' });

  function addABoard(width, x, z, rotY) {
    const boardSub = new THREE.Group();
    boardSub.position.set(x, 0, z);
    boardSub.rotation.y = rotY;

    // Main A-board box (0.75m high, 0.10m thick)
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.75, 0.10), aBoardMat);
    body.position.set(0, 0.375, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    boardSub.add(body);

    // Crisp light-ivory top edge trim (#F1F5F9)
    const topTrim = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.02, 0.03, 0.13),
      aBoardTrimMat
    );
    topTrim.position.set(0, 0.75, 0);
    boardSub.add(topTrim);

    aBoardGroup.add(boardSub);
  }

  // Back A-Board (behind opponent, Z = -9.2m, width 9.6m)
  addABoard(9.6, 0, -9.2, 0);

  // Front A-Board (behind player, Z = +9.2m, width 9.6m)
  addABoard(9.6, 0, 9.2, Math.PI);

  // Left A-Board (X = -5.4m, length 16.8m spanning Z = -8.4m to +8.4m)
  addABoard(16.8, -5.4, 0, Math.PI / 2);

  // Right A-Board (X = +5.4m, length 16.8m spanning Z = -8.4m to +8.4m)
  addABoard(16.8, 5.4, 0, -Math.PI / 2);

  arenaGroup.add(aBoardGroup);

  // 8. Opponent Ready Zone Indicator (across the net at [0, 0.005, -3.5])
  const oppMarkerGroup = new THREE.Group();
  oppMarkerGroup.position.set(0, 0.005, -3.5);
  const ringGeo = new THREE.RingGeometry(0.32, 0.38, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  oppMarkerGroup.add(ringMesh);
  arenaGroup.add(oppMarkerGroup);

  scene.add(arenaGroup);
  return arenaGroup;
}

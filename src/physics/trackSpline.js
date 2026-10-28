import * as THREE from 'three';
import { GAME_CONSTANTS } from '../core/constants.js';

/**
 * 3D Downhill Mountain Spline Curve & Coordinate Systems
 */
export class TrackSpline {
  constructor() {
    this.curve = null;
    this.totalLength = 0;
    this.sampleCount = GAME_CONSTANTS.TRACK.SEGMENTS;
    this.cachePoints = [];
    this.cacheTangents = [];
    this.cacheNormals = [];
    this.cacheBinormals = [];
    this.cacheLengths = [];

    this.initSpline();
  }

  initSpline() {
    // Design a thrilling, scenic mountain pass with 7 continuous large-radius 180° hairpins (秋名山連環髮夾彎)
    // Coordinate system: X = lateral (-105 to +105), Y = altitude (180 down to 0), Z = progression forward
    const rawWaypoints = [
      // Summit Start Area
      new THREE.Vector3(0, 180, 0),
      new THREE.Vector3(5, 176, 40),
      new THREE.Vector3(15, 172, 80),

      // 1st Hairpin Right (Switchback 1: swinging out to X: +105, 180° U-turn)
      new THREE.Vector3(50, 166, 120),
      new THREE.Vector3(85, 160, 160),
      new THREE.Vector3(105, 154, 200),
      new THREE.Vector3(95, 148, 240),
      new THREE.Vector3(60, 142, 270),
      new THREE.Vector3(10, 136, 300),

      // 2nd Hairpin Left (Switchback 2: swinging out to X: -105, 180° U-turn)
      new THREE.Vector3(-40, 130, 330),
      new THREE.Vector3(-80, 125, 360),
      new THREE.Vector3(-105, 120, 400),
      new THREE.Vector3(-95, 115, 440),
      new THREE.Vector3(-60, 110, 470),
      new THREE.Vector3(-10, 105, 500),

      // 3rd Hairpin Right (Switchback 3: swinging out to X: +105, 180° U-turn)
      new THREE.Vector3(40, 100, 530),
      new THREE.Vector3(80, 95, 560),
      new THREE.Vector3(105, 90, 600),
      new THREE.Vector3(95, 85, 640),
      new THREE.Vector3(60, 80, 670),
      new THREE.Vector3(10, 75, 700),

      // 4th Hairpin Left (Switchback 4: swinging out to X: -105, 180° U-turn)
      new THREE.Vector3(-40, 70, 730),
      new THREE.Vector3(-80, 65, 760),
      new THREE.Vector3(-105, 60, 800),
      new THREE.Vector3(-95, 55, 840),
      new THREE.Vector3(-60, 50, 870),
      new THREE.Vector3(-10, 45, 900),

      // 5th Hairpin Right (Switchback 5: swinging out to X: +105, 180° U-turn)
      new THREE.Vector3(40, 40, 930),
      new THREE.Vector3(80, 36, 960),
      new THREE.Vector3(105, 32, 1000),
      new THREE.Vector3(95, 28, 1040),
      new THREE.Vector3(60, 24, 1070),
      new THREE.Vector3(10, 20, 1100),

      // 6th Hairpin Left (Switchback 6: swinging out to X: -105, 180° U-turn)
      new THREE.Vector3(-40, 17, 1130),
      new THREE.Vector3(-80, 14, 1160),
      new THREE.Vector3(-105, 11, 1200),
      new THREE.Vector3(-95, 8, 1240),
      new THREE.Vector3(-60, 6, 1270),
      new THREE.Vector3(-10, 4, 1300),

      // 7th Hairpin Right (Switchback 7: swinging out to X: +100, 180° U-turn)
      new THREE.Vector3(40, 3, 1330),
      new THREE.Vector3(80, 2, 1365),
      new THREE.Vector3(100, 1, 1405),
      new THREE.Vector3(85, 0.5, 1445),
      new THREE.Vector3(50, 0, 1475),

      // Final Straight descent & Grandstands towards Finish Arch
      new THREE.Vector3(20, 0, 1520),
      new THREE.Vector3(10, 0, 1580),
      new THREE.Vector3(5, 0, 1640),
      new THREE.Vector3(0, 0, 1700), // Finish Line!
      new THREE.Vector3(0, 0, 1750), // Run-off area
    ];

    this.curve = new THREE.CatmullRomCurve3(rawWaypoints, false, 'catmullrom', 0.25);
    this.totalLength = this.curve.getLength();

    // Pre-sample points and frenet frames for fast queries
    this.cachePoints = this.curve.getSpacedPoints(this.sampleCount);
    for (let i = 0; i <= this.sampleCount; i++) {
      const u = i / this.sampleCount;
      const tangent = this.curve.getTangent(u).normalize();
      this.cacheTangents.push(tangent);

      // Compute banking / normal
      // Approximate road normal as generally up, but leaning slightly into curves
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      this.cacheNormals.push(normal);     // Points to Road Left
      this.cacheBinormals.push(binormal); // Points up perpendicular to road
    }
  }

  getPointAt(u) {
    const clampedU = THREE.MathUtils.clamp(u, 0, 1);
    return this.curve.getPoint(clampedU);
  }

  getTangentAt(u) {
    const clampedU = THREE.MathUtils.clamp(u, 0, 1);
    return this.curve.getTangent(clampedU).normalize();
  }

  getNormalAt(u) {
    const clampedU = THREE.MathUtils.clamp(u, 0, 1);
    const index = Math.min(this.sampleCount, Math.floor(clampedU * this.sampleCount));
    return this.cacheNormals[index] || new THREE.Vector3(1, 0, 0);
  }

  getBinormalAt(u) {
    const clampedU = THREE.MathUtils.clamp(u, 0, 1);
    const index = Math.min(this.sampleCount, Math.floor(clampedU * this.sampleCount));
    return this.cacheBinormals[index] || new THREE.Vector3(0, 1, 0);
  }

  /**
   * Fast project point onto spline
   * Returns: { u: 0..1, trackPos, roadOffset, distance }
   */
  projectPoint(pos, guessU = 0, searchWindow = 0.05) {
    let minU = Math.max(0, guessU - 0.005);
    let maxU = Math.min(1, guessU + searchWindow);
    if (guessU <= 0.001) {
      minU = 0;
      maxU = 0.15;
    }

    const steps = 30;
    let bestU = guessU;
    let bestDistSq = Infinity;

    for (let i = 0; i <= steps; i++) {
      const testU = minU + (maxU - minU) * (i / steps);
      const pt = this.curve.getPoint(testU);
      const dSq = pt.distanceToSquared(pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestU = testU;
      }
    }

    // Second pass fine refinement
    const fineDelta = (maxU - minU) / steps;
    const fineMin = Math.max(0, bestU - fineDelta);
    const fineMax = Math.min(1, bestU + fineDelta);
    for (let i = 0; i <= 10; i++) {
      const testU = fineMin + (fineMax - fineMin) * (i / 10);
      const pt = this.curve.getPoint(testU);
      const dSq = pt.distanceToSquared(pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestU = testU;
      }
    }

    const centerPos = this.curve.getPoint(bestU);
    const tangent = this.getTangentAt(bestU);
    const normal = this.getNormalAt(bestU);

    // Vector from center to pos projected onto road normal
    const toPos = new THREE.Vector3().subVectors(pos, centerPos);
    const roadOffset = toPos.dot(normal);

    return {
      u: bestU,
      centerPos,
      tangent,
      normal,
      roadOffset, // signed distance from centerline (- left, + right)
      distance: Math.sqrt(bestDistSq),
    };
  }

  /**
   * Get world coordinates from progress u and lateral offset
   */
  getWorldPosition(u, lateralOffset = 0, altitudeOffset = 0) {
    const center = this.getPointAt(u);
    const normal = this.getNormalAt(u);
    const binormal = this.getBinormalAt(u);

    return new THREE.Vector3()
      .copy(center)
      .addScaledVector(normal, lateralOffset)
      .addScaledVector(binormal, altitudeOffset);
  }
}

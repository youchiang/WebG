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
    // Design a thrilling, scenic mountain pass with hairpins, S-bends, and continuous descent
    // Coordinate system: X = lateral, Y = altitude (180 down to 0), Z = progression forward
    const rawWaypoints = [
      // Summit Start Area
      new THREE.Vector3(0, 180, 0),
      new THREE.Vector3(5, 176, 50),
      new THREE.Vector3(15, 170, 100),

      // 1st Gentle Right Sweeper
      new THREE.Vector3(45, 162, 160),
      new THREE.Vector3(80, 153, 210),

      // 1st Hairpin Left (180 deg turnaround!)
      new THREE.Vector3(95, 145, 260),
      new THREE.Vector3(75, 138, 290),
      new THREE.Vector3(35, 131, 280),
      new THREE.Vector3(5, 124, 240),

      // Downhill Chute
      new THREE.Vector3(-25, 117, 210),
      new THREE.Vector3(-60, 110, 230),

      // 2nd Hairpin Right
      new THREE.Vector3(-90, 102, 270),
      new THREE.Vector3(-85, 95, 320),
      new THREE.Vector3(-55, 88, 350),
      new THREE.Vector3(-15, 81, 370),

      // High-speed S-Curve (The "Akina" chicane)
      new THREE.Vector3(30, 74, 410),
      new THREE.Vector3(65, 67, 460),
      new THREE.Vector3(40, 60, 520),
      new THREE.Vector3(-10, 53, 570),
      new THREE.Vector3(-50, 46, 620),

      // 3rd Hairpin Left with Cliff View
      new THREE.Vector3(-80, 39, 670),
      new THREE.Vector3(-75, 33, 720),
      new THREE.Vector3(-40, 27, 750),
      new THREE.Vector3(10, 21, 760),

      // Final Straight descent & Grandstands towards Finish Arch
      new THREE.Vector3(60, 15, 800),
      new THREE.Vector3(80, 9, 870),
      new THREE.Vector3(80, 4, 940),
      new THREE.Vector3(75, 0, 1020), // Finish Line!
      new THREE.Vector3(70, 0, 1070), // Run-off area
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

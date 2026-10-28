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
    // Compact, action-packed mountain pass with 10 continuous tight hairpin/switchback turns (~1,170m total length)
    // Coordinate system: X = lateral (-40 to +40), Y = altitude (115 down to 0), Z = progression forward (0 to 720)
    const rawWaypoints = [
      // Summit Start Area (steady downhill pitch for clean launch)
      new THREE.Vector3(0, 115, 0),
      new THREE.Vector3(3, 112, 28),
      new THREE.Vector3(10, 109, 55),

      // 1st Hairpin Right (Z: 55 -> 115)
      new THREE.Vector3(28, 106, 70),
      new THREE.Vector3(40, 103.5, 85),
      new THREE.Vector3(28, 101, 100),
      new THREE.Vector3(5, 98.5, 115),

      // 2nd Hairpin Left (Z: 115 -> 175)
      new THREE.Vector3(-22, 96, 130),
      new THREE.Vector3(-40, 93.5, 145),
      new THREE.Vector3(-28, 91, 160),
      new THREE.Vector3(-5, 88.5, 175),

      // 3rd Hairpin Right (Z: 175 -> 235)
      new THREE.Vector3(22, 86, 190),
      new THREE.Vector3(40, 83.5, 205),
      new THREE.Vector3(28, 81, 220),
      new THREE.Vector3(5, 78.5, 235),

      // 4th Hairpin Left (Z: 235 -> 295)
      new THREE.Vector3(-22, 76, 250),
      new THREE.Vector3(-40, 73.5, 265),
      new THREE.Vector3(-28, 71, 280),
      new THREE.Vector3(-5, 68.5, 295),

      // 5th Hairpin Right (Z: 295 -> 355)
      new THREE.Vector3(22, 66, 310),
      new THREE.Vector3(40, 63.5, 325),
      new THREE.Vector3(28, 61, 340),
      new THREE.Vector3(5, 58.5, 355),

      // 6th Hairpin Left (Z: 355 -> 415)
      new THREE.Vector3(-22, 56, 370),
      new THREE.Vector3(-40, 53.5, 385),
      new THREE.Vector3(-28, 51, 400),
      new THREE.Vector3(-5, 48.5, 415),

      // 7th Hairpin Right (Z: 415 -> 475)
      new THREE.Vector3(22, 46, 430),
      new THREE.Vector3(40, 43.5, 445),
      new THREE.Vector3(28, 41, 460),
      new THREE.Vector3(5, 38.5, 475),

      // 8th Hairpin Left (Z: 475 -> 535)
      new THREE.Vector3(-22, 36, 490),
      new THREE.Vector3(-40, 33.5, 505),
      new THREE.Vector3(-28, 31, 520),
      new THREE.Vector3(-5, 28.5, 535),

      // 9th Hairpin Right (Z: 535 -> 595)
      new THREE.Vector3(22, 26, 550),
      new THREE.Vector3(40, 23.5, 565),
      new THREE.Vector3(28, 21, 580),
      new THREE.Vector3(5, 18.5, 595),

      // 10th Hairpin Left (Z: 595 -> 655)
      new THREE.Vector3(-22, 16, 610),
      new THREE.Vector3(-38, 13, 625),
      new THREE.Vector3(-25, 10, 640),
      new THREE.Vector3(-8, 7, 655),

      // Short Final Sprint to Finish Arch
      new THREE.Vector3(0, 4, 675),
      new THREE.Vector3(0, 1, 695), // Finish Line!
      new THREE.Vector3(0, 0, 720), // Run-off area
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

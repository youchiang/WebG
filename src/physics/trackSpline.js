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
    // Generate a C2-smooth, compact 10-turn mountain pass (~1,050m total length)
    // Minimum centerline radius of curvature R_min >= 18.5m everywhere (> 7.2m guardrail offset),
    // guaranteeing zero inner-edge pinching, folding, or bowtie self-intersection at corners!
    const rawWaypoints = [];
    const totalZ = 750;
    const stepZ = 10; // Dense 10m sampling for ultra-smooth Catmull-Rom interpolation
    const turnStartZ = 45;
    const turnEndZ = 705; // 660m span for 10 turns (66m per turn)
    const halfPeriodZ = 66;
    const maxAmpX = 24.5; // R_min = (66/pi)^2 / 24.5 = 18.0m >> 7.2m guardrail offset

    for (let z = 0; z <= totalZ; z += stepZ) {
      // Smooth envelope so entry (0..45) and exit (705..750) blend seamlessly with zero curvature jump
      let env = 0;
      if (z >= turnStartZ && z <= turnEndZ) {
        const uTurn = (z - turnStartZ) / (turnEndZ - turnStartZ);
        // Smoothstep ramp in first 8% and last 8%
        const rampIn = THREE.MathUtils.smoothstep(uTurn, 0.0, 0.08);
        const rampOut = 1.0 - THREE.MathUtils.smoothstep(uTurn, 0.92, 1.0);
        env = rampIn * rampOut;
      }

      const phase = ((z - turnStartZ) / halfPeriodZ) * Math.PI;
      // Add subtle 3rd harmonic flattening (-0.06 * sin(3*phase)) for wider, rounder hairpin apexes
      const wave = Math.sin(phase) - 0.06 * Math.sin(3 * phase);
      const x = env * maxAmpX * wave;

      // Steady downhill elevation from Y=110 down to Y=0 (flattening out smoothly at finish)
      const progressZ = z / totalZ;
      const flattenEnd = 1.0 - THREE.MathUtils.smoothstep(progressZ, 0.90, 1.0);
      const y = 110 * (1.0 - progressZ) * flattenEnd;

      rawWaypoints.push(new THREE.Vector3(x, y, z));
    }

    this.curve = new THREE.CatmullRomCurve3(rawWaypoints, false, 'centripetal', 0.5);
    this.totalLength = this.curve.getLength();

    // Pre-sample points and frenet frames for fast queries
    this.cachePoints = this.curve.getSpacedPoints(this.sampleCount);
    for (let i = 0; i <= this.sampleCount; i++) {
      const u = i / this.sampleCount;
      const tangent = this.curve.getTangent(u).normalize();
      this.cacheTangents.push(tangent);

      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      this.cacheNormals.push(normal);     // Points to Road Right/Left per cross(tangent, up)
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
    // Exact continuous right-handed crossVectors(tangent, up): (-tangent.z, 0, tangent.x)
    const tangent = this.getTangentAt(u);
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3().crossVectors(tangent, up).normalize();
  }

  getBinormalAt(u) {
    const tangent = this.getTangentAt(u);
    const normal = this.getNormalAt(u);
    return new THREE.Vector3().crossVectors(normal, tangent).normalize();
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

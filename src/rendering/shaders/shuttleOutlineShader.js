import * as THREE from 'three';

/**
 * Tactical Color Palette for High-Contrast Shuttlecock Outline & Rim VFX.
 * Optimized for maximum contrast against Mint Court (#98C9A3) and Mist-Blue Walls (#9FB3C8).
 */
export const OUTLINE_PALETTE = {
  normal_navy: {
    outline: new THREE.Color('#FF5722'), // High-contrast Vibrant Coral outer border
    rim: new THREE.Color('#1E293B'),     // Deep Navy structural contour rim
    trail: new THREE.Color('#FFFFFF'),   // Pure crisp white air stream
    thickness: 0.011,
    pulseSpeed: 0.0,
    rimIntensity: 0.95,
  },
  smash_flame: {
    outline: new THREE.Color('#FF3D00'), // Fiery Orange-Red
    rim: new THREE.Color('#FFD600'),     // Brilliant Gold rim glow
    trail: new THREE.Color('#FF6D00'),   // Flaming Orange-Gold trail
    thickness: 0.014,                    // Thicker, fiery impact silhouette
    pulseSpeed: 12.0,                    // Rapid heat flicker
    rimIntensity: 1.85,
  },
  sweet_spot_green: {
    outline: new THREE.Color('#00E676'), // Bright Emerald Green
    rim: new THREE.Color('#B9F6CA'),     // Luminous Mint
    trail: new THREE.Color('#00E676'),   // Emerald trail
    thickness: 0.013,
    pulseSpeed: 8.0,                     // Pulsing visual indicator
    rimIntensity: 1.6,
  },
  drop_cyan: {
    outline: new THREE.Color('#00E5FF'), // Electric Cyan
    rim: new THREE.Color('#0288D1'),     // Deep Cyan rim highlight
    trail: new THREE.Color('#00E5FF'),   // Cyan air trail
    thickness: 0.012,
    pulseSpeed: 4.0,
    rimIntensity: 1.35,
  },
};

/**
 * Creates the Inverted Hull Outline ShaderMaterial (rendered BackSide).
 * Extrudes outward along centroid + vertex normal in view space so all edges
 * (cork, skirt sides, and skirt rim) form an unmistakable high-contrast border.
 */
export function createShuttleOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#FF5722') },
      uThickness: { value: 0.011 },
      uOpacity: { value: 0.98 },
      uTime: { value: 0.0 },
      uPulseSpeed: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      uniform float uTime;
      uniform float uPulseSpeed;

      void main() {
        // Combine vertex normal and radial centroid direction so open/cap rims extrude cleanly in 360 deg
        vec3 centroidDir = normalize(position - vec3(0.0, 0.0, 0.005));
        vec3 outDir = normalize(mix(normal, centroidDir, 0.55));
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vec3 vOut = normalize(normalMatrix * outDir);

        float dist = length(mvPos.xyz);
        // Distance-scaled line width: crisp thin outline at close viewmodel distance, thick at far baseline
        float distScale = clamp(dist * 0.45, 0.35, 3.8);

        float pulse = 0.0;
        if (uPulseSpeed > 0.1) {
          pulse = sin(uTime * uPulseSpeed) * 0.28;
        }

        float finalThickness = uThickness * (distScale + pulse);
        mvPos.xyz += vOut * finalThickness;

        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uPulseSpeed;

      void main() {
        vec3 col = uColor;
        if (uPulseSpeed > 0.1) {
          float pulseMod = sin(uTime * uPulseSpeed) * 0.15;
          col += vec3(pulseMod);
        }
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: true,
    depthTest: true,
  });
}

/**
 * Creates the Shuttlecock Body ShaderMaterial with dynamic Fresnel rim glow.
 */
export function createShuttleBodyMaterial(baseColorHex = '#FFFFFF') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColorHex) },
      uRimColor: { value: new THREE.Color('#FF5722') },
      uRimIntensity: { value: 0.75 },
      uTime: { value: 0.0 },
      uPulseSpeed: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBaseColor;
      uniform vec3 uRimColor;
      uniform float uRimIntensity;
      uniform float uTime;
      uniform float uPulseSpeed;

      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        // Subtle soft hemisphere lighting for realistic 3D shuttlecock volume
        vec3 lightDir = normalize(vec3(0.3, 0.9, 0.4));
        float nDotL = max(dot(vNormal, lightDir), 0.0);
        vec3 diffuse = uBaseColor * (0.65 + 0.35 * nDotL);

        // Dynamic Fresnel Rim Glow
        float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
        fresnel = pow(fresnel, 2.4);

        float pulse = 1.0;
        if (uPulseSpeed > 0.1) {
          pulse += sin(uTime * uPulseSpeed) * 0.25;
        }

        vec3 rim = uRimColor * (fresnel * uRimIntensity * pulse);
        vec3 finalColor = diffuse + rim;

        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

/**
 * Updates uniform values smoothly based on the current outline state.
 */
export function updateShuttleShaderUniforms(
  outlineMaterial,
  bodyMaterial,
  outlineState = 'normal_navy',
  timeSeconds = 0.0
) {
  const palette = OUTLINE_PALETTE[outlineState] || OUTLINE_PALETTE.normal_navy;

  if (outlineMaterial && outlineMaterial.uniforms) {
    outlineMaterial.uniforms.uColor.value.copy(palette.outline);
    outlineMaterial.uniforms.uThickness.value = palette.thickness;
    outlineMaterial.uniforms.uPulseSpeed.value = palette.pulseSpeed;
    outlineMaterial.uniforms.uTime.value = timeSeconds;
  }

  if (bodyMaterial && bodyMaterial.uniforms) {
    bodyMaterial.uniforms.uRimColor.value.copy(palette.rim);
    bodyMaterial.uniforms.uRimIntensity.value = palette.rimIntensity;
    bodyMaterial.uniforms.uPulseSpeed.value = palette.pulseSpeed;
    bodyMaterial.uniforms.uTime.value = timeSeconds;
  }
}

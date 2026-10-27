import * as THREE from 'three';

/**
 * Generates a bright, warm maple wood floor texture (#F3E9DC to #EAD7C3)
 * with subtle plank lines and organic wood grain variation.
 */
export function createMapleWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base warm maple fill
  ctx.fillStyle = '#F3E9DC';
  ctx.fillRect(0, 0, 512, 512);

  const plankCount = 8;
  const plankWidth = canvas.width / plankCount;
  const plankTones = ['#F5EDE2', '#F3E9DC', '#F0E4D4', '#EAD7C3', '#F4EBDF', '#EFE1CF'];

  for (let i = 0; i < plankCount; i++) {
    const x = i * plankWidth;
    // Draw 2 vertical planks per column with staggered horizontal joints
    const splitY = ((i * 173) % 360) + 70;

    ctx.fillStyle = plankTones[i % plankTones.length];
    ctx.fillRect(x, 0, plankWidth, splitY);

    ctx.fillStyle = plankTones[(i + 2) % plankTones.length];
    ctx.fillRect(x, splitY, plankWidth, 512 - splitY);

    // Subtle longitudinal grain lines
    ctx.strokeStyle = 'rgba(218, 195, 168, 0.25)';
    ctx.lineWidth = 1;
    for (let g = 6; g < plankWidth; g += 10) {
      ctx.beginPath();
      ctx.moveTo(x + g, 0);
      ctx.lineTo(x + g, 512);
      ctx.stroke();
    }

    // Plank vertical seam
    ctx.strokeStyle = 'rgba(205, 180, 150, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();

    // Plank horizontal joint seam
    ctx.beginPath();
    ctx.moveTo(x, splitY);
    ctx.lineTo(x + plankWidth, splitY);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 11);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates a subtle matte PVC pebble texture for the mint green badminton court (#98C9A3).
 */
export function createCourtMatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#98C9A3';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle matte micro-grain (deterministic pattern)
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const hash = ((x * 37 + y * 91) % 17) - 8;
      if (hash > 4) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(x, y, 2, 2);
      } else if (hash < -4) {
        ctx.fillStyle = 'rgba(110, 160, 125, 0.05)';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 12);
  return texture;
}

/**
 * Generates a delicate white/slate woven mesh texture for the 3D badminton net.
 */
export function createNetMeshTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fine square/diamond cord grid
  const step = 8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 1.6;

  for (let x = 0; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Subtle dark-slate inner cord core for depth against bright backgrounds
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
  ctx.lineWidth = 0.8;
  for (let y = step / 2; y < canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  return texture;
}

/**
 * Generates an anti-glare acoustic panel wall texture for realistic sports arenas
 * in Soft Mist Steel-Blue / Cool Dove Grey (#9FB3C8 to #93A8BE).
 * Provides 100% contrast against white shuttlecocks and white net tape, eliminating glare.
 */
export function createArenaWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base Soft Mist Steel-Blue fill
  ctx.fillStyle = '#9FB3C8';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 4;
  const pw = 512 / cols;
  const ph = 512 / rows;
  const tones = ['#9FB3C8', '#98AEC4', '#A2B6CB', '#94A9BF', '#9DB1C6'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pw;
      const y = r * ph;

      // Subtle tone shift per modular panel
      ctx.fillStyle = tones[(r * 3 + c * 2) % tones.length];
      ctx.fillRect(x + 1, y + 1, pw - 2, ph - 2);

      // Micro acoustic perforation dots (sound absorption)
      ctx.fillStyle = 'rgba(105, 130, 153, 0.22)';
      for (let py = 12; py < ph - 10; py += 16) {
        for (let px = 12; px < pw - 10; px += 16) {
          ctx.fillRect(x + px, y + py, 2, 2);
        }
      }

      // Bevel highlight on top & left
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + ph - 2);
      ctx.lineTo(x + 1, y + 1);
      ctx.lineTo(x + pw - 2, y + 1);
      ctx.stroke();

      // Modular panel dark seam
      ctx.strokeStyle = 'rgba(78, 101, 124, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, pw, ph);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 3);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates warm natural oak acoustic vertical slat band texture (#D4B996 with #B89B74 grooves).
 */
export function createAcousticSlatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark acoustic felt groove backing
  ctx.fillStyle = '#9C7D57';
  ctx.fillRect(0, 0, 512, 256);

  const slatCount = 16;
  const slatPitch = 512 / slatCount;
  const slatWidth = slatPitch * 0.68;

  for (let i = 0; i < slatCount; i++) {
    const x = i * slatPitch;

    // Oak face gradient
    const grad = ctx.createLinearGradient(x, 0, x + slatWidth, 0);
    grad.addColorStop(0, '#DFC6A7');
    grad.addColorStop(0.3, '#D4B996');
    grad.addColorStop(0.8, '#CBAE8A');
    grad.addColorStop(1, '#BF9E78');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, slatWidth, 256);

    // Subtle vertical grain lines
    ctx.strokeStyle = 'rgba(150, 120, 85, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + slatWidth * 0.35, 0);
    ctx.lineTo(x + slatWidth * 0.35, 256);
    ctx.moveTo(x + slatWidth * 0.7, 0);
    ctx.lineTo(x + slatWidth * 0.7, 256);
    ctx.stroke();

    // Slat edge drop shadow into groove
    ctx.strokeStyle = 'rgba(60, 45, 30, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + slatWidth, 0);
    ctx.lineTo(x + slatWidth, 256);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(16, 1);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates lower padded dado protection wall texture in Sporty Slate-Blue (#5C7C99)
 * with vertical cushion seams every 1.2m.
 */
export function createDadoPadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Sporty Slate-Blue / Calm Teal-Blue base
  ctx.fillStyle = '#5C7C99';
  ctx.fillRect(0, 0, 512, 256);

  // 4 cushion panels per 512px
  const panels = 4;
  const pw = 512 / panels;
  for (let i = 0; i < panels; i++) {
    const x = i * pw;

    // Cushion rounded puff gradient
    const grad = ctx.createLinearGradient(x, 0, x + pw, 0);
    grad.addColorStop(0, '#506E8A');
    grad.addColorStop(0.12, '#6284A5');
    grad.addColorStop(0.5, '#698BAE');
    grad.addColorStop(0.88, '#6284A5');
    grad.addColorStop(1, '#4C6883');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 2, 2, pw - 4, 252);

    // Deep cushion vertical stitch seam
    ctx.strokeStyle = 'rgba(35, 52, 70, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, 2, pw - 2, 252);

    // Cushion top highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3, 4);
    ctx.lineTo(x + pw - 3, 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(8, 1);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates BWF Court Perimeter A-Board texture in matte Sporty Cerulean/Slate (#4F7393).
 */
export function createABoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Sporty Cerulean/Slate base
  ctx.fillStyle = '#4F7393';
  ctx.fillRect(0, 0, 512, 128);

  // Accent stripes
  ctx.fillStyle = '#638BAA';
  ctx.fillRect(0, 8, 512, 6);
  ctx.fillStyle = '#3A5770';
  ctx.fillRect(0, 114, 512, 8);

  // Clean arena branding text
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BWF WORLD TOUR', 130, 64);
  ctx.fillText('BWF WORLD TOUR', 382, 64);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256, 24);
  ctx.lineTo(256, 104);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

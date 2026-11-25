// © 2026 George Moussa. All rights reserved.
// ============================================================================
// 2. SMOOTH ARCHITECTURAL & NATURAL TEXTURES (NO HIGH-FREQ PIXEL NOISE!)
// ============================================================================
function createGlowTexture(innerHex, midHex) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.22, innerHex);
  grad.addColorStop(0.55, midHex);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const cyanGlowTex   = createGlowTexture('rgba(56, 189, 248, 0.95)', 'rgba(14, 165, 233, 0.28)');
const goldGlowTex   = createGlowTexture('rgba(253, 224, 71, 0.95)', 'rgba(245, 158, 11, 0.28)');
const magentaGlowTex = createGlowTexture('rgba(232, 121, 249, 0.95)', 'rgba(168, 85, 247, 0.28)');

// Smooth Fluted Marble & Obsidian Column Texture with Golden Inlay Flutes
function createFlutedPillarTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1e293b');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1.0, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Smooth vertical architectural flutes
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * 512;
    const fGrad = ctx.createLinearGradient(x, 0, x + 32, 0);
    fGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.14)');
    fGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.06)');
    fGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    fGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.04)');
    fGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.14)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(x, 0, 32, 512);
  }

  // Horizontal carved golden-cyan temple rings
  ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.fillRect(0, 80, 512, 6);
  ctx.fillRect(0, 420, 512, 6);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.40)';
  ctx.fillRect(0, 240, 512, 4);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

function createJournalPageTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d4af76';
  ctx.fillRect(0, 0, 512, 512);

  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 340);
  grad.addColorStop(0, 'rgba(228, 195, 138, 0)');
  grad.addColorStop(0.75, 'rgba(138, 72, 20, 0.28)');
  grad.addColorStop(1, 'rgba(88, 38, 8, 0.58)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Ornate double manuscript border
  ctx.strokeStyle = 'rgba(92, 40, 10, 0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 456, 456);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, 440, 440);

  // Sacred geometry & solar-lunar alchemical diagram
  ctx.strokeStyle = '#5c2408';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(256, 150, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(256, 150, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(256, 78);
  ctx.lineTo(318, 186);
  ctx.lineTo(194, 186);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(256, 222);
  ctx.lineTo(318, 114);
  ctx.lineTo(194, 114);
  ctx.closePath();
  ctx.stroke();

  // Handwritten sepia calligraphy lines
  ctx.strokeStyle = 'rgba(54, 20, 4, 0.85)';
  ctx.lineWidth = 4.2;
  for (let y = 258; y < 452; y += 22) {
    ctx.beginPath();
    const indent = (y === 258) ? 96 : 58;
    ctx.moveTo(indent, y);
    for (let x = indent + 16; x < 452 - ((y * 7) % 65); x += 18) {
      ctx.lineTo(x, y + Math.sin(x * 0.45 + y) * 2.5);
    }
    ctx.stroke();
  }
  // Illuminated crimson-gold drop cap
  ctx.fillStyle = '#8b2612';
  ctx.fillRect(58, 248, 26, 28);
  const tex = new THREE.CanvasTexture(c);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

function createMandalaTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 1024);
  const cx = 512, cy = 512;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.90)';
  ctx.lineWidth = 4.0;
  [140, 240, 350, 435, 485].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
    ctx.lineTo(cx + Math.cos(a) * 485, cy + Math.sin(a) * 485);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(232, 121, 249, 0.75)';
  ctx.lineWidth = 3.5;
  for (let p = 0; p < 3; p++) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (p * Math.PI / 9);
      const x = cx + Math.cos(a) * 435;
      const y = cy + Math.sin(a) * 435;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

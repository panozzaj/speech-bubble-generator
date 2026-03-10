const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const circleSizeInput = document.getElementById('circleSize');
const triSizeInput = document.getElementById('triSize');
const cartoonifyInput = document.getElementById('cartoonify');
const outlineWidthInput = document.getElementById('outlineWidth');
const outlineLabel = document.getElementById('outlineLabel');

let img = null;
let cw = 1, ch = 1;

// Positions in canvas pixels
let circlePos = { x: 300, y: 150 };
let triPos = { x: 250, y: 280 };

let drag = null; // 'circle' | 'tri' | null
let hover = null; // 'circle' | 'tri' | null
let dragOff = { x: 0, y: 0 };

// --- Upload ---

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); });
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f?.type.startsWith('image/')) loadImage(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadImage(fileInput.files[0]); });
document.addEventListener('paste', e => {
  for (const item of (e.clipboardData?.items || [])) {
    if (item.type.startsWith('image/')) { loadImage(item.getAsFile()); return; }
  }
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const i = new Image();
    i.onload = () => {
      img = i;
      cw = 600;
      ch = Math.round(600 * i.height / i.width);
      canvas.width = cw;
      canvas.height = ch;
      // Try face detection for initial placement
      detectMouth(i).then(mouth => {
        if (mouth) {
          // Scale mouth coords to canvas
          const sx = cw / i.width;
          const sy = ch / i.height;
          // Triangle tip points at the mouth
          triPos = { x: mouth.x * sx, y: mouth.y * sy };
          // Ellipse at very bottom, mostly off-screen
          circlePos = { x: cw * 0.5, y: ch * 1.3 };
        } else {
          // Default: triangle tip near mouth, ellipse mostly below image
          triPos = { x: cw * 0.5, y: ch * 0.78 };
          circlePos = { x: cw * 0.5, y: ch * 1.3 };
        }
        downloadBtn.disabled = false;
        draw();
      });
    };
    i.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Face/mouth detection ---

async function detectMouth(image) {
  if (!('FaceDetector' in window)) return null;
  try {
    const detector = new FaceDetector();
    const faces = await detector.detect(image);
    if (faces.length === 0) return null;
    const face = faces[0];
    // Mouth is roughly at bottom-center of the face bounding box
    const box = face.boundingBox;
    return {
      x: box.x + box.width * 0.5,
      y: box.y + box.height * 0.92,
    };
  } catch {
    return null;
  }
}

// --- Draw ---

function draw(forExport) {
  if (!img) return;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  const cr = parseInt(circleSizeInput.value);
  const ts = parseInt(triSizeInput.value);
  const rx = cr;
  const ry = cr * 0.65;

  // Triangle (3 points)
  const angle = Math.atan2(triPos.y - circlePos.y, triPos.x - circlePos.x);
  const perpAngle = angle + Math.PI / 2;
  const tipX = triPos.x;
  const tipY = triPos.y;
  const baseX = circlePos.x + Math.cos(angle) * rx * 0.5;
  const baseY = circlePos.y + Math.sin(angle) * ry * 0.5;
  const halfBase = ts * 0.5;
  const b1x = baseX + Math.cos(perpAngle) * halfBase;
  const b1y = baseY + Math.sin(perpAngle) * halfBase;
  const b2x = baseX - Math.cos(perpAngle) * halfBase;
  const b2y = baseY - Math.sin(perpAngle) * halfBase;

  const cartoon = cartoonifyInput.checked;
  const outlineW = cartoon ? parseInt(outlineWidthInput.value) : 0;

  if (cartoon) {
    // Pass 1: Stroke both shapes in black at 2x width.
    // The outer half becomes the visible outline; the inner half gets
    // covered by the white fill in pass 2.
    ctx.strokeStyle = '#000';
    ctx.lineWidth = outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(b1x, b1y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(b2x, b2y);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(circlePos.x, circlePos.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pass 2: Fill both shapes white (covers interior + inner stroke half)
  ctx.fillStyle = '#ffffff';

  ctx.beginPath();
  ctx.moveTo(b1x, b1y);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(b2x, b2y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(circlePos.x, circlePos.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Drag handles (only in preview)
  if (!forExport) {
    // Ellipse center handle
    drawHandle(circlePos.x, circlePos.y, hover === 'circle' || drag === 'circle');
    // Triangle tip handle
    drawHandle(triPos.x, triPos.y, hover === 'tri' || drag === 'tri');
  }
}

function drawHandle(x, y, active) {
  const r = active ? 10 : 7;
  ctx.fillStyle = active ? 'rgba(124, 131, 255, 0.7)' : 'rgba(124, 131, 255, 0.35)';
  ctx.strokeStyle = active ? 'rgba(124, 131, 255, 1)' : 'rgba(124, 131, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

circleSizeInput.addEventListener('input', () => draw());
triSizeInput.addEventListener('input', () => draw());
cartoonifyInput.addEventListener('change', () => {
  outlineLabel.style.display = cartoonifyInput.checked ? '' : 'none';
  draw();
});
outlineWidthInput.addEventListener('input', () => draw());

// --- Hit testing ---

function hitTest(p) {
  const cr = parseInt(circleSizeInput.value);
  // Triangle tip first (smaller target, higher priority)
  if (Math.hypot(p.x - triPos.x, p.y - triPos.y) < 25) return 'tri';
  // Ellipse
  const rx = cr, ry = cr * 0.65;
  const dx = (p.x - circlePos.x) / (rx + 10);
  const dy = (p.y - circlePos.y) / (ry + 10);
  if (dx * dx + dy * dy < 1) return 'circle';
  return null;
}

// --- Drag & hover ---

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = cw / rect.width;
  const sy = ch / rect.height;
  const ce = e.touches ? e.touches[0] : e;
  return { x: (ce.clientX - rect.left) * sx, y: (ce.clientY - rect.top) * sy };
}

function onDown(e) {
  e.preventDefault();
  const p = canvasCoords(e);
  const hit = hitTest(p);
  if (!hit) return;
  drag = hit;
  const target = hit === 'circle' ? circlePos : triPos;
  dragOff = { x: p.x - target.x, y: p.y - target.y };
  canvas.style.cursor = 'grabbing';
}

function onMove(e) {
  const p = canvasCoords(e);

  if (drag) {
    e.preventDefault();
    const target = drag === 'circle' ? circlePos : triPos;
    target.x = p.x - dragOff.x;
    target.y = p.y - dragOff.y;
    draw();
    return;
  }

  // Hover detection
  const hit = hitTest(p);
  if (hit !== hover) {
    hover = hit;
    canvas.style.cursor = hit ? 'grab' : 'default';
    draw();
  }
}

function onUp() {
  if (drag) {
    drag = null;
    canvas.style.cursor = hover ? 'grab' : 'default';
  }
}

canvas.addEventListener('mousedown', onDown);
document.addEventListener('mousemove', onMove);
document.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', onDown, { passive: false });
document.addEventListener('touchmove', onMove, { passive: false });
document.addEventListener('touchend', onUp);

// --- Load default test image ---

fetch('tmp/test1.jpg')
  .then(r => { if (r.ok) return r.blob(); })
  .then(blob => { if (blob) loadImage(blob); })
  .catch(() => {});

// --- Download ---

downloadBtn.addEventListener('click', () => {
  draw(true); // re-draw without handles
  const link = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.download = `geometer-post-${ts}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  draw(); // restore handles
});

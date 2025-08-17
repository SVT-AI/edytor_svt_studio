
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let previewCanvas = document.getElementById('previewCanvas');
let previewCtx = previewCanvas.getContext('2d');

let drawing = false;
let isDrawingEnabled = false;
let img = new Image();

let isCropping = false;
let cropStartX, cropStartY, cropEndX, cropEndY;

let brushColor = document.getElementById("colorPicker").value;
let brushSize = +document.getElementById("brushSize").value;

let history = [];

// --- Historia ---
function saveState() {
  history.push(canvas.toDataURL());
  if (history.length > 20) history.shift();
}
function undo() {
  if (history.length < 2) return;
  history.pop();
  let prev = new Image();
  prev.onload = () => {
    canvas.width = prev.width;
    canvas.height = prev.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(prev, 0, 0);
    img = prev;
  };
  prev.src = history[history.length - 1];
}

// --- Upload ---
document.getElementById('upload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      history = [];
      saveState();
      resetPuzzle(); // wyłącz tryb puzli przy nowym zdjęciu
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

// --- Rysowanie ---
function enableDraw() {
  isDrawingEnabled = !isDrawingEnabled;
  if (isDrawingEnabled) { isCropping = false; resetPuzzle(); }
}
document.getElementById("colorPicker").oninput = e => brushColor = e.target.value;
document.getElementById("brushSize").oninput = e => brushSize = +e.target.value;

canvas.addEventListener('mousedown', e => {
  const {x, y} = canvasXY(e);
  if (puzzleMode) { pickPiece(x, y); return; }
  if (isDrawingEnabled) {
    drawing = true;
    saveState();
    drawDot(x, y);
  } else if (isCropping) {
    cropStartX = x; cropStartY = y;
    cropEndX = x;  cropEndY = y;
    updatePreview();
  }
});
canvas.addEventListener('mouseup', e => {
  if (puzzleMode) { dropPiece(); return; }
  if (isDrawingEnabled) drawing = false;
  else if (isCropping) { applyCrop(); isCropping = false; }
});
canvas.addEventListener('mousemove', e => {
  const {x, y} = canvasXY(e);
  if (puzzleMode) { dragPiece(x, y); return; }
  if (drawing && isDrawingEnabled) drawDot(x, y);
  else if (isCropping) {
    cropEndX = x; cropEndY = y;
    redrawCanvas();
    drawCropBox();
    updatePreview();
  }
});
function canvasXY(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function drawDot(x, y) {
  ctx.fillStyle = brushColor;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, brushSize), 0, 2*Math.PI);
  ctx.fill();
}
function startCrop() {
  isCropping = true;
  isDrawingEnabled = false;
  resetPuzzle();
  updatePreview();
}
function drawCropBox() {
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.setLineDash([6]);
  ctx.strokeRect(cropStartX, cropStartY, cropEndX - cropStartX, cropEndY - cropStartY);
  ctx.setLineDash([]);
}
function updatePreview() {
  if (!isCropping) return;
  let x = Math.min(cropStartX ?? 0, cropEndX ?? 0);
  let y = Math.min(cropStartY ?? 0, cropEndY ?? 0);
  let w = Math.abs((cropEndX ?? 0) - (cropStartX ?? 0));
  let h = Math.abs((cropEndY ?? 0) - (cropStartY ?? 0));
  if (w < 2 || h < 2) { previewCanvas.width = 0; previewCanvas.height = 0; return; }
  previewCanvas.width = w; previewCanvas.height = h;
  redrawCanvas();
  previewCtx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
  previewCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  drawCropBox();
}
function applyCrop() {
  let x = Math.min(cropStartX, cropEndX);
  let y = Math.min(cropStartY, cropEndY);
  let w = Math.abs(cropEndX - cropStartX);
  let h = Math.abs(cropEndY - cropStartY);
  if (w < 2 || h < 2) return;
  saveState();
  const imageData = ctx.getImageData(x, y, w, h);
  canvas.width = w; canvas.height = h;
  ctx.putImageData(imageData, 0, 0);
  img.src = canvas.toDataURL();
  previewCanvas.width = 0; previewCanvas.height = 0;
}
function redrawCanvas() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// --- Efekty ---
function applyPortraitEffect() {
  resetPuzzle();
  saveState();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i]   = Math.min(255, imageData.data[i] + 10);
    imageData.data[i+1] = Math.min(255, imageData.data[i+1] + 10);
    imageData.data[i+2] = Math.min(255, imageData.data[i+2] + 20);
  }
  ctx.putImageData(imageData, 0, 0);
}
function applySharpen() {
  resetPuzzle();
  saveState();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const side = 3;
  const halfSide = 1;
  const output = ctx.createImageData(w, h);
  const dst = output.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;
          if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
            const srcOffset = (scy * w + scx) * 4;
            const wt = weights[cy * side + cx];
            r += data[srcOffset] * wt;
            g += data[srcOffset + 1] * wt;
            b += data[srcOffset + 2] * wt;
          }
        }
      }
      const dstOffset = (y * w + x) * 4;
      dst[dstOffset]     = Math.min(Math.max(r,0),255);
      dst[dstOffset + 1] = Math.min(Math.max(g,0),255);
      dst[dstOffset + 2] = Math.min(Math.max(b,0),255);
      dst[dstOffset + 3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
}
function applyBeautify() {
  resetPuzzle();
  saveState();
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.min(255, data[i] + 15);
    data[i+1] = Math.min(255, data[i+1] + 10);
    data[i+2] = Math.min(255, data[i+2] + 5);
  }
  ctx.putImageData(imageData, 0, 0);
  let temp = new Image();
  temp.src = canvas.toDataURL();
  temp.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "blur(1px) brightness(1.05) contrast(1.1)";
    ctx.drawImage(temp, 0, 0);
    ctx.filter = "none";
  };
}

// --- Zapis ---
function saveImage(format) {
  let mime = "image/jpeg";
  let ext = "jpg";
  if (format === "png") { mime = "image/png"; ext = "png"; }
  if (format === "webp") { mime = "image/webp"; ext = "webp"; }
  const link = document.createElement('a');
  link.download = 'zdjecie.' + ext;
  link.href = canvas.toDataURL(mime, 0.95);
  link.click();
}

// --- Język ---
function setLanguage(lang) {
  fetch('lang.json')
    .then(res => res.json())
    .then(data => {
      document.getElementById('title').innerText = data[lang].title;
    });
}

// --- Motyw / tła ---
function toggleTheme() { document.body.classList.toggle('light'); }
function setBackground(mode) {
  document.body.classList.remove('bg-studio','bg-camera','bg-robot');
  if (mode === 'studio') document.body.classList.add('bg-studio');
  if (mode === 'camera') document.body.classList.add('bg-camera');
  if (mode === 'robot')  document.body.classList.add('bg-robot');
}

/* ==============================
   Tryb PUZLI – ząbkowane kształty
   ============================== */

let puzzleMode = false;
let puzzlePieces = [];
let puzzleSize = 4; // 4x4 domyślnie
let pieceW = 0, pieceH = 0;
let draggingPiece = null;
let dragOffX = 0, dragOffY = 0;
let snapToGrid = true;

let moveCount = 0;
function updateMoveCounter() {
  const el = document.getElementById("moveCounter");
  if (el) el.innerText = "Ruchy: " + moveCount;
}


function setPuzzleSize(val) { puzzleSize = parseInt(val, 10) || 4; }
function resetPuzzle() { puzzleMode = false; puzzlePieces = []; draggingPiece = null; }

function startPuzzle() {
  if (!img || !img.width) { alert("Najpierw wgraj zdjęcie."); return; }
  isDrawingEnabled = false; isCropping = false;

  canvas.width = img.width;
  canvas.height = img.height;

  pieceW = Math.floor(canvas.width / puzzleSize);
  pieceH = Math.floor(canvas.height / puzzleSize);

  // wylosuj kształty krawędzi (dopasowane między sąsiadami)
  puzzlePieces = [];
  let edgesGrid = []; // edgesGrid[r][c] = {top,right,bottom,left}
  for (let r = 0; r < puzzleSize; r++) {
    edgesGrid[r] = [];
    for (let c = 0; c < puzzleSize; c++) {
      let top = (r === 0) ? 0 : -edgesGrid[r-1][c].bottom;
      let left = (c === 0) ? 0 : -edgesGrid[r][c-1].right;
      let right = (c === puzzleSize-1) ? 0 : (Math.random() > 0.5 ? 1 : -1);
      let bottom = (r === puzzleSize-1) ? 0 : (Math.random() > 0.5 ? 1 : -1);
      edgesGrid[r][c] = { top, right, bottom, left };
    }
  }

  // stwórz kafelki
  for (let r = 0; r < puzzleSize; r++) {
    for (let c = 0; c < puzzleSize; c++) {
      const sx = c * pieceW;
      const sy = r * pieceH;
      const dx = c * pieceW;
      const dy = r * pieceH;
      puzzlePieces.push({
        r, c, sx, sy, dx, dy,
        correctX: dx, correctY: dy,
        edges: edgesGrid[r][c],
      });
    }
  }

  shufflePuzzle();
  puzzleMode = true;
  drawPuzzle();
}

function shufflePuzzle() {
  if (!puzzlePieces.length) return;
  // losowe rozmieszczenie na siatce (bez nakładania X/Y pozycji)
  const spots = [];
  for (let r = 0; r < puzzleSize; r++) {
    for (let c = 0; c < puzzleSize; c++) {
      spots.push({ x: c * pieceW, y: r * pieceH });
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  puzzlePieces.forEach((p, i) => { p.dx = spots[i].x; p.dy = spots[i].y; });
  drawPuzzle();
}

function toggleSnap() { snapToGrid = !snapToGrid; alert(`Przyciąganie: ${snapToGrid ? "WŁĄCZONE" : "WYŁĄCZONE"}`); }

function drawPuzzle() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  puzzlePieces.forEach(p => drawPiece(p));
}

function drawPiece(piece) {
  const path = piecePath(piece, piece.dx, piece.dy, pieceW, pieceH, piece.edges);
  ctx.save();
  ctx.clip(path);
  // duplikujemy cały obraz – clip ograniczy do kształtu elementu
  ctx.drawImage(img, piece.dx - piece.sx, piece.dy - piece.sy);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.25;
  ctx.stroke(path);
  ctx.restore();

  // delikatny cień
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = "rgba(0,0,0,0)";
  ctx.stroke(path);
  ctx.restore();
}

// zbuduj Path2D z ząbkami
function piecePath(piece, x, y, w, h, edges) {
  const path = new Path2D();
  const neck = Math.min(w, h) * 0.12;   // szyjka
  const tab = Math.min(w, h) * 0.28;    // wysokość/występ
  const inset = 0;                       // opcjonalny margines

  // pomocnicze współrzędne
  const x0 = x, y0 = y;
  const x1 = x + w, y1 = y + h;

  path.moveTo(x0 + inset, y0 + inset);

  // TOP (idąc w prawo)
  if (edges.top === 0) {
    path.lineTo(x1 - inset, y0 + inset);
  } else {
    const dir = -edges.top; // +1 bump up, -1 wcięcie
    const mid = x0 + w/2;
    const start = x0 + w*0.25;
    const end   = x0 + w*0.75;

    path.lineTo(start - neck, y0 + inset);
    path.bezierCurveTo(
      start - neck/2, y0 + inset,
      mid - neck,     y0 + inset + dir*tab,
      mid,            y0 + inset + dir*tab
    );
    path.bezierCurveTo(
      mid + neck,     y0 + inset + dir*tab,
      end + neck/2,   y0 + inset,
      end + neck,     y0 + inset
    );
    path.lineTo(x1 - inset, y0 + inset);
  }

  // RIGHT (w dół)
  if (edges.right === 0) {
    path.lineTo(x1 - inset, y1 - inset);
  } else {
    const dir = edges.right; // +1 bump right, -1 wcięcie left
    const mid = y0 + h/2;
    const start = y0 + h*0.25;
    const end   = y0 + h*0.75;

    path.lineTo(x1 - inset, start - neck);
    path.bezierCurveTo(
      x1 - inset,          start - neck/2,
      x1 - inset + dir*tab, mid - neck,
      x1 - inset + dir*tab, mid
    );
    path.bezierCurveTo(
      x1 - inset + dir*tab, mid + neck,
      x1 - inset,           end + neck/2,
      x1 - inset,           end + neck
    );
    path.lineTo(x1 - inset, y1 - inset);
  }

  // BOTTOM (w lewo)
  if (edges.bottom === 0) {
    path.lineTo(x0 + inset, y1 - inset);
  } else {
    const dir = edges.bottom; // +1 bump down, -1 wcięcie up
    const mid = x0 + w/2;
    const start = x0 + w*0.75;
    const end   = x0 + w*0.25;

    path.lineTo(start + neck, y1 - inset);
    path.bezierCurveTo(
      start + neck/2, y1 - inset,
      mid + neck,     y1 - inset + dir*tab,
      mid,            y1 - inset + dir*tab
    );
    path.bezierCurveTo(
      mid - neck,     y1 - inset + dir*tab,
      end - neck/2,   y1 - inset,
      end - neck,     y1 - inset
    );
    path.lineTo(x0 + inset, y1 - inset);
  }

  // LEFT (w górę i zamknięcie)
  if (edges.left === 0) {
    path.lineTo(x0 + inset, y0 + inset);
  } else {
    const dir = -edges.left; // +1 bump left (ujemny x), -1 wcięcie
    const mid = y0 + h/2;
    const start = y0 + h*0.75;
    const end   = y0 + h*0.25;

    path.lineTo(x0 + inset, start + neck);
    path.bezierCurveTo(
      x0 + inset,            start + neck/2,
      x0 + inset + dir*tab,  mid + neck,
      x0 + inset + dir*tab,  mid
    );
    path.bezierCurveTo(
      x0 + inset + dir*tab,  mid - neck,
      x0 + inset,            end - neck/2,
      x0 + inset,            end - neck
    );
    path.lineTo(x0 + inset, y0 + inset);
  }

  path.closePath();
  return path;
}

function pickPiece(x, y) {
  for (let i = puzzlePieces.length - 1; i >= 0; i--) {
    const p = puzzlePieces[i];
    const path = piecePath(p, p.dx, p.dy, pieceW, pieceH, p.edges);
    if (ctx.isPointInPath(path, x, y)) {
      draggingPiece = p;
      dragOffX = x - p.dx;
      dragOffY = y - p.dy;
      // na wierzch
      puzzlePieces.splice(i, 1);
      puzzlePieces.push(p);
      break;
    }
  }
}
function dragPiece(x, y) {
  if (!draggingPiece) return;
  draggingPiece.dx = x - dragOffX;
  draggingPiece.dy = y - dragOffY;
  drawPuzzle();
}
function dropPiece() {
  if (!draggingPiece) return;

  if (snapToGrid) {
    const col = Math.round(draggingPiece.dx / pieceW);
    const row = Math.round(draggingPiece.dy / pieceH);
    draggingPiece.dx = Math.max(0, Math.min(canvas.width - pieceW, col * pieceW));
    draggingPiece.dy = Math.max(0, Math.min(canvas.height - pieceH, row * pieceH));
  }
  drawPuzzle();

  moveCount++;
  updateMoveCounter();

  const dist = Math.hypot(draggingPiece.dx - draggingPiece.correctX, draggingPiece.dy - draggingPiece.correctY);
  if (dist < Math.max(pieceW, pieceH) * 0.12) {
    draggingPiece.dx = draggingPiece.correctX;
    draggingPiece.dy = draggingPiece.correctY;
    drawPuzzle();
  }
  draggingPiece = null;

  if (isSolved()) {
    alert('🎉 Gratulacje! Ułożyłeś puzzle w ' + moveCount + ' ruchach!');
    ctx.save();
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 6;
    ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
    ctx.restore();
  }
}
function isSolved() {
  return puzzlePieces.length &&
    puzzlePieces.every(p => p.dx === p.correctX && p.dy === p.correctY);
}

// eksport tylko po ułożeniu
function exportSolved(fmt) {
  if (!puzzleMode) { alert("Najpierw uruchom puzle."); return; }
  if (!isSolved()) { alert("Ułóż puzle do końca, aby zapisać pełne zdjęcie."); return; }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  saveImage(fmt);
  drawPuzzle();
}

// --- Domyślne puzzle przy starcie ---
window.addEventListener('load', () => {
  img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    history = [];
    saveState();
    // start od razu puzzle
    startPuzzle();
    shufflePuzzle();
  };
  img.src = "obraz_puzzle.jpg"; // domyślny obrazek
});

// --- Auto-start z domyślnym obrazem ---
window.addEventListener('load', () => {
  const defaultImg = new Image();
  defaultImg.onload = () => {
    img = defaultImg;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    history = [];
    saveState();
    // Uruchom puzzle od razu (startPuzzle samo miesza)
    startPuzzle();
  };
  defaultImg.src = 'obraz_puzzle.jpg';
});

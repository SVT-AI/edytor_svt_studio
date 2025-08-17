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
  if (history.length === 0) return;
  // bieżący stan odrzucony, wczytaj poprzedni
  let last = history.pop();
  if (history.length === 0) {
    let t = new Image();
    t.onload = () => {
      canvas.width = t.width;
      canvas.height = t.height;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(t, 0, 0);
      img = t;
    };
    t.src = last;
    return;
  }
  let prev = history[history.length - 1];
  let tempImg = new Image();
  tempImg.onload = () => {
    canvas.width = tempImg.width;
    canvas.height = tempImg.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(tempImg, 0, 0);
    img = tempImg;
  };
  tempImg.src = prev;
}

// --- Upload ---
document.getElementById('upload').addEventListener('change', function(e) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      history = []; // reset historii dla nowego obrazu
      saveState();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
});

// --- Rysowanie ---
function enableDraw() {
  isDrawingEnabled = !isDrawingEnabled;
  if (isDrawingEnabled) isCropping = false;
}
document.getElementById("colorPicker").oninput = e => brushColor = e.target.value;
document.getElementById("brushSize").oninput = e => brushSize = +e.target.value;

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (isDrawingEnabled) {
    drawing = true;
    saveState();
    drawDot(x, y);
  } else if (isCropping) {
    cropStartX = x; cropStartY = y;
    cropEndX = x; cropEndY = y;
    updatePreview();
  }
});
canvas.addEventListener('mouseup', e => {
  if (isDrawingEnabled) {
    drawing = false;
  } else if (isCropping) {
    // nic – czekamy na potwierdzenie guzikiem? tutaj od razu akceptujemy po puszczeniu
    applyCrop();
    isCropping = false;
  }
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (drawing && isDrawingEnabled) {
    drawDot(x, y);
  } else if (isCropping) {
    cropEndX = x; cropEndY = y;
    redrawCanvas();
    // ramka
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.setLineDash([6]);
    ctx.strokeRect(cropStartX, cropStartY, cropEndX - cropStartX, cropEndY - cropStartY);
    ctx.setLineDash([]);
    updatePreview();
  }
});

function drawDot(x, y) {
  ctx.fillStyle = brushColor;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, brushSize), 0, 2*Math.PI);
  ctx.fill();
}

function startCrop() {
  isCropping = true;
  isDrawingEnabled = false;
  updatePreview();
}

function updatePreview() {
  if (!isCropping) return;
  let x = Math.min(cropStartX ?? 0, cropEndX ?? 0);
  let y = Math.min(cropStartY ?? 0, cropEndY ?? 0);
  let w = Math.abs((cropEndX ?? 0) - (cropStartX ?? 0));
  let h = Math.abs((cropEndY ?? 0) - (cropStartY ?? 0));
  if (w < 2 || h < 2) { previewCanvas.width = 0; previewCanvas.height = 0; return; }
  previewCanvas.width = w;
  previewCanvas.height = h;
  // kopiujemy z aktywnego canvasa (z nałożoną ramką usuniętą)
  redrawCanvas();
  previewCtx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
  previewCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  // odtwórz ramkę po podglądzie
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.setLineDash([6]);
  ctx.strokeRect(cropStartX, cropStartY, cropEndX - cropStartX, cropEndY - cropStartY);
  ctx.setLineDash([]);
}

function applyCrop() {
  let x = Math.min(cropStartX, cropEndX);
  let y = Math.min(cropStartY, cropEndY);
  let w = Math.abs(cropEndX - cropStartX);
  let h = Math.abs(cropEndY - cropStartY);
  if (w < 2 || h < 2) return;
  saveState();
  const imageData = ctx.getImageData(x, y, w, h);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(imageData, 0, 0);
  img.src = canvas.toDataURL();
  // wyczyść podgląd po akceptacji
  previewCanvas.width = 0;
  previewCanvas.height = 0;
}

function redrawCanvas() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

// --- Efekty ---
function applyPortraitEffect() {
  saveState();
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = Math.min(imageData.data[i] + 10, 255);
    imageData.data[i+1] = Math.min(imageData.data[i+1] + 10, 255);
    imageData.data[i+2] = Math.min(imageData.data[i+2] + 20, 255);
  }
  ctx.putImageData(imageData, 0, 0);
}
function applySharpen() {
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
      dst[dstOffset] = Math.min(Math.max(r,0),255);
      dst[dstOffset + 1] = Math.min(Math.max(g,0),255);
      dst[dstOffset + 2] = Math.min(Math.max(b,0),255);
      dst[dstOffset + 3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
}

// --- Zapis ---
function saveImage(format) {
  let mime = "image/jpeg";
  let ext = "jpg";
  if (format === "png") { mime = "image/png"; ext = "png"; }
  if (format === "webp") { mime = "image/webp"; ext = "webp"; }
  const link = document.createElement('a');
  link.download = 'zdjecie.' + ext;
  link.href = canvas.toDataURL(mime, 0.9);
  link.click();
}

function saveAsPDF() {
  import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(jsPDF => {
    const { jsPDF: PDF } = jsPDF;
    const pdf = new PDF();
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;
    const pageHeight = pdf.internal.pageSize.getHeight() - 20;
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'JPEG', 10, 10, w, h);
    pdf.save('edycja.pdf');
  });
}

// --- Język ---
function setLanguage(lang) {
  fetch('lang.json')
    .then(res => res.json())
    .then(data => {
      document.getElementById('title').innerText = data[lang].title;
    });
}

// --- Motyw ---
function toggleTheme() {
  document.body.classList.toggle('light');
}

let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let drawing = false;
let isDrawingEnabled = false;
let img = new Image();

document.getElementById('upload').addEventListener('change', function(e) {
  const reader = new FileReader();
  reader.onload = function(evt) {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
});

function cropCustom() {
  const w = prompt("Szerokość:");
  const h = prompt("Wysokość:");
  const imageData = ctx.getImageData(0, 0, w, h);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(imageData, 0, 0);
}

function enableDraw() {
  isDrawingEnabled = !isDrawingEnabled;
}

canvas.addEventListener('mousedown', e => { if (isDrawingEnabled) drawing = true; });
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mousemove', e => {
  if (!drawing || !isDrawingEnabled) return;
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 3, 0, 2 * Math.PI);
  ctx.fill();
});

function applyPortraitEffect() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    // symulacja wygładzenia skóry: rozjaśnij, wybiel
    imageData.data[i] = Math.min(imageData.data[i] + 10, 255);     // R
    imageData.data[i+1] = Math.min(imageData.data[i+1] + 10, 255); // G
    imageData.data[i+2] = Math.min(imageData.data[i+2] + 20, 255); // B
  }
  ctx.putImageData(imageData, 0, 0);
}

function saveImage() {
  const link = document.createElement('a');
  link.download = 'zdjecie.jpg';
  link.href = canvas.toDataURL('image/jpeg');
  link.click();
}

function saveAsPDF() {
  import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(jsPDF => {
    const { jsPDF: PDF } = jsPDF;
    const pdf = new PDF();
    pdf.addImage(canvas.toDataURL(), 'JPEG', 10, 10, 180, 120);
    pdf.save('edycja.pdf');
  });
}

function setLanguage(lang) {
  fetch('lang.json')
    .then(res => res.json())
    .then(data => {
      document.getElementById('title').innerText = data[lang].title;
    });
}


function applySharpen() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const weights = [  0, -1,  0,
                    -1,  5, -1,
                     0, -1,  0];
  const side = Math.round(Math.sqrt(weights.length));
  const halfSide = Math.floor(side / 2);
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
      dst[dstOffset] = r;
      dst[dstOffset + 1] = g;
      dst[dstOffset + 2] = b;
      dst[dstOffset + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);;
}
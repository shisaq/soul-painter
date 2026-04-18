import qrCodeUrl from '../qrcode.png';

const BRAND_HEIGHT = 80;
const BRAND_BG = '#f2e2c4';
const BRAND_COLOR = '#305066';

function addBranding(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  promptText?: string
) {
  const y = canvasHeight - BRAND_HEIGHT;
  ctx.fillStyle = BRAND_BG;
  ctx.fillRect(0, y, canvasWidth, BRAND_HEIGHT);

  ctx.fillStyle = BRAND_COLOR;
  ctx.font = `bold ${Math.round(canvasWidth * 0.032)}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  const centerY = y + BRAND_HEIGHT / 2;
  const label = promptText ? `灵魂画师 · 「${promptText}」` : '灵魂画师';
  ctx.fillText(label, Math.round(canvasWidth * 0.04), centerY);

  const hint = 'paint.uulili.com';
  const hintWidth = ctx.measureText(hint).width;
  ctx.font = `${Math.round(canvasWidth * 0.026)}px system-ui, sans-serif`;
  ctx.fillStyle = BRAND_COLOR + '99';
  ctx.fillText(hint, canvasWidth - hintWidth - Math.round(canvasWidth * 0.04), centerY);
}

export async function svgToPng(svgElement: SVGSVGElement, promptText?: string): Promise<Blob> {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  clone.querySelectorAll('path').forEach((p) => {
    p.style.transition = 'none';
    p.style.strokeDashoffset = '0';
    p.style.opacity = '1';
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const artSize = 1000;
  const totalHeight = artSize + BRAND_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = artSize;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, artSize, artSize);
      ctx.drawImage(img, 0, 0, artSize, artSize);
      addBranding(ctx, artSize, totalHeight, promptText);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png'
      );
    };
    img.onerror = () => reject(new Error('SVG render failed'));
    img.src = dataUrl;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const layers = [
    { spread: 12, color: 'rgba(48,80,102,0.06)' },
    { spread: 6, color: 'rgba(48,80,102,0.04)' },
    { spread: 2, color: 'rgba(48,80,102,0.02)' },
  ];
  for (const { spread, color } of layers) {
    ctx.fillStyle = color;
    roundRect(ctx, x - spread, y + spread * 0.5, w + spread * 2, h + spread, r + spread);
    ctx.fill();
  }
}

export async function canvasWithGuessToPng(
  sourceCanvas: HTMLCanvasElement,
  guessText: string
): Promise<Blob> {
  const W = 1080;
  const pad = 56;
  const innerW = W - pad * 2;
  const artSize = innerW;
  const cardRadius = 28;
  const commentRadius = 22;
  const commentPadX = 36;
  const commentPadY = 32;
  const titleFontSize = 26;
  const bodyFontSize = 28;
  const bodyLineHeight = 1.7;
  const gapTitleBody = 14;
  const gapArtComment = 28;
  const brandH = 110;
  const gapCommentBrand = 36;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `700 ${bodyFontSize}px system-ui, -apple-system, sans-serif`;
  const textMaxW = innerW - commentPadX * 2;
  const bodyLines = wrapText(measure, guessText, textMaxW);

  const commentH =
    commentPadY +
    titleFontSize +
    gapTitleBody +
    bodyLines.length * Math.round(bodyFontSize * bodyLineHeight) +
    commentPadY;

  const totalH = pad + artSize + gapArtComment + commentH + gapCommentBrand + brandH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.3, totalH);
  bgGrad.addColorStop(0, '#fdf6ed');
  bgGrad.addColorStop(0.5, '#f7ecdb');
  bgGrad.addColorStop(1, '#f2e2c4');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, totalH);

  const blobs: [number, number, number, string][] = [
    [W * 0.85, totalH * 0.08, 180, 'rgba(14,168,227,0.07)'],
    [W * 0.1, totalH * 0.75, 140, 'rgba(219,105,104,0.06)'],
    [W * 0.7, totalH * 0.65, 100, 'rgba(14,168,227,0.05)'],
    [W * 0.25, totalH * 0.15, 90, 'rgba(242,226,196,0.3)'],
  ];
  for (const [bx, by, br, bc] of blobs) {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, bc);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }

  const artX = pad;
  const artY = pad;
  drawShadow(ctx, artX, artY, artSize, artSize, cardRadius);

  ctx.save();
  roundRect(ctx, artX, artY, artSize, artSize, cardRadius);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(artX, artY, artSize, artSize);
  ctx.drawImage(
    sourceCanvas,
    0, 0, sourceCanvas.width, sourceCanvas.height,
    artX, artY, artSize, artSize
  );
  ctx.restore();

  ctx.strokeStyle = 'rgba(48,80,102,0.08)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, artX, artY, artSize, artSize, cardRadius);
  ctx.stroke();

  const cmtX = pad;
  const cmtY = artY + artSize + gapArtComment;
  drawShadow(ctx, cmtX, cmtY, innerW, commentH, commentRadius);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, cmtX, cmtY, innerW, commentH, commentRadius);
  ctx.fill();

  ctx.strokeStyle = 'rgba(48,80,102,0.08)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, cmtX, cmtY, innerW, commentH, commentRadius);
  ctx.stroke();

  const accentBarW = 4;
  const accentBarH = titleFontSize + gapTitleBody + bodyLines.length * Math.round(bodyFontSize * bodyLineHeight);
  const accentBarX = cmtX + commentPadX - 16;
  const accentBarY = cmtY + commentPadY;
  const accentGrad = ctx.createLinearGradient(0, accentBarY, 0, accentBarY + accentBarH);
  accentGrad.addColorStop(0, '#0ea8e3');
  accentGrad.addColorStop(1, '#0e8ec3');
  ctx.fillStyle = accentGrad;
  roundRect(ctx, accentBarX, accentBarY, accentBarW, accentBarH, 2);
  ctx.fill();

  let ty = cmtY + commentPadY;
  ctx.fillStyle = '#0ea8e3';
  ctx.font = `800 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('\u2728 AI \u731c\u4f60\u753b\u7684\u662f\uff1a', cmtX + commentPadX, ty);
  ty += titleFontSize + gapTitleBody;

  ctx.fillStyle = '#305066';
  ctx.font = `600 ${bodyFontSize}px system-ui, -apple-system, sans-serif`;
  for (const line of bodyLines) {
    ctx.fillText(line, cmtX + commentPadX, ty);
    ty += Math.round(bodyFontSize * bodyLineHeight);
  }

  const brandCenterY = totalH - pad - brandH / 2;

  const qrSize = 80;
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('QR load failed'));
    img.src = qrCodeUrl;
  });

  const qrX = W - pad - qrSize;
  const qrY = brandCenterY - qrSize / 2;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#305066';
  ctx.font = `800 ${Math.round(W * 0.028)}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('\u7075\u9b42\u753b\u5e08 Soul Painter', pad, brandCenterY - 10);

  ctx.fillStyle = 'rgba(48,80,102,0.45)';
  ctx.font = `500 ${Math.round(W * 0.022)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('paint.uulili.com', pad, brandCenterY + 18);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

export async function canvasToPng(sourceCanvas: HTMLCanvasElement): Promise<Blob> {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const totalHeight = h + BRAND_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0);
  addBranding(ctx, w, totalHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

function isWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

let overlayCleanup: (() => void) | null = null;

function showSaveOverlay(blob: Blob) {
  if (overlayCleanup) overlayCleanup();

  const url = URL.createObjectURL(blob);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';

  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:85%;max-height:70vh;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const hint = document.createElement('p');
  hint.textContent = '长按图片保存到相册';
  hint.style.cssText = 'color:white;font-size:16px;font-weight:bold;margin-top:20px;opacity:0.8;';

  const close = document.createElement('button');
  close.textContent = '关闭';
  close.style.cssText = 'color:white;font-size:15px;margin-top:16px;padding:8px 24px;border:1.5px solid rgba(255,255,255,0.3);border-radius:999px;background:transparent;';

  const cleanup = () => {
    overlay.remove();
    URL.revokeObjectURL(url);
    overlayCleanup = null;
  };

  close.onclick = cleanup;
  overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };

  overlay.appendChild(img);
  overlay.appendChild(hint);
  overlay.appendChild(close);
  document.body.appendChild(overlay);
  overlayCleanup = cleanup;
}

export async function shareImage(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<void> {
  if (isWeChat()) {
    showSaveOverlay(blob);
    return;
  }

  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, text, files: [file] });
    return;
  }

  showSaveOverlay(blob);
}

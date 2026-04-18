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

export async function canvasWithGuessToPng(
  sourceCanvas: HTMLCanvasElement,
  guessText: string
): Promise<Blob> {
  const artSize = 1000;
  const padding = 40;
  const titleFontSize = 28;
  const bodyFontSize = 30;
  const lineHeight = 1.6;
  const gapBetweenTitleAndBody = 12;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `bold ${bodyFontSize}px system-ui, sans-serif`;
  const textMaxWidth = artSize - padding * 2;
  const bodyLines = wrapText(measure, guessText, textMaxWidth);

  const commentHeight =
    padding +
    titleFontSize +
    gapBetweenTitleAndBody +
    bodyLines.length * Math.round(bodyFontSize * lineHeight) +
    padding;

  const totalHeight = artSize + commentHeight + BRAND_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = artSize;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, artSize, artSize);
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, artSize, artSize);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, artSize, artSize, commentHeight);

  ctx.fillStyle = '#305066';
  ctx.fillRect(padding, artSize, artSize - padding * 2, 1);

  let y = artSize + padding;
  ctx.fillStyle = '#0ea8e3';
  ctx.font = `bold ${titleFontSize}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('AI \u731c\u4f60\u753b\u7684\u662f\uff1a', padding, y);
  y += titleFontSize + gapBetweenTitleAndBody;

  ctx.fillStyle = '#305066';
  ctx.font = `bold ${bodyFontSize}px system-ui, sans-serif`;
  for (const line of bodyLines) {
    ctx.fillText(line, padding, y);
    y += Math.round(bodyFontSize * lineHeight);
  }

  addBranding(ctx, artSize, totalHeight);

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

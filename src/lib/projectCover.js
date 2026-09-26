const COVER_WIDTH = 1600;
const COVER_HEIGHT = 1000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذر قراءة صورة الغلاف.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type = 'image/webp', quality = 0.84) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('تعذر تجهيز صورة الغلاف.'));
    }, type, quality);
  });
}

export async function prepareProjectCover(file) {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) throw new Error('اختار ملف صورة صالح للغلاف.');

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تجهيز صورة الغلاف على هذا المتصفح.');

  ctx.fillStyle = '#101516';
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  // Cinematic blurred background fills the fixed frame without cutting the actual artwork.
  const bgScale = Math.max(COVER_WIDTH / image.width, COVER_HEIGHT / image.height);
  const bgWidth = image.width * bgScale;
  const bgHeight = image.height * bgScale;
  const bgX = (COVER_WIDTH - bgWidth) / 2;
  const bgY = (COVER_HEIGHT - bgHeight) / 2;
  ctx.save();
  ctx.filter = 'blur(34px) brightness(0.5) saturate(0.9)';
  ctx.globalAlpha = 0.78;
  ctx.drawImage(image, bgX - 24, bgY - 24, bgWidth + 48, bgHeight + 48);
  ctx.restore();

  ctx.fillStyle = 'rgba(16,21,22, .2)';
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  // The real design is always fully visible (contain), so nothing important gets cropped.
  const fgScale = Math.min(COVER_WIDTH / image.width, COVER_HEIGHT / image.height);
  const fgWidth = image.width * fgScale;
  const fgHeight = image.height * fgScale;
  const fgX = (COVER_WIDTH - fgWidth) / 2;
  const fgY = (COVER_HEIGHT - fgHeight) / 2;
  ctx.drawImage(image, fgX, fgY, fgWidth, fgHeight);

  const blob = await canvasToBlob(canvas);
  const baseName = String(file.name || 'project-cover').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}-cover.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export const PROJECT_COVER_RATIO = '16 / 10';

export async function compressImage(file, qualityMode) {
  if (qualityMode === 'original') return file;
  
  const maxWidth = qualityMode === 'fast' ? 1280 : 1920;
  const quality = qualityMode === 'fast' ? 0.6 : 0.82;
  
  try {
    const bitmap = await createImageBitmap(file);
    const width = Math.min(bitmap.width, maxWidth);
    const height = bitmap.height * (width / bitmap.width);

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }));
          } else {
            resolve(file);
          }
        }, 'image/webp', quality);
      });
    }
  } catch (err) {
    console.error("Image compression failed, sending original", err);
    return file;
  }
}

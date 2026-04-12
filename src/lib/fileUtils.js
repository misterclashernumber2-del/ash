export async function compressImage(file, qualityMode) {
  if (qualityMode === 'original') return file;
  
  const maxWidth = qualityMode === 'fast' ? 1280 : 1920;
  const quality = qualityMode === 'fast' ? 0.6 : 0.82;
  
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(
      Math.min(bitmap.width, maxWidth),
      bitmap.height * (Math.min(bitmap.width, maxWidth) / bitmap.width)
    );
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
  } catch (err) {
    console.error("Image compression failed, sending original", err);
    return file;
  }
}

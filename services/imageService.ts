import heic2any from 'heic2any';

// Smart image compression — Instagram-style approach:
//  • Resize to max 1080px (industry standard for web/social content)
//  • Use WebP format first: ~30% smaller than JPEG at equal visual quality
//  • Fall back to JPEG if WebP is unsupported by the browser
//  • Target: under ~2 MB base64 (≈ 1.5 MB binary), preserving maximum visual quality
const MAX_BASE64_BYTES = 2 * 1024 * 1024; // 2 MB base64 ≈ 1.5 MB binary file
const MAX_WIDTH = 1200;

export const compressImage = async (file: File): Promise<string> => {
  let processedFile = file;

  // Convert iPhone HEIC/HEIF photos to JPEG first
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  ) {
    try {
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const finalBlob = Array.isArray(blob) ? blob[0] : blob;
      processedFile = new File([finalBlob], file.name.replace(/\.hei[cp]$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (err) {
      console.error("Failed to convert HEIC to JPEG", err);
      // If it fails, we fall back to the original file, though the browser will likely fail to read it.
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processedFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down to 1080px max width while preserving aspect ratio
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Use high-quality image smoothing for best visual result during resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // ── Step 1: Try WebP (best quality-to-size ratio, like modern platforms use) ──
        const webpData = canvas.toDataURL('image/webp', 1.0);
        const browserSupportsWebP = webpData.startsWith('data:image/webp');

        if (browserSupportsWebP) {
          if (webpData.length <= MAX_BASE64_BYTES) {
            resolve(webpData);
            return;
          }
          // WebP is still too large — step down only as much as needed
          let q = 0.95;
          while (q >= 0.5) {
            const attempt = canvas.toDataURL('image/webp', q);
            if (attempt.length <= MAX_BASE64_BYTES) {
              resolve(attempt);
              return;
            }
            q -= 0.05;
          }
          // Absolute worst case: take whatever WebP gives us at minimum quality
          resolve(canvas.toDataURL('image/webp', 0.5));
          return;
        }

        // ── Step 2: Fallback to JPEG for browsers that don't support WebP ──
        const jpegData = canvas.toDataURL('image/jpeg', 1.0);
        if (jpegData.length <= MAX_BASE64_BYTES) {
          resolve(jpegData);
          return;
        }
        let q = 0.95;
        while (q >= 0.5) {
          const attempt = canvas.toDataURL('image/jpeg', q);
          if (attempt.length <= MAX_BASE64_BYTES) {
            resolve(attempt);
            return;
          }
          q -= 0.05;
        }
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

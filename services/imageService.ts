
// Utility to compress images before storage to avoid LocalStorage 5MB limit
export const compressImage = async (file: File, maxWidth = 3000, quality = 0.92): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if larger than maxWidth
        if (width > maxWidth) {
          height = height * (maxWidth / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with reduced quality
        const data = elem.toDataURL('image/jpeg', quality);
        resolve(data);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

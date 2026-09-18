export async function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      const canvas = document.createElement('canvas');
      // Scale down proportionally
      let scale = 1;
      if (img.width > maxWidth || img.height > maxWidth) {
        scale = Math.min(maxWidth / img.width, maxWidth / img.height);
      }
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Compress to JPEG with 0.6 quality to ensure it's very small
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    
    img.src = objectUrl;
  });
}

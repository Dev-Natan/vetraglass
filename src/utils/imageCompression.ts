/**
 * Image compression utility for PDF generation
 * Reduces image file sizes significantly while maintaining acceptable quality
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.7,
  format: 'image/jpeg'
};

/**
 * Compress an image from a base64 data URL
 * Returns a compressed base64 data URL
 */
export function compressImage(
  base64DataUrl: string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        const maxW = opts.maxWidth!;
        const maxH = opts.maxHeight!;
        
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64DataUrl); // Fallback to original if canvas fails
          return;
        }
        
        // Use better quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw white background for JPEG (handles transparency)
        if (opts.format === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed format
        const compressedDataUrl = canvas.toDataURL(opts.format, opts.quality);
        
        // Only use compressed if it's actually smaller
        if (compressedDataUrl.length < base64DataUrl.length) {
          resolve(compressedDataUrl);
        } else {
          resolve(base64DataUrl);
        }
      } catch (error) {
        console.warn('Image compression failed, using original:', error);
        resolve(base64DataUrl);
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image for compression, using original');
      resolve(base64DataUrl);
    };
    
    img.src = base64DataUrl;
  });
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  images: Map<string, string>,
  options: CompressionOptions = {}
): Promise<Map<string, string>> {
  const entries = Array.from(images.entries());
  
  const compressedEntries = await Promise.all(
    entries.map(async ([url, base64]) => {
      const compressed = await compressImage(base64, options);
      return [url, compressed] as [string, string];
    })
  );
  
  return new Map(compressedEntries);
}

/**
 * Get compression options based on intended use
 */
export function getCompressionOptions(
  use: 'thumbnail' | 'product' | 'logo' | 'full'
): CompressionOptions {
  switch (use) {
    case 'thumbnail':
      return { maxWidth: 100, maxHeight: 100, quality: 0.6, format: 'image/jpeg' };
    case 'product':
      return { maxWidth: 300, maxHeight: 300, quality: 0.7, format: 'image/jpeg' };
    case 'logo':
      return { maxWidth: 200, maxHeight: 200, quality: 0.8, format: 'image/png' };
    case 'full':
      return { maxWidth: 800, maxHeight: 800, quality: 0.8, format: 'image/jpeg' };
    default:
      return DEFAULT_OPTIONS;
  }
}

/**
 * Processes an image to ensure it has a white or transparent background
 * Uses Canvas API to analyze and replace near-white/gray backgrounds with pure white
 */
export async function processImageBackground(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(blob); // Return original if canvas not supported
            return;
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Fill with white background first
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw the image on top
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process pixels - replace near-white/light gray backgrounds with pure white
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Check if pixel is light gray or near-white (common Excel backgrounds)
            // Threshold: if all RGB values are above 200 and similar to each other
            if (r > 200 && g > 200 && b > 200) {
              const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
              if (maxDiff < 20) {
                // Make it pure white
                data[i] = 255;     // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
                data[i + 3] = 255; // A (fully opaque)
              }
            }
            
            // Also handle transparent pixels - make them white
            if (a < 10) {
              data[i] = 255;     // R
              data[i + 1] = 255; // G
              data[i + 2] = 255; // B
              data[i + 3] = 255; // A
            }
          }
          
          // Put processed data back
          ctx.putImageData(imageData, 0, 0);
          
          // Convert to blob
          canvas.toBlob(
            (processedBlob) => {
              URL.revokeObjectURL(url);
              if (processedBlob) {
                resolve(processedBlob);
              } else {
                resolve(blob); // Return original if conversion fails
              }
            },
            'image/png', // Always output as PNG for quality
            1.0
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          console.error('Error processing image:', err);
          resolve(blob); // Return original on error
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error('Failed to load image for processing');
        resolve(blob); // Return original on error
      };
      
      img.src = url;
    } catch (err) {
      console.error('Error in processImageBackground:', err);
      reject(err);
    }
  });
}

/**
 * Converts ArrayBuffer to Blob with background processing
 */
export async function bufferToBlobWithWhiteBackground(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<Blob> {
  return processImageBackground(buffer, mimeType);
}

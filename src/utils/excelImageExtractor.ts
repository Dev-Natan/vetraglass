import ExcelJS from 'exceljs';

export interface ExtractedImage {
  rowIndex: number;
  colIndex: number;
  buffer: ArrayBuffer;
  extension: string;
  mimeType: string;
  filename: string;
}

export interface ExcelImageResult {
  productImage: ExtractedImage | null;
  itemImages: Map<number, ExtractedImage>; // Map row index -> image
  allImages: ExtractedImage[];
}

/**
 * Extracts embedded images from an Excel file using ExcelJS
 * Maps images to rows based on their anchor position
 */
export async function extractImagesFromExcel(fileBuffer: ArrayBuffer): Promise<ExcelImageResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.getWorksheet(1);
  
  if (!worksheet) {
    return {
      productImage: null,
      itemImages: new Map(),
      allImages: [],
    };
  }
  
  const allImages: ExtractedImage[] = [];
  const itemImages = new Map<number, ExtractedImage>();
  let productImage: ExtractedImage | null = null;
  
  // Get images from the worksheet
  const images = worksheet.getImages();
  
  for (const imageRef of images) {
    try {
      // Get the media object from workbook
      const imageId = imageRef.imageId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const media = (workbook.model as any).media as Array<{ type?: string; buffer?: ArrayBuffer }> | undefined;
      
      if (!media) continue;
      
      // Find the matching media by index
      const mediaIdx = parseInt(imageId);
      const mediaItem = media[mediaIdx];
      
      if (!mediaItem || !mediaItem.buffer) continue;
      
      // Determine position from range
      const range = imageRef.range;
      let rowIndex = 0;
      let colIndex = 0;
      
      if (range && 'tl' in range) {
        // TL is top-left anchor
        rowIndex = Math.floor(range.tl.row || 0);
        colIndex = Math.floor(range.tl.col || 0);
      }
      
      // Get extension from media type
      const extension = mediaItem.type || 'png';
      const mimeType = getMimeType(extension);
      const filename = `image_${rowIndex}_${colIndex}.${extension}`;
      
      const extractedImage: ExtractedImage = {
        rowIndex,
        colIndex,
        buffer: mediaItem.buffer as ArrayBuffer,
        extension,
        mimeType,
        filename,
      };
      
      allImages.push(extractedImage);
      
      // First image (usually in header area, rows 0-5) is likely the product/logo image
      if (rowIndex <= 5 && !productImage) {
        productImage = extractedImage;
      } else if (rowIndex > 5) {
        // Images after header are likely associated with items at that row
        itemImages.set(rowIndex, extractedImage);
      }
    } catch (error) {
      console.warn('Error extracting image:', error);
    }
  }
  
  return {
    productImage,
    itemImages,
    allImages,
  };
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  
  return mimeTypes[extension.toLowerCase()] || 'image/png';
}

/**
 * Converts ArrayBuffer to base64 data URL
 */
export function bufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Converts ArrayBuffer to Blob
 */
export function bufferToBlob(buffer: ArrayBuffer, mimeType: string): Blob {
  return new Blob([buffer], { type: mimeType });
}

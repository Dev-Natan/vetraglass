import { supabase } from "@/integrations/supabase/client";
import { ExtractedImage } from "./excelImageExtractor";
import { bufferToBlobWithWhiteBackground } from "./imageBackgroundProcessor";

const BUCKET_NAME = 'product-images';

/**
 * Uploads an extracted Excel image to Supabase storage
 * Images are processed to have a white background
 */
export async function uploadExcelImage(
  image: ExtractedImage,
  folder: string,
  customName?: string
): Promise<string | null> {
  try {
    // Process image to ensure white background
    const blob = await bufferToBlobWithWhiteBackground(image.buffer, image.mimeType);
    
    // Always use PNG extension since we convert to PNG for quality
    const fileName = customName 
      ? `${customName}.png`
      : `${Date.now()}_${image.filename.replace(/\.[^.]+$/, '.png')}`;
    
    const filePath = `${folder}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadExcelImage:', error);
    return null;
  }
}

/**
 * Uploads multiple images for a product and its items
 */
export async function uploadProductImages(
  productName: string,
  productImage: ExtractedImage | null,
  itemImages: Map<number, ExtractedImage>
): Promise<{
  productImageUrl: string | null;
  itemImageUrls: Map<number, string>;
}> {
  const folderName = sanitizeFolderName(productName);
  
  let productImageUrl: string | null = null;
  const itemImageUrls = new Map<number, string>();
  
  // Upload product image
  if (productImage) {
    productImageUrl = await uploadExcelImage(
      productImage,
      `products/${folderName}`,
      'main'
    );
  }
  
  // Upload item images
  for (const [rowIndex, image] of itemImages) {
    const url = await uploadExcelImage(
      image,
      `products/${folderName}/items`,
      `item_row_${rowIndex}`
    );
    if (url) {
      itemImageUrls.set(rowIndex, url);
    }
  }
  
  return { productImageUrl, itemImageUrls };
}

function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

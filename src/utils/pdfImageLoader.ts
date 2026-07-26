/**
 * Optimized image loading utility for PDF generation
 * Uses caching, parallel loading, and compression to improve performance
 */

import { compressImage, CompressionOptions, getCompressionOptions } from './imageCompression';
import { resolveProductImageUrl } from './imageUrl';
import { resolveSignedUrl } from '@/components/common/SignedImage';

// In-memory cache for loaded images (session-based)
const imageCache = new Map<string, string>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

// Default compression options for PDF images
const DEFAULT_PDF_COMPRESSION: CompressionOptions = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.7,
  format: 'image/jpeg'
};

/**
 * Normalize URL by removing cache-buster params for consistent caching
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove common cache-buster params
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('_');
    urlObj.searchParams.delete('cache');
    return urlObj.toString();
  } catch {
    return url;
  }
}

async function loadSingleImage(url: string, compress: boolean = true): Promise<string | null> {
  // Normalize URL for consistent caching
  const normalizedUrl = normalizeUrl(url);
  const cacheKey = compress ? `${normalizedUrl}:compressed` : normalizedUrl;
  
  // Return cached version if available
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // Return pending request if already in flight
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // Create new request
  const request = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for slower connections

      // Resolve to a signed URL when the source points at a private Supabase storage bucket.
      // Public-style URLs (…/object/public/…) fail with 400 when the bucket is private,
      // so we mint a short-lived signed URL first.
      const fetchUrl = (await resolveSignedUrl(normalizedUrl)) || normalizedUrl;

      // Use normalized URL for fetch (without cache buster)
      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        cache: 'no-store', // Always fetch fresh from storage
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to load image: ${normalizedUrl} - Status: ${response.status}`);
        return null;
      }

      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          let result = reader.result as string;
          
          // Compress image if enabled
          if (compress && result) {
            try {
              result = await compressImage(result, DEFAULT_PDF_COMPRESSION);
            } catch (err) {
              console.warn('Compression failed, using original:', err);
            }
          }
          
          imageCache.set(cacheKey, result); // Cache with normalized URL
          pendingRequests.delete(cacheKey);
          resolve(result);
        };
        reader.onerror = () => {
          console.warn(`Failed to read image blob: ${normalizedUrl}`);
          pendingRequests.delete(cacheKey);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`Error loading image: ${normalizedUrl}`, error);
      pendingRequests.delete(cacheKey);
      return null;
    }
  })();

  pendingRequests.set(cacheKey, request);
  return request;
}

export interface PreloadOptions {
  compress?: boolean;
  compressionType?: 'thumbnail' | 'product' | 'logo' | 'full';
}

/**
 * Preload multiple images in parallel with compression
 * Call this before generating PDF to warm up the cache
 */
export async function preloadImages(
  urls: (string | null | undefined)[],
  options: PreloadOptions = { compress: true }
): Promise<Map<string, string>> {
  const validUrls = urls.filter((url): url is string => !!url);
  const uniqueUrls = [...new Set(validUrls)];
  
  // Load all images in parallel with concurrency limit
  const BATCH_SIZE = 6; // Browser typically allows 6 concurrent connections per domain
  const results = new Map<string, string>();
  
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const base64 = await loadSingleImage(url, options.compress !== false);
        return { url, base64 };
      })
    );
    
    batchResults.forEach(({ url, base64 }) => {
      if (base64) results.set(url, base64);
    });
  }
  
  return results;
}

/**
 * Get a cached image or load it
 */
export async function getImageBase64(url: string | null | undefined, compress: boolean = true): Promise<string | null> {
  if (!url) return null;
  return loadSingleImage(url, compress);
}

/**
 * Get cached image synchronously (returns null if not cached)
 * Use after preloadImages to get images without async
 */
export function getCachedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalizedUrl = normalizeUrl(url);
  // Check compressed version first, then uncompressed
  return imageCache.get(`${normalizedUrl}:compressed`) || imageCache.get(normalizedUrl) || null;
}

/**
 * Clear the image cache (call on logout or when memory is a concern)
 */
export function clearImageCache(): void {
  imageCache.clear();
  pendingRequests.clear();
}

/**
 * Get product image URL with proper path handling
 */
export function getProductImageUrl(imageUrl: string | null | undefined): string | null {
  return resolveProductImageUrl(imageUrl);
}

/**
 * Collect all image URLs from quote items for preloading
 */
export function collectQuoteImageUrls(
  items: Array<{ image_url?: string | null }>,
  logoUrl?: string | null
): string[] {
  const urls: string[] = [];
  
  if (logoUrl) urls.push(logoUrl);
  
  items.forEach(item => {
    const url = getProductImageUrl(item.image_url);
    if (url) urls.push(url);
  });
  
  return urls;
}

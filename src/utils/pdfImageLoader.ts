/**
 * Optimized image loading utility for PDF generation
 * Uses caching and parallel loading to improve performance
 */

// In-memory cache for loaded images (session-based)
const imageCache = new Map<string, string>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

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

async function loadSingleImage(url: string): Promise<string | null> {
  // Normalize URL for consistent caching
  const normalizedUrl = normalizeUrl(url);
  
  // Return cached version if available
  if (imageCache.has(normalizedUrl)) {
    return imageCache.get(normalizedUrl)!;
  }

  // Return pending request if already in flight
  if (pendingRequests.has(normalizedUrl)) {
    return pendingRequests.get(normalizedUrl)!;
  }

  // Create new request
  const request = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for slower connections

      // Use normalized URL for fetch (without cache buster)
      const response = await fetch(normalizedUrl, { 
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
        reader.onloadend = () => {
          const result = reader.result as string;
          imageCache.set(normalizedUrl, result); // Cache with normalized URL
          pendingRequests.delete(normalizedUrl);
          resolve(result);
        };
        reader.onerror = () => {
          console.warn(`Failed to read image blob: ${normalizedUrl}`);
          pendingRequests.delete(normalizedUrl);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn(`Error loading image: ${normalizedUrl}`, error);
      pendingRequests.delete(normalizedUrl);
      return null;
    }
  })();

  pendingRequests.set(normalizedUrl, request);
  return request;
}

/**
 * Preload multiple images in parallel
 * Call this before generating PDF to warm up the cache
 */
export async function preloadImages(urls: (string | null | undefined)[]): Promise<Map<string, string>> {
  const validUrls = urls.filter((url): url is string => !!url);
  const uniqueUrls = [...new Set(validUrls)];
  
  // Load all images in parallel with concurrency limit
  const BATCH_SIZE = 6; // Browser typically allows 6 concurrent connections per domain
  const results = new Map<string, string>();
  
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const base64 = await loadSingleImage(url);
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
export async function getImageBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  return loadSingleImage(url);
}

/**
 * Get cached image synchronously (returns null if not cached)
 * Use after preloadImages to get images without async
 */
export function getCachedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalizedUrl = normalizeUrl(url);
  return imageCache.get(normalizedUrl) || null;
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
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${window.location.origin}/products/${imageUrl}`;
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

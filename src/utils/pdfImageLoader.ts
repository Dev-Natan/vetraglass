/**
 * Optimized image loading utility for PDF generation
 * Uses caching and parallel loading to improve performance
 */

// In-memory cache for loaded images (session-based)
const imageCache = new Map<string, string>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

/**
 * Load a single image as base64 with caching
 */
async function loadSingleImage(url: string): Promise<string | null> {
  // Return cached version if available
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  // Return pending request if already in flight
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!;
  }

  // Create new request
  const request = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(url, { 
        signal: controller.signal,
        cache: 'force-cache' // Use browser cache when available
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          imageCache.set(url, result); // Cache the result
          pendingRequests.delete(url);
          resolve(result);
        };
        reader.onerror = () => {
          pendingRequests.delete(url);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch {
      pendingRequests.delete(url);
      return null;
    }
  })();

  pendingRequests.set(url, request);
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
  return imageCache.get(url) || null;
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

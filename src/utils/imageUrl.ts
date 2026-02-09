const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

type ImageBucket =
  | 'item-templates'
  | 'product-templates'
  | 'company-product-images'
  | 'company-item-images'
  | 'product-images';

/**
 * Resolve any image path to a full URL.
 *
 * Handles three kinds of stored values:
 *  1. Full URL  (`https://…`)        → returned as-is
 *  2. Root-relative (`/profiles/…`)  → returned as-is (served from public/)
 *  3. Storage key (`abc123/file.png`) → builds Supabase Storage public URL
 *
 * For storage keys the bucket is auto-detected when `defaultBucket` is not
 * provided: paths that start with a UUID go to `company-product-images`,
 * everything else falls back to `item-templates`.
 */
export function resolveImageUrl(
  path: string | null | undefined,
  defaultBucket?: ImageBucket,
): string | null {
  if (!path) return null;

  // 1. Already a full URL
  if (path.startsWith('http')) return path;

  // 2. Root-relative path (e.g. /profiles/su-080.jpg)
  if (path.startsWith('/')) return path;

  // 3. Storage key → build full URL
  const bucket =
    defaultBucket ??
    (UUID_PATTERN.test(path) ? 'company-product-images' : 'item-templates');

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Shortcut for item images (profiles, accessories, etc.).
 * Uses `item-templates` as default bucket.
 */
export function resolveItemImageUrl(path: string | null | undefined): string | null {
  return resolveImageUrl(path, 'item-templates');
}

/**
 * Shortcut for product images.
 * Auto-detects company uploads (UUID paths → `company-product-images`)
 * vs template images (`product-templates`).
 */
export function resolveProductImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/')) return path;
  const bucket = UUID_PATTERN.test(path) ? 'company-product-images' : 'product-templates';
  return resolveImageUrl(path, bucket);
}

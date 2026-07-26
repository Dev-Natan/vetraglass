import { useEffect, useState, ImgHTMLAttributes } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Converts a stored image URL (public-style Supabase storage URL) into a
 * signed URL, since the workspace policy forces buckets to be private.
 *
 * Accepts:
 *  - Full public Supabase URLs: .../storage/v1/object/public/{bucket}/{path}
 *  - Already-signed URLs (contain `/object/sign/`) — passed through
 *  - Absolute http(s) URLs from other origins — passed through
 *  - Root-relative paths (/foo.png) — passed through
 *  - null/undefined — returns null
 */

const cache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 60 * 60; // 1 hour signed URL
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

function parseStorageUrl(input: string): { bucket: string; path: string } | null {
  // Match .../storage/v1/object/(public|sign)/{bucket}/{path}
  const m = input.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
}

export async function resolveSignedUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  // Non-storage URLs / already-signed URLs pass through
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  if (!src.includes('/storage/v1/object/')) return src;

  const parsed = parseStorageUrl(src);
  if (!parsed) return src;

  const key = `${parsed.bucket}/${parsed.path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) return cached.url;

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const req = (async () => {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, TTL_SECONDS);
    pending.delete(key);
    if (error || !data?.signedUrl) return null;
    cache.set(key, { url: data.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
    return data.signedUrl;
  })();
  pending.set(key, req);
  return req;
}

export function useSignedImageUrl(src: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!src) return null;
    const parsed = parseStorageUrl(src);
    if (parsed) {
      const cached = cache.get(`${parsed.bucket}/${parsed.path}`);
      if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url;
    }
    return src.includes('/storage/v1/object/') ? null : src;
  });

  useEffect(() => {
    let cancelled = false;
    resolveSignedUrl(src).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return url;
}

interface SignedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  fallback?: string;
}

export function SignedImage({ src, fallback, ...rest }: SignedImageProps) {
  const resolved = useSignedImageUrl(src);
  const finalSrc = resolved ?? fallback;
  if (!finalSrc) return null;
  return <img src={finalSrc} {...rest} />;
}

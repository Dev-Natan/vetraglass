/**
 * Global image URL rewriter.
 *
 * The workspace policy forces every Supabase Storage bucket to be private.
 * Historical data (and legacy code paths) store `.../object/public/{bucket}/{path}`
 * URLs that now return 400. This module installs a lightweight interceptor
 * that transparently rewrites those `<img src>` attributes to signed URLs.
 *
 * Strategy:
 *  1. Patch the `src` setter on HTMLImageElement so any assignment routes
 *     through `rewrite()`.
 *  2. Also install a MutationObserver to catch img nodes and src-attribute
 *     mutations set via `setAttribute` / server-rendered markup.
 *  3. Cache signed URLs (1h TTL) to avoid a network hit per image.
 */
import { supabase } from '@/integrations/supabase/client';

const PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?.*)?$/;
const cache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN = 5 * 60 * 1000;

function parse(src: string): { bucket: string; path: string; query: string } | null {
  const m = src.match(PUBLIC_RE);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]), query: m[3] || '' };
}

async function resolve(src: string): Promise<string | null> {
  const p = parse(src);
  if (!p) return null;
  const key = `${p.bucket}/${p.path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - REFRESH_MARGIN > now) return cached.url;
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const req = (async () => {
    const { data, error } = await supabase.storage
      .from(p.bucket)
      .createSignedUrl(p.path, TTL_SECONDS);
    pending.delete(key);
    if (error || !data?.signedUrl) return null;
    cache.set(key, { url: data.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
    return data.signedUrl;
  })();
  pending.set(key, req);
  return req;
}

const REWRITTEN = new WeakSet<HTMLImageElement>();

function tryRewrite(img: HTMLImageElement) {
  const current = img.getAttribute('src');
  if (!current || !PUBLIC_RE.test(current)) return;
  if (REWRITTEN.has(img)) return;
  REWRITTEN.add(img);
  resolve(current).then((signed) => {
    if (signed && img.getAttribute('src') === current) {
      img.setAttribute('src', signed);
    }
  });
}

let installed = false;
export function installImageUrlRewriter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Scan existing DOM
  const scan = (root: ParentNode) => {
    root.querySelectorAll?.('img').forEach((el) => tryRewrite(el as HTMLImageElement));
  };
  scan(document);

  // Observe future mutations
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof HTMLImageElement) {
        tryRewrite(m.target);
      } else if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) tryRewrite(node);
          else if (node instanceof Element) scan(node);
        });
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}

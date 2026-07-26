/**
 * Global image URL rewriter.
 *
 * The workspace policy forces every Supabase Storage bucket to be private.
 * Historical data (and legacy code paths) store `.../object/public/{bucket}/{path}`
 * URLs that now return 400. This module installs a lightweight interceptor
 * that transparently rewrites those URLs to signed URLs.
 *
 * Covers:
 *  1. `<img src>` (attribute + property assignments)
 *  2. Inline `style="background-image: url(...)"` and any CSS custom prop
 *     that resolves to a `url(...)` value on elements.
 *  3. Future DOM mutations via a MutationObserver.
 */
import { supabase } from '@/integrations/supabase/client';

const PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?[^)"'\s]*)?$/;
// Match url(...) occurrences (single, double, or no quotes) inside inline style strings.
const URL_IN_CSS_RE = /url\((['"]?)([^)'"]+)\1\)/g;
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

const REWRITTEN_IMG = new WeakSet<HTMLImageElement>();
const REWRITTEN_SVG = new WeakSet<Element>();
// Track processed (element, propertyName) pairs so we don't rewrite in a loop.
const REWRITTEN_STYLE = new WeakMap<Element, Set<string>>();

function tryRewriteImg(img: HTMLImageElement) {
  const current = img.getAttribute('src');
  if (!current || !PUBLIC_RE.test(current)) return;
  if (REWRITTEN_IMG.has(img)) return;
  REWRITTEN_IMG.add(img);
  resolve(current).then((signed) => {
    if (signed && img.getAttribute('src') === current) {
      img.setAttribute('src', signed);
    }
  });
}

const SVG_HREF_TAGS = new Set(['image', 'use', 'feImage', 'pattern', 'textPath', 'mpath', 'linearGradient', 'radialGradient']);

function isSvgHrefElement(el: Element): boolean {
  return el.namespaceURI === 'http://www.w3.org/2000/svg' && SVG_HREF_TAGS.has(el.localName);
}

function tryRewriteSvgHref(el: Element) {
  if (!isSvgHrefElement(el)) return;
  if (REWRITTEN_SVG.has(el)) return;
  // Prefer `href`, fall back to legacy `xlink:href`.
  const attr = el.hasAttribute('href') ? 'href' : el.hasAttribute('xlink:href') ? 'xlink:href' : null;
  if (!attr) return;
  const current = el.getAttribute(attr);
  if (!current || !PUBLIC_RE.test(current)) return;
  REWRITTEN_SVG.add(el);
  resolve(current).then((signed) => {
    if (signed && el.getAttribute(attr) === current) {
      if (attr === 'xlink:href') {
        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', signed);
      } else {
        el.setAttribute(attr, signed);
      }
    }
  });
}


/**
 * Rewrite url(...) refs inside a CSS value string. Returns the (possibly
 * unchanged) string synchronously; async resolutions apply via `apply()`.
 */
function rewriteCssValue(
  value: string,
  apply: (next: string) => void,
): void {
  if (!value || value.indexOf('url(') === -1) return;
  const matches = Array.from(value.matchAll(URL_IN_CSS_RE));
  const targets = matches.filter((m) => PUBLIC_RE.test(m[2]));
  if (targets.length === 0) return;

  Promise.all(
    targets.map(async (m) => ({ original: m[2], signed: await resolve(m[2]) })),
  ).then((resolved) => {
    let next = value;
    let changed = false;
    for (const r of resolved) {
      if (r.signed && next.includes(r.original)) {
        // Replace all url(...) occurrences of this original within the value.
        next = next.replace(
          new RegExp(`url\\((['"]?)${escapeRegExp(r.original)}\\1\\)`, 'g'),
          `url("${r.signed}")`,
        );
        changed = true;
      }
    }
    if (changed) apply(next);
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STYLE_PROPS = [
  'background-image',
  'background',
  'border-image',
  'border-image-source',
  'list-style-image',
  'mask-image',
  '-webkit-mask-image',
  'content',
  'cursor',
];

function tryRewriteStyle(el: Element) {
  const style = (el as HTMLElement).style;
  if (!style) return;
  let processed = REWRITTEN_STYLE.get(el);
  for (const prop of STYLE_PROPS) {
    const value = style.getPropertyValue(prop);
    if (!value || value.indexOf('url(') === -1) continue;
    const key = `${prop}:${value}`;
    if (processed?.has(key)) continue;
    if (!processed) {
      processed = new Set();
      REWRITTEN_STYLE.set(el, processed);
    }
    processed.add(key);
    const priority = style.getPropertyPriority(prop);
    rewriteCssValue(value, (next) => {
      style.setProperty(prop, next, priority);
      processed!.add(`${prop}:${next}`);
    });
  }
}

let installed = false;
export function installImageUrlRewriter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const scan = (root: ParentNode) => {
    root.querySelectorAll?.('img').forEach((el) => tryRewriteImg(el as HTMLImageElement));
    // Any element carrying an inline style may contain a url(...) reference.
    root.querySelectorAll?.('[style*="url("]').forEach((el) => tryRewriteStyle(el));
    if (root instanceof Element && root.hasAttribute?.('style')) tryRewriteStyle(root);
    // SVG <image>, <use>, <feImage>, gradients etc. referencing storage URLs.
    root.querySelectorAll?.('image, use, feImage, pattern, textPath, mpath, linearGradient, radialGradient')
      .forEach((el) => tryRewriteSvgHref(el));
    if (root instanceof Element) tryRewriteSvgHref(root);
  };
  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        if (m.target instanceof HTMLImageElement && m.attributeName === 'src') {
          tryRewriteImg(m.target);
        } else if (m.target instanceof Element && m.attributeName === 'style') {
          tryRewriteStyle(m.target);
        } else if (
          m.target instanceof Element &&
          (m.attributeName === 'href' || m.attributeName === 'xlink:href')
        ) {
          REWRITTEN_SVG.delete(m.target);
          tryRewriteSvgHref(m.target);
        }
      } else if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) tryRewriteImg(node);
          else if (node instanceof Element) scan(node);
        });
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'href', 'xlink:href'],
  });
}


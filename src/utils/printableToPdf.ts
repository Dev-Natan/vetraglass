import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Render a live DOM node to a multi-page A4 PDF and trigger download.
 *
 * Strategy: clone the source node into an ISOLATED off-screen container
 * (`.pdf-render-root`) so the live app's Tailwind/flex/absolute layout
 * cannot interfere with html2canvas. The container is fixed at A4 width
 * (794px @ 96dpi), pure white background, and strips interactive chrome
 * via `data-html2canvas-ignore`.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const A4_WIDTH_PX = 794;

  // 1. Build an isolated host so nothing in the app tree affects layout.
  const host = document.createElement('div');
  host.className = 'pdf-render-root';
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${A4_WIDTH_PX}px`,
    minHeight: '0',
    padding: '0',
    margin: '0',
    background: '#ffffff',
    color: '#000000',
    zIndex: '-2147483648',
    // Off-screen but still laid out and painted.
    transform: 'translateX(-10000px)',
    pointerEvents: 'none',
    overflow: 'visible',
    boxSizing: 'border-box',
  } as CSSStyleDeclaration);

  // 2. Deep clone the report so we never mutate the on-screen DOM.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add('force-visible-for-pdf');
  Object.assign(clone.style, {
    position: 'static',
    left: 'auto',
    top: 'auto',
    width: `${A4_WIDTH_PX}px`,
    maxWidth: `${A4_WIDTH_PX}px`,
    margin: '0',
    padding: '16px',
    display: 'block',
    visibility: 'visible',
    background: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box',
    transform: 'none',
    float: 'none',
  } as CSSStyleDeclaration);

  // 3. Strip ghost/interactive elements from the clone so html2canvas
  //    doesn't try to render hidden inputs, checkboxes, or action buttons.
  const strip = clone.querySelectorAll<HTMLElement>(
    'button, input, select, textarea, [role="button"], [data-no-pdf], .no-print',
  );
  strip.forEach((n) => {
    n.setAttribute('data-html2canvas-ignore', 'true');
    n.remove();
  });

  // Ensure remaining images load with CORS enabled so they aren't tainted.
  clone.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    img.crossOrigin = 'anonymous';
    img.setAttribute('crossorigin', 'anonymous');
  });

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    // 4. Wait for all images inside the clone to finish loading.
    const imgs = Array.from(clone.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }),
    );

    // 5. Rasterize with high DPI. Fixed windowWidth prevents responsive reflow.
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: A4_WIDTH_PX,
      width: A4_WIDTH_PX,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore'),
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (imgHeightMm <= pageHeightMm) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, imgWidthMm, imgHeightMm);
    } else {
      const pxPerMm = canvas.width / pageWidthMm;
      const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeightPx,
          0, 0, canvas.width, sliceHeightPx,
        );

        const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHeightMm = sliceHeightPx / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(sliceDataUrl, 'JPEG', 0, 0, imgWidthMm, sliceHeightMm);

        renderedPx += sliceHeightPx;
        pageIndex += 1;
      }
    }

    pdf.save(filename);
  } finally {
    host.remove();
  }
}

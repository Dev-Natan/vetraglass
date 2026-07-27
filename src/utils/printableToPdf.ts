import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Render a live DOM node to a multi-page A4 PDF and trigger download.
 * The element is temporarily moved off-screen and forced to A4 width so
 * html2canvas can capture it at full resolution (including images).
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  // A4 @ 96 DPI ≈ 794 × 1123 px. Use 794 for width.
  const A4_WIDTH_PX = 794;

  // Snapshot original inline styles so we can restore them.
  const original = {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    display: element.style.display,
    visibility: element.style.visibility,
    background: element.style.background,
    zIndex: element.style.zIndex,
    className: element.className,
  };

  // Make it laid out (off-screen) but visible for html2canvas.
  element.style.position = 'fixed';
  element.style.left = '0';
  element.style.top = '0';
  element.style.width = `${A4_WIDTH_PX}px`;
  element.style.display = 'block';
  element.style.visibility = 'visible';
  element.style.background = '#ffffff';
  element.style.zIndex = '-1';
  // Neutralize the global `.printable-report { display: none }` screen rule.
  element.classList.add('force-visible-for-pdf');

  try {
    // Wait for images inside to fully load (browsers cache them).
    const imgs = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }),
    );

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: A4_WIDTH_PX,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    // Full canvas mapped to page width; slice vertically per page.
    const imgWidthMm = pageWidthMm;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (imgHeightMm <= pageHeightMm) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, imgWidthMm, imgHeightMm);
    } else {
      // Slice canvas into page-sized chunks to preserve fidelity.
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
    // Restore original inline styles / class.
    element.style.position = original.position;
    element.style.left = original.left;
    element.style.top = original.top;
    element.style.width = original.width;
    element.style.display = original.display;
    element.style.visibility = original.visibility;
    element.style.background = original.background;
    element.style.zIndex = original.zIndex;
    element.className = original.className;
  }
}

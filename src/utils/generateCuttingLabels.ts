// Cutting Labels Generator - Creates individual labels for each piece

export interface LabelData {
  osNumber: string;
  productName: string;
  itemName: string;
  itemType: 'profile' | 'glass';
  dimensions: {
    length?: number;
    width?: number;
    height?: number;
  };
  position?: string;
  angle?: number;
  angleStart?: number;
  angleEnd?: number;
  pieceNumber: number;
  totalPieces: number;
  qrData?: string;
}

export interface LabelOptions {
  labelWidth?: number; // mm
  labelHeight?: number; // mm
  showQR?: boolean;
  showLogo?: boolean;
  logoUrl?: string;
}

const defaultOptions: LabelOptions = {
  labelWidth: 70,
  labelHeight: 40,
  showQR: true,
  showLogo: false,
};

/**
 * Generates a printable HTML page with cutting labels
 */
export function generateCuttingLabels(
  labels: LabelData[],
  options: LabelOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const labelsPerRow = 3;
  const rows: LabelData[][] = [];
  
  for (let i = 0; i < labels.length; i += labelsPerRow) {
    rows.push(labels.slice(i, i + labelsPerRow));
  }

  const generateQRSvg = (data: string, size: number = 60) => {
    // Simple QR code placeholder - in production, use a real QR library
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="qr-code">
        <rect width="${size}" height="${size}" fill="white" stroke="#ddd"/>
        <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#999">QR</text>
        <text x="${size/2}" y="${size/2 + 10}" text-anchor="middle" font-size="6" fill="#666">${data.slice(0, 8)}</text>
      </svg>
    `;
  };

  const getLabelColor = (type: 'profile' | 'glass') => {
    return type === 'glass' 
      ? { bg: '#f3e8ff', border: '#9333ea', text: '#7c3aed' }
      : { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' };
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Etiquetas de Corte - ${labels[0]?.osNumber || 'OS'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { 
            size: A4; 
            margin: 10mm; 
          }
          body { 
            font-family: Arial, sans-serif; 
            padding: 10mm;
            background: #f5f5f5;
          }
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            gap: 5mm;
            justify-content: flex-start;
          }
          .label {
            width: ${opts.labelWidth}mm;
            height: ${opts.labelHeight}mm;
            border: 1px solid #333;
            border-radius: 3mm;
            padding: 2mm;
            background: white;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
            position: relative;
            overflow: hidden;
          }
          .label-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 1.5mm;
            border-bottom: 0.5mm dashed #ccc;
            margin-bottom: 1.5mm;
          }
          .os-number {
            font-size: 8pt;
            font-weight: bold;
            color: #333;
          }
          .piece-number {
            font-size: 7pt;
            background: #333;
            color: white;
            padding: 0.5mm 2mm;
            border-radius: 2mm;
          }
          .label-body {
            flex: 1;
            display: flex;
            gap: 2mm;
          }
          .label-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .item-name {
            font-size: 9pt;
            font-weight: bold;
            line-height: 1.2;
            max-height: 3.5em;
            overflow: hidden;
          }
          .dimensions {
            display: flex;
            flex-wrap: wrap;
            gap: 1mm;
          }
          .dim-box {
            font-size: 10pt;
            font-weight: bold;
            padding: 1mm 2mm;
            border-radius: 1.5mm;
          }
          .dim-length { background: #dcfce7; color: #166534; }
          .dim-width { background: #fef3c7; color: #92400e; }
          .dim-height { background: #dbeafe; color: #1e40af; }
          .position-badge {
            font-size: 6pt;
            padding: 0.5mm 1.5mm;
            border-radius: 1mm;
            display: inline-flex;
            align-items: center;
            gap: 1mm;
          }
          .qr-container {
            width: 15mm;
            height: 15mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code {
            width: 100%;
            height: 100%;
          }
          .item-type-indicator {
            position: absolute;
            top: 0;
            right: 0;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 0 8mm 8mm 0;
          }
          .type-glass { border-color: transparent #9333ea transparent transparent; }
          .type-profile { border-color: transparent #0284c7 transparent transparent; }
          .product-name {
            font-size: 6pt;
            color: #666;
            margin-top: 0.5mm;
          }
          @media print {
            body { 
              background: white; 
              padding: 0;
            }
            .label {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labels.map((label) => {
            const colors = getLabelColor(label.itemType);
            return `
              <div class="label" style="border-color: ${colors.border};">
                <div class="item-type-indicator type-${label.itemType}"></div>
                
                <div class="label-header">
                  <span class="os-number">${label.osNumber}</span>
                  <span class="piece-number">${label.pieceNumber}/${label.totalPieces}</span>
                </div>
                
                <div class="label-body">
                  <div class="label-info">
                    <div>
                      <div class="item-name">${label.itemName}</div>
                      <div class="product-name">${label.productName}</div>
                    </div>
                    
                    <div class="dimensions">
                      ${label.dimensions.length ? `
                        <span class="dim-box dim-length">${label.dimensions.length} mm</span>
                      ` : ''}
                      ${label.dimensions.width ? `
                        <span class="dim-box dim-width">L: ${label.dimensions.width}</span>
                      ` : ''}
                      ${label.dimensions.height ? `
                        <span class="dim-box dim-height">A: ${label.dimensions.height}</span>
                      ` : ''}
                    </div>
                    
                    ${label.position || label.angle ? `
                      <div style="display: flex; gap: 2mm; margin-top: 1mm;">
                        ${label.position ? `
                          <span class="position-badge" style="background: ${label.position === 'Altura' ? '#dbeafe' : '#fef3c7'}; color: ${label.position === 'Altura' ? '#1e40af' : '#92400e'};">
                            <span style="width: 4px; height: 4px; border-radius: 50%; background: currentColor;"></span>
                            ${label.position}
                          </span>
                        ` : ''}
                        ${label.angle ? `
                          <span class="position-badge" style="background: #f3f4f6; color: #374151;">
                            ∠ ${label.angle}°
                          </span>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                  
                  ${opts.showQR ? `
                    <div class="qr-container">
                      ${generateQRSvg(label.qrData || `${label.osNumber}-${label.pieceNumber}`)}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Expands cuts into individual labels
 */
export function expandCutsToLabels(
  osNumber: string,
  productName: string,
  profileCuts: Array<{
    id: string;
    profileName: string;
    calculatedLength: number;
    quantity: number;
    position: string;
    cutAngle: number;
  }>,
  glassCuts: Array<{
    id: string;
    glassName: string;
    customName?: string | null;
    calculatedWidth: number;
    calculatedHeight: number;
    quantity: number;
  }>
): LabelData[] {
  const labels: LabelData[] = [];
  let pieceCounter = 0;
  
  // Calculate total pieces
  const totalProfilePieces = profileCuts.reduce((sum, c) => sum + c.quantity, 0);
  const totalGlassPieces = glassCuts.reduce((sum, c) => sum + c.quantity, 0);
  const totalPieces = totalProfilePieces + totalGlassPieces;

  // Generate profile labels
  profileCuts.forEach((cut) => {
    for (let i = 0; i < cut.quantity; i++) {
      pieceCounter++;
      labels.push({
        osNumber,
        productName,
        itemName: cut.profileName,
        itemType: 'profile',
        dimensions: { length: cut.calculatedLength },
        position: cut.position,
        angle: cut.cutAngle,
        pieceNumber: pieceCounter,
        totalPieces,
        qrData: `${osNumber}-P-${cut.id}-${i + 1}`,
      });
    }
  });

  // Generate glass labels
  glassCuts.forEach((cut) => {
    for (let i = 0; i < cut.quantity; i++) {
      pieceCounter++;
      labels.push({
        osNumber,
        productName,
        itemName: cut.customName || cut.glassName,
        itemType: 'glass',
        dimensions: {
          width: cut.calculatedWidth,
          height: cut.calculatedHeight,
        },
        pieceNumber: pieceCounter,
        totalPieces,
        qrData: `${osNumber}-G-${cut.id}-${i + 1}`,
      });
    }
  });

  return labels;
}

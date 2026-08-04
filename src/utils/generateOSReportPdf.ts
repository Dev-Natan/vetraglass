import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OSComposedItem, OSComposedRow } from '@/hooks/useOSComposition';
import { resolveProductImageUrl } from '@/utils/imageUrl';

interface OSInfo {
  os_number: number;
  customer_name: string;
  customer_address?: string | null;
  customer_phone?: string | null;
  estimated_end?: string | null;
}

interface CompanyInfo {
  name?: string;
  cnpj?: string;
  phone?: string;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

export async function generateOSReportPdf(
  items: OSComposedItem[],
  os: OSInfo,
  company: CompanyInfo | null,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const osNum = String(os.os_number || 0).padStart(4, '0');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ordem de Serviço #${osNum}`, 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (company?.name) doc.text(company.name, pageW - 14, 12, { align: 'right' });
  if (company?.cnpj) doc.text(`CNPJ: ${company.cnpj}`, pageW - 14, 17, { align: 'right' });
  if (company?.phone) doc.text(`Tel: ${company.phone}`, pageW - 14, 22, { align: 'right' });

  doc.setFontSize(10);
  doc.text(`Cliente: ${os.customer_name || '-'}`, 14, 24);
  if (os.customer_phone) doc.text(`Telefone: ${os.customer_phone}`, 14, 29);
  if (os.customer_address) doc.text(`Endereço: ${os.customer_address}`, 14, 34);
  if (os.estimated_end) doc.text(`Previsão: ${fmtDate(os.estimated_end)}`, 14, 39);

  let cursorY = 46;

  // Preload product thumbnails (data URLs)
  const productImages: Record<string, string | null> = {};
  await Promise.all(
    items.map(async (it) => {
      const raw = it.productImageUrl || it.rows.find((r) => r.imageUrl)?.imageUrl || null;
      const resolved = raw ? resolveProductImageUrl(raw) || raw : null;
      productImages[it.osItemId] = resolved ? await urlToDataUrl(resolved) : null;
    }),
  );

  const IMG_MM = 14;
  // Summary Table
  autoTable(doc, {
    startY: cursorY,
    head: [['Img', 'Produto', 'Qtd', 'Larg (mm)', 'Alt (mm)', 'Cor Alu.', 'Vidro']],
    body: items.map((it) => [
      '',
      it.productName,
      String(it.productQty),
      String(it.width),
      String(it.height),
      it.aluminumColor || '-',
      [it.glassColor, it.glassThickness ? `${it.glassThickness}mm` : null]
        .filter(Boolean)
        .join(' ') || '-',
    ]),
    styles: { fontSize: 9, cellPadding: 2, minCellHeight: IMG_MM + 2, valign: 'middle' },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 0: { cellWidth: IMG_MM + 4, halign: 'center' } },
    theme: 'grid',
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const it = items[data.row.index];
      const img = it && productImages[it.osItemId];
      if (!img) return;
      const x = data.cell.x + (data.cell.width - IMG_MM) / 2;
      const y = data.cell.y + (data.cell.height - IMG_MM) / 2;
      try {
        doc.addImage(img, 'PNG', x, y, IMG_MM, IMG_MM, undefined, 'FAST');
      } catch {
        try {
          doc.addImage(img, 'JPEG', x, y, IMG_MM, IMG_MM, undefined, 'FAST');
        } catch { /* ignore */ }
      }
    },
  });
  cursorY = (doc as any).lastAutoTable.finalY + 6;

  // 1. Agrupamento por Produto (Hierarquia Parente-Filho)
  for (const it of items) {
    if (cursorY > 240) {
      doc.addPage();
      cursorY = 20;
    }

    const itProfiles = it.rows.filter((r) => r.itemType === 'profile');
    const itGlasses = it.rows.filter((r) => r.itemType === 'glass');
    const itAccessories = it.rows.filter((r) => r.itemType === 'accessory' || r.itemType === 'component');

    if (itProfiles.length === 0 && itGlasses.length === 0 && itAccessories.length === 0) continue;

    // Renderização da Imagem do Produto (se existir)
    const img = productImages[it.osItemId];
    const TITLE_IMG_SIZE = 15;
    if (img) {
      try {
        doc.addImage(img, 'PNG', 14, cursorY, TITLE_IMG_SIZE, TITLE_IMG_SIZE, undefined, 'FAST');
      } catch {
        try {
          doc.addImage(img, 'JPEG', 14, cursorY, TITLE_IMG_SIZE, TITLE_IMG_SIZE, undefined, 'FAST');
        } catch { /* ignore */ }
      }
    }

    // Título do Bloco do Produto
    const textX = img ? 14 + TITLE_IMG_SIZE + 4 : 14;
    const textY = img ? cursorY + (TITLE_IMG_SIZE / 2) + 2 : cursorY + 4;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    const productTitle = `${it.productName} (${it.productQty} un — ${it.width}x${it.height}mm)`;
    doc.text(productTitle, textX, textY);
    
    cursorY = img ? cursorY + TITLE_IMG_SIZE + 6 : cursorY + 10;

    // 2. Consolidação de Tabelas de Perfis
    if (itProfiles.length > 0) {
      autoTable(doc, {
        startY: cursorY,
        head: [['Perfil', 'Lado', 'Comprimento (mm)', 'Peças', 'Ângulo']],
        body: itProfiles.map((p) => [
          p.itemName,
          p.side || '-',
          String(p.calculatedLengthMm || 0),
          String(p.calculatedQty),
          p.cutAngle != null ? `${p.cutAngle}°` : '-',
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
        theme: 'striped',
        margin: { left: 18 },
        tableWidth: pageW - 32,
      });
      cursorY = (doc as any).lastAutoTable.finalY + 4;
    }

    // 3. Otimização da Tabela de Vidros
    if (itGlasses.length > 0) {
      autoTable(doc, {
        startY: cursorY,
        head: [['Vidro / Posição', 'Larg (mm)', 'Alt (mm)', 'Qtd', 'Área Total (m²)']],
        body: itGlasses.map((g) => {
          const area = (g.calculatedWidth / 1000) * (g.calculatedHeight / 1000) * g.calculatedQty;
          return [
            g.itemName,
            String(g.calculatedWidth),
            String(g.calculatedHeight),
            String(g.calculatedQty),
            area.toFixed(3),
          ];
        }),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [80, 80, 80] },
        theme: 'grid',
        margin: { left: 18 },
        tableWidth: pageW - 32,
      });
      cursorY = (doc as any).lastAutoTable.finalY + 6;
    }

    cursorY += 2;
  }

  // 4. Layout de Acessórios & Insumos (Grade de 2 colunas)
  const allAccessories = items.flatMap((it) => it.rows).filter((r) => r.itemType === 'accessory' || r.itemType === 'component');

  if (allAccessories.length > 0) {
    if (cursorY > 230) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Acessórios & Insumos Consolidados', 14, cursorY);
    cursorY += 5;

    const accMap = new Map<string, { name: string; unit: string; total: number }>();
    allAccessories.forEach((a) => {
      const unit = a.unit || 'un';
      const key = `${a.itemName}|${unit}`;
      const entry = accMap.get(key) || { name: a.itemName, unit, total: 0 };
      entry.total += a.calculatedQty;
      accMap.set(key, entry);
    });

    const accData = Array.from(accMap.values()).map(r => [`${r.name}`, `${r.total.toFixed(2)} ${r.unit}`]);
    const half = Math.ceil(accData.length / 2);
    const col1 = accData.slice(0, half);
    const col2 = accData.slice(half);

    const combinedData = [];
    for (let i = 0; i < half; i++) {
      combinedData.push([
        col1[i]?.[0] || '', col1[i]?.[1] || '',
        col2[i]?.[0] || '', col2[i]?.[1] || ''
      ]);
    }

    autoTable(doc, {
      startY: cursorY,
      head: [['Item', 'Qtd', 'Item', 'Qtd']],
      body: combinedData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40] },
      theme: 'grid',
    });
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `OS #${osNum} — Página ${i} de ${total}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' },
    );
  }

  doc.save(`OS-${osNum}.pdf`);
}

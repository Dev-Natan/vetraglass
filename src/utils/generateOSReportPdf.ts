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

  // Resumo do Vão
  const productImages: Record<string, string | null> = {};
  const productImgUrls = new Map<string, string>();
  items.forEach((it) => {
    const url = (it.rows.find((r) => r.imageUrl && r.itemType === 'profile')?.imageUrl) || '';
    // Prefer any image on the product itself; fallback to first row image
    const any = it.rows.find((r) => r.imageUrl)?.imageUrl || url;
    if (any) productImgUrls.set(it.productName, any);
  });
  for (const [k, u] of productImgUrls) {
    productImages[k] = await urlToDataUrl(u);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [['Produto', 'Qtd', 'Larg (mm)', 'Alt (mm)', 'Cor Alu.', 'Vidro']],
    body: items.map((it) => [
      it.productName,
      String(it.productQty),
      String(it.width),
      String(it.height),
      it.aluminumColor || '-',
      [it.glassColor, it.glassThickness ? `${it.glassThickness}mm` : null]
        .filter(Boolean)
        .join(' ') || '-',
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
    theme: 'grid',
  });
  cursorY = (doc as any).lastAutoTable.finalY + 6;

  // Consolidated tables
  const profiles = items.flatMap((i) => i.rows).filter((r) => r.itemType === 'profile');
  const glasses = items.flatMap((i) => i.rows).filter((r) => r.itemType === 'glass');
  const accessories = items
    .flatMap((i) => i.rows)
    .filter((r) => r.itemType === 'accessory' || r.itemType === 'component');

  const section = (title: string) => {
    if (cursorY > 260) {
      doc.addPage();
      cursorY = 16;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, cursorY);
    cursorY += 3;
  };

  // Perfis
  if (profiles.length) {
    section('Perfis de Alumínio');
    // Consolidate by item name
    const map = new Map<string, { name: string; totalMm: number; pieces: number }>();
    profiles.forEach((p) => {
      const key = p.itemName;
      const entry = map.get(key) || { name: key, totalMm: 0, pieces: 0 };
      entry.totalMm += (p.calculatedLengthMm || 0) * p.calculatedQty;
      entry.pieces += p.calculatedQty;
      map.set(key, entry);
    });
    autoTable(doc, {
      startY: cursorY,
      head: [['Perfil', 'Peças', 'Comprimento Total (m)']],
      body: Array.from(map.values()).map((r) => [
        r.name,
        String(r.pieces),
        (r.totalMm / 1000).toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      theme: 'grid',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 4;

    // Detailed cuts
    autoTable(doc, {
      startY: cursorY,
      head: [['Produto', 'Perfil', 'Lado', 'Comprimento (mm)', 'Peças', 'Ângulo']],
      body: profiles.map((p) => [
        p.productName,
        p.itemName,
        p.side || '-',
        String(p.calculatedLengthMm || 0),
        String(p.calculatedQty),
        p.cutAngle != null ? `${p.cutAngle}°` : '-',
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      theme: 'striped',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Vidros
  if (glasses.length) {
    section('Vidros');
    const withArea = glasses.map((g) => ({
      ...g,
      area: (g.calculatedWidth / 1000) * (g.calculatedHeight / 1000) * g.calculatedQty,
    }));
    const totalArea = withArea.reduce((s, r) => s + r.area, 0);
    autoTable(doc, {
      startY: cursorY,
      head: [['Produto', 'Vidro', 'Lado', 'Larg (mm)', 'Alt (mm)', 'Qtd', 'Área (m²)']],
      body: withArea.map((g) => [
        g.productName,
        g.itemName,
        g.side || '-',
        String(g.calculatedWidth),
        String(g.calculatedHeight),
        String(g.calculatedQty),
        g.area.toFixed(3),
      ]),
      foot: [['', '', '', '', '', 'Total:', totalArea.toFixed(3)]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
      theme: 'grid',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Acessórios & Insumos
  if (accessories.length) {
    section('Acessórios & Insumos');
    const map = new Map<string, { name: string; unit: string; total: number }>();
    accessories.forEach((a) => {
      const unit = a.unit || 'un';
      const key = `${a.itemName}|${unit}`;
      const entry = map.get(key) || { name: a.itemName, unit, total: 0 };
      entry.total += a.calculatedQty;
      map.set(key, entry);
    });
    autoTable(doc, {
      startY: cursorY,
      head: [['Item', 'Qtd Total', 'Unidade']],
      body: Array.from(map.values()).map((r) => [
        r.name,
        r.total.toFixed(2),
        r.unit,
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      theme: 'grid',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footer with page numbers
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

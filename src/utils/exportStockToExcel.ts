import ExcelJS from 'exceljs';
import type { StockItem } from '@/hooks/useStockData';

const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

export async function exportStockToExcel(
  items: StockItem[],
  companyName?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vetra';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Estoque');

  // Define columns
  worksheet.columns = [
    { header: 'Nome', key: 'name', width: 35 },
    { header: 'Categoria', key: 'category', width: 15 },
    { header: 'Linha', key: 'linha', width: 20 },
    { header: 'Quantidade', key: 'quantity', width: 12 },
    { header: 'Unidade', key: 'unit', width: 10 },
    { header: 'Qtd. Mínima', key: 'minQuantity', width: 12 },
    { header: 'Localização', key: 'location', width: 20 },
    { header: 'Custo Unitário', key: 'cost', width: 15 },
    { header: 'Preço Venda', key: 'price', width: 15 },
    { header: 'Valor em Estoque', key: 'stockValue', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Fracionado', key: 'fractional', width: 12 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data
  items.forEach((item) => {
    const cost = item.priceInfo?.cost || 0;
    const price = item.priceInfo?.price || 0;
    const stockValue = item.quantity * cost;

    worksheet.addRow({
      name: item.item_template?.name || `Item (${item.item_template_id})`,
      category: itemTypeLabels[item.item_template?.type || ''] || item.item_template?.type || '-',
      linha: item.item_template?.linha || '-',
      quantity: item.quantity,
      unit: item.item_template?.unit || '-',
      minQuantity: item.min_quantity || 0,
      location: item.location || '-',
      cost: cost,
      price: price,
      stockValue: stockValue,
      status: item.is_active !== false ? 'Ativo' : 'Inativo',
      fractional: item.allow_fractional ? 'Sim' : 'Não',
    });
  });

  // Format currency columns
  ['G', 'H', 'I', 'J'].forEach((col) => {
    worksheet.getColumn(col).numFmt = '"R$"#,##0.00';
  });

  // Add conditional formatting for low stock
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const quantity = row.getCell('quantity').value as number;
    const minQuantity = row.getCell('minQuantity').value as number;
    
    if (quantity <= minQuantity && minQuantity > 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' }, // Light red
        };
      });
    }
    
    if (quantity === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' }, // Lighter red
        };
        cell.font = { color: { argb: 'FFDC2626' } };
      });
    }
  });

  // Add summary row
  const totalValue = items.reduce((acc, item) => {
    const cost = item.priceInfo?.cost || 0;
    return acc + (item.quantity * cost);
  }, 0);

  const summaryRow = worksheet.addRow({
    name: 'TOTAL',
    quantity: items.reduce((acc, item) => acc + item.quantity, 0),
    stockValue: totalValue,
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE3F2FD' },
  };

  // Auto filter
  worksheet.autoFilter = {
    from: 'A1',
    to: `L${items.length + 1}`,
  };

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().split('T')[0];
  link.download = `estoque${companyName ? `-${companyName}` : ''}-${date}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

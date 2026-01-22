import jsPDF from 'jspdf';

interface BadgeData {
  employeeName: string;
  role: string;
  specialty?: string | null;
  phone?: string | null;
  companyName: string;
  companyPhone?: string | null;
  companyAddress?: string | null;
  employeeId: string;
}

const roleLabels: Record<string, string> = {
  operador: 'Operador',
  vidraceiro: 'Vidraceiro',
  instalador: 'Instalador',
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  administrativo: 'Administrativo',
};

const specialtyLabels: Record<string, string> = {
  corte: 'Corte de Vidro',
  lapidacao: 'Lapidação',
  temperado: 'Vidro Temperado',
  instalacao: 'Instalação',
  box: 'Box de Banheiro',
  espelho: 'Espelhos',
  esquadrias: 'Esquadrias',
  geral: 'Geral',
};

export function generateEmployeeBadgePdf(data: BadgeData) {
  // Badge size: 85.6mm x 54mm (standard ID card size)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 54],
  });

  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue-500
  const darkColor: [number, number, number] = [15, 23, 42]; // Slate-900
  const mutedColor: [number, number, number] = [100, 116, 139]; // Slate-500
  const lightBg: [number, number, number] = [241, 245, 249]; // Slate-100

  // === FRONT OF BADGE ===
  
  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 85.6, 54, 'F');

  // Top header bar with company name
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 85.6, 12, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const companyName = data.companyName.length > 25 
    ? data.companyName.substring(0, 25) + '...' 
    : data.companyName;
  doc.text(companyName.toUpperCase(), 42.8, 7, { align: 'center' });

  // Photo placeholder area (left side)
  doc.setFillColor(...lightBg);
  doc.roundedRect(5, 16, 22, 26, 2, 2, 'F');
  doc.setDrawColor(...mutedColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(5, 16, 22, 26, 2, 2, 'S');
  
  // Photo icon placeholder
  doc.setTextColor(...mutedColor);
  doc.setFontSize(6);
  doc.text('FOTO', 16, 30, { align: 'center' });
  doc.text('3x4', 16, 34, { align: 'center' });

  // Employee info (right side of photo)
  const infoX = 32;
  
  // Employee name
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const employeeName = data.employeeName.length > 20 
    ? data.employeeName.substring(0, 20) + '...' 
    : data.employeeName;
  doc.text(employeeName, infoX, 20);

  // Role badge
  const roleText = roleLabels[data.role] || data.role;
  doc.setFillColor(...primaryColor);
  doc.roundedRect(infoX, 22, doc.getTextWidth(roleText) * 0.35 + 6, 5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(roleText.toUpperCase(), infoX + 3, 25.5);

  // Specialty (if exists)
  if (data.specialty) {
    const specialtyText = specialtyLabels[data.specialty] || data.specialty;
    doc.setTextColor(...mutedColor);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(specialtyText, infoX, 32);
  }

  // Employee phone (if exists)
  if (data.phone) {
    doc.setTextColor(...darkColor);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tel: ${data.phone}`, infoX, data.specialty ? 37 : 32);
  }

  // Employee ID (bottom right)
  doc.setTextColor(...mutedColor);
  doc.setFontSize(5);
  doc.text(`ID: ${data.employeeId.substring(0, 8).toUpperCase()}`, infoX, 41);

  // Bottom bar with company contact
  doc.setFillColor(...lightBg);
  doc.rect(0, 45, 85.6, 9, 'F');

  doc.setTextColor(...mutedColor);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');

  let bottomY = 49;
  if (data.companyPhone) {
    doc.text(`Tel: ${data.companyPhone}`, 5, bottomY);
  }
  if (data.companyAddress) {
    const address = data.companyAddress.length > 50 
      ? data.companyAddress.substring(0, 50) + '...' 
      : data.companyAddress;
    doc.text(address, 5, bottomY + 3);
  }

  // === BACK OF BADGE (Page 2) ===
  doc.addPage([85.6, 54], 'landscape');

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 85.6, 54, 'F');

  // Top header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 85.6, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTIFICAÇÃO FUNCIONAL', 42.8, 5, { align: 'center' });

  // Terms section
  doc.setTextColor(...darkColor);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMOS DE USO', 5, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...mutedColor);
  
  const terms = [
    '• Este crachá é de uso pessoal e intransferível.',
    '• Deve ser utilizado de forma visível durante',
    '  o expediente de trabalho.',
    '• Em caso de perda ou roubo, comunicar',
    '  imediatamente ao RH/Administração.',
    '• O uso indevido está sujeito às penalidades',
    '  previstas no regulamento interno.',
  ];

  terms.forEach((term, index) => {
    doc.text(term, 5, 19 + index * 4);
  });

  // Signature area
  doc.setDrawColor(...mutedColor);
  doc.setLineWidth(0.2);
  doc.line(5, 48, 40, 48);
  doc.setFontSize(4);
  doc.text('Assinatura do Colaborador', 22.5, 51, { align: 'center' });

  // Validation date area
  doc.line(50, 48, 80, 48);
  doc.text('Data de Validade', 65, 51, { align: 'center' });

  // Company logo placeholder
  doc.setFillColor(...lightBg);
  doc.roundedRect(60, 12, 20, 12, 1, 1, 'F');
  doc.setTextColor(...mutedColor);
  doc.setFontSize(5);
  doc.text('LOGO', 70, 19, { align: 'center' });

  // QR Code placeholder
  doc.setFillColor(...lightBg);
  doc.roundedRect(60, 27, 15, 15, 1, 1, 'F');
  doc.setTextColor(...mutedColor);
  doc.setFontSize(4);
  doc.text('QR CODE', 67.5, 35, { align: 'center' });

  // Save the PDF
  const sanitizedName = data.employeeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  doc.save(`cracha-${sanitizedName}.pdf`);
}

// Generate multiple badges on A4 paper for printing
export function generateBadgesSheetPdf(employees: BadgeData[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [59, 130, 246];
  const darkColor: [number, number, number] = [15, 23, 42];
  const mutedColor: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [241, 245, 249];

  const badgeWidth = 85.6;
  const badgeHeight = 54;
  const marginX = 20;
  const marginY = 15;
  const gapX = 5;
  const gapY = 5;

  const badgesPerRow = 2;
  const badgesPerCol = 4;
  const badgesPerPage = badgesPerRow * badgesPerCol;

  employees.forEach((data, index) => {
    if (index > 0 && index % badgesPerPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % badgesPerPage;
    const col = pageIndex % badgesPerRow;
    const row = Math.floor(pageIndex / badgesPerRow);

    const x = marginX + col * (badgeWidth + gapX);
    const y = marginY + row * (badgeHeight + gapY);

    // Badge border (cut line)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, badgeWidth, badgeHeight);
    doc.setLineDashPattern([], 0);

    // Top header bar with company name
    doc.setFillColor(...primaryColor);
    doc.rect(x, y, badgeWidth, 12, 'F');

    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const companyName = data.companyName.length > 25 
      ? data.companyName.substring(0, 25) + '...' 
      : data.companyName;
    doc.text(companyName.toUpperCase(), x + badgeWidth / 2, y + 7, { align: 'center' });

    // Photo placeholder area
    doc.setFillColor(...lightBg);
    doc.roundedRect(x + 5, y + 16, 22, 26, 2, 2, 'F');
    doc.setDrawColor(...mutedColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + 5, y + 16, 22, 26, 2, 2, 'S');
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(6);
    doc.text('FOTO', x + 16, y + 30, { align: 'center' });
    doc.text('3x4', x + 16, y + 34, { align: 'center' });

    // Employee info
    const infoX = x + 32;
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const employeeName = data.employeeName.length > 18 
      ? data.employeeName.substring(0, 18) + '...' 
      : data.employeeName;
    doc.text(employeeName, infoX, y + 20);

    // Role badge
    const roleText = roleLabels[data.role] || data.role;
    doc.setFillColor(...primaryColor);
    doc.roundedRect(infoX, y + 22, doc.getTextWidth(roleText) * 0.35 + 6, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(roleText.toUpperCase(), infoX + 3, y + 25.5);

    // Specialty
    if (data.specialty) {
      const specialtyText = specialtyLabels[data.specialty] || data.specialty;
      doc.setTextColor(...mutedColor);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(specialtyText, infoX, y + 32);
    }

    // Bottom bar
    doc.setFillColor(...lightBg);
    doc.rect(x, y + 45, badgeWidth, 9, 'F');

    doc.setTextColor(...mutedColor);
    doc.setFontSize(5);
    if (data.companyPhone) {
      doc.text(`Tel: ${data.companyPhone}`, x + 5, y + 49);
    }
  });

  doc.save('crachas-funcionarios.pdf');
}

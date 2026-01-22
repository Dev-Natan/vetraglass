import jsPDF from 'jspdf';

interface CredentialData {
  employeeName: string;
  login: string;
  companyName: string;
  companyToken: string;
}

export function generateCredentialCardPdf(data: CredentialData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [90, 55], // Credit card size approximately
  });

  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const darkColor: [number, number, number] = [30, 41, 59]; // Slate-800
  const mutedColor: [number, number, number] = [100, 116, 139]; // Slate-500

  // Background card with rounded corners effect
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 90, 55, 'F');

  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 90, 14, 'F');

  // Company name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName.toUpperCase(), 45, 8, { align: 'center' });

  // "Credencial de Acesso" subtitle
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('CREDENCIAL DE ACESSO AO SISTEMA', 45, 12, { align: 'center' });

  // Employee name
  doc.setTextColor(...darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(data.employeeName, 45, 22, { align: 'center' });

  // Divider line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  doc.line(10, 25, 80, 25);

  // Login label
  doc.setTextColor(...mutedColor);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('SEU LOGIN:', 45, 30, { align: 'center' });

  // Login value (highlighted)
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.login, 45, 37, { align: 'center' });

  // Instructions
  doc.setTextColor(...mutedColor);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('Use este login + sua senha para acessar o sistema', 45, 43, { align: 'center' });

  // Footer
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(0, 47, 90, 8, 'F');
  doc.setTextColor(...mutedColor);
  doc.setFontSize(5);
  doc.text('Mantenha sua senha em segredo. Não compartilhe com ninguém.', 45, 52, { align: 'center' });

  // Save the PDF
  doc.save(`credencial-${data.login}.pdf`);
}

// Generate a larger instruction sheet with more details
export function generateCredentialSheetPdf(data: CredentialData & { showPassword?: boolean; password?: string }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [59, 130, 246];
  const darkColor: [number, number, number] = [30, 41, 59];
  const mutedColor: [number, number, number] = [100, 116, 139];

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Credenciais de Acesso ao Sistema', pageWidth / 2, 28, { align: 'center' });

  yPos = 55;

  // Employee card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 50, 3, 3, 'F');

  doc.setTextColor(...mutedColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('FUNCIONÁRIO', margin + 10, yPos + 12);

  doc.setTextColor(...darkColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.employeeName, margin + 10, yPos + 25);

  // Login info
  doc.setTextColor(...mutedColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('LOGIN DE ACESSO', margin + 10, yPos + 38);

  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.login, margin + 10, yPos + 48);

  yPos += 65;

  // Password section (if showing initial password)
  if (data.showPassword && data.password) {
    doc.setFillColor(254, 243, 199); // Yellow-100
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 35, 3, 3, 'F');

    doc.setTextColor(146, 64, 14); // Yellow-800
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ SENHA INICIAL (ALTERE NO PRIMEIRO ACESSO)', margin + 10, yPos + 12);

    doc.setFontSize(16);
    doc.text(data.password, margin + 10, yPos + 26);

    yPos += 45;
  }

  // Instructions
  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Como acessar o sistema:', margin, yPos);

  yPos += 12;

  const instructions = [
    '1. Abra o navegador (Chrome, Firefox, Safari)',
    '2. Acesse o endereço do sistema da empresa',
    '3. No campo "Usuário", digite seu login: ' + data.login,
    '4. No campo "Senha", digite sua senha',
    '5. Clique em "Entrar"',
  ];

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  instructions.forEach((instruction, index) => {
    doc.setTextColor(...darkColor);
    doc.text(instruction, margin, yPos + index * 10);
  });

  yPos += instructions.length * 10 + 15;

  // Security tips
  doc.setFillColor(240, 253, 244); // Green-50
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 45, 3, 3, 'F');

  doc.setTextColor(22, 101, 52); // Green-800
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Dicas de Segurança', margin + 10, yPos + 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const tips = [
    '• Nunca compartilhe sua senha com outras pessoas',
    '• Troque sua senha regularmente',
    '• Não anote sua senha em lugares visíveis',
    '• Faça logout ao terminar de usar o sistema',
  ];
  tips.forEach((tip, index) => {
    doc.text(tip, margin + 10, yPos + 22 + index * 6);
  });

  yPos += 55;

  // Support info
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Em caso de problemas, procure o administrador do sistema.', pageWidth / 2, yPos, { align: 'center' });

  // Footer
  doc.setFontSize(8);
  doc.text(`Token da empresa: ${data.companyToken}`, pageWidth / 2, 285, { align: 'center' });

  // Save
  doc.save(`credenciais-${data.login}.pdf`);
}

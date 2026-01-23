import jsPDF from 'jspdf';

// Helper function to convert image URL to base64
export async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}
interface BadgeData {
  employeeName: string;
  role: string;
  specialty?: string | null;
  phone?: string | null;
  companyName: string;
  companyPhone?: string | null;
  companyAddress?: string | null;
  employeeId: string;
  photoUrl?: string | null;
  photoBase64?: string | null;
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
  // Badge size: 54mm x 85.6mm (vertical ID card)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 85.6],
  });

  const width = 54;
  const height = 85.6;

  const primaryBlue: [number, number, number] = [0, 82, 165]; // Dark blue
  const lightBlue: [number, number, number] = [0, 174, 239]; // Light blue/cyan
  const darkText: [number, number, number] = [30, 41, 59];
  const white: [number, number, number] = [255, 255, 255];
  const lightGray: [number, number, number] = [220, 220, 220];

  // === FRONT OF BADGE ===

  // Light blue gradient background (simulated with rectangles)
  doc.setFillColor(240, 249, 255); // Very light blue
  doc.rect(0, 0, width, height, 'F');

  // Subtle gradient effect
  doc.setFillColor(224, 242, 254);
  doc.rect(0, height * 0.3, width, height * 0.4, 'F');

  // Hole punch at top
  doc.setFillColor(...white);
  doc.ellipse(width / 2, 5, 4, 2, 'F');
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.ellipse(width / 2, 5, 4, 2, 'S');

  // Company logo area
  doc.setFillColor(...white);
  doc.roundedRect(7, 10, 40, 18, 2, 2, 'F');
  doc.setDrawColor(...lightBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(7, 10, 40, 18, 2, 2, 'S');

  // Company name as "logo"
  doc.setTextColor(...primaryBlue);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const companyLines = doc.splitTextToSize(data.companyName.toUpperCase(), 36);
  doc.text(companyLines, width / 2, 18, { align: 'center' });

  // Photo area - large and centered
  const photoX = 10;
  const photoY = 32;
  const photoW = 34;
  const photoH = 28;

  // Try to add the actual photo
  if (data.photoBase64) {
    try {
      doc.addImage(data.photoBase64, 'JPEG', photoX, photoY, photoW, photoH);
      // Add border around photo
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S');
    } catch (error) {
      console.error('Error adding photo to badge:', error);
      // Fallback to placeholder
      drawPhotoPlaceholder();
    }
  } else {
    drawPhotoPlaceholder();
  }

  function drawPhotoPlaceholder() {
    doc.setFillColor(...lightGray);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S');

    // Photo placeholder text
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Foto do', width / 2, photoY + 11, { align: 'center' });
    doc.text('Colaborador', width / 2, photoY + 16, { align: 'center' });
  }

  // Curved bottom section with employee info
  // Draw wave/curve shape
  doc.setFillColor(...primaryBlue);
  
  // Create curved top using bezier approximation with rectangles
  const curveStartY = 63;
  
  // Draw the curved wave
  doc.setFillColor(...primaryBlue);
  // Main dark blue section
  doc.rect(0, 68, width, height - 68, 'F');
  
  // Light blue accent bar
  doc.setFillColor(...lightBlue);
  doc.rect(0, curveStartY, width, 7, 'F');
  
  // Create wave effect with small overlapping shapes
  doc.setFillColor(...primaryBlue);
  // Simple curved top effect
  for (let i = 0; i < width; i += 1) {
    const waveY = curveStartY + 3 + Math.sin((i / width) * Math.PI) * 3;
    doc.rect(i, waveY, 1.5, height - waveY, 'F');
  }

  // Employee name
  doc.setTextColor(...white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const employeeName = data.employeeName.length > 20 
    ? data.employeeName.substring(0, 20) + '...' 
    : data.employeeName;
  doc.text(employeeName, width / 2, 75, { align: 'center' });

  // Role
  const roleText = roleLabels[data.role] || data.role;
  const specialtyText = data.specialty ? specialtyLabels[data.specialty] || data.specialty : null;
  const fullRole = specialtyText ? `${roleText} - ${specialtyText}` : roleText;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const roleDisplay = fullRole.length > 25 ? fullRole.substring(0, 25) + '...' : fullRole;
  doc.text(roleDisplay, width / 2, 80, { align: 'center' });

  // === BACK OF BADGE (Page 2) ===
  doc.addPage([54, 85.6], 'portrait');

  // Background
  doc.setFillColor(240, 249, 255);
  doc.rect(0, 0, width, height, 'F');

  // Hole punch at top
  doc.setFillColor(...white);
  doc.ellipse(width / 2, 5, 4, 2, 'F');
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.ellipse(width / 2, 5, 4, 2, 'S');

  // Header
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 10, width, 10, 'F');
  
  doc.setTextColor(...white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTIFICAÇÃO FUNCIONAL', width / 2, 16, { align: 'center' });

  // Company info section
  doc.setFillColor(...white);
  doc.roundedRect(5, 24, width - 10, 25, 2, 2, 'F');

  doc.setTextColor(...darkText);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, width / 2, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  if (data.companyPhone) {
    doc.text(`Tel: ${data.companyPhone}`, width / 2, 36, { align: 'center' });
  }
  if (data.companyAddress) {
    const addressLines = doc.splitTextToSize(data.companyAddress, 40);
    doc.text(addressLines, width / 2, 41, { align: 'center' });
  }

  // Instructions section
  doc.setTextColor(...darkText);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUÇÕES:', 5, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  const instructions = [
    '• Crachá de uso pessoal e intransferível',
    '• Usar de forma visível no expediente',
    '• Comunicar perda ao RH imediatamente',
  ];
  instructions.forEach((text, i) => {
    doc.text(text, 5, 60 + i * 4);
  });

  // Signature line
  doc.setDrawColor(...darkText);
  doc.setLineWidth(0.2);
  doc.line(8, 78, width - 8, 78);
  doc.setFontSize(4);
  doc.text('Assinatura', width / 2, 82, { align: 'center' });

  // Employee ID
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(3.5);
  doc.text(`ID: ${data.employeeId.substring(0, 8).toUpperCase()}`, width / 2, 85, { align: 'center' });

  // Save the PDF
  const sanitizedName = data.employeeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  doc.save(`cracha-${sanitizedName}.pdf`);
}

// Generate multiple badges on A4 paper for printing (2x4 grid)
export function generateBadgesSheetPdf(employees: BadgeData[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryBlue: [number, number, number] = [0, 82, 165];
  const lightBlue: [number, number, number] = [0, 174, 239];
  const white: [number, number, number] = [255, 255, 255];
  const lightGray: [number, number, number] = [220, 220, 220];

  const badgeWidth = 54;
  const badgeHeight = 85.6;
  const marginX = 20;
  const marginY = 10;
  const gapX = 8;
  const gapY = 5;

  const badgesPerRow = 3;
  const badgesPerCol = 3;
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

    // Cut line border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, badgeWidth, badgeHeight);
    doc.setLineDashPattern([], 0);

    // Background
    doc.setFillColor(240, 249, 255);
    doc.rect(x, y, badgeWidth, badgeHeight, 'F');

    // Hole punch
    doc.setFillColor(...white);
    doc.ellipse(x + badgeWidth / 2, y + 5, 4, 2, 'F');

    // Company logo area
    doc.setFillColor(...white);
    doc.roundedRect(x + 7, y + 10, 40, 18, 2, 2, 'F');
    doc.setTextColor(...primaryBlue);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const companyName = data.companyName.length > 15 ? data.companyName.substring(0, 15) + '...' : data.companyName;
    doc.text(companyName.toUpperCase(), x + badgeWidth / 2, y + 20, { align: 'center' });

    // Photo area
    if (data.photoBase64) {
      try {
        doc.addImage(data.photoBase64, 'JPEG', x + 10, y + 32, 34, 28);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.roundedRect(x + 10, y + 32, 34, 28, 2, 2, 'S');
      } catch (error) {
        // Fallback to placeholder
        doc.setFillColor(...lightGray);
        doc.roundedRect(x + 10, y + 32, 34, 28, 2, 2, 'F');
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(6);
        doc.text('Foto', x + badgeWidth / 2, y + 47, { align: 'center' });
      }
    } else {
      doc.setFillColor(...lightGray);
      doc.roundedRect(x + 10, y + 32, 34, 28, 2, 2, 'F');
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(6);
      doc.text('Foto', x + badgeWidth / 2, y + 47, { align: 'center' });
    }

    // Bottom section
    doc.setFillColor(...lightBlue);
    doc.rect(x, y + 63, badgeWidth, 7, 'F');
    
    doc.setFillColor(...primaryBlue);
    doc.rect(x, y + 68, badgeWidth, badgeHeight - 68, 'F');

    // Employee name
    doc.setTextColor(...white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const empName = data.employeeName.length > 18 ? data.employeeName.substring(0, 18) + '...' : data.employeeName;
    doc.text(empName, x + badgeWidth / 2, y + 76, { align: 'center' });

    // Role
    const roleText = roleLabels[data.role] || data.role;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(roleText, x + badgeWidth / 2, y + 81, { align: 'center' });
  });

  doc.save('crachas-funcionarios.pdf');
}

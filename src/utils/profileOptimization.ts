// Profile Optimization Utility - Calculates optimal bar usage

export interface CutPiece {
  itemTemplateId: string;
  itemName: string;
  cutLength: number;
  quantity: number;
  barLengthMm: number;
  unit: string;
}

export interface OptimizedMaterial {
  itemTemplateId: string;
  itemName: string;
  cuts: Array<{ length: number; qty: number }>;
  totalLengthMm: number;
  barLengthMm: number;
  barsNeeded: number;
  wasteMm: number;
  wastePercent: number;
  unit: string;
}

export interface MaterialSummary {
  profiles: OptimizedMaterial[];
  totalProfileBars: number;
  totalProfileWasteMm: number;
  avgWastePercent: number;
}

/**
 * Groups cuts by profile and calculates optimal bar usage
 */
export function optimizeProfiles(cuts: CutPiece[]): MaterialSummary {
  // Group cuts by item template
  const grouped = cuts.reduce((acc, cut) => {
    const key = cut.itemTemplateId;
    if (!acc[key]) {
      acc[key] = {
        itemTemplateId: cut.itemTemplateId,
        itemName: cut.itemName,
        cuts: [],
        barLengthMm: cut.barLengthMm || 6000,
        unit: cut.unit || 'mm',
      };
    }
    
    // Add or merge cut
    const existingCut = acc[key].cuts.find(c => c.length === cut.cutLength);
    if (existingCut) {
      existingCut.qty += cut.quantity;
    } else {
      acc[key].cuts.push({ length: cut.cutLength, qty: cut.quantity });
    }
    
    return acc;
  }, {} as Record<string, { itemTemplateId: string; itemName: string; cuts: Array<{ length: number; qty: number }>; barLengthMm: number; unit: string }>);

  const profiles: OptimizedMaterial[] = Object.values(grouped).map(profile => {
    const sortedCuts = profile.cuts.sort((a, b) => b.length - a.length);

    // Total linear length needed (informational)
    const totalLengthMm = sortedCuts.reduce(
      (sum, cut) => sum + (cut.length * cut.qty),
      0
    );

    // Use FFD packing to compute the ACTUAL bars needed (respecting kerf)
    const distribution = distributeAcrossBars(sortedCuts, profile.barLengthMm);
    const barsNeeded = Math.max(1, distribution.length);

    const totalBarLengthMm = barsNeeded * profile.barLengthMm;
    const wasteMm = Math.max(0, totalBarLengthMm - totalLengthMm);
    const wastePercent = totalBarLengthMm > 0
      ? Math.round((wasteMm / totalBarLengthMm) * 1000) / 10
      : 0;

    return {
      itemTemplateId: profile.itemTemplateId,
      itemName: profile.itemName,
      cuts: sortedCuts,
      totalLengthMm,
      barLengthMm: profile.barLengthMm,
      barsNeeded,
      wasteMm,
      wastePercent,
      unit: profile.unit,
    };
  });


  // Calculate totals
  const totalProfileBars = profiles.reduce((sum, p) => sum + p.barsNeeded, 0);
  const totalProfileWasteMm = profiles.reduce((sum, p) => sum + p.wasteMm, 0);
  const totalBarLength = profiles.reduce((sum, p) => sum + (p.barsNeeded * p.barLengthMm), 0);
  const avgWastePercent = totalBarLength > 0 
    ? Math.round((totalProfileWasteMm / totalBarLength) * 1000) / 10 
    : 0;

  return {
    profiles: profiles.sort((a, b) => a.itemName.localeCompare(b.itemName)),
    totalProfileBars,
    totalProfileWasteMm,
    avgWastePercent,
  };
}

/**
 * Simple First Fit Decreasing bin packing for bar distribution
 * Returns how cuts should be distributed across bars
 */
export function distributeAcrossBars(
  cuts: Array<{ length: number; qty: number }>,
  barLength: number
): Array<{ barIndex: number; cuts: Array<{ length: number; qty: number }>; usedLength: number; remainingLength: number }> {
  // Expand cuts into individual pieces and sort by length (descending)
  const pieces: number[] = [];
  cuts.forEach(cut => {
    for (let i = 0; i < cut.qty; i++) {
      pieces.push(cut.length);
    }
  });
  pieces.sort((a, b) => b - a);

  // First Fit Decreasing algorithm
  const bars: Array<{ cuts: number[]; usedLength: number }> = [];

  pieces.forEach(pieceLength => {
    // Find first bar that can fit this piece
    let placed = false;
    for (const bar of bars) {
      if (bar.usedLength + pieceLength <= barLength) {
        bar.cuts.push(pieceLength);
        bar.usedLength += pieceLength;
        placed = true;
        break;
      }
    }
    
    // If no bar can fit, create a new one
    if (!placed) {
      bars.push({
        cuts: [pieceLength],
        usedLength: pieceLength,
      });
    }
  });

  // Group identical cuts per bar
  return bars.map((bar, index) => {
    const cutGroups: Record<number, number> = {};
    bar.cuts.forEach(length => {
      cutGroups[length] = (cutGroups[length] || 0) + 1;
    });

    return {
      barIndex: index + 1,
      cuts: Object.entries(cutGroups).map(([length, qty]) => ({
        length: parseInt(length),
        qty,
      })).sort((a, b) => b.length - a.length),
      usedLength: bar.usedLength,
      remainingLength: barLength - bar.usedLength,
    };
  });
}

/**
 * Format millimeters to a readable string
 */
export function formatMm(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)}m`;
  }
  return `${mm}mm`;
}

/**
 * Format area in square meters
 */
export function formatM2(m2: number): string {
  return `${m2.toFixed(2)} m²`;
}

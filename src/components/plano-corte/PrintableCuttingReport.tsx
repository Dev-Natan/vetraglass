import { useMemo } from 'react';
import { distributeAcrossBars, optimizeProfiles, type CutPiece } from '@/utils/profileOptimization';
import { resolveItemImageUrl } from '@/utils/imageUrl';
import vetraMark from '@/assets/vetra-mark.png.asset.json';

export interface PrintableProfileCut {
  profileName: string;
  calculatedLength: number;
  quantity: number;
  cutAngle: number;
  cutAngleStart?: number;
  cutAngleEnd?: number;
  position: string;
  itemTemplateId?: string;
  imageUrl?: string | null;
}

export interface PrintableProductSummary {
  productName: string;
  width: number;
  height: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface PrintableGlassCut {
  glassName: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface PrintableAccessoryItem {
  itemName: string;
  type: string;
  quantity: number;
  unit?: string;
  imageUrl?: string | null;
}

interface PrintableCuttingReportProps {
  companyName: string;
  companyLogoUrl?: string | null;
  companyTagline?: string;
  documentTitle?: string;
  documentSubtitle?: string;
  /** Optional header info block */
  quoteOrOsNumber?: string | null;
  clientName?: string | null;
  productHeadline?: string | null;
  responsibleName?: string | null;
  qrDataUrl?: string | null;
  products: PrintableProductSummary[];
  profileCuts: PrintableProfileCut[];
  glassCuts?: PrintableGlassCut[];
  accessories?: PrintableAccessoryItem[];
  /** Bar length in mm; defaults to 6000 */
  barLengthMm?: number;
}

/* -------------------- Color tokens (fixed for print) -------------------- */
const BLUE = '#1d4ed8';
const BLUE_SOFT = '#2563eb';
const BLUE_TINT = '#eff6ff';
const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const HEAD_BG = '#f8fafc';

const Thumb = ({ src, alt, size = 34 }: { src?: string | null; alt: string; size?: number }) => {
  const resolved = resolveItemImageUrl(src ?? null);
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 4,
    display: 'block',
    margin: '0 auto',
    objectFit: 'contain',
    background: '#fff',
    border: `1px solid ${BORDER}`,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };
  if (!resolved) return <div style={{ ...box, background: '#f1f5f9' }} aria-hidden />;
  return <img src={resolved} alt={alt} style={box} crossOrigin="anonymous" />;
};

const fmtAngle = (a?: number) => {
  if (a == null) return '—';
  if (a === 4545) return '45° / 45°';
  if (a === 4590) return '45° / 90°';
  if (a === 9045) return '90° / 45°';
  if (a === 9090) return '90° / 90°';
  return `${a}°`;
};

/* -------------------- Tiny inline SVG icons -------------------- */
const IconSquare = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: 4,
      background: BLUE_TINT,
      color: BLUE,
      marginRight: 8,
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}
  >
    {children}
  </span>
);
const svgProps = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IcoFrame = () => <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18M12 3v18" /></svg>;
const IcoGlass = () => <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 3l18 18" /></svg>;
const IcoProfile = () => <svg {...svgProps}><path d="M4 4h16v4H8v12H4z" /></svg>;
const IcoBars = () => <svg {...svgProps}><path d="M4 4v16M9 4v16M14 4v16M19 4v16" /></svg>;
const IcoBag = () => <svg {...svgProps}><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>;
const IcoCalendar = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
const IcoInfo = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>;
const IcoTotal = () => <svg {...svgProps}><path d="M4 4v16M9 4v16M14 4v16M19 4v16" /></svg>;
const IcoRecycle = () => <svg {...svgProps}><path d="M7 7l3-4 3 4" /><path d="M17 17l-3 4-3-4" /><path d="M3 12a9 9 0 0 1 18 0" /></svg>;
const IcoPie = () => <svg {...svgProps}><path d="M12 3a9 9 0 1 0 9 9h-9z" /></svg>;
const IcoArrowLR = () => <svg {...svgProps} width="18" height="12"><path d="M3 6h14M6 3L3 6l3 3M14 3l3 3-3 3" /></svg>;
const IcoArrowUD = () => <svg {...svgProps} width="12" height="18"><path d="M6 3v14M3 6l3-3 3 3M3 14l3 3 3-3" /></svg>;

/* Angle marker (like a corner) */
const AngleGlyph = ({ label = '90°' }: { label?: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: INK }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6">
      <path d="M4 4v16h16" />
    </svg>
    <span style={{ fontSize: '9pt' }}>{label}</span>
  </span>
);

const PositionGlyph = ({ position }: { position: string }) => {
  const isHeight = /altura|height/i.test(position);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: BLUE, fontWeight: 600 }}>
      <span style={{ color: BLUE }}>{isHeight ? <IcoArrowUD /> : <IcoArrowLR />}</span>
      <span style={{ color: INK, fontWeight: 500, fontSize: '9pt' }}>{position}</span>
    </span>
  );
};

/**
 * Print-only production report — Vetra template v2.
 */
export function PrintableCuttingReport({
  companyName,
  companyLogoUrl,
  companyTagline,
  documentTitle = 'PLANO DE CORTE E PRODUÇÃO',
  documentSubtitle,
  quoteOrOsNumber,
  clientName,
  productHeadline,
  responsibleName,
  qrDataUrl,
  products,
  profileCuts,
  glassCuts = [],
  accessories = [],
  barLengthMm = 6000,
}: PrintableCuttingReportProps) {
  const now = useMemo(() => new Date(), []);

  const barCuts: CutPiece[] = useMemo(
    () =>
      profileCuts
        .filter((c) => c.calculatedLength > 0 && c.quantity > 0)
        .map((c) => ({
          itemTemplateId: c.itemTemplateId || c.profileName,
          itemName: c.profileName,
          cutLength: Math.round(c.calculatedLength),
          quantity: c.quantity,
          barLengthMm,
          unit: 'mm',
        })),
    [profileCuts, barLengthMm]
  );

  const optimization = useMemo(() => optimizeProfiles(barCuts), [barCuts]);

  // Flatten optimization to rows (one row per bar) for the map table
  const barRows = useMemo(() => {
    const rows: Array<{
      profileName: string;
      barIndex: number;
      barLengthMm: number;
      usedLength: number;
      remainingLength: number;
      cuts: Array<{ length: number; qty: number }>;
    }> = [];
    optimization.profiles.forEach((profile) => {
      const dist = distributeAcrossBars(profile.cuts, profile.barLengthMm);
      dist.forEach((bar) => {
        rows.push({
          profileName: profile.itemName,
          barIndex: bar.barIndex,
          barLengthMm: profile.barLengthMm,
          usedLength: bar.usedLength,
          remainingLength: bar.remainingLength,
          cuts: bar.cuts,
        });
      });
    });
    return rows;
  }, [optimization]);

  // Split accessories into two columns for the layout at the bottom
  const accCols = useMemo(() => {
    const half = Math.ceil(accessories.length / 2);
    return [accessories.slice(0, half), accessories.slice(half)];
  }, [accessories]);

  const logoSrc = resolveItemImageUrl(companyLogoUrl ?? null) || vetraMark.url;

  return (
    <div className="printable-report" style={styles.root}>
      {/* ===================== Header ===================== */}
      <header style={styles.header}>
        {/* Left: logo + company */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <img
            src={logoSrc}
            alt={companyName}
            crossOrigin="anonymous"
            style={{ width: 46, height: 46, objectFit: 'contain', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={styles.companyName}>{companyName}</div>
            {companyTagline && <div style={styles.companyTagline}>{companyTagline}</div>}
          </div>
        </div>

        {/* Center: title */}
        <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
          <div style={styles.docTitle}>{documentTitle}</div>
          <div style={styles.docMeta}>
            <span style={{ color: BLUE, marginRight: 4, verticalAlign: '-2px' }}><IcoCalendar /></span>
            Gerado em {now.toLocaleDateString('pt-BR')} às{' '}
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {documentSubtitle && <div style={styles.docMeta}>{documentSubtitle}</div>}
        </div>

        {/* Right: info grid + QR */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <table style={styles.infoTable}>
            <tbody>
              {quoteOrOsNumber && (
                <tr>
                  <td style={styles.infoLabel}>ORÇAMENTO/OS:</td>
                  <td style={styles.infoValue}>{quoteOrOsNumber}</td>
                </tr>
              )}
              {clientName && (
                <tr>
                  <td style={styles.infoLabel}>CLIENTE:</td>
                  <td style={styles.infoValue}>{clientName}</td>
                </tr>
              )}
              {productHeadline && (
                <tr>
                  <td style={styles.infoLabel}>PRODUTO:</td>
                  <td style={styles.infoValue}>{productHeadline}</td>
                </tr>
              )}
              {responsibleName && (
                <tr>
                  <td style={styles.infoLabel}>RESPONSÁVEL:</td>
                  <td style={styles.infoValue}>{responsibleName}</td>
                </tr>
              )}
            </tbody>
          </table>

          {qrDataUrl && (
            <div style={{ textAlign: 'center' }}>
              <img
                src={qrDataUrl}
                alt="QR"
                style={{ width: 54, height: 54, border: `1px solid ${BORDER}`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              />
              <div style={{ fontSize: '7pt', color: MUTED, marginTop: 2 }}>
                Escanear para<br />ver no Vetra
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===================== Resumo do Vão ===================== */}
      {products.length > 0 && (
        <section style={{ ...styles.section, pageBreakInside: 'avoid' }}>
          <h2 style={styles.sectionTitle}>
            <IconSquare><IcoFrame /></IconSquare>
            RESUMO DO VÃO
          </h2>
          <table style={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>IMAGEM</th>
                <th style={styles.th}>PRODUTO</th>
                <th style={{ ...styles.th, ...styles.numCell }}>LARGURA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>ALTURA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>PEÇAS</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  <td style={{ ...styles.td, ...styles.thumbCell }}>
                    <Thumb src={p.imageUrl} alt={p.productName} size={42} />
                  </td>
                  <td style={styles.td}>{p.productName || '—'}</td>
                  <td style={{ ...styles.td, ...styles.numCell, ...styles.bigNum }}>{p.width}</td>
                  <td style={{ ...styles.td, ...styles.numCell, ...styles.bigNum }}>{p.height}</td>
                  <td style={{ ...styles.td, ...styles.numCell, ...styles.bigNum }}>{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ===================== Cortes de Vidro ===================== */}
      {glassCuts.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <IconSquare><IcoGlass /></IconSquare>
            CORTES DE VIDRO
          </h2>
          <table style={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>IMG</th>
                <th style={styles.th}>VIDRO</th>
                <th style={{ ...styles.th, ...styles.numCell }}>LARGURA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>ALTURA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>ÁREA (M²)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>QTD.</th>
              </tr>
            </thead>
            <tbody>
              {glassCuts.map((g, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                  <td style={{ ...styles.td, ...styles.thumbCell }}>
                    <Thumb src={g.imageUrl} alt={g.glassName} />
                  </td>
                  <td style={{ ...styles.td, textTransform: 'uppercase', fontWeight: 500 }}>{g.glassName}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.width}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.height}</td>
                  <td style={{ ...styles.td, ...styles.numCell }}>{g.areaM2.toFixed(3)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.hint}>
            <span style={{ color: BLUE, verticalAlign: '-2px', marginRight: 4 }}><IcoInfo /></span>
            Medidas de vidro já descontadas folgas técnicas de montagem.
          </div>
        </section>
      )}

      {/* ===================== Cortes de Perfil ===================== */}
      {profileCuts.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <IconSquare><IcoProfile /></IconSquare>
            CORTES DE PERFIL
          </h2>
          <table style={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>IMG</th>
                <th style={styles.th}>PERFIL</th>
                <th style={{ ...styles.th, ...styles.numCell }}>MEDIDA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>QTD.</th>
                <th style={styles.th}>ÂNGULO DE CORTE</th>
                <th style={styles.th}>POSIÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {profileCuts.map((c, idx) => {
                const angleStart = c.cutAngleStart ?? c.cutAngle;
                const angleEnd = c.cutAngleEnd ?? c.cutAngle;
                const compound =
                  c.cutAngleStart != null && c.cutAngleEnd != null && c.cutAngleStart !== c.cutAngleEnd;
                const angleLabel = compound ? `${angleStart}° / ${angleEnd}°` : fmtAngle(c.cutAngle);
                return (
                  <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ ...styles.td, ...styles.thumbCell }}>
                      <Thumb src={c.imageUrl} alt={c.profileName} />
                    </td>
                    <td style={{ ...styles.td, textTransform: 'uppercase', fontWeight: 500 }}>{c.profileName}</td>
                    <td style={{ ...styles.td, ...styles.numCell, fontWeight: 800, fontSize: '12pt', color: BLUE }}>{c.calculatedLength}</td>
                    <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{c.quantity}</td>
                    <td style={styles.td}><AngleGlyph label={angleLabel} /></td>
                    <td style={styles.td}><PositionGlyph position={c.position} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ===================== Mapa de Otimização ===================== */}
      {barRows.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <IconSquare><IcoBars /></IconSquare>
            MAPA DE OTIMIZAÇÃO DE BARRAS ({barLengthMm / 1000}M)
          </h2>
          <table style={styles.dataTable}>
            <thead>
              <tr>
                <th style={styles.th}>PERFIL</th>
                <th style={{ ...styles.th, ...styles.numCell, width: 60 }}>BARRA</th>
                <th style={{ ...styles.th, width: '38%' }}>CORTE (MM)</th>
                <th style={{ ...styles.th, width: '30%' }}>SOBRA (MM)</th>
                <th style={{ ...styles.th, ...styles.numCell, width: 110 }}>APROVEITAMENTO</th>
                <th style={{ ...styles.th, ...styles.numCell, width: 80 }}>RETALHO</th>
              </tr>
            </thead>
            <tbody>
              {barRows.map((row, i) => {
                const usedPct = (row.usedLength / row.barLengthMm) * 100;
                const wastePct = 100 - usedPct;
                const totalCutLen = row.cuts.reduce((s, c) => s + c.length * c.qty, 0);
                const cutWidthPct = Math.max(6, (totalCutLen / row.barLengthMm) * 100);
                const wasteWidthPct = Math.max(6, (row.remainingLength / row.barLengthMm) * 100);
                const cutLabel = row.cuts
                  .map((c) => (c.qty > 1 ? `${c.qty}× ${c.length}` : `${c.length}`))
                  .join(' + ');
                return (
                  <tr key={i} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ ...styles.td, textTransform: 'uppercase', fontWeight: 500 }}>{row.profileName}</td>
                    <td style={{ ...styles.td, ...styles.numCell }}>{row.barIndex}</td>
                    <td style={{ ...styles.td, padding: '4px 8px' }}>
                      <div style={styles.pillTrack}>
                        <div style={{ ...styles.pillCut, width: `${cutWidthPct}%` }}>{cutLabel}</div>
                      </div>
                    </td>
                    <td style={{ ...styles.td, padding: '4px 8px' }}>
                      {row.remainingLength > 0 ? (
                        <div style={styles.pillTrack}>
                          <div style={{ ...styles.pillWaste, width: `${wasteWidthPct}%` }}>{row.remainingLength}</div>
                        </div>
                      ) : (
                        <span style={{ color: MUTED, fontSize: '8.5pt' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, ...styles.numCell, color: BLUE, fontWeight: 700 }}>
                      {usedPct.toFixed(1)}%
                    </td>
                    <td style={{ ...styles.td, ...styles.numCell }}>{wastePct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary strip */}
          <div style={styles.summaryStrip}>
            <div style={styles.summaryCell}>
              <span style={styles.summaryIcon}><IcoTotal /></span>
              <div>
                <div style={styles.summaryLabel}>TOTAL DE BARRAS</div>
                <div style={styles.summaryValue}>{optimization.totalProfileBars}</div>
              </div>
            </div>
            <div style={styles.summaryCell}>
              <span style={styles.summaryIcon}><IcoRecycle /></span>
              <div>
                <div style={styles.summaryLabel}>DESPERDÍCIO TOTAL</div>
                <div style={styles.summaryValue}>{optimization.totalProfileWasteMm.toLocaleString('pt-BR')} mm</div>
              </div>
            </div>
            <div style={styles.summaryCell}>
              <span style={styles.summaryIcon}><IcoPie /></span>
              <div>
                <div style={styles.summaryLabel}>APROVEITAMENTO MÉDIO</div>
                <div style={styles.summaryValue}>{(100 - optimization.avgWastePercent).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================== Acessórios & Insumos ===================== */}
      {accessories.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <IconSquare><IcoBag /></IconSquare>
            ACESSÓRIOS &amp; INSUMOS
          </h2>
          <div style={{ display: 'flex', gap: 12 }}>
            {accCols.map((col, ci) => (
              <table key={ci} style={{ ...styles.dataTable, flex: 1 }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thumbCell }}>IMG</th>
                    <th style={styles.th}>ITEM</th>
                    <th style={styles.th}>TIPO</th>
                    <th style={{ ...styles.th, ...styles.numCell }}>QTD.</th>
                    <th style={styles.th}>UN.</th>
                  </tr>
                </thead>
                <tbody>
                  {col.map((a, idx) => (
                    <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ ...styles.td, ...styles.thumbCell }}>
                        <Thumb src={a.imageUrl} alt={a.itemName} size={28} />
                      </td>
                      <td style={{ ...styles.td, textTransform: 'uppercase', fontSize: '8.5pt' }}>{a.itemName}</td>
                      <td style={{ ...styles.td, fontSize: '8.5pt' }}>{a.type}</td>
                      <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{a.quantity}</td>
                      <td style={{ ...styles.td, fontSize: '8.5pt' }}>{a.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      )}

      <footer style={styles.footer}>
        <span style={{ color: BLUE, verticalAlign: '-2px', marginRight: 4 }}><IcoInfo /></span>
        Documento gerado automaticamente pelo Vetra. Sujeito à conferência dos responsáveis.
      </footer>
    </div>
  );
}

/* ================================================================== */
/* Inline styles                                                      */
/* ================================================================== */
const styles: Record<string, React.CSSProperties> = {
  root: {
    color: INK,
    background: '#fff',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '9.5pt',
    lineHeight: 1.35,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `2px solid ${BORDER}`,
    paddingBottom: 10,
    marginBottom: 12,
    gap: 12,
  },
  companyName: {
    fontSize: '15pt',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: INK,
    lineHeight: 1.05,
  },
  companyTagline: {
    fontSize: '7.5pt',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  docTitle: {
    fontSize: '15pt',
    fontWeight: 800,
    color: INK,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  docMeta: { fontSize: '8.5pt', color: MUTED, marginTop: 3 },

  infoTable: {
    borderCollapse: 'collapse',
    fontSize: '8.5pt',
  },
  infoLabel: {
    padding: '1px 6px 1px 0',
    fontWeight: 700,
    color: INK,
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  infoValue: {
    padding: '1px 0',
    color: BLUE_SOFT,
    fontWeight: 500,
  },

  section: { marginTop: 14, pageBreakInside: 'auto' },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11pt',
    fontWeight: 800,
    color: BLUE,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: `1px solid ${BORDER}`,
  },

  dataTable: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    overflow: 'hidden',
  },
  th: {
    background: HEAD_BG,
    borderBottom: `1px solid ${BORDER}`,
    padding: '6px 8px',
    textAlign: 'left',
    fontSize: '8pt',
    fontWeight: 700,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  td: {
    borderBottom: `1px solid ${BORDER}`,
    padding: '6px 8px',
    fontSize: '9.5pt',
    color: INK,
    verticalAlign: 'middle',
  },
  numCell: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  bigNum: { fontSize: '13pt', fontWeight: 700 },
  thumbCell: { width: 54, textAlign: 'center', padding: '4px' },

  hint: {
    fontSize: '8pt',
    color: MUTED,
    marginTop: 4,
    fontStyle: 'italic',
  },

  /* Bar map */
  barTrack: {
    display: 'flex',
    height: 18,
    borderRadius: 3,
    overflow: 'hidden',
    background: '#f1f5f9',
    border: `1px solid ${BORDER}`,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  barPieceCut: {
    height: '100%',
    background: BLUE_SOFT,
    color: '#fff',
    fontSize: '8pt',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRight: '1px solid #fff',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  barPieceWaste: {
    height: '100%',
    background: '#e2e8f0',
    color: MUTED,
    fontSize: '8pt',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },

  /* Summary strip */
  summaryStrip: {
    marginTop: 8,
    display: 'flex',
    gap: 8,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    padding: 8,
    background: HEAD_BG,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  summaryCell: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '2px 8px',
    borderRight: `1px dashed ${BORDER}`,
  },
  summaryIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 4,
    background: BLUE_TINT,
    color: BLUE,
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  summaryLabel: {
    fontSize: '7.5pt',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: '11pt',
    fontWeight: 800,
    color: INK,
  },

  footer: {
    marginTop: 18,
    paddingTop: 8,
    borderTop: `1px solid ${BORDER}`,
    fontSize: '8pt',
    color: MUTED,
    textAlign: 'center',
  },
};

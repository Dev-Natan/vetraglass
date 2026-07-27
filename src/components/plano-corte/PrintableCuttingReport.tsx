import { useMemo } from 'react';
import { distributeAcrossBars, optimizeProfiles, type CutPiece } from '@/utils/profileOptimization';
import { resolveItemImageUrl } from '@/utils/imageUrl';

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
  documentTitle?: string;
  documentSubtitle?: string;
  products: PrintableProductSummary[];
  profileCuts: PrintableProfileCut[];
  glassCuts?: PrintableGlassCut[];
  accessories?: PrintableAccessoryItem[];
  /** Bar length in mm; defaults to 6000 */
  barLengthMm?: number;
}

const Thumb = ({ src, alt }: { src?: string | null; alt: string }) => {
  const resolved = resolveItemImageUrl(src ?? null);
  if (!resolved) return <div style={styles.thumbEmpty} aria-hidden />;
  return <img src={resolved} alt={alt} style={styles.thumb} crossOrigin="anonymous" />;
};

const fmtAngle = (a?: number) => {
  if (a == null) return '—';
  if (a === 4545) return '45° / 45°';
  if (a === 4590) return '45° / 90°';
  if (a === 9045) return '90° / 45°';
  if (a === 9090) return '90° / 90°';
  return `${a}°`;
};

/**
 * Print-only production report. Rendered inside `.print-area` and made
 * visible exclusively by the `@media print` rules in `index.css`.
 * Uses inline styles to guarantee predictable output on any browser.
 */
export function PrintableCuttingReport({
  companyName,
  documentTitle = 'PLANO DE CORTE E PRODUÇÃO',
  documentSubtitle,
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

  return (
    <div className="printable-report" style={styles.root}>
      {/* 1. Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.companyName}>{companyName}</div>
          <div style={styles.docSubtitle}>Relatório de Produção • A4</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.docTitle}>{documentTitle}</div>
          <div style={styles.docMeta}>
            Gerado em {now.toLocaleDateString('pt-BR')} às{' '}
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {documentSubtitle && <div style={styles.docMeta}>{documentSubtitle}</div>}
        </div>
      </header>

      {/* 2. Product summary */}
      {products.length > 0 && (
        <section style={{ ...styles.section, pageBreakInside: 'avoid' }}>
          <h2 style={styles.sectionTitle}>Resumo do Vão</h2>
          <table style={styles.summaryTable}>
            <thead>
              <tr>
                <th style={styles.summaryTh}>Produto</th>
                <th style={styles.summaryTh}>Largura (mm)</th>
                <th style={styles.summaryTh}>Altura (mm)</th>
                <th style={styles.summaryTh}>Peças</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  <td style={styles.summaryTd}>{p.productName || '—'}</td>
                  <td style={{ ...styles.summaryTd, ...styles.numCell }}>{p.width}</td>
                  <td style={{ ...styles.summaryTd, ...styles.numCell }}>{p.height}</td>
                  <td style={{ ...styles.summaryTd, ...styles.numCell }}>{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 2b. Glass cuts */}
      {glassCuts.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Cortes de Vidro</h2>
          <table style={styles.cutsTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>Img</th>
                <th style={styles.th}>Vidro</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Largura (mm)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Altura (mm)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Área (m²)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {glassCuts.map((g, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                  <td style={{ ...styles.td, ...styles.thumbCell }}>
                    <Thumb src={g.imageUrl} alt={g.glassName} />
                  </td>
                  <td style={styles.td}>{g.glassName}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.width}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.height}</td>
                  <td style={{ ...styles.td, ...styles.numCell }}>{g.areaM2.toFixed(3)}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{g.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 3. Profile cuts table (no formulas) */}
      {profileCuts.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Cortes de Perfil</h2>
          <table style={styles.cutsTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>Img</th>
                <th style={styles.th}>Perfil</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Medida (mm)</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Qtd.</th>
                <th style={styles.th}>Ângulo</th>
                <th style={styles.th}>Posição</th>
              </tr>
            </thead>
            <tbody>
              {profileCuts.map((c, idx) => {
                const angleStart = c.cutAngleStart ?? c.cutAngle;
                const angleEnd = c.cutAngleEnd ?? c.cutAngle;
                const compound =
                  c.cutAngleStart != null && c.cutAngleEnd != null && c.cutAngleStart !== c.cutAngleEnd;
                return (
                  <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ ...styles.td, ...styles.thumbCell }}>
                      <Thumb src={c.imageUrl} alt={c.profileName} />
                    </td>
                    <td style={styles.td}>{c.profileName}</td>
                    <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>
                      {c.calculatedLength}
                    </td>
                    <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{c.quantity}</td>
                    <td style={styles.td}>
                      {compound ? `${angleStart}° / ${angleEnd}°` : fmtAngle(c.cutAngle)}
                    </td>
                    <td style={styles.td}>{c.position}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* 4. Bar optimization map */}
      {optimization.profiles.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Mapa de Otimização de Barras ({barLengthMm / 1000}m)</h2>
          {optimization.profiles.map((profile) => {
            const distribution = distributeAcrossBars(profile.cuts, profile.barLengthMm);
            return (
              <div
                key={profile.itemTemplateId}
                style={{ ...styles.profileBlock, pageBreakInside: 'avoid' }}
              >
                <div style={styles.profileHeader}>
                  <strong style={{ fontSize: '11pt' }}>{profile.itemName}</strong>
                  <span style={styles.profileMeta}>
                    {profile.barsNeeded} barra(s) de {profile.barLengthMm} mm ·{' '}
                    Aproveitamento {(100 - profile.wastePercent).toFixed(1)}% · Retalho{' '}
                    {profile.wastePercent.toFixed(1)}%
                  </span>
                </div>

                <div style={styles.barsWrap}>
                  {distribution.map((bar) => {
                    const usedPct = (bar.usedLength / profile.barLengthMm) * 100;
                    return (
                      <div
                        key={bar.barIndex}
                        style={{ ...styles.barRow, pageBreakInside: 'avoid' }}
                      >
                        <div style={styles.barLabel}>Barra {bar.barIndex}</div>
                        <div style={styles.barTrack}>
                          {bar.cuts.flatMap((cut, idx) =>
                            Array.from({ length: cut.qty }).map((_, pi) => {
                              const w = (cut.length / profile.barLengthMm) * 100;
                              return (
                                <div
                                  key={`${idx}-${pi}`}
                                  style={{
                                    ...styles.barPiece,
                                    width: `${w}%`,
                                  }}
                                >
                                  {w > 6 ? `${cut.length}` : ''}
                                </div>
                              );
                            })
                          )}
                          {bar.remainingLength > 0 && (
                            <div
                              style={{
                                ...styles.barWaste,
                                width: `${(bar.remainingLength / profile.barLengthMm) * 100}%`,
                              }}
                            >
                              {bar.remainingLength > profile.barLengthMm * 0.06
                                ? `sobra ${bar.remainingLength}`
                                : ''}
                            </div>
                          )}
                        </div>
                        <div style={styles.barUsed}>{usedPct.toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={styles.totalsBox}>
            <span>
              <strong>Total de barras:</strong> {optimization.totalProfileBars}
            </span>
            <span>
              <strong>Desperdício total:</strong> {optimization.totalProfileWasteMm} mm
            </span>
            <span>
              <strong>Desperdício médio:</strong> {optimization.avgWastePercent}%
            </span>
          </div>
        </section>
      )}

      {/* 5. Accessories & inputs */}
      {accessories.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Acessórios & Insumos</h2>
          <table style={styles.cutsTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thumbCell }}>Img</th>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>Tipo</th>
                <th style={{ ...styles.th, ...styles.numCell }}>Quantidade</th>
                <th style={styles.th}>Unidade</th>
              </tr>
            </thead>
            <tbody>
              {accessories.map((a, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                  <td style={{ ...styles.td, ...styles.thumbCell }}>
                    <Thumb src={a.imageUrl} alt={a.itemName} />
                  </td>
                  <td style={styles.td}>{a.itemName}</td>
                  <td style={styles.td}>{a.type}</td>
                  <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700 }}>{a.quantity}</td>
                  <td style={styles.td}>{a.unit || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer style={styles.footer}>
        {companyName} — Documento gerado automaticamente pelo sistema. Preto sobre branco para impressão econômica.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline styles: guarantee identical rendering across print engines. */
/* ------------------------------------------------------------------ */
const styles: Record<string, React.CSSProperties> = {
  root: {
    color: '#000',
    background: '#fff',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '10pt',
    lineHeight: 1.35,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #000',
    paddingBottom: '8px',
    marginBottom: '12px',
  },
  companyName: {
    fontSize: '16pt',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  docSubtitle: { fontSize: '9pt', color: '#000' },
  docTitle: { fontSize: '12pt', fontWeight: 700, textTransform: 'uppercase' },
  docMeta: { fontSize: '9pt', color: '#000' },
  section: { marginTop: '14px', pageBreakInside: 'auto' },
  sectionTitle: {
    fontSize: '11pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    borderBottom: '1px solid #000',
    paddingBottom: '3px',
    marginBottom: '6px',
    letterSpacing: '0.3px',
  },
  summaryTable: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #000',
  },
  summaryTh: {
    background: '#f0f0f0',
    border: '1px solid #000',
    padding: '5px 8px',
    textAlign: 'left',
    fontSize: '9pt',
    textTransform: 'uppercase',
  },
  summaryTd: {
    border: '1px solid #000',
    padding: '5px 8px',
    fontSize: '10pt',
  },
  cutsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #000',
  },
  th: {
    background: '#f0f0f0',
    border: '1px solid #000',
    padding: '5px 8px',
    textAlign: 'left',
    fontSize: '9pt',
    textTransform: 'uppercase',
  },
  td: {
    border: '1px solid #000',
    padding: '5px 8px',
    fontSize: '10pt',
  },
  numCell: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
  thumbCell: { width: '48px', textAlign: 'center', padding: '3px' },
  thumb: {
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: '4px',
    border: '1px solid #000',
    display: 'block',
    margin: '0 auto',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  thumbEmpty: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    border: '1px dashed #999',
    display: 'block',
    margin: '0 auto',
    background: '#fafafa',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  profileBlock: {
    border: '1px solid #000',
    padding: '8px',
    marginBottom: '8px',
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '6px',
    borderBottom: '1px dashed #000',
    paddingBottom: '4px',
  },
  profileMeta: { fontSize: '9pt' },
  barsWrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  barLabel: { width: '60px', fontSize: '9pt', fontWeight: 600 },
  barTrack: {
    flex: 1,
    display: 'flex',
    height: '22px',
    border: '1px solid #000',
    background: '#fff',
    overflow: 'hidden',
  },
  barPiece: {
    height: '100%',
    borderRight: '1px solid #000',
    background: '#d9d9d9',
    color: '#000',
    fontSize: '8pt',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  barWaste: {
    height: '100%',
    background:
      'repeating-linear-gradient(45deg, #fff, #fff 3px, #bbb 3px, #bbb 5px)',
    color: '#000',
    fontSize: '8pt',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  barUsed: { width: '44px', textAlign: 'right', fontSize: '9pt', fontWeight: 600 },
  totalsBox: {
    marginTop: '8px',
    padding: '6px 8px',
    border: '1px solid #000',
    background: '#f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9.5pt',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  },
  footer: {
    marginTop: '18px',
    paddingTop: '6px',
    borderTop: '1px solid #000',
    fontSize: '8pt',
    textAlign: 'center',
  },
};

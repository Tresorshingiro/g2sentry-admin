import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GuardianListItem } from '@/types/guardian-roster';

// ── Colour palette (matches the app) ─────────────────────────────────────────
const C = {
  dark:       [13,  17,  23]  as [number, number, number],
  green:      [34,  197, 94]  as [number, number, number],
  greenDark:  [21,  128, 61]  as [number, number, number],
  greenLight: [240, 253, 244] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  slate50:    [248, 250, 252] as [number, number, number],
  slate100:   [241, 245, 249] as [number, number, number],
  slate200:   [226, 232, 240] as [number, number, number],
  slate400:   [148, 163, 184] as [number, number, number],
  slate600:   [71,  85,  105] as [number, number, number],
  slate900:   [15,  23,  42]  as [number, number, number],
  amber:      [251, 191, 36]  as [number, number, number],
  red:        [239, 68,  68]  as [number, number, number],
};

// ── Label helpers ─────────────────────────────────────────────────────────────
function statusLabel(s: string): string {
  if (s === 'ACTIVE')    return 'Active';
  if (s === 'SUSPENDED') return 'Suspended';
  return 'Inactive';
}

function vettingLabel(s: string): string {
  if (s === 'VERIFIED') return 'Verified';
  if (s === 'REJECTED') return 'Rejected';
  return 'Pending';
}

function employmentLabel(t: string): string {
  if (t === 'FULL_TIME') return 'Full-time';
  if (t === 'PART_TIME') return 'Part-time';
  if (t === 'RESERVE')   return 'Reserve';
  return t;
}

function fmtPhone(p: string): string {
  if (p.startsWith('+250') && p.length === 13)
    return `+250 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
  return p;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Stat box helper ───────────────────────────────────────────────────────────
function drawStatBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string,
  accent: [number, number, number],
) {
  // Card background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Top accent line
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, w, 1.5, 0.5, 0.5, 'F');

  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.slate900);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.slate400);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 5, { align: 'center' });
}

// ── Main export function ──────────────────────────────────────────────────────
export function exportGuardiansPDF(
  guardians: GuardianListItem[],
  stats: { total: number | null; active: number | null; pending: number | null; suspended: number | null },
  filterLabel: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();   // 297
  const PH  = doc.internal.pageSize.getHeight();  // 210
  const now = new Date();

  // ── Header banner ────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, 30, 'F');

  // Green accent bar
  doc.setFillColor(...C.green);
  doc.rect(0, 0, 4, 30, 'F');

  // Shield icon placeholder (filled square + letter)
  doc.setFillColor(...C.green);
  doc.roundedRect(10, 8, 14, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text('G2', 17, 17, { align: 'center' });

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text('G2Sentry', 28, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate400);
  doc.text('Security Operations Admin Portal', 28, 20);

  // Report title (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('Guardian Roster Report', PW - 12, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate400);
  doc.text(
    `Generated: ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  Filter: ${filterLabel}`,
    PW - 12, 21, { align: 'right' },
  );

  // ── Stat cards row ───────────────────────────────────────────────────────────
  const cardY = 36;
  const cardH = 22;
  const cardW = 44;
  const gap   = 6;
  const startX = 12;

  drawStatBox(doc, startX,                        cardY, cardW, cardH, String(stats.total     ?? '—'), 'Total guardians',  C.slate400);
  drawStatBox(doc, startX + (cardW + gap),        cardY, cardW, cardH, String(stats.active    ?? '—'), 'Active',           C.green);
  drawStatBox(doc, startX + (cardW + gap) * 2,    cardY, cardW, cardH, String(stats.pending   ?? '—'), 'Pending vetting',  C.amber);
  drawStatBox(doc, startX + (cardW + gap) * 3,    cardY, cardW, cardH, String(stats.suspended ?? '—'), 'Suspended',        C.red);

  // Small note beside stat cards
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text(
    `This report contains ${guardians.length} guardian${guardians.length !== 1 ? 's' : ''} — Rwanda`,
    startX + (cardW + gap) * 4 + 4, cardY + cardH / 2 + 1,
  );

  // ── Table ────────────────────────────────────────────────────────────────────
  const tableStartY = cardY + cardH + 6;

  const rows = guardians.map((g) => [
    g.guardianCode,
    g.user.fullName ?? '—',
    fmtPhone(g.user.phoneNumber),
    g.districtBase,
    employmentLabel(g.employmentType ?? '—'),
    statusLabel(g.status),
    vettingLabel(g.verificationStatus),
    Number(g.rating) > 0 ? `${Number(g.rating).toFixed(1)} / 5` : '—',
    g.joinedAt ? fmtDate(g.joinedAt) : '—',
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Code', 'Full Name', 'Phone', 'District', 'Employment', 'Status', 'Vetting', 'Rating', 'Joined']],
    body: rows,
    margin: { left: 12, right: 12 },
    tableWidth: 'auto',

    headStyles: {
      fillColor: C.dark,
      textColor: C.green,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: C.dark,
      lineWidth: 0,
    },

    bodyStyles: {
      fontSize: 7.5,
      textColor: C.slate600,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: C.slate100,
      lineWidth: 0.2,
    },

    alternateRowStyles: {
      fillColor: C.slate50,
    },

    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.slate900, cellWidth: 22 },  // Code
      1: { cellWidth: 42 },                                              // Name
      2: { cellWidth: 34 },                                              // Phone
      3: { cellWidth: 28 },                                              // District
      4: { cellWidth: 24 },                                              // Employment
      5: { cellWidth: 20 },                                              // Status
      6: { cellWidth: 20 },                                              // Vetting
      7: { cellWidth: 20, halign: 'center' },                           // Rating
      8: { cellWidth: 26 },                                              // Joined
    },

    // Colour-code status and vetting cells
    didParseCell(data) {
      if (data.section !== 'body') return;

      if (data.column.index === 5) {
        const v = data.cell.raw as string;
        if (v === 'Active')    { data.cell.styles.textColor = C.greenDark; data.cell.styles.fontStyle = 'bold'; }
        if (v === 'Suspended') { data.cell.styles.textColor = C.red; }
      }
      if (data.column.index === 6) {
        const v = data.cell.raw as string;
        if (v === 'Verified')  { data.cell.styles.textColor = C.greenDark; data.cell.styles.fontStyle = 'bold'; }
        if (v === 'Pending')   { data.cell.styles.textColor = [146, 64, 14] as [number,number,number]; }
        if (v === 'Rejected')  { data.cell.styles.textColor = C.red; }
      }
    },

    // Footer on every page
    didDrawPage(data) {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      const pg = data.pageNumber;

      // Footer bar
      doc.setFillColor(...C.slate100);
      doc.rect(0, PH - 10, PW, 10, 'F');

      doc.setFillColor(...C.green);
      doc.rect(0, PH - 10, 3, 10, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.slate400);
      doc.text('G2Sentry · Confidential — Internal use only', 8, PH - 3.5);
      doc.text(`Page ${pg} of ${pageCount}`, PW - 12, PH - 3.5, { align: 'right' });
    },
  });

  // ── Save ──────────────────────────────────────────────────────────────────────
  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`G2Sentry_Guardian_Roster_${dateStr}.pdf`);
}

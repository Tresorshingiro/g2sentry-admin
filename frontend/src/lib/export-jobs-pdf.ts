import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Job } from '@/types/assignment';

// ── Colour palette ────────────────────────────────────────────────────────────
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
  amber:      [217, 119, 6]   as [number, number, number],
  amberLight: [251, 191, 36]  as [number, number, number],
  red:        [220, 38,  38]  as [number, number, number],
  blue:       [37,  99,  235] as [number, number, number],
  purple:     [124, 58,  237] as [number, number, number],
};

// ── Label helpers ─────────────────────────────────────────────────────────────
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pending', DISPATCHING: 'Dispatching', ASSIGNED: 'Assigned',
    IN_PROGRESS: 'On duty', COMPLETED: 'Completed', FAILED: 'Failed', CANCELLED: 'Cancelled',
  };
  return map[s] ?? s;
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = {
    URGENT: 'Urgent', HIGH: 'High', STANDARD: 'Standard', MEDIUM: 'Medium', LOW: 'Low',
  };
  return map[p] ?? p;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + '  '
    + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Stat box ──────────────────────────────────────────────────────────────────
function drawStatBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string,
  accent: [number, number, number],
) {
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  doc.setFillColor(...accent);
  doc.roundedRect(x, y, w, 1.5, 0.5, 0.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.slate900);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.slate400);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 5, { align: 'center' });
}

// ── Main export ───────────────────────────────────────────────────────────────
export function exportJobsPDF(
  jobs: Job[],
  stats: { total: number | null; pending: number | null; active: number | null; completed: number | null },
  filterLabel: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();
  const now = new Date();

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, 30, 'F');

  doc.setFillColor(...C.green);
  doc.rect(0, 0, 4, 30, 'F');

  doc.setFillColor(...C.green);
  doc.roundedRect(10, 8, 14, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text('G2', 17, 17, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text('G2Sentry', 28, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate400);
  doc.text('Security Operations Admin Portal', 28, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('Jobs Report', PW - 12, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate400);
  doc.text(
    `Generated: ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  Filter: ${filterLabel}`,
    PW - 12, 21, { align: 'right' },
  );

  // ── Stat cards ────────────────────────────────────────────────────────────
  const cardY = 36;
  const cardH = 22;
  const cardW = 44;
  const gap   = 6;
  const sx    = 12;

  drawStatBox(doc, sx,                     cardY, cardW, cardH, String(stats.total     ?? '—'), 'Total jobs',       C.slate400);
  drawStatBox(doc, sx + (cardW + gap),     cardY, cardW, cardH, String(stats.pending   ?? '—'), 'Pending dispatch', C.amberLight);
  drawStatBox(doc, sx + (cardW + gap) * 2, cardY, cardW, cardH, String(stats.active    ?? '—'), 'On duty now',      C.green);
  drawStatBox(doc, sx + (cardW + gap) * 3, cardY, cardW, cardH, String(stats.completed ?? '—'), 'Completed',        C.blue);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text(
    `This report contains ${jobs.length} job${jobs.length !== 1 ? 's' : ''} — Rwanda`,
    sx + (cardW + gap) * 4 + 4, cardY + cardH / 2 + 1,
  );

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableStartY = cardY + cardH + 6;

  const rows = jobs.map((job) => {
    const assigned  = job.assignedGuardians?.length ?? 0;
    const requested = job.requestedGuardianCount ?? 1;
    const guardianNames = job.assignedGuardians
      ?.slice(0, 2)
      .map((a) => a.guardian.user.fullName ?? a.guardian.guardianCode)
      .join(', ') ?? '—';
    const overflow = assigned > 2 ? ` +${assigned - 2}` : '';

    return [
      job.referenceNumber,
      job.organization?.legalName ?? '—',
      job.location?.name ?? '—',
      job.location?.district ?? job.organization?.district ?? '—',
      fmtDateTime(job.scheduledStart),
      job.scheduledEnd ? fmtTime(job.scheduledEnd) : '—',
      priorityLabel(job.priority),
      statusLabel(job.status),
      `${assigned}/${requested}`,
      guardianNames + overflow,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['Ref #', 'Client', 'Site', 'District', 'Start', 'End', 'Priority', 'Status', 'Staff', 'Guardians']],
    body: rows,
    margin: { left: 12, right: 12 },
    tableWidth: 'auto',

    headStyles: {
      fillColor: C.dark,
      textColor: C.green,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineColor: C.dark,
      lineWidth: 0,
    },

    bodyStyles: {
      fontSize: 7.5,
      textColor: C.slate600,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: C.slate100,
      lineWidth: 0.2,
    },

    alternateRowStyles: {
      fillColor: C.slate50,
    },

    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.slate900, cellWidth: 26 },  // Ref
      1: { cellWidth: 40 },                                              // Client
      2: { cellWidth: 34 },                                              // Site
      3: { cellWidth: 26 },                                              // District
      4: { cellWidth: 34 },                                              // Start
      5: { cellWidth: 16 },                                              // End
      6: { cellWidth: 20 },                                              // Priority
      7: { cellWidth: 22 },                                              // Status
      8: { cellWidth: 14, halign: 'center' },                           // Staff
      9: { cellWidth: 'auto' },                                          // Guardians
    },

    didParseCell(data) {
      if (data.section !== 'body') return;

      // Priority colours
      if (data.column.index === 6) {
        const v = data.cell.raw as string;
        if (v === 'Urgent')   { data.cell.styles.textColor = C.red;    data.cell.styles.fontStyle = 'bold'; }
        if (v === 'High')     { data.cell.styles.textColor = C.amber;  data.cell.styles.fontStyle = 'bold'; }
        if (v === 'Standard') { data.cell.styles.textColor = C.blue; }
      }

      // Status colours
      if (data.column.index === 7) {
        const v = data.cell.raw as string;
        if (v === 'On duty')    { data.cell.styles.textColor = C.greenDark; data.cell.styles.fontStyle = 'bold'; }
        if (v === 'Completed')  { data.cell.styles.textColor = C.slate400; }
        if (v === 'Cancelled' || v === 'Failed') { data.cell.styles.textColor = C.red; }
        if (v === 'Dispatching' || v === 'Assigned') { data.cell.styles.textColor = C.blue; }
        if (v === 'Pending')    { data.cell.styles.textColor = C.amber; }
      }

      // Staffing — red if understaffed
      if (data.column.index === 8) {
        const [a, r] = (data.cell.raw as string).split('/').map(Number);
        if (!isNaN(a) && !isNaN(r) && a < r) {
          data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },

    didDrawPage(data) {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();

      doc.setFillColor(...C.slate100);
      doc.rect(0, PH - 10, PW, 10, 'F');

      doc.setFillColor(...C.green);
      doc.rect(0, PH - 10, 3, 10, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.slate400);
      doc.text('G2Sentry · Confidential — Internal use only', 8, PH - 3.5);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, PW - 12, PH - 3.5, { align: 'right' });
    },
  });

  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`G2Sentry_Jobs_Report_${dateStr}.pdf`);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  GuardianPerformanceRow,
  WeeklyAssignmentStat,
} from '@/types/analytics';

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  dark:      [13,  17,  23]  as [number, number, number],
  green:     [20,  184, 122] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  slate50:   [248, 250, 252] as [number, number, number],
  slate100:  [241, 245, 249] as [number, number, number],
  slate200:  [226, 232, 240] as [number, number, number],
  slate400:  [148, 163, 184] as [number, number, number],
  slate600:  [71,  85,  105] as [number, number, number],
  slate900:  [15,  23,  42]  as [number, number, number],
  amber:     [251, 191, 36]  as [number, number, number],
  red:       [239, 68,  68]  as [number, number, number],
  blue:      [59,  130, 246] as [number, number, number],
};

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
  doc.setFontSize(6.5);
  doc.setTextColor(...C.slate400);
  doc.text(label.toUpperCase(), x + w / 2, y + h - 4.5, { align: 'center' });
}

// ── Banner ────────────────────────────────────────────────────────────────────
function drawBanner(doc: jsPDF, title: string, subtitle: string) {
  const PW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, 28, 'F');
  doc.setFillColor(...C.green);
  doc.rect(0, 0, 3.5, 28, 'F');
  doc.setFillColor(...C.green);
  doc.roundedRect(9, 7, 13, 13, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.dark);
  doc.text('G2', 15.5, 15, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text('G2Sentry', 26, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text('Security Operations Admin Portal', 26, 19.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(title, PW - 10, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text(subtitle, PW - 10, 20, { align: 'right' });
}

// ── Section heading ───────────────────────────────────────────────────────────
function sectionHeading(doc: jsPDF, text: string, y: number) {
  const PW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.slate50);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.2);
  doc.rect(10, y, PW - 20, 7, 'FD');
  doc.setFillColor(...C.green);
  doc.rect(10, y, 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate600);
  doc.text(text.toUpperCase(), 15, y + 4.5);
  return y + 10;
}

const now = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Full analytics report ─────────────────────────────────────────────────────
export function exportAnalyticsPDF(
  periodLabel: string,
  summary: AnalyticsSummary,
  weekly: WeeklyAssignmentStat[],
  districts: DistrictAssignmentStat[],
  guardians: GuardianPerformanceRow[],
  prevLabel: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();

  drawBanner(doc, 'Analytics Report', `Period: ${periodLabel}  ·  Generated: ${now()}`);

  // ── Metric stat cards ──
  const cardY = 34;
  const cardH = 22;
  const cardW = 62;
  const gap   = 4;
  const sx    = 10;

  drawStatBox(doc, sx,                    cardY, cardW, cardH, String(summary.totalAssignments),       'Total assignments',  C.slate400);
  drawStatBox(doc, sx + (cardW + gap),    cardY, cardW, cardH, summary.avgResponseMinutes > 0 ? `${summary.avgResponseMinutes} min` : '—', 'Avg response time', C.blue);
  drawStatBox(doc, sx + (cardW + gap) * 2, cardY, cardW, cardH, `${summary.completionRatePct}%`,       'Completion rate',    C.green);
  drawStatBox(doc, sx + (cardW + gap) * 3, cardY, cardW, cardH, summary.incidents > 0 ? String(summary.incidents) : '—', 'Incidents',    C.red);

  let y = cardY + cardH + 8;

  // ── Weekly assignments ──
  if (weekly.length > 0) {
    y = sectionHeading(doc, 'Weekly Assignments', y);
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      head: [['Week', `${periodLabel} (current)`, `${prevLabel} (previous)`, 'Change']],
      body: weekly.map((w) => {
        const diff = w.current - w.previous;
        return [
          w.week,
          String(w.current),
          String(w.previous),
          diff >= 0 ? `+${diff}` : String(diff),
        ];
      }),
      headStyles:   { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 2.5 },
      bodyStyles:   { fontSize: 8, textColor: C.slate900, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: C.slate50 },
      columnStyles: { 0: { fontStyle: 'bold' }, 3: { fontStyle: 'bold' } },
      tableLineColor: C.slate200,
      tableLineWidth: 0.2,
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── District activity ──
  if (districts.length > 0 && y < 175) {
    y = sectionHeading(doc, 'District Activity', y);
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      head: [['District', 'Assignments', 'Share']],
      body: (() => {
        const total = districts.reduce((s, d) => s + d.count, 0);
        return districts.map((d) => [
          d.district,
          String(d.count),
          total > 0 ? `${Math.round((d.count / total) * 100)}%` : '0%',
        ]);
      })(),
      headStyles:   { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 2.5 },
      bodyStyles:   { fontSize: 8, textColor: C.slate900, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: C.slate50 },
      tableLineColor: C.slate200,
      tableLineWidth: 0.2,
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Guardian performance (new page if needed) ──
  if (guardians.length > 0) {
    if (y > 155) { doc.addPage(); y = 15; }
    y = sectionHeading(doc, 'Guardian Performance', y);
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      head: [['Guardian', 'Jobs Completed', 'Avg Response', 'Reliability', 'Rating', 'No-Shows']],
      body: guardians.map((g) => [
        g.name,
        String(g.jobs),
        g.response,
        `${g.reliabilityPct}%`,
        g.rating,
        String(g.incidents),
      ]),
      headStyles:   { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 2.5 },
      bodyStyles:   { fontSize: 8, textColor: C.slate900, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: C.slate50 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      tableLineColor: C.slate200,
      tableLineWidth: 0.2,
    });
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const PH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.2);
    doc.line(10, PH - 9, PW - 10, PH - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.slate400);
    doc.text('G2Sentry — Confidential', 10, PH - 5);
    doc.text(`Page ${i} of ${pageCount}`, PW - 10, PH - 5, { align: 'right' });
  }

  doc.save(`g2sentry-analytics-${periodLabel.replace(/[\s–]/g, '-')}.pdf`);
}

// ── Single-section reports ────────────────────────────────────────────────────
export function exportAssignmentsPDF(periodLabel: string, weekly: WeeklyAssignmentStat[], prevLabel: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawBanner(doc, 'Assignments Summary', `Period: ${periodLabel}  ·  Generated: ${now()}`);
  let y = 36;
  y = sectionHeading(doc, 'Weekly Assignments', y);
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [['Week', `${periodLabel} (current)`, `${prevLabel} (previous)`, 'Change']],
    body: weekly.map((w) => {
      const diff = w.current - w.previous;
      return [w.week, String(w.current), String(w.previous), diff >= 0 ? `+${diff}` : String(diff)];
    }),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, textColor: C.slate900, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.slate50 },
    tableLineColor: C.slate200, tableLineWidth: 0.2,
  });
  addFooter(doc, periodLabel);
  doc.save(`assignments-summary-${periodLabel.replace(/[\s–]/g, '-')}.pdf`);
}

export function exportGuardianPerformancePDF(periodLabel: string, guardians: GuardianPerformanceRow[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawBanner(doc, 'Guardian Performance', `Period: ${periodLabel}  ·  Generated: ${now()}`);
  let y = 36;
  y = sectionHeading(doc, 'Guardian Performance Table', y);
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [['Guardian', 'Jobs Completed', 'Avg Response', 'Reliability', 'Rating', 'No-Shows']],
    body: guardians.map((g) => [g.name, String(g.jobs), g.response, `${g.reliabilityPct}%`, g.rating, String(g.incidents)]),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, textColor: C.slate900, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.slate50 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    tableLineColor: C.slate200, tableLineWidth: 0.2,
  });
  addFooter(doc, periodLabel);
  doc.save(`guardian-performance-${periodLabel.replace(/[\s–]/g, '-')}.pdf`);
}

export function exportDistrictActivityPDF(periodLabel: string, districts: DistrictAssignmentStat[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawBanner(doc, 'District Activity', `Period: ${periodLabel}  ·  Generated: ${now()}`);
  let y = 36;
  y = sectionHeading(doc, 'Assignments by District', y);
  const total = districts.reduce((s, d) => s + d.count, 0);
  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [['District', 'Assignments', 'Share of Total']],
    body: districts.map((d) => [
      d.district,
      String(d.count),
      total > 0 ? `${Math.round((d.count / total) * 100)}%` : '0%',
    ]),
    headStyles: { fillColor: C.dark, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, textColor: C.slate900, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.slate50 },
    tableLineColor: C.slate200, tableLineWidth: 0.2,
  });
  addFooter(doc, periodLabel);
  doc.save(`district-activity-${periodLabel.replace(/[\s–]/g, '-')}.pdf`);
}

function addFooter(doc: jsPDF, periodLabel: string) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.2);
  doc.line(10, PH - 9, PW - 10, PH - 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.slate400);
  doc.text(`G2Sentry — Confidential  ·  Period: ${periodLabel}`, 10, PH - 5);
  doc.text(now(), PW - 10, PH - 5, { align: 'right' });
}

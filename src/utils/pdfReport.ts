import { jsPDF } from 'jspdf';
import type { FamilyMember, HealthRecord } from '../types/health';
import { getBPStatus, getHeartRateStatus, getSpO2Status, getSugarStatus } from './healthRules';
import { getTodayISO } from './helpers';

interface ExportHealthPdfParams {
  member: FamilyMember;
  familyName?: string;
  emergencyContact?: string;
  records: HealthRecord[];
}

export function exportMemberHealthPdf({
  member,
  familyName,
  emergencyContact,
  records,
}: ExportHealthPdfParams): string {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const today = getTodayISO();

  const bpRecords = records
    .filter((r) => r.type === 'BP')
    .sort((a, b) => b.date.localeCompare(a.date));
  const sugarRecords = records
    .filter((r) => r.type === 'Sugar')
    .sort((a, b) => b.date.localeCompare(a.date));
  const visitRecords = records
    .filter((r) => r.type === 'DoctorVisit')
    .sort((a, b) => b.date.localeCompare(a.date));
  const watchRecords = records
    .filter((r) => r.type === 'HeartRate' || r.type === 'SpO2')
    .sort((a, b) => b.date.localeCompare(a.date));

  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > 276) {
      pdf.addPage();
      y = 18;
    }
  };

  // Top Header Bar
  pdf.setFillColor(5, 150, 105); // #059669 Emerald
  pdf.rect(0, 0, pageWidth, 28, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Rabbit Mediko — Health Record Report', margin, 13);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(
    `${familyName ? `${familyName}  ·  ` : ''}Generated on ${today}`,
    margin,
    21
  );

  y = 36;

  // Member Details Box
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(member.name, margin + 5, y + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    `Age: ${member.age} yrs   |   Gender: ${member.gender}   |   Blood Group: ${member.bloodGroup}`,
    margin + 5,
    y + 15
  );
  pdf.text(
    `Conditions: ${member.conditions.join(', ')}   |   Allergies: ${member.allergies.join(', ')}`,
    margin + 5,
    y + 21
  );
  const contact = member.emergencyContact || emergencyContact || 'Not set';
  pdf.text(`Emergency Contact: ${contact}`, margin + 5, y + 27);

  y += 38;

  // Helper to draw a structured table
  const drawTable = (
    title: string,
    referenceRange: string,
    summaryLine: string,
    headers: [string, string, string, string],
    rows: Array<[string, string, string, string]>
  ) => {
    ensureSpace(26);

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, margin, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(referenceRange, pageWidth - margin, y, { align: 'right' });
    y += 5;

    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    pdf.text(summaryLine, margin, y);
    y += 6;

    if (rows.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text('No readings recorded yet.', margin, y + 2);
      y += 12;
      return;
    }

    const colWidths = [28, 36, 26, contentWidth - 90];
    const colX = [
      margin,
      margin + colWidths[0],
      margin + colWidths[0] + colWidths[1],
      margin + colWidths[0] + colWidths[1] + colWidths[2],
    ];

    const drawHeaderRow = () => {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y, contentWidth, 7.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      headers.forEach((h, idx) => {
        pdf.text(h, colX[idx] + 2, y + 5);
      });
      y += 8.5;
    };

    drawHeaderRow();

    rows.forEach((row) => {
      const noteLines = pdf.splitTextToSize(row[3] || '—', colWidths[3] - 4) as string[];
      const rowHeight = Math.max(7.5, noteLines.length * 4.5 + 3);

      if (y + rowHeight > 276) {
        pdf.addPage();
        y = 18;
        drawHeaderRow();
      }

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(row[0], colX[0] + 2, y + 5);
      pdf.setFont('helvetica', 'bold');
      pdf.text(row[1], colX[1] + 2, y + 5);

      if (row[2] === 'Normal') {
        pdf.setTextColor(5, 150, 105);
      } else {
        pdf.setTextColor(220, 38, 38);
      }
      pdf.text(row[2], colX[2] + 2, y + 5);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text(noteLines, colX[3] + 2, y + 5);

      y += rowHeight;
    });

    y += 10;
  };

  // Blood Pressure Table
  const bpAvgSys =
    bpRecords.length > 0
      ? Math.round(bpRecords.reduce((sum, r) => sum + (r.systolic ?? 0), 0) / bpRecords.length)
      : 0;
  const bpAvgDia =
    bpRecords.length > 0
      ? Math.round(bpRecords.reduce((sum, r) => sum + (r.diastolic ?? 0), 0) / bpRecords.length)
      : 0;
  const bpSummary =
    bpRecords.length > 0
      ? `Total: ${bpRecords.length} readings  ·  Latest: ${bpRecords[0].value} (${bpRecords[0].date})  ·  Average: ${bpAvgSys}/${bpAvgDia} mmHg`
      : 'Total: 0 readings';

  drawTable(
    'Blood Pressure (BP) History',
    'Normal: 90–120 / 60–80 mmHg',
    bpSummary,
    ['Date', 'Reading', 'Status', 'Notes'],
    bpRecords.map((r) => {
      const st = getBPStatus(r.systolic, r.diastolic);
      return [
        r.date,
        r.value,
        st === 'normal' ? 'Normal' : st === 'high' ? 'High' : 'Low',
        r.notes || '—',
      ];
    })
  );

  // Blood Sugar Table
  const sugarAvg =
    sugarRecords.length > 0
      ? Math.round(sugarRecords.reduce((sum, r) => sum + (r.numericValue ?? 0), 0) / sugarRecords.length)
      : 0;
  const sugarSummary =
    sugarRecords.length > 0
      ? `Total: ${sugarRecords.length} readings  ·  Latest: ${sugarRecords[0].value} (${sugarRecords[0].date})  ·  Average: ${sugarAvg} mg/dL`
      : 'Total: 0 readings';

  drawTable(
    'Fasting Blood Sugar History',
    'Normal Fasting: 70–100 mg/dL',
    sugarSummary,
    ['Date', 'Reading', 'Status', 'Notes'],
    sugarRecords.map((r) => {
      const st = getSugarStatus(r.numericValue);
      return [
        r.date,
        r.value,
        st === 'normal' ? 'Normal' : st === 'high' ? 'High' : 'Low',
        r.notes || '—',
      ];
    })
  );

  // Smartwatch Heart Rate & SpO2 Table (if recorded)
  if (watchRecords.length > 0) {
    drawTable(
      'Smartwatch / Wearable Vitals (Heart Rate & SpO2)',
      'Normal: HR 60–100 bpm · SpO2 ≥ 95%',
      `Total: ${watchRecords.length} wearable readings  ·  Latest: ${watchRecords[0].value} (${watchRecords[0].date})`,
      ['Date', 'Reading', 'Status', 'Notes'],
      watchRecords.map((r) => {
        const st =
          r.type === 'HeartRate'
            ? getHeartRateStatus(r.numericValue)
            : getSpO2Status(r.numericValue);
        return [
          r.date,
          r.value,
          st === 'normal' ? 'Normal' : st === 'high' ? 'High' : 'Low',
          r.notes || 'Wearable / Watch reading',
        ];
      })
    );
  }

  // Doctor Visits Summary (if recorded)
  if (visitRecords.length > 0) {
    ensureSpace(22);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Doctor Visits Log', margin, y);
    y += 6;

    visitRecords.forEach((v) => {
      const noteLines = pdf.splitTextToSize(v.notes || '—', contentWidth - 4) as string[];
      ensureSpace(12 + noteLines.length * 4.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${v.date}  ·  ${v.doctorName || v.value}`, margin, y);
      y += 4.5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(noteLines, margin, y);
      y += noteLines.length * 4.5 + 4;
    });
  }

  // Page Footers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      'Rabbit Mediko · Family Health Vault · Consult a qualified physician for medical decisions.',
      margin,
      288
    );
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 288, { align: 'right' });
  }

  const filename = `${member.name.replace(/\s+/g, '_')}_Health_Report_${today}.pdf`;
  pdf.save(filename);
  return filename;
}

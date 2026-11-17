import { downloadCSV } from './utils';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export async function exportReport(
  name: string,
  rows: object[],
  format: ExportFormat,
  companyName = 'TechNova Distributors',
  scope = 'Fictional demo data | Snapshot: November 14, 2026 | Currency: USD',
) {
  if (format === 'csv') {
    downloadCSV(name, rows);
    return;
  }
  save(await createReportBlob(name, rows, format, companyName, scope), `${name}.${format}`);
}
export async function createReportBlob(
  name: string,
  rows: object[],
  format: 'xlsx' | 'pdf',
  companyName = 'TechNova Distributors',
  scope = 'Fictional demo data | Snapshot: November 14, 2026 | Currency: USD',
): Promise<Blob> {
  const columns = Object.keys(rows[0] ?? {});
  const records = rows as Record<string, unknown>[];
  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = companyName;
    const sheet = workbook.addWorksheet('Report');
    sheet.columns = columns.map((key) => ({
      header: key.replace(/([A-Z])/g, ' $1').toUpperCase(),
      key,
      width: ['name', 'customer', 'email', 'supplier'].includes(key) ? 32 : 19,
    }));
    records.forEach((row) =>
      sheet.addRow(
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === 'string' && /^[=+@\-]/.test(v) ? `'${v}` : v,
          ]),
        ),
      ),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34335C' } };
    sheet.getRow(1).height = 26;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([new Uint8Array(buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', format: columns.length > 8 ? 'a3' : 'a4' });
  const text = (value: string) =>
    value.replace(/[“”]/g, '\"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-');
  const width = doc.internal.pageSize.getWidth();
  doc.setFontSize(19);
  doc.setTextColor('#24263b');
  doc.text(text(companyName), 14, 19);
  doc.setFontSize(11);
  doc.text(name.replaceAll('-', ' '), 14, 27);
  doc.setFontSize(8);
  doc.setTextColor('#707789');
  doc.text(text(scope), 14, 34);
  const colWidth = (width - 28) / columns.length;
  let y = 45;
  doc.setFontSize(9);
  const drawRow = (values: string[], header = false) => {
    const lines = values.map((value) => doc.splitTextToSize(text(value), colWidth - 5) as string[]);
    const h = Math.max(...lines.map((l) => l.length)) * 4 + 7;
    if (y + h > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage();
      y = 18;
      if (!header)
        drawRow(
          columns.map((c) => c.toUpperCase()),
          true,
        );
    }
    doc.setFillColor(header ? '#eeedf8' : '#f8f9fb');
    doc.rect(14, y, width - 28, h, 'F');
    doc.setTextColor(header ? '#37345f' : '#454b5b');
    lines.forEach((text, i) => doc.text(text, 17 + i * colWidth, y + 6));
    y += h + 1;
  };
  drawRow(
    columns.map((c) => c.toUpperCase()),
    true,
  );
  records.forEach((row) => drawRow(columns.map((c) => String(row[c] ?? ''))));
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(
      `Page ${page} of ${doc.getNumberOfPages()} | ${scope}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }
  return doc.output('blob');
}
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

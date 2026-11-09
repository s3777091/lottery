import { load } from '@/lib/store';
import ExcelJS from 'exceljs';
import { requestUser } from '@/lib/auth';
import { audit } from '@/lib/db';

const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get('format') || 'csv';
  if (format !== 'csv' && format !== 'xlsx') return new Response('Unsupported export format', { status: 400 });
  const s = await load();
  await audit(requestUser(request), 'export', { format, list: s.mode });
  const suffix = s.mode === 'test' ? '-thu' : '';
  const rows = [['STT', 'Họ và Tên', 'English Name', 'Phòng Ban', 'Phần thưởng', 'Thời gian']];
  s.winners.forEach((w) => {
    rows.push([String(rows.length), w.name, w.englishName, w.department, w.prizeDescription || '', new Date(w.time).toLocaleString('vi-VN')]);
  });
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách trúng giải');
    sheet.addRows(rows);
    sheet.columns = [8, 28, 28, 24, 40, 24].map((width) => ({ width }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = 'A1:F1';
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="danh-sach-trung-giai${suffix}.xlsx"`,
      },
    });
  }
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="danh-sach-trung-giai${suffix}.csv"`,
    },
  });
}

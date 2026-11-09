/** Client-side parsing of participant lists from .xlsx / .csv / .tsv / .txt files. */
export interface Table {
  headers: string[];
  rows: string[][];
}

function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = ['\t', ';', ','].reduce((best, d) => (first.split(d).length > first.split(best).length ? d : best), ',');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const HEADER_HINT = /(họ|tên|name|mã|code|phòng|ban|bộ phận|department|email|stt|chức|team)/i;

export async function parseFile(file: File): Promise<Table> {
  let raw: string[][];
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    const data = await readSheet(file);
    raw = data.map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? c.toLocaleDateString('vi-VN') : String(c))));
  } else if (/\.xls$/i.test(file.name)) {
    throw new Error('File .xls (Excel 97-2003) chưa hỗ trợ — hãy "Lưu thành" .xlsx hoặc .csv.');
  } else {
    raw = parseDelimited(await file.text());
  }
  raw = raw.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
  if (!raw.length) return { headers: [], rows: [] };
  const width = Math.max(...raw.map((r) => r.length));
  raw = raw.map((r) => [...r, ...Array(width - r.length).fill('')]);
  const looksHeader = raw[0].some((c) => HEADER_HINT.test(c)) && raw.length > 1;
  const headers = looksHeader ? raw[0].map((h, i) => h || `Cột ${i + 1}`) : raw[0].map((_, i) => `Cột ${i + 1}`);
  return { headers, rows: looksHeader ? raw.slice(1) : raw };
}

/** Guess which column holds the person's name. */
export function guessNameColumn(t: Table): number {
  const byHeader = t.headers.findIndex((h) => /(họ\s*(và)?\s*tên|full\s*name|^tên$|^name$|tên nhân viên|họ tên)/i.test(h));
  if (byHeader >= 0) return byHeader;
  // otherwise: the column with the most multi-word, non-numeric values
  let best = 0, score = -1;
  t.headers.forEach((_, i) => {
    const s = t.rows.slice(0, 50).filter((r) => /\D/.test(r[i]) && r[i].trim().split(/\s+/).length >= 2).length;
    if (s > score) { score = s; best = i; }
  });
  return best;
}

export function guessEnglishNameColumn(t: Table): number {
  return t.headers.findIndex((h) => /^(english[ _-]*name|tên tiếng anh)$/i.test(h.trim()));
}

export function guessDepartmentColumn(t: Table): number {
  return t.headers.findIndex((h) => /^(phòng\s*ban|bộ phận|department|team)$/i.test(h.trim()));
}

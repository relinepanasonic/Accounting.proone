// Convert "06 Jan 2026" → "2026-01-06"
export function parseBankDate(dateStr: string): string {
  // English and Indonesian spellings (Jago writes "Agt" for August; older statements use "Peb", "Nop").
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', peb: '02', mar: '03', apr: '04',
    mei: '05', may: '05', jun: '06', jul: '07',
    agt: '08', agu: '08', ags: '08', aug: '08', sep: '09', okt: '10', oct: '10',
    nov: '11', nop: '11', des: '12', dec: '12',
  };
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length !== 3) return dateStr;
  const day = parts[0].padStart(2, '0');
  const monthKey = parts[1].toLowerCase().substring(0, 3);
  const month = monthMap[monthKey];
  // Never guess: an unknown month used to become January silently.
  if (!month) return dateStr;
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

// Parse Indonesian number format "1.311.000" or "-1.311.000" or "16.338.930,32"
export function parseIndonesianNumber(s: string): number {
  if (!s) return NaN;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

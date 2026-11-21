const DANGEROUS_CSV_PREFIX = /^[\s]*[=+\-@]/;

export function neutralizeCsvCell(
  raw: string | number | null | undefined
): string {
  if (raw === null || raw === undefined) return "";
  const text = String(raw);
  if (DANGEROUS_CSV_PREFIX.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function escapeCsvField(
  raw: string | number | null | undefined
): string {
  const safe = neutralizeCsvCell(raw);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function serializeRowsToSafeCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>
): string {
  const headerLine = headers.map((h) => escapeCsvField(h)).join(",");
  const bodyLines = rows.map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(",")
  );
  return [headerLine, ...bodyLines].join("\r\n");
}

export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (ch === "\r" && next === "\n") {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      i += 1;
    } else if (ch === "\n") {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

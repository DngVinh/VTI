const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

export const sanitizeFormulaInjection = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  const firstChar = value.charAt(0);
  if (FORMULA_TRIGGERS.includes(firstChar)) {
    return `'${value}`;
  }
  return value;
};

export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = sanitizeFormulaInjection(String(value));
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const formatCsvRow = (row: readonly unknown[]): string =>
  row.map(escapeCsvCell).join(',');

export const parseCsvString = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

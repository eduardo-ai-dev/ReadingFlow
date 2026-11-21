export function stripIsbnFormatting(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export function computeIsbn13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(twelveDigits[i]);
    const weight = i % 2 === 0 ? 1 : 3;
    sum += digit * weight;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

export function isValidIsbn13(raw: string): boolean {
  const cleaned = stripIsbnFormatting(raw);
  if (!/^[0-9]{13}$/.test(cleaned)) {
    return false;
  }
  return computeIsbn13CheckDigit(cleaned.slice(0, 12)) === cleaned[12];
}

export function isValidIsbn10(raw: string): boolean {
  const cleaned = stripIsbnFormatting(raw);
  if (!/^[0-9]{9}[0-9X]$/.test(cleaned)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cleaned[i]) * (10 - i);
  }
  const lastValue = cleaned[9] === "X" ? 10 : Number(cleaned[9]);
  sum += lastValue;
  return sum % 11 === 0;
}

export function normalizeToIsbn13(raw: string): string | null {
  const cleaned = stripIsbnFormatting(raw);
  if (cleaned.length === 13) {
    return isValidIsbn13(cleaned) ? cleaned : null;
  }
  if (cleaned.length === 10 && isValidIsbn10(cleaned)) {
    const prefixAndStem = `978${cleaned.slice(0, 9)}`;
    return `${prefixAndStem}${computeIsbn13CheckDigit(prefixAndStem)}`;
  }
  return null;
}

export function isBrazilianIsbn13(isbn13: string): boolean {
  const normalized = normalizeToIsbn13(isbn13);
  if (!normalized) {
    return false;
  }
  return normalized.startsWith("97885") || normalized.startsWith("97865");
}

import { createHash } from 'node:crypto';

type CanonicalPrimitive = string | number | boolean | null;
type CanonicalValue = CanonicalPrimitive | CanonicalValue[] | { [key: string]: CanonicalValue };

export const normalizeCanonicalString = (value: string): string =>
  value.replace(/\r\n?/g, '\n').normalize('NFC');

const toCanonicalValue = (value: unknown, seen: WeakSet<object>): CanonicalValue => {
  if (value === null) return null;
  if (typeof value === 'string') return normalizeCanonicalString(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? null
        : toCanonicalValue(item, seen)
    );
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new TypeError('Không thể canonicalize dữ liệu có vòng tham chiếu');
    }
    seen.add(value);

    const record = value as Record<string, unknown>;
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        continue;
      }
      result[normalizeCanonicalString(key)] = toCanonicalValue(item, seen);
    }

    seen.delete(value);
    return result;
  }

  return null;
};

export const canonicalJsonStringify = (value: unknown): string =>
  JSON.stringify(toCanonicalValue(value, new WeakSet<object>()));

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const createContentHash = (content: unknown): string =>
  sha256Hex(canonicalJsonStringify(content));

export const normalizePromptFingerprint = (
  prompt: { vi?: string | null; en?: string | null }
): string | null => {
  const vi = prompt.vi?.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('vi').normalize('NFC') ?? '';
  const en = prompt.en?.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en').normalize('NFC') ?? '';
  if (!vi && !en) return null;
  return createContentHash({ en, vi });
};


/**
 * 品番コードユーティリティ
 * 全角→半角変換、正規化、検索クエリ生成を集約
 */

/** 全角ASCII→半角ASCII変換（例: ＴＦ２４０８ → TF2408） */
export const toHalfWidth = (value: string): string =>
  String(value || '')
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');

/** 品番入力の正規化（全角→半角 + trim） */
export const normalizeProductCodeInput = (value: string): string =>
  toHalfWidth(value).trim();

/** 品番の正規化（比較用: 大文字 + 記号除去） */
export const canonicalizeProductCode = (value: string): string =>
  normalizeProductCodeInput(value)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');

/**
 * 品番検索クエリの生成
 * 表記ゆれパターン（TF2408 ↔ TF-2408）を考慮して複数クエリを生成
 */
export const buildProductSearchQueries = (value: string): string[] => {
  const raw = normalizeProductCodeInput(value);
  const compact = raw.replace(/\s+/g, '');
  const upper = compact.toUpperCase();

  const queries: string[] = [];
  const push = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (queries.includes(trimmed)) return;
    queries.push(trimmed);
  };

  push(upper);

  // TF2408 -> TF-2408
  const m = upper.match(/^([A-Z]{2})(\d{3,})$/);
  if (m) push(`${m[1]}-${m[2]}`);

  // TF-2408 -> TF2408
  const m2 = upper.match(/^([A-Z]{2})-(\d{3,})$/);
  if (m2) push(`${m2[1]}${m2[2]}`);

  return queries;
};

/** 全角数字を含む文字列から非負整数をパース */
export const parseNonNegativeIntFromInput = (value: string): number => {
  const normalized = toHalfWidth(value).replace(/[^\d]/g, '');
  if (!normalized) return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

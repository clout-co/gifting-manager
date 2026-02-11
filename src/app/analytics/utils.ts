type TooltipValue = unknown;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value || 0);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value || 0).toFixed(1)}%`;
}

function coerceNumber(value: TooltipValue): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatTooltipValue(value: TooltipValue, mode: 'currency' | 'number'): string {
  const numeric = coerceNumber(value);
  if (numeric === null) return value === undefined || value === null ? '' : String(value);
  return mode === 'currency' ? formatCurrency(numeric) : formatNumber(numeric);
}


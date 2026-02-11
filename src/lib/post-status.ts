/**
 * 投稿ステータス計算ユーティリティ
 *
 * セール日と投稿希望日の関係から自動的にステータスを判定
 */

// 投稿ステータスの範囲定義
export const POST_STATUS_RANGES = [
  { maxDays: -14, label: 'セール2週間以上前' },
  { maxDays: -7, label: 'セール2週間前' },
  { maxDays: -1, label: 'セール1週間前' },
  { maxDays: 0, label: 'セール当日' },
  { maxDays: 3, label: 'セール3日以内' },
  { maxDays: 7, label: 'セール1週間以内' },
  { maxDays: 14, label: 'セール2週間以内' },
  { maxDays: 21, label: 'セール3週間以内' },
  { maxDays: 30, label: 'セール1ヶ月以内' },
  { maxDays: 60, label: 'セール2ヶ月以内' },
] as const;

/**
 * 投稿ステータスを計算
 */
export function calculatePostStatus(
  saleDate: string,
  postDate: string,
  desiredDate: string,
  desiredStart: string,
  desiredEnd: string
): string {
  // セール日がなければ空
  if (!saleDate) return '';

  // 投稿済みの場合
  if (postDate) return '投稿済み';

  // 対象日を決定
  const targetDateStr = desiredDate || desiredStart;
  if (!targetDateStr) return '';

  const sale = new Date(saleDate);
  const target = new Date(targetDateStr);

  // 日数差を計算（負数=セール前、正数=セール後）
  const daysDiff = Math.floor((target.getTime() - sale.getTime()) / (1000 * 60 * 60 * 24));

  // 範囲に基づいてステータスを判定
  for (const range of POST_STATUS_RANGES) {
    if (daysDiff <= range.maxDays) {
      return range.label;
    }
  }

  return 'セール2ヶ月以上後';
}

/**
 * セール日から推奨投稿日を計算（セール1週間前）
 */
export function suggestPostDate(saleDate: string): string {
  if (!saleDate) return '';

  const sale = new Date(saleDate);
  // セールの1週間前を推奨
  sale.setDate(sale.getDate() - 7);

  return sale.toISOString().split('T')[0];
}

/**
 * 投稿ステータスの色を取得
 */
export function getPostStatusColor(status: string): { bg: string; text: string } {
  if (status === '投稿済み') {
    return { bg: 'bg-green-100', text: 'text-green-700' };
  }
  if (status.includes('前')) {
    return { bg: 'bg-blue-100', text: 'text-blue-700' };
  }
  if (status === 'セール当日') {
    return { bg: 'bg-amber-100', text: 'text-amber-700' };
  }
  if (status.includes('以内')) {
    return { bg: 'bg-muted', text: 'text-foreground' };
  }
  return { bg: 'bg-muted', text: 'text-muted-foreground' };
}

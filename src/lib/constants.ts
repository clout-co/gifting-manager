// ==================== ステータス定義 ====================

export const CAMPAIGN_STATUS = {
  pending: 'pending',
  agree: 'agree',
  disagree: 'disagree',
  cancelled: 'cancelled',
  ignored: 'ignored',
} as const;

export type CampaignStatus = typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  pending: '保留',
  agree: '合意',
  disagree: '不合意',
  cancelled: 'キャンセル',
  ignored: '無視',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, { bg: string; text: string; border?: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  agree: { bg: 'bg-green-100', text: 'text-green-700' },
  disagree: { bg: 'bg-red-100', text: 'text-red-700' },
  cancelled: { bg: 'bg-muted', text: 'text-foreground' },
  ignored: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

// ==================== ランク定義 ====================

export const INFLUENCER_RANKS = ['S', 'A', 'B', 'C'] as const;
export type InfluencerRank = typeof INFLUENCER_RANKS[number];

export const RANK_COLORS: Record<InfluencerRank, { bg: string; text: string; gradient?: string }> = {
  S: {
    bg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    text: 'text-white',
    gradient: 'from-amber-400 to-yellow-500',
  },
  A: {
    bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
    text: 'text-white',
    gradient: 'from-purple-500 to-pink-500',
  },
  B: {
    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    text: 'text-white',
    gradient: 'from-blue-500 to-cyan-500',
  },
  C: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
  },
};

// ==================== ブランド定義 ====================

export const BRANDS = ['TL', 'BE', 'AM'] as const;
export type Brand = typeof BRANDS[number];

export const BRAND_COLORS: Record<Brand, { primary: string; secondary: string; text: string }> = {
  TL: {
    primary: 'bg-green-900',
    secondary: 'bg-green-50',
    text: 'text-green-800',
  },
  BE: {
    primary: 'bg-gray-600',
    secondary: 'bg-gray-50',
    text: 'text-gray-700',
  },
  AM: {
    primary: 'bg-red-900',
    secondary: 'bg-red-50',
    text: 'text-red-800',
  },
};

// ==================== チャートカラー ====================

export const CHART_COLORS = {
  primary: '#6366f1', // indigo-500
  secondary: '#8b5cf6', // purple-500
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  info: '#06b6d4', // cyan-500
  gray: '#6b7280', // gray-500
};

export const CHART_PALETTE = [
  '#374151', // gray-700
  '#6b7280', // gray-500
  '#9ca3af', // gray-400
  '#d1d5db', // gray-300
  '#e5e7eb', // gray-200
];

// ==================== 共通スタイル ====================

export const BUTTON_STYLES = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30',
  secondary: 'bg-white border border-border text-foreground hover:bg-muted',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
};

export const INPUT_STYLES = {
  base: 'w-full px-4 py-2.5 border border-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all',
  error: 'border-red-300 focus:ring-red-500 focus:border-red-500',
};

// ==================== スコア計算定数 ====================

export const SCORE_WEIGHTS = {
  consideration: 0.40, // 検討コメント
  engagement: 0.25, // エンゲージメント
  efficiency: 0.20, // コスト効率
  reliability: 0.15, // 納期遵守率
};

export const SCORE_THRESHOLDS = {
  S: 75,
  A: 55,
  B: 35,
  C: 0,
};

// ==================== 日付フォーマット ====================

export const DATE_FORMATS = {
  display: 'YYYY/MM/DD',
  input: 'YYYY-MM-DD',
  monthYear: 'YYYY年M月',
};

// ==================== ページネーション ====================

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
};

// ==================== キャッシュ関連 ====================

export const CACHE_CONSTANTS = {
  /** ブランドキャッシュの有効期間（ミリ秒） */
  BRAND_CACHE_DURATION_MS: 60 * 60 * 1000, // 1時間
  /** React QueryのデフォルトstaleTime */
  DEFAULT_STALE_TIME_MS: 2 * 60 * 1000, // 2分
};

// ==================== CSV/Excel関連 ====================

/** UTF-8 BOM（CSVエクスポート用） */
export const UTF8_BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);

// ==================== 支払いステータス定義 ====================

export const PAYMENT_STATUS = {
  unpaid: 'unpaid',
  approved: 'approved',
  paid: 'paid',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: '未払い',
  approved: '承認済み',
  paid: '支払い済み',
};

/** インボイス未登録時の控除率（消費税額の20% = 依頼額の2%） */
export const INVOICE_DEDUCTION_RATE = 0.02;

// ==================== 消費税計算（方法A: 税額先算・国税庁標準） ====================

/** 消費税率 */
export const TAX_RATE_NUMERATOR = 10;
export const TAX_RATE_DENOMINATOR = 110;

/**
 * 方法A（税額先算・国税庁標準）で税込金額から税抜金額を算出する。
 *
 * ステップ①  消費税額 = floor( 税込金額 × 10 ÷ 110 )
 * ステップ②  税抜金額 = 税込金額 − 消費税額
 *
 * @param taxIncluded 税込金額（整数）
 * @returns { taxExcluded: 税抜金額, tax: 消費税額 }
 */
export function calcTaxExcluded(taxIncluded: number): { taxExcluded: number; tax: number } {
  const n = Math.max(0, Math.round(taxIncluded));
  const tax = Math.floor(n * TAX_RATE_NUMERATOR / TAX_RATE_DENOMINATOR);
  return { taxExcluded: n - tax, tax };
}

/**
 * 税抜金額から税込金額を逆算する（検証・表示用）。
 * taxIncluded = Math.floor(taxExcluded × 110 / 100)  ← 端数切り捨て
 *
 * 数学的証明: calcTaxExcluded(N) で得られた taxExcluded に対し、
 * N*100/110 ≤ taxExcluded < N*100/110 + 1 が成立するため、
 * floor(taxExcluded * 110/100) = N（元の税込金額）が常に成立する。
 * ceil を使うと 5,001→4,547→5,002 のように1円多くなるケースがある。
 */
export function calcTaxIncluded(taxExcluded: number): number {
  return Math.floor(taxExcluded * TAX_RATE_DENOMINATOR / (TAX_RATE_DENOMINATOR - TAX_RATE_NUMERATOR));
}

/** よく使う税込金額のプリセット（QuickAmountButtons用） */
export const QUICK_TAX_INCLUDED_AMOUNTS = [3000, 5000, 10000, 20000];

// ==================== その他の定数 ====================

export const DEFAULT_SHIPPING_COST = 800;
export const DEFAULT_INTERNATIONAL_SHIPPING_COST = 2000;

export const COMMON_COUNTRIES = [
  '韓国', '中国', '台湾', '香港', 'タイ', 'シンガポール', 'マレーシア', 'フィリピン',
  'アメリカ', 'カナダ', 'イギリス', 'フランス', 'ドイツ', 'オーストラリア',
];

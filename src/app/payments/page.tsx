'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast, translateError } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import LoadingSpinner, { TableSkeleton } from '@/components/ui/LoadingSpinner';
import ErrorDisplay from '@/components/ui/ErrorDisplay';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  ExternalLink,
  CheckSquare,
  Square,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  MinusSquare,
  Loader2,
  Download,
  ShieldCheck,
  Undo2,
  UserCircle,
} from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { usePayments, useMarkPaid, type PaymentCampaign } from '@/hooks/useQueries';
import { INVOICE_DEDUCTION_RATE, calcTaxIncluded, PAYMENT_STATUS_LABELS } from '@/lib/constants';

// ---------- ヘルパー ----------

/** インボイス控除計算 */
function calculatePayment(agreedAmount: number, invoiceRegNumber: string | null) {
  const hasInvoice = Boolean(invoiceRegNumber?.trim());
  const deduction = hasInvoice ? 0 : Math.floor(agreedAmount * INVOICE_DEDUCTION_RATE);
  return { hasInvoice, deduction, netAmount: agreedAmount - deduction };
}

/** 金額表示 */
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/** 口座番号マスク（末尾4桁以外） */
function maskAccountNumber(num: string | null): string {
  if (!num) return '-';
  if (num.length <= 4) return num;
  return '*'.repeat(num.length - 4) + num.slice(-4);
}

/** インフルエンサー表示名 */
function getInfluencerDisplayName(inf: PaymentCampaign['influencer']): string {
  if (!inf) return '-';
  return inf.insta_name || inf.tiktok_name || '-';
}

/** インフルエンサーのSNS URL */
function getInfluencerUrl(inf: PaymentCampaign['influencer']): string | null {
  if (!inf) return null;
  return inf.insta_url || inf.tiktok_url || null;
}

/** ログインユーザーが案件の担当者（登録者）かどうか判定 */
function isOwnCampaign(campaign: PaymentCampaign, userEmail: string | undefined): boolean {
  if (!userEmail || !campaign.staff?.email) return false;
  return campaign.staff.email.toLowerCase() === userEmail.toLowerCase();
}

/** 担当者名の取得 */
function getStaffName(campaign: PaymentCampaign): string {
  return campaign.staff?.name || '-';
}

/** payment_status の正規化（null → 'unpaid'） */
function normalizeStatus(status: string | null | undefined): 'unpaid' | 'approved' | 'paid' {
  if (status === 'approved') return 'approved';
  if (status === 'paid') return 'paid';
  return 'unpaid';
}

/** ステータスラベル取得 */
function getStatusLabel(status: string | null | undefined): string {
  const s = normalizeStatus(status);
  return PAYMENT_STATUS_LABELS[s] || '未払い';
}

// ---------- ソート ----------

type SortKey = 'influencer' | 'item_code' | 'post_date' | 'agreed_amount' | 'deduction' | 'net_amount' | 'payment_status' | 'staff';
type SortDir = 'asc' | 'desc';
const EMPTY_PAYMENT_CAMPAIGNS: PaymentCampaign[] = [];

function getSortIcon(sortKey: SortKey | null, sortDir: SortDir, colKey: SortKey) {
  if (sortKey !== colKey) return <ArrowUpDown size={14} className="opacity-40" />;
  return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
}

// ---------- メインコンポーネント ----------

export default function PaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { currentBrand } = useBrand();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // フィルタ
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(
    () => searchParams.get('status') || 'unpaid'
  );
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');

  // ソート
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // 選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // データ取得
  const { data: paymentsData, isLoading, error: queryError, refetch } = usePayments(paymentStatusFilter);
  const markPaidMutation = useMarkPaid();

  const campaigns = paymentsData ?? EMPTY_PAYMENT_CAMPAIGNS;
  const error = queryError ? translateError(queryError) : null;
  const approverDisplayName = user?.name || user?.email || '';

  // URL同期
  const updateUrlParams = useCallback(
    (q: string, status: string) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status && status !== 'unpaid') params.set('status', status);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrlParams(searchTerm, paymentStatusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, paymentStatusFilter, updateUrlParams]);

  // フィルタ変更時に選択クリア
  useEffect(() => {
    setSelectedIds(new Set());
  }, [paymentStatusFilter, currentBrand]);

  // テキスト検索
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.toLowerCase();
    return campaigns.filter((c) => {
      const name = getInfluencerDisplayName(c.influencer).toLowerCase();
      const itemCode = (c.item_code || '').toLowerCase();
      const bankName = (c.influencer?.bank_name || '').toLowerCase();
      return name.includes(term) || itemCode.includes(term) || bankName.includes(term);
    });
  }, [campaigns, searchTerm]);

  // ソート
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'influencer':
          cmp = getInfluencerDisplayName(a.influencer).localeCompare(
            getInfluencerDisplayName(b.influencer)
          );
          break;
        case 'item_code':
          cmp = (a.item_code || '').localeCompare(b.item_code || '');
          break;
        case 'post_date':
          cmp = (a.post_date || '').localeCompare(b.post_date || '');
          break;
        case 'agreed_amount':
          cmp = a.agreed_amount - b.agreed_amount;
          break;
        case 'deduction': {
          const dA = calculatePayment(a.agreed_amount, a.influencer?.invoice_registration_number ?? null).deduction;
          const dB = calculatePayment(b.agreed_amount, b.influencer?.invoice_registration_number ?? null).deduction;
          cmp = dA - dB;
          break;
        }
        case 'net_amount': {
          const nA = calculatePayment(a.agreed_amount, a.influencer?.invoice_registration_number ?? null).netAmount;
          const nB = calculatePayment(b.agreed_amount, b.influencer?.invoice_registration_number ?? null).netAmount;
          cmp = nA - nB;
          break;
        }
        case 'staff':
          cmp = getStaffName(a).localeCompare(getStaffName(b));
          break;
        case 'payment_status':
          cmp = normalizeStatus(a.payment_status).localeCompare(normalizeStatus(b.payment_status));
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // ---------- 選択操作 ----------

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((c) => c.id)));
    }
  }, [sorted, selectedIds.size]);

  // ---------- ステータスアクション ----------

  async function handleAction(ids: string[], action: 'approve' | 'unapprove' | 'paid' | 'unpaid') {
    const actionLabels: Record<string, string> = {
      approve: '承認する',
      unapprove: '承認を取り消す',
      paid: '支払い済みにする',
      unpaid: '未払いに戻す',
    };
    const resultLabels: Record<string, string> = {
      approve: '承認済み',
      unapprove: '未払い',
      paid: '支払い済み',
      unpaid: '未払い',
    };
    const actionLabel = actionLabels[action];

    let message = `${ids.length}件の案件を${resultLabels[action]}にします。よろしいですか？`;
    if (action === 'approve') {
      message = `${ids.length}件の案件を承認します。\n\n※ 監査要件により、案件の登録者（担当者）本人のみ承認可能です。\n承認者として「${approverDisplayName}」が記録されます。`;
    }

    const confirmed = await confirm({
      title: actionLabel,
      message,
      type: action === 'unpaid' || action === 'unapprove' ? 'warning' : 'info',
      confirmText: actionLabel,
      cancelText: 'キャンセル',
    });
    if (!confirmed) return;

    try {
      const result = await markPaidMutation.mutateAsync({ ids, action });
      const msg = `${result.updated}件を${resultLabels[action]}に更新しました`;
      const skippedMsg = result.skipped && result.skipped > 0
        ? `（${result.skipped}件はステータス条件不一致のためスキップ）`
        : '';
      showToast('success', msg + skippedMsg);
      setSelectedIds(new Set());
    } catch (err) {
      showToast('error', translateError(err));
    }
  }

  // ---------- 集計 ----------

  const selectedCampaigns = useMemo(
    () => sorted.filter((c) => selectedIds.has(c.id)),
    [sorted, selectedIds]
  );

  const selectedTotal = useMemo(
    () =>
      selectedCampaigns.reduce((sum, c) => {
        const { netAmount } = calculatePayment(
          c.agreed_amount,
          c.influencer?.invoice_registration_number ?? null
        );
        return sum + netAmount;
      }, 0),
    [selectedCampaigns]
  );

  const grandTotal = useMemo(
    () =>
      sorted.reduce((sum, c) => {
        const { netAmount } = calculatePayment(
          c.agreed_amount,
          c.influencer?.invoice_registration_number ?? null
        );
        return sum + netAmount;
      }, 0),
    [sorted]
  );

  // ---------- ソートUI ----------

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ---------- ステータスタブ ----------

  const statusTabs = [
    { key: 'unpaid', label: '未払い' },
    { key: 'approved', label: '承認済み' },
    { key: 'paid', label: '支払い済み' },
    { key: 'all', label: 'すべて' },
  ];

  // ---------- CSVエクスポート ----------

  const handleExportCsv = useCallback(() => {
    if (sorted.length === 0) return;

    const target = selectedIds.size > 0 ? selectedCampaigns : sorted;
    const headers = [
      'インフルエンサー',
      '品番',
      '投稿日',
      '合意額(税抜)',
      '税込金額',
      'インボイス',
      '控除額',
      '支払金額',
      '担当者',
      '銀行名',
      '支店名',
      '口座種別',
      '口座番号',
      '口座名義',
      'ステータス',
      '承認者',
      '承認日時',
    ];
    const rows = target.map((c) => {
      const inf = c.influencer;
      const payment = calculatePayment(c.agreed_amount, inf?.invoice_registration_number ?? null);
      return [
        getInfluencerDisplayName(inf),
        c.item_code || '',
        c.post_date || '',
        c.agreed_amount,
        calcTaxIncluded(c.agreed_amount),
        payment.hasInvoice ? '登録済み' : '未登録',
        payment.deduction,
        payment.netAmount,
        getStaffName(c),
        inf?.bank_name || '',
        inf?.bank_branch || '',
        inf?.account_type || '',
        inf?.account_number || '',
        inf?.account_holder || '',
        getStatusLabel(c.payment_status),
        ((c as unknown as Record<string, unknown>).approved_by_email as string) || '',
        c.approved_at ? new Date(c.approved_at).toLocaleString('ja-JP') : '',
      ].join(',');
    });

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${currentBrand}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, selectedCampaigns, selectedIds.size, currentBrand]);

  // ---------- EmptyStateメッセージ ----------

  const emptyDescription = useMemo(() => {
    switch (paymentStatusFilter) {
      case 'unpaid': return '未払いの支払い対象案件はありません';
      case 'approved': return '承認済みの案件はありません';
      case 'paid': return '支払い済みの案件はありません';
      default: return '支払い対象の案件がありません';
    }
  }, [paymentStatusFilter]);

  // ---------- レンダリング ----------

  if (authLoading) {
    return (
      <MainLayout>
        <LoadingSpinner size="lg" fullScreen />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard size={24} />
              支払い管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              投稿確認済み・口座情報登録済みの有償案件
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={sorted.length === 0}
            >
              <Download size={16} className="mr-1" />
              CSV
              {selectedIds.size > 0 && ` (${selectedIds.size}件)`}
            </Button>
          </div>
        </div>

        {/* ステータスタブ + 検索 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPaymentStatusFilter(tab.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  paymentStatusFilter === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="インフルエンサー名、品番、金融機関..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* 一括アクションバー */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size}件選択中
            </span>
            <span className="text-sm text-muted-foreground">
              合計: {formatYen(selectedTotal)}
            </span>
            <div className="flex-1" />
            {/* 未払いタブ: 一括承認（自分の案件のみ） */}
            {paymentStatusFilter === 'unpaid' && (() => {
              const selectedCampaignsForApprove = sorted.filter((c) => selectedIds.has(c.id));
              const ownIds = selectedCampaignsForApprove
                .filter((c) => isOwnCampaign(c, user?.email))
                .map((c) => c.id);
              const othersCount = selectedCampaignsForApprove.length - ownIds.length;
              return (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAction(ownIds, 'approve')}
                    disabled={markPaidMutation.isPending || ownIds.length === 0}
                    title={ownIds.length === 0 ? '自分が担当者の案件が選択されていません' : undefined}
                  >
                    {markPaidMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
                    <ShieldCheck size={14} className="mr-1" />
                    一括承認する{ownIds.length < selectedCampaignsForApprove.length ? ` (${ownIds.length}件)` : ''}
                  </Button>
                  {othersCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ※他担当者の{othersCount}件は承認不可
                    </span>
                  )}
                </>
              );
            })()}
            {/* 承認済みタブ: 一括支払い済み + 一括承認取消 */}
            {paymentStatusFilter === 'approved' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleAction(Array.from(selectedIds), 'paid')}
                  disabled={markPaidMutation.isPending}
                >
                  {markPaidMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
                  一括支払い済みにする
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(Array.from(selectedIds), 'unapprove')}
                  disabled={markPaidMutation.isPending}
                >
                  <Undo2 size={14} className="mr-1" />
                  一括承認取消
                </Button>
              </>
            )}
            {/* 支払い済みタブ: 未払いに戻す */}
            {paymentStatusFilter === 'paid' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(Array.from(selectedIds), 'unpaid')}
                disabled={markPaidMutation.isPending}
              >
                未払いに戻す
              </Button>
            )}
            {/* すべてタブ: 各ステータスの選択状況に応じてボタン表示 */}
            {paymentStatusFilter === 'all' && (() => {
              const selected = sorted.filter((c) => selectedIds.has(c.id));
              const hasUnpaid = selected.some((c) => normalizeStatus(c.payment_status) === 'unpaid');
              const hasApproved = selected.some((c) => normalizeStatus(c.payment_status) === 'approved');
              const hasPaid = selected.some((c) => normalizeStatus(c.payment_status) === 'paid');
              const ownUnpaidIds = selected
                .filter((c) => normalizeStatus(c.payment_status) === 'unpaid' && isOwnCampaign(c, user?.email))
                .map((c) => c.id);
              return (
                <>
                  {hasUnpaid && (
                    <Button
                      size="sm"
                      onClick={() => handleAction(ownUnpaidIds, 'approve')}
                      disabled={markPaidMutation.isPending || ownUnpaidIds.length === 0}
                      title={ownUnpaidIds.length === 0 ? '自分が担当者の未払い案件が選択されていません' : undefined}
                    >
                      <ShieldCheck size={14} className="mr-1" />
                      承認する{ownUnpaidIds.length > 0 ? ` (${ownUnpaidIds.length}件)` : ''}
                    </Button>
                  )}
                  {hasApproved && (
                    <Button
                      size="sm"
                      variant={hasUnpaid ? 'outline' : 'default'}
                      onClick={() => handleAction(Array.from(selectedIds), 'paid')}
                      disabled={markPaidMutation.isPending}
                    >
                      支払い済みにする
                    </Button>
                  )}
                  {hasPaid && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(Array.from(selectedIds), 'unpaid')}
                      disabled={markPaidMutation.isPending}
                    >
                      未払いに戻す
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">対象件数</p>
            <p className="text-2xl font-bold mt-1">{sorted.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">合計支払額</p>
            <p className="text-2xl font-bold mt-1">{formatYen(grandTotal)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">インボイス登録済み</p>
            <p className="text-2xl font-bold mt-1">
              {sorted.filter((c) => Boolean(c.influencer?.invoice_registration_number?.trim())).length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">インボイス未登録</p>
            <p className="text-2xl font-bold mt-1">
              {sorted.filter((c) => !c.influencer?.invoice_registration_number?.trim()).length}
            </p>
          </div>
        </div>

        {/* エラー表示 */}
        {error && <ErrorDisplay message={error} onRetry={() => refetch()} />}

        {/* テーブル */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={10} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="対象案件がありません"
            description={emptyDescription}
          />
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {/* チェックボックス */}
                    <th className="w-10 px-3 py-3">
                      <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                        {selectedIds.size === sorted.length && sorted.length > 0 ? (
                          <CheckSquare size={18} />
                        ) : selectedIds.size > 0 ? (
                          <MinusSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => handleSort('influencer')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                        インフルエンサー {getSortIcon(sortKey, sortDir, 'influencer')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => handleSort('item_code')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                        品番 {getSortIcon(sortKey, sortDir, 'item_code')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => handleSort('post_date')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                        投稿日 {getSortIcon(sortKey, sortDir, 'post_date')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right">
                      <button onClick={() => handleSort('agreed_amount')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto">
                        合意額(税抜) {getSortIcon(sortKey, sortDir, 'agreed_amount')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground">税込</th>
                    <th className="px-3 py-3 text-right">
                      <button onClick={() => handleSort('deduction')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto">
                        控除額 {getSortIcon(sortKey, sortDir, 'deduction')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right">
                      <button onClick={() => handleSort('net_amount')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto">
                        支払金額 {getSortIcon(sortKey, sortDir, 'net_amount')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center font-medium text-muted-foreground">インボイス</th>
                    <th className="px-3 py-3 text-left">
                      <button onClick={() => handleSort('staff')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                        担当者 {getSortIcon(sortKey, sortDir, 'staff')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">振込先</th>
                    <th className="px-3 py-3 text-center font-medium text-muted-foreground">投稿</th>
                    <th className="px-3 py-3 text-center">
                      <button onClick={() => handleSort('payment_status')} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground mx-auto">
                        ステータス {getSortIcon(sortKey, sortDir, 'payment_status')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-center font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((campaign) => {
                    const inf = campaign.influencer;
                    const payment = calculatePayment(
                      campaign.agreed_amount,
                      inf?.invoice_registration_number ?? null
                    );
                    const status = normalizeStatus(campaign.payment_status);
                    const isSelected = selectedIds.has(campaign.id);
                    const influencerUrl = getInfluencerUrl(inf);

                    return (
                      <tr
                        key={campaign.id}
                        className={`border-b last:border-b-0 transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        {/* チェックボックス */}
                        <td className="px-3 py-3">
                          <button
                            onClick={() => toggleSelect(campaign.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-primary" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                        </td>

                        {/* インフルエンサー */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {influencerUrl ? (
                              <a
                                href={influencerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium truncate max-w-[160px]"
                              >
                                {getInfluencerDisplayName(inf)}
                              </a>
                            ) : (
                              <span className="font-medium truncate max-w-[160px]">
                                {getInfluencerDisplayName(inf)}
                              </span>
                            )}
                          </div>
                          {inf?.real_name && (
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {inf.real_name}
                            </p>
                          )}
                        </td>

                        {/* 品番 */}
                        <td className="px-3 py-3 text-muted-foreground">{campaign.item_code || '-'}</td>

                        {/* 投稿日 */}
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {campaign.post_date
                            ? new Date(campaign.post_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
                            : '-'}
                        </td>

                        {/* 合意額(税抜) */}
                        <td className="px-3 py-3 text-right font-mono">
                          {formatYen(campaign.agreed_amount)}
                        </td>

                        {/* 税込 */}
                        <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                          {formatYen(calcTaxIncluded(campaign.agreed_amount))}
                        </td>

                        {/* 控除額 */}
                        <td className="px-3 py-3 text-right font-mono">
                          {payment.deduction > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              -{formatYen(payment.deduction)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">¥0</span>
                          )}
                        </td>

                        {/* 支払金額 */}
                        <td className="px-3 py-3 text-right font-mono font-semibold">
                          {formatYen(payment.netAmount)}
                        </td>

                        {/* インボイス */}
                        <td className="px-3 py-3 text-center">
                          {payment.hasInvoice ? (
                            <Badge variant="success" className="text-xs">登録済み</Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs">未登録</Badge>
                          )}
                        </td>

                        {/* 担当者 */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <UserCircle size={14} className={
                              isOwnCampaign(campaign, user?.email)
                                ? 'text-primary'
                                : 'text-muted-foreground'
                            } />
                            <span className={`text-xs ${
                              isOwnCampaign(campaign, user?.email)
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                            }`}>
                              {getStaffName(campaign)}
                            </span>
                          </div>
                          {isOwnCampaign(campaign, user?.email) && (
                            <span className="text-[10px] text-primary ml-4">本人</span>
                          )}
                        </td>

                        {/* 振込先 */}
                        <td className="px-3 py-3">
                          {inf?.bank_name ? (
                            <div className="text-xs space-y-0.5">
                              <p className="font-medium">{inf.bank_name}</p>
                              <p className="text-muted-foreground">
                                {inf.bank_branch} / {inf.account_type || '普通'}{' '}
                                {maskAccountNumber(inf.account_number)}
                              </p>
                              <p className="text-muted-foreground">{inf.account_holder}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>

                        {/* 投稿 */}
                        <td className="px-3 py-3 text-center">
                          {campaign.post_url ? (
                            <a
                              href={campaign.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:text-primary/80"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* ステータス */}
                        <td className="px-3 py-3 text-center">
                          {status === 'paid' ? (
                            <Badge variant="success" className="text-xs">支払い済み</Badge>
                          ) : status === 'approved' ? (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400">
                              <ShieldCheck size={12} className="mr-0.5" />
                              承認済み
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs">未払い</Badge>
                          )}
                        </td>

                        {/* 操作 */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {status === 'unpaid' && (
                              isOwnCampaign(campaign, user?.email) ? (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAction([campaign.id], 'approve')}
                                  disabled={markPaidMutation.isPending}
                                  className="text-xs"
                                >
                                  <ShieldCheck size={14} className="mr-1" />
                                  承認する
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground text-center leading-tight" title="案件の登録者（担当者）本人のみ承認可能です">
                                  担当者本人のみ<br />承認可能
                                </span>
                              )
                            )}
                            {status === 'approved' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAction([campaign.id], 'paid')}
                                  disabled={markPaidMutation.isPending}
                                  className="text-xs"
                                >
                                  支払い済み
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAction([campaign.id], 'unapprove')}
                                  disabled={markPaidMutation.isPending}
                                  className="text-xs text-muted-foreground"
                                >
                                  <Undo2 size={12} className="mr-0.5" />
                                  承認取消
                                </Button>
                              </>
                            )}
                            {status === 'paid' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAction([campaign.id], 'unpaid')}
                                disabled={markPaidMutation.isPending}
                                className="text-xs"
                              >
                                未払いに戻す
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* テーブルフッター */}
            <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between text-sm text-muted-foreground">
              <span>{sorted.length}件表示</span>
              <span>合計支払額: {formatYen(grandTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

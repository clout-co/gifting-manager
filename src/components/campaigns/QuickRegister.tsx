'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, Zap, Send } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/hooks/useAuth';
import { useInfluencers, useStaffs, useBulkCreateCampaigns, type BulkCreateItem } from '@/hooks/useQueries';
import { useProductSearch, type MasterProduct } from '@/hooks/useProductSearch';
import { useToast, translateError } from '@/lib/toast';
import SearchableSelect, { type SearchableOption } from '@/components/ui/SearchableSelect';
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from '@/lib/constants';

interface QuickRegisterProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type QueueItem = {
  tempId: string;
  influencer_id: string;
  influencer_name: string;
  item_code: string;
  product_cost: number;
  agreed_amount: number;
  status: string;
  staff_id: string;
  staff_name: string;
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

export default function QuickRegister({ isOpen, onClose, onCreated }: QuickRegisterProps) {
  const { currentBrand } = useBrand();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: influencers = [] } = useInfluencers();
  const { data: staffs = [] } = useStaffs();
  const bulkCreateMutation = useBulkCreateCampaigns();

  // Form state
  const [influencerId, setInfluencerId] = useState('');
  const [itemCodeQuery, setItemCodeQuery] = useState('');
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [agreedAmount, setAgreedAmount] = useState('');
  const [status, setStatus] = useState<string>('pending');
  const [staffId, setStaffId] = useState('');

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product search
  const productSearch = useProductSearch({
    query: itemCodeQuery,
    brand: currentBrand,
  });

  // Auto-select current user as staff
  useEffect(() => {
    if (staffId) return;
    const email = user?.email || '';
    if (!email || staffs.length === 0) return;
    const me = staffs.find((s) => (s.email || '').toLowerCase() === email.toLowerCase());
    if (me) setStaffId(me.id);
  }, [staffs, user?.email, staffId]);

  // Influencer options
  const influencerOptions: SearchableOption[] = influencers.map((inf) => {
    const handle = inf.insta_name || inf.tiktok_name;
    return {
      value: inf.id,
      label: handle ? `@${handle}` : '不明',
      keywords: [inf.insta_name, inf.tiktok_name].filter(Boolean) as string[],
    };
  });

  // Product options
  const productOptions: SearchableOption<MasterProduct>[] = productSearch.products.map((p) => ({
    value: p.product_code,
    label: p.product_code,
    description: p.product_name || undefined,
    meta: typeof p.cost === 'number' ? `¥${p.cost.toLocaleString()}` : '原価未登録',
    data: p,
  }));

  // Staff options
  const staffOptions: SearchableOption[] = staffs.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.email || undefined,
  }));

  const getInfluencerName = useCallback((id: string) => {
    const inf = influencers.find((i) => i.id === id);
    return inf ? `@${inf.insta_name || inf.tiktok_name || '不明'}` : '不明';
  }, [influencers]);

  const getStaffName = useCallback((id: string) => {
    const s = staffs.find((st) => st.id === id);
    return s?.name || '未設定';
  }, [staffs]);

  const resetForm = useCallback(() => {
    setInfluencerId('');
    setItemCodeQuery('');
    setSelectedItemCode('');
    setAgreedAmount('');
    setStatus('pending');
    productSearch.resetResolved();
    // staff_id は維持
  }, [productSearch]);

  const canAddToQueue =
    influencerId &&
    selectedItemCode &&
    productSearch.isResolved &&
    Number(agreedAmount) >= 0;

  const addToQueue = useCallback(() => {
    if (!canAddToQueue) return;

    const item: QueueItem = {
      tempId: crypto.randomUUID(),
      influencer_id: influencerId,
      influencer_name: getInfluencerName(influencerId),
      item_code: productSearch.resolvedProductCode || selectedItemCode,
      product_cost: productSearch.resolvedProduct?.cost != null ? Math.round(productSearch.resolvedProduct.cost) : 0,
      agreed_amount: Number(agreedAmount) || 0,
      status,
      staff_id: staffId,
      staff_name: getStaffName(staffId),
    };

    setQueue((prev) => [...prev, item]);
    resetForm();
  }, [canAddToQueue, influencerId, selectedItemCode, agreedAmount, status, staffId, productSearch, getInfluencerName, getStaffName, resetForm]);

  const removeFromQueue = useCallback((tempId: string) => {
    setQueue((prev) => prev.filter((item) => item.tempId !== tempId));
  }, []);

  const submitAll = useCallback(async () => {
    if (queue.length === 0) return;
    setIsSubmitting(true);
    try {
      const items: BulkCreateItem[] = queue.map((q) => ({
        influencer_id: q.influencer_id,
        item_code: q.item_code,
        agreed_amount: q.agreed_amount,
        status: q.status,
        staff_id: q.staff_id,
        sale_date: getTodayDate(),
        shipping_cost: 800,
      }));
      const result = await bulkCreateMutation.mutateAsync(items);
      const successCount = result.created?.length || 0;
      const errorCount = result.errors?.length || 0;
      if (successCount > 0) {
        showToast('success', `${successCount}件の案件を登録しました${errorCount > 0 ? `（${errorCount}件失敗）` : ''}`);
        setQueue([]);
        onCreated();
      } else {
        showToast('error', `登録に失敗しました: ${result.errors?.map((e: { error: string }) => e.error).join(', ')}`);
      }
    } catch (err) {
      showToast('error', translateError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [queue, bulkCreateMutation, showToast, onCreated]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-emerald-500" />
            <h2 className="text-lg font-bold text-foreground">クイック案件登録</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Influencer */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">インフルエンサー *</label>
            <SearchableSelect
              value={influencerId}
              onChange={(v) => setInfluencerId(v)}
              options={influencerOptions}
              placeholder="選択してください"
              searchPlaceholder="名前で検索..."
              emptyText="該当なし"
              recentKey={`ggcrm_quick_reg_inf_${currentBrand}`}
              required
            />
          </div>

          {/* Item Code */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">品番 *</label>
            <SearchableSelect
              value={selectedItemCode}
              onChange={(v, opt) => {
                setSelectedItemCode(v);
                const product = (opt as SearchableOption<MasterProduct> | undefined)?.data;
                if (product) {
                  productSearch.selectProduct(product);
                }
              }}
              options={productOptions}
              placeholder="品番を入力"
              searchPlaceholder="2文字以上で検索..."
              emptyText={productSearch.isLoading ? '検索中...' : productSearch.error || '該当なし'}
              loading={productSearch.isLoading}
              query={itemCodeQuery}
              onQueryChange={setItemCodeQuery}
              minQueryLength={2}
              required
            />
            {productSearch.isResolved && (
              <p className="text-xs text-emerald-500 mt-1">
                {productSearch.resolvedProductCode}
                {productSearch.hasCost ? ` (原価 ¥${productSearch.resolvedProduct?.cost?.toLocaleString()})` : ' (原価未登録)'}
              </p>
            )}
          </div>

          {/* Agreed Amount */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">合意額</label>
            <input
              type="number"
              value={agreedAmount}
              onChange={(e) => setAgreedAmount(e.target.value)}
              className="input-field text-sm"
              placeholder="¥0"
              min={0}
            />
            {/* Quick amount buttons */}
            <div className="flex gap-1.5 mt-1.5">
              {[5000, 10000, 30000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAgreedAmount(String(amt))}
                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  ¥{(amt / 1000)}k
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field text-sm"
            >
              {Object.entries(CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Staff */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">担当者</label>
            <SearchableSelect
              value={staffId}
              onChange={(v) => setStaffId(v)}
              options={staffOptions}
              placeholder="選択してください"
              searchPlaceholder="名前で検索..."
              emptyText="該当なし"
            />
          </div>

          {/* Add to queue button */}
          <button
            type="button"
            onClick={addToQueue}
            disabled={!canAddToQueue}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
            キューに追加
          </button>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">登録キュー ({queue.length}件)</h3>
              </div>
              <div className="space-y-2">
                {queue.map((item, idx) => (
                  <div
                    key={item.tempId}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                        <span className="font-medium text-foreground truncate">{item.influencer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{item.item_code}</span>
                        <span>·</span>
                        <span>¥{item.agreed_amount.toLocaleString()}</span>
                        <span>·</span>
                        <span>{CAMPAIGN_STATUS_LABELS[item.status as CampaignStatus] || item.status}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromQueue(item.tempId)}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Submit */}
        {queue.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={submitAll}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {queue.length}件を一括登録
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              セール日=当日 / 送料=¥800 で自動設定されます
            </p>
          </div>
        )}
      </div>
    </>
  );
}

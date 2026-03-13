import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useBrand } from '@/contexts/BrandContext';
import { Campaign, Influencer, Staff } from '@/types';
import {
  calculateInfluencerScore,
  calculateStatsFromCampaigns,
  type InfluencerRank,
} from '@/lib/scoring';
import { redirectToCloutSignIn } from '@/lib/clout-auth';
import {
  influencerMatchesQuery,
  type SelectableInfluencer,
} from '@/lib/influencer-search';

const IS_E2E =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_E2E === 'true';

const E2E_NOW = new Date('2026-02-06T00:00:00.000Z').toISOString();

const E2E_INFLUENCER_NULLS = {
  real_name: null, postal_code: null, address: null, phone: null, email: null,
  bank_name: null, bank_branch: null, bank_code: null, branch_code: null, account_type: null, account_number: null, account_holder: null,
  invoice_registration_number: null, invoice_acknowledged: false,
  form_token: null, form_token_expires_at: null, form_token_used_at: null,
} as const;

const E2E_INFLUENCERS_BY_BRAND: Record<string, Influencer[]> = {
  TL: [
    {
      id: 'e2e-influencer-tl',
      insta_name: 'e2e_insta',
      insta_url: null,
      tiktok_name: null,
      tiktok_url: null,
      ...E2E_INFLUENCER_NULLS,
      brand: 'TL',
      created_at: E2E_NOW,
      updated_at: E2E_NOW,
    },
  ],
  BE: [
    {
      id: 'e2e-influencer-be',
      insta_name: 'e2e_insta_be',
      insta_url: null,
      tiktok_name: null,
      tiktok_url: null,
      ...E2E_INFLUENCER_NULLS,
      brand: 'BE',
      created_at: E2E_NOW,
      updated_at: E2E_NOW,
    },
  ],
  AM: [
    {
      id: 'e2e-influencer-am',
      insta_name: 'e2e_insta_am',
      insta_url: null,
      tiktok_name: null,
      tiktok_url: null,
      ...E2E_INFLUENCER_NULLS,
      brand: 'AM',
      created_at: E2E_NOW,
      updated_at: E2E_NOW,
    },
  ],
};

/** 401/403 を示すエラー。React Query のリトライをスキップするために使う */
class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** 再認証リダイレクトの多重発火を防ぐフラグ */
let isRedirecting = false;

async function fetchApiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 認証切れ → 自動的に再認証フローへリダイレクト
    if (response.status === 401 || response.status === 403) {
      if (!isRedirecting) {
        isRedirecting = true;
        redirectToCloutSignIn();
      }
      throw new AuthError('認証の有効期限が切れました', response.status);
    }

    const message =
      data && typeof data.error === 'string'
        ? data.error
        : `API request failed (${response.status})`;
    const reason = data && typeof data.reason === 'string' ? data.reason : '';
    throw new Error(reason ? `${message} (${reason})` : message);
  }

  return data as T;
}

// Query Keys
export const queryKeys = {
  campaigns: (brand: string) => ['campaigns', brand] as const,
  campaign: (id: string) => ['campaign', id] as const,
  influencers: (brand: string) => ['influencers', brand] as const,
  influencerSearch: (brand: string, query: string) => ['influencerSearch', brand, query] as const,
  influencer: (id: string) => ['influencer', id] as const,
  staffs: (brand: string) => ['staffs', brand] as const,
  dashboardStats: (brand: string) => ['dashboardStats', brand] as const,
  payments: (brand: string, status: string) => ['payments', brand, status] as const,
};

// ==================== Campaigns ====================

export function useCampaigns() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.campaigns(currentBrand),
    queryFn: async () => {
      if (IS_E2E) {
        return [] as (Campaign & {
          influencer: { id: string; brand: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
          staff: { id: string; name: string } | null;
        })[];
      }

      const data = await fetchApiJson<{
        campaigns: (Campaign & {
          influencer: { id: string; brand: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
          staff: { id: string; name: string } | null;
        })[]
      }>(`/api/campaigns?brand=${encodeURIComponent(currentBrand)}`)

      return (data.campaigns || []) as (Campaign & {
        influencer: { id: string; brand: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
        staff: { id: string; name: string } | null;
      })[];
    },
    staleTime: 5 * 60 * 1000, // 5分
  });
}

export function useCampaign(id: string) {
  const { currentBrand } = useBrand();
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: async () => {
      const data = await fetchApiJson<{ campaign: Campaign | null }>(
        `/api/campaigns/${encodeURIComponent(id)}?brand=${encodeURIComponent(currentBrand)}`
      )
      return data.campaign;
    },
    enabled: !!id,
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `削除に失敗しました (${response.status})`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
    },
  });
}

// ==================== Influencers ====================

export function useInfluencers() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.influencers(currentBrand),
    queryFn: async () => {
      if (IS_E2E) {
        return (E2E_INFLUENCERS_BY_BRAND[currentBrand] || E2E_INFLUENCERS_BY_BRAND.TL || []) as Influencer[];
      }

      const data = await fetchApiJson<{ influencers: Influencer[] }>(
        `/api/influencers?brand=${encodeURIComponent(currentBrand)}`
      )
      return data.influencers || [];
    },
    staleTime: 5 * 60 * 1000, // 5分（インフルエンサーはあまり変更されない）
  });
}

export type InfluencerSearchResult = SelectableInfluencer;

export function useInfluencerSearch(query: string) {
  const { currentBrand } = useBrand();
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: queryKeys.influencerSearch(currentBrand, normalizedQuery),
    queryFn: async () => {
      if (normalizedQuery.length < 2) {
        return [] as InfluencerSearchResult[];
      }

      if (IS_E2E) {
        return Object.values(E2E_INFLUENCERS_BY_BRAND)
          .flat()
          .filter((influencer) => influencerMatchesQuery(influencer, normalizedQuery))
          .map((influencer) => ({
            id: influencer.id,
            brand: influencer.brand,
            insta_name: influencer.insta_name,
            insta_url: influencer.insta_url,
            tiktok_name: influencer.tiktok_name,
            tiktok_url: influencer.tiktok_url,
          })) as InfluencerSearchResult[];
      }

      const data = await fetchApiJson<{ influencers: InfluencerSearchResult[] }>(
        `/api/influencers/search?brand=${encodeURIComponent(currentBrand)}&q=${encodeURIComponent(normalizedQuery)}`
      );
      return data.influencers || [];
    },
    enabled: normalizedQuery.length >= 2,
    staleTime: 30 * 1000,
  });
}

// スコア付きインフルエンサー取得（ランキング用）
export function useInfluencersWithScores() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['influencersWithScores', currentBrand],
    queryFn: async () => {
      // インフルエンサーと案件を取得
      const [influencersRes, campaignsRes] = await Promise.all([
        fetchApiJson<{ influencers: Influencer[] }>(
          `/api/influencers?brand=${encodeURIComponent(currentBrand)}`
        ),
        fetchApiJson<{ campaigns: Campaign[] }>(
          `/api/campaigns?brand=${encodeURIComponent(currentBrand)}`
        ),
      ]);

      const influencersData = influencersRes.influencers || [];
      const campaignsData = campaignsRes.campaigns || [];

      // インフルエンサーごとにスコア計算
      return influencersData.map(inf => {
        const campaigns = campaignsData.filter(c => c.influencer_id === inf.id);

        // 統計計算を一元化された関数で実行
        const stats = calculateStatsFromCampaigns(campaigns);
        const totalCampaigns = campaigns.length;
        const avgEngagement = totalCampaigns > 0
          ? (stats.totalLikes + stats.totalComments) / totalCampaigns
          : 0;

        // スコア計算を一元化された関数で実行
        let score = 0;
        let rank: InfluencerRank = 'C';
        if (totalCampaigns > 0) {
          const scoreResult = calculateInfluencerScore({
            avgConsiderationComments: stats.avgConsiderationComments,
            avgLikes: stats.avgLikes,
            costPerLike: stats.costPerLike,
            onTimeRate: stats.onTimeRate,
          });
          score = scoreResult.totalScore;
          rank = scoreResult.rank;
        }

        // 最終活動日
        const sortedCampaigns = [...campaigns].sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        return {
          ...inf,
          totalCampaigns,
          totalLikes: stats.totalLikes,
          totalComments: stats.totalComments,
          totalSpent: stats.totalSpent,
          costPerLike: stats.costPerLike,
          avgEngagement,
          score,
          rank,
          lastActivity: sortedCampaigns[0]?.updated_at,
        };
      });
    },
    staleTime: 5 * 60 * 1000, // 5分
  });
}

export function useInfluencer(id: string) {
  const { currentBrand } = useBrand();
  return useQuery({
    queryKey: queryKeys.influencer(id),
    queryFn: async () => {
      const data = await fetchApiJson<{ influencer: Influencer }>(
        `/api/influencers/${encodeURIComponent(id)}?brand=${encodeURIComponent(currentBrand)}`
      )
      return data.influencer;
    },
    enabled: !!id,
  });
}

// ==================== Staffs ====================

/**
 * 社員一覧を取得（Clout Dashboard API連携）
 * ADR-006: SSO認証基盤統合に伴い、社員データはClout Dashboardから取得
 */
export function useStaffs() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.staffs(currentBrand),
    queryFn: async () => {
      try {
        // same-origin proxy: /api/master/staff -> Clout Dashboard
        const response = await fetch(`/api/master/staff?active=true&brand=${encodeURIComponent(currentBrand)}`)
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          const errorText =
            data && typeof data?.error === 'string'
              ? data.error
              : `Failed to fetch staff (${response.status})`
          const reasonText =
            data && typeof data?.reason === 'string'
              ? data.reason
              : ''
          throw new Error(reasonText ? `${errorText} (${reasonText})` : errorText)
        }

        // Clout APIのレスポンスをGGCRM形式に変換
        const staffs: Staff[] = (data.staff || []).map((s: {
          id: string
          email: string
          name: string
          department?: string
          position?: string
          isAdmin?: boolean
        }) => ({
          id: s.id,
          user_id: null,
          name: s.name,
          email: s.email,
          team: (s.isAdmin ? 'ADMIN' : (currentBrand.toUpperCase() as Staff['team'])),
          department: s.department || null,
          position: s.position || null,
          is_active: true,
          is_admin: s.isAdmin || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))

        return staffs
      } catch (error) {
        console.error('Failed to fetch staff from Clout API, falling back to local:', error)

        // フォールバック: ローカルのstaffsテーブルから取得
        const { data, error: dbError } = await supabase
          .from('staffs')
          .select('*')
          .order('name', { ascending: true })

        if (dbError) throw dbError
        // ブランド内だけを返す（fallback時もクロスブランド選択を防ぐ）
        const rows = (data as unknown as Staff[]) || []
        return rows.filter((s) => s.is_admin || String((s as any).team || '').toUpperCase() === currentBrand.toUpperCase())
      }
    },
    staleTime: 10 * 60 * 1000, // 10分（スタッフはほとんど変更されない）
  })
}

// ==================== Dashboard Stats ====================

export type DashboardKpis = {
  totalCampaigns: number
  totalInfluencers: number
  totalSpent: number
  totalLikes: number
  totalComments: number
  pendingCount: number
  agreedCount: number
  costPerLike: number
  totalGgCount: number
}

export type DashboardFullStats = {
  totalCampaigns: number
  totalInfluencers: number
  totalSpent: number
  totalLikes: number
  totalComments: number
  statusBreakdown: { name: string; value: number; color: string }[]
  brandStats: { brand: string; count: number; amount: number; likes: number }[]
  monthlyStats: { month: string; campaigns: number; amount: number; likes: number }[]
  itemCostStats: { item_code: string; total_cost: number; campaigns: number }[]
  itemPostTimingStats: { item_code: string; pre_sale_posts: number; post_sale_posts: number; no_post: number }[]
  influencerScreening: { segment: string; count: number; color: string }[]
  influencerRanking: {
    display_name: string
    total_likes: number
    total_comments: number
    total_campaigns: number
    total_amount: number
    cost_per_like: number
    score: number
    rank: string
  }[]
  itemStats: { item_code: string; count: number; likes: number; comments: number; amount: number }[]
}

// KPIのみ（初回ロード高速化用） — BFF経由
export function useDashboardKpis(selectedItem: string, dateRange: string) {
  const { currentBrand } = useBrand()

  return useQuery({
    queryKey: ['dashboardKpis', currentBrand, selectedItem, dateRange],
    queryFn: async (): Promise<DashboardKpis> => {
      const params = new URLSearchParams({
        brand: currentBrand,
        item: selectedItem,
        range: dateRange,
      })
      return fetchApiJson<DashboardKpis>(`/api/dashboard/kpis?${params}`)
    },
    staleTime: 5 * 60 * 1000, // 5分（KPIは頻繁に変わらない）
  })
}

// ==================== Dashboard Full Stats ==================== — BFF経由

export function useDashboardFullStats(
  selectedItem: string,
  dateRange: string,
  options?: { enabled?: boolean }
) {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['dashboardFullStats', currentBrand, selectedItem, dateRange],
    queryFn: async (): Promise<DashboardFullStats | null> => {
      const params = new URLSearchParams({
        brand: currentBrand,
        item: selectedItem,
        range: dateRange,
      })
      return fetchApiJson<DashboardFullStats>(`/api/dashboard/full-stats?${params}`)
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5分
  });
}

// ==================== Item Codes ==================== — BFF経由

export function useItemCodes() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['itemCodes', currentBrand],
    queryFn: async () => {
      const data = await fetchApiJson<{ itemCodes: string[] }>(
        `/api/dashboard/item-codes?brand=${encodeURIComponent(currentBrand)}`
      )
      return data.itemCodes || []
    },
    staleTime: 10 * 60 * 1000, // 10分（品番はあまり変わらない）
  });
}

// ==================== Influencer Past Stats ====================

export function useInfluencerPastStats(influencerId: string | null) {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['influencerPastStats', currentBrand, influencerId],
    queryFn: async () => {
      if (IS_E2E) return null;
      if (!influencerId) return null;

      const params = new URLSearchParams({
        brand: currentBrand,
        influencer_id: influencerId,
      });
      const data = await fetchApiJson<{
        stats: {
          avgOfferedAmount: number;
          avgAgreedAmount: number;
          avgLikes: number;
          totalCampaigns: number;
        } | null;
      }>(`/api/campaigns/past-stats?${params}`);

      return data.stats;
    },
    enabled: !!influencerId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== Payments ====================

/** 支払い対象案件の型（APIレスポンス） */
export type PaymentCampaign = Campaign & {
  payment_status: 'unpaid' | 'approved' | 'paid' | null;
  paid_at: string | null;
  approved_by: string | null;
  approved_by_email?: string | null;
  approved_at: string | null;
  influencer: {
    id: string;
    insta_name: string | null;
    tiktok_name: string | null;
    insta_url: string | null;
    tiktok_url: string | null;
    real_name: string | null;
    bank_name: string | null;
    bank_branch: string | null;
    bank_code: string | null;
    branch_code: string | null;
    account_type: string | null;
    account_number: string | null;
    account_holder: string | null;
    invoice_registration_number: string | null;
    invoice_acknowledged: boolean;
  } | null;
  staff: { id: string; name: string; email: string | null } | null;
};

export function usePayments(paymentStatusFilter: string = 'unpaid') {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.payments(currentBrand, paymentStatusFilter),
    queryFn: async () => {
      if (IS_E2E) return [] as PaymentCampaign[];

      const params = new URLSearchParams({
        brand: currentBrand,
        payment_status: paymentStatusFilter,
      });
      const data = await fetchApiJson<{ campaigns: PaymentCampaign[] }>(
        `/api/payments?${params}`
      );
      return data.campaigns || [];
    },
    staleTime: 2 * 60 * 1000, // 2分（支払い操作は頻繁に更新される）
  });
}

export function useMarkPaid() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async ({
      ids,
      action,
    }: {
      ids: string[];
      action: 'approve' | 'unapprove' | 'paid' | 'unpaid';
    }) => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: currentBrand, ids, action }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === 'string' ? data.error : null) ||
            `支払いステータスの更新に失敗しました (${response.status})`
        );
      }
      return data as { ok: boolean; updated: number; skipped?: number };
    },
    onSuccess: () => {
      // 全ステータスのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['payments', currentBrand] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
    },
  });
}

// ==================== Bulk Operations ====================

export type BulkUpdateItem = {
  id: string;
  likes?: number;
  comments?: number;
  consideration_comment?: number;
  input_date?: string;
  item_code?: string;
  product_cost?: number;
  agreed_amount?: number;
  status?: string;
  post_url?: string;
};

export function useBulkUpdateCampaigns() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (updates: BulkUpdateItem[]) => {
      const response = await fetch('/api/campaigns/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: currentBrand, updates }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === 'string' ? data.error : null) ||
          `一括更新に失敗しました (${response.status})`
        );
      }
      return (data?.updated || []) as string[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
    },
  });
}

export type BulkCreateItem = {
  influencer_id: string;
  item_code: string;
  agreed_amount: number;
  status: string;
  staff_id: string;
  sale_date: string;
  shipping_cost: number;
};

export function useBulkCreateCampaigns() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (items: BulkCreateItem[]) => {
      const response = await fetch('/api/campaigns/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: currentBrand, items }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === 'string' ? data.error : null) ||
          `一括登録に失敗しました (${response.status})`
        );
      }
      return data as { ok: boolean; created: string[]; errors: { index: number; error: string }[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
      queryClient.invalidateQueries({ queryKey: ['influencersWithScores', currentBrand] });
    },
  });
}

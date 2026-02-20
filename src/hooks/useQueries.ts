import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useBrand } from '@/contexts/BrandContext';
import { Campaign, Influencer, Staff } from '@/types';
import {
  calculateInfluencerScore,
  calculateStatsFromCampaigns,
  type InfluencerRank,
} from '@/lib/scoring';

const IS_E2E =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_E2E === 'true';

const E2E_NOW = new Date('2026-02-06T00:00:00.000Z').toISOString();

const E2E_INFLUENCERS_BY_BRAND: Record<string, Influencer[]> = {
  TL: [
    {
      id: 'e2e-influencer-tl',
      insta_name: 'e2e_insta',
      insta_url: null,
      tiktok_name: null,
      tiktok_url: null,
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
      brand: 'AM',
      created_at: E2E_NOW,
      updated_at: E2E_NOW,
    },
  ],
};

async function fetchApiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
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
  influencer: (id: string) => ['influencer', id] as const,
  staffs: (brand: string) => ['staffs', brand] as const,
  dashboardStats: (brand: string) => ['dashboardStats', brand] as const,
};

// ==================== Campaigns ====================

export function useCampaigns() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.campaigns(currentBrand),
    queryFn: async () => {
      if (IS_E2E) {
        return [] as (Campaign & {
          influencer: { id: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
          staff: { id: string; name: string } | null;
        })[];
      }

      const data = await fetchApiJson<{
        campaigns: (Campaign & {
          influencer: { id: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
          staff: { id: string; name: string } | null;
        })[]
      }>(`/api/campaigns?brand=${encodeURIComponent(currentBrand)}`)

      return (data.campaigns || []) as (Campaign & {
        influencer: { id: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
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

// ==================== Bulk Operations ====================

export function useBulkUpdateCampaigns() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (updates: { id: string; likes?: number; comments?: number; input_date?: string }[]) => {
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

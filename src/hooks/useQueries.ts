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
    staleTime: 2 * 60 * 1000, // 2分
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

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...campaign, brand: currentBrand })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .eq('brand', currentBrand)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('brand', currentBrand);
      if (error) throw error;
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
    staleTime: 2 * 60 * 1000,
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

export function useCreateInfluencer() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async (influencer: Partial<Influencer>) => {
      const { data, error } = await supabase
        .from('influencers')
        .insert({ ...influencer, brand: currentBrand })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.influencers(currentBrand) });
    },
  });
}

export function useUpdateInfluencer() {
  const queryClient = useQueryClient();
  const { currentBrand } = useBrand();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Influencer> & { id: string }) => {
      const { data, error } = await supabase
        .from('influencers')
        .update(updates)
        .eq('id', id)
        .eq('brand', currentBrand)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.influencers(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.influencer(data.id) });
    },
  });
}

// ==================== Staffs ====================

const CLOUT_API_URL = process.env.NEXT_PUBLIC_CLOUT_API_URL || 'https://dashboard.clout.co.jp'

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

export function useDashboardStats() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.dashboardStats(currentBrand),
    queryFn: async () => {
      // 案件数を取得
      const { count: campaignCount, error: campaignError } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('brand', currentBrand);

      if (campaignError) throw campaignError;

      // インフルエンサー数を取得
      const { count: influencerCount, error: influencerError } = await supabase
        .from('influencers')
        .select('*', { count: 'exact', head: true })
        .eq('brand', currentBrand);

      if (influencerError) throw influencerError;

      // 案件の詳細を取得（統計計算用）
      const { data: campaigns, error: detailError } = await supabase
        .from('campaigns')
        .select('status, agreed_amount, likes, comments')
        .eq('brand', currentBrand);

      if (detailError) throw detailError;

      // 統計を計算
      const totalSpent = campaigns?.reduce((sum, c) => sum + (c.agreed_amount || 0), 0) || 0;
      const totalLikes = campaigns?.reduce((sum, c) => sum + (c.likes || 0), 0) || 0;
      const totalComments = campaigns?.reduce((sum, c) => sum + (c.comments || 0), 0) || 0;
      const agreedCount = campaigns?.filter((c) => c.status === 'agree').length || 0;

      return {
        campaignCount: campaignCount || 0,
        influencerCount: influencerCount || 0,
        totalSpent,
        totalLikes,
        totalComments,
        agreedCount,
        costPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
      };
    },
    staleTime: 1 * 60 * 1000, // 1分
  });
}

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

function getStartDateFromRange(dateRange: string): Date | null {
  if (dateRange === 'all') return null

  const now = new Date()
  switch (dateRange) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7))
    case '30d':
      return new Date(now.setDate(now.getDate() - 30))
    case '90d':
      return new Date(now.setDate(now.getDate() - 90))
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1))
    default:
      return null
  }
}

// KPIのみ（初回ロード高速化用）
export function useDashboardKpis(selectedItem: string, dateRange: string) {
  const { currentBrand } = useBrand()

  return useQuery({
    queryKey: ['dashboardKpis', currentBrand, selectedItem, dateRange],
    queryFn: async (): Promise<DashboardKpis> => {
      let query = supabase
        .from('campaigns')
        .select('status, agreed_amount, likes, comments, influencer_id, item_code, created_at')
        .eq('brand', currentBrand)

      if (selectedItem !== 'all') {
        query = query.eq('item_code', selectedItem)
      }

      const startDate = getStartDateFromRange(dateRange)
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data: campaigns, error } = await query
      if (error) throw error

      const rows = (campaigns as any[]) || []

      const totalSpent = rows.reduce((sum, c) => sum + (c.agreed_amount || 0), 0)
      const totalLikes = rows.reduce((sum, c) => sum + (c.likes || 0), 0)
      const totalComments = rows.reduce((sum, c) => sum + (c.comments || 0), 0)
      const pendingCount = rows.filter((c) => c.status === 'pending').length
      const agreedCount = rows.filter((c) => c.status === 'agree').length
      const totalInfluencers = new Set(rows.map((c) => c.influencer_id).filter(Boolean)).size

      return {
        totalCampaigns: rows.length,
        totalInfluencers,
        totalSpent,
        totalLikes,
        totalComments,
        pendingCount,
        agreedCount,
        costPerLike: totalLikes > 0 ? totalSpent / totalLikes : 0,
      }
    },
    staleTime: 1 * 60 * 1000,
  })
}

// ==================== Dashboard Full Stats ====================

export function useDashboardFullStats(
  selectedItem: string,
  dateRange: string,
  options?: { enabled?: boolean }
) {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['dashboardFullStats', currentBrand, selectedItem, dateRange],
    queryFn: async () => {
      // 案件を取得（インフルエンサー情報付き）
      let query = supabase
        .from('campaigns')
        .select(`
          brand,
          status,
          agreed_amount,
          likes,
          comments,
          consideration_comment,
          influencer_id,
          item_code,
          post_date,
          created_at,
          influencer:influencers(id, insta_name, tiktok_name)
        `)
        .eq('brand', currentBrand);

      if (selectedItem !== 'all') {
        query = query.eq('item_code', selectedItem);
      }
      if (dateRange !== 'all') {
        const startDate = getStartDateFromRange(dateRange);
        if (startDate) {
          query = query.gte('created_at', startDate.toISOString());
        }
      }

      const { data: campaigns, error } = await query;
      if (error) throw error;

      if (!campaigns) return null;

      // ステータス別集計
      const statusCount = { pending: 0, agree: 0, disagree: 0, cancelled: 0 };
      campaigns.forEach((c) => {
        if (c.status in statusCount) {
          statusCount[c.status as keyof typeof statusCount]++;
        }
      });

      // ブランド別集計
      const brandMap = new Map<string, { count: number; amount: number; likes: number }>();
      campaigns.forEach((c) => {
        const brand = c.brand || '未設定';
        const existing = brandMap.get(brand) || { count: 0, amount: 0, likes: 0 };
        brandMap.set(brand, {
          count: existing.count + 1,
          amount: existing.amount + (c.agreed_amount || 0),
          likes: existing.likes + (c.likes || 0),
        });
      });

      // 月別集計
      const monthMap = new Map<string, { campaigns: number; amount: number; likes: number }>();
      campaigns.forEach((c) => {
        const date = c.post_date || c.created_at;
        if (date) {
          const month = date.substring(0, 7);
          const existing = monthMap.get(month) || { campaigns: 0, amount: 0, likes: 0 };
          monthMap.set(month, {
            campaigns: existing.campaigns + 1,
            amount: existing.amount + (c.agreed_amount || 0),
            likes: existing.likes + (c.likes || 0),
          });
        }
      });

      // インフルエンサー別集計
      const influencerMap = new Map<string, {
        display_name: string;
        total_likes: number;
        total_comments: number;
        total_campaigns: number;
        total_amount: number;
        total_consideration_comments: number;
      }>();
      campaigns.forEach((c) => {
        const raw = (c as any).influencer as
          | { id?: unknown; insta_name?: unknown; tiktok_name?: unknown }
          | Array<{ id?: unknown; insta_name?: unknown; tiktok_name?: unknown }>
          | null
          | undefined;

        // Supabase join shape may be object or array depending on schema inference.
        const influencer = Array.isArray(raw) ? raw[0] : raw;

        if (influencer) {
          const key = String((influencer as any).id || '');
          if (!key) return;
          const displayName =
            String((influencer as any).insta_name || '') ||
            String((influencer as any).tiktok_name || '') ||
            '不明';
          const existing = influencerMap.get(key) || {
            display_name: displayName,
            total_likes: 0,
            total_comments: 0,
            total_campaigns: 0,
            total_amount: 0,
            total_consideration_comments: 0,
          };
          influencerMap.set(key, {
            display_name: displayName,
            total_likes: existing.total_likes + (c.likes || 0),
            total_comments: existing.total_comments + (c.comments || 0),
            total_campaigns: existing.total_campaigns + 1,
            total_amount: existing.total_amount + (c.agreed_amount || 0),
            total_consideration_comments: existing.total_consideration_comments + (c.consideration_comment || 0),
          });
        }
      });

      // 商品別集計
      const itemMap = new Map<string, { count: number; likes: number; comments: number; amount: number }>();
      campaigns.forEach((c) => {
        if (c.item_code) {
          const existing = itemMap.get(c.item_code) || { count: 0, likes: 0, comments: 0, amount: 0 };
          itemMap.set(c.item_code, {
            count: existing.count + 1,
            likes: existing.likes + (c.likes || 0),
            comments: existing.comments + (c.comments || 0),
            amount: existing.amount + (c.agreed_amount || 0),
          });
        }
      });

      // インフルエンサーランキング計算（一元化されたスコア計算関数を使用）
      const influencerRanking = Array.from(influencerMap.values())
        .map((inf) => {
          const costPerLike = inf.total_likes > 0 ? inf.total_amount / inf.total_likes : 0;
          const avgLikes = inf.total_campaigns > 0 ? inf.total_likes / inf.total_campaigns : 0;
          const avgConsiderationComments = inf.total_campaigns > 0
            ? inf.total_consideration_comments / inf.total_campaigns
            : 0;

          let score = 0;
          let rank: InfluencerRank = 'C';
          if (inf.total_campaigns > 0) {
            const scoreResult = calculateInfluencerScore({
              avgConsiderationComments,
              avgLikes,
              costPerLike,
              // ダッシュボードでは納期遵守率のデータがないためデフォルト値を使用
            });
            score = scoreResult.totalScore;
            rank = scoreResult.rank;
          }

          return {
            ...inf,
            cost_per_like: costPerLike,
            score,
            rank,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return {
        totalCampaigns: campaigns.length,
        totalInfluencers: new Set(campaigns.map(c => c.influencer_id)).size,
        totalSpent: campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0),
        totalLikes: campaigns.reduce((sum, c) => sum + (c.likes || 0), 0),
        totalComments: campaigns.reduce((sum, c) => sum + (c.comments || 0), 0),
        statusBreakdown: [
          { name: '合意', value: statusCount.agree, color: '#374151' },
          { name: '保留', value: statusCount.pending, color: '#6b7280' },
          { name: '不合意', value: statusCount.disagree, color: '#9ca3af' },
          { name: 'キャンセル', value: statusCount.cancelled, color: '#d1d5db' },
        ].filter((s) => s.value > 0),
        brandStats: Array.from(brandMap.entries())
          .map(([brand, data]) => ({ brand, ...data }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
        monthlyStats: Array.from(monthMap.entries())
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12),
        influencerRanking,
        itemStats: Array.from(itemMap.entries())
          .map(([item_code, data]) => ({ item_code, ...data }))
          .sort((a, b) => b.likes - a.likes)
          .slice(0, 10),
      } satisfies DashboardFullStats;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1 * 60 * 1000,
  });
}

// ==================== Item Codes ====================

export function useItemCodes() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['itemCodes', currentBrand],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('item_code')
        .eq('brand', currentBrand)
        .not('item_code', 'is', null);

      if (error) throw error;

      // ユニークな品番リストを返す
      const uniqueCodes = Array.from(new Set(
        data?.map(c => c.item_code).filter(Boolean) || []
      )).sort();

      return uniqueCodes as string[];
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

      const { data, error } = await supabase
        .from('campaigns')
        .select('offered_amount, agreed_amount, likes, comments')
        .eq('influencer_id', influencerId)
        .eq('brand', currentBrand)
        .not('agreed_amount', 'is', null);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // 過去の平均値を計算
      const avgOffered = data.reduce((sum, c) => sum + (c.offered_amount || 0), 0) / data.length;
      const avgAgreed = data.reduce((sum, c) => sum + (c.agreed_amount || 0), 0) / data.length;
      const avgLikes = data.reduce((sum, c) => sum + (c.likes || 0), 0) / data.length;

      return {
        avgOfferedAmount: Math.round(avgOffered),
        avgAgreedAmount: Math.round(avgAgreed),
        avgLikes: Math.round(avgLikes),
        totalCampaigns: data.length,
      };
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
      const results = await Promise.all(
        updates.map(async ({ id, ...data }) => {
          const { error } = await supabase
            .from('campaigns')
            .update(data)
            .eq('id', id);
          if (error) throw error;
          return id;
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(currentBrand) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(currentBrand) });
    },
  });
}

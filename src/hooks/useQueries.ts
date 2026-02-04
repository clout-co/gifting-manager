import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useBrand } from '@/contexts/BrandContext';
import { Campaign, Influencer, Staff } from '@/types';

// Query Keys
export const queryKeys = {
  campaigns: (brand: string) => ['campaigns', brand] as const,
  campaign: (id: string) => ['campaign', id] as const,
  influencers: (brand: string) => ['influencers', brand] as const,
  influencer: (id: string) => ['influencer', id] as const,
  staffs: () => ['staffs'] as const,
  dashboardStats: (brand: string) => ['dashboardStats', brand] as const,
};

// ==================== Campaigns ====================

export function useCampaigns() {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: queryKeys.campaigns(currentBrand),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          influencer:influencers(id, insta_name, tiktok_name, insta_url, tiktok_url),
          staff:staffs(id, name)
        `)
        .eq('brand', currentBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (Campaign & {
        influencer: { id: string; insta_name: string | null; tiktok_name: string | null; insta_url: string | null; tiktok_url: string | null } | null;
        staff: { id: string; name: string } | null;
      })[];
    },
    staleTime: 2 * 60 * 1000, // 2分
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          influencer:influencers(*),
          staff:staffs(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
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
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
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
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('brand', currentBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Influencer[];
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
        supabase.from('influencers').select('*').eq('brand', currentBrand).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('*').eq('brand', currentBrand),
      ]);

      if (influencersRes.error) throw influencersRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      const influencersData = influencersRes.data || [];
      const campaignsData = campaignsRes.data || [];

      // インフルエンサーごとにスコア計算
      return influencersData.map(inf => {
        const campaigns = campaignsData.filter(c => c.influencer_id === inf.id);
        const totalCampaigns = campaigns.length;
        const totalLikes = campaigns.reduce((sum, c) => sum + (c.likes || 0), 0);
        const totalComments = campaigns.reduce((sum, c) => sum + (c.comments || 0), 0);
        const totalSpent = campaigns.reduce((sum, c) => sum + (c.agreed_amount || 0), 0);
        const costPerLike = totalLikes > 0 ? totalSpent / totalLikes : 0;
        const avgLikes = totalCampaigns > 0 ? totalLikes / totalCampaigns : 0;
        const avgEngagement = totalCampaigns > 0 ? (totalLikes + totalComments) / totalCampaigns : 0;

        // 検討コメント計算
        const totalConsiderationComments = campaigns.reduce((sum, c) => sum + (c.consideration_comment || 0), 0);
        const avgConsiderationComments = totalCampaigns > 0 ? totalConsiderationComments / totalCampaigns : 0;

        // 納期遵守率
        const campaignsWithDeadline = campaigns.filter(c => c.desired_post_date && c.post_date);
        const onTimeCampaigns = campaignsWithDeadline.filter(c => {
          const desired = new Date(c.desired_post_date!);
          const actual = new Date(c.post_date!);
          return actual <= desired;
        });
        const onTimeRate = campaignsWithDeadline.length > 0
          ? (onTimeCampaigns.length / campaignsWithDeadline.length) * 100
          : 100;

        // スコア計算
        let score = 0;
        if (totalCampaigns > 0) {
          const considerationScore = Math.min(100, (avgConsiderationComments / 50) * 100);
          const engagementScore = Math.min(100, (avgLikes / 1000) * 100);
          const efficiencyScore = costPerLike > 0
            ? Math.max(0, Math.min(100, ((200 - costPerLike) / 150) * 100))
            : 50;
          const reliabilityScore = onTimeRate;

          score = Math.round(
            considerationScore * 0.40 +
            engagementScore * 0.25 +
            efficiencyScore * 0.20 +
            reliabilityScore * 0.15
          );
        }

        // ランク判定
        let rank = 'C';
        if (score >= 75) rank = 'S';
        else if (score >= 55) rank = 'A';
        else if (score >= 35) rank = 'B';

        // 最終活動日
        const sortedCampaigns = [...campaigns].sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        return {
          ...inf,
          totalCampaigns,
          totalLikes,
          totalComments,
          totalSpent,
          costPerLike,
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
  return useQuery({
    queryKey: queryKeys.influencer(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Influencer;
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

export function useStaffs() {
  return useQuery({
    queryKey: queryKeys.staffs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staffs')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Staff[];
    },
    staleTime: 10 * 60 * 1000, // 10分（スタッフはほとんど変更されない）
  });
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

// ==================== Dashboard Full Stats ====================

export function useDashboardFullStats(selectedItem: string, dateRange: string) {
  const { currentBrand } = useBrand();

  return useQuery({
    queryKey: ['dashboardFullStats', currentBrand, selectedItem, dateRange],
    queryFn: async () => {
      // 案件を取得（インフルエンサー情報付き）
      let query = supabase
        .from('campaigns')
        .select('*, influencer:influencers(*)')
        .eq('brand', currentBrand);

      if (selectedItem !== 'all') {
        query = query.eq('item_code', selectedItem);
      }
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (dateRange) {
          case '7d':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case '30d':
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case '90d':
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          case '1y':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = new Date(0);
        }
        query = query.gte('created_at', startDate.toISOString());
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
        if (c.influencer) {
          const key = c.influencer.id;
          const displayName = c.influencer.insta_name || c.influencer.tiktok_name || '不明';
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

      // インフルエンサーランキング計算
      const influencerRanking = Array.from(influencerMap.values())
        .map((inf) => {
          const costPerLike = inf.total_likes > 0 ? inf.total_amount / inf.total_likes : 0;
          const avgLikes = inf.total_campaigns > 0 ? inf.total_likes / inf.total_campaigns : 0;
          const avgConsiderationComments = inf.total_campaigns > 0 ? inf.total_consideration_comments / inf.total_campaigns : 0;

          let score = 0;
          if (inf.total_campaigns > 0) {
            const considerationScore = Math.min(100, (avgConsiderationComments / 50) * 100);
            const engagementScore = Math.min(100, (avgLikes / 1000) * 100);
            const efficiencyScore = costPerLike > 0
              ? Math.max(0, Math.min(100, ((200 - costPerLike) / 150) * 100))
              : 50;
            const reliabilityScore = 80;

            score = Math.round(
              considerationScore * 0.40 +
              engagementScore * 0.25 +
              efficiencyScore * 0.20 +
              reliabilityScore * 0.15
            );
          }

          let rank = 'C';
          if (score >= 75) rank = 'S';
          else if (score >= 55) rank = 'A';
          else if (score >= 35) rank = 'B';

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
      };
    },
    staleTime: 1 * 60 * 1000,
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

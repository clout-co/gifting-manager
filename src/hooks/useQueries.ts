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
        .order('username', { ascending: true });

      if (error) throw error;
      return data as Influencer[];
    },
    staleTime: 5 * 60 * 1000, // 5分（インフルエンサーはあまり変更されない）
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
        .select('status, cost, likes, comments')
        .eq('brand', currentBrand);

      if (detailError) throw detailError;

      // 統計を計算
      const totalCost = campaigns?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0;
      const totalLikes = campaigns?.reduce((sum, c) => sum + (c.likes || 0), 0) || 0;
      const totalComments = campaigns?.reduce((sum, c) => sum + (c.comments || 0), 0) || 0;
      const agreedCount = campaigns?.filter((c) => c.status === '合意').length || 0;

      return {
        campaignCount: campaignCount || 0,
        influencerCount: influencerCount || 0,
        totalCost,
        totalLikes,
        totalComments,
        agreedCount,
        costPerLike: totalLikes > 0 ? totalCost / totalLikes : 0,
      };
    },
    staleTime: 1 * 60 * 1000, // 1分
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

'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useBrand } from '@/contexts/BrandContext';

const IS_E2E =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_E2E === 'true';

/**
 * Cross-user sync (minimal).
 *
 * Problem: React Query caches can hide newly created influencers/campaigns from other users
 * until staleTime expires. Supabase Realtime lets us invalidate queries immediately.
 */
export default function RealtimeSync() {
  const { currentBrand } = useBrand();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (IS_E2E) return;

    const brand = String(currentBrand || '').trim().toUpperCase();
    if (!brand) return;

    const channel = supabase
      .channel(`ggcrm-sync-${brand}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'influencers', filter: `brand=eq.${brand}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['influencers', brand] });
          queryClient.invalidateQueries({ queryKey: ['influencersWithScores', brand] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `brand=eq.${brand}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaigns', brand] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats', brand] });
          // Influencer score uses campaigns, so refresh it too.
          queryClient.invalidateQueries({ queryKey: ['influencersWithScores', brand] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBrand, queryClient]);

  return null;
}


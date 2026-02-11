'use client';

import { ADMIN_EMAILS } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface AdminAuthState {
  isAdmin: boolean;
  loading: boolean;
  userEmail: string | null;
}

export function useAdminAuth(): AdminAuthState {
  const { user, loading } = useAuth();
  const userEmail = user?.email ?? null;
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail.toLowerCase()) : false;

  return { isAdmin, loading, userEmail };
}

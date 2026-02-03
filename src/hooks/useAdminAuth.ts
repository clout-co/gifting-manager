'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ADMIN_EMAILS } from '@/types';

interface AdminAuthState {
  isAdmin: boolean;
  loading: boolean;
  userEmail: string | null;
}

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    loading: true,
    userEmail: null,
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user?.email) {
          const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
          setState({
            isAdmin,
            loading: false,
            userEmail: user.email,
          });
        } else {
          setState({
            isAdmin: false,
            loading: false,
            userEmail: null,
          });
        }
      } catch (error) {
        setState({
          isAdmin: false,
          loading: false,
          userEmail: null,
        });
      }
    };

    checkAdminStatus();
  }, []);

  return state;
}

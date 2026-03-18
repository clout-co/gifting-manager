import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/request-context';
import { createSupabaseForRequest } from '@/lib/supabase/request-client';

type Ctx = { params: Promise<{ id: string }> };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_EXPIRY_DAYS = 30;

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireAuthContext(request, { requireWrite: true });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 });
  }

  let supabaseCtx: ReturnType<typeof createSupabaseForRequest>;
  try {
    supabaseCtx = createSupabaseForRequest({
      request,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to init DB client' },
      { status: 500 }
    );
  }
  const supabase = supabaseCtx.client;

  const { data: existing, error } = await supabase
    .from('influencers')
    .select('id, brand')
    .eq('id', id)
    .single();

  if (error || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const brand = String(existing.brand || '').toUpperCase();
  const allowedBrands = auth.context.brands;
  if (allowedBrands.length > 0 && !allowedBrands.includes(brand as 'TL' | 'BE' | 'AM')) {
    return NextResponse.json({ error: 'Forbidden brand' }, { status: 403 });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  const { error: updateError } = await supabase
    .from('influencers')
    .update({
      form_token: token,
      form_token_expires_at: expiresAt.toISOString(),
      form_token_used_at: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }

  return NextResponse.json({
    token,
    expires_at: expiresAt.toISOString(),
    url: `/form/${token}`,
  });
}

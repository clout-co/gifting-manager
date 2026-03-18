import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api/rate-limit';

type Ctx = { params: Promise<{ token: string }> };

function normalizeText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

const VALID_ACCOUNT_TYPES = new Set(['普通', '当座', '貯蓄']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_RE = /^\d{3}-?\d{4}$/;

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const rl = rateLimit({
    key: `form:${token}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const real_name = normalizeText(body.real_name);
  const postal_code = normalizeText(body.postal_code);
  const address = normalizeText(body.address);
  const phone = normalizeText(body.phone);
  const email = normalizeText(body.email);
  const bank_name = normalizeText(body.bank_name);
  const bank_branch = normalizeText(body.bank_branch);
  const bank_code = normalizeText(body.bank_code);
  const branch_code = normalizeText(body.branch_code);
  const account_type = normalizeText(body.account_type);
  const account_number = normalizeText(body.account_number);
  const account_holder = normalizeText(body.account_holder);
  const invoice_registration_number = normalizeText(body.invoice_registration_number);
  const invoice_acknowledged = body.invoice_acknowledged === true;

  if (!real_name) {
    return NextResponse.json({ error: '本名を入力してください' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '正しいメールアドレスを入力してください' }, { status: 400 });
  }
  if (!postal_code) {
    return NextResponse.json({ error: '郵便番号を入力してください' }, { status: 400 });
  }
  if (!POSTAL_CODE_RE.test(postal_code)) {
    return NextResponse.json({ error: '郵便番号はXXX-XXXXの形式で入力してください' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: '電話番号を入力してください' }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: '住所を入力してください' }, { status: 400 });
  }

  if (!bank_name || !bank_branch || !account_number || !account_holder) {
    return NextResponse.json({ error: '振込先情報を全て入力してください' }, { status: 400 });
  }
  if (account_type && !VALID_ACCOUNT_TYPES.has(account_type)) {
    return NextResponse.json({ error: '無効な口座種類です' }, { status: 400 });
  }

  if (invoice_registration_number && !/^T\d{13}$/.test(invoice_registration_number)) {
    return NextResponse.json({ error: '適格請求書発行事業者登録番号はT+13桁の数字で入力してください' }, { status: 400 });
  }
  if (!invoice_acknowledged) {
    return NextResponse.json({ error: 'インボイス制度についての内容を承諾してください' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: influencer, error: lookupError } = await supabase
    .from('influencers')
    .select('id, form_token_expires_at, form_token_used_at')
    .eq('form_token', token)
    .single();

  if (lookupError || !influencer) {
    return NextResponse.json({ error: '無効なリンクです' }, { status: 404 });
  }
  if (influencer.form_token_expires_at && new Date(influencer.form_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'リンクの有効期限が切れています' }, { status: 410 });
  }
  if (influencer.form_token_used_at) {
    return NextResponse.json({ error: 'このフォームは既に送信済みです' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('influencers')
    .update({
      real_name,
      postal_code,
      address,
      phone,
      email,
      bank_name,
      bank_branch,
      bank_code,
      branch_code,
      account_type: account_type || '普通',
      account_number,
      account_holder,
      invoice_registration_number,
      invoice_acknowledged,
      form_token_used_at: new Date().toISOString(),
    })
    .eq('id', influencer.id);

  if (updateError) {
    console.error('[form-submit] update failed:', updateError.message, updateError.code);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

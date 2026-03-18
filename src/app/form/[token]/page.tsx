import { createClient } from '@supabase/supabase-js';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import PublicInfluencerForm from './PublicInfluencerForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface InfluencerFormRow {
  id: string;
  brand: string | null;
  insta_name: string | null;
  tiktok_name: string | null;
  form_token_expires_at: string | null;
  form_token_used_at: string | null;
  real_name: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_code: string | null;
  branch_code: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  invoice_registration_number: string | null;
  invoice_acknowledged: boolean | null;
}

async function getInfluencerByToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[form-page] Missing env:', { url: !!supabaseUrl, key: !!supabaseServiceKey });
    return { error: 'server_error' as const };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from('influencers')
    .select(
      'id, brand, insta_name, tiktok_name, form_token_expires_at, form_token_used_at, ' +
      'real_name, postal_code, address, phone, email, ' +
      'bank_name, bank_branch, bank_code, branch_code, account_type, account_number, account_holder, ' +
      'invoice_registration_number, invoice_acknowledged'
    )
    .eq('form_token', token)
    .single();

  if (error || !data) {
    console.error('[form-page] Supabase lookup failed:', {
      error: error?.message,
      code: error?.code,
      hasData: !!data,
      token: `${token.substring(0, 8)}...`,
    });
    return { error: 'not_found' as const };
  }

  const row = data as unknown as InfluencerFormRow;

  if (row.form_token_expires_at && new Date(row.form_token_expires_at) < new Date()) {
    return { error: 'expired' as const };
  }

  if (row.form_token_used_at) {
    return { error: 'used' as const };
  }

  return { data: row };
}

function ErrorScreen({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
}

export default async function FormPage({ params }: PageProps) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return (
      <ErrorScreen
        icon={<AlertTriangle className="text-red-500" size={48} />}
        title="無効なリンク"
        message="このリンクは無効です。正しいURLをご確認ください。"
      />
    );
  }

  const result = await getInfluencerByToken(token);

  if ('error' in result) {
    switch (result.error) {
      case 'not_found':
        return (
          <ErrorScreen
            icon={<AlertTriangle className="text-red-500" size={48} />}
            title="無効なリンク"
            message="このリンクは無効です。正しいURLをご確認ください。"
          />
        );
      case 'expired':
        return (
          <ErrorScreen
            icon={<Clock className="text-amber-500" size={48} />}
            title="リンクの有効期限切れ"
            message="このリンクの有効期限が切れています。担当者に新しいリンクの発行をご依頼ください。"
          />
        );
      case 'used':
        return (
          <ErrorScreen
            icon={<CheckCircle2 className="text-green-500" size={48} />}
            title="送信済み"
            message="このフォームは既に送信済みです。内容の修正が必要な場合は担当者にご連絡ください。"
          />
        );
      default:
        return (
          <ErrorScreen
            icon={<AlertTriangle className="text-red-500" size={48} />}
            title="エラー"
            message="サーバーエラーが発生しました。しばらくしてからもう一度お試しください。"
          />
        );
    }
  }

  const influencer = result.data;
  const snsName = influencer.insta_name || influencer.tiktok_name || '';
  const brandName =
    influencer.brand === 'TL'
      ? "That's Life"
      : influencer.brand === 'BE'
        ? 'Belvet'
        : influencer.brand === 'AM'
          ? 'Ameri'
          : influencer.brand || '';

  return (
    <PublicInfluencerForm
      token={token}
      snsName={snsName}
      brandName={brandName}
      initialData={{
        real_name: influencer.real_name || '',
        postal_code: influencer.postal_code || '',
        address: influencer.address || '',
        phone: influencer.phone || '',
        email: influencer.email || '',
        bank_name: influencer.bank_name || '',
        bank_branch: influencer.bank_branch || '',
        bank_code: influencer.bank_code || '',
        branch_code: influencer.branch_code || '',
        account_type: influencer.account_type || '普通',
        account_number: influencer.account_number || '',
        account_holder: influencer.account_holder || '',
        invoice_registration_number: influencer.invoice_registration_number || '',
        invoice_acknowledged: influencer.invoice_acknowledged || false,
      }}
    />
  );
}

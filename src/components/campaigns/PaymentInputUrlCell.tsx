'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Influencer } from '@/types';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useToast } from '@/lib/toast';
import {
  buildInfluencerFormUrl,
  getInfluencerFormTokenStatus,
} from '@/lib/influencer-form-token';

type CampaignInfluencerFormFields = Pick<
  Influencer,
  'id' | 'form_token' | 'form_token_expires_at' | 'form_token_used_at'
>;

interface PaymentInputUrlCellProps {
  influencer: CampaignInfluencerFormFields | null | undefined;
  isPaid: boolean;
  onTokenGenerated?: () => void;
}

const STATUS_STYLES = {
  none: 'text-muted-foreground',
  active: 'text-blue-600 dark:text-blue-400',
  used: 'text-green-600 dark:text-green-400',
  expired: 'text-amber-600 dark:text-amber-400',
} as const;

const STATUS_LABELS = {
  none: '未発行',
  active: '発行済み',
  used: '入力済み',
  expired: '期限切れ',
} as const;

export default function PaymentInputUrlCell({
  influencer,
  isPaid,
  onTokenGenerated,
}: PaymentInputUrlCellProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const status = getInfluencerFormTokenStatus(influencer);
  const existingUrl = useMemo(() => {
    if (status !== 'active' || !influencer?.form_token) return null;
    return buildInfluencerFormUrl(influencer.form_token, origin);
  }, [influencer?.form_token, origin, status]);

  const activeUrl = generatedUrl || existingUrl;

  if (!isPaid) {
    return <span className="text-xs text-muted-foreground/60">対象外</span>;
  }

  if (!influencer?.id) {
    return <span className="text-xs text-red-500/80">未連携</span>;
  }

  const copyUrl = async (url: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('success', successMessage);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'コピーに失敗しました');
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/influencers/${influencer.id}/form-token`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data && typeof data.error === 'string'
            ? data.error
            : `URL発行に失敗しました (${response.status})`;
        throw new Error(message);
      }

      const nextUrl = buildInfluencerFormUrl(String(data.token || ''), origin);
      setGeneratedUrl(nextUrl);
      await copyUrl(
        nextUrl,
        status === 'none'
          ? '支払い入力URLを発行してコピーしました'
          : '支払い入力URLを再発行してコピーしました'
      );
      onTokenGenerated?.();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'URL発行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-[152px]">
      <div className={`mb-2 flex items-center gap-1 text-[11px] font-medium ${STATUS_STYLES[status]}`}>
        {status === 'none' && <AlertTriangle size={12} />}
        {status === 'active' && <Clock size={12} />}
        {status === 'used' && <CheckCircle2 size={12} />}
        {status === 'expired' && <AlertTriangle size={12} />}
        <span>{STATUS_LABELS[status]}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {activeUrl ? (
          <>
            <button
              type="button"
              onClick={() => copyUrl(activeUrl, '支払い入力URLをコピーしました')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied ? 'コピー済み' : 'コピー'}
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="支払い入力フォームを開く"
            >
              <ExternalLink size={12} />
            </a>
          </>
        ) : null}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : status === 'none' ? (
            <Link2 size={12} />
          ) : (
            <RefreshCw size={12} />
          )}
          {loading ? '生成中' : status === 'none' ? 'URL発行' : '再発行'}
        </button>
      </div>
    </div>
  );
}

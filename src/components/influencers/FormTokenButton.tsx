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
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useToast } from '@/lib/toast';
import {
  buildInfluencerFormUrl,
  getInfluencerFormTokenStatus,
} from '@/lib/influencer-form-token';

interface FormTokenButtonProps {
  influencer: Influencer;
  onTokenGenerated?: () => void;
}

export default function FormTokenButton({
  influencer,
  onTokenGenerated,
}: FormTokenButtonProps) {
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
    if (status !== 'active' || !influencer.form_token) return null;
    return buildInfluencerFormUrl(influencer.form_token, origin);
  }, [influencer.form_token, origin, status]);

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

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/influencers/${influencer.id}/form-token`, {
        method: 'POST',
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data && typeof data.error === 'string'
            ? data.error
            : `トークン生成に失敗しました (${res.status})`;
        throw new Error(message);
      }

      const fullUrl = buildInfluencerFormUrl(String(data.token || ''), origin);
      setGeneratedUrl(fullUrl);
      await copyUrl(
        fullUrl,
        status === 'none'
          ? 'フォームリンクを発行してコピーしました'
          : 'フォームリンクを再発行してコピーしました'
      );
      onTokenGenerated?.();
    } catch (err: unknown) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'トークン生成に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="font-bold text-foreground dark:text-white mb-4 flex items-center gap-2">
        <Link2 size={20} className="text-muted-foreground" />
        請求先情報フォーム
      </h3>

      <div className="mb-4">
        {status === 'none' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle size={16} />
            <span>フォームリンク未発行</span>
          </div>
        )}
        {status === 'active' && !generatedUrl && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <Clock size={16} />
            <span>
              フォームリンク発行済み（有効期限:{' '}
              {influencer.form_token_expires_at
                ? format(
                    new Date(influencer.form_token_expires_at),
                    'yyyy/MM/dd',
                    { locale: ja }
                  )
                : '不明'}
              ）
            </span>
          </div>
        )}
        {status === 'used' && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={16} />
            <span>
              入力済み（
              {influencer.form_token_used_at
                ? format(
                    new Date(influencer.form_token_used_at),
                    'yyyy/MM/dd HH:mm',
                    { locale: ja }
                  )
                : '日時不明'}
              ）
            </span>
          </div>
        )}
        {status === 'expired' && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle size={16} />
            <span>フォームリンク期限切れ</span>
          </div>
        )}
      </div>

      {(generatedUrl || existingUrl) && (
        <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">
            フォームURL（このURLをインフルエンサーに送信してください）
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedUrl || existingUrl || ''}
              className="input-field flex-1 text-xs font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => copyUrl(generatedUrl || existingUrl || '', 'URLをコピーしました')}
              className="btn-secondary flex items-center gap-1 shrink-0"
            >
              {copied ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} />
              )}
              {copied ? 'コピー済み' : 'コピー'}
            </button>
            <a
              href={generatedUrl || existingUrl || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1 shrink-0"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={generateToken}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : status === 'none' ? (
            <Link2 size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {loading
            ? '生成中...'
            : status === 'none'
              ? 'フォームリンク発行'
              : 'フォームリンク再発行'}
        </button>
      </div>

      {status !== 'none' && (
        <p className="text-xs text-muted-foreground mt-3">
          再発行すると以前のリンクは無効になります。有効期限は発行から30日間です。
        </p>
      )}
    </div>
  );
}

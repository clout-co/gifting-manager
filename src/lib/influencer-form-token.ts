import type { Influencer } from '@/types';

export type InfluencerFormTokenFields = Pick<
  Influencer,
  'form_token' | 'form_token_expires_at' | 'form_token_used_at'
>;

export type InfluencerFormTokenStatus = 'none' | 'active' | 'used' | 'expired';

export function getInfluencerFormTokenStatus(
  influencer: InfluencerFormTokenFields | null | undefined
): InfluencerFormTokenStatus {
  if (!influencer?.form_token) return 'none';
  if (influencer.form_token_used_at) return 'used';
  if (
    influencer.form_token_expires_at &&
    new Date(influencer.form_token_expires_at).getTime() < Date.now()
  ) {
    return 'expired';
  }
  return 'active';
}

export function buildInfluencerFormUrl(token: string, origin?: string | null): string {
  const normalizedOrigin = String(origin || '').trim().replace(/\/$/, '');
  return normalizedOrigin ? `${normalizedOrigin}/form/${token}` : `/form/${token}`;
}

import type { Campaign, Influencer } from '@/types';
import { summarizeCampaignPostsFromNotes } from './campaign-posts.js';

export const ENGAGEMENT_UNAVAILABLE_TAG = '非公開または削除済み';

export const CAMPAIGN_OPS_FILTER_KEYS = [
  'needsInput',
  'missingItemCode',
  'missingCost',
  'missingPostUrl',
  'missingEngagement',
] as const;

export type CampaignOpsFilterKey = (typeof CAMPAIGN_OPS_FILTER_KEYS)[number];
export type CampaignOpsIssue = Exclude<CampaignOpsFilterKey, 'needsInput'>;

type CampaignOpsFields = Pick<
  Campaign,
  'item_code' | 'product_cost' | 'post_url' | 'post_date' | 'notes' | 'likes' | 'comments'
>;

type CampaignPaymentFields = {
  agreed_amount: number | null;
  post_url: string | null;
  post_date: string | null;
  notes: string | null;
};

type InfluencerPaymentFields = Pick<
  Influencer,
  'bank_name' | 'bank_branch' | 'account_number' | 'account_holder'
>;

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function isBlank(value: unknown): boolean {
  return !normalizeOptionalString(value);
}

export function extractCampaignTags(notes: string | null | undefined): string[] {
  const source = String(notes || '');
  const match = source.match(/\[TAGS:(.*?)\]/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function hasUnavailableEngagementTag(notes: string | null | undefined): boolean {
  return extractCampaignTags(notes).includes(ENGAGEMENT_UNAVAILABLE_TAG);
}

export function resolveCampaignRepresentativePost(
  campaign: Pick<Campaign, 'post_url' | 'post_date' | 'notes'> | null | undefined
) {
  const postSummary = summarizeCampaignPostsFromNotes(campaign?.notes ?? null);

  return {
    post_url: normalizeOptionalString(campaign?.post_url) || postSummary.post_url,
    post_date: normalizeOptionalString(campaign?.post_date) || postSummary.post_date,
  };
}

export function getCampaignOpsIssues(
  campaign: CampaignOpsFields | null | undefined
): CampaignOpsIssue[] {
  if (!campaign) return [];

  const issues: CampaignOpsIssue[] = [];
  const representativePost = resolveCampaignRepresentativePost(campaign);
  const hasPost = Boolean(representativePost.post_url);
  const isEngagementUnavailable = hasUnavailableEngagementTag(campaign.notes);
  const likes = Number(campaign.likes || 0);
  const comments = Number(campaign.comments || 0);

  if (isBlank(campaign.item_code)) issues.push('missingItemCode');
  if (Number(campaign.product_cost || 0) <= 0) issues.push('missingCost');
  if (!hasPost) issues.push('missingPostUrl');
  if (hasPost && !isEngagementUnavailable && likes <= 0 && comments <= 0) {
    issues.push('missingEngagement');
  }

  return issues;
}

export function campaignNeedsInput(campaign: CampaignOpsFields | null | undefined): boolean {
  return getCampaignOpsIssues(campaign).length > 0;
}

export function isPaidCampaign(
  campaign: { agreed_amount: number | null } | null | undefined
): boolean {
  return Number(campaign?.agreed_amount || 0) > 0;
}

export function hasPaymentProfile(
  influencer: InfluencerPaymentFields | null | undefined
): boolean {
  if (!influencer) return false;

  return Boolean(
    influencer.bank_name &&
      influencer.bank_branch &&
      influencer.account_number &&
      influencer.account_holder
  );
}

export function isCampaignVisibleInPayments(args: {
  campaign: CampaignPaymentFields | null | undefined;
  influencer: InfluencerPaymentFields | null | undefined;
}): boolean {
  const { campaign, influencer } = args;
  if (!isPaidCampaign(campaign)) return false;
  if (!hasPaymentProfile(influencer)) return false;

  const representativePost = resolveCampaignRepresentativePost(campaign);
  return Boolean(representativePost.post_url);
}

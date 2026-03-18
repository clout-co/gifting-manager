import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeCampaignPostsToMeta } from './campaign-posts.ts';
import {
  campaignNeedsInput,
  getCampaignOpsIssues,
  hasUnavailableEngagementTag,
  isCampaignVisibleInPayments,
  resolveCampaignRepresentativePost,
} from './campaign-requirements.ts';

test('resolveCampaignRepresentativePost falls back to notes metadata', () => {
  const notes = encodeCampaignPostsToMeta([
    {
      post_date: '2026-03-12',
      post_url: 'https://example.com/posts/latest',
      likes: 120,
      comments: 8,
      consideration_comment: 2,
      engagement_date: '2026-03-13',
    },
  ]);

  assert.deepEqual(
    resolveCampaignRepresentativePost({
      post_date: null,
      post_url: null,
      notes,
    }),
    {
      post_date: '2026-03-12',
      post_url: 'https://example.com/posts/latest',
    }
  );
});

test('getCampaignOpsIssues does not flag missingPostUrl when notes metadata already has a post', () => {
  const notes = encodeCampaignPostsToMeta([
    {
      post_date: '2026-03-12',
      post_url: 'https://example.com/posts/latest',
      likes: 0,
      comments: 0,
      consideration_comment: 0,
      engagement_date: '2026-03-13',
    },
  ]);

  assert.deepEqual(
    getCampaignOpsIssues({
      item_code: 'TL-001',
      product_cost: 1000,
      post_date: null,
      post_url: null,
      notes,
      likes: 0,
      comments: 0,
    }),
    ['missingEngagement']
  );
});

test('hasUnavailableEngagementTag suppresses missingEngagement', () => {
  const notes = '[TAGS:非公開または削除済み]';

  assert.equal(hasUnavailableEngagementTag(notes), true);
  assert.deepEqual(
    getCampaignOpsIssues({
      item_code: 'TL-001',
      product_cost: 1000,
      post_date: null,
      post_url: 'https://example.com/posts/live',
      notes,
      likes: 0,
      comments: 0,
    }),
    []
  );
});

test('campaignNeedsInput is true when any operational gap remains', () => {
  assert.equal(
    campaignNeedsInput({
      item_code: '',
      product_cost: 1000,
      post_date: null,
      post_url: null,
      notes: null,
      likes: 0,
      comments: 0,
    }),
    true
  );
});

test('isCampaignVisibleInPayments accepts notes-derived representative post and complete bank info', () => {
  const notes = encodeCampaignPostsToMeta([
    {
      post_date: '2026-03-12',
      post_url: 'https://example.com/posts/latest',
      likes: 120,
      comments: 8,
      consideration_comment: 2,
      engagement_date: '2026-03-13',
    },
  ]);

  assert.equal(
    isCampaignVisibleInPayments({
      campaign: {
        agreed_amount: 20000,
        post_date: null,
        post_url: null,
        notes,
      },
      influencer: {
        bank_name: '三菱UFJ銀行',
        bank_branch: '渋谷支店',
        account_number: '1234567',
        account_holder: 'テスト タロウ',
      },
    }),
    true
  );
});

test('isCampaignVisibleInPayments rejects incomplete payout profile', () => {
  assert.equal(
    isCampaignVisibleInPayments({
      campaign: {
        agreed_amount: 20000,
        post_date: '2026-03-12',
        post_url: 'https://example.com/posts/latest',
        notes: null,
      },
      influencer: {
        bank_name: '三菱UFJ銀行',
        bank_branch: null,
        account_number: '1234567',
        account_holder: 'テスト タロウ',
      },
    }),
    false
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInfluencerFormUrl,
  getInfluencerFormTokenStatus,
} from './influencer-form-token.ts';

test('getInfluencerFormTokenStatus returns none without token', () => {
  assert.equal(
    getInfluencerFormTokenStatus({
      form_token: null,
      form_token_expires_at: null,
      form_token_used_at: null,
    }),
    'none'
  );
});

test('getInfluencerFormTokenStatus returns active for unused future token', () => {
  assert.equal(
    getInfluencerFormTokenStatus({
      form_token: 'abc',
      form_token_expires_at: '2099-01-01T00:00:00.000Z',
      form_token_used_at: null,
    }),
    'active'
  );
});

test('getInfluencerFormTokenStatus returns used before expiry', () => {
  assert.equal(
    getInfluencerFormTokenStatus({
      form_token: 'abc',
      form_token_expires_at: '2099-01-01T00:00:00.000Z',
      form_token_used_at: '2026-03-18T00:00:00.000Z',
    }),
    'used'
  );
});

test('getInfluencerFormTokenStatus returns expired when expiry is in the past', () => {
  assert.equal(
    getInfluencerFormTokenStatus({
      form_token: 'abc',
      form_token_expires_at: '2000-01-01T00:00:00.000Z',
      form_token_used_at: null,
    }),
    'expired'
  );
});

test('buildInfluencerFormUrl returns relative path without origin', () => {
  assert.equal(buildInfluencerFormUrl('token-123'), '/form/token-123');
});

test('buildInfluencerFormUrl joins origin and token cleanly', () => {
  assert.equal(
    buildInfluencerFormUrl('token-123', 'https://gifting-manager.vercel.app/'),
    'https://gifting-manager.vercel.app/form/token-123'
  );
});

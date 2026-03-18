import test from 'node:test'
import assert from 'node:assert/strict'

import {
  decodeCampaignPostsFromNotes,
  encodeCampaignPostsToMeta,
  stripCampaignPostMeta,
  summarizeCampaignPosts,
  summarizeCampaignPostsFromNotes,
} from './campaign-posts.ts'

test('summarizeCampaignPostsFromNotes reconstructs representative post URL from notes metadata', () => {
  const notes = [
    'freeform memo',
    encodeCampaignPostsToMeta([
      {
        post_date: '2026-03-10',
        post_url: 'https://example.com/posts/old',
        likes: 120,
        comments: 8,
        consideration_comment: 1,
        engagement_date: '2026-03-11',
      },
      {
        post_date: '2026-03-12',
        post_url: 'https://example.com/posts/latest',
        likes: 200,
        comments: 20,
        consideration_comment: 2,
        engagement_date: '2026-03-13',
      },
    ]).trim(),
  ].join('\n')

  const summary = summarizeCampaignPostsFromNotes(notes)

  assert.deepEqual(summary, {
    post_date: '2026-03-12',
    post_url: 'https://example.com/posts/latest',
    likes: 320,
    comments: 28,
    consideration_comment: 3,
    engagement_date: '2026-03-13',
  })
})

test('campaign post metadata round-trip preserves unavailable posts and strips notes cleanly', () => {
  const notes = [
    'staff note',
    encodeCampaignPostsToMeta([
      {
        sort_order: 5,
        post_date: '2026-03-15',
        post_url: 'https://example.com/posts/live',
        likes: 999,
        comments: 33,
        consideration_comment: 4,
        engagement_date: '2026-03-16',
      },
      {
        sort_order: 6,
        post_date: '',
        post_url: '',
        likes: 10,
        comments: 5,
        consideration_comment: 2,
        engagement_date: '',
        is_unavailable: true,
      },
    ]).trim(),
  ].join('\n')

  assert.equal(stripCampaignPostMeta(notes), 'staff note')

  const decoded = decodeCampaignPostsFromNotes(notes)
  assert.equal(decoded.length, 2)
  assert.deepEqual(decoded[1], {
    sort_order: 6,
    post_date: null,
    post_url: null,
    likes: 0,
    comments: 0,
    consideration_comment: 0,
    engagement_date: null,
    is_unavailable: true,
  })

  const summary = summarizeCampaignPosts(decoded)
  assert.equal(summary.post_url, 'https://example.com/posts/live')
  assert.equal(summary.likes, 999)
})

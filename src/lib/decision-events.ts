import type { DecisionEventPayload } from '@/lib/clout-master'

type BrandCode = 'TL' | 'BE' | 'AM'

type CampaignOperation =
  | 'campaign_created'
  | 'campaign_updated'
  | 'campaign_deleted'
  | 'campaign_bulk_deleted'

type InfluencerOperation =
  | 'influencer_created'
  | 'influencer_updated'
  | 'influencer_deleted'

function normalizeProductCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
  return normalized || null
}

function sanitizeMetrics(input: Record<string, number | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value
    }
  }
  return out
}

export function buildCampaignDecisionEvent(params: {
  requestId: string
  operation: CampaignOperation
  brand: BrandCode
  campaignId: string | null
  productCode?: string | null
  staffId?: string | null
  metrics?: Record<string, number | null | undefined>
  payload?: Record<string, unknown>
}): DecisionEventPayload {
  const occurredAt = new Date().toISOString()
  const productCode = normalizeProductCode(params.productCode)

  if (!productCode && params.operation !== 'campaign_bulk_deleted') {
    return {
      request_id: params.requestId,
      source_app: 'gifting-app',
      event_type: 'data_quality_alert',
      occurred_at: occurredAt,
      brand_code: params.brand,
      product_code: null,
      campaign_id: params.campaignId,
      staff_id: params.staffId || null,
      metrics: { missing_product_code: 1 },
      payload: {
        operation: params.operation,
        reason: 'missing_product_code',
        ...params.payload,
      },
    }
  }

  if (params.operation === 'campaign_bulk_deleted') {
    return {
      request_id: params.requestId,
      source_app: 'gifting-app',
      event_type: 'direction_decision',
      occurred_at: occurredAt,
      brand_code: params.brand,
      product_code: null,
      campaign_id: null,
      staff_id: params.staffId || null,
      metrics: sanitizeMetrics({
        deleted_count: 0,
        ...(params.metrics || {}),
      }),
      payload: {
        operation: params.operation,
        ...params.payload,
      },
    }
  }

  return {
    request_id: params.requestId,
    source_app: 'gifting-app',
    event_type: 'execution_outcome',
    occurred_at: occurredAt,
    brand_code: params.brand,
    product_code: productCode,
    campaign_id: params.campaignId,
    staff_id: params.staffId || null,
    metrics: sanitizeMetrics({
      event_count: 1,
      ...(params.metrics || {}),
    }),
    payload: {
      operation: params.operation,
      ...params.payload,
    },
  }
}

export function buildInfluencerDecisionEvent(params: {
  requestId: string
  operation: InfluencerOperation
  brand: BrandCode
  influencerId: string
  metrics?: Record<string, number | null | undefined>
  payload?: Record<string, unknown>
}): DecisionEventPayload {
  return {
    request_id: params.requestId,
    source_app: 'gifting-app',
    event_type: 'direction_decision',
    occurred_at: new Date().toISOString(),
    brand_code: params.brand,
    product_code: null,
    campaign_id: null,
    staff_id: null,
    metrics: sanitizeMetrics({
      influencer_event_count: 1,
      ...(params.metrics || {}),
    }),
    payload: {
      operation: params.operation,
      influencer_id: params.influencerId,
      ...params.payload,
    },
  }
}

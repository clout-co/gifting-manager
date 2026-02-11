import type { NextRequest } from 'next/server'
import { fetchCloutMaster } from '@/lib/clout-master'

type AuditLogInput = {
  action: string
  entity_type: string
  entity_id?: string
  entity_key?: string
  old_values?: unknown
  new_values?: unknown
  metadata?: Record<string, unknown>
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function writeAuditLog(request: NextRequest, input: AuditLogInput): Promise<void> {
  const actorDbId = String(request.headers.get('x-clout-user-db-id') || '').trim()
  const actorEmail = String(request.headers.get('x-clout-user-email') || '').trim()
  const actorClerkId = String(request.headers.get('x-clout-user-id') || '').trim()

  const { entity_id, ...rest } = input

  const payload = {
    ...rest,
    ...(entity_id && isUuid(entity_id) ? { entity_id } : null),
    actor_db_id: actorDbId && isUuid(actorDbId) ? actorDbId : undefined,
    actor_email: actorEmail || undefined,
    actor_clerk_id: actorClerkId || undefined,
  }

  try {
    const res = await fetchCloutMaster(request, '/api/audit/log', {
      method: 'POST',
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('audit log failed', res.status, text)
    }
  } catch (e) {
    console.warn('audit log failed', e)
  }
}

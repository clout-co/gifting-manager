export type AppPermissionLevel = 'none' | 'view' | 'edit' | 'approve' | 'admin'

export function parseAppPermissionLevel(headers: {
  get(name: string): string | null
}): AppPermissionLevel {
  const raw = String(headers.get('x-clout-app-permission-level') || '')
    .trim()
    .toLowerCase()

  if (raw === 'none' || raw === 'view' || raw === 'edit' || raw === 'approve' || raw === 'admin') {
    return raw
  }

  // Backward compatibility for older permission labels.
  if (raw === 'read' || raw === 'viewer') return 'view'
  if (raw === 'write' || raw === 'writer' || raw === 'editor') return 'edit'
  if (raw === 'owner' || raw === 'super_admin' || raw === 'super-admin') return 'admin'

  // Safer default: never grant write implicitly.
  return 'view'
}

const LEGACY_VIEW_CAN_WRITE = process.env.GIFTING_VIEW_LEVEL_CAN_WRITE !== 'false'

export function canWrite(level: AppPermissionLevel): boolean {
  if (level === 'edit' || level === 'approve' || level === 'admin') {
    return true
  }
  // In production ops, gifting-app users are currently provisioned with "view"
  // while still expected to register/update data. Keep writes enabled by default
  // until Dashboard permission rollout is fully migrated.
  if (level === 'view') {
    return LEGACY_VIEW_CAN_WRITE
  }
  return false
}

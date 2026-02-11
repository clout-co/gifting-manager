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

  // Safer default: never grant write implicitly.
  return 'view'
}

export function canWrite(level: AppPermissionLevel): boolean {
  return level === 'edit' || level === 'approve' || level === 'admin'
}


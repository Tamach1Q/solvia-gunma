import type { AdminView } from '../components/AppShell'

export type AdminLocation = { view: AdminView; inspectionId: string | null; siteId: string | null; repairId: string | null; reviewId: string | null }
const views: AdminView[] = ['monitoring', 'schedule', 'prep', 'photos', 'report', 'repairs', 'repair', 'karte', 'reportChecks', 'reportCheck', 'checkedReport', 'workReport']
export function readAdminLocation(hash: string): AdminLocation {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const candidate = params.get('view') as AdminView
  const view = views.includes(candidate) ? candidate : 'monitoring'
  return { view, inspectionId: params.get('inspection'), siteId: params.get('site'), repairId: params.get('repair'), reviewId: params.get('review') }
}
export function adminLocationHash(location: AdminLocation) {
  const params = new URLSearchParams({ view: location.view })
  if (['prep', 'photos', 'report'].includes(location.view) && location.inspectionId) params.set('inspection', location.inspectionId)
  if (location.view === 'karte' && location.siteId) params.set('site', location.siteId)
  if (location.view === 'repair' && location.repairId) params.set('repair', location.repairId)
  if (['reportCheck', 'checkedReport'].includes(location.view) && location.reviewId) params.set('review', location.reviewId)
  return `#${params}`
}

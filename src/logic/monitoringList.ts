import type { MonitoringStatus, Site, SiteState } from '../types'

export type MonitoringFilter = SiteState | 'すべて'
export type MonitoringSort = '状態' | '発電所名' | 'エリア' | '次回点検日'
export const monitoringStateOrder: SiteState[] = ['異常停止中', '修繕対応中', '経過観察', '現状維持（オーナー意向）', '復旧済', '正常', '管理外・解約済']
export type MonitoringListRow = { site: Site; state: SiteState | null; monitor: MonitoringStatus; next?: { scheduledOn: string } }

type Options = { query: string; state: MonitoringFilter; pendingOnly?: boolean; area: string; system: string; sort: MonitoringSort; page: number; pageSize: number }
export function monitoringList<T extends MonitoringListRow>(rows: T[], options: Options) {
  const search = options.query.trim().normalize('NFKC').toLowerCase()
  const filtered = rows.filter(({ site, state, monitor }) => `${site.name} ${site.address} ${site.monitoringSystem}`.normalize('NFKC').toLowerCase().includes(search)
    && (options.state === 'すべて' || state === options.state)
    && (!options.pendingOnly || monitor.detection?.needsReview)
    && (!options.area || site.area === options.area) && (!options.system || site.monitoringSystem === options.system))
  const rank = (row: MonitoringListRow) => row.state === null ? 0.5 : monitoringStateOrder.indexOf(row.state)
  const ordered = [...filtered].sort((a, b) => {
    const byName = a.site.name.localeCompare(b.site.name, 'ja', { numeric: true })
    if (options.sort === '発電所名') return byName
    if (options.sort === 'エリア') return a.site.area.localeCompare(b.site.area, 'ja') || byName
    if (options.sort === '次回点検日') return (a.next?.scheduledOn ?? '9999').localeCompare(b.next?.scheduledOn ?? '9999') || byName
    return rank(a) - rank(b) || byName
  })
  const pageSize = Math.max(1, Math.floor(options.pageSize))
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize))
  const page = Math.max(1, Math.min(pages, options.page))
  const start = (page - 1) * pageSize
  return { rows: ordered.slice(start, start + pageSize), total: ordered.length, page, pages, from: ordered.length ? start + 1 : 0, to: Math.min(start + pageSize, ordered.length) }
}

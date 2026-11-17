// MOCK: 発電所・オーナー・点検履歴・修繕案件はすべて架空のシードデータ。日付は実行日を基準に相対で生成する。
import { visualItems } from '../config/visualItems'
import { addDays, addYears, daysInMonth, toDateString } from '../logic/dates'
import { buildMeasurementEntries, judgeMeasurements, measurementKey } from '../logic/judge'
import { findCircuit } from '../logic/site'
import type { Area, ArrayLayout, Finding, Inspection, InspectionPhoto, InspectionStatus, Pcs, RepairCase, ReportReview, Site, VisualEntry, Weather } from '../types'
import { createReviewSeed } from './reportReviews'
import { syncReportReview } from '../logic/reportWorkflow'
import { checkReport, reportFingerprint } from '../logic/reportCheck'

// photos：同じ端末で現場入力したときの写真（共有URLモードの写真はNetlify Blobsに保存する）
export interface DemoState { version: 1; seedVersion: number; seededOn: string; sites: Site[]; inspections: Inspection[]; repairCases: RepairCase[]; photos: InspectionPhoto[]; reportReviews: ReportReview[] }

// シードの中身（発電所構成・履歴・シナリオ）を変えたら上げる。保存データと食い違うとシードを作り直す。
export const seedVersion = 9

export const demoSiteId = 'S-03'
export const inspectorName = '点検担当 A'

type SiteSpec = {
  siteId: string; name: string; area: Area; address: string; owner: string; monitoringSystem: string
  pcs: { maker: string; model: string; ratedKw: number; count: number }
  module: { model: string; vocPerModule: number; pmaxW: number }
  // [アレイID, 段数, 列数]。1段＝1回路（列数＝直列数）で、段を上から順にPCSへ均等に割り当てる。
  arrays: [string, number, number][]
  connectedYearsAgo: number; groundingRelaxed?: boolean
  visitOffsetDays: number; pastYears: number[]
}

const pcs55 = (maker: string, model: string) => ({ maker, model, ratedKw: 5.5, count: 9 })
const pcs99 = (maker: string, model: string) => ({ maker, model, ratedKw: 9.9, count: 5 })
const module330 = { model: 'SV-M330', vocPerModule: 40.1, pmaxW: 330 }
const module375 = { model: 'SV-M375', vocPerModule: 41.5, pmaxW: 375 }

const specs: SiteSpec[] = [
  { siteId: 'S-01', name: '前橋市 第1太陽光発電所', area: '前橋市', address: '群馬県前橋市富士見町石井', owner: '井上 正', monitoringSystem: 'エコめがね', pcs: pcs55('ダイヤゼブラ電機', 'DZ-S55'), module: module330, arrays: [['A', 9, 10], ['B', 9, 10]], connectedYearsAgo: 9, visitOffsetDays: -12, pastYears: [1, 2] },
  { siteId: 'S-02', name: '前橋市 第4太陽光発電所', area: '前橋市', address: '群馬県前橋市粕川町中之沢', owner: '松尾 久美子', monitoringSystem: 'ラプラス', pcs: pcs99('新電元', 'PVS-S99'), module: module375, arrays: [['A', 8, 11], ['B', 7, 11]], connectedYearsAgo: 7, visitOffsetDays: -12, pastYears: [1] },
  { siteId: 'S-03', name: '渋川市 第2太陽光発電所', area: '渋川市', address: '群馬県渋川市赤城町樽', owner: '山田 一郎', monitoringSystem: '新電元', pcs: { maker: '新電元', model: 'PVS-S55', ratedKw: 5.5, count: 3 }, module: { model: 'SV-M370', vocPerModule: 41, pmaxW: 370 }, arrays: [['A', 3, 9], ['B', 3, 9]], connectedYearsAgo: 6, visitOffsetDays: 0, pastYears: [1, 2, 3] },
  { siteId: 'S-04', name: '渋川市 第5太陽光発電所', area: '渋川市', address: '群馬県渋川市北橘町箱田', owner: '古賀 隆', monitoringSystem: 'エコめがね', pcs: pcs55('ダイヤゼブラ電機', 'DZ-S55'), module: module375, arrays: [['A', 9, 9], ['B', 9, 9]], connectedYearsAgo: 4, visitOffsetDays: 0, pastYears: [1, 2] },
  { siteId: 'S-05', name: '高崎市 第1太陽光発電所', area: '高崎市', address: '群馬県高崎市箕郷町富岡', owner: '堤 恵子', monitoringSystem: 'エコめがね', pcs: pcs55('ダイヤゼブラ電機', 'DZ-S55'), module: module330, arrays: [['A', 10, 10], ['B', 8, 10]], connectedYearsAgo: 10, groundingRelaxed: true, visitOffsetDays: -5, pastYears: [1, 2] },
  { siteId: 'S-06', name: '高崎市 第3太陽光発電所', area: '高崎市', address: '群馬県高崎市吉井町多胡', owner: '江藤 修', monitoringSystem: 'ラプラス', pcs: pcs99('新電元', 'PVS-S99'), module: module375, arrays: [['A', 15, 11]], connectedYearsAgo: 5, visitOffsetDays: -5, pastYears: [1] },
  { siteId: 'S-07', name: '伊勢崎市 第1太陽光発電所', area: '伊勢崎市', address: '群馬県伊勢崎市境上武士', owner: '中村 和子', monitoringSystem: '新電元', pcs: pcs55('新電元', 'PVS-S55'), module: module375, arrays: [['A', 9, 9], ['B', 9, 9]], connectedYearsAgo: 8, visitOffsetDays: 1, pastYears: [1, 2] },
  { siteId: 'S-08', name: '沼田市 第2太陽光発電所', area: '沼田市', address: '群馬県沼田市利根町追貝', owner: '大坪 健二', monitoringSystem: 'ラプラス', pcs: pcs55('新電元', 'PVS-S55'), module: module330, arrays: [['A', 6, 10], ['B', 6, 10], ['C', 6, 10]], connectedYearsAgo: 9, visitOffsetDays: 3, pastYears: [1] },
]

// 同じ入力からは毎回同じ値になる疑似乱数（シードを作り直しても数値が変わらないように）
export function seededRandom(text: string) {
  let state = [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function buildSite(spec: SiteSpec, today: string): Site {
  const arrays: ArrayLayout[] = spec.arrays.map(([id, rows, cols]) => ({ arrayId: id, label: `アレイ${id}`, rows, cols }))
  const rows = arrays.flatMap(array => Array.from({ length: array.rows }, (_, index) => ({ array, row: index + 1 })))
  const perPcs = rows.length / spec.pcs.count
  if (!Number.isInteger(perPcs)) throw new Error(`${spec.siteId}: ${rows.length}回路を${spec.pcs.count}台のPCSに均等に割り当てられません`)
  const pcs: Pcs[] = Array.from({ length: spec.pcs.count }, (_, pcsIndex) => ({
    pcsId: `PCS-${pcsIndex + 1}`, maker: spec.pcs.maker, model: spec.pcs.model, ratedKw: spec.pcs.ratedKw, gridType: '単相3線',
    circuits: rows.slice(pcsIndex * perPcs, (pcsIndex + 1) * perPcs).map(({ array, row }, index) => ({ circuitId: `PCS-${pcsIndex + 1}/回路${index + 1}`, seriesCount: array.cols, arrayId: array.arrayId, rows: [row] })),
  }))
  return {
    siteId: spec.siteId, name: spec.name, area: spec.area, address: spec.address, capacityKw: Math.round(spec.pcs.ratedKw * spec.pcs.count * 10) / 10, owner: spec.owner,
    gridConnectedOn: addDays(addYears(today, -spec.connectedYearsAgo), -40), monitoringSystem: spec.monitoringSystem,
    module: { ...spec.module, count: arrays.reduce((sum, array) => sum + array.rows * array.cols, 0) },
    pcs, arrays, groundingClass: 'D', groundingRelaxed: Boolean(spec.groundingRelaxed),
  }
}

// もっともらしい測定値（ばらつきあり）。overridesで特定の欄だけ値を指定する。
export function sampleMeasurementRaws(site: Site, random: () => number, overrides: Record<string, string> = {}): Record<string, string> {
  const temperatureFactor = 0.95 + random() * 0.03
  const raws: Record<string, string> = {}
  for (const entry of buildMeasurementEntries(site)) {
    const circuit = findCircuit(site, entry.circuitId)
    raws[entry.key] = String({
      DC開放電圧: () => Math.round((circuit?.seriesCount ?? 0) * site.module.vocPerModule * temperatureFactor * (0.99 + random() * 0.02)),
      // 回路ごとの基準値（60〜110MΩ）に年ごとの揺れ±8%。乱数だけで低下傾向（初回比−30%）や前回比50%未満が出ないようにする
      DC絶縁抵抗: () => Math.round((60 + seededRandom(`${site.siteId}:${entry.key}`)() * 50) * (0.92 + random() * 0.16)),
      AC絶縁抵抗: () => Math.round(150 + random() * 350),
      系統電圧UO: () => 101 + Math.round(random() * 4),
      系統電圧WO: () => 101 + Math.round(random() * 4),
      接地抵抗_PCS: () => Math.round(12 + random() * 25),
      接地抵抗_架台: () => Math.round(20 + random() * 40),
    }[entry.kind]())
  }
  return { ...raws, ...overrides }
}

type InspectionSpec = { scheduledOn: string; status: InspectionStatus; overrides?: Record<string, string>; visual?: Record<string, { result: '×'; comment: string }>; findings?: Finding[] }

function buildInspection(site: Site, spec: InspectionSpec, previous?: Inspection): Inspection {
  const inspectionId = `INS-${site.siteId}-${spec.scheduledOn.replaceAll('-', '')}`
  const empty: Inspection = { inspectionId, siteId: site.siteId, scheduledOn: spec.scheduledOn, inspector: inspectorName, status: spec.status, visual: visualItems.map(item => ({ itemId: item.itemId, result: null, comment: '', photoIds: [] })), measurements: buildMeasurementEntries(site), findings: [] }
  if (spec.status !== '完了') return empty
  const random = seededRandom(inspectionId)
  const weather: Weather = random() < 0.7 ? '晴れ' : '曇り'
  const raws = sampleMeasurementRaws(site, random, spec.overrides)
  const visual: VisualEntry[] = empty.visual.map(entry => ({ ...entry, result: spec.visual?.[entry.itemId]?.result ?? '○', comment: spec.visual?.[entry.itemId]?.comment ?? '' }))
  const measurements = judgeMeasurements(empty.measurements.map(entry => ({ ...entry, raw: raws[entry.key] })), site, weather, previous?.measurements)
  return { ...empty, inspectedOn: spec.scheduledOn, weather, visual, measurements, findings: spec.findings ?? [] }
}

export function createSeed(now = new Date()): DemoState {
  const today = toDateString(now)
  const monthEnd = daysInMonth(now)
  const sites = specs.map(spec => buildSite(spec, today))
  const inspections: Inspection[] = []
  const repairCases: RepairCase[] = []
  sites.forEach((site, index) => {
    const spec = specs[index]
    const visitDay = Math.min(Math.max(now.getDate() + spec.visitOffsetDays, 1), monthEnd)
    const thisVisit = toDateString(new Date(now.getFullYear(), now.getMonth(), visitDay))
    let previous: Inspection | undefined
    for (const yearsAgo of [...spec.pastYears].sort((a, b) => b - a)) {
      const scheduledOn = addYears(thisVisit, -yearsAgo)
      const past = buildInspection(site, { scheduledOn, status: '完了', ...pastFindings(site, yearsAgo) }, previous)
      inspections.push(past)
      repairCases.push(...pastRepairs(site, past, yearsAgo))
      previous = past
    }
    const done = thisVisit < today
    const current = buildInspection(site, { scheduledOn: thisVisit, status: done ? '完了' : '未依頼' }, previous)
    inspections.push(current)
    if (done) inspections.push(buildInspection(site, { scheduledOn: addYears(thisVisit, 1), status: '未依頼' }))
  })
  let state: DemoState = { version: 1, seedVersion, seededOn: today, sites, inspections, repairCases, photos: [], reportReviews: createReviewSeed(sites, inspections, now) }
  const pending = state.reportReviews.filter(review => review.status === 'チェック待ち' && review.inspection.scheduledOn.startsWith(today.slice(0, 7)))
  const pendingIds = new Set(pending.map(review => review.inspection.inspectionId))
  state.inspections = state.inspections.filter(item => !pending.some(review => item.siteId === review.siteId && item.scheduledOn === addYears(review.inspection.scheduledOn, 1)))
  state.reportReviews = state.reportReviews.map(review => pendingIds.has(review.inspection.inspectionId) ? { ...review, inspection: { ...review.inspection, status: '報告書作成済み' } } : review)
  state.inspections = state.inspections.map(item => pendingIds.has(item.inspectionId) ? { ...item, status: '報告書作成済み' } : item)
  for (const review of state.reportReviews) state = syncReportReview(state, review)
  state.reportReviews = state.reportReviews.map(review => {
    const site = sites.find(item => item.siteId === review.siteId)!
    return review.check ? { ...review, check: { ...review.check, fingerprint: reportFingerprint(review, site), issues: checkReport(review, site) } } : review
  })
  return state
}

// 発電所ごとの過去の指摘。デモ対象（渋川市 第2）はPCS-2 回路2の絶縁抵抗が 25→18→12MΩ と低下し、前回はアレイB周辺の雑草を指摘。
function pastFindings(site: Site, yearsAgo: number): Pick<InspectionSpec, 'overrides' | 'visual' | 'findings'> {
  if (site.siteId === demoSiteId) {
    const overrides = { [measurementKey('DC絶縁抵抗', 'PCS-2', 'PCS-2/回路2')]: { 3: '25', 2: '18', 1: '12' }[yearsAgo] ?? '' }
    if (yearsAgo !== 1) return { overrides }
    return { overrides, visual: { 'AR-07': { result: '×', comment: 'アレイB北側に雑草が伸び、下段モジュールに影がかかっている' } }, findings: [{ findingId: 'F-S03-WEEDS', source: 'visual', refKey: 'AR-07', arrayId: 'B', comment: 'アレイB北側の雑草（下段に影）', photoIds: [] }] }
  }
  if (site.siteId === 'S-07' && yearsAgo === 1) return { visual: { 'JB-05': { result: '×', comment: '接続箱2のSPD表示窓が赤色（劣化表示）' } }, findings: [{ findingId: 'F-S07-SPD', source: 'visual', refKey: 'JB-05', comment: '接続箱2のSPD劣化表示', photoIds: [] }] }
  if (site.siteId === 'S-08' && yearsAgo === 1) return { overrides: { [measurementKey('DC絶縁抵抗', 'PCS-1', 'PCS-1/回路1')]: '1.1' } }
  return {}
}

function pastRepairs(site: Site, inspection: Inspection, yearsAgo: number): RepairCase[] {
  const date = inspection.inspectedOn!
  if (site.siteId === demoSiteId && yearsAgo === 1) return [{ caseId: 'RC-S03-WEEDS', siteId: site.siteId, inspectionId: inspection.inspectionId, findingId: 'F-S03-WEEDS', title: 'アレイB周辺の除草', status: '完了', customerDecision: 'その他（作業実施）', decidedOn: addDays(date, 6), workNote: 'アレイB北側を除草し、防草シートの浮きを補修', afterPhotoIds: [] }]
  if (site.siteId === 'S-07' && yearsAgo === 1) return [{ caseId: 'RC-S07-SPD', siteId: site.siteId, inspectionId: inspection.inspectionId, findingId: 'F-S07-SPD', title: '接続箱2 SPD交換', status: '作業予定', customerDecision: '交換', decidedOn: addDays(date, 12), afterPhotoIds: [] }]
  return []
}

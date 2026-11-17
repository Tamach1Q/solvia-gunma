import { describe, expect, it } from 'vitest'
import { applyScenario, scenarioPhotoId, scenarioPhotos } from '../mock/scenario'
import { createSeed, demoSiteId } from '../mock/seed'
import { pastInspections } from './history'
import { buildReportText, defaultReportLayout, groupFindings, inspectionPhotos, overallCounts, reportIssues, reportSummary } from './report'

const seed = createSeed(new Date(2026, 9, 28))
const site = seed.sites.find(item => item.siteId === demoSiteId)!
const current = seed.inspections.find(item => item.siteId === demoSiteId && item.status === '未依頼')!
const previous = pastInspections(seed.inspections, current).at(-1)
const filled = { ...applyScenario(current, site, previous), inspectedOn: '2026-10-28' }

describe('報告書の文章', () => {
  it('総合判定：目視20＋測定25のうち、要対応2件（絶縁抵抗の不適合とパネル割れ）', () => {
    expect(overallCounts(filled)).toEqual({ total: 45, visualCount: 20, measurementCount: 25, needsAction: 2, caution: 0, ok: 43 })
  })
  it('総合所見は点検データから作る', () => {
    expect(reportSummary(filled, site)).toBe('2026年10月28日、渋川市 第2太陽光発電所の定期点検（目視20項目・測定25項目）を実施しました。2件で対応が必要な状態を確認しました。内容とご提案は以下のとおりです。')
  })
  it('指摘がなければ所見も変わる（固定文ではない）', () => {
    const clean = { ...filled, visual: filled.visual.map(entry => ({ ...entry, result: '○' as const })), measurements: filled.measurements.map(entry => ({ ...entry, judgement: '適合' as const })) }
    expect(reportSummary(clean, site)).toContain('対応が必要な項目はありませんでした。')
    expect(buildReportText(clean, site, previous).proposals).toEqual([])
  })
  it('ご提案は割れと絶縁低下をまとめた交換の提案1件', () => {
    const { proposals } = buildReportText(filled, site, previous)
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toContain('アレイB 1段目5列目のモジュールに割れ')
    expect(proposals[0]).toContain('0.3MΩ（基準0.4MΩ以上）')
    expect(proposals[0]).toContain('交換と、交換後の絶縁抵抗の再測定をご提案します')
  })
})

describe('報告書の写真', () => {
  it('目視×・異常箇所にひも付く写真だけを、重複なく集める', () => {
    expect(inspectionPhotos(filled, scenarioPhotos(filled.inspectionId)).map(photo => photo.photoId)).toEqual([scenarioPhotoId(filled.inspectionId)])
  })
  it('異常箇所の写真は「異常箇所の詳細」に置く', () => {
    expect(defaultReportLayout(filled, scenarioPhotos(filled.inspectionId))).toEqual([{ photoId: scenarioPhotoId(filled.inspectionId), zone: 'findings' }])
  })
})

describe('指摘の一覧', () => {
  it('測定の不適合と目視の×を、異常箇所と一緒に並べる', () => {
    expect(reportIssues(filled, site)).toEqual([
      { key: 'DC絶縁抵抗:PCS-2:PCS-2/回路2', title: 'PCS-2 回路2 絶縁抵抗（DC）', mark: '不適合', value: '0.3MΩ', detail: expect.stringMatching(/^基準0\.4MΩ以上/), location: 'アレイB 1段目5列目・PCS-2 回路2' },
      { key: 'AR-01', title: 'モジュール表面の汚れ・破損', mark: '×', detail: 'アレイB 1段目5列目のモジュール表面ガラスに割れ', location: 'アレイB 1段目5列目・PCS-2 回路2' },
    ])
  })
})

describe('異常箇所のまとめ', () => {
  it('同じ回路・同じパネル位置の2件（パネル割れと絶縁抵抗）は1枚にまとめる', () => {
    expect(groupFindings(filled.findings).map(group => group.map(finding => finding.refKey))).toEqual([['AR-01', 'DC絶縁抵抗:PCS-2:PCS-2/回路2']])
  })
  it('パネル位置が違う、または場所の指定がない指摘は別々', () => {
    const [panel, insulation] = filled.findings
    const moved = { ...insulation, panels: [{ row: 1, col: 6 }] }
    const unplaced = { ...insulation, findingId: 'F-X', arrayId: undefined, panels: undefined }
    expect(groupFindings([panel, moved])).toHaveLength(2)
    expect(groupFindings([panel, unplaced, { ...unplaced, findingId: 'F-Y' }])).toHaveLength(3)
  })
})

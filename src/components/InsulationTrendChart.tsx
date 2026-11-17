import { useState } from 'react'
import { formatNumber } from '../logic/format'
import { circuitLabel } from '../logic/labels'
import type { Judgement } from '../types'
import { JudgementMark } from './ui'

// after：修繕後の再測定（今回の点検のあと）。今回の点の半歩右に白抜きの点で描く。
export type TrendSeries = { key: string; circuitId: string; points: { date: string; value: number | null; label: string; judgement: Judgement }[]; after?: { value: number; label: string } }

const width = 760
const height = 300
const margin = { top: 16, right: 150, bottom: 36, left: 64 }
const plotWidth = width - margin.left - margin.right
const plotHeight = height - margin.top - margin.bottom

// 絶縁抵抗（DC）の推移。値が0.3〜100MΩ超と桁で広がるので対数目盛にする。
// 話の中心になる回路（emphasized）だけを点検ブルーで描き、ほかは灰色の背景にする（dataviz: emphasis）。
export function InsulationTrendChart({ series, dates, dateLabels, emphasized, threshold }: { series: TrendSeries[]; dates: string[]; dateLabels: string[]; emphasized: string[]; threshold: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const values = series.flatMap(item => [...item.points.map(point => point.value), item.after?.value ?? null]).filter((value): value is number => value !== null && value > 0)
  const minExp = Math.min(-1, Math.floor(Math.log10(Math.min(threshold, ...values))))
  const maxExp = Math.max(1, Math.ceil(Math.log10(Math.max(threshold, ...values))))
  const ticks = Array.from({ length: maxExp - minExp + 1 }, (_, index) => 10 ** (minExp + index))
  const hasAfter = series.some(item => item.after)
  const slots = dates.length - 1 + (hasAfter ? 0.5 : 0)
  const step = plotWidth / Math.max(slots, 1)
  const x = (index: number) => margin.left + (slots === 0 ? plotWidth / 2 : index * step)
  const y = (value: number) => margin.top + plotHeight - (Math.log10(value) - minExp) / (maxExp - minExp) * plotHeight
  const ordered = [...series.filter(item => !emphasized.includes(item.key)), ...series.filter(item => emphasized.includes(item.key))]
  const path = (item: TrendSeries) => item.points.map((point, index) => point.value ? `${index && item.points[index - 1].value ? 'L' : 'M'}${x(index)},${y(point.value)}` : '').join('')
  const lastIndex = dates.length - 1

  return <div className="trend-chart" onMouseLeave={() => setHover(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="回路ごとの絶縁抵抗（DC）の推移（対数目盛）。値は下の表にもあります。">
      {ticks.map(tick => <g key={tick}><line className="trend-grid" x1={margin.left} x2={margin.left + plotWidth} y1={y(tick)} y2={y(tick)} /><text className="trend-axis" x={margin.left - 8} y={y(tick) + 4} textAnchor="end">{formatNumber(tick)}MΩ</text></g>)}
      {dateLabels.map((label, index) => <text key={label} className="trend-axis" x={x(index)} y={height - 12} textAnchor="middle">{label}</text>)}
      <line className="trend-threshold" x1={margin.left} x2={margin.left + plotWidth} y1={y(threshold)} y2={y(threshold)} />
      {/* 右端は系列の直接ラベルが使うので、基準のラベルは左端の線の上に置く */}
      <text className="trend-axis" x={margin.left + 6} y={y(threshold) - 6}>基準 {formatNumber(threshold)}MΩ以上</text>
      {hover !== null && <line className="trend-crosshair" x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + plotHeight} />}
      {ordered.map(item => {
        const strong = emphasized.includes(item.key)
        return <g key={item.key} className={strong ? 'trend-series is-emphasized' : 'trend-series'} data-testid={strong ? 'trend-emphasized' : undefined}>
          <path d={path(item)} />
          {item.points.map((point, index) => point.value ? <circle key={point.date} cx={x(index)} cy={y(point.value)} r={strong ? 5 : 4} /> : null)}
        </g>
      })}
      {series.filter(item => item.after && item.points[lastIndex]?.value).map(item => {
        const strong = emphasized.includes(item.key)
        return <g key={item.key} className={`trend-after ${strong ? 'is-emphasized' : ''}`} data-testid="trend-after">
          <line x1={x(lastIndex)} y1={y(item.points[lastIndex].value!)} x2={x(lastIndex + 0.5)} y2={y(item.after!.value)} />
          <circle cx={x(lastIndex + 0.5)} cy={y(item.after!.value)} r={5} />
          {strong && <text x={x(lastIndex + 0.5) + 10} y={y(item.after!.value) + 4}>{item.after!.label}</text>}
        </g>
      })}
      {series.filter(item => emphasized.includes(item.key)).map(item => {
        const last = item.points[lastIndex]
        if (!last?.value) return null
        // 修繕後の点があるときは、右へ延びる線と重ならないよう今回の点の左下に置く
        return item.after
          ? <g key={item.key} className="trend-label"><text x={x(lastIndex) - 10} y={y(last.value) + 22} textAnchor="end">{circuitLabel(item.circuitId)} {last.label}</text></g>
          : <g key={item.key} className="trend-label"><line x1={x(lastIndex) + 10} x2={x(lastIndex) + 22} y1={y(last.value)} y2={y(last.value)} /><text x={x(lastIndex) + 26} y={y(last.value) + 4}>{circuitLabel(item.circuitId)} {last.label}</text></g>
      })}
      {dates.map((date, index) => <rect key={date} className="trend-hit" x={x(index) - step / 2} y={margin.top} width={step} height={plotHeight} onMouseEnter={() => setHover(index)} />)}
    </svg>
    {hover !== null && <div className="trend-tooltip" style={{ left: `${x(hover) / width * 100}%` }} role="status">
      <strong>{dateLabels[hover]}</strong>
      <ul>{[...series].sort((a, b) => Number(emphasized.includes(b.key)) - Number(emphasized.includes(a.key))).map(item => {
        const point = item.points[hover]
        return <li key={item.key} className={emphasized.includes(item.key) ? 'is-emphasized' : ''}><i />{circuitLabel(item.circuitId)}<span>{point?.label ?? '—'}</span>{point && point.judgement !== '適合' && point.judgement !== '未入力' && <JudgementMark judgement={point.judgement} />}</li>
      })}</ul>
    </div>}
  </div>
}

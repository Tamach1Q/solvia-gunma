import type { KeyboardEvent } from 'react'
import type { ArrayLayout } from '../types'

type Panel = { row: number; col: number }

// アレイ図。段（行）×列のグリッドで、選んだパネルを不適合色、担当回路の段を淡い色で示す。onToggleがあればタップで選べる。
export function ArrayDiagram({ array, selected = [], highlightRows = [], onToggle, compact }: { array: ArrayLayout; selected?: Panel[]; highlightRows?: number[]; onToggle?: (panel: Panel) => void; compact?: boolean }) {
  const cell = compact ? 22 : 30
  const gap = 4
  const labelWidth = 48
  const top = 22
  const width = labelWidth + array.cols * (cell + gap)
  const height = top + array.rows * (cell + gap)
  const isSelected = (row: number, col: number) => selected.some(panel => panel.row === row && panel.col === col)
  return <svg className={`array-diagram ${onToggle ? 'is-interactive' : ''}`} viewBox={`0 0 ${width} ${height}`} role={onToggle ? 'group' : 'img'} aria-label={`${array.label}（${array.rows}段×${array.cols}列）`}>
    {Array.from({ length: array.cols }, (_, index) => <text key={`c${index}`} className="array-col-label" x={labelWidth + index * (cell + gap) + cell / 2} y={14} textAnchor="middle">{index + 1}</text>)}
    {Array.from({ length: array.rows }, (_, rowIndex) => {
      const row = rowIndex + 1
      const y = top + rowIndex * (cell + gap)
      return <g key={row}>
        {highlightRows.includes(row) && <rect className="array-row-highlight" x={labelWidth - 4} y={y - 2} width={array.cols * (cell + gap)} height={cell + 4} rx={4} />}
        <text className="array-row-label" x={labelWidth - 10} y={y + cell / 2 + 4} textAnchor="end">{row}段</text>
        {Array.from({ length: array.cols }, (_, colIndex) => {
          const col = colIndex + 1
          const selectedPanel = isSelected(row, col)
          const label = `${array.label} ${row}段目${col}列目`
          return <rect key={col} className={`array-panel ${selectedPanel ? 'is-selected' : ''}`} x={labelWidth + colIndex * (cell + gap)} y={y} width={cell} height={cell} rx={3}
            {...(onToggle ? { role: 'checkbox', 'aria-checked': selectedPanel, 'aria-label': label, tabIndex: 0, onClick: () => onToggle({ row, col }), onKeyDown: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle({ row, col }) } } } : {})}
            data-testid={onToggle ? `panel-${array.arrayId}-${row}-${col}` : undefined}><title>{label}</title></rect>
        })}
      </g>
    })}
  </svg>
}

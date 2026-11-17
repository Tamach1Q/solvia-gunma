import { ArrowDownToLine, AudioLines, Bolt, Box, Bug, Cable, Construction, Fan, Fence, Frame, Gauge, Monitor, Plug, Power, Server, ShieldAlert, SolarPanel, Sprout, ToggleRight, Wrench, type LucideIcon } from 'lucide-react'

// 目視項目のイラスト（config/visualItems.ts の icon キー）。現場画面と報告書で同じものを使う。
const icons: Record<string, LucideIcon> = {
  module: SolarPanel, frame: Frame, mount: Construction, bolt: Bolt, ground: ArrowDownToLine, cable: Cable, surroundings: Sprout,
  box: Box, 'box-inside': Bug, terminal: Wrench, switch: ToggleRight, spd: ShieldAlert,
  pcs: Server, vent: Fan, noise: AudioLines, display: Monitor, 'pcs-wire': Plug,
  breaker: Power, meter: Gauge, fence: Fence,
}

export function VisualIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const Icon = icons[icon] ?? Box
  return <span className="visual-icon" aria-hidden="true"><Icon size={size} strokeWidth={1.6} /></span>
}

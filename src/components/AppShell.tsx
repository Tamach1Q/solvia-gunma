import logo from '../design-system/assets/kauelu-logo.png'
import { Activity, CalendarDays, ChevronRight, ClipboardCheck, FileSearch, FolderOpen, LogOut, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDateWithWeekday } from '../logic/format'
import type { Session } from '../services/session'
import { FeedbackButton } from './Feedback'

export type AdminView = 'monitoring' | 'schedule' | 'prep' | 'photos' | 'report' | 'repairs' | 'repair' | 'karte' | 'reportChecks' | 'reportCheck' | 'checkedReport'

const navSections: { label: string; items: { view: AdminView; label: string; icon: ReactNode }[] }[] = [
  { label: '運用管理', items: [{ view: 'monitoring', label: '統合監視', icon: <Activity size={18} /> }] },
  { label: '点検業務', items: [{ view: 'schedule', label: '点検予定', icon: <ClipboardCheck size={18} /> }, { view: 'reportChecks', label: '報告書チェック', icon: <FileSearch size={18} /> }, { view: 'repairs', label: '修繕案件', icon: <Wrench size={18} /> }, { view: 'karte', label: '発電所カルテ', icon: <FolderOpen size={18} /> }] },
]

const titles: Record<AdminView, string> = { monitoring: '統合監視', schedule: '点検予定', prep: '点検準備', photos: '写真確認', report: '点検報告書', repairs: '修繕案件', repair: '修繕案件の詳細', karte: '発電所カルテ', reportChecks: '報告書チェック', reportCheck: '報告書の確認', checkedReport: '提出された報告書' }
// 下の階層の画面は、ナビゲーションでは親の画面を現在地にする
const navOf: Record<AdminView, AdminView> = { monitoring: 'monitoring', schedule: 'schedule', prep: 'schedule', photos: 'schedule', report: 'schedule', repairs: 'repairs', repair: 'repairs', karte: 'karte', reportChecks: 'reportChecks', reportCheck: 'reportChecks', checkedReport: 'reportChecks' }

export function AppShell({ view, onNavigate, session, onSignOut, children }: { view: AdminView; onNavigate: (view: AdminView) => void; session: Session; onSignOut: () => void; children: ReactNode }) {
  return <div className="app-shell">
    <header className="ku-app-header workspace-header no-print"><img className="ku-app-header__logo" src={logo} alt="Kauelu" /><p className="ku-app-header__workspace">SOLVIA / 点検・保守管理</p><span className="workspace-date"><CalendarDays size={16} />{formatDateWithWeekday(new Date())}</span><FeedbackButton screen={titles[view]} /><div className="account-menu" data-testid="account-menu"><span className="ku-account" aria-hidden="true">{session.name.slice(0, 1)}</span><span className="account-name"><strong>{session.name}</strong><small>{session.company}</small></span><button className="button button-ghost" onClick={onSignOut} data-testid="sign-out"><LogOut />ログアウト</button></div></header>
    <aside className="sidebar no-print">
      <nav aria-label="メインメニュー">{navSections.map(section => <div className="nav-section" key={section.label}><span className="nav-label">{section.label}</span>{section.items.map(item => <button key={item.view} className={`nav-item ${navOf[view] === item.view ? 'active' : ''}`} onClick={() => onNavigate(item.view)} aria-current={navOf[view] === item.view ? 'page' : undefined} data-testid={`nav-${item.view}`}>{item.icon}{item.label}</button>)}</div>)}</nav>
    </aside>
    <main className="main">
      <header className="topbar no-print"><div><span>O&amp;M管理</span>{navOf[view] !== view && <><ChevronRight size={14} /><span>{titles[navOf[view]]}</span></>}<ChevronRight size={14} /><strong>{titles[view]}</strong></div><div><span className="date"><CalendarDays size={16} />{formatDateWithWeekday(new Date())}</span></div></header>
      {children}
    </main>
  </div>
}

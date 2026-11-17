// ログイン画面のためのアカウント。データはすべてサンプルなので、本物の認証はしない（ブラウザ内で照合するだけ）。
// 導入先ごとにここだけ変える。
export type AccountRole = '管理者' | '点検担当'
export type DemoAccount = { email: string; password: string; name: string; company: string; role: AccountRole }

export const demoAccounts: DemoAccount[] = [
  { email: 'admin@backup-system.demo', password: 'gunma1125', name: '田中', company: '株式会社バックアップシステム', role: '管理者' },
  { email: 'field@backup-system.demo', password: 'gunma1125', name: '点検担当', company: '株式会社バックアップシステム', role: '点検担当' },
  { email: 'staff@kauelu.demo', password: 'gunma1125', name: 'Kauelu', company: '株式会社Kauelu', role: '管理者' },
]

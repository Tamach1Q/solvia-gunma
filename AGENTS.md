# AGENTS.md

AIコーディングエージェント（Claude Code / Codex など）向けの作業ガイドです。人向けの概要は `README.md` を参照してください。

## プロジェクト概要

太陽光発電設備の定期点検の**操作デモ**。「点検予定 → 現場スマホ入力 → 報告書 → 修繕案件 → 次回点検」の1周を見せる。本番システムではない。仕様と進め方は `docs/SDD.md`（マイルストーンM0〜M6）、未決事項は `docs/OPEN_QUESTIONS.md`。

- フロント: React + TypeScript + Vite（`src/`）
- バックエンド: Netlify Functions + Netlify Blobs（`netlify/functions/inspection.ts`）。管理画面と現場画面の共有状態・写真のみを扱う
- 外部連携はすべてモック

## コマンド

```bash
npm install
npm run dev          # フロントのみ（http://127.0.0.1:5173）。Functionsは動かないので現場共有は失敗する
netlify dev          # Functions込みで起動（http://localhost:8888）。現場共有・写真を触るならこちら
npm run build        # tsc -b && vite build。型チェックはこれで行う（lintは無い）
npm test             # vitest（src/**/*.test.ts）。判定ロジック・シード・提案文・保存の単体テスト
npm run test:flow    # デモ台本どおりに1周するE2E。引数なしなら vite preview を自分で起動し、同じ端末のモードで確認（先に npm run build）
npm run test:flow -- http://localhost:8888   # netlify dev に対して実行すると共有URLモード（スマホ幅）で確認
```

- 初回は `npx playwright install chromium` が必要な場合がある。
- スクリーンショットは `artifacts/` に出力される（gitignore済み）。

## ディレクトリ構成

```
src/
  App.tsx                 管理画面のview state・DemoStateの保持と画面の切り替え
  components/
    AppShell.tsx          サイドバー（運用管理／点検業務）・ヘッダー（今日の日付）。AdminView型もここ
    AssignmentModal.tsx   現場への依頼モーダル（共有URL・入力状況・写真）
    ui.tsx                ステータスチップ・判定マーク
    ArrayDiagram.tsx      アレイ図（SVG、段×列）。現場の異常箇所指定と報告書で使う
    VisualIcon.tsx        目視項目のイラスト（icon キー → lucide）
    InsulationTrendChart.tsx 絶縁抵抗の推移（SVG、対数目盛、1系列を強調）
    ReportPhotoLayout.tsx 報告書への写真ドラッグ配置（ドロップゾーン・パレット）
  screens/                画面単位のコンポーネント（MonitoringScreen, ScheduleScreen, PrepScreen（結果確認を含む）, PhotoReviewScreen, ReportScreen, RepairScreens（一覧・詳細）, KarteScreen）
    field/                現場画面。FieldApp（開始→目視→測定→確認→提出）、SharedField（共有URL）、LocalField（同じ端末のスマホ枠）、FindingSheet、PhotoCapture
  config/                 判定基準（thresholds.ts、出典付き）、目視項目マスタ（visualItems.ts）、報告書の発行者（brand.ts）
  logic/                  UIに依存しない純粋関数。judge.ts（測定値の判定）、checkpoints.ts（今回の確認ポイント）、proposals.ts（ご提案文）、report.ts（総合判定・所見・指摘一覧・写真の初期配置）、repairs.ts（修繕案件の作成・進行・再測定）、lifecycle.ts（点検の完了：修繕案件と1年後の予定）、criteria.ts（基準の表記）、fieldCheck.ts（入力漏れ）、history.ts（過去の点検）、status.ts（ステータスの色と遷移）、format.ts（表示の書式）、site.ts（回路・パネルの対応）、dates.ts、labels.ts
  mock/                   シード（seed.ts）、デモ入力のシナリオ（scenario.ts）、監視データ（monitoring.ts）。すべて架空
  types.ts                ドメイン型（SDD 5章）
  services/
    demoStore.ts               管理側の状態をlocalStorage（solvia_gunma_v1）に保存・初期化。seedVersionが違えばシードを作り直す
    sharedInspectionService.ts 管理⇔現場の共有。Netlify Function を呼ぶ
netlify/functions/inspection.ts  共有状態と写真を Blobs に保存（create/save/submit/reset/upload）
scripts/flow-check.mjs           E2Eフローチェック
```

## アーキテクチャ上の約束

- **外部APIは必ず `src/services/` の境界越しに呼ぶ。** UIコンポーネントから外部APIの仕様を直接仮定しない。実在しないAPI仕様は仮定しない。
- **判定は `src/logic/judge.ts` の純粋関数だけで行う。** 基準値は `src/config/thresholds.ts` に集約し、UIや報告書にハードコードしない。測定欄は他の欄（開放電圧・他回路・前回値）に依存するので、1欄の変更でも `judgeMeasurements` で全体を再計算する。
- **設備構成は物理的に整合させる。** 回路はアレイの段（`Circuit.rows`）から作り、回路の枚数の合計＝アレイの枚数。パネル→回路は `circuitForPanel`。開放電圧・DC絶縁抵抗の比較相手は「発電所内で直列数が同じ全回路」。シードを変えたら `seedVersion` を上げる。
- **日付はハードコードしない。** シードは実行日から相対で作る（`createSeed(now)`）。日付文字列はローカル時刻の `YYYY-MM-DD`（`logic/dates.ts`）。
- **現場画面は2つのモードがある。** 共有URL（`?field=<token>` → `SharedField`、0.7秒ためて自動保存）と、Functionsに繋がらないときの同じ端末のモード（管理画面内のスマホ枠 → `LocalField`、DemoStateを直接編集、写真は縮小してDemoState.photosへ）。入力画面の本体（`FieldApp`）は共通で、データの出入りだけが違う。「残りを一括入力」は同じ端末のモードと、共有URLに `&fill=1` が付いているときだけ出す。共有URLを発行した後でも「この画面で現場入力を開く」で同じ端末のモードに切り替えられ、そのとき `Inspection.localField` を立てて共有URL側の入力を取り込まない。
- **報告書は点検データから作る。** 固定文は書かない。総合所見とご提案文は初めて開いたときに `buildReportText` で作り、`Inspection.reportText` に保存して画面で編集する。写真の配置は `Inspection.reportLayout`。印刷は `@media print`（A4縦・余白15mm）で、画面専用の要素には `no-print` を付ける。
- **ステータスの流れ：** 未依頼 → 依頼済み → 点検中 → 提出済み →（写真確認を経て報告書を開くと）報告書作成済み →（点検を完了する）完了。完了時に `completeInspection` が測定の不適合と目視の×から修繕案件を作り、点検日の1年後の予定（未依頼）を追加する（重複しない）。
- **修繕案件の流れ：** お客様確認中 → 対応決定（交換／修理／経過観察／その他（作業実施）と回答日）→ 作業予定 → 完了（作業内容・作業後の写真・任意の再測定）。再測定が適合なら表示は「是正済み」。再測定が適合のとき、同じ点検で同じ欄を指摘している案件も連動して是正済みにする（`resolveLinkedRepairs`。例：パネル交換で絶縁抵抗の案件も「アレイB 1段目5列目の交換により是正」）。
- **ルーティングライブラリは使っていない。** `App.tsx` の view state で画面を切り替える。現場画面は `?field=<token>` クエリで判定。
- **共有状態の型は2か所にある。** `netlify/functions/inspection.ts` の `SharedState` と `src/services/sharedInspectionService.ts` の `SharedInspection`。フィールドを変えるときは両方を揃える。
- 共有トークンは `/^[a-zA-Z0-9-]{16,80}$/` で検証される。管理側は点検ごとに `Inspection.shareToken` として DemoState に保持する。
- 共有データ（`SharedInspection`）は目視・測定・異常箇所・天候と、依頼時点の `context`（発電所構成・確認ポイント・前回値）を持つ。点検のステータスは `advanceStatus` で現場の状態から進める（後戻りはやり直し時のみ）。
- 写真はクライアント側で長辺1600px・JPEG品質0.78に縮小してからアップロードする。
- 認証・権限管理はデモ範囲外（共有URLを知っていれば閲覧可能）。本番化の話が出たら、ログインと案件単位のアクセス制御が必要である点を指摘する。

## スコープ外

スケジュール管理、Google Calendar連携、担当者の推薦・アサインはこのデモの対象外。依頼されない限り追加しない。

統合監視は「ダッシュボード（KPI＋発電所一覧）」だけを残している。異常案件画面・遠隔再起動・外部監視システムへのリンクは戻さない。

## コーディング規約

既存コードの書き方に合わせる。

- TypeScript strict。セミコロンなし、シングルクォート、2スペースインデント
- 1行に収まる処理は1行で書く密度の高いスタイル。コメントは最小限（意図や前提が非自明な箇所のみ、日本語）
- UIの文言・エラーメッセージは日本語
- アイコンは `lucide-react`
- **見た目は `DESIGN.md`（デザインシステム）に従う。** スタイルは `src/styles.css` のプレーンCSSで、色・文字・余白・角丸は先頭のトークン（CSS変数）だけを使う。新しい値が必要なら先に DESIGN.md とトークンに足す
- 部品：`.panel`、`.button`（`-primary` / `-secondary` / `-ghost`）、`.data-table`、`.summary-strip`、`.notice`、`.alert-fail`、`.empty-state`。作業の状態は `.status`（`neutral` / `blue` / `amber` / `green` / `red`）、判定は `.judgement`（`-ok` / `-caution` / `-fail` / `-none`）で、この2つを混ぜない
- 日付・数値の表示は `src/logic/format.ts` の関数だけで作る（`toLocaleString` を画面で直接呼ばない）。単位は数値に続けて書く（49.5kW）
- 文字は12px以上。英字の大文字アイブロウ、グラデーション、すりガラス、光る影、アイコン入り角丸タイル、CTAに付ける矢印は使わない
- E2Eが参照する `data-testid` を変更・削除したら `scripts/flow-check.mjs` も更新する
- モック箇所にはコード上で `// MOCK:` コメントを付ける（UI上の表記は下の「デモの前提」に従う）

## 変更後の確認

1. `npm run build` と `npm test` が通ること
2. 画面フローに関わる変更なら `npm run test:flow`（同じ端末のモード）と、`npx netlify dev --offline` を起動して `npm run test:flow -- http://localhost:8888`（共有URLモード）の両方を通す
3. UIの変更はPC幅（1440px）とスマホ幅（390px）の両方で崩れないこと。現場画面はスマホ前提

## 注意

- 非公開リポジトリ。ただし顧客に関わる資料は入れない。`.env*`、顧客との打ち合わせ記録、`docs/SDD.md`・`docs/OPEN_QUESTIONS.md` などのローカル資料は `.git/info/exclude` で除外済みで、絶対にコミットしない
- AGENTS.md・CLAUDE.md・DESIGN.md をコミットする前に、顧客名や打ち合わせの内容が入っていないことを grep で確認する（確認する語句の一覧は `docs/OPEN_QUESTIONS.md` に置き、このファイルには書かない）
- 依存は `package-lock.json` の解決済みバージョンに固定している。追加・更新は必要なときだけ行う（SDDで追加を認めているのはvitestのみ）

## デモの前提
- このアプリは顧客向けのプロダクトデモ。表示データは `src/mock/` 以下のフィクスチャ（サンプルデータ）
- デモであることは説明の最初に口頭で伝える。UI内に「デモ」「モック」「Sample data」「実測値ではありません」「未確認」等のバッジ・注記・キャプション・脚注は一切入れない（コード上の `// MOCK:` コメントのみ）
- avoid-ai-design、Impeccableを参照してデザインすること（全大文字の英字アイブロウ、グラデーション、アイコン入り角丸タイルなどは使わない）
- 数値は本番を想定したリアルな値で、単位・桁区切りを整える
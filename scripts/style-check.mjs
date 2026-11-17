import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const baseUrl = process.argv[2] || 'http://127.0.0.1:5180'
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) })
const page = await browser.newPage()
const checks = [], errors = []
page.on('pageerror', error => errors.push(error.message))
const assert = (ok, label) => { if (!ok) throw new Error(label); checks.push(label) }
const fits = async label => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label)
await mkdir('artifacts', { recursive: true })
for (const width of [390,768,1440]) {
  await page.setViewportSize({ width, height:1000 })
  await page.goto(baseUrl)
  await page.getByTestId('nav-schedule').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await fits(`${width}px: 点検予定の横はみ出しなし`)
  await page.screenshot({path:`artifacts/kauelu-schedule-${width}.png`,fullPage:true})
  await page.getByTestId('open-S-03').click()
  await fits(`${width}px: 点検準備の横はみ出しなし`)
  await page.getByTestId('nav-monitoring').click()
  await page.getByTestId('monitoring-row').first().waitFor()
  await fits(`${width}px: 統合監視の横はみ出しなし`)
  const attention = page.locator('.monitoring-card[data-state="要対応"]')
  assert(await attention.count() > 0, `${width}px: 要対応の発電所が表示される`)
  assert(await attention.first().evaluate(n => { const s=getComputedStyle(n);return s.backgroundColor==='rgb(255, 251, 237)'&&s.borderTopColor==='rgb(255, 196, 0)' }), `${width}px: 要対応を黄色の面と全周枠で強調`)
  if(width===1440){
    const input=await page.getByPlaceholder('発電所名・所在地・監視システム').boundingBox()
    const button=await page.getByRole('button',{name:'要確認・要対応のみ'}).boundingBox()
    assert(Math.abs(input.y-button.y)<1&&Math.abs(input.height-button.height)<1,'検索入力と状態フィルターの上端・下端が一致')
  }
  await page.getByRole('button',{name:'要確認・要対応のみ'}).click()
  assert(await page.getByTestId('monitoring-row').evaluateAll(nodes=>nodes.every(n=>['要対応','要確認'].includes(n.dataset.state))),`${width}px: 要対応・要確認の絞り込み`)
  await page.getByLabel('発電所を検索').fill('該当なし')
  await page.getByRole('status').filter({hasText:'該当する発電所がありません'}).waitFor()
  await page.getByLabel('発電所を検索').fill('')
  await page.getByRole('button',{name:'要確認・要対応のみ'}).click()
  await page.screenshot({path:`artifacts/kauelu-monitoring-${width}.png`,fullPage:true})
  await page.getByTestId('monitoring-row').first().getByRole('button',{name:'発電所カルテ'}).click()
  await fits(`${width}px: カルテの横はみ出しなし`)
  await page.getByTestId('nav-repairs').click()
  await fits(`${width}px: 修繕案件の横はみ出しなし`)
  await page.getByTestId('nav-reportChecks').click()
  await page.getByTestId('report-check-list').waitFor()
  await fits(`${width}px: 報告書一覧の横はみ出しなし`)
  if(width===1440){
    const row=page.getByTestId('review-row').filter({hasText:'承認済み'}).first()
    const centers=await row.evaluate(n=>Array.from(n.children).map(c=>{const r=c.getBoundingClientRect();return r.top+r.height/2}))
    assert(Math.max(...centers)-Math.min(...centers)<1,'承認済み・報告書名・承認日時・ボタンを縦中央に統一')
  }
  await page.screenshot({path:`artifacts/kauelu-reviews-${width}.png`,fullPage:true})
  await page.getByTestId('review-pending').first().getByRole('button',{name:'チェックする'}).click()
  await page.getByTestId('report-check-detail').waitFor()
  await fits(`${width}px: 報告書チェック詳細の横はみ出しなし`)
  await page.screenshot({path:`artifacts/kauelu-review-detail-${width}.png`,fullPage:true})
}
assert(errors.length===0,'ブラウザ実行時エラーなし')
await writeFile('artifacts/style-check.json', JSON.stringify({checks,errors},null,2))
console.log(`Style check passed: ${checks.length} checks`)
await browser.close()

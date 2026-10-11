import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import serverlessChromium from '/tmp/my-month-browser/node_modules/@sparticuz/chromium/build/index.js'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4186', '--strictPort'])
let browser
try {
 await new Promise((resolve, reject) => { server.stdout.on('data', data => { if (data.toString().includes('4186')) resolve() }); server.once('exit', code => reject(new Error(`Server exited: ${code}`))); setTimeout(() => reject(new Error('Startup timeout')), 10000).unref() })
 browser = await chromium.launch({ executablePath: '/tmp/my-month-chromium/chromium', headless: true, args: serverlessChromium.args, env: { ...process.env, LD_LIBRARY_PATH: '/tmp/my-month-chromium:/tmp/my-month-chromium/lib', FONTCONFIG_PATH: '/tmp/my-month-chromium/fonts' } })
 const errors = []
 const results = []
 const page = await browser.newPage({ viewport: { width: 1365, height: 1000 }, reducedMotion: 'reduce' })
 page.on('pageerror', error => errors.push(error.message))
 page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
 for (const viewport of [{ width: 1365, height: 1000 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(viewport)
  const response = await page.goto('http://127.0.0.1:4186/', { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: 'My Month', exact: true }).waitFor()
  await page.screenshot({ path: `.codex/qa/my-month-${viewport.width > 700 ? 'desktop' : 'mobile'}.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal page overflow')
  await page.addScriptTag({ path: '/tmp/my-month-browser/node_modules/axe-core/axe.min.js' })
  const accessibility = await page.evaluate(async () => (await axe.run(document)).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))
  assert.deepEqual(accessibility, [], JSON.stringify(accessibility))
  async function metric(id, text) { await page.waitForFunction(({id, text}) => document.querySelector(`[data-testid="${id}"]`)?.textContent === text, {id, text}, { timeout: 3000 }) }
  async function category(name) { await page.getByRole('navigation', {name: 'Entry types'}).getByRole('button', {name: new RegExp(`^${name}`)}).click() }
  async function entry(label, amount, dateLabel = 'Transaction date', date = '2026-10-01') {
   await page.getByLabel('Name', {exact: true}).fill(label)
   await page.getByLabel('Amount (₹)', {exact: true}).fill(amount)
   await page.getByLabel(dateLabel, {exact: true}).fill(date)
  }
  await metric('cash-balance', '₹9,950.00')
  await page.keyboard.press('Control+Home')
  await page.getByRole('link', {name: 'Skip to main content'}).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => location.hash), '#main')
  if (viewport.width > 700) {
   await page.getByRole('button', {name: 'Start fresh', exact: true}).click()
   await metric('cash-balance', '₹10,000.00')
   await category('Income'); await entry('Work', '1000'); await page.getByRole('button', {name: 'Add income', exact: true}).click()
   await metric('cash-balance', '₹11,000.00')
   await category('Expenses'); await entry('Lunch', '100'); await page.getByRole('button', {name: 'Add expense', exact: true}).click()
   await metric('cash-balance', '₹10,900.00')
   await category('Commitments'); await entry('Rent', '2000', 'Due date', '2026-10-10'); await page.getByRole('button', {name: 'Add commitment', exact: true}).click()
   await metric('bill-reserve', '₹2,000.00')
   await category('Subscriptions'); await entry('Pass', '100', 'First renewal date', '2026-10-03'); await page.getByLabel('Renewal frequency').selectOption('weekly'); await page.getByRole('button', {name: 'Add subscription', exact: true}).click()
   await metric('bill-reserve', '₹2,400.00')
   await category('Savings'); await page.getByLabel('Name', {exact: true}).fill('Buffer'); await page.getByLabel('Target amount (₹)', {exact: true}).fill('1000'); await page.getByRole('button', {name: 'Create savings goal', exact: true}).click()
   await metric('spendable-cash', '₹7,500.00')
   await page.getByRole('button', {name: 'Move money', exact: true}).click(); await page.getByLabel('Amount (₹)', {exact: true}).fill('250'); await page.getByRole('button', {name: 'Record transfer', exact: true}).click()
   await metric('cash-balance', '₹10,650.00'); await metric('saved-total', '₹250.00')
   await page.getByRole('button', {name: 'Pay remaining for Rent due 10 Oct', exact: true}).click(); await metric('cash-balance', '₹8,650.00'); await metric('spendable-cash', '₹7,500.00')
   await page.getByLabel('Direction').selectOption('withdrawal'); await page.getByLabel('Amount (₹)', {exact: true}).fill('50'); await page.getByRole('button', {name: 'Record transfer', exact: true}).click(); await metric('cash-balance', '₹8,700.00'); await metric('saved-total', '₹200.00')
   await category('Income'); await page.getByLabel('Income status').selectOption('planned'); await entry('Future work', '500', 'Expected date', '2026-10-20'); await page.getByRole('button', {name: 'Add income', exact: true}).click(); await metric('cash-balance', '₹8,700.00'); await metric('expected-income', '₹500.00')
   await page.getByRole('button', {name: 'Receive now: Future work', exact: true}).click(); await metric('cash-balance', '₹9,200.00'); await metric('forecast-closing', '₹5,100.00')
   await page.getByLabel('Snapshot day', {exact: true}).fill('2026-10-30'); await page.getByRole('button', {name: 'Apply snapshot day', exact: true}).click(); await metric('daily-allowance', '₹0.00')
  } else {
   await entry('Mobile purchase', '500', 'Transaction date', '2026-10-07'); await page.getByRole('button', {name: 'Add expense', exact: true}).click(); await metric('cash-balance', '₹9,450.00'); await metric('forecast-closing', '₹1,658.15')
   await category('Savings'); await page.getByRole('button', {name: 'Move money', exact: true}).click(); await page.getByLabel('Amount (₹)', {exact: true}).fill('100'); await page.getByRole('button', {name: 'Record transfer', exact: true}).click(); await metric('saved-total', '₹600.00')
  }
  await page.getByRole('button', {name: 'Reset sample', exact: true}).click(); await metric('cash-balance', '₹9,950.00'); await metric('forecast-closing', '₹3,801.00')
  await page.getByText('See forecast assumptions and daily balances', {exact: true}).click(); assert.equal(await page.getByRole('table').locator('tbody tr').count(), 23)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overflow with forecast open')
  results.push({ viewport, httpStatus: response.status(), axeViolations: accessibility.length, flow: 'passed', horizontalOverflow: false })
 }
 assert.deepEqual(errors, [])
 console.log(JSON.stringify({ results, runtimeErrors: errors }))
} finally { if (browser) await browser.close(); server.kill() }

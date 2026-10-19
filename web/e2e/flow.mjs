// End-to-end walkthrough of the web GUI against a fresh server (see e2e/run.sh).
// Screenshots go to $E2E_SHOTS (default: e2e/screenshots). Exits non-zero if any step fails.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:18090'
const SHOTS = process.env.E2E_SHOTS ?? new URL('./screenshots', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium' })
let failures = 0
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', acceptDownloads: true })
context.setDefaultTimeout(6000)
const page = await context.newPage()
const problems = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
const step = async (name, fn) => {
  try { await fn(); console.log('ok  ', name) }
  catch (e) { failures++; console.log('FAIL', name, e.message.split('\n').slice(0, 4).join('\n     ')); await shot(`fail-${name.replace(/\W+/g, '-')}`) }
}

await step('setup screen', async () => {
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Welcome' }).waitFor()
  await shot('01-setup')
  await page.getByLabel('Username').fill('audun')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Repeat password').fill('secret123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('link', { name: 'Calendar', exact: true }).first().waitFor()
  await shot('02-home')
})

await step('dark by default, light on toggle', async () => {
  if ((await page.locator('html').getAttribute('data-theme')) !== 'dark') throw new Error('not dark by default')
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  if ((await page.locator('html').getAttribute('data-theme')) !== 'light') throw new Error('toggle did not switch to light')
  await shot('02-light')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
})

await step('medication with an ingredient and a limit', async () => {
  await page.getByRole('link', { name: 'Medications', exact: true }).first().click()
  await page.getByText('No medications yet').waitFor()
  await page.getByRole('button', { name: 'New medication' }).click()
  const sheet = page.locator('dialog.sheet')
  await sheet.getByLabel('Name', { exact: true }).fill('Imigran nasal spray 20 mg')
  await sheet.getByLabel('Dose unit').fill('spray')
  await sheet.getByLabel('Plural').fill('sprays')
  await sheet.getByLabel('New ingredient').fill('Sumatriptan')
  await sheet.getByRole('button', { name: 'Create', exact: true }).click()
  await sheet.getByLabel('Amount per spray').fill('20')
  await shot('03-medication-editor')
  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText('Sumatriptan 20 mg · per spray').waitFor()
  const card = page.locator('.card', { hasText: 'Not in any medication' }).or(page.locator('.card', { hasText: 'In Imigran' }))
  await card.getByLabel('At most').fill('2')
  await card.getByLabel('Window unit').selectOption('hours')
  await card.getByLabel('Window length').fill('24')
  await card.getByLabel('Kind of limit').selectOption('doses')
  await card.getByLabel('At most').fill('2')
  await card.getByRole('button', { name: 'Add limit' }).click()
  await page.getByText('Sumatriptan: 0 of 2 doses in 24 hours').waitFor()
  await shot('04-medications')
})

await step('start an attack from + Record (AT-1)', async () => {
  await page.getByRole('link', { name: 'Calendar', exact: true }).first().click()
  await page.getByRole('button', { name: '+ Record' }).first().click()
  await page.getByRole('button', { name: /^Start attack Now/ }).click()
  await page.getByRole('heading', { name: 'How bad is it now?' }).waitFor()
  if (!(await page.locator('html').getAttribute('class'))?.includes('attack-mode')) throw new Error('attack mode is not dim')
  await page.getByRole('button', { name: '3 Severe' }).click()
  await page.getByText('Last reading: 3 at').waitFor()
  await page.getByRole('button', { name: /Take Imigran/ }).click()
  await page.getByText('Imigran nasal spray 20 mg logged.').waitFor()
  await shot('05-attack-mode')
})

await step('the dose form previews the limits (LI-4)', async () => {
  await page.getByRole('button', { name: 'Other medication' }).click()
  const sheet = page.locator('dialog.sheet')
  await sheet.getByText('Sumatriptan: 1 → 2 of 2 doses in 24 hours').waitFor()
  await sheet.getByLabel('Quantity').fill('2')
  await sheet.getByRole('button', { name: 'Close' }).click()
})

await step('record a reading and end the attack (AT-3, AT-6)', async () => {
  await page.getByRole('button', { name: '1 Mild' }).click()
  await page.getByText('Last reading: 1 at').waitFor()
  await page.getByRole('button', { name: 'It’s over' }).click()
  await page.getByRole('button', { name: 'It’s over now' }).click()
  await page.locator('.month-panel').waitFor()
  if ((await page.locator('html').getAttribute('class'))?.includes('attack-mode')) throw new Error('still dim after the attack')
  await page.locator('.timeline').getByText('Imigran nasal spray 20 mg · 1 spray').waitFor()
  await page.locator('.timeline').getByText('Severe (3)').waitFor()
  await shot('06-calendar-day')
})

await step('log an attack afterwards (AT-14)', async () => {
  await page.getByRole('button', { name: '+ Record' }).first().click()
  await page.getByRole('button', { name: /^Log afterwards/ }).click()
  const sheet = page.locator('dialog.sheet')
  await sheet.getByLabel('Started').fill('14:00')
  await sheet.getByLabel('Ended at').fill('22:00')
  await sheet.getByRole('button', { name: '2 Moderate' }).click()
  await sheet.getByRole('button', { name: 'Save attack' }).click()
  await page.getByText('Attack saved.').waitFor()
  await page.getByRole('link', { name: 'Attacks', exact: true }).first().click()
  await page.locator('.attack-row').nth(1).waitFor()
  await shot('07-attacks')
})

await step('settings and admin', async () => {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  await shot('08-settings')
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.getByLabel('Username').fill('kari')
  await page.getByLabel('Password').fill('passord123')
  await page.getByRole('button', { name: 'Create user' }).click()
  await page.getByText('Created kari.').waitFor()
  await page.getByRole('button', { name: 'Back up now' }).click()
  await page.getByText(/Saved hemi-/).waitFor()
  await shot('09-admin')
})

await step('phone layout', async () => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nb-NO' })
  phone.setDefaultTimeout(6000)
  const p2 = await phone.newPage()
  try {
  await p2.goto(BASE)
  await p2.getByLabel('Brukernavn').fill('kari')
  await p2.getByLabel('Passord').fill('passord123')
  await p2.getByRole('button', { name: 'Logg inn' }).click()
  // The login page follows the browser; after login the account's language (English) applies.
  await p2.locator('.bottom-nav').getByRole('link', { name: 'More' }).click()
  await p2.getByRole('heading', { name: 'More' }).waitFor()
  await p2.screenshot({ path: `${SHOTS}/10-phone-more.png`, fullPage: true })
  if (await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push('horizontal overflow on phone')
  } catch (e) {
    await p2.screenshot({ path: `${SHOTS}/fail-phone.png`, fullPage: true })
    throw e
  } finally {
    await phone.close()
  }
})

await step('tablet layout (DS-1)', async () => {
  // Between phone and PC the top bar has the phone's items, with Settings and Log out under More.
  for (const width of [720, 900, 1099]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/attacks', '/medications']) {
      await page.goto(BASE + path)
      await page.locator('.topbar').getByRole('link', { name: 'More' }).waitFor()
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push(`horizontal overflow at ${width} px on ${path}`)
    }
  }
  await page.screenshot({ path: `${SHOTS}/11-tablet.png`, fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(BASE)
})

await step('logout and login', async () => {
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByRole('button', { name: 'Log in' }).waitFor()
  await page.getByLabel('Username').fill('audun')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByText('Wrong username or password.').waitFor()
  await page.getByLabel('Password').fill('secret123')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByRole('button', { name: 'Log out' }).waitFor()
})

console.log('\nConsole problems:', problems.length ? '\n' + problems.join('\n') : 'none')
await browser.close()
process.exit(failures ? 1 : 0)

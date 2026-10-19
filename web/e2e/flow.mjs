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
  catch (e) { failures++; console.log('FAIL', name, e.message.split('\n')[0]); await shot(`fail-${name.replace(/\W+/g, '-')}`) }
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
  await shot('03-light')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
})

await step('settings and admin', async () => {
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  await shot('04-settings')
  await page.getByRole('link', { name: 'Admin' }).click()
  await page.getByLabel('Username').fill('kari')
  await page.getByLabel('Password').fill('passord123')
  await page.getByRole('button', { name: 'Create user' }).click()
  await page.getByText('Created kari.').waitFor()
  await page.getByRole('button', { name: 'Back up now' }).click()
  await page.getByText(/Saved hemi-/).waitFor()
  await shot('05-admin')
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
  await p2.screenshot({ path: `${SHOTS}/06-phone-more.png`, fullPage: true })
  if (await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push('horizontal overflow on phone')
  } catch (e) {
    await p2.screenshot({ path: `${SHOTS}/fail-phone.png`, fullPage: true })
    throw e
  } finally {
    await phone.close()
  }
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

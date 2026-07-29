import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const receiptFixture = path.join(__dirname, 'fixtures', 'comprovante-compra.pdf')

async function createGovernedCase(page, externalReference) {
  await page.goto('/')
  await expect(page.getByText('API disponível')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Referência externa').fill(externalReference)
  await page.getByLabel('Valor em disputa').fill('150,00')
  await page.getByRole('button', { name: 'Criar caso' }).click()

  await expect(page.getByRole('heading', { name: 'Jornada do caso' })).toBeVisible()
  await expect(page.locator('.case-hero .eyebrow')).toHaveText(externalReference)
  await expect(page.locator('.case-hero-status')).toContainText('Caso aberto')
  await expect(page.getByRole('heading', { name: 'Registrar documento' })).toBeVisible()
}

async function registerReceiptDocument(page) {
  await page.getByLabel('Arquivo (PDF, JPG, PNG, DOCX ou XLSX)').setInputFiles(receiptFixture)
  await page.getByRole('button', { name: 'Registrar e analisar' }).click()
  await expect(page.getByRole('heading', { name: 'Executar investigação' })).toBeVisible({ timeout: 15_000 })
}

async function investigateAndRecommend(page) {
  await page.getByRole('button', { name: 'Executar investigação' }).click()
  await expect(page.getByRole('heading', { name: 'Criar recomendação' })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Gerar recomendação' }).click()
  await expect(page.getByRole('heading', { name: 'Aprovação humana' })).toBeVisible({ timeout: 15_000 })
}

async function approve(page) {
  await page.getByRole('button', { name: 'Aprovar recomendação' }).click()
  await expect(page.getByRole('heading', { name: 'Execução governada' })).toBeVisible({ timeout: 15_000 })
}

async function caseIdFromHero(page) {
  const text = await page.locator('.case-hero .case-id-line code').innerText()
  return text.trim()
}

async function expectOutboxDispatched(page, caseId) {
  const auditorHeaders = {
    'X-Tenant-Id': 'tenant-demo',
    'X-Subject-Id': 'auditor-1',
    'X-Subject-Type': 'HUMAN',
    'X-Roles': 'auditor',
  }

  await expect(async () => {
    const response = await page.request.get('/api/v1/operations/outbox?limit=200', { headers: auditorHeaders })
    expect(response.ok()).toBe(true)
    const rows = (await response.json()).filter((row) => row.aggregateId === caseId)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.status === 'PUBLISHED')).toBe(true)
  }).toPass({ timeout: 20_000, intervals: [1_000, 2_000, 3_000] })
}

test('creates a governed case through the real frontend and backend', async ({ page }) => {
  const externalReference = `e2e-${Date.now()}`
  await createGovernedCase(page, externalReference)
})

test('drives the full governed-execution chain to EXECUTED through the real UI', async ({ page }) => {
  test.setTimeout(60_000)
  const externalReference = `e2e-happy-${Date.now()}`

  await createGovernedCase(page, externalReference)
  await registerReceiptDocument(page)
  await investigateAndRecommend(page)
  await approve(page)

  await page.locator('input[name="executionMode"][value="SUCCESS"]').check()
  await page.getByRole('button', { name: 'Solicitar execução' }).click()

  await expect(page.locator('.case-hero-status')).toContainText('Executado', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Jornada sem ação pendente' })).toBeVisible()
})

test('dispatches outbox events produced by a browser-driven case in the integrated environment', async ({ page }) => {
  test.setTimeout(60_000)
  const externalReference = `e2e-eventing-${Date.now()}`

  await createGovernedCase(page, externalReference)
  const caseId = await caseIdFromHero(page)

  await registerReceiptDocument(page)
  await investigateAndRecommend(page)
  await approve(page)

  await page.locator('input[name="executionMode"][value="SUCCESS"]').check()
  await page.getByRole('button', { name: 'Solicitar execução' }).click()
  await expect(page.locator('.case-hero-status')).toContainText('Executado', { timeout: 15_000 })

  await expectOutboxDispatched(page, caseId)
})

test('resolves an ambiguous execution through reconciliation to EXECUTED through the real UI', async ({ page }) => {
  test.setTimeout(60_000)
  const externalReference = `e2e-ambiguous-${Date.now()}`

  await createGovernedCase(page, externalReference)
  await registerReceiptDocument(page)
  await investigateAndRecommend(page)
  await approve(page)

  await page.locator('input[name="executionMode"][value="AMBIGUOUS"]').check()
  await page.getByRole('button', { name: 'Solicitar execução' }).click()

  await expect(page.locator('.case-hero-status')).toContainText('Reconciliação necessária', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Resolver reconciliação' })).toBeVisible()

  await page.getByRole('button', { name: 'Registrar reconciliação' }).click()

  await expect(page.locator('.case-hero-status')).toContainText('Executado', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Jornada sem ação pendente' })).toBeVisible()
})

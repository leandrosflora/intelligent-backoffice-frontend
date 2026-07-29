import { expect, test } from '@playwright/test'

test('creates a governed case through the real frontend and backend', async ({ page }) => {
  const externalReference = `e2e-${Date.now()}`

  await page.goto('/')
  await expect(page.getByText('API disponível')).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Referência externa').fill(externalReference)
  await page.getByLabel('Valor em disputa').fill('150,00')
  await page.getByRole('button', { name: 'Criar caso' }).click()

  await expect(page.getByRole('heading', { name: 'Jornada do caso' })).toBeVisible()
  await expect(page.locator('.case-hero .eyebrow')).toHaveText(externalReference)
  await expect(page.locator('.case-hero-status')).toContainText('Caso aberto')
  await expect(page.getByRole('heading', { name: 'Registrar documento' })).toBeVisible()

  const versionMetric = page.locator('.case-metrics .metric-card').filter({ hasText: 'Versão do caso' })
  await expect(versionMetric).toContainText('v1')
})

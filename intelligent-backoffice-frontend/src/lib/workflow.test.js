import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractMetric,
  formatCents,
  formatState,
  nextActionForState,
  parseBrlToCents,
  stateTone,
  workflowStepIndex,
} from './workflow.js'

test('mapeia o próximo comando do workflow', () => {
  assert.equal(nextActionForState('CREATED'), 'registerDocument')
  assert.equal(nextActionForState('DOCUMENTS_VALIDATED'), 'investigate')
  assert.equal(nextActionForState('APPROVED'), 'execute')
  assert.equal(nextActionForState('RECONCILIATION_REQUIRED'), 'reconcile')
  assert.equal(nextActionForState('EXECUTED'), null)
})

test('calcula progresso e tom visual', () => {
  assert.equal(workflowStepIndex('AWAITING_APPROVAL'), 3)
  assert.equal(workflowStepIndex('EXECUTED'), 5)
  assert.equal(stateTone('RECONCILIATION_REQUIRED'), 'warning')
  assert.equal(stateTone('FAILED'), 'danger')
  assert.equal(stateTone('EXECUTED'), 'success')
})

test('converte valores brasileiros para centavos', () => {
  assert.equal(parseBrlToCents('120,50'), 12050)
  assert.equal(parseBrlToCents('R$ 1.234,56'), 123456)
  assert.equal(formatCents(12050), 'R$ 120,50')
})

test('interpreta estado e métricas Prometheus', () => {
  assert.equal(formatState('UNDER_INVESTIGATION'), 'Em investigação')
  assert.equal(extractMetric('backoffice_cases_created_total 4\n', 'backoffice_cases_created_total'), 4)
  assert.equal(extractMetric('', 'missing_metric'), null)
})

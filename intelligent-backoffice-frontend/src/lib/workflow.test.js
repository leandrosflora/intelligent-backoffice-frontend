import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createCommandHash,
  formatMoney,
  formatState,
  nextActionForState,
  normalizeCase,
  parseBrl,
  requiredDocumentType,
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

test('converte valores brasileiros para decimal canônico', () => {
  assert.equal(parseBrl('120,50'), '120.50')
  assert.equal(parseBrl('R$ 1.234,56'), '1234.56')
  assert.match(formatMoney({ currency: 'BRL', amount: '120.50' }), /120,50/)
})

test('normaliza respostas antigas e atuais de Case', () => {
  const value = normalizeCase({ caseId: 'case-1', caseVersion: 4, externalReference: 'ext-1', disputedAmount: { currency: 'BRL', amount: '10.00' } })
  assert.equal(value.caseId, 'case-1')
  assert.equal(value.caseVersion, 4)
  assert.equal(value.externalReference, 'ext-1')

  const legacy = normalizeCase({ case_id: 'case-2', version: 3, external_id: 'ext-2', amount_cents: 1500 })
  assert.equal(legacy.caseId, 'case-2')
  assert.equal(legacy.caseVersion, 3)
  assert.equal(legacy.disputedAmount.amount, '15')
})

test('mapeia documentos e marcadores do gateway mock', () => {
  assert.equal(requiredDocumentType('CARD_PURCHASE'), 'RECEIPT')
  assert.equal(requiredDocumentType('PIX'), 'TRANSACTION_PROOF')
  assert.match(createCommandHash('AMBIGUOUS'), /^ambiguous-/)
  assert.match(createCommandHash('FAILED'), /^fail-/)
  assert.equal(formatState('UNDER_INVESTIGATION'), 'Em investigação')
})

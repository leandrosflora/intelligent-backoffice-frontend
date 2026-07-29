import test from 'node:test'
import assert from 'node:assert/strict'

import {
  documentAiOutcome,
  documentRegistrationNotice,
  findDocumentEvidence,
  formatFileSize,
  mediaTypeForDocument,
  validateDocumentFile,
} from './documentUpload.js'

test('mapeia formatos suportados para o contrato da API', () => {
  assert.equal(mediaTypeForDocument('comprovante.pdf'), 'APPLICATION_PDF')
  assert.equal(mediaTypeForDocument('identidade.PNG'), 'IMAGE_PNG')
  assert.equal(mediaTypeForDocument('extrato.xlsx'), 'APPLICATION_XLSX')
  assert.equal(mediaTypeForDocument('arquivo.exe'), null)
})

test('valida arquivo vazio, extensão e limite de tamanho', () => {
  assert.equal(validateDocumentFile(null).valid, false)
  assert.match(validateDocumentFile({ name: 'arquivo.exe', size: 100 }).error, /Formato não suportado/)
  assert.match(validateDocumentFile({ name: 'vazio.pdf', size: 0 }).error, /arquivo está vazio/)
  assert.match(validateDocumentFile({ name: 'grande.pdf', size: 11 * 1024 * 1024 }).error, /excede o limite/)

  const valid = validateDocumentFile({ name: 'recibo.pdf', size: 2048 })
  assert.equal(valid.valid, true)
  assert.equal(valid.mediaType, 'APPLICATION_PDF')
  assert.equal(valid.sizeLabel, '2.0 KB')
})

test('localiza evidência vinculada ao documento', () => {
  const evidence = [
    { evidenceId: 'e-1', sourceReference: 'doc-1', confidence: 0.91 },
    { evidenceId: 'e-2', sourceReference: 'doc-2', confidence: 0.82 },
  ]
  assert.equal(findDocumentEvidence(evidence, 'doc-2')?.evidenceId, 'e-2')
  assert.equal(findDocumentEvidence(evidence, 'doc-3'), null)
})

test('explica confirmação, revisão humana, inconsistência e rejeição', () => {
  const confirmed = documentAiOutcome(
    { status: 'VALIDATED' },
    { confidence: 0.93 },
  )
  assert.equal(confirmed.tone, 'success')
  assert.match(confirmed.detail, /93%/)

  const reviewRequired = documentAiOutcome({ status: 'REVIEW_REQUIRED' }, null)
  assert.equal(reviewRequired.tone, 'warning')
  assert.match(reviewRequired.label, /Revisão humana/)

  const inconsistent = documentAiOutcome({ status: 'VALIDATED' }, null)
  assert.equal(inconsistent.tone, 'warning')
  assert.match(inconsistent.label, /sem evidência/)

  const rejected = documentAiOutcome({ status: 'REJECTED', rejectionReasons: ['malware'] }, null)
  assert.equal(rejected.tone, 'danger')
  assert.match(rejected.detail, /malware/)
})

test('cria notificações coerentes com o status documental', () => {
  assert.equal(documentRegistrationNotice({ status: 'VALIDATED' }).type, 'success')

  const reviewRequired = documentRegistrationNotice({ status: 'REVIEW_REQUIRED' })
  assert.equal(reviewRequired.type, 'warning')
  assert.match(reviewRequired.message, /caso não avançou/)

  const rejected = documentRegistrationNotice({ status: 'REJECTED', rejectionReasons: ['arquivo inseguro'] })
  assert.equal(rejected.type, 'error')
  assert.match(rejected.message, /arquivo inseguro/)
})

test('formata tamanhos de arquivo', () => {
  assert.equal(formatFileSize(500), '500 B')
  assert.equal(formatFileSize(1024), '1.0 KB')
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB')
})

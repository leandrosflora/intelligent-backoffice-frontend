import test from 'node:test'
import assert from 'node:assert/strict'

import {
  documentAiOutcome,
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

test('explica confirmação, abstention e rejeição', () => {
  const confirmed = documentAiOutcome(
    { status: 'VALIDATED' },
    { confidence: 0.93 },
  )
  assert.equal(confirmed.tone, 'success')
  assert.match(confirmed.detail, /93%/)

  const abstained = documentAiOutcome({ status: 'VALIDATED' }, null)
  assert.equal(abstained.tone, 'warning')
  assert.match(abstained.detail, /abstido/)

  const rejected = documentAiOutcome({ status: 'REJECTED', rejectionReasons: ['malware'] }, null)
  assert.equal(rejected.tone, 'danger')
  assert.match(rejected.detail, /malware/)
})

test('formata tamanhos de arquivo', () => {
  assert.equal(formatFileSize(500), '500 B')
  assert.equal(formatFileSize(1024), '1.0 KB')
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB')
})

export const WORKFLOW_STEPS = [
  { key: 'CREATED', label: 'Caso aberto' },
  { key: 'DOCUMENTS_VALIDATED', label: 'Documentos validados' },
  { key: 'UNDER_INVESTIGATION', label: 'Investigação concluída' },
  { key: 'AWAITING_APPROVAL', label: 'Aguardando aprovação' },
  { key: 'APPROVED', label: 'Aprovado' },
  { key: 'EXECUTED', label: 'Executado' },
]

export const STATE_LABELS = {
  CREATED: 'Caso aberto',
  AWAITING_DOCUMENTS: 'Aguardando documentos',
  DOCUMENTS_RECEIVED: 'Documentos recebidos',
  DOCUMENTS_VALIDATED: 'Documentos validados',
  UNDER_INVESTIGATION: 'Em investigação',
  DECISION_PROPOSED: 'Decisão proposta',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  MORE_EVIDENCE_REQUIRED: 'Mais evidências necessárias',
  APPROVED: 'Aprovado',
  EXECUTION_PENDING: 'Execução pendente',
  EXECUTED: 'Executado',
  RECONCILIATION_REQUIRED: 'Reconciliação necessária',
  REJECTED: 'Rejeitado',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
}

export const NEXT_ACTION = {
  CREATED: 'registerDocument',
  AWAITING_DOCUMENTS: 'registerDocument',
  DOCUMENTS_RECEIVED: 'registerDocument',
  DOCUMENTS_VALIDATED: 'investigate',
  UNDER_INVESTIGATION: 'recommend',
  DECISION_PROPOSED: 'approve',
  AWAITING_APPROVAL: 'approve',
  APPROVED: 'execute',
  RECONCILIATION_REQUIRED: 'reconcile',
}

const STEP_INDEX = {
  CREATED: 0,
  AWAITING_DOCUMENTS: 0,
  DOCUMENTS_RECEIVED: 0,
  DOCUMENTS_VALIDATED: 1,
  UNDER_INVESTIGATION: 2,
  DECISION_PROPOSED: 3,
  AWAITING_APPROVAL: 3,
  MORE_EVIDENCE_REQUIRED: 2,
  APPROVED: 4,
  EXECUTION_PENDING: 4,
  RECONCILIATION_REQUIRED: 4,
  EXECUTED: 5,
  CLOSED: 5,
  REJECTED: 5,
  CANCELLED: 5,
  EXPIRED: 5,
  FAILED: 5,
}

export function normalizeCase(value) {
  if (!value) return null
  return {
    ...value,
    caseId: value.caseId ?? value.case_id,
    tenantId: value.tenantId ?? value.tenant_id,
    externalReference: value.externalReference ?? value.external_id ?? value.external_reference,
    disputeType: value.disputeType ?? value.dispute_type,
    channel: value.channel,
    state: value.state,
    caseVersion: value.caseVersion ?? value.version ?? value.case_version,
    priority: value.priority,
    disputedAmount: value.disputedAmount ?? value.disputed_amount ?? {
      currency: 'BRL',
      amount: value.amount_cents !== undefined ? String(Number(value.amount_cents) / 100) : '0',
    },
    recommendationVersion: value.recommendationVersion ?? value.recommendation_version,
    approvedRecommendationVersion: value.approvedRecommendationVersion ?? value.approved_recommendation_version,
    createdAt: value.createdAt ?? value.created_at,
    updatedAt: value.updatedAt ?? value.updated_at,
  }
}

export function normalizeCases(values) {
  return Array.isArray(values) ? values.map(normalizeCase) : []
}

export function formatState(state) {
  return STATE_LABELS[state] || state || 'Desconhecido'
}

export function nextActionForState(state) {
  return NEXT_ACTION[state] || null
}

export function workflowStepIndex(state) {
  return STEP_INDEX[state] ?? 0
}

export function stateTone(state) {
  if (['EXECUTED', 'CLOSED', 'APPROVED'].includes(state)) return 'success'
  if (['RECONCILIATION_REQUIRED', 'MORE_EVIDENCE_REQUIRED', 'EXPIRED'].includes(state)) return 'warning'
  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(state)) return 'danger'
  return 'info'
}

export function parseBrl(value) {
  if (typeof value === 'number') return value.toFixed(2)
  const normalized = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Informe um valor monetário válido.')
  }
  return amount.toFixed(2)
}

export function formatMoney(money) {
  const currency = money?.currency || 'BRL'
  const amount = Number(money?.amount || 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
}

export function createUuid() {
  return globalThis.crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000001'
}

export function createId(prefix = 'ui') {
  return `${prefix}-${createUuid()}`
}

export function createCommandHash(mode = 'SUCCESS') {
  const marker = mode === 'AMBIGUOUS' ? 'ambiguous' : mode === 'FAILED' ? 'fail' : 'success'
  return `${marker}-${createUuid().replaceAll('-', '')}`
}

export function requiredDocumentType(disputeType) {
  if (disputeType === 'CARD_PURCHASE') return 'RECEIPT'
  if (['PIX', 'TRANSFER', 'CASH_WITHDRAWAL'].includes(disputeType)) return 'TRANSACTION_PROOF'
  return 'OTHER'
}

export function apiErrorMessage(payload, status) {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (detail?.reason) return detail.reason
  if (payload?.title && payload?.detail) return `${payload.title}: ${payload.detail}`
  if (payload?.title) return payload.title
  if (status === 0) return 'Não foi possível conectar ao backend.'
  return `A plataforma retornou HTTP ${status}.`
}

export const WORKFLOW_STEPS = [
  { key: 'CREATED', label: 'Caso aberto', group: 'intake' },
  { key: 'DOCUMENTS_VALIDATED', label: 'Documentos validados', group: 'documents' },
  { key: 'UNDER_INVESTIGATION', label: 'Investigação', group: 'analysis' },
  { key: 'AWAITING_APPROVAL', label: 'Aguardando aprovação', group: 'approval' },
  { key: 'APPROVED', label: 'Aprovado', group: 'execution' },
  { key: 'EXECUTED', label: 'Executado', group: 'done' },
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
  REJECTED: 'Rejeitado',
  EXECUTION_PENDING: 'Execução pendente',
  EXECUTED: 'Executado',
  RECONCILIATION_REQUIRED: 'Reconciliação necessária',
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

export function parseBrlToCents(value) {
  if (typeof value === 'number') return Math.round(value * 100)
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
  return Math.round(amount * 100)
}

export function formatCents(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(value) || 0) / 100)
}

export function createId(prefix = 'ui') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

export function extractMetric(text, metricName) {
  const line = String(text)
    .split('\n')
    .find((item) => item.startsWith(metricName) && !item.startsWith(`${metricName}_created`))
  if (!line) return null
  const value = Number(line.trim().split(/\s+/).at(-1))
  return Number.isFinite(value) ? value : null
}

export function apiErrorMessage(payload, status) {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (detail?.reason) return detail.reason
  if (payload?.title) return payload.title
  return `A plataforma retornou HTTP ${status}.`
}

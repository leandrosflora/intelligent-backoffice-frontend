import { useEffect, useMemo, useState } from 'react'
import './App.css'

import { PlatformClient } from './api/client.js'
import { ACTION_IDENTITIES, IDENTITIES, IDENTITY_OPTIONS } from './config/identities.js'
import {
  WORKFLOW_STEPS,
  apiErrorMessage,
  createCommandHash,
  createId,
  formatMoney,
  formatState,
  mediaTypeForFilename,
  nextActionForState,
  normalizeCase,
  normalizeCases,
  parseBrl,
  requiredDocumentType,
  stateTone,
  workflowStepIndex,
} from './lib/workflow.js'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão geral', description: 'Fila e indicadores', icon: 'grid' },
  { id: 'case', label: 'Jornada do caso', description: 'Workflow governado', icon: 'workflow' },
  { id: 'evidence', label: 'Evidências', description: 'Auditoria e execução', icon: 'shield' },
  { id: 'console', label: 'Console de API', description: 'Diagnóstico técnico', icon: 'terminal' },
]

const TERMINAL_STATES = ['EXECUTED', 'CLOSED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED']
const ATTENTION_STATES = ['RECONCILIATION_REQUIRED', 'MORE_EVIDENCE_REQUIRED', 'FAILED', 'EXPIRED']

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    workflow: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="12" cy="18" r="3" /><path d="M8.6 7.5 10.9 16M15.4 7.5 13.1 16M9 6h6" /></>,
    shield: <><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z" /><path d="m9 12 2 2 4-5" /></>,
    terminal: <><path d="m5 7 4 4-4 4" /><path d="M11 17h7" /><rect x="3" y="4" width="18" height="16" rx="3" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8a7 7 0 0 1 11.4-2.1L20 8M4 16l2.5 2.1A7 7 0 0 0 17.9 16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    alert: <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v4M12 17h.01" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  }

  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.grid}
    </svg>
  )
}

function Badge({ state, children }) {
  return <span className={`badge badge-${stateTone(state)}`}>{children || formatState(state)}</span>
}

function Panel({ id, title, description, action, children, className = '' }) {
  return (
    <section id={id} className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

function EmptyState({ icon = 'layers', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function MetricCard({ icon, label, value, detail, tone = 'neutral' }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-icon"><Icon name={icon} size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  )
}

function WorkflowRail({ state }) {
  const current = workflowStepIndex(state)
  const progress = state === 'EXECUTED' || state === 'CLOSED' ? 100 : Math.round(((current + 1) / WORKFLOW_STEPS.length) * 100)
  return (
    <section className="workflow-container" aria-label="Progresso do workflow">
      <div className="workflow-meta">
        <div><span>Progresso da jornada</span><strong>{progress}% concluído</strong></div>
        <small>Etapa {Math.min(current + 1, WORKFLOW_STEPS.length)} de {WORKFLOW_STEPS.length}</small>
      </div>
      <div className="workflow-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="workflow-rail">
        {WORKFLOW_STEPS.map((step, index) => {
          const completed = index < current || state === 'EXECUTED' || state === 'CLOSED'
          const active = index === current && !['EXECUTED', 'CLOSED'].includes(state)
          return (
            <div className={`workflow-step ${completed ? 'complete' : ''} ${active ? 'active' : ''}`} key={step.key}>
              <span>{completed ? <Icon name="check" size={14} /> : index + 1}</span>
              <div><small>Etapa {index + 1}</small><strong>{step.label}</strong></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function JsonBlock({ value }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>
}

function formatDateTime(value) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function copyText(value) {
  if (!value || !navigator.clipboard) return
  navigator.clipboard.writeText(String(value)).catch(() => {})
}

function App() {
  const [view, setView] = useState('dashboard')
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('backoffice-ui-api') || '/api')
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('backoffice-ui-tenant') || 'tenant-demo')
  const [guidedMode, setGuidedMode] = useState(true)
  const [identityId, setIdentityId] = useState('caseManager')
  const [health, setHealth] = useState(null)
  const [cases, setCases] = useState([])
  const [activeCase, setActiveCase] = useState(null)
  const [resources, setResources] = useState(() => readJson('backoffice-ui-resources', {}))
  const [evidence, setEvidence] = useState([])
  const [executions, setExecutions] = useState([])
  const [timeline, setTimeline] = useState([])
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [loadCaseId, setLoadCaseId] = useState('')
  const [caseQuery, setCaseQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [createForm, setCreateForm] = useState({
    externalReference: `ui-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 10000)}`,
    disputeType: 'CARD_PURCHASE',
    channel: 'WEB',
    priority: 'NORMAL',
    amount: '120,00',
  })
  const [documentForm, setDocumentForm] = useState({ file: null })
  const [approvalForm, setApprovalForm] = useState({ authorityLimit: '500,00', reason: 'Dentro da alçada delegada.' })
  const [executionMode, setExecutionMode] = useState('SUCCESS')
  const [reconciliationForm, setReconciliationForm] = useState({
    resolution: 'CONFIRMED_SUCCEEDED',
    reason: 'O sistema de registro confirmou o resultado da execução mock.',
  })

  const client = useMemo(() => new PlatformClient(apiBaseUrl), [apiBaseUrl])
  const selectedIdentity = IDENTITIES[identityId]
  const activeResources = activeCase ? resources[activeCase.caseId] || {} : {}
  const nextAction = activeCase ? nextActionForState(activeCase.state) : null
  const activeNav = NAV_ITEMS.find((item) => item.id === view) || NAV_ITEMS[0]

  const filteredCases = useMemo(() => {
    const query = caseQuery.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesState = stateFilter === 'ALL' || item.state === stateFilter
      const matchesQuery = !query || [item.externalReference, item.caseId, item.disputeType, item.channel, formatState(item.state)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
      return matchesState && matchesQuery
    })
  }, [caseQuery, cases, stateFilter])

  const caseMetrics = useMemo(() => {
    const completed = cases.filter((item) => ['EXECUTED', 'CLOSED'].includes(item.state)).length
    const attention = cases.filter((item) => ATTENTION_STATES.includes(item.state)).length
    const inProgress = cases.filter((item) => !TERMINAL_STATES.includes(item.state)).length
    const totalAmount = cases.reduce((sum, item) => sum + Number(item.disputedAmount?.amount || 0), 0)
    return { completed, attention, inProgress, totalAmount }
  }, [cases])

  const logMetrics = useMemo(() => {
    const success = logs.filter((item) => item.ok).length
    const errors = logs.length - success
    const avgLatency = logs.length ? Math.round(logs.reduce((sum, item) => sum + Number(item.elapsedMs || 0), 0) / logs.length) : 0
    return { success, errors, avgLatency }
  }, [logs])

  useEffect(() => {
    let active = true
    client.health().then((result) => {
      if (!active) return
      setHealth(result.ok ? result.data : { status: 'unavailable', detail: apiErrorMessage(result.data, result.status) })
      setLogs((current) => [{ id: createId('log'), label: 'Health check', timestamp: new Date().toISOString(), ...result }, ...current].slice(0, 100))
    })
    return () => {
      active = false
    }
  }, [client])

  function identityFor(action) {
    return guidedMode ? IDENTITIES[ACTION_IDENTITIES[action]] : selectedIdentity
  }

  function persistResources(caseId, patch) {
    setResources((current) => {
      const next = { ...current, [caseId]: { ...(current[caseId] || {}), ...patch } }
      localStorage.setItem('backoffice-ui-resources', JSON.stringify(next))
      return next
    })
  }

  function addLog(label, result) {
    setLogs((current) => [{ id: createId('log'), label, timestamp: new Date().toISOString(), ...result }, ...current].slice(0, 100))
  }

  function showNotice(type, message) {
    setNotice({ type, message })
    window.setTimeout(() => setNotice(null), 4500)
  }

  async function invoke(label, request) {
    const result = await request
    addLog(label, result)
    if (!result.ok) {
      const message = apiErrorMessage(result.data, result.status)
      showNotice('error', `${label}: ${message}`)
      throw new Error(message)
    }
    return result.data
  }

  function requestOptions(action, extra = {}) {
    return {
      tenantId,
      identity: identityFor(action),
      ...extra,
    }
  }

  async function checkHealth() {
    setBusy('health')
    try {
      const data = await invoke('Health check', client.health())
      setHealth(data)
      showNotice('success', 'Conexão com a API validada.')
    } catch {
      setHealth({ status: 'unavailable' })
    } finally {
      setBusy('')
    }
  }

  async function loadCases() {
    setBusy('cases')
    try {
      const data = await invoke('Listar casos', client.request('/v1/cases', requestOptions('listCases')))
      setCases(normalizeCases(data))
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function fetchCase(caseId, options = {}) {
    const data = await invoke(
      options.label || 'Consultar caso',
      client.request(`/v1/cases/${caseId}`, requestOptions('readCase')),
    )
    const normalized = normalizeCase(data)
    setActiveCase(normalized)
    setCases((current) => [normalized, ...current.filter((item) => item.caseId !== normalized.caseId)])
    return normalized
  }

  async function openCase(caseId = loadCaseId) {
    const id = String(caseId || '').trim()
    if (!id) return
    setBusy('open')
    try {
      await fetchCase(id)
      setView('case')
      await loadCaseData(id)
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function loadCaseData(caseId = activeCase?.caseId) {
    if (!caseId) return
    const [evidenceResult, executionsResult, timelineResult] = await Promise.all([
      client.request(`/v1/cases/${caseId}/evidence`, requestOptions('readEvidence')),
      client.request(`/v1/cases/${caseId}/executions`, requestOptions('readExecution')),
      client.request(`/v1/cases/${caseId}/timeline`, requestOptions('timeline')),
    ])
    addLog('Consultar evidências', evidenceResult)
    addLog('Consultar execuções', executionsResult)
    addLog('Consultar timeline', timelineResult)
    if (evidenceResult.ok) setEvidence(Array.isArray(evidenceResult.data) ? evidenceResult.data : [])
    if (executionsResult.ok) {
      const values = Array.isArray(executionsResult.data) ? executionsResult.data : []
      setExecutions(values)
      const latest = values.at(-1)
      if (latest?.executionId) persistResources(caseId, { execution: latest })
    }
    if (timelineResult.ok) setTimeline(Array.isArray(timelineResult.data) ? timelineResult.data : [])
  }

  async function createCase(event) {
    event.preventDefault()
    setBusy('create')
    try {
      const data = await invoke('Criar caso', client.request('/v1/cases', requestOptions('createCase', {
        method: 'POST',
        body: {
          externalReference: createForm.externalReference,
          disputeType: createForm.disputeType,
          channel: createForm.channel,
          priority: createForm.priority,
          disputedAmount: { currency: 'BRL', amount: parseBrl(createForm.amount) },
        },
      })))
      const normalized = normalizeCase(data)
      setActiveCase(normalized)
      setCases((current) => [normalized, ...current.filter((item) => item.caseId !== normalized.caseId)])
      persistResources(normalized.caseId, {})
      setEvidence([])
      setExecutions([])
      setTimeline([])
      setView('case')
      showNotice('success', 'Caso criado no backend .NET.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function registerDocument(event) {
    event.preventDefault()
    if (!documentForm.file) return
    setBusy('document')
    try {
      const documentType = requiredDocumentType(activeCase.disputeType)
      const mediaType = mediaTypeForFilename(documentForm.file.name)
      const formData = new FormData()
      formData.append('documentType', documentType)
      formData.append('mediaType', mediaType)
      formData.append('file', documentForm.file)
      const resource = await invoke('Registrar documento', client.request(
        `/v1/cases/${activeCase.caseId}/documents`,
        requestOptions('registerDocument', {
          method: 'POST',
          headers: { 'If-Match': String(activeCase.caseVersion) },
          body: formData,
        }),
      ))
      persistResources(activeCase.caseId, { document: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após documento' })
      await loadCaseData(activeCase.caseId)
      showNotice('success', 'Documento validado e evidência criada.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function investigate() {
    setBusy('investigate')
    try {
      const resource = await invoke('Executar investigação', client.request(
        `/v1/cases/${activeCase.caseId}/investigations`,
        requestOptions('investigate', {
          method: 'POST',
          headers: { 'If-Match': String(activeCase.caseVersion) },
          body: {
            caseVersion: activeCase.caseVersion,
            requestedChecks: ['TRANSACTION_LOOKUP', 'FRAUD_SIGNAL_LOOKUP', 'CUSTOMER_HISTORY', 'DOCUMENT_CONSISTENCY'],
          },
        }),
      ))
      persistResources(activeCase.caseId, { investigation: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após investigação' })
      await loadCaseData(activeCase.caseId)
      showNotice('success', 'Investigação concluída.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function recommend() {
    const investigationId = activeResources.investigation?.investigationId
    if (!investigationId) {
      showNotice('error', 'Execute a investigação neste navegador antes de criar a recomendação.')
      return
    }
    setBusy('recommend')
    try {
      const resource = await invoke('Criar recomendação', client.request(
        `/v1/cases/${activeCase.caseId}/recommendations`,
        requestOptions('recommend', {
          method: 'POST',
          body: { caseVersion: activeCase.caseVersion, investigationId },
        }),
      ))
      persistResources(activeCase.caseId, { recommendation: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após recomendação' })
      await loadCaseData(activeCase.caseId)
      showNotice('success', 'Recomendação criada e enviada para aprovação.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function approve(event) {
    event.preventDefault()
    const recommendation = activeResources.recommendation
    if (!recommendation?.recommendationId) {
      showNotice('error', 'A recomendação não está disponível no workspace deste navegador.')
      return
    }
    setBusy('approve')
    try {
      const resource = await invoke('Aprovar recomendação', client.request(
        `/v1/cases/${activeCase.caseId}/approvals`,
        requestOptions('approve', {
          method: 'POST',
          authorityLimit: parseBrl(approvalForm.authorityLimit),
          body: {
            caseVersion: activeCase.caseVersion,
            recommendationId: recommendation.recommendationId,
            recommendationVersion: recommendation.recommendationVersion,
            decision: 'APPROVE',
            reason: approvalForm.reason,
            evidenceReferences: evidence.map((item) => item.evidenceId).filter(Boolean),
          },
        }),
      ))
      persistResources(activeCase.caseId, { approval: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após aprovação' })
      await loadCaseData(activeCase.caseId)
      showNotice('success', 'Aprovação humana registrada.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function execute() {
    const approval = activeResources.approval
    const recommendation = activeResources.recommendation
    if (!approval?.approvalId || !recommendation?.recommendationVersion) {
      showNotice('error', 'Aprovação e recomendação precisam estar disponíveis no workspace local.')
      return
    }
    setBusy('execute')
    try {
      const resource = await invoke('Solicitar execução', client.request(
        `/v1/cases/${activeCase.caseId}/executions`,
        requestOptions('execute', {
          method: 'POST',
          headers: { 'Idempotency-Key': createId('execution') },
          body: {
            caseVersion: activeCase.caseVersion,
            approvalId: approval.approvalId,
            recommendationVersion: recommendation.recommendationVersion,
            commandType: 'MOCK_REFUND',
            commandHash: createCommandHash(executionMode),
            evidenceReferences: evidence.map((item) => item.evidenceId).filter(Boolean),
          },
        }),
      ))
      persistResources(activeCase.caseId, { execution: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após execução' })
      await loadCaseData(activeCase.caseId)
      showNotice(executionMode === 'AMBIGUOUS' ? 'warning' : executionMode === 'FAILED' ? 'error' : 'success', `Execução retornou ${resource.status}.`)
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function reconcile(event) {
    event.preventDefault()
    const execution = activeResources.execution || executions.at(-1)
    if (!execution?.executionId) {
      showNotice('error', 'Nenhuma execução está disponível para reconciliação.')
      return
    }
    setBusy('reconcile')
    try {
      const resource = await invoke('Resolver reconciliação', client.request(
        `/v1/cases/${activeCase.caseId}/reconciliations/${execution.executionId}/resolve`,
        requestOptions('reconcile', {
          method: 'POST',
          body: {
            caseVersion: activeCase.caseVersion,
            resolution: reconciliationForm.resolution,
            reason: reconciliationForm.reason,
          },
        }),
      ))
      persistResources(activeCase.caseId, { execution: resource })
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso após reconciliação' })
      await loadCaseData(activeCase.caseId)
      showNotice('success', 'Reconciliação registrada.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  async function cancelCase() {
    setBusy('cancel')
    try {
      await invoke('Cancelar caso', client.request(
        `/v1/cases/${activeCase.caseId}/cancel`,
        requestOptions('cancelCase', {
          method: 'POST',
          headers: { 'If-Match': String(activeCase.caseVersion) },
          body: { reason: 'Cancelamento solicitado pelo console de validação.' },
        }),
      ))
      await fetchCase(activeCase.caseId, { label: 'Atualizar caso cancelado' })
      showNotice('success', 'Caso cancelado.')
    } catch {
      // handled by invoke
    } finally {
      setBusy('')
    }
  }

  function updateApi(value) {
    setApiBaseUrl(value)
    localStorage.setItem('backoffice-ui-api', value)
  }

  function updateTenant(value) {
    setTenantId(value)
    localStorage.setItem('backoffice-ui-tenant', value)
  }

  function renderDashboard() {
    return (
      <div className="page-stack">
        <section className="command-hero">
          <div className="hero-content">
            <div className="hero-kicker"><span className={health?.status === 'ok' ? 'status-pulse online' : 'status-pulse'} />Operação conectada ao backoffice-platform-api</div>
            <h1>Central de operações inteligentes</h1>
            <p>Gerencie contestação, investigação, decisão e execução em uma jornada auditável, com identidade e policy explícitas em cada etapa.</p>
            <div className="hero-actions">
              <button className="primary" onClick={loadCases} disabled={busy === 'cases'}><Icon name="refresh" />{busy === 'cases' ? 'Atualizando…' : 'Sincronizar fila'}</button>
              <button className="ghost-light" onClick={() => document.getElementById('new-case-form')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="plus" />Abrir contestação</button>
            </div>
          </div>
          <div className="hero-context">
            <span>Contexto ativo</span>
            <strong>{tenantId}</strong>
            <div><Icon name="users" /><span>{guidedMode ? 'Identidades por etapa' : selectedIdentity.label}</span></div>
            <div><Icon name="database" /><span>{apiBaseUrl}</span></div>
          </div>
        </section>

        <div className="metrics-grid">
          <MetricCard icon="layers" label="Casos carregados" value={cases.length} detail={formatMoney({ currency: 'BRL', amount: caseMetrics.totalAmount }) + ' em disputa'} />
          <MetricCard icon="activity" label="Em andamento" value={caseMetrics.inProgress} detail="Jornadas com ação pendente" tone="blue" />
          <MetricCard icon="alert" label="Requer atenção" value={caseMetrics.attention} detail="Reconciliação, falha ou evidência" tone={caseMetrics.attention ? 'warning' : 'neutral'} />
          <MetricCard icon="check" label="Concluídos" value={caseMetrics.completed} detail="Execuções ou casos encerrados" tone="success" />
        </div>

        <div className="dashboard-grid">
          <Panel id="new-case-form" className="create-panel" title="Nova contestação" description="Abra um caso usando o contrato canônico da plataforma." action={<span className="panel-chip">POST /v1/cases</span>}>
            <form className="form-grid form-grid-2" onSubmit={createCase}>
              <label className="span-2">Referência externa<input value={createForm.externalReference} onChange={(event) => setCreateForm({ ...createForm, externalReference: event.target.value })} /></label>
              <label>Tipo<select value={createForm.disputeType} onChange={(event) => setCreateForm({ ...createForm, disputeType: event.target.value })}><option>CARD_PURCHASE</option><option>PIX</option><option>TRANSFER</option><option>CASH_WITHDRAWAL</option><option>OTHER</option></select></label>
              <label>Canal<select value={createForm.channel} onChange={(event) => setCreateForm({ ...createForm, channel: event.target.value })}><option>WEB</option><option>APP</option><option>CONTACT_CENTER</option><option>BRANCH</option><option>API</option></select></label>
              <label>Prioridade<select value={createForm.priority} onChange={(event) => setCreateForm({ ...createForm, priority: event.target.value })}><option>NORMAL</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option></select></label>
              <label>Valor em disputa<input inputMode="decimal" value={createForm.amount} onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} /></label>
              <div className="form-footer span-2"><span><Icon name="shield" />A jornada respeitará tenant, identidade, versão e policy.</span><button className="primary" disabled={busy === 'create'}>{busy === 'create' ? 'Criando…' : 'Criar caso'}<Icon name="arrow" /></button></div>
            </form>
          </Panel>

          <Panel className="context-panel" title="Contexto de execução" description="Configuração aplicada às chamadas do navegador." action={<button className="icon-button" onClick={checkHealth} aria-label="Verificar conexão" title="Verificar conexão"><Icon name="refresh" /></button>}>
            <div className="connection-status">
              <span className={health?.status === 'ok' ? 'connection-icon online' : 'connection-icon'}><Icon name={health?.status === 'ok' ? 'check' : 'alert'} /></span>
              <div><strong>{health?.status === 'ok' ? 'API disponível' : 'API indisponível'}</strong><p>{health?.detail || 'Health check do serviço .NET'}</p></div>
            </div>
            <div className="form-grid compact-form">
              <label>Base URL<input value={apiBaseUrl} onChange={(event) => updateApi(event.target.value)} /></label>
              <label>Tenant ID<input value={tenantId} onChange={(event) => updateTenant(event.target.value)} /></label>
              <label>Identidade manual<select value={identityId} onChange={(event) => setIdentityId(event.target.value)}>{IDENTITY_OPTIONS.map((identity) => <option key={identity.id} value={identity.id}>{identity.label}</option>)}</select></label>
              <label className="toggle-row"><span><strong>Modo guiado</strong><small>Seleciona automaticamente o papel autorizado.</small></span><input type="checkbox" checked={guidedMode} onChange={(event) => setGuidedMode(event.target.checked)} /></label>
            </div>
          </Panel>
        </div>

        <Panel className="cases-panel" title="Fila operacional" description="Casos disponíveis no backend para o tenant atual." action={<button className="secondary" onClick={loadCases} disabled={busy === 'cases'}><Icon name="refresh" />Atualizar</button>}>
          <div className="table-toolbar">
            <label className="search-field"><Icon name="search" /><input aria-label="Buscar casos" placeholder="Buscar por referência, ID, tipo ou estado" value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} /></label>
            <select aria-label="Filtrar por estado" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="ALL">Todos os estados</option>
              {[...new Set(cases.map((item) => item.state).filter(Boolean))].map((state) => <option value={state} key={state}>{formatState(state)}</option>)}
            </select>
          </div>
          {filteredCases.length === 0 ? (
            <EmptyState icon="search" title={cases.length ? 'Nenhum caso encontrado' : 'Fila ainda não carregada'} description={cases.length ? 'Ajuste os filtros para localizar o caso.' : 'Sincronize a fila ou crie uma nova contestação.'} action={!cases.length && <button className="secondary" onClick={loadCases}>Sincronizar agora</button>} />
          ) : (
            <div className="case-table">
              <div className="case-table-head"><span>Caso</span><span>Contexto</span><span>Valor</span><span>Estado</span><span /></div>
              {filteredCases.map((item) => (
                <button key={item.caseId} className="case-row" onClick={() => openCase(item.caseId)}>
                  <span className="case-main"><span className={`priority-dot priority-${String(item.priority || 'NORMAL').toLowerCase()}`} /><span><strong>{item.externalReference}</strong><small>{item.caseId}</small></span></span>
                  <span className="case-context"><strong>{item.disputeType}</strong><small>{item.channel || 'Canal não informado'} · v{item.caseVersion}</small></span>
                  <span className="case-value"><strong>{formatMoney(item.disputedAmount)}</strong><small>{formatDateTime(item.updatedAt || item.createdAt)}</small></span>
                  <Badge state={item.state} />
                  <span className="row-arrow"><Icon name="chevron" /></span>
                </button>
              ))}
            </div>
          )}
          <div className="open-by-id"><span>Já possui o Case ID?</span><div className="inline-form"><input placeholder="Cole o identificador do caso" value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)} /><button className="secondary" onClick={() => openCase()} disabled={!loadCaseId.trim() || busy === 'open'}>Abrir caso</button></div></div>
        </Panel>
      </div>
    )
  }

  function renderActionPanel() {
    if (!activeCase) return null
    const role = nextAction ? identityFor(nextAction) : null
    const header = (
      <div className="action-header">
        <span className="action-index">{Math.min(workflowStepIndex(activeCase.state) + 1, WORKFLOW_STEPS.length)}</span>
        <div><span>Próxima ação recomendada</span><strong>{role?.label || 'Jornada concluída'}</strong></div>
      </div>
    )

    if (nextAction === 'registerDocument') {
      return <Panel className="action-panel" title="Registrar documento" description={`Documento esperado para ${activeCase.disputeType}: ${requiredDocumentType(activeCase.disputeType)}.`} action={header}><form className="action-form" onSubmit={registerDocument}><label>Arquivo (PDF, JPG, PNG, DOCX ou XLSX)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={(event) => setDocumentForm({ file: event.target.files?.[0] || null })} /></label><div className="metadata-row"><span>{documentForm.file ? mediaTypeForFilename(documentForm.file.name) || 'Tipo de arquivo não suportado' : 'Nenhum arquivo selecionado'}</span><span>Classificação por IA/OCR</span><span>If-Match: {activeCase.caseVersion}</span></div><button className="primary" disabled={busy === 'document' || !documentForm.file}>{busy === 'document' ? 'Registrando…' : 'Registrar e validar'}<Icon name="arrow" /></button></form></Panel>
    }
    if (nextAction === 'investigate') {
      return <Panel className="action-panel" title="Executar investigação" description="Cruza transação, sinais de fraude, histórico do cliente e consistência documental." action={header}><div className="check-list">{['Transaction lookup', 'Fraud signal lookup', 'Customer history', 'Document consistency'].map((item) => <span key={item}><Icon name="check" />{item}</span>)}</div><button className="primary" onClick={investigate} disabled={busy === 'investigate'}>{busy === 'investigate' ? 'Investigando…' : 'Executar investigação'}<Icon name="arrow" /></button></Panel>
    }
    if (nextAction === 'recommend') {
      return <Panel className="action-panel" title="Criar recomendação" description="O agente de decisão usa a investigação persistida para produzir a recomendação versionada." action={header}><div className="action-note"><Icon name="bolt" /><div><strong>Decisão assistida por agente</strong><p>A recomendação permanece sujeita à aprovação humana e à segregação de funções.</p></div></div><button className="primary" onClick={recommend} disabled={busy === 'recommend'}>{busy === 'recommend' ? 'Processando…' : 'Gerar recomendação'}<Icon name="arrow" /></button></Panel>
    }
    if (nextAction === 'approve') {
      return <Panel className="action-panel" title="Aprovação humana" description="A decisão é registrada com justificativa, evidências e limite de alçada." action={header}><form className="form-grid form-grid-2" onSubmit={approve}><label>Limite de alçada<input inputMode="decimal" value={approvalForm.authorityLimit} onChange={(event) => setApprovalForm({ ...approvalForm, authorityLimit: event.target.value })} /></label><label className="span-2">Justificativa<textarea value={approvalForm.reason} onChange={(event) => setApprovalForm({ ...approvalForm, reason: event.target.value })} /></label><div className="form-footer span-2"><span><Icon name="shield" />{evidence.length} evidência(s) serão vinculadas à decisão.</span><button className="primary" disabled={busy === 'approve'}>{busy === 'approve' ? 'Aprovando…' : 'Aprovar recomendação'}<Icon name="arrow" /></button></div></form></Panel>
    }
    if (nextAction === 'execute') {
      return <Panel className="action-panel" title="Execução governada" description="Simule o resultado do gateway mantendo idempotência, evidências e rastreabilidade." action={header}><div className="execution-options">{[{ value: 'SUCCESS', label: 'Sucesso', detail: 'Confirma a execução', tone: 'success' }, { value: 'AMBIGUOUS', label: 'Ambíguo', detail: 'Exige reconciliação', tone: 'warning' }, { value: 'FAILED', label: 'Falha', detail: 'Registra erro controlado', tone: 'danger' }].map((option) => <label className={`execution-option option-${option.tone} ${executionMode === option.value ? 'selected' : ''}`} key={option.value}><input type="radio" name="executionMode" value={option.value} checked={executionMode === option.value} onChange={(event) => setExecutionMode(event.target.value)} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</div><button className="primary" onClick={execute} disabled={busy === 'execute'}>{busy === 'execute' ? 'Executando…' : 'Solicitar execução'}<Icon name="arrow" /></button></Panel>
    }
    if (nextAction === 'reconcile') {
      return <Panel className="action-panel action-warning" title="Resolver reconciliação" description="Confirme o resultado real da execução ambígua antes de concluir a jornada." action={header}><form className="form-grid" onSubmit={reconcile}><label>Resolução<select value={reconciliationForm.resolution} onChange={(event) => setReconciliationForm({ ...reconciliationForm, resolution: event.target.value })}><option>CONFIRMED_SUCCEEDED</option><option>CONFIRMED_FAILED</option><option>ESCALATED</option></select></label><label>Justificativa<textarea value={reconciliationForm.reason} onChange={(event) => setReconciliationForm({ ...reconciliationForm, reason: event.target.value })} /></label><button className="primary" disabled={busy === 'reconcile'}>{busy === 'reconcile' ? 'Resolvendo…' : 'Registrar reconciliação'}<Icon name="arrow" /></button></form></Panel>
    }
    return <Panel className="action-panel action-complete" title="Jornada sem ação pendente" description={`O caso está em ${formatState(activeCase.state)}.`} action={header}><div className="completion-state"><span><Icon name="check" size={28} /></span><div><strong>Processamento concluído</strong><p>Consulte evidências, execuções e timeline para revisar o histórico auditável.</p></div><button className="secondary" onClick={() => setView('evidence')}>Abrir auditoria</button></div></Panel>
  }

  function renderCase() {
    if (!activeCase) return <EmptyState icon="workflow" title="Nenhum caso selecionado" description="Abra um caso na visão geral para executar a jornada governada." action={<button className="primary" onClick={() => setView('dashboard')}>Voltar para a fila</button>} />
    const resourceKeys = [
      ['document', 'Documento'],
      ['investigation', 'Investigação'],
      ['recommendation', 'Recomendação'],
      ['approval', 'Aprovação'],
      ['execution', 'Execução'],
    ]
    return (
      <div className="page-stack">
        <section className="case-hero">
          <div className="case-hero-main">
            <button className="back-link" onClick={() => setView('dashboard')}>← Voltar para a fila</button>
            <span className="eyebrow">{activeCase.externalReference}</span>
            <h1>Jornada do caso</h1>
            <div className="case-id-line"><code>{activeCase.caseId}</code><button className="copy-button" onClick={() => copyText(activeCase.caseId)} title="Copiar Case ID"><Icon name="copy" size={15} /></button></div>
          </div>
          <div className="case-hero-status"><Badge state={activeCase.state} /><button className="secondary inverse" onClick={() => openCase(activeCase.caseId)} disabled={busy === 'open'}><Icon name="refresh" />Atualizar dados</button></div>
        </section>

        <WorkflowRail state={activeCase.state} />

        <div className="metrics-grid case-metrics">
          <MetricCard icon="database" label="Versão do caso" value={`v${activeCase.caseVersion}`} detail={`Tenant ${activeCase.tenantId || tenantId}`} />
          <MetricCard icon="activity" label="Valor em disputa" value={formatMoney(activeCase.disputedAmount)} detail={activeCase.disputeType} tone="blue" />
          <MetricCard icon="alert" label="Prioridade" value={activeCase.priority || 'NORMAL'} detail={`Canal ${activeCase.channel || 'não informado'}`} tone={activeCase.priority === 'CRITICAL' ? 'warning' : 'neutral'} />
          <MetricCard icon="clock" label="Última atualização" value={formatDateTime(activeCase.updatedAt || activeCase.createdAt)} detail="Timestamp do backend" />
        </div>

        <div className="case-workspace">
          <div className="case-primary-column">
            {renderActionPanel()}
            <Panel title="Recursos da jornada" description="Identificadores persistidos no workspace local para continuidade entre etapas.">
              <div className="resource-grid">
                {resourceKeys.map(([key, label]) => {
                  const value = activeResources[key]?.[`${key}Id`]
                  return <div className={value ? 'resource-ready' : ''} key={key}><span className="resource-status">{value ? <Icon name="check" size={14} /> : '—'}</span><span>{label}</span><strong title={value}>{value || 'Ainda não criado'}</strong>{value && <button onClick={() => copyText(value)} title={`Copiar ${label}`}><Icon name="copy" size={14} /></button>}</div>
                })}
              </div>
            </Panel>
          </div>

          <aside className="case-side-column">
            <Panel className="case-context-card" title="Contexto de governança">
              <dl className="context-list">
                <div><dt>Modo de identidade</dt><dd>{guidedMode ? 'Guiado por etapa' : 'Manual'}</dd></div>
                <div><dt>Papel da próxima ação</dt><dd>{nextAction ? identityFor(nextAction)?.label : 'Nenhum'}</dd></div>
                <div><dt>Evidências vinculadas</dt><dd>{evidence.length}</dd></div>
                <div><dt>Execuções registradas</dt><dd>{executions.length}</dd></div>
              </dl>
              <button className="secondary full-width" onClick={() => setView('evidence')}><Icon name="shield" />Abrir trilha de auditoria</button>
            </Panel>
            <Panel title="Atividade recente" description="Últimos eventos da timeline.">
              {timeline.length ? <div className="mini-timeline">{timeline.slice(-4).reverse().map((item, index) => <div key={item.entryId || index}><span /><div><strong>{item.type || item.eventType}</strong><small>{formatDateTime(item.occurredAt)}</small></div></div>)}</div> : <EmptyState icon="clock" title="Sem eventos carregados" description="Atualize o caso para consultar a timeline." />}
            </Panel>
          </aside>
        </div>

        {!TERMINAL_STATES.includes(activeCase.state) && <div className="danger-zone"><div><strong>Encerrar esta jornada</strong><p>O cancelamento é versionado, auditável e validado pela policy.</p></div><button className="danger-link" onClick={cancelCase} disabled={busy === 'cancel'}>{busy === 'cancel' ? 'Cancelando…' : 'Cancelar caso'}</button></div>}
      </div>
    )
  }

  function renderEvidence() {
    if (!activeCase) return <EmptyState icon="shield" title="Nenhum caso selecionado" description="Abra um caso para consultar evidências, execuções e timeline." action={<button className="primary" onClick={() => setView('dashboard')}>Abrir fila operacional</button>} />
    return (
      <div className="page-stack">
        <header className="page-heading">
          <div><span className="eyebrow">Auditoria do caso</span><h1>Evidências e execução</h1><p>Visão consolidada dos artefatos persistidos pelo backend para <strong>{activeCase.externalReference}</strong>.</p></div>
          <button className="secondary" onClick={() => loadCaseData()}><Icon name="refresh" />Atualizar auditoria</button>
        </header>

        <div className="metrics-grid">
          <MetricCard icon="file" label="Evidências" value={evidence.length} detail="Artefatos vinculados ao caso" tone="blue" />
          <MetricCard icon="bolt" label="Execuções" value={executions.length} detail="Comandos enviados ao gateway" />
          <MetricCard icon="activity" label="Eventos" value={timeline.length} detail="Entradas na timeline auditável" />
          <MetricCard icon="shield" label="Estado atual" value={formatState(activeCase.state)} detail={`Case version ${activeCase.caseVersion}`} tone={stateTone(activeCase.state)} />
        </div>

        <div className="audit-grid">
          <Panel title={`Evidências (${evidence.length})`} description="Documentos, findings e referências usadas nas decisões.">
            {evidence.length ? <div className="artifact-list">{evidence.map((item, index) => <details key={item.evidenceId || index}><summary><span className="artifact-icon"><Icon name="file" /></span><span><strong>{item.evidenceType || 'Evidência'}</strong><small>{item.sourceType || 'Origem não informada'} · {item.evidenceId}</small></span><Badge state="APPROVED">Persistida</Badge></summary><JsonBlock value={item} /></details>)}</div> : <EmptyState icon="file" title="Sem evidências" description="Registre um documento validado para iniciar a trilha probatória." />}
          </Panel>
          <Panel title={`Execuções (${executions.length})`} description="Resultados retornados pelo gateway de execução.">
            {executions.length ? <div className="artifact-list">{executions.map((item, index) => <details key={item.executionId || index}><summary><span className="artifact-icon"><Icon name="bolt" /></span><span><strong>{item.status || 'Execução'}</strong><small>{item.executionId} · {formatDateTime(item.createdAt || item.executedAt)}</small></span><Badge state={item.status === 'SUCCEEDED' ? 'EXECUTED' : item.status === 'AMBIGUOUS' ? 'RECONCILIATION_REQUIRED' : 'FAILED'}>{item.status}</Badge></summary><JsonBlock value={item} /></details>)}</div> : <EmptyState icon="bolt" title="Sem execuções" description="A execução é criada depois de uma aprovação válida." />}
          </Panel>
        </div>

        <Panel title={`Timeline auditável (${timeline.length})`} description="Sequência cronológica de eventos, decisões e transições de estado.">
          {timeline.length ? <div className="timeline">{timeline.map((item, index) => <div className="timeline-item" key={item.entryId || index}><span>{index + 1}</span><div className="timeline-content"><div><strong>{item.type || item.eventType}</strong><small>{formatDateTime(item.occurredAt)}</small></div><p>{item.reason || item.origin || 'Evento auditável registrado pela plataforma.'}</p>{item.actorId && <code>{item.actorId}</code>}</div></div>)}</div> : <EmptyState icon="clock" title="Timeline vazia" description="Atualize os dados para consultar os eventos do caso." />}
        </Panel>
      </div>
    )
  }

  function renderConsole() {
    return (
      <div className="page-stack">
        <header className="page-heading">
          <div><span className="eyebrow">Observabilidade local</span><h1>Console de API</h1><p>Requisições, identidades, correlações, latência e respostas Problem Details.</p></div>
          <button className="secondary" onClick={() => setLogs([])} disabled={!logs.length}>Limpar histórico</button>
        </header>

        <div className="metrics-grid">
          <MetricCard icon="terminal" label="Chamadas" value={logs.length} detail="Últimas 100 requisições" />
          <MetricCard icon="check" label="Sucesso" value={logMetrics.success} detail="Respostas HTTP válidas" tone="success" />
          <MetricCard icon="alert" label="Erros" value={logMetrics.errors} detail="Falhas HTTP ou de rede" tone={logMetrics.errors ? 'warning' : 'neutral'} />
          <MetricCard icon="clock" label="Latência média" value={`${logMetrics.avgLatency} ms`} detail="Tempo observado no navegador" tone="blue" />
        </div>

        <Panel className="console-panel" title="Tráfego recente" description="Expanda uma linha para inspecionar o payload retornado.">
          {logs.length ? <div className="log-list">{logs.map((log) => <details key={log.id}><summary><span className={`http-status ${log.ok ? 'status-ok' : 'status-error'}`}>{log.status || 'ERR'}</span><span className="request-method">{log.request?.method || 'GET'}</span><span className="request-path"><strong>{log.label}</strong><small>{log.request?.path || '/health'}</small></span><span className="request-identity">{log.request?.identity}</span><span className="request-latency">{log.elapsedMs} ms</span><Icon name="chevron" /></summary><div className="log-meta"><span>Correlation ID <code>{log.correlationId}</code></span><span>{formatDateTime(log.timestamp)}</span></div><JsonBlock value={log.data} /></details>)}</div> : <EmptyState icon="terminal" title="Sem chamadas registradas" description="Interaja com a aplicação para capturar requisições e respostas." />}
        </Panel>
      </div>
    )
  }

  const content = view === 'dashboard' ? renderDashboard() : view === 'case' ? renderCase() : view === 'evidence' ? renderEvidence() : renderConsole()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>IB</span></div>
          <div><strong>Intelligent Backoffice</strong><span>Operations Console</span></div>
        </div>

        <div className="nav-label">Workspace</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} aria-label={item.label} title={item.label} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              {item.id === 'case' && activeCase && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        {activeCase && (
          <button className="active-case-card" onClick={() => setView('case')}>
            <span>Caso em contexto</span>
            <strong>{activeCase.externalReference}</strong>
            <small>{formatMoney(activeCase.disputedAmount)}</small>
            <Badge state={activeCase.state} />
          </button>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-status"><span className={health?.status === 'ok' ? 'dot online' : 'dot'} /><div><strong>{health?.status === 'ok' ? 'API conectada' : 'API indisponível'}</strong><small>{tenantId}</small></div><button onClick={checkHealth} aria-label="Verificar API"><Icon name="refresh" size={15} /></button></div>
          <small>Frontend v0.2 · React 19</small>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Intelligent Backoffice</span><Icon name="chevron" size={14} /><strong>{activeNav.label}</strong></div>
          <div className="topbar-context"><span className={`environment-badge ${health?.status === 'ok' ? 'online' : ''}`}>{health?.status === 'ok' ? 'Online' : 'Offline'}</span><span>{guidedMode ? 'Modo guiado' : selectedIdentity.label}</span><button className="icon-button" title="Configurações da conexão" onClick={() => setView('dashboard')}><Icon name="settings" /></button></div>
        </header>
        <main>
          {notice && <div className={`notice notice-${notice.type}`} role="status"><Icon name={notice.type === 'success' ? 'check' : 'alert'} />{notice.message}</div>}
          {content}
        </main>
      </div>
    </div>
  )
}

export default App

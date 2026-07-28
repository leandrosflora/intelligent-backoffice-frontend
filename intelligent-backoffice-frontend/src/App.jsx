import { useEffect, useMemo, useState } from 'react'
import './App.css'

import { PlatformClient } from './api/client.js'
import { ACTION_IDENTITIES, IDENTITIES, IDENTITY_OPTIONS } from './config/identities.js'
import {
  WORKFLOW_STEPS,
  apiErrorMessage,
  createId,
  extractMetric,
  formatCents,
  formatState,
  nextActionForState,
  parseBrlToCents,
  stateTone,
  workflowStepIndex,
} from './lib/workflow.js'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão geral', icon: 'grid' },
  { id: 'case', label: 'Jornada do caso', icon: 'case' },
  { id: 'operations', label: 'Operações e eventos', icon: 'layers' },
  { id: 'observability', label: 'Observabilidade', icon: 'pulse' },
  { id: 'console', label: 'Console de API', icon: 'terminal' },
]

const ICON_PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  case: 'M6 3h12v4H6zM4 7h16v14H4zM8 11h8M8 15h5',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  terminal: 'm5 7 4 4-4 4M11 17h8',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.2 6.4L4 11M5.5 15A7 7 0 0 0 17.8 17.6L20 13',
  check: 'm5 12 4 4L19 6',
  warning: 'M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01',
  shield: 'M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  document: 'M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  play: 'm9 6 9 6-9 6Z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14M10 11v6m4-6v6',
}

function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name] || ICON_PATHS.grid} />
    </svg>
  )
}

function Logo() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function StatusBadge({ state, label }) {
  const tone = stateTone(state)
  return <span className={`badge badge-${tone}`}>{label || formatState(state)}</span>
}

function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
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

function EmptyState({ icon = 'case', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function WorkflowRail({ state }) {
  const current = workflowStepIndex(state)
  return (
    <div className="workflow-rail">
      {WORKFLOW_STEPS.map((step, index) => {
        const completed = index < current || state === 'EXECUTED'
        const active = index === current && state !== 'EXECUTED'
        return (
          <div className={`workflow-step ${completed ? 'is-complete' : ''} ${active ? 'is-active' : ''}`} key={step.key}>
            <div className="workflow-node">{completed ? <Icon name="check" size={14} /> : index + 1}</div>
            <div>
              <strong>{step.label}</strong>
              <span>{step.group}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DataTable({ columns, rows, empty = 'Nenhum registro encontrado.' }) {
  if (!rows?.length) return <div className="table-empty">{empty}</div>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.event_id || row.case_id || rowIndex}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function readSavedCases() {
  try {
    return JSON.parse(localStorage.getItem('backoffice-ui-cases') || '[]')
  } catch {
    return []
  }
}

function App() {
  const [view, setView] = useState('dashboard')
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('backoffice-ui-api') || '/api')
  const client = useMemo(() => new PlatformClient(apiBaseUrl), [apiBaseUrl])
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [guidedMode, setGuidedMode] = useState(true)
  const [identityId, setIdentityId] = useState('caseManager')
  const [savedCases, setSavedCases] = useState(readSavedCases)
  const [activeCase, setActiveCase] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [operations, setOperations] = useState({ outbox: [], projections: [], deadLetters: [], timers: [] })
  const [operationTab, setOperationTab] = useState('outbox')
  const [metrics, setMetrics] = useState('')
  const [createForm, setCreateForm] = useState({
    externalId: `ui-case-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 1000)}`,
    disputeType: 'CARD_PURCHASE',
    amount: '120,00',
  })
  const [loadCaseId, setLoadCaseId] = useState('')
  const [documentForm, setDocumentForm] = useState({ documentId: createId('doc'), filename: 'comprovante.pdf' })
  const [recommendationRationale, setRecommendationRationale] = useState('As evidências sintéticas confirmam a contestação.')
  const [approvalForm, setApprovalForm] = useState({ limit: '500,00', reason: 'Dentro da alçada delegada.' })
  const [executionMode, setExecutionMode] = useState('SUCCESS')
  const [reconciliationForm, setReconciliationForm] = useState({
    resolution: 'CONFIRMED_SUCCEEDED',
    reason: 'O sistema de registro confirmou que a execução mock foi concluída.',
  })

  const selectedIdentity = IDENTITIES[identityId]
  const activeAction = activeCase ? nextActionForState(activeCase.state) : null
  const effectiveIdentity = activeAction && guidedMode ? IDENTITIES[ACTION_IDENTITIES[activeAction]] : selectedIdentity

  useEffect(() => {
    checkHealth()
  }, [client])

  function identityFor(action) {
    return guidedMode ? IDENTITIES[ACTION_IDENTITIES[action]] : selectedIdentity
  }

  function addLog(label, result) {
    const entry = {
      id: createId('log'),
      label,
      timestamp: new Date().toISOString(),
      ...result,
    }
    setLogs((current) => [entry, ...current].slice(0, 100))
  }

  function showNotice(type, message) {
    setNotice({ type, message })
    window.setTimeout(() => setNotice(null), 4500)
  }

  async function invoke(label, promise) {
    const result = await promise
    addLog(label, result)
    if (!result.ok) {
      const message = apiErrorMessage(result.data, result.status)
      showNotice('error', `${label}: ${message}`)
      throw new Error(message)
    }
    return result.data
  }

  function persistCase(caseData) {
    if (!caseData?.case_id) return
    setActiveCase(caseData)
    setSavedCases((current) => {
      const item = {
        case_id: caseData.case_id,
        external_id: caseData.external_id,
        state: caseData.state,
        version: caseData.version,
        amount_cents: caseData.amount_cents,
        execution_id: caseData.execution_id || current.find((saved) => saved.case_id === caseData.case_id)?.execution_id || null,
        updated_at: new Date().toISOString(),
      }
      const next = [item, ...current.filter((saved) => saved.case_id !== item.case_id)].slice(0, 20)
      localStorage.setItem('backoffice-ui-cases', JSON.stringify(next))
      return next
    })
  }

  async function checkHealth() {
    setHealthLoading(true)
    const result = await client.health()
    addLog('Health check', result)
    setHealth(result.ok ? result.data : { status: 'unavailable', detail: apiErrorMessage(result.data, result.status) })
    setHealthLoading(false)
  }

  async function createCase(event) {
    event.preventDefault()
    setBusy('create')
    try {
      const data = await invoke('Criar caso', client.request('/v1/cases', {
        method: 'POST',
        identity: identityFor('createCase'),
        body: {
          external_id: createForm.externalId,
          dispute_type: createForm.disputeType,
          amount_cents: parseBrlToCents(createForm.amount),
        },
      }))
      persistCase(data)
      setTimeline([])
      setView('case')
      showNotice('success', 'Caso criado e salvo no workspace local.')
    } catch {
      // A notificação já foi registrada pelo cliente.
    } finally {
      setBusy('')
    }
  }

  async function openCase(caseId = loadCaseId) {
    const id = String(caseId || '').trim()
    if (!id) return
    setBusy('load')
    try {
      const data = await invoke('Consultar caso', client.request(`/v1/cases/${id}`, { identity: identityFor('readCase') }))
      persistCase(data)
      setTimeline([])
      setView('case')
    } catch {
      // A notificação já foi registrada pelo cliente.
    } finally {
      setBusy('')
    }
  }

  async function refreshActiveCase() {
    if (!activeCase) return
    await openCase(activeCase.case_id)
  }

  async function registerDocument(event) {
    event.preventDefault()
    setBusy('document')
    try {
      const data = await invoke('Registrar documento', client.request(`/v1/cases/${activeCase.case_id}/documents`, {
        method: 'POST',
        identity: identityFor('registerDocument'),
        headers: { 'If-Match': String(activeCase.version) },
        body: {
          document_id: documentForm.documentId,
          filename: documentForm.filename,
          content_type: 'application/pdf',
        },
      }))
      persistCase(data)
      showNotice('success', 'Documento classificado e evidência registrada.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function investigate() {
    setBusy('investigate')
    try {
      const data = await invoke('Executar investigação', client.request(`/v1/cases/${activeCase.case_id}/investigations`, {
        method: 'POST',
        identity: identityFor('investigate'),
        headers: { 'If-Match': String(activeCase.version) },
        body: {},
      }))
      persistCase(data)
      showNotice('success', 'Investigação determinística concluída.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function recommend(event) {
    event.preventDefault()
    setBusy('recommend')
    try {
      const data = await invoke('Criar recomendação', client.request(`/v1/cases/${activeCase.case_id}/recommendations`, {
        method: 'POST',
        identity: identityFor('recommend'),
        headers: { 'If-Match': String(activeCase.version) },
        body: {
          outcome: 'APPROVE',
          rationale: recommendationRationale,
          evidence_references: activeCase.evidence_references || [],
        },
      }))
      persistCase(data)
      showNotice('success', 'Recomendação enviada para aprovação humana.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function approve(event) {
    event.preventDefault()
    setBusy('approve')
    try {
      const data = await invoke('Aprovar decisão', client.request(`/v1/cases/${activeCase.case_id}/approvals`, {
        method: 'POST',
        identity: identityFor('approve'),
        headers: { 'If-Match': String(activeCase.version) },
        body: {
          decision: 'APPROVED',
          authority_limit_cents: parseBrlToCents(approvalForm.limit),
          reason: approvalForm.reason,
        },
      }))
      persistCase(data)
      showNotice('success', 'Aprovação humana registrada.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function execute() {
    setBusy('execute')
    const idempotencyKey = createId(executionMode === 'SUCCESS' ? 'execution' : 'ambiguous')
    try {
      const data = await invoke('Executar comando', client.request(`/v1/cases/${activeCase.case_id}/executions`, {
        method: 'POST',
        identity: identityFor('execute'),
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { result_mode: executionMode },
      }))
      persistCase(data)
      showNotice(executionMode === 'SUCCESS' ? 'success' : 'warning', executionMode === 'SUCCESS' ? 'Execução mock concluída.' : 'Resultado ambíguo encaminhado para reconciliação.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function reconcile(event) {
    event.preventDefault()
    const executionId = activeCase.execution_id || savedCases.find((item) => item.case_id === activeCase.case_id)?.execution_id
    if (!executionId) {
      showNotice('error', 'O identificador da execução não está disponível. Atualize ou reabra o caso.')
      return
    }
    setBusy('reconcile')
    try {
      const data = await invoke('Resolver reconciliação', client.request(`/v1/cases/${activeCase.case_id}/reconciliations/${executionId}/resolve`, {
        method: 'POST',
        identity: identityFor('reconcile'),
        headers: {
          'If-Match': String(activeCase.version),
          'Idempotency-Key': createId('reconciliation'),
        },
        body: {
          case_version: activeCase.version,
          resolution: reconciliationForm.resolution,
          reason: reconciliationForm.reason,
        },
      }))
      persistCase(data)
      showNotice('success', 'Resultado reconciliado e registrado na timeline.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function loadTimeline() {
    if (!activeCase) return
    setBusy('timeline')
    try {
      const data = await invoke('Consultar timeline', client.request(`/v1/cases/${activeCase.case_id}/timeline`, {
        identity: identityFor('timeline'),
      }))
      setTimeline(data)
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function loadOperations() {
    setBusy('operations')
    try {
      const identity = identityFor('operations')
      const [outbox, projections, deadLetters, timers] = await Promise.all([
        invoke('Consultar outbox', client.request('/v1/operations/outbox?limit=200', { identity })),
        invoke('Consultar projeções', client.request('/v1/operations/event-projections?limit=200', { identity })),
        invoke('Consultar dead letters', client.request('/v1/operations/dead-letters?limit=200', { identity })),
        invoke('Consultar timers', client.request('/v1/operations/timers?limit=200', { identity })),
      ])
      setOperations({ outbox, projections, deadLetters, timers })
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function replayDeadLetter(row) {
    setBusy(`replay-${row.id}`)
    try {
      await invoke('Reprocessar dead letter', client.request(`/v1/operations/dead-letters/${row.id}/replay`, {
        method: 'POST',
        identity: identityFor('operations'),
        body: { reason: 'Replay manual autorizado pelo console operacional.' },
      }))
      await loadOperations()
      showNotice('success', 'Replay solicitado e auditado.')
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  async function loadObservability() {
    setBusy('observability')
    try {
      const [healthData, metricsData] = await Promise.all([
        invoke('Health check', client.health()),
        invoke('Consultar métricas', client.metrics()),
      ])
      setHealth(healthData)
      setMetrics(typeof metricsData === 'string' ? metricsData : JSON.stringify(metricsData, null, 2))
    } catch {
      // handled
    } finally {
      setBusy('')
    }
  }

  function changeApiBaseUrl(value) {
    setApiBaseUrl(value)
    localStorage.setItem('backoffice-ui-api', value)
  }

  function removeSavedCase(caseId) {
    setSavedCases((current) => {
      const next = current.filter((item) => item.case_id !== caseId)
      localStorage.setItem('backoffice-ui-cases', JSON.stringify(next))
      return next
    })
    if (activeCase?.case_id === caseId) setActiveCase(null)
  }

  const metricCards = [
    { label: 'Casos criados', value: extractMetric(metrics, 'backoffice_cases_created_total') },
    { label: 'Reconciliações', value: extractMetric(metrics, 'backoffice_reconciliations_total') },
    { label: 'Outbox pendente', value: extractMetric(metrics, 'backoffice_outbox_messages') },
    { label: 'Requisições HTTP', value: extractMetric(metrics, 'backoffice_http_requests_total') },
  ]

  function renderDashboard() {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Intelligent Backoffice</span>
            <h1>Console de validação da plataforma</h1>
            <p>Execute a jornada regulada, altere identidades e acompanhe as evidências geradas pelo workflow.</p>
          </div>
          <button className="button button-secondary" onClick={checkHealth} disabled={healthLoading}>
            <Icon name="refresh" /> {healthLoading ? 'Verificando' : 'Atualizar status'}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} />
            <span>Plataforma</span>
            <strong>{health?.status === 'ok' ? 'Disponível' : 'Indisponível'}</strong>
            <small>{health?.eventingEnabled ? 'Eventing habilitado' : 'Profile básico ou desconectado'}</small>
          </div>
          <div className="stat-card"><Icon name="case" /><span>Casos locais</span><strong>{savedCases.length}</strong><small>Índices armazenados neste navegador</small></div>
          <div className="stat-card"><Icon name="shield" /><span>Modo de identidade</span><strong>{guidedMode ? 'Guiado' : 'Manual'}</strong><small>{guidedMode ? 'Papel correto por operação' : selectedIdentity.label}</small></div>
          <div className="stat-card"><Icon name="pulse" /><span>Endpoint</span><strong className="stat-code">{apiBaseUrl}</strong><small>Proxy local ou URL configurada</small></div>
        </div>

        <div className="dashboard-grid">
          <Panel title="Abrir nova contestação" description="A API utiliza dados sintéticos e execução financeira mock.">
            <form className="form-grid" onSubmit={createCase}>
              <label className="field field-span-2">
                <span>Referência externa</span>
                <input value={createForm.externalId} onChange={(event) => setCreateForm({ ...createForm, externalId: event.target.value })} required />
              </label>
              <label className="field">
                <span>Tipo de contestação</span>
                <select value={createForm.disputeType} onChange={(event) => setCreateForm({ ...createForm, disputeType: event.target.value })}>
                  <option value="CARD_PURCHASE">Compra com cartão</option>
                  <option value="PIX">Pix</option>
                  <option value="TRANSFER">Transferência</option>
                  <option value="CASH_WITHDRAWAL">Saque</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>
              <label className="field">
                <span>Valor contestado</span>
                <div className="money-input"><span>R$</span><input value={createForm.amount} onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} required /></div>
              </label>
              <div className="form-actions field-span-2">
                <button className="button button-primary" disabled={busy === 'create'}><Icon name="plus" />{busy === 'create' ? 'Criando...' : 'Criar e iniciar jornada'}</button>
              </div>
            </form>
          </Panel>

          <Panel title="Abrir caso existente" description="O backend ainda não oferece listagem global; o console mantém os IDs usados neste navegador.">
            <div className="inline-form">
              <input placeholder="UUID do caso" value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)} />
              <button className="button button-secondary" onClick={() => openCase()} disabled={busy === 'load'}><Icon name="arrow" /> Abrir</button>
            </div>
            <div className="principle-card">
              <Icon name="shield" size={22} />
              <div><strong>Limite de autonomia</strong><p>A IA recomenda. A aprovação é humana. A execução é governada e idempotente.</p></div>
            </div>
          </Panel>
        </div>

        <Panel title="Casos recentes" description="Atalhos locais para continuar os testes." action={<button className="text-button" onClick={() => setSavedCases([])}>Limpar visualização</button>}>
          <DataTable
            rows={savedCases}
            columns={[
              { key: 'external_id', label: 'Referência' },
              { key: 'case_id', label: 'Case ID', render: (row) => <code className="compact-code">{row.case_id}</code> },
              { key: 'amount_cents', label: 'Valor', render: (row) => formatCents(row.amount_cents) },
              { key: 'state', label: 'Estado', render: (row) => <StatusBadge state={row.state} /> },
              { key: 'actions', label: '', render: (row) => <div className="row-actions"><button className="icon-button" title="Abrir" onClick={() => openCase(row.case_id)}><Icon name="eye" /></button><button className="icon-button danger" title="Remover atalho" onClick={() => removeSavedCase(row.case_id)}><Icon name="trash" /></button></div> },
            ]}
          />
        </Panel>
      </div>
    )
  }

  function renderActionPanel() {
    if (!activeCase) return null
    const action = nextActionForState(activeCase.state)
    if (!action) {
      return <EmptyState icon="check" title="Jornada sem próxima ação" description={`O caso está em ${formatState(activeCase.state)}. Consulte a timeline para revisar as evidências.`} action={<button className="button button-secondary" onClick={loadTimeline}><Icon name="eye" /> Consultar timeline</button>} />
    }
    if (action === 'registerDocument') {
      return <form className="action-form" onSubmit={registerDocument}><div className="action-title"><div className="action-number">1</div><div><h3>Registrar documento sintético</h3><p>A baseline recebe metadados e cria uma evidência versionada.</p></div></div><label className="field"><span>Document ID</span><input value={documentForm.documentId} onChange={(event) => setDocumentForm({ ...documentForm, documentId: event.target.value })} /></label><label className="field"><span>Nome do arquivo</span><input value={documentForm.filename} onChange={(event) => setDocumentForm({ ...documentForm, filename: event.target.value })} /></label><button className="button button-primary" disabled={busy === 'document'}><Icon name="document" /> {busy === 'document' ? 'Processando...' : 'Classificar e registrar'}</button></form>
    }
    if (action === 'investigate') {
      return <div className="action-form"><div className="action-title"><div className="action-number">2</div><div><h3>Executar investigação</h3><p>O analista aciona consultas mock e registra findings na timeline.</p></div></div><div className="evidence-list">{activeCase.evidence_references?.map((reference) => <code key={reference}>{reference}</code>)}</div><button className="button button-primary" onClick={investigate} disabled={busy === 'investigate'}><Icon name="play" /> {busy === 'investigate' ? 'Investigando...' : 'Executar investigação'}</button></div>
    }
    if (action === 'recommend') {
      return <form className="action-form" onSubmit={recommend}><div className="action-title"><div className="action-number">3</div><div><h3>Produzir recomendação</h3><p>O workload de decisão deve permanecer grounded nas evidências.</p></div></div><label className="field"><span>Racional explicável</span><textarea rows="4" value={recommendationRationale} onChange={(event) => setRecommendationRationale(event.target.value)} /></label><button className="button button-primary" disabled={busy === 'recommend'}><Icon name="arrow" /> {busy === 'recommend' ? 'Recomendando...' : 'Recomendar aprovação'}</button></form>
    }
    if (action === 'approve') {
      return <form className="action-form" onSubmit={approve}><div className="action-title"><div className="action-number">4</div><div><h3>Aprovação humana</h3><p>O OPA valida alçada, versão e segregação de funções.</p></div></div><label className="field"><span>Alçada disponível</span><div className="money-input"><span>R$</span><input value={approvalForm.limit} onChange={(event) => setApprovalForm({ ...approvalForm, limit: event.target.value })} /></div></label><label className="field"><span>Justificativa</span><textarea rows="3" value={approvalForm.reason} onChange={(event) => setApprovalForm({ ...approvalForm, reason: event.target.value })} /></label><button className="button button-primary" disabled={busy === 'approve'}><Icon name="check" /> {busy === 'approve' ? 'Aprovando...' : 'Aprovar decisão'}</button></form>
    }
    if (action === 'execute') {
      return <div className="action-form"><div className="action-title"><div className="action-number">5</div><div><h3>Execução governada</h3><p>Escolha o resultado do mock para validar o caminho feliz ou a reconciliação.</p></div></div><div className="segmented-control"><button className={executionMode === 'SUCCESS' ? 'active' : ''} onClick={() => setExecutionMode('SUCCESS')}>Sucesso</button><button className={executionMode === 'AMBIGUOUS' ? 'active warning' : ''} onClick={() => setExecutionMode('AMBIGUOUS')}>Resultado ambíguo</button></div><div className="callout"><Icon name={executionMode === 'SUCCESS' ? 'check' : 'warning'} /><p>{executionMode === 'SUCCESS' ? 'A execução mock será concluída e o caso chegará a EXECUTED.' : 'O caso será bloqueado em RECONCILIATION_REQUIRED; não haverá retry cego.'}</p></div><button className="button button-primary" onClick={execute} disabled={busy === 'execute'}><Icon name="play" /> {busy === 'execute' ? 'Executando...' : 'Executar comando idempotente'}</button></div>
    }
    return <form className="action-form" onSubmit={reconcile}><div className="action-title"><div className="action-number warning">R</div><div><h3>Resolver execução ambígua</h3><p>Somente o reconciliador pode registrar o resultado confirmado.</p></div></div><label className="field"><span>Resultado confirmado</span><select value={reconciliationForm.resolution} onChange={(event) => setReconciliationForm({ ...reconciliationForm, resolution: event.target.value })}><option value="CONFIRMED_SUCCEEDED">Execução confirmada</option><option value="CONFIRMED_FAILED">Falha confirmada</option><option value="ESCALATED">Escalar investigação</option></select></label><label className="field"><span>Evidência consultada</span><textarea rows="4" value={reconciliationForm.reason} onChange={(event) => setReconciliationForm({ ...reconciliationForm, reason: event.target.value })} /></label><button className="button button-primary" disabled={busy === 'reconcile'}><Icon name="check" /> {busy === 'reconcile' ? 'Reconciliando...' : 'Registrar reconciliação'}</button></form>
  }

  function renderCaseWorkspace() {
    if (!activeCase) {
      return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Workflow</span><h1>Jornada do caso</h1><p>Abra ou crie um caso para testar as transições.</p></div></div><Panel><EmptyState title="Nenhum caso selecionado" description="Use a visão geral para criar um caso ou informe um UUID existente." action={<button className="button button-primary" onClick={() => setView('dashboard')}><Icon name="plus" /> Ir para abertura</button>} /></Panel></div>
    }
    return (
      <div className="page-stack">
        <div className="case-heading">
          <div><span className="eyebrow">{activeCase.external_id}</span><h1>Contestação {activeCase.case_id.slice(0, 8)}</h1><div className="heading-meta"><StatusBadge state={activeCase.state} /><span>Versão {activeCase.version}</span><span>{formatCents(activeCase.amount_cents)}</span></div></div>
          <div className="heading-actions"><button className="button button-secondary" onClick={refreshActiveCase} disabled={busy === 'load'}><Icon name="refresh" /> Atualizar</button><button className="button button-secondary" onClick={loadTimeline} disabled={busy === 'timeline'}><Icon name="eye" /> Timeline</button></div>
        </div>
        <Panel className="workflow-panel"><WorkflowRail state={activeCase.state} /></Panel>
        <div className="case-grid">
          <Panel title="Próxima operação" description={`Executando como ${effectiveIdentity?.label || selectedIdentity.label}.`} className="action-panel">{renderActionPanel()}</Panel>
          <div className="side-stack">
            <Panel title="Contexto do caso"><dl className="detail-list"><div><dt>Case ID</dt><dd><code>{activeCase.case_id}</code></dd></div><div><dt>Estado</dt><dd>{formatState(activeCase.state)}</dd></div><div><dt>Valor</dt><dd>{formatCents(activeCase.amount_cents)}</dd></div><div><dt>Versão</dt><dd>{activeCase.version}</dd></div><div><dt>Recomendação</dt><dd>{activeCase.recommendation_version || '—'}</dd></div><div><dt>Execução</dt><dd>{activeCase.execution_status || '—'}</dd></div></dl></Panel>
            <Panel title="Evidências"><div className="evidence-list">{activeCase.evidence_references?.length ? activeCase.evidence_references.map((reference) => <code key={reference}>{reference}</code>) : <p className="muted">Nenhuma evidência registrada.</p>}</div></Panel>
          </div>
        </div>
        <Panel title="Timeline auditável" description="Eventos são carregados sob a identidade do auditor." action={<button className="text-button" onClick={loadTimeline}>Atualizar timeline</button>}>
          {timeline.length ? <div className="timeline">{timeline.map((entry, index) => <div className="timeline-entry" key={`${entry.eventType}-${entry.occurredAt}-${index}`}><div className="timeline-dot" /><div><div className="timeline-title"><strong>{entry.eventType}</strong><span>{entry.occurredAt}</span></div><p>Ator: {entry.actorId} · Correlação: {entry.correlationId}</p>{Object.keys(entry.payload || {}).length > 0 && <pre>{JSON.stringify(entry.payload, null, 2)}</pre>}</div></div>)}</div> : <EmptyState icon="pulse" title="Timeline ainda não carregada" description="Consulte a trilha para visualizar atores, correlações e payloads minimizados." />}
        </Panel>
      </div>
    )
  }

  const operationConfig = {
    outbox: { label: 'Outbox', rows: operations.outbox, columns: [{ key: 'event_type', label: 'Evento' }, { key: 'aggregate_id', label: 'Caso', render: (row) => <code className="compact-code">{row.aggregate_id}</code> }, { key: 'status', label: 'Status', render: (row) => <StatusBadge state={row.status === 'PUBLISHED' ? 'EXECUTED' : 'RECONCILIATION_REQUIRED'} label={row.status} /> }, { key: 'attempts', label: 'Tentativas' }] },
    projections: { label: 'Projeções', rows: operations.projections, columns: [{ key: 'event_type', label: 'Evento' }, { key: 'consumer_name', label: 'Consumer' }, { key: 'aggregate_id', label: 'Caso', render: (row) => <code className="compact-code">{row.aggregate_id}</code> }, { key: 'replay_count', label: 'Replay' }] },
    deadLetters: { label: 'Dead letters', rows: operations.deadLetters, columns: [{ key: 'event_type', label: 'Evento' }, { key: 'aggregate_id', label: 'Caso', render: (row) => <code className="compact-code">{row.aggregate_id}</code> }, { key: 'status', label: 'Status' }, { key: 'error', label: 'Erro' }, { key: 'actions', label: '', render: (row) => row.status === 'OPEN' ? <button className="button button-small" onClick={() => replayDeadLetter(row)} disabled={busy === `replay-${row.id}`}>Replay</button> : '—' }] },
    timers: { label: 'Timers', rows: operations.timers, columns: [{ key: 'timer_type', label: 'Tipo' }, { key: 'aggregate_id', label: 'Caso', render: (row) => <code className="compact-code">{row.aggregate_id}</code> }, { key: 'status', label: 'Status' }, { key: 'due_at', label: 'Execução prevista' }] },
  }

  function renderOperations() {
    const current = operationConfig[operationTab]
    return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Event backbone</span><h1>Operações e eventos</h1><p>Inspecione publicação, consumo, timers, falhas e replay controlado.</p></div><button className="button button-primary" onClick={loadOperations} disabled={busy === 'operations'}><Icon name="refresh" /> {busy === 'operations' ? 'Carregando...' : 'Atualizar operações'}</button></div><div className="stats-grid compact"><div className="stat-card"><span>Outbox</span><strong>{operations.outbox.length}</strong><small>Mensagens persistidas</small></div><div className="stat-card"><span>Projeções</span><strong>{operations.projections.length}</strong><small>Eventos processados</small></div><div className="stat-card"><span>Dead letters</span><strong>{operations.deadLetters.filter((row) => row.status === 'OPEN').length}</strong><small>Abertas para análise</small></div><div className="stat-card"><span>Timers</span><strong>{operations.timers.length}</strong><small>Agendados ou executados</small></div></div><Panel><div className="tabs">{Object.entries(operationConfig).map(([key, config]) => <button className={operationTab === key ? 'active' : ''} key={key} onClick={() => setOperationTab(key)}>{config.label}<span>{config.rows.length}</span></button>)}</div><DataTable rows={current.rows} columns={current.columns} empty="Nenhuma evidência operacional carregada. Inicie o profile distributed e atualize a consulta." /></Panel></div>
  }

  function renderObservability() {
    return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Runtime telemetry</span><h1>Observabilidade</h1><p>Health, métricas Prometheus e características do profile em execução.</p></div><button className="button button-primary" onClick={loadObservability} disabled={busy === 'observability'}><Icon name="refresh" /> Atualizar telemetria</button></div><div className="stats-grid">{metricCards.map((card) => <div className="stat-card" key={card.label}><Icon name="pulse" /><span>{card.label}</span><strong>{card.value ?? '—'}</strong><small>Valor exposto pelo runtime</small></div>)}</div><div className="dashboard-grid"><Panel title="Health da plataforma"><dl className="detail-list"><div><dt>Status</dt><dd><StatusBadge state={health?.status === 'ok' ? 'EXECUTED' : 'FAILED'} label={health?.status || 'desconhecido'} /></dd></div><div><dt>Policy mode</dt><dd>{health?.policyMode || '—'}</dd></div><div><dt>Eventing</dt><dd>{String(health?.eventingEnabled ?? '—')}</dd></div><div><dt>Métricas</dt><dd>{String(health?.metricsEnabled ?? '—')}</dd></div><div><dt>Tracing</dt><dd>{String(health?.tracingEnabled ?? '—')}</dd></div><div><dt>Identidade</dt><dd>{health?.identityMode || '—'}</dd></div></dl></Panel><Panel title="Interpretação"><div className="principle-card"><Icon name="warning" size={22} /><div><strong>Baseline não é produção</strong><p>Os indicadores comprovam mecanismos locais. Não demonstram HA, volume representativo, DR regional ou operação 24x7.</p></div></div><div className="principle-card"><Icon name="shield" size={22} /><div><strong>Policies fail closed</strong><p>Indisponibilidade do PDP deve bloquear operações sensíveis, não liberar execução.</p></div></div></Panel></div><Panel title="Exposição Prometheus" description="Conteúdo bruto retornado por /metrics."><pre className="metrics-raw">{metrics || 'Clique em Atualizar telemetria para carregar as métricas.'}</pre></Panel></div>
  }

  function renderConsole() {
    return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">API evidence</span><h1>Console de chamadas</h1><p>Histórico local de requisições, identidades, latência e respostas.</p></div><button className="button button-secondary" onClick={() => setLogs([])}><Icon name="trash" /> Limpar</button></div><Panel>{logs.length ? <div className="console-list">{logs.map((log) => <details className={`console-entry ${log.ok ? 'success' : 'failure'}`} key={log.id}><summary><span className="http-status">{log.status || 'NET'}</span><strong>{log.label}</strong><code>{log.request?.method} {log.request?.path}</code><span>{log.request?.identity}</span><small>{log.elapsedMs} ms</small></summary><div className="console-body"><div className="console-meta"><span>Correlação: {log.correlationId}</span><span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span></div><pre>{JSON.stringify(log.data, null, 2)}</pre></div></details>)}</div> : <EmptyState icon="terminal" title="Nenhuma chamada registrada" description="As interações com a plataforma aparecerão aqui durante o teste." />}</Panel></div>
  }

  const content = view === 'dashboard' ? renderDashboard() : view === 'case' ? renderCaseWorkspace() : view === 'operations' ? renderOperations() : view === 'observability' ? renderObservability() : renderConsole()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Logo /><div><strong>Intelligent</strong><span>Backoffice Console</span></div></div>
        <nav>{NAV_ITEMS.map((item) => <button className={view === item.id ? 'active' : ''} key={item.id} onClick={() => setView(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'console' && logs.length > 0 && <em>{logs.length}</em>}</button>)}</nav>
        <div className="sidebar-footer"><div className="environment-card"><div className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} /><div><strong>{health?.status === 'ok' ? 'API conectada' : 'API desconectada'}</strong><span>{apiBaseUrl}</span></div></div><a href="https://leandrosflora.github.io/intelligent-backoffice-platform-architecture/" target="_blank" rel="noreferrer">Abrir documentação <Icon name="arrow" size={14} /></a></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><Logo /><strong>Backoffice</strong></div>
          <div className="identity-control">
            <div className="identity-avatar"><Icon name={selectedIdentity.subjectType === 'HUMAN' ? 'user' : 'shield'} /></div>
            <label><span>Identidade ativa</span><select value={identityId} onChange={(event) => setIdentityId(event.target.value)} disabled={guidedMode}>{IDENTITY_OPTIONS.map((identity) => <option value={identity.id} key={identity.id}>{identity.label}</option>)}</select></label>
          </div>
          <label className="toggle"><input type="checkbox" checked={guidedMode} onChange={(event) => setGuidedMode(event.target.checked)} /><span /><div><strong>Modo guiado</strong><small>{guidedMode ? 'Identidade por operação' : 'Testar policy manualmente'}</small></div></label>
          <label className="api-input"><span>API base</span><input value={apiBaseUrl} onChange={(event) => changeApiBaseUrl(event.target.value)} /></label>
        </header>
        <main>{content}</main>
      </div>

      {notice && <div className={`toast toast-${notice.type}`}><Icon name={notice.type === 'error' || notice.type === 'warning' ? 'warning' : 'check'} /><span>{notice.message}</span></div>}
    </div>
  )
}

export default App

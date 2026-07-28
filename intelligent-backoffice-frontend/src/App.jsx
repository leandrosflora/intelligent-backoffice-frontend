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
  nextActionForState,
  normalizeCase,
  normalizeCases,
  parseBrl,
  requiredDocumentType,
  stateTone,
  workflowStepIndex,
} from './lib/workflow.js'

const NAV_ITEMS = [
  ['dashboard', 'Visão geral'],
  ['case', 'Jornada do caso'],
  ['evidence', 'Evidências e execução'],
  ['console', 'Console de API'],
]

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function Badge({ state, children }) {
  return <span className={`badge badge-${stateTone(state)}`}>{children || formatState(state)}</span>
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

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">◇</div>
      <h3>{title}</h3>
      <p>{description}</p>
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
          <div className={`workflow-step ${completed ? 'complete' : ''} ${active ? 'active' : ''}`} key={step.key}>
            <span>{completed ? '✓' : index + 1}</span>
            <strong>{step.label}</strong>
          </div>
        )
      })}
    </div>
  )
}

function JsonBlock({ value }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>
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
  const [createForm, setCreateForm] = useState({
    externalReference: `ui-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 10000)}`,
    disputeType: 'CARD_PURCHASE',
    channel: 'WEB',
    priority: 'NORMAL',
    amount: '120,00',
  })
  const [documentForm, setDocumentForm] = useState({ filename: 'comprovante.pdf' })
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
    setBusy('document')
    try {
      const resource = await invoke('Registrar documento', client.request(
        `/v1/cases/${activeCase.caseId}/documents`,
        requestOptions('registerDocument', {
          method: 'POST',
          headers: { 'If-Match': String(activeCase.caseVersion) },
          body: {
            documentType: requiredDocumentType(activeCase.disputeType),
            mediaType: 'APPLICATION_PDF',
            checksum: 'a'.repeat(64),
            storageReference: `mock://documents/${documentForm.filename}`,
          },
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
        <header className="page-heading">
          <div>
            <span className="eyebrow">Backoffice Platform API</span>
            <h1>Console operacional</h1>
            <p>Frontend React conectado ao serviço .NET, com policies, workflow e persistência PostgreSQL.</p>
          </div>
          <button className="secondary" onClick={checkHealth} disabled={busy === 'health'}>Verificar conexão</button>
        </header>

        <div className="summary-grid">
          <div className="summary-card"><span>Backend</span><strong>{health?.status === 'ok' ? 'Disponível' : 'Indisponível'}</strong></div>
          <div className="summary-card"><span>Endpoint</span><strong>{apiBaseUrl}</strong></div>
          <div className="summary-card"><span>Tenant</span><strong>{tenantId}</strong></div>
          <div className="summary-card"><span>Casos carregados</span><strong>{cases.length}</strong></div>
        </div>

        <div className="two-columns">
          <Panel title="Nova contestação" description="Cria um Case usando o contrato canônico da API.">
            <form className="form-grid" onSubmit={createCase}>
              <label>Referência externa<input value={createForm.externalReference} onChange={(event) => setCreateForm({ ...createForm, externalReference: event.target.value })} /></label>
              <label>Tipo<select value={createForm.disputeType} onChange={(event) => setCreateForm({ ...createForm, disputeType: event.target.value })}><option>CARD_PURCHASE</option><option>PIX</option><option>TRANSFER</option><option>CASH_WITHDRAWAL</option><option>OTHER</option></select></label>
              <label>Canal<select value={createForm.channel} onChange={(event) => setCreateForm({ ...createForm, channel: event.target.value })}><option>WEB</option><option>APP</option><option>CONTACT_CENTER</option><option>BRANCH</option><option>API</option></select></label>
              <label>Prioridade<select value={createForm.priority} onChange={(event) => setCreateForm({ ...createForm, priority: event.target.value })}><option>NORMAL</option><option>LOW</option><option>HIGH</option><option>CRITICAL</option></select></label>
              <label>Valor<input value={createForm.amount} onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} /></label>
              <button className="primary" disabled={busy === 'create'}>{busy === 'create' ? 'Criando…' : 'Criar caso'}</button>
            </form>
          </Panel>

          <Panel title="Conexão" description="Configuração local do proxy e do contexto multi-tenant.">
            <div className="form-grid">
              <label>Base URL<input value={apiBaseUrl} onChange={(event) => updateApi(event.target.value)} /></label>
              <label>Tenant ID<input value={tenantId} onChange={(event) => updateTenant(event.target.value)} /></label>
              <label>Identidade manual<select value={identityId} onChange={(event) => setIdentityId(event.target.value)}>{IDENTITY_OPTIONS.map((identity) => <option key={identity.id} value={identity.id}>{identity.label}</option>)}</select></label>
              <label className="toggle"><input type="checkbox" checked={guidedMode} onChange={(event) => setGuidedMode(event.target.checked)} />Modo guiado por papel</label>
              <p className="hint">{guidedMode ? 'Cada ação usa automaticamente o papel permitido pela policy.' : selectedIdentity.description}</p>
            </div>
          </Panel>
        </div>

        <Panel title="Casos do backend" description="A listagem vem de GET /v1/cases." action={<button className="secondary" onClick={loadCases} disabled={busy === 'cases'}>Atualizar</button>}>
          {cases.length === 0 ? <EmptyState title="Nenhum caso carregado" description="Atualize a lista ou crie uma nova contestação." /> : (
            <div className="case-list">
              {cases.map((item) => (
                <button key={item.caseId} className="case-row" onClick={() => openCase(item.caseId)}>
                  <span><strong>{item.externalReference}</strong><small>{item.caseId}</small></span>
                  <span>{formatMoney(item.disputedAmount)}</span>
                  <Badge state={item.state} />
                </button>
              ))}
            </div>
          )}
          <div className="inline-form"><input placeholder="Abrir por Case ID" value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)} /><button className="secondary" onClick={() => openCase()}>Abrir</button></div>
        </Panel>
      </div>
    )
  }

  function renderActionPanel() {
    if (!activeCase) return null
    if (nextAction === 'registerDocument') {
      return <Panel title="Registrar documento" description={`Para ${activeCase.disputeType}, o tipo sugerido é ${requiredDocumentType(activeCase.disputeType)}.`}><form className="inline-form" onSubmit={registerDocument}><input value={documentForm.filename} onChange={(event) => setDocumentForm({ filename: event.target.value })} /><button className="primary" disabled={busy === 'document'}>Registrar</button></form></Panel>
    }
    if (nextAction === 'investigate') {
      return <Panel title="Executar investigação" description="Usa as evidências validadas e produz findings determinísticos."><button className="primary" onClick={investigate} disabled={busy === 'investigate'}>Investigar</button></Panel>
    }
    if (nextAction === 'recommend') {
      return <Panel title="Criar recomendação" description="A recomendação é gerada pelo backend a partir da investigação e das evidências."><button className="primary" onClick={recommend} disabled={busy === 'recommend'}>Criar recomendação</button></Panel>
    }
    if (nextAction === 'approve') {
      return <Panel title="Aprovação humana" description="A alçada é enviada no header X-Authority-Limit."><form className="form-grid" onSubmit={approve}><label>Alçada<input value={approvalForm.authorityLimit} onChange={(event) => setApprovalForm({ ...approvalForm, authorityLimit: event.target.value })} /></label><label>Justificativa<textarea value={approvalForm.reason} onChange={(event) => setApprovalForm({ ...approvalForm, reason: event.target.value })} /></label><button className="primary" disabled={busy === 'approve'}>Aprovar</button></form></Panel>
    }
    if (nextAction === 'execute') {
      return <Panel title="Execução governada" description="O gateway mock interpreta marcadores no commandHash."><div className="inline-form"><select value={executionMode} onChange={(event) => setExecutionMode(event.target.value)}><option value="SUCCESS">Sucesso</option><option value="AMBIGUOUS">Ambíguo</option><option value="FAILED">Falha</option></select><button className="primary" onClick={execute} disabled={busy === 'execute'}>Executar</button></div></Panel>
    }
    if (nextAction === 'reconcile') {
      return <Panel title="Resolver reconciliação" description="Apenas o papel reconciler pode concluir esta etapa."><form className="form-grid" onSubmit={reconcile}><label>Resolução<select value={reconciliationForm.resolution} onChange={(event) => setReconciliationForm({ ...reconciliationForm, resolution: event.target.value })}><option>CONFIRMED_SUCCEEDED</option><option>CONFIRMED_FAILED</option><option>ESCALATED</option></select></label><label>Justificativa<textarea value={reconciliationForm.reason} onChange={(event) => setReconciliationForm({ ...reconciliationForm, reason: event.target.value })} /></label><button className="primary" disabled={busy === 'reconcile'}>Resolver</button></form></Panel>
    }
    return <Panel title="Jornada sem ação pendente"><p className="hint">O caso está em {formatState(activeCase.state)}.</p></Panel>
  }

  function renderCase() {
    if (!activeCase) return <EmptyState title="Nenhum caso selecionado" description="Abra um caso na visão geral." />
    return (
      <div className="page-stack">
        <header className="page-heading">
          <div><span className="eyebrow">{activeCase.externalReference}</span><h1>Jornada do caso</h1><p>{activeCase.caseId}</p></div>
          <div className="heading-actions"><Badge state={activeCase.state} /><button className="secondary" onClick={() => openCase(activeCase.caseId)}>Atualizar</button></div>
        </header>
        <WorkflowRail state={activeCase.state} />
        <div className="summary-grid">
          <div className="summary-card"><span>Versão</span><strong>{activeCase.caseVersion}</strong></div>
          <div className="summary-card"><span>Valor</span><strong>{formatMoney(activeCase.disputedAmount)}</strong></div>
          <div className="summary-card"><span>Tipo</span><strong>{activeCase.disputeType}</strong></div>
          <div className="summary-card"><span>Prioridade</span><strong>{activeCase.priority}</strong></div>
        </div>
        {renderActionPanel()}
        <Panel title="Recursos da jornada" description="IDs retornados por cada endpoint e necessários para as etapas seguintes.">
          <div className="resource-grid">
            {['document', 'investigation', 'recommendation', 'approval', 'execution'].map((key) => <div key={key}><span>{key}</span><strong>{activeResources[key]?.[`${key}Id`] || '—'}</strong></div>)}
          </div>
        </Panel>
        {!['EXECUTED', 'CLOSED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(activeCase.state) && <button className="danger-link" onClick={cancelCase} disabled={busy === 'cancel'}>Cancelar caso</button>}
      </div>
    )
  }

  function renderEvidence() {
    if (!activeCase) return <EmptyState title="Nenhum caso selecionado" description="Abra um caso para consultar evidências e execuções." />
    return (
      <div className="page-stack">
        <header className="page-heading"><div><span className="eyebrow">Dados do caso</span><h1>Evidências e execução</h1><p>Consultas reais do backend para o caso ativo.</p></div><button className="secondary" onClick={() => loadCaseData()}>Atualizar</button></header>
        <div className="two-columns">
          <Panel title={`Evidências (${evidence.length})`}>{evidence.length ? evidence.map((item) => <details key={item.evidenceId}><summary>{item.evidenceType} · {item.sourceType}</summary><JsonBlock value={item} /></details>) : <EmptyState title="Sem evidências" description="Registre um documento validado." />}</Panel>
          <Panel title={`Execuções (${executions.length})`}>{executions.length ? executions.map((item) => <details key={item.executionId}><summary>{item.status} · {item.executionId}</summary><JsonBlock value={item} /></details>) : <EmptyState title="Sem execuções" description="A execução é criada após uma aprovação válida." />}</Panel>
        </div>
        <Panel title={`Timeline (${timeline.length})`}>{timeline.length ? <div className="timeline">{timeline.map((item, index) => <div className="timeline-item" key={item.entryId || index}><span>{index + 1}</span><div><strong>{item.type || item.eventType}</strong><p>{item.reason || item.origin || 'Evento auditável'}</p><small>{item.occurredAt}</small></div></div>)}</div> : <EmptyState title="Timeline vazia" description="Atualize os dados do caso." />}</Panel>
      </div>
    )
  }

  function renderConsole() {
    return (
      <div className="page-stack">
        <header className="page-heading"><div><span className="eyebrow">Diagnóstico</span><h1>Console de API</h1><p>Requisições, identidades, correlações e respostas.</p></div><button className="secondary" onClick={() => setLogs([])}>Limpar</button></header>
        <Panel>{logs.length ? <div className="log-list">{logs.map((log) => <details key={log.id}><summary><span className={log.ok ? 'status-ok' : 'status-error'}>{log.status || 'ERR'}</span><strong>{log.label}</strong><small>{log.elapsedMs} ms · {log.request?.identity}</small></summary><p className="correlation">Correlation: {log.correlationId}</p><JsonBlock value={log.data} /></details>)}</div> : <EmptyState title="Sem chamadas" description="Interaja com o console para registrar requisições." />}</Panel>
      </div>
    )
  }

  const content = view === 'dashboard' ? renderDashboard() : view === 'case' ? renderCase() : view === 'evidence' ? renderEvidence() : renderConsole()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">IB</div><div><strong>Intelligent</strong><span>Backoffice Console</span></div></div>
        <nav>{NAV_ITEMS.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</nav>
        <div className="sidebar-status"><span className={health?.status === 'ok' ? 'dot online' : 'dot'} /><div><strong>{health?.status === 'ok' ? 'API conectada' : 'API indisponível'}</strong><small>backoffice-platform-api</small></div></div>
      </aside>
      <main>{notice && <div className={`notice notice-${notice.type}`}>{notice.message}</div>}{content}</main>
    </div>
  )
}

export default App

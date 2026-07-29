import { useMemo, useState } from 'react'
import './DocumentValidation.css'

import { PlatformClient } from './api/client.js'
import { IDENTITIES } from './config/identities.js'
import {
  DOCUMENT_ACCEPT,
  buildDocumentFormData,
  documentAiOutcome,
  findDocumentEvidence,
  validateDocumentFile,
} from './lib/documentUpload.js'
import { apiErrorMessage } from './lib/workflow.js'

const DOCUMENT_TYPES = [
  ['RECEIPT', 'Recibo ou comprovante de compra'],
  ['STATEMENT', 'Extrato bancário'],
  ['TRANSACTION_PROOF', 'Comprovante de transação'],
  ['IDENTITY_PROOF', 'Documento de identidade'],
  ['OTHER', 'Outro documento'],
]

function JsonResult({ value }) {
  if (!value) return null
  return <pre className="validator-json">{JSON.stringify(value, null, 2)}</pre>
}

function ResultCard({ label, value, detail }) {
  return (
    <div className="validator-result-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export default function DocumentValidation({ auth }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('backoffice-ui-api') || '/api')
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('backoffice-ui-tenant') || 'tenant-demo')
  const [caseId, setCaseId] = useState(() => localStorage.getItem('backoffice-ai-case-id') || '')
  const [caseVersion, setCaseVersion] = useState('1')
  const [documentType, setDocumentType] = useState('RECEIPT')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [documentResult, setDocumentResult] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [caseSnapshot, setCaseSnapshot] = useState(null)
  const [requestMeta, setRequestMeta] = useState(null)

  const isOidc = auth.mode === 'oidc'
  const effectiveTenantId = isOidc ? auth.claims.tenantId : tenantId
  const client = useMemo(() => new PlatformClient(apiBaseUrl, {
    authMode: auth.mode,
    getAccessToken: auth.getAccessToken,
    identityLabel: auth.claims.displayName,
  }), [apiBaseUrl, auth.claims.displayName, auth.getAccessToken, auth.mode])
  const validation = useMemo(() => validateDocumentFile(file), [file])
  const matchedEvidence = useMemo(
    () => findDocumentEvidence(evidence, documentResult?.documentId),
    [documentResult, evidence],
  )
  const aiOutcome = useMemo(
    () => documentAiOutcome(documentResult, matchedEvidence),
    [documentResult, matchedEvidence],
  )

  function updateApiBaseUrl(value) {
    setApiBaseUrl(value)
    localStorage.setItem('backoffice-ui-api', value)
  }

  function updateTenantId(value) {
    setTenantId(value)
    localStorage.setItem('backoffice-ui-tenant', value)
  }

  function updateCaseId(value) {
    setCaseId(value)
    localStorage.setItem('backoffice-ai-case-id', value)
  }

  async function uploadDocument(event) {
    event.preventDefault()
    setError('')
    setDocumentResult(null)
    setEvidence([])
    setCaseSnapshot(null)
    setRequestMeta(null)

    const version = Number(caseVersion)
    if (!caseId.trim()) {
      setError('Informe o Case ID criado no backend.')
      return
    }
    if (!Number.isInteger(version) || version < 1) {
      setError('Informe uma versão válida do caso.')
      return
    }
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setBusy(true)
    try {
      const formData = buildDocumentFormData(file, documentType)
      const upload = await client.request(`/v1/cases/${caseId.trim()}/documents`, {
        method: 'POST',
        tenantId: effectiveTenantId,
        identity: IDENTITIES.documentProcessor,
        headers: { 'If-Match': String(version) },
        body: formData,
      })

      setRequestMeta({
        status: upload.status,
        elapsedMs: upload.elapsedMs,
        correlationId: upload.correlationId,
      })

      if (!upload.ok) throw new Error(apiErrorMessage(upload.data, upload.status))
      setDocumentResult(upload.data)

      const [evidenceResponse, caseResponse] = await Promise.all([
        client.request(`/v1/cases/${caseId.trim()}/evidence`, {
          tenantId: effectiveTenantId,
          identity: IDENTITIES.analyst,
        }),
        client.request(`/v1/cases/${caseId.trim()}`, {
          tenantId: effectiveTenantId,
          identity: IDENTITIES.caseManager,
        }),
      ])

      if (evidenceResponse.ok) {
        setEvidence(Array.isArray(evidenceResponse.data) ? evidenceResponse.data : [])
      }
      if (caseResponse.ok) {
        setCaseSnapshot(caseResponse.data)
        if (caseResponse.data?.caseVersion) setCaseVersion(String(caseResponse.data.caseVersion))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao enviar o documento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="validator-page">
      <header className="validator-header">
        <div>
          <a href="#/" className="validator-back">← Voltar ao console operacional</a>
          <span className="validator-kicker">Document Intelligence</span>
          <h1>Validação documental com IA</h1>
          <p>Envie um arquivo real para o backend .NET e acompanhe se a IA confirmou o tipo ou encaminhou o documento para revisão humana.</p>
        </div>
        <div className="validator-header-status">
          <span>{isOidc ? 'Sessão OIDC' : 'Fluxo real'}</span>
          <strong>{isOidc ? auth.claims.displayName : 'multipart/form-data'}</strong>
          <small>{isOidc ? effectiveTenantId || 'tenant_id ausente' : 'PDF · PNG · JPG · DOCX · XLSX'}</small>
        </div>
      </header>

      <section className="validator-flow" aria-label="Etapas da validação">
        <div><span>1</span><strong>Upload seguro</strong><small>Arquivo, tipo esperado e versão do caso.</small></div>
        <div><span>2</span><strong>Análise IA/OCR</strong><small>Classificação, extração e abstention guardrail.</small></div>
        <div><span>3</span><strong>Evidência ou revisão</strong><small>Confirmação gera evidência; incerteza exige decisão humana.</small></div>
      </section>

      <div className="validator-layout">
        <form className="validator-panel validator-form" onSubmit={uploadDocument}>
          <header>
            <div>
              <span className="validator-section-label">Configuração</span>
              <h2>Enviar documento</h2>
              <p>Use um caso existente em estado compatível com o registro documental.</p>
            </div>
            <code>POST /v1/cases/:caseId/documents</code>
          </header>

          <div className="validator-grid">
            <label className="validator-span-2">Base URL da API
              <input value={apiBaseUrl} onChange={(event) => updateApiBaseUrl(event.target.value)} />
            </label>
            <label>Tenant ID
              <input
                value={isOidc ? effectiveTenantId || 'claim tenant_id ausente' : tenantId}
                disabled={isOidc}
                onChange={(event) => updateTenantId(event.target.value)}
              />
            </label>
            <label>Versão do caso
              <input type="number" min="1" value={caseVersion} onChange={(event) => setCaseVersion(event.target.value)} />
            </label>
            <label className="validator-span-2">Case ID
              <input placeholder="00000000-0000-0000-0000-000000000000" value={caseId} onChange={(event) => updateCaseId(event.target.value)} />
            </label>
            <label className="validator-span-2">Tipo documental esperado
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                {DOCUMENT_TYPES.map(([value, label]) => <option value={value} key={value}>{value} — {label}</option>)}
              </select>
            </label>
          </div>

          <label className={`validator-dropzone ${file ? 'has-file' : ''} ${file && !validation.valid ? 'invalid' : ''}`}>
            <input type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <span className="validator-file-icon">DOC</span>
            <strong>{file ? file.name : 'Selecione o documento'}</strong>
            <small>{file ? (validation.valid ? `${validation.sizeLabel} · ${validation.mediaType}` : validation.error) : 'Clique para escolher PDF, imagem, DOCX ou XLSX.'}</small>
          </label>

          <div className="validator-policy-note">
            <strong>O que será validado</strong>
            <p>Verificação de segurança configurada no backend, checksum SHA-256, classificação independente do tipo declarado e evidência apenas quando a IA confirma o tipo. Abstention ou divergência exige revisão humana.</p>
            {isOidc && <p>A API usará exclusivamente o bearer token atual. Se a policy exigir outro tipo de sujeito ou papel, a operação será negada sem simular uma identidade no navegador.</p>}
          </div>

          {error && <div className="validator-alert validator-alert-danger">{error}</div>}

          <button className="validator-submit" disabled={busy || !validation.valid || !caseId.trim()}>
            {busy ? 'Processando documento…' : 'Enviar para validação da IA'}
          </button>
        </form>

        <section className="validator-panel validator-results">
          <header>
            <div>
              <span className="validator-section-label">Resultado</span>
              <h2>Análise e evidência</h2>
              <p>O resultado combina a resposta do documento com a evidência persistida.</p>
            </div>
          </header>

          {!documentResult && !error && (
            <div className="validator-empty">
              <span>AI</span>
              <strong>Nenhum documento processado</strong>
              <p>Configure o caso, selecione um arquivo e execute a validação.</p>
            </div>
          )}

          {documentResult && (
            <>
              <div className={`validator-outcome validator-outcome-${aiOutcome?.tone || 'warning'}`}>
                <span>{aiOutcome?.tone === 'success' ? '✓' : aiOutcome?.tone === 'danger' ? '×' : '!'}</span>
                <div><strong>{aiOutcome?.label}</strong><p>{aiOutcome?.detail}</p></div>
              </div>

              <div className="validator-result-grid">
                <ResultCard label="Status documental" value={documentResult.status} detail={documentResult.documentType} />
                <ResultCard label="Confiança da IA" value={matchedEvidence ? `${(Number(matchedEvidence.confidence) * 100).toFixed(0)}%` : 'Sem evidência'} detail={matchedEvidence?.evidenceType || aiOutcome?.label} />
                <ResultCard label="Versão atual do caso" value={caseSnapshot?.caseVersion ? `v${caseSnapshot.caseVersion}` : '—'} detail={caseSnapshot?.state || 'Caso não consultado'} />
                <ResultCard label="Latência do upload" value={requestMeta ? `${requestMeta.elapsedMs} ms` : '—'} detail={`HTTP ${requestMeta?.status || '—'}`} />
              </div>

              <dl className="validator-details">
                <div><dt>Document ID</dt><dd>{documentResult.documentId}</dd></div>
                <div><dt>Checksum</dt><dd>{documentResult.checksum}</dd></div>
                <div><dt>Correlation ID</dt><dd>{requestMeta?.correlationId || '—'}</dd></div>
                <div><dt>Storage reference</dt><dd>{documentResult.storageReference}</dd></div>
              </dl>

              <details className="validator-raw">
                <summary>Ver respostas técnicas</summary>
                <h3>Documento</h3>
                <JsonResult value={documentResult} />
                <h3>Evidência vinculada</h3>
                <JsonResult value={matchedEvidence || { detail: 'Nenhuma evidência criada para este documento.' }} />
                <h3>Caso atualizado</h3>
                <JsonResult value={caseSnapshot} />
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

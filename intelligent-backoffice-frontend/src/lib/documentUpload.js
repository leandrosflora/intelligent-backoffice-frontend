const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

const MEDIA_TYPE_BY_EXTENSION = {
  pdf: 'APPLICATION_PDF',
  png: 'IMAGE_PNG',
  jpg: 'IMAGE_JPEG',
  jpeg: 'IMAGE_JPEG',
  docx: 'APPLICATION_DOCX',
  xlsx: 'APPLICATION_XLSX',
}

export const DOCUMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx'

export function formatFileSize(size) {
  const bytes = Number(size || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function mediaTypeForDocument(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  return MEDIA_TYPE_BY_EXTENSION[extension] || null
}

export function validateDocumentFile(file) {
  if (!file) {
    return { valid: false, error: 'Selecione um arquivo para análise.' }
  }

  const mediaType = mediaTypeForDocument(file.name)
  if (!mediaType) {
    return {
      valid: false,
      error: 'Formato não suportado. Use PDF, PNG, JPG, DOCX ou XLSX.',
    }
  }

  if (!Number(file.size)) {
    return { valid: false, error: 'O arquivo está vazio.' }
  }

  if (Number(file.size) > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `O arquivo excede o limite de ${formatFileSize(MAX_DOCUMENT_SIZE_BYTES)}.`,
    }
  }

  return {
    valid: true,
    error: null,
    mediaType,
    fileName: file.name,
    size: Number(file.size),
    sizeLabel: formatFileSize(file.size),
  }
}

export function buildDocumentFormData(file, documentType) {
  const validation = validateDocumentFile(file)
  if (!validation.valid) throw new Error(validation.error)
  if (!documentType) throw new Error('Informe o tipo documental esperado.')

  const formData = new FormData()
  formData.append('documentType', documentType)
  formData.append('mediaType', validation.mediaType)
  formData.append('file', file)
  return formData
}

export function findDocumentEvidence(evidence, documentId) {
  if (!documentId || !Array.isArray(evidence)) return null
  return evidence.find((item) => String(item.sourceReference) === String(documentId)) || null
}

export function documentRegistrationNotice(document) {
  if (document?.status === 'VALIDATED') {
    return {
      type: 'success',
      message: 'Documento confirmado pela IA e evidência criada.',
    }
  }
  if (document?.status === 'REVIEW_REQUIRED') {
    return {
      type: 'warning',
      message: 'Documento recebido, mas a IA não confirmou o tipo. Revisão humana necessária; o caso não avançou.',
    }
  }
  if (document?.status === 'REJECTED') {
    const reason = document.rejectionReasons?.join('; ')
    return {
      type: 'error',
      message: reason ? `Documento rejeitado: ${reason}` : 'Documento rejeitado antes da análise de IA.',
    }
  }
  return {
    type: 'warning',
    message: `Documento registrado com status ${document?.status || 'desconhecido'}. Atualize o caso antes de continuar.`,
  }
}

export function documentAiOutcome(document, evidence) {
  if (!document) return null
  if (document.status === 'REJECTED') {
    return {
      tone: 'danger',
      label: 'Documento rejeitado',
      detail: document.rejectionReasons?.join('; ') || 'O arquivo foi rejeitado antes da análise de IA.',
    }
  }
  if (document.status === 'REVIEW_REQUIRED') {
    return {
      tone: 'warning',
      label: 'Revisão humana necessária',
      detail: 'A IA se absteve ou classificou um tipo diferente. O documento não valida o caso até ser revisado.',
    }
  }
  if (document.status === 'VALIDATED' && evidence) {
    return {
      tone: 'success',
      label: 'Classificação confirmada pela IA',
      detail: `Evidência criada com ${(Number(evidence.confidence || 0) * 100).toFixed(0)}% de confiança.`,
    }
  }
  if (document.status === 'VALIDATED') {
    return {
      tone: 'warning',
      label: 'Validação sem evidência vinculada',
      detail: 'O backend marcou o documento como validado, mas nenhuma evidência correspondente foi encontrada. Atualize os dados e investigue a inconsistência.',
    }
  }
  return {
    tone: 'warning',
    label: 'Processamento documental pendente',
    detail: `O documento está em ${document.status || 'estado desconhecido'} e ainda não pode validar o caso.`,
  }
}

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

export function documentAiOutcome(document, evidence) {
  if (!document) return null
  if (document.status === 'REJECTED') {
    return {
      tone: 'danger',
      label: 'Documento rejeitado',
      detail: document.rejectionReasons?.join('; ') || 'O arquivo foi rejeitado antes da análise de IA.',
    }
  }
  if (evidence) {
    return {
      tone: 'success',
      label: 'Classificação confirmada pela IA',
      detail: `Evidência criada com ${(Number(evidence.confidence || 0) * 100).toFixed(0)}% de confiança.`,
    }
  }
  return {
    tone: 'warning',
    label: 'IA não confirmou o tipo declarado',
    detail: 'O documento foi processado, mas não houve evidência. A IA pode ter abstido, classificado outro tipo ou estar indisponível.',
  }
}

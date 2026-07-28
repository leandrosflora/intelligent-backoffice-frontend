# Intelligent Backoffice Console

Frontend React para executar e inspecionar o backend [.NET Backoffice Platform API](https://github.com/leandrosflora/backoffice-platform-api).

A aplicação não simula o lifecycle no navegador. Cada transição é enviada ao backend e validada por estado, versão, tenant, identidade, papel, policy, alçada e idempotência.

## Funcionalidades

- criação, listagem e consulta de casos;
- jornada guiada pelo estado retornado pela API;
- upload real de PDF, PNG, JPG, DOCX e XLSX;
- workspace dedicado de validação documental com IA/OCR;
- consulta da evidência vinculada ao documento e da confiança da IA;
- investigação e recomendação;
- aprovação humana com alçada em `X-Authority-Limit`;
- execução mock com sucesso, falha ou resultado ambíguo;
- reconciliação autorizada;
- consulta de execuções e timeline;
- console local de requisições, identidades, latência, correlation ID e Problem Details;
- modo manual para testar negações de policy.

## Arquitetura do frontend

```text
src/
├── api/client.js                 # fetch, headers de identidade e FormData
├── config/identities.js          # identidades e papéis por operação
├── lib/documentUpload.js         # validação de arquivo e interpretação da IA
├── lib/workflow.js               # lifecycle, normalização e formatação
├── App.jsx                       # console operacional e jornada guiada
├── DocumentValidation.jsx        # workspace dedicado de IA documental
├── Root.jsx                      # roteamento por hash e acesso ao workspace
└── main.jsx
```

## Pré-requisito: backend com Document Intelligence

Mantenha o backend e a arquitetura como diretórios irmãos. No repositório `backoffice-platform-api`:

```bash
export OPENAI_API_KEY="sua-chave"
docker compose --profile runtime up -d --build
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sua-chave"
docker compose --profile runtime up -d --build
```

A configuração Docker padrão utiliza:

| Dependência | Endereço |
|---|---|
| API HTTP | `http://localhost:8080` |
| Document Intelligence | `http://localhost:8090` |
| PostgreSQL | `localhost:5432` |
| OPA/PDP | `http://localhost:8181` |

## Desenvolvimento local

```bash
npm ci
VITE_API_PROXY_TARGET=http://localhost:8080 npm run dev
```

Abra:

- `http://localhost:5173` para o console operacional;
- `http://localhost:5173/#/document-validation` para o workspace de IA documental.

O botão flutuante **Validar documento** também abre o workspace dedicado.

## Docker

A partir da raiz do repositório:

```bash
BACKEND_URL=http://host.docker.internal:8080 docker compose up -d --build
```

Abra:

- `http://localhost:3000` para o console;
- `http://localhost:3000/#/document-validation` para validação documental.

## Upload documental

O navegador envia o arquivo real como `multipart/form-data`:

```text
documentType = RECEIPT
mediaType    = APPLICATION_PDF
file         = <conteúdo binário>
```

Headers relevantes:

```text
If-Match: <caseVersion>
X-Tenant-Id: <tenant>
X-Subject-Id: document-processor-1
X-Subject-Type: WORKLOAD
X-Roles: document-processor
```

O frontend não calcula checksum nem cria `storageReference`. Esses valores são produzidos pelo backend depois que o arquivo é recebido.

### Formatos

| Extensão | Valor enviado em `mediaType` |
|---|---|
| `.pdf` | `APPLICATION_PDF` |
| `.png` | `IMAGE_PNG` |
| `.jpg`, `.jpeg` | `IMAGE_JPEG` |
| `.docx` | `APPLICATION_DOCX` |
| `.xlsx` | `APPLICATION_XLSX` |

O workspace bloqueia arquivo vazio, formato não suportado e arquivos acima de 10 MB.

## Interpretação do resultado da IA

Depois do upload, o frontend consulta:

```text
GET /v1/cases/{caseId}
GET /v1/cases/{caseId}/evidence
```

A evidência cujo `sourceReference` corresponde ao `documentId` indica que a IA:

1. classificou o documento sem abstention;
2. encontrou o mesmo tipo declarado no upload;
3. atingiu o confidence floor configurado no serviço.

Resultados exibidos:

- **Classificação confirmada pela IA:** há evidência e confiança;
- **IA não confirmou o tipo declarado:** documento validado sem evidência;
- **Documento rejeitado:** falha anterior à confirmação da IA, como malware scan.

O backend atual não devolve `extractedFields` no `DocumentResponse`; por isso o frontend exibe a evidência persistida e a resposta técnica disponível.

## Modos de identidade

### Guiado

Seleciona automaticamente a identidade esperada para cada operação:

- `case-manager` para casos;
- `document-processor` para documentos;
- `operations-analyst` para investigação e evidências;
- `decision-agent` para recomendação;
- `approver` para aprovação;
- `execution-service` para execução;
- `reconciler` para reconciliação;
- `auditor` para timeline e consulta de execuções.

### Manual

Mantém a identidade selecionada em todas as chamadas. Esse modo permite validar `403 Forbidden`, segregação de funções e least privilege.

## Continuidade da jornada

O backend expõe listagem de casos, evidências, execuções e timeline. Recomendações e aprovações ainda não possuem endpoints de consulta; os recursos intermediários retornados durante a jornada são mantidos no `localStorage` por `caseId`.

## Qualidade

```bash
npm run check
```

O comando executa:

```text
ESLint → testes Node → build Vite
```

Os testes de upload cobrem formatos, tamanho, arquivo vazio, vínculo da evidência e interpretação de confirmação, abstention e rejeição.

## Limitações declaradas

- identidade baseada em headers da baseline;
- sem login JWT no frontend;
- análise real dependente da OpenAI e sujeita a custo;
- execução financeira mock;
- campos extraídos pela IA ainda não expostos pela API principal;
- solução de validação, não classificada como produção.

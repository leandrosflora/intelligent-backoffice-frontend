# Intelligent Backoffice Frontend

[![Frontend CI](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml)

Console React para operar e validar o backend [.NET Backoffice Platform API](https://github.com/leandrosflora/backoffice-platform-api), incluindo upload real de documentos e validação por IA/OCR. A arquitetura e os contratos de referência estão em [Intelligent Backoffice Platform Architecture](https://github.com/leandrosflora/intelligent-backoffice-platform-architecture).

## Capacidades

- criação, listagem e consulta de casos;
- jornada guiada pelo estado retornado pela API;
- upload `multipart/form-data` de PDF, PNG, JPG, DOCX e XLSX;
- classificação documental com IA, abstention e evidência com confiança;
- investigação, recomendação e aprovação humana;
- execução governada, idempotência e reconciliação;
- evidências, execuções, timeline e console HTTP;
- modo guiado ou identidade manual para testar policies.

## Validação documental com IA

Há duas formas de executar o upload:

1. **Jornada do caso:** o próximo passo do workflow apresenta o seletor de arquivo automaticamente.
2. **Workspace dedicado:** acesse `http://localhost:5173/#/document-validation` em desenvolvimento ou `http://localhost:3000/#/document-validation` em Docker.

O workspace dedicado:

- valida extensão, arquivo vazio e limite de 10 MB;
- envia `documentType`, `mediaType` e o arquivo real;
- adiciona `If-Match` com a versão informada do caso;
- consulta o caso depois do processamento;
- procura a evidência vinculada ao `documentId`;
- diferencia confirmação da IA, abstention/divergência e rejeição;
- mostra confiança, checksum, correlation ID, latência e respostas técnicas.

A evidência só é criada quando a IA não abstém e a classificação encontrada corresponde ao tipo documental declarado. Um documento pode ficar `VALIDATED` sem gerar evidência quando o modelo abstém, identifica outro tipo ou o serviço de análise fica indisponível.

## Pré-requisitos

- Node.js 22 ou superior;
- npm;
- Docker, para execução containerizada;
- backend `backoffice-platform-api`;
- repositório `intelligent-backoffice-platform-architecture` como diretório irmão do backend;
- `OPENAI_API_KEY` para o serviço de inteligência documental real.

Estrutura recomendada:

```text
workspace/
├── backoffice-platform-api/
├── intelligent-backoffice-platform-architecture/
└── intelligent-backoffice-frontend/
```

## Executar a stack

### Backend em Docker

No repositório `backoffice-platform-api`:

```bash
export OPENAI_API_KEY="sua-chave"
docker compose --profile runtime up -d --build
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sua-chave"
docker compose --profile runtime up -d --build
```

Serviços principais:

| Serviço | URL padrão |
|---|---|
| API .NET | `http://localhost:8080` |
| Document Intelligence | `http://localhost:8090` |
| OPA | `http://localhost:8181` |
| PostgreSQL | `localhost:5432` |

### Frontend em desenvolvimento

```bash
cd intelligent-backoffice-frontend
npm ci
VITE_API_PROXY_TARGET=http://localhost:8080 npm run dev
```

Abra:

- console operacional: `http://localhost:5173`;
- validação documental: `http://localhost:5173/#/document-validation`.

### Frontend em Docker

Na raiz deste repositório:

```bash
BACKEND_URL=http://host.docker.internal:8080 docker compose up -d --build
```

Abra:

- console operacional: `http://localhost:3000`;
- validação documental: `http://localhost:3000/#/document-validation`.

Para alterar a porta:

```bash
BACKEND_URL=http://host.docker.internal:8080 FRONTEND_PORT=3001 docker compose up -d --build
```

## Como validar a IA

1. Crie um caso no console operacional.
2. Copie o `Case ID` e confirme a versão atual.
3. Abra o workspace **Validar documento**.
4. Selecione o tipo esperado e um arquivo compatível.
5. Envie o documento.
6. Verifique o resultado:
   - **Classificação confirmada:** evidência criada com confiança;
   - **IA não confirmou:** documento processado sem evidência;
   - **Documento rejeitado:** malware scan ou validação anterior à IA falhou.

Tipos esperados por jornada:

| Disputa | Documento esperado |
|---|---|
| `CARD_PURCHASE` | `RECEIPT` |
| `PIX` | `TRANSACTION_PROOF` |
| `TRANSFER` | `TRANSACTION_PROOF` |
| `CASH_WITHDRAWAL` | `TRANSACTION_PROOF` |
| `OTHER` | `OTHER` |

## Contrato de upload

```http
POST /v1/cases/{caseId}/documents
Content-Type: multipart/form-data
If-Match: {caseVersion}
X-Tenant-Id: tenant-demo
X-Subject-Id: document-processor-1
X-Subject-Type: WORKLOAD
X-Roles: document-processor
```

Campos do formulário:

| Campo | Exemplo |
|---|---|
| `documentType` | `RECEIPT` |
| `mediaType` | `APPLICATION_PDF` |
| `file` | arquivo binário |

O checksum SHA-256 e o `storageReference` são gerados no backend; o navegador não envia valores sintéticos.

## Qualidade

```bash
cd intelligent-backoffice-frontend
npm run check
```

O comando executa ESLint, testes Node e build Vite. Os testes cobrem mapeamento de formatos, tamanho, extensão, vínculo da evidência e interpretação do resultado da IA.

## Limitações

- o frontend usa as identidades por headers da baseline; o profile JWT ainda não possui login no navegador;
- a análise real consome a API da OpenAI e pode gerar custo;
- os campos extraídos pela IA ainda não são retornados no `DocumentResponse`; a UI confirma a análise pela evidência persistida;
- recomendações e aprovações intermediárias continuam no `localStorage`, pois o backend não expõe consulta desses recursos;
- a execução financeira permanece mock;
- solução demonstrativa, não classificada como pronta para produção.

Consulte também a [documentação interna do projeto React](intelligent-backoffice-frontend/README.md).

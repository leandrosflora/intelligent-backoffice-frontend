# Intelligent Backoffice Frontend

[![Frontend CI](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml)

Console React para operar e validar o backend [.NET Backoffice Platform API](https://github.com/leandrosflora/backoffice-platform-api), incluindo upload real de documentos e validação por IA/OCR. A arquitetura e os contratos de referência estão em [Intelligent Backoffice Platform Architecture](https://github.com/leandrosflora/intelligent-backoffice-platform-architecture).

## Capacidades

- criação, listagem e consulta de casos;
- jornada guiada pelo estado retornado pela API;
- upload `multipart/form-data` de PDF, PNG, JPG, DOCX e XLSX;
- classificação documental com IA, abstention e evidência com confiança;
- investigação, recomendação e aprovação humana;
- reidratação de recomendações e aprovações persistidas pelo backend;
- execução governada, idempotência e reconciliação;
- evidências, execuções, timeline e console HTTP;
- login OIDC por Authorization Code + PKCE, com bearer token em sessão;
- modo guiado ou identidade manual por headers para testes locais de policy.

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

A evidência só é criada quando a IA não abstém e a classificação encontrada corresponde ao tipo documental declarado. Em caso de abstention ou divergência, o documento fica em `REVIEW_REQUIRED`, sem evidência, e o caso permanece em `DOCUMENTS_RECEIVED` para revisão manual.

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

O modo padrão é `headers`, compatível com a baseline e com o E2E. Para usar OIDC:

```bash
VITE_AUTH_MODE=oidc \
VITE_OIDC_AUTHORITY=https://identity.example.com/realms/backoffice \
VITE_OIDC_CLIENT_ID=intelligent-backoffice-spa \
VITE_OIDC_SCOPE="openid profile roles" \
VITE_OIDC_AUDIENCE=backoffice-api \
npm run dev
```

Registre `http://localhost:5173/auth/callback` como redirect URI e
`http://localhost:5173/` como post-logout URI. A SPA é cliente público: não
configure client secret.

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

No container, OIDC é configuração de runtime e não exige reconstruir a imagem:

```bash
BACKEND_URL=http://host.docker.internal:8080 \
AUTH_MODE=oidc \
OIDC_AUTHORITY=https://identity.example.com/realms/backoffice \
OIDC_CLIENT_ID=intelligent-backoffice-spa \
OIDC_SCOPE="openid profile roles" \
OIDC_AUDIENCE=backoffice-api \
docker compose up -d
```

Nesse caso, registre `http://localhost:3000/auth/callback` e
`http://localhost:3000/` no provedor.

## Modos de autenticação

| Modo | Uso | Identidade enviada |
|---|---|---|
| `headers` | desenvolvimento e E2E controlado | `X-Tenant-Id`, `X-Subject-*`, `X-Roles` e, na aprovação, `X-Authority-Limit` |
| `oidc` | integração real com IdP | apenas `Authorization: Bearer <access_token>` |

O fluxo OIDC usa Authorization Code + PKCE. Usuário, estado de protocolo e
tokens ficam em `sessionStorage`; fechar a aba encerra o contexto local.
Redirects de retorno externos são rejeitados.

No modo OIDC, tenant, sujeito, tipo, papéis, propósito e alçada são claims do
token validado pelo backend. A UI não permite trocar esses valores e remove
headers de identidade mesmo se um componente tentar fornecê-los. Uma sessão
representa um único principal; etapas que exigem outro papel ou um workload
devem receber outro token e podem retornar `403` na sessão atual.

## Como validar a IA

1. Crie um caso no console operacional.
2. Copie o `Case ID` e confirme a versão atual.
3. Abra o workspace **Validar documento**.
4. Selecione o tipo esperado e um arquivo compatível.
5. Envie o documento.
6. Verifique o resultado:
   - **Classificação confirmada:** evidência criada com confiança;
   - **IA não confirmou:** documento encaminhado para revisão manual, sem evidência;
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

Esses headers pertencem apenas ao modo local `headers`. No modo OIDC, a
requisição contém o bearer token e o backend deriva o contexto das claims.

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

### E2E cross-repo

Com os três repositórios no mesmo diretório pai, o Compose de E2E sobe PostgreSQL,
OPA, a API .NET e o frontend Nginx:

```bash
docker compose -f e2e/docker-compose.yml up -d --build --wait
cd intelligent-backoffice-frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

O teste Playwright cria um caso pela interface real, atravessa o proxy Nginx,
executa a policy no OPA e persiste o caso no PostgreSQL. O workflow
`Cross-repository E2E` executa essa jornada em cada pull request.

Para encerrar:

```bash
docker compose -f e2e/docker-compose.yml down --volumes --remove-orphans
```

## Limitações

- o IdP e o backend precisam emitir/validar as claims de domínio (`tenant_id`,
  `subject_type`, `roles`, `purpose` e `authority_limit` quando aplicável);
- uma sessão OIDC humana não simula workloads exigidos por algumas etapas;
- a análise real consome a API da OpenAI e pode gerar custo;
- os campos extraídos pela IA ainda não são retornados no `DocumentResponse`; a UI confirma a análise pela evidência persistida;
- a execução financeira permanece mock;
- solução demonstrativa, não classificada como pronta para produção.

Consulte também a [documentação interna do projeto React](intelligent-backoffice-frontend/README.md).

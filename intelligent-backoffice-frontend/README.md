# Intelligent Backoffice Console

Frontend React para executar e inspecionar o backend [.NET Backoffice Platform API](https://github.com/leandrosflora/backoffice-platform-api).

A aplicação não simula o lifecycle no navegador. Cada transição é enviada ao backend e validada por estado, versão, tenant, identidade, papel, policy, alçada e idempotência.

## Funcionalidades

- criação, listagem e consulta de casos;
- jornada guiada pelo estado retornado pela API;
- registro de documento sintético;
- consulta de evidências;
- investigação e recomendação;
- aprovação humana com alçada em `X-Authority-Limit`;
- execução mock com sucesso, falha ou resultado ambíguo;
- reconciliação autorizada;
- consulta de execuções e timeline;
- console local de requisições, identidades, latência, correlation ID e Problem Details;
- modo manual para testar negações de policy.

## Pré-requisito: subir o backend

No repositório `backoffice-platform-api`:

```bash
docker compose --profile runtime up -d postgres

dotnet run --project src/Backoffice.Api
```

A configuração padrão utiliza:

| Dependência | Endereço |
|---|---|
| API HTTP | `http://localhost:5260` |
| PostgreSQL | `localhost:5432` |
| OPA/PDP | `http://localhost:8181` |

O health check funciona sem executar uma ação de negócio. As operações governadas dependem do PDP disponível ou de `Opa__BaseUrl` apontando para um serviço compatível.

## Desenvolvimento local

```bash
cd intelligent-backoffice-frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`.

O Vite recebe chamadas em `/api` e as encaminha para:

```bash
VITE_API_PROXY_TARGET=http://localhost:5260 npm run dev
```

## Docker

Execute a partir da raiz do repositório:

```bash
docker compose up -d --build
```

Abra `http://localhost:3000`.

O Nginx serve a SPA e encaminha `/api` para:

```bash
BACKEND_URL=http://host.docker.internal:5260 docker compose up -d --build
```

## Contratos usados

### Criar caso

```json
{
  "externalReference": "ui-2026-001",
  "disputeType": "CARD_PURCHASE",
  "channel": "WEB",
  "priority": "NORMAL",
  "disputedAmount": {
    "currency": "BRL",
    "amount": "120.00"
  }
}
```

### Registrar documento

O console envia `If-Match` com `caseVersion` e registra metadados compatíveis com o backend:

```json
{
  "documentType": "RECEIPT",
  "mediaType": "APPLICATION_PDF",
  "checksum": "<sha-256 sintético>",
  "storageReference": "mock://documents/comprovante.pdf"
}
```

### Execução governada

A execução envia `Idempotency-Key` e utiliza os IDs reais da aprovação, recomendação e evidências. O `MockExecutionGateway` interpreta marcadores no `commandHash` para produzir sucesso, falha ou resultado ambíguo.

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

O backend expõe listagem de casos, evidências, execuções e timeline. Entretanto, ainda não possui endpoints de consulta de recomendações e aprovações. Por isso, os recursos intermediários retornados durante a jornada são mantidos no `localStorage` por `caseId`.

Ao abrir em outro navegador um caso já em `AWAITING_APPROVAL` ou `APPROVED`, pode ser necessário reiniciar a jornada ou informar esses IDs por uma futura tela de recuperação.

## Limitações declaradas

- identidade baseada em headers da baseline;
- sem login JWT no frontend;
- documentos representados por metadados, não upload binário;
- execução financeira mock;
- sem métricas, outbox, timers, DLQ ou replay expostos pelo backend HTTP atual;
- solução de validação, não classificada como produção.

## Qualidade

```bash
npm run check
```

O comando executa ESLint, testes unitários do modelo de workflow e build Vite. O GitHub Actions também valida a imagem Docker e o Compose.

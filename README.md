# Intelligent Backoffice Frontend

[![Frontend CI](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml)

Console React para consumir e validar o backend [.NET Backoffice Platform API](https://github.com/leandrosflora/backoffice-platform-api). A arquitetura e os contratos de referência permanecem documentados em [Intelligent Backoffice Platform Architecture](https://github.com/leandrosflora/intelligent-backoffice-platform-architecture).

## Executar

### 1. Backend

No repositório `backoffice-platform-api`:

```bash
docker compose --profile runtime up -d postgres

dotnet run --project src/Backoffice.Api
```

A API utiliza por padrão:

- HTTP: `http://localhost:5260`;
- PostgreSQL: `localhost:5432`;
- OPA/PDP: `http://localhost:8181`.

Para ações protegidas, mantenha um PDP compatível disponível em `8181` ou configure `Opa__BaseUrl` no backend.

### 2. Frontend em desenvolvimento

```bash
cd intelligent-backoffice-frontend
npm ci
npm run dev
```

Acesse `http://localhost:5173`. O Vite encaminha `/api` para `http://localhost:5260`.

### 3. Frontend em Docker

Na raiz deste repositório:

```bash
docker compose up -d --build
```

Acesse `http://localhost:3000`. O Nginx encaminha `/api` para `BACKEND_URL`, cujo padrão é `http://host.docker.internal:5260` (o backend rodando via `dotnet run`, passo 1).

### 4. Stack completa via Docker Compose (backend + frontend)

Validado localmente: backend `runtime` (Postgres + OPA + API, todos em container) e frontend, cada um com seu próprio `docker compose`.

No repositório `intelligent-backoffice-platform`:

```bash
docker compose --profile runtime up --build -d
```

A API fica publicada em `http://localhost:8080` (não `5260` — esse é o padrão do `dotnet run`, não do container).

Na raiz deste repositório, aponte o `BACKEND_URL` para a porta publicada acima:

```bash
BACKEND_URL=http://host.docker.internal:8080 docker compose up -d --build
```

Se a porta `3000` já estiver em uso/reservada na máquina (comum no Windows), publique em outra porta com `FRONTEND_PORT`:

```bash
BACKEND_URL=http://host.docker.internal:8080 FRONTEND_PORT=3001 docker compose up -d --build
```

Acesse `http://localhost:3000` (ou a porta escolhida em `FRONTEND_PORT`).

## Escopo da interface

- criação, listagem e consulta de casos;
- workflow completo de contestação;
- simulação das identidades enviadas nos headers da baseline;
- registro documental e consulta de evidências;
- investigação e recomendação;
- aprovação humana com `X-Authority-Limit`;
- execução governada e idempotente;
- reconciliação de resultado ambíguo;
- consulta de execuções e timeline;
- console de chamadas HTTP e Problem Details.

## Limites

- identidade ainda baseada em headers, conforme o backend atual;
- documentos representados por metadados e storage reference mock;
- execução por `MockExecutionGateway`;
- IDs intermediários de investigação, recomendação e aprovação são mantidos no `localStorage` para continuar a jornada;
- o backend ainda não expõe métricas, outbox, timers, DLQ ou replay por HTTP.

Consulte a [documentação detalhada do projeto React](intelligent-backoffice-frontend/README.md).

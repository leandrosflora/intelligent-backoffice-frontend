# Intelligent Backoffice Console

Frontend React para executar e inspecionar a implementação de referência da [Intelligent Backoffice Platform Architecture](https://github.com/leandrosflora/intelligent-backoffice-platform-architecture).

A aplicação não simula o workflow no navegador. Cada transição é enviada ao backend e validada por estado, versão, identidade, papel, policy e idempotência.

## Funcionalidades

- criação e consulta de casos;
- jornada guiada por estado;
- registro de documento sintético;
- investigação e recomendação;
- aprovação humana com alçada;
- execução mock com sucesso ou resultado ambíguo;
- reconciliação autorizada e idempotente;
- timeline auditável;
- inspeção de outbox, projeções, timers e dead letters;
- replay operacional controlado;
- health check e métricas Prometheus;
- console local de requisições, identidades, latência e respostas;
- modo manual para testar negações de policy.

## Pré-requisito: subir a plataforma

No repositório de arquitetura:

```bash
docker compose --profile distributed up -d --build
python scripts/run_dispute_walkthrough.py
```

O profile distribuído expõe a API em `http://localhost:8081`.

## Desenvolvimento local

```bash
cd intelligent-backoffice-frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`.

O Vite recebe chamadas em `/api` e as encaminha ao backend configurado por:

```bash
VITE_API_PROXY_TARGET=http://localhost:8081 npm run dev
```

## Docker

Execute a partir da raiz do repositório:

```bash
docker compose up -d --build
```

Abra `http://localhost:3000`.

O Nginx serve a SPA e encaminha `/api` para:

```bash
BACKEND_URL=http://host.docker.internal:8081 docker compose up -d --build
```

## Modos de identidade

### Guiado

Seleciona automaticamente a identidade esperada para cada operação:

- `case-manager` para abertura;
- `document-processor` para documentos;
- `operations-analyst` para investigação;
- `decision-agent` para recomendação;
- `approver` para aprovação;
- `execution-service` para execução;
- `reconciler` para reconciliação;
- `auditor` para timeline;
- `platform-operator` para eventing.

### Manual

Mantém a identidade selecionada em todas as chamadas. Esse modo é útil para validar `403 Forbidden`, segregação de funções e least privilege.

## Limitações declaradas

- utiliza o profile de identidade por headers da baseline;
- o profile JWT seguro ainda não possui login no frontend;
- documentos são metadados sintéticos, não upload binário;
- execução financeira é mock;
- o backend ainda não expõe listagem global de casos;
- IDs usados pelo navegador são mantidos em `localStorage` apenas como atalhos;
- a solução permanece `NOT_PRODUCTION_READY`.

## Qualidade

```bash
npm run check
```

O comando executa:

- ESLint;
- testes unitários do modelo de workflow;
- build de produção com Vite.

O GitHub Actions também valida a imagem Docker e o Compose.

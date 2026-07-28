# Intelligent Backoffice Frontend

[![Frontend CI](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/leandrosflora/intelligent-backoffice-frontend/actions/workflows/ci.yml)

Console React para consumir e validar a implementação executável da [Intelligent Backoffice Platform Architecture](https://github.com/leandrosflora/intelligent-backoffice-platform-architecture).

## Executar

Primeiro, suba o backend distribuído no repositório da plataforma:

```bash
docker compose --profile distributed up -d --build
```

Depois execute o frontend:

```bash
cd intelligent-backoffice-frontend
npm ci
npm run dev
```

Acesse `http://localhost:5173`.

### Docker

```bash
docker compose up -d --build
```

Acesse `http://localhost:3000`.

## Escopo da interface

- abertura e consulta de casos;
- workflow completo de contestação;
- identidades e policies;
- aprovação humana;
- execução idempotente;
- reconciliação de resultado ambíguo;
- timeline e evidências;
- outbox, projeções, timers, DLQ e replay;
- health e métricas;
- console de chamadas HTTP.

Consulte a [documentação detalhada do projeto React](intelligent-backoffice-frontend/README.md).

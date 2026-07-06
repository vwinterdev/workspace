# work-db-mcp-server

MCP-сервер, дёргает HTTP API `apps/work-db` (тикеты) и отдаёт как MCP-тулы. Два транспорта — stdio (локально) и HTTP (прод, за Traefik).

## Тулы

- `work_db_list_tickets` — список тикетов
- `work_db_get_ticket` — один тикет по id
- `work_db_create_ticket` — создать тикет
- `work_db_delete_ticket` — удалить тикет

## Env

- `WORK_DB_API_URL` — базовый URL work-db API (по умолчанию `http://localhost:3000`)
- `TRANSPORT` — `stdio` (по умолчанию) или `http`
- `PORT` — порт для HTTP-режима (по умолчанию `3000`)

## Запуск: stdio (локально)

```bash
pnpm --filter work-db-mcp-server build
node mcp-servers/work-db-mcp-server/dist/index.js
```

### Подключение в Claude Code / Desktop

```json
{
  "mcpServers": {
    "work-db": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/work-db-mcp-server/dist/index.js"],
      "env": { "WORK_DB_API_URL": "http://localhost:3000" }
    }
  }
}
```

## Запуск: HTTP (прод)

```bash
TRANSPORT=http PORT=3000 WORK_DB_API_URL=http://work-db:3000 node dist/index.js
```

`POST /` — MCP JSON-RPC эндпоинт (stateless, `sessionIdGenerator: undefined`), `GET /health` — healthcheck.

В `docker-compose.yml` поднят как сервис `work-db-mcp`, за Traefik по `https://${DOMAIN}/mcp/db` (см. корневой README, секция «Архитектура прода»).

# workspace

Turborepo-монорепа: pnpm workspaces + turbo. Три каталога верхнего уровня:

```
apps/           ← готовые приложения (сервисы со своим процессом)
packages/       ← общий код, шарится между apps/*
mcp-servers/    ← MCP-серверы (stdio локально / HTTP в проде за Traefik)
```

## Что где

| Путь | Пакет | Что это |
|---|---|---|
| `apps/work-db` | `@app/work-db` | Hono API, тикеты (CRUD) |
| `packages/schemas` | `schemas` | Drizzle-схемы + БД-клиент, импортится любым apps/* |
| `mcp-servers/work-db-mcp-server` | `work-db-mcp-server` | MCP-сервер (stdio локально, HTTP в проде), дёргает HTTP work-db, отдаёт тикеты как тулы AI-клиентам |

Зависимости между ними: `apps/work-db` → `schemas` (workspace:*). `mcp-servers/work-db-mcp-server` не импортит `schemas` напрямую — ходит в `work-db` только по HTTP (`WORK_DB_API_URL`).

### work-db-mcp-server: два транспорта

Переключатель — env `TRANSPORT` (`src/index.ts`):
- `TRANSPORT` не задан (по умолчанию) → stdio. Для локальной работы с Claude Desktop/Code — процесс запускается клиентом напрямую, см. `mcp-servers/work-db-mcp-server/README.md`.
- `TRANSPORT=http` → Express + `StreamableHTTPServerTransport`, стейтлес (`sessionIdGenerator: undefined`, без сессий — каждый запрос независим). Слушает `PORT` (внутри Docker — 3000), `POST /` — MCP JSON-RPC эндпоинт, `GET /health` — healthcheck.

В проде (`docker-compose.yml`, сервис `work-db-mcp`) поднят именно в HTTP-режиме за Traefik, `WORK_DB_API_URL=http://work-db:3000` — ходит в work-db прямо по internal Docker-сети `web`, минуя Traefik/`/db`-префикс.

## Архитектура прода (docker-compose.yml)

```
                             :80
                              │
                        ┌─────▼─────┐
                        │  traefik  │  reverse proxy, единственный сервис на хостовых портах
                        └─────┬─────┘
                              │ Docker provider (слушает labels контейнеров)
              ┌───────────────┴───────────────┐
   Host(${DOMAIN}) && PathPrefix(/db)   Host(${DOMAIN}) && PathPrefix(/mcp/db)
   stripprefix(/db)                     stripprefix(/mcp/db)
              │                               │
        ┌─────▼──────┐                 ┌──────▼───────┐
        │  work-db   │◄── HTTP ────────│  work-db-mcp │
        │  :3000     │ http://work-db:3000 (internal) │  :3000 (MCP over HTTP)
        └────────────┘                 └──────────────┘

оба порта внутренние (`expose`, не `ports`) — наружу торчит только traefik
```

> Сейчас только HTTP (порт 80). 443/TLS/Let's Encrypt выключены — нет домена, только `nip.io` на IP VPS. Когда появится нормальный домен, включить `websecure`/ACME обратно (см. секцию «HTTPS» ниже).

**Traefik** (`docker-compose.yml`, сервис `traefik`):
- слушает только `:80` (`web`) — единственный сервис с published-портами на хосте.
- discovery через `--providers.docker=true` + `exposedbydefault=false` — роутит только контейнеры с явным `traefik.enable=true` в labels.
- дашборд не поднят.

**Роутинг** — у каждого сервиса свой router/middleware/service (имя = имя сервиса, чтобы не перезаписать чужой), схема одна и та же: `Host(${DOMAIN}) && PathPrefix(/<prefix>)` → `stripprefix(/<prefix>)` → внутренний порт контейнера. `entrypoints=web`, `loadbalancer.server.port` — внутренний порт, наружу не `exposed` (`expose`, не `ports`).

Итог по маршрутам:

| Снаружи | Внутри | Куда |
|---|---|---|
| `http://${DOMAIN}/db/health` | `GET /health` | work-db |
| `http://${DOMAIN}/db/tickets` | `GET /tickets` | work-db |
| `http://${DOMAIN}/db/tickets/:id` | `GET /tickets/:id` | work-db |
| `http://${DOMAIN}/mcp/db/health` | `GET /health` | work-db-mcp |
| `http://${DOMAIN}/mcp/db/` | `POST /` (MCP JSON-RPC) | work-db-mcp |
| `http://${DOMAIN}/` (без префикса) | не матчится ни одним роутером → 404 у Traefik | — |

## HTTPS (когда появится домен)

Сейчас `docker-compose.yml` без TLS — только `web` (:80). Чтобы включить HTTPS:

1. В `traefik.command` добавить:
   ```yaml
   - --entrypoints.websecure.address=:443
   - --entrypoints.web.http.redirections.entrypoint.to=websecure
   - --entrypoints.web.http.redirections.entrypoint.scheme=https
   - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
   - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
   - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}
   - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
   ```
2. В `traefik.ports` добавить `"443:443"`.
3. В `traefik.volumes` добавить volume `letsencrypt:/letsencrypt` (+ объявить `volumes: letsencrypt:` в корне файла).
4. У каждого роутера (`work-db`, `work-db-mcp`) сменить `entrypoints=web` → `entrypoints=websecure`, добавить `tls.certresolver=letsencrypt`.
5. Открыть 443 в файрволе VPS.
6. `.env`: `DOMAIN` — реальный домен (не `nip.io`, если хочется валидный серт без варнингов, хотя `nip.io` тоже подойдёт для Let's Encrypt).

`work-db-mcp` в work-db не через Traefik/`/db` ходит, а прямо по internal Docker-сети `web`: `WORK_DB_API_URL=http://work-db:3000` (имя сервиса = DNS-имя контейнера).

Добавляя новый сервис (приложение или ещё один MCP-сервер), ему даётся свой `PathPrefix` + свой `stripprefix`-middleware по той же схеме — один Traefik на 80/443, много сервисов за разными префиксами одного домена.

## Как добавить новый сервис

Traefik не трогаем — только добавляем новый сервис в `docker-compose.yml` со своими labels. Шаблон (замени `<name>` и `<prefix>`):

```yaml
  <name>:
    build:
      context: .
      dockerfile: apps/<name>/Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    expose:
      - "<port>"
    networks:
      - web
    labels:
      - traefik.enable=true
      - traefik.http.routers.<name>.rule=Host(`${DOMAIN}`) && PathPrefix(`/<prefix>`)
      - traefik.http.routers.<name>.entrypoints=websecure
      - traefik.http.routers.<name>.tls.certresolver=letsencrypt
      - traefik.http.routers.<name>.middlewares=<name>-stripprefix
      - traefik.http.middlewares.<name>-stripprefix.stripprefix.prefixes=/<prefix>
      - traefik.http.services.<name>.loadbalancer.server.port=<port>
```

Правила:
- `<name>` — уникален для router/middleware/service labels (иначе перезапишет чужой роутер).
- `<prefix>` — свой у каждого сервиса, без пересечений (`/db`, `/admin`, `/mcp` и т.д.).
- `expose`, не `ports` — наружу торчит только Traefik на 80/443.
- сам сервис пишет роуты от корня (`/`, `/health`, ...), про префикс не знает — Traefik срезает его до проксирования.
- `Dockerfile` — копия `apps/work-db/Dockerfile` с заменённым путём (`COPY apps/<name>/package.json ...`, `WORKDIR /repo/apps/<name>`).

Проверено живьём: два сервиса на одном Traefik с разными префиксами (`/db`, `/example`) — оба отвечают независимо, без префикса — 404, префикс не матчится частично (`/dbwrong` не считается `/db`).

## Слои внутри work-db

`apps/work-db/src/`:

```
routes/       ← Hono-контроллеры: парсят вход, зовут service, мапят ошибки в HTTP-коды
validators/   ← zod-схемы входных данных
services/     ← бизнес-логика, бросает NotFoundError и т.п.
repositories/ ← только drizzle-запросы к schemas.tickets
presenters/   ← форма JSON-ответа
```

Поток запроса: `route → validator → service → repository → service → presenter → route`.

## Локальная разработка

```bash
pnpm install
pnpm dev      # turbo: собирает packages/*, поднимает apps/work-db на :3000
pnpm build    # turbo build всех воркспейсов
```

БД-миграции — из `packages/schemas`:

```bash
pnpm --filter schemas db:generate
pnpm --filter schemas db:migrate
```

## Деплой

```bash
cp .env.example .env   # заполнить DATABASE_URL, DOMAIN, ACME_EMAIL
docker compose up -d --build
```

# WhatsApp AI Personal Assistant — v1.0

A controlled personal WhatsApp assistant: receives messages via the Meta WhatsApp
Cloud API, classifies them with a swappable AI provider, and only auto-replies
when a policy engine decides it's safe to do so. Everything else drafts for
approval or alerts you directly.

## Stack

Node.js · TypeScript · Express · PostgreSQL · Prisma · Zod · Pino · Vitest

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in your real values
pnpm prisma:migrate
pnpm dev
```

The server starts on `http://localhost:5000` (see `.env`).

## What's implemented

- ✅ Project scaffold, TypeScript config, Zod-validated env (`src/config/env.ts`)
- ✅ Provider interfaces: `AiProvider`, `WhatsAppProvider`, `NotificationProvider` (`src/types/providers.ts`)
- ✅ Meta WhatsApp Cloud API provider (webhook verify + parse + send, with retry+backoff)
- ✅ OpenAI-compatible AI provider adapter, schema-validated classification, retry+backoff
- ✅ Telegram notification provider
- ✅ JSON knowledge base loader + deterministic pattern matching
- ✅ **Policy engine** — the safety-critical layer; HIGH risk always alerts,
  low-confidence never auto-sends, regardless of what the AI suggests
- ✅ Message processing pipeline (`src/services/messageService.ts`)
- ✅ Prisma schema (Contact, Conversation, Message, AIAnalysis, Notification, SystemSetting)
- ✅ REST endpoints: health, webhook verify/receive, conversations, approve/reject drafts,
  **`GET/PATCH /api/settings/ai`** (swap AI provider/model at runtime, no restart),
  **`GET /api/notifications`** (every alert is persisted, even if delivery fails)
- ✅ Rate limiting (`express-rate-limit`) on the public webhook and the admin API
- ✅ Retry-with-backoff utility (`src/utils/retry.ts`) wired into both outbound HTTP calls
- ✅ Notifications are **persisted before dispatch** — an alert is never silently lost
  even if Telegram itself is down
- ✅ Dockerfile + docker-compose for local Postgres
- ✅ Unit tests for the policy engine (5 cases)
- ✅ **Integration tests** for the full webhook flow (`tests/webhook.integration.test.ts`):
  auto-reply, high-risk override, medium-risk draft, idempotency, and notification-failure
  handling — all with the DB and outbound providers mocked, no real services required

## Still open

- [ ] Real admin auth (current guard is a placeholder bearer-token check — fine for one person,
  swap for proper auth before more than one person uses the dashboard)
- [ ] End-to-end test against a real WhatsApp test number (needs your Meta credentials)
- [ ] `faq.json`, `services.json`, `style-guide.json` — only `response-rules.json` has content so far

## Testing

```bash
pnpm test
```

## Notes

- Never commit `.env` — only `.env.example` is tracked.
- Knowledge JSON files live in `src/knowledge/`; `response-rules.json` is the
  first one — add `faq.json`, `services.json`, etc. following the same shape.
- Verify Meta's current WhatsApp Cloud API docs before production launch —
  webhook payload shapes and pricing can change.

::: {align="center"}
# WhatsApp AI Personal Assistant

### A policy-controlled AI assistant for WhatsApp Business

Receive, understand, prioritize, and respond to WhatsApp messages ---
with safety rules and human approval built into the workflow.

`<br />`{=html}

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![License](https://img.shields.io/badge/Status-Active%20Development-orange)
:::

------------------------------------------------------------------------

## Overview

**WhatsApp AI Personal Assistant** is a backend service that connects
the Meta WhatsApp Cloud API with an AI classification layer and a policy
engine.

It analyzes incoming messages and decides whether a message can receive
an automatic response, should be saved as a draft for approval, or needs
to trigger an alert.

The key principle is simple: **AI suggests; the policy engine controls
what the system is allowed to do.**

The project is built with **Node.js and TypeScript**. It does not use
Python.

## How It Works

``` mermaid
flowchart TD
    A[Incoming WhatsApp Message] --> B[Meta WhatsApp Cloud API]
    B --> C[Webhook Endpoint]
    C --> D[Message Processing Service]
    D --> E[AI Provider]
    E --> F[Message Classification]
    F --> G[Policy Engine]
    G -->|Safe and confident| H[Automatic Reply]
    G -->|Needs human review| I[Save Draft for Approval]
    G -->|High risk or uncertain| J[Persist Notification]
    I --> K[Admin Approval or Rejection]
    J --> L[Telegram Alert]
    K -->|Approved| H
```

### Message decision flow

  Decision                     System behavior
  ---------------------------- ---------------------------------------------------
  Safe + high confidence       Sends an automatic reply
  Medium risk / needs review   Saves a draft for human approval
  High risk                    Blocks automatic sending and creates an alert
  Low confidence               Does not auto-send; routes for review or alerting

The policy engine is the safety-critical layer. An AI classification
alone cannot override the configured safety rules.

## Core Features

-   **WhatsApp Cloud API integration** --- verifies webhooks, parses
    incoming events, and sends messages.
-   **Swappable AI provider** --- uses an OpenAI-compatible API adapter
    rather than coupling the application to one provider implementation.
-   **Structured AI classification** --- validates classification output
    against a schema.
-   **Policy-controlled replies** --- applies risk and confidence rules
    before any automatic response.
-   **Human approval workflow** --- supports approving or rejecting
    response drafts.
-   **Telegram notifications** --- sends alerts for messages that need
    attention.
-   **Persistent notifications** --- stores notifications before
    attempting delivery, so a Telegram delivery failure does not
    silently erase the alert.
-   **Knowledge base loader** --- loads JSON knowledge files and
    supports deterministic pattern matching.
-   **Runtime AI settings** --- exposes endpoints to read and update the
    AI provider/model configuration without restarting the application.
-   **Retry with backoff** --- retries outbound HTTP operations with
    backoff.
-   **Rate limiting** --- applies request limits to public webhook and
    admin API routes.
-   **Idempotent message processing** --- includes integration coverage
    for duplicate-message handling.
-   **Docker support** --- includes a Dockerfile and Docker Compose
    configuration for local PostgreSQL development.

## Technology Stack

### Runtime & Language

-   Node.js 20+
-   TypeScript 5.6
-   `tsx`

### Backend & API

-   Express.js 4
-   REST API
-   Meta WhatsApp Cloud API
-   Telegram Bot API

### AI Integration

-   OpenAI-compatible API
-   Configurable AI provider and model
-   Zod-validated AI classification output

### Database & ORM

-   PostgreSQL
-   Prisma 5
-   `@prisma/client`

### Validation, Logging & Security

-   Zod
-   Pino
-   Pino HTTP
-   `express-rate-limit`
-   dotenv

### Testing & Code Quality

-   Vitest
-   Supertest
-   ESLint
-   Prettier

### Development & Infrastructure

-   pnpm
-   Docker
-   Docker Compose
-   TypeScript Compiler (`tsc`)

## Architecture Notes

The application uses provider interfaces to keep external integrations
replaceable:

-   `AiProvider` --- abstracts the AI classification provider.
-   `WhatsAppProvider` --- abstracts WhatsApp messaging operations.
-   `NotificationProvider` --- abstracts notification delivery.

This separation helps keep the message-processing and policy logic
independent from individual third-party services.

## Project Structure

``` text
whatsapp-ai-assistant/
├── prisma/                 # Prisma schema and migrations
├── src/
│   ├── config/             # Environment and application configuration
│   ├── knowledge/          # JSON knowledge base files
│   ├── services/           # Message processing and application services
│   ├── types/              # Provider interfaces and shared types
│   ├── utils/              # Shared utilities, including retry logic
│   └── server.ts           # Application entry point
├── tests/                  # Unit and integration tests
├── .env.example            # Environment variable template
├── Dockerfile
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vitest.config.ts
```

## Getting Started

### Prerequisites

-   Node.js 20 or later
-   pnpm
-   PostgreSQL (or Docker)
-   Meta WhatsApp Cloud API credentials
-   An API key for an OpenAI-compatible AI provider
-   Telegram Bot credentials if Telegram notifications are enabled

### 1. Clone the repository

``` bash
git clone https://github.com/Robinishear/whatsapp-ai-assistant.git
cd whatsapp-ai-assistant
```

### 2. Install dependencies

``` bash
pnpm install
```

### 3. Configure environment variables

``` bash
cp .env.example .env
```

Update `.env` with your local database URL and provider credentials.

  Variable                     Purpose
  ---------------------------- --------------------------------
  `NODE_ENV`                   Application environment
  `PORT`                       HTTP server port
  `DATABASE_URL`               PostgreSQL connection string
  `WHATSAPP_ACCESS_TOKEN`      Meta WhatsApp access token
  `WHATSAPP_PHONE_NUMBER_ID`   WhatsApp phone number ID
  `WHATSAPP_VERIFY_TOKEN`      Webhook verification token
  `AI_PROVIDER`                AI provider identifier
  `AI_MODEL`                   AI model name
  `AI_BASE_URL`                OpenAI-compatible API base URL
  `AI_API_KEY`                 AI provider API key
  `NOTIFICATION_PROVIDER`      Notification provider
  `NOTIFICATION_BOT_TOKEN`     Telegram bot token
  `NOTIFICATION_CHAT_ID`       Telegram destination chat ID

Never commit your real `.env` file or API credentials.

### 4. Run database migrations

``` bash
pnpm prisma:migrate
```

### 5. Start the development server

``` bash
pnpm dev
```

The server listens on `http://localhost:5000` by default. The port can
be changed through the `PORT` environment variable.

## Available Scripts

  Command                  Description
  ------------------------ --------------------------------------------------
  `pnpm dev`               Start the development server with watch mode
  `pnpm build`             Compile TypeScript and copy knowledge JSON files
  `pnpm start`             Run the compiled server
  `pnpm lint`              Lint TypeScript source files
  `pnpm format`            Format TypeScript source files
  `pnpm test`              Run the test suite
  `pnpm test:watch`        Run Vitest in watch mode
  `pnpm prisma:generate`   Generate Prisma Client
  `pnpm prisma:migrate`    Run Prisma development migrations

## API Capabilities

The current implementation includes endpoints for:

-   Health checks
-   WhatsApp webhook verification and message reception
-   Conversation retrieval
-   Approving and rejecting response drafts
-   Reading and updating AI provider/model settings
-   Retrieving persisted notifications

The AI settings endpoints are:

-   `GET /api/settings/ai`
-   `PATCH /api/settings/ai`

The notifications endpoint is:

-   `GET /api/notifications`

See the source code for the exact request and response schemas.

## Testing

Run the test suite:

``` bash
pnpm test
```

The repository includes policy-engine unit tests and webhook-flow
integration tests. The integration tests cover automatic replies,
high-risk policy overrides, medium-risk drafts, idempotency, and
notification delivery failures. External providers and the database are
mocked in these tests; they do not replace a live WhatsApp end-to-end
test.

## Current Development Status

Implemented: - Core TypeScript/Express application scaffold - Provider
interfaces and integration adapters - WhatsApp webhook verification,
parsing, and sending - AI classification adapter - Policy engine and
message-processing pipeline - Telegram notification integration - Prisma
data model - Core REST endpoints - Rate limiting and retry utility -
Docker configuration - Unit and integration test coverage for key flows

Still to complete: - Replace the placeholder admin bearer-token guard
with proper authentication before exposing the system to broader or
multi-user use. - Perform an end-to-end test using real Meta WhatsApp
credentials and a WhatsApp test number. - Expand the JSON knowledge base
with `faq.json`, `services.json`, and `style-guide.json`; currently,
`response-rules.json` is the knowledge file with content.

## Security Notes

-   Keep secrets in environment variables.
-   Never commit `.env`.
-   Keep the admin API protected; the current bearer-token guard is a
    placeholder, not a production-grade multi-user authentication
    system.
-   Do not allow AI output to bypass the policy engine.
-   Verify the latest Meta WhatsApp Cloud API documentation before
    production deployment because API behavior and requirements may
    change.

## Roadmap

-   [ ] Implement production-ready admin authentication
-   [ ] Complete live WhatsApp Cloud API end-to-end testing
-   [ ] Expand the JSON knowledge base
-   [ ] Review deployment configuration and production observability
-   [ ] Add further tests for edge cases and failure recovery

## Contributing

Contributions, ideas, and bug reports are welcome. Please open an issue
to discuss significant changes before submitting a pull request.

## License

No license has been specified yet. All rights are reserved unless a
license is added to this repository.

------------------------------------------------------------------------

::: {align="center"}
**Built with Node.js, TypeScript, and a safety-first approach to AI
automation.**
:::

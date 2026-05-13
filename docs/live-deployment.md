# Live Deployment Guide

## Goal

This guide documents the recommended server requirements and migration flow for moving this stack from local Docker to a live server.

If you want the full step-by-step AWS version with EC2 creation, Docker installation, domain setup, HTTPS, and credential placement, use [docs/aws-ec2-deployment.md](docs/aws-ec2-deployment.md).

## Current production shape

Main services:

- Evolution API
- n8n
- PostgreSQL
- Redis
- Connect UI

Typical persistent data:

- `/home/node/.n8n`
- Postgres data volume
- Redis appendonly volume
- Evolution instance/session store

## Recommended server requirements

### Minimum for personal testing or low traffic

- 2 vCPU
- 2 GB RAM
- 30 to 40 GB SSD
- Ubuntu 22.04 or 24.04 LTS

This is the smallest shape I would use if you want the full stack to stay reliably online.

### Safer small production baseline

- 2 vCPU
- 4 GB RAM
- 60 GB SSD

This is the better default for:

- one WhatsApp number
- low to moderate message traffic
- n8n editor usage
- WooCommerce lookups
- OpenAI replies

### When to scale up

Move to 4 vCPU and 8 GB RAM if you expect:

- multiple WhatsApp numbers
- heavy workflow expansion
- many simultaneous conversations
- more automation branches, order lookup, customer lookup, document processing, or media-heavy flows

## AWS recommendation

### Can `t3.micro` or a free server be used?

For short-lived demos, experiments, or UI testing only: maybe.

For a dependable always-on setup: no, not recommended.

Reasons:

- `t3.micro` only has 1 GB RAM
- this stack includes n8n, Postgres, Redis, Evolution, and a Connect UI service
- memory pressure will become a problem quickly
- Docker restarts, database pressure, and workflow execution spikes will be harder to absorb

### Better AWS choices

Recommended starting points:

1. `t3.small` or `t4g.small` for low-traffic testing and staging
2. `t3.medium` or `t4g.medium` for small production

Practical guidance:

- `t3.micro`: not suitable for reliable production
- AWS free-tier style servers: only for short tests, not for a business-facing bot
- `t3.small`: acceptable minimum if traffic is light and you monitor memory closely
- `t3.medium`: better default for a real live deployment

If ARM is acceptable in your environment, `t4g.small` or `t4g.medium` can be cost-efficient, but only if every image you use supports ARM cleanly.

## Live migration steps

### 1. Prepare the server

Install:

- Docker Engine
- Docker Compose plugin
- Git
- a reverse proxy such as Caddy, Nginx, or Traefik

### 2. Copy the project

Clone the repository onto the server.

### 3. Prepare production environment values

Create `.env` on the server with real production values.

Main items to review:

- `N8N_HOST`
- `N8N_PROTOCOL`
- `N8N_EDITOR_BASE_URL`
- `N8N_WEBHOOK_URL`
- `EVOLUTION_SERVER_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE`
- `OPENAI_API_KEY`
- `WOOCOMMERCE_BASE_URL`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`

For production with a valid certificate chain:

- `N8N_NODE_TLS_REJECT_UNAUTHORIZED=1`

### 4. Configure domains and HTTPS

Suggested layout:

- `https://n8n.yourdomain.com`
- `https://connect.yourdomain.com`

Evolution API should stay private if possible. If you must expose it, put it behind authentication and IP restrictions.

### 5. Start the stack

```bash
docker compose --env-file .env up -d
```

### 6. Bootstrap native n8n credentials

Run:

```bash
./scripts/bootstrap-n8n-credentials.sh
```

This recreates the native n8n credentials expected by the workflow export.

### 7. Import the workflow

Import:

- `workflows/whatsapp-ai-auto-reply.json`

Because the workflow is already bound to the fixed credential IDs, bootstrap the credentials before importing or activating the workflow.

### 8. Create the n8n owner account

Open the live n8n editor and finish the owner setup if this is a fresh server.

### 9. Restore the Evolution webhook and instance settings

Point Evolution to the correct live n8n webhook.

Preferred public webhook form:

- `https://n8n.yourdomain.com/webhook/evolution-incoming`

### 10. Connect WhatsApp

Use the Connect UI or direct Evolution APIs to connect the WhatsApp number.

### 11. Validate the live system

Check:

- n8n workflow imported successfully
- both native credentials exist in n8n
- Evolution instance is connected
- inbound WhatsApp webhook reaches n8n
- product questions return WooCommerce-backed replies
- human-handoff route still works

## Migration order for the cleanest rollout

Recommended order:

1. Bring up infrastructure
2. Bootstrap n8n credentials
3. Import workflow
4. Configure reverse proxy and HTTPS
5. Restore Evolution webhook
6. Connect WhatsApp number
7. Run end-to-end message tests
8. Activate workflow for live traffic

## Backup recommendations

Back up these paths or volumes:

- n8n data volume
- Postgres data volume
- Redis data volume if you rely on persistence
- Evolution data volume
- `.env` stored securely outside git

## Current limitation to remember

The workflow now uses the native OpenAI n8n credential for product and general reply generation, but Whisper transcription in the normalization step still reads `OPENAI_API_KEY` directly from the n8n container environment.

That means for now you should keep both of these in place on the live server:

- native OpenAI credential in n8n
- `OPENAI_API_KEY` available in the n8n container environment
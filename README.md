# WhatsApp AI Auto Reply System

Local MVP for WhatsApp auto-replies using Evolution API, n8n, and OpenAI.

## How it works

This stack has four moving parts:

- Evolution API keeps the WhatsApp session connected and receives incoming WhatsApp events.
- Evolution forwards those events to the n8n production webhook at `/webhook/evolution-incoming`.
- n8n runs the workflow in `workflows/whatsapp-ai-auto-reply.json`.
- The workflow normalizes the incoming message, optionally transcribes audio with OpenAI Whisper, routes the message, optionally fetches WooCommerce products with the native WooCommerce node, and sends either an AI reply or a human-handoff reply back through Evolution API.

High-level flow:

1. Customer sends a WhatsApp message.
2. Evolution API receives the event from the connected WhatsApp session.
3. Evolution calls n8n at `http://host.docker.internal:5678/webhook/evolution-incoming` in local Docker setup.
4. n8n filters unsupported chats like self messages, groups, and status updates.
5. n8n generates a reply and sends it back using Evolution `sendText`.
6. The customer receives the WhatsApp reply from the connected number.

## What this repo contains

- `docker-compose.yml` for the local stack
- `docker-compose.ec2.yml` as the hardened EC2 production override
- `.env.example` for environment variables
- `deploy/Caddyfile.ec2` as the ready-to-use production Caddy reverse proxy file
- `scripts/bootstrap-n8n-credentials.sh` to create or update native n8n credentials from the container environment
- `workflows/whatsapp-ai-auto-reply.json` as the importable n8n workflow
- `docs/setup.md` for setup and startup
- `docs/webhook-configuration.md` for Evolution instance and webhook setup
- `docs/openai-setup.md` for OpenAI requirements and verification
- `docs/current-state.md` for the latest verified local state snapshot
- `docs/live-deployment.md` for server sizing and migration guidance
- `docs/aws-ec2-deployment.md` for the full AWS EC2, Docker, domain, HTTPS, and credential setup guide

## Services

- Evolution API on `http://localhost:8080`
- n8n on `http://localhost:5678`
- Connect UI on `http://localhost:3000`
- PostgreSQL for Evolution persistence
- Redis for Evolution cache and session persistence

## Dashboard access

- n8n editor: `http://localhost:5678`
- Evolution API health: `http://localhost:8080`
- Connect UI: `http://localhost:3000`

After the first startup, open n8n in the browser and complete the owner account setup. From there you can:

- import or edit workflows
- inspect workflow executions
- activate or deactivate workflows
- add more logic step by step as your automation grows

This WhatsApp connection is not made from n8n directly. The WhatsApp session is handled by Evolution API. n8n only receives webhook events from Evolution and decides what to do with them.

The local Connect UI gives you:

- live connection state
- QR display for WhatsApp Linked Devices
- live 8-character phone pairing code
- a form to recreate the instance with a phone number
- one-click webhook restore back to n8n
- direct link to the n8n editor

## Quick start

1. Create a local env file.
2. Start the stack.
3. Import the n8n workflow.
4. Create the Evolution instance and scan the QR.
5. Configure the Evolution webhook to point to n8n.
6. Test with a direct WhatsApp message.

Use the detailed guides here:

- [docs/setup.md](docs/setup.md)
- [docs/webhook-configuration.md](docs/webhook-configuration.md)
- [docs/openai-setup.md](docs/openai-setup.md)
- [docs/current-state.md](docs/current-state.md)
- [docs/live-deployment.md](docs/live-deployment.md)
- [docs/aws-ec2-deployment.md](docs/aws-ec2-deployment.md)

## Public GitHub repo guidance

This repository is designed to be safe for a public GitHub repo only if you keep real secrets out of git.

Commit only:

- source code
- `docker-compose.yml`
- `.env.example`
- workflow JSON exports without embedded secrets
- scripts and docs

Do not commit:

- `.env`
- SSH keys such as `.pem`
- live WooCommerce keys
- live OpenAI keys
- exported n8n credentials
- database files or backups

Configuration split:

- infrastructure/runtime values belong in the server `.env`
- OpenAI and WooCommerce should be created as native n8n credentials or bootstrapped from the server `.env`
- Connect UI is used for WhatsApp pairing, webhook restore, and quick navigation, not as a secret store

For the full production walkthrough, including AWS EC2 creation and domain setup, use [docs/aws-ec2-deployment.md](docs/aws-ec2-deployment.md).

For EC2 production deployments, the repo also includes:

- [docker-compose.ec2.yml](/Users/sanjayshankarm/whatsapp/docker-compose.ec2.yml) to bind service ports to `127.0.0.1`, enable n8n basic auth, and add basic container hardening
- [deploy/Caddyfile.ec2](/Users/sanjayshankarm/whatsapp/deploy/Caddyfile.ec2) to front `n8n` and `connect-ui` with HTTPS through Caddy

## How to connect your WhatsApp

WhatsApp is connected through Evolution API, not from inside n8n.

The easiest local option is to open `http://localhost:3000` and use the Connect UI.

Typical connection flow:

1. Start the stack with Docker.
2. Open the Connect UI.
3. Either scan the QR or use the 8-character phone pairing code.
4. Confirm the instance state changes to `open`.
5. Keep the n8n workflow active so incoming events are processed.

Useful commands:

```bash
source .env

curl -s http://localhost:8080/instance/connectionState/$EVOLUTION_INSTANCE \
	-H "apikey: $EVOLUTION_API_KEY"
```

```bash
source .env

curl -s http://localhost:8080/instance/connect/$EVOLUTION_INSTANCE \
	-H "apikey: $EVOLUTION_API_KEY"
```

In WhatsApp mobile:

1. Open WhatsApp.
2. Go to Linked Devices.
3. Tap Link a Device.
4. Scan the QR returned by Evolution.

## Current workflow behavior

The imported workflow currently does the following:

- accepts Evolution webhook events on the production webhook path
- ignores self messages
- ignores group chats
- ignores status updates
- reads plain text messages
- reads audio messages if Evolution includes an audio URL or base64 payload
- transcribes audio using `whisper-1`
- routes image-based requests, refund/account requests, and other unsupported cases to a human-handoff branch
- handles store-info questions through a dedicated store-info branch before handoff
- handles payment-option questions through a dedicated payment-info branch before handoff
- handles order-status questions through a native WooCommerce order lookup branch before handoff
- fetches product matches with the native WooCommerce node when the message looks like a catalog question
- generates AI replies using `gpt-4o-mini` for general chat and product-answer phrasing
- sends the reply back through Evolution API

## OpenAI integration

OpenAI is currently used inside the n8n workflow Code nodes, not inside Evolution API.

Current status in this repo:

- product reply generation now uses the native n8n OpenAI node with the native `OpenAI account` credential
- general reply generation now uses the native n8n OpenAI node with the native `OpenAI account` credential
- audio transcription in `Normalize Incoming` still uses a direct OpenAI Whisper API call from a Code node and still depends on `OPENAI_API_KEY` in the n8n container environment

- audio messages are transcribed with `whisper-1`
- text replies are generated with `gpt-4o-mini`
- the model is used only after the workflow decides which branch should handle the message

Where it lives now:

- audio transcription starts in [workflows/whatsapp-ai-auto-reply.json](/Users/sanjayshankarm/whatsapp/workflows/whatsapp-ai-auto-reply.json)
- product reply phrasing also happens in [workflows/whatsapp-ai-auto-reply.json](/Users/sanjayshankarm/whatsapp/workflows/whatsapp-ai-auto-reply.json)
- general reply generation also happens in [workflows/whatsapp-ai-auto-reply.json](/Users/sanjayshankarm/whatsapp/workflows/whatsapp-ai-auto-reply.json)

Important limitation: the model does not know real store facts, order facts, customer account details, location, or image contents unless n8n fetches or processes that data first. Without a data node before the AI step, the workflow should not answer those questions automatically.

## MVP behavior

- Ignores self messages
- Ignores status updates
- Ignores group chats
- Replies in the same language as the incoming message
- Supports text and audio inputs
- Uses `gpt-4o-mini` for reply generation
- Uses `whisper-1` for audio transcription
- Uses a native WooCommerce node for product lookup
- Sends only unsupported or unsafe queries to a human-handoff branch

## How to extend the workflow

Your next changes should usually be made in n8n, not in Evolution.

Good extension points:

- add an If or Switch node before the OpenAI step for routing by intent or language
- add a database lookup before reply generation
- add order lookup logic before generating the final reply
- split the single Code node into smaller nodes once the workflow becomes harder to maintain
- add memory or conversation state in Redis, Postgres, or another store

Right now the logic is intentionally compact so the MVP is easy to import and run. As you add more alternations, a better structure is:

1. Webhook receive
2. Normalize incoming payload
3. Filter unsupported events
4. Detect intent or message type
5. Fetch business data
6. Generate reply
7. Send reply
8. Log execution

## WooCommerce integration clarification

Yes, WooCommerce is a good fit for n8n integration.

Preferred approach for live servers: configure WooCommerce inside n8n Credentials and use the native WooCommerce node or an HTTP Request node with a predefined WooCommerce credential. This makes server setup easier because store credentials stay in n8n instead of being copied into server environment files.

For the local `woo.local` setup in this repo, the n8n container defaults `N8N_NODE_TLS_REJECT_UNAUTHORIZED=0` so the WooCommerce node can talk to a self-signed local HTTPS certificate. On a live server with a valid certificate, set `N8N_NODE_TLS_REJECT_UNAUTHORIZED=1`.

This repo now also includes a credential bootstrap script:

```bash
./scripts/bootstrap-n8n-credentials.sh
```

That script creates or updates the native n8n credentials with the fixed IDs expected by the workflow export:

- OpenAI account: `2ea268dd-5fb0-4080-93f3-3eb29188656c`
- WooCommerce account: `c1hDGmnfjhyGQV5Q`

This makes live-server migration easier because you can keep the workflow export stable and recreate the required native credentials from server environment variables before importing or activating the workflow.

The repo now includes the first product-info hook in the workflow:

- product-related messages can trigger a WooCommerce product lookup before the AI reply is generated
- WooCommerce lookup is optional and only runs when `WOOCOMMERCE_BASE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, and `WOOCOMMERCE_CONSUMER_SECRET` are configured in n8n
- when WooCommerce returns product matches, the AI is instructed to use those product facts instead of inventing prices or stock

Recommended live-server configuration path:

1. Open n8n.
2. Create a WooCommerce credential in n8n Credentials.
3. Point it to your store URL and enter the consumer key and secret there.
4. Use the native WooCommerce node for product or order fetches.
5. Keep server `.env` focused on infrastructure settings like OpenAI, Evolution, URLs, and ports.

Current repo state: the working MVP still includes an environment-variable-based WooCommerce fallback in the Code node for local convenience. For production, the recommended next refactor is to move the product lookup branch into native n8n nodes so WooCommerce setup is entirely UI-driven.

Recommended pattern:

- Evolution handles WhatsApp transport
- n8n handles orchestration and business logic
- WooCommerce provides product, order, and customer data through its REST API
- OpenAI is used only after n8n has gathered the required business context

Current handling policy in this repo:

- product questions: handled automatically through WooCommerce plus OpenAI phrasing
- general conversational questions: handled by OpenAI with a constrained prompt
- store-info questions: handled through a dedicated branch with constrained store-context phrasing
- payment-option questions: handled through a dedicated branch with constrained payment-context phrasing
- order-status questions: handled automatically through WooCommerce order lookup plus OpenAI phrasing
- account/refund questions: routed to human handoff by default
- image-based product matching and document review: routed to human handoff by default

Example use cases:

- customer asks for order status and n8n fetches the order from WooCommerce before replying
- customer asks whether a product is available and n8n fetches stock or product info first
- customer asks for shipping details and n8n formats the order status into a simple WhatsApp response

Recommended implementation for WooCommerce:

1. Add WooCommerce API credentials in n8n.
2. Add HTTP Request or WooCommerce nodes to fetch products or orders.
3. Use the incoming WhatsApp text to detect intent.
4. Pass the fetched business data into the AI prompt only when needed.
5. Return a concise reply to the user.

For production, avoid asking the model to guess order data. Always fetch real WooCommerce data first, then let the model phrase the response.

## Human handoff

If a request cannot be handled safely by automation, the workflow now replies with a short escalation message and can optionally notify a human endpoint.

Add this environment variable to n8n if you want a real notification to another system:

- `HUMAN_HANDOFF_WEBHOOK_URL`

You can point that URL to:

- another n8n workflow
- a CRM or helpdesk intake webhook
- Slack, Discord, or email bridge automation
- a custom admin panel endpoint

If `HUMAN_HANDOFF_WEBHOOK_URL` is empty, the customer still gets the handoff message, but no external notification is sent.

## Making this live on AWS or any server

See [docs/live-deployment.md](docs/live-deployment.md) for the detailed migration checklist and server recommendations.

This can run on AWS, a VPS, or any Linux server as long as Docker is available and the server can expose HTTPS endpoints.

Minimum production layout:

- one server or VM running Docker and Docker Compose
- public DNS pointing to that server
- reverse proxy such as Nginx, Traefik, or Caddy
- HTTPS for n8n webhooks and admin access
- persistent volumes for Evolution, n8n, Postgres, and Redis

Production changes from local setup:

- replace `localhost` URLs with your public domain or internal container URLs
- replace `host.docker.internal` with the correct reachable service URL
- protect n8n with strong credentials and HTTPS
- restrict Evolution and n8n exposure to only what is required
- back up persistent volumes and database data

Typical AWS options:

1. EC2 with Docker Compose. Simplest option and closest to this repo.
2. ECS or Kubernetes later if you need scaling and managed deployment.

Basic EC2 approach:

1. Launch an Ubuntu EC2 instance.
2. Install Docker and Docker Compose plugin.
3. Clone this repo onto the server.
4. Create `.env` with production values.
5. Set a public domain like `bot.yourdomain.com`.
6. Put Nginx or Caddy in front of n8n and Evolution.
7. Terminate TLS with Let's Encrypt.
8. Update webhook URLs to your live HTTPS endpoint.
9. Run `docker compose up -d`.
10. Verify inbound webhook delivery and WhatsApp replies.

Suggested live URL pattern:

- n8n editor: `https://n8n.yourdomain.com`
- webhook endpoint: `https://n8n.yourdomain.com/webhook/evolution-incoming`
- Evolution API: keep private if possible, or expose behind authenticated proxy only if needed

Important note for live deployment: if Evolution and n8n run in the same Docker network on the same server, point Evolution to the n8n service directly instead of the host machine. Example: `http://n8n:5678/webhook/evolution-incoming` for internal container-to-container traffic, or your public HTTPS URL if external routing is required.

## Notes

- The workflow keeps the core logic inside a single n8n Code node. That makes the flow easier to import across n8n versions and keeps API calls explicit.
- The workflow expects `OPENAI_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, and `EVOLUTION_SERVER_URL` to be available as environment variables inside the n8n container.
- Audio transcription depends on Evolution webhook payloads including an audio URL or base64 payload.
- The production webhook path used by this repo is `/webhook/evolution-incoming`.
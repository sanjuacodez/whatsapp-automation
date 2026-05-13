# Setup Instructions

## Prerequisites

- Docker Desktop running on macOS
- An OpenAI API key
- A WhatsApp number available for QR login in Evolution API

## 1. Create the environment file

From the project root:

```bash
cp .env.example .env
```

Update these values in `.env`:

- `OPENAI_API_KEY`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE`
- `TZ` if you want a timezone different from `Asia/Kolkata`

## 2. Start the stack

```bash
docker compose up -d
```

Check that all services are healthy or running:

```bash
docker compose ps
```

## 3. Open n8n

Open `http://localhost:5678` and complete the initial n8n owner setup.

## 4. Import the workflow

In n8n:

1. Create a new workflow.
2. Use Import from File.
3. Select `workflows/whatsapp-ai-auto-reply.json`.
4. Save the workflow.
5. Activate the workflow after webhook setup is complete.

Before importing on a fresh machine, bootstrap the native credentials so the workflow bindings already exist:

```bash
./scripts/bootstrap-n8n-credentials.sh
```

## 5. Create and connect the Evolution instance

Follow [webhook-configuration.md](webhook-configuration.md) to:

- create the instance
- get the QR code
- configure instance settings
- attach the webhook to n8n

## 6. Test the flow

Send a direct message to the connected WhatsApp account.

Expected result:

- text message: immediate AI-generated reply
- voice note: transcription followed by AI-generated reply

## Useful commands

Start or restart everything:

```bash
docker compose up -d
```

Stop everything:

```bash
docker compose down
```

Stop and remove local volumes:

```bash
docker compose down -v
```

Watch logs:

```bash
docker compose logs -f n8n evolution-api
```
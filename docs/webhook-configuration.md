# Webhook Configuration Guide

This guide configures Evolution API so incoming WhatsApp messages are forwarded to n8n.

## n8n webhook URL

The workflow uses this path:

```text
http://host.docker.internal:5678/webhook/evolution-incoming
```

`host.docker.internal` is used so the Evolution container can reach the n8n container published on the host.

## 1. Create the Evolution instance

Run this request after the stack starts:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H 'Content-Type: application/json' \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d '{
    "instanceName": "local-whatsapp",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true,
    "groupsIgnore": true,
    "alwaysOnline": false,
    "readMessages": false,
    "readStatus": false,
    "syncFullHistory": false
  }'
```

Replace `local-whatsapp` if you changed `EVOLUTION_INSTANCE`.

## 2. Get the QR code

```bash
curl -X GET "http://localhost:8080/instance/connect/local-whatsapp" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Use the returned pairing data or open the Evolution manager if enabled in your setup.

## 3. Configure instance settings

This ensures groups remain ignored even if the instance is recreated.

```bash
curl -X POST http://localhost:8080/settings/set/local-whatsapp \
  -H 'Content-Type: application/json' \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d '{
    "rejectCall": false,
    "msgCall": "",
    "groupsIgnore": true,
    "alwaysOnline": false,
    "readMessages": false,
    "readStatus": false,
    "syncFullHistory": false
  }'
```

## 4. Attach the webhook

```bash
curl -X POST http://localhost:8080/webhook/set/local-whatsapp \
  -H 'Content-Type: application/json' \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://host.docker.internal:5678/webhook/evolution-incoming",
      "webhookByEvents": false,
      "webhookBase64": false,
      "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
    }
  }'
```

## 5. Verify webhook configuration

```bash
curl -X GET http://localhost:8080/webhook/find/local-whatsapp \
  -H "apikey: $EVOLUTION_API_KEY"
```

## 6. Verify instance connection state

```bash
curl -X GET http://localhost:8080/instance/connectionState/local-whatsapp \
  -H "apikey: $EVOLUTION_API_KEY"
```

If the state is not open, reconnect the instance and scan the QR again.
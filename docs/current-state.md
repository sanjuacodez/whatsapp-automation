# Current State Snapshot

Last updated: 2026-05-13

This file records the current verified state of the local MVP so it can be checked later without re-investigating the whole stack.

## Runtime stack

Services currently used by this repo:

- Evolution API
- n8n
- PostgreSQL
- Redis
- Connect UI

Primary local URLs:

- n8n editor: `http://localhost:5678`
- Evolution API: `http://localhost:8080`
- Connect UI: `http://localhost:3000`

## Workflow state

Main workflow file:

- `workflows/whatsapp-ai-auto-reply.json`

Current workflow facts:

- workflow id: `whatsapp-ai-auto-reply`
- webhook id/path: `evolution-incoming`
- product lookup uses native WooCommerce node
- WooCommerce node is bound to the native credential `WooCommerce account`
- product reply generation uses the native OpenAI node and native `OpenAI account` credential
- general reply generation uses the native OpenAI node and native `OpenAI account` credential
- order-status routing now uses a native WooCommerce order lookup branch
- payment-option questions now use a dedicated payment-info branch
- store-info questions now use a dedicated store-info branch
- unsupported requests route to human handoff
- audio transcription still runs from a Code node using a direct OpenAI Whisper API call

Important architecture note:

- WooCommerce is now both native and active inside n8n
- OpenAI reply generation is now native in n8n for the product and general branches
- `OPENAI_API_KEY` is still required in the n8n container for the audio transcription step

## n8n credentials verified

The following native credentials were present and validated in n8n at the time of this snapshot:

- WooCommerce credential: `WooCommerce account`
- WooCommerce credential id: `c1hDGmnfjhyGQV5Q`
- OpenAI credential: `OpenAI account`
- OpenAI credential id: `2ea268dd-5fb0-4080-93f3-3eb29188656c`

Validation outcomes:

- OpenAI credential successfully listed OpenAI models
- WooCommerce credential successfully listed WooCommerce product categories

## Local TLS behavior

Local WooCommerce currently uses `https://woo.local` with a self-signed certificate.

Because of that, the local n8n container uses:

- `N8N_NODE_TLS_REJECT_UNAUTHORIZED=0`

This is only for the local self-signed development setup.

For live servers with a valid certificate chain, use:

- `N8N_NODE_TLS_REJECT_UNAUTHORIZED=1`

## Current limitations

Known current limitations:

- reply generation is native for product, general, order, payment, and store-info branches, but Whisper transcription is still env-based
- audio transcription still uses env-based Whisper inside the normalization Code node
- customer account lookup and refund handling are not fully automated yet
- store-info and payment branches still contain placeholder business facts that should be replaced with real store data before going live
- image-based product matching still goes to human handoff
- account/refund questions still go to human handoff by default

## Recommended next refactor

If you continue this project later, the next high-value refactor is:

1. Move Whisper transcription out of the normalization Code node into a more maintainable n8n-native or helper-node path.
2. Replace the placeholder payment/store-info branch facts with a structured business knowledge source.
3. Add WooCommerce customer lookup for account-specific queries.
4. Add dedicated refund or return automation only if the store has a safe source of truth for those workflows.

## Bootstrap script

Credential bootstrap script:

```bash
./scripts/bootstrap-n8n-credentials.sh
```

This script recreates or updates the fixed credential IDs expected by the workflow export.

## Quick verification commands

Useful checks to rerun later:

```bash
docker compose ps
```

```bash
docker exec whatsapp-n8n n8n export:credentials --all --output=/tmp/exported-creds.json
```

```bash
docker exec whatsapp-n8n n8n export:workflow --id=whatsapp-ai-auto-reply --output=/tmp/current-workflow.json
```

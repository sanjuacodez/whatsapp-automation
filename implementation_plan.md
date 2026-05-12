# WhatsApp AI Auto Reply System (Local MVP)

## Objective

Build a local MVP system that:

1. Connects to WhatsApp using Evolution API
2. Receives incoming WhatsApp messages
3. Sends messages to n8n webhook
4. Uses OpenAI API for generating replies
5. Automatically replies back to the sender
6. Supports:
   - English
   - Malayalam
   - Manglish
   - Hindi and other Indian languages
7. Supports:
   - text messages
   - voice notes (audio transcription)
8. Runs completely locally using Docker

---

# Tech Stack

## Required

- Docker
- Docker Compose
- Evolution API
- n8n
- OpenAI API
- Node.js (if helper scripts needed)

---

# Architecture

WhatsApp
    ↓
Evolution API
    ↓ webhook
n8n
    ↓
OpenAI API
    ↓
Evolution API send message endpoint
    ↓
WhatsApp reply

---

# Requirements

## Evolution API

- Run locally using Docker
- Expose webhook events
- Persist sessions locally
- QR login support
- Support:
  - incoming text
  - incoming audio
  - sending text replies

---

## n8n

- Run locally using Docker
- Create workflow:
  1. Receive webhook from Evolution API
  2. Parse incoming message
  3. Detect message type
  4. If audio:
      - download audio
      - transcribe using OpenAI Whisper
  5. Send user message to OpenAI
  6. Generate response
  7. Send response back using Evolution API

---

# OpenAI Requirements

Use:
- GPT-4o-mini for text responses
- Whisper API for audio transcription

System prompt:

"You are a multilingual WhatsApp assistant.
Reply in the same language used by the customer.
Support Malayalam, Manglish, English, Hindi, Tamil, and Kannada.
Keep responses short, natural, and WhatsApp-friendly.
Do not use markdown.
Do not use formal business language unless user speaks formally.
If user sends Malayalam, reply in Malayalam.
If user sends Manglish, reply in Manglish."

---

# Local Environment

## Folder Structure

project-root/
├── docker-compose.yml
├── .env
├── n8n/
├── evolution/
├── workflows/
└── README.md

---

# Docker Compose Requirements

docker-compose should include:

## Services

### 1. evolution-api
- latest stable image
- persistent volume
- exposed port
- webhook enabled

### 2. n8n
- latest stable image
- persistent storage
- environment variables
- webhook support

Optional:
### 3. postgres
for future conversation memory

---

# Environment Variables

Need support for:

OPENAI_API_KEY=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
N8N_HOST=
N8N_PORT=

---

# Workflow Requirements

## Incoming Message Flow

1. Evolution API sends webhook
2. n8n receives webhook
3. Extract:
   - sender number
   - message text
   - message type
4. If audio:
   - fetch audio URL
   - transcribe audio
5. Send final text to OpenAI
6. Get AI response
7. Call Evolution API send-message endpoint
8. Send reply back to sender

---

# Audio Support

If message type is audio:

- download audio
- use OpenAI Whisper transcription
- use transcription as prompt input

Must support Malayalam voice notes.

---

# Safety Rules

Do not auto reply to:
- messages sent by self
- status updates
- groups

Only reply to direct personal chats.

---

# Logging

Add logs for:
- incoming messages
- OpenAI responses
- transcription results
- send failures

---

# Future Expansion Preparation

Architecture should allow future additions:
- WooCommerce integration
- product search
- payment links
- order tracking
- human handoff
- vector search
- Redis/Postgres memory

---

# Deliverables

Generate:

1. docker-compose.yml
2. .env.example
3. n8n workflow JSON
4. setup instructions
5. webhook configuration guide
6. OpenAI integration setup
7. README.md

---

# Important Notes

- Use clean architecture
- Keep services modular
- Use environment variables everywhere
- Avoid hardcoded URLs
- Ensure restart persistence
- Use async processing where possible
- Create readme.md file mentioning the workflow and setup

---

# Expected MVP Outcome

When someone sends a WhatsApp message:

User:
"Hi"

Bot:
"Hello 👋"

User:
"സാരി ഉണ്ടോ?"

Bot:
"ഉണ്ട് 😊 ഏത് കളർ വേണം?"

User sends Malayalam voice note

Bot transcribes and replies correctly.
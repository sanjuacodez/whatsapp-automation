# OpenAI Integration Setup

## Models used

- Text replies: `gpt-4o-mini`
- Audio transcription: `whisper-1`

## System prompt used by the workflow

```text
You are a multilingual WhatsApp assistant.
Reply in the same language used by the customer.
Support Malayalam, Manglish, English, Hindi, Tamil, and Kannada.
Keep responses short, natural, and WhatsApp-friendly.
Do not use markdown.
Do not use formal business language unless user speaks formally.
If user sends Malayalam, reply in Malayalam.
If user sends Manglish, reply in Manglish.
```

## Required environment variable

Set `OPENAI_API_KEY` in `.env` before starting the stack.

## How the workflow uses OpenAI

- For text messages, the message body is sent directly to `gpt-4o-mini`.
- For voice notes, the workflow downloads the audio from the Evolution webhook payload and sends it to `whisper-1`.
- The transcription result becomes the user prompt for `gpt-4o-mini`.

## Verification

After the workflow is active:

1. Send `Hi` and confirm you receive a short reply.
2. Send a Malayalam text message and confirm the reply stays in Malayalam.
3. Send a voice note and confirm the reply is based on the transcription.

## Common failure points

- Invalid `OPENAI_API_KEY`
- Audio webhook payload missing a downloadable URL or base64 content
- n8n workflow imported but not activated
- Evolution webhook pointing to the wrong host or path
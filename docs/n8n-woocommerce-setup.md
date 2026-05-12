# n8n WooCommerce Setup

This is the preferred WooCommerce setup for live servers.

Instead of storing WooCommerce credentials in `.env`, create them in n8n so deployment stays simpler and safer.

## Why use the n8n-native approach

- WooCommerce credentials are managed in the n8n UI
- server `.env` files stay smaller and easier to maintain
- rotating store credentials does not require container env changes
- later workflow changes can be made directly in n8n using WooCommerce or HTTP Request nodes

## Recommended setup

1. Open the n8n editor.
2. Go to Credentials.
3. Create a new WooCommerce credential.
4. Enter:
   - store URL
   - consumer key
   - consumer secret
5. Save the credential.
6. In your workflow, add a WooCommerce node.
7. Choose:
   - Resource: `Product`
   - Operation: `Get Many`
8. Set `Options -> Search` from the incoming WhatsApp text.
9. Limit the result count to a small number like `3`.
10. Pass the fetched product data into the AI reply step.

## When to use HTTP Request instead

If the built-in WooCommerce node does not cover a specific API call you need, use an HTTP Request node with:

- Authentication: `Predefined Credential Type`
- Credential Type: `WooCommerce`

This keeps authentication managed by n8n while still letting you call custom endpoints.

## Repo note

The current MVP workflow still contains a local fallback that reads WooCommerce values from environment variables. That path works, but it is not the preferred production approach.

The preferred production direction is:

1. WooCommerce credential in n8n
2. WooCommerce node in n8n
3. AI reply step after business data is fetched
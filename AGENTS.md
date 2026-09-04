# Project Security Guidelines

For all future code generation, the following security constraints MUST be strictly enforced:

1. **Secret Management**: All third-party API keys, webhook URLs, and OAuth tokens must be retrieved dynamically via Google Cloud Secret Manager. Do not hardcode or expose them to the client.
2. **Backend Proxying**: The frontend client must never interact with external APIs directly. All external requests must route through the authenticated Cloud Run backend.
3. **Input Validation & Formatting**: Validate and sanitize all incoming payloads from the client before processing them on the server. Validate and format the payload structure correctly (e.g., JSON with embeds for Discord or blocks for Slack) before dispatching the POST request.

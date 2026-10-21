# Friction Log: Echo Chamber Breaker MCP Server Development

This log tracks architectural frictions encountered, protocol nuances resolved, and lessons learned during the build.

### 1. Streamable HTTP Dual-Transport Design
- **Friction**: The official `@modelcontextprotocol/sdk` provides `SSEServerTransport`, which requires clients to open an event-stream connection via `GET /sse` and subsequently POST message payloads to `/mcp/messages?sessionId=...`. However, simple HTTP clients, cURL, and lightweight browser fetch clients often prefer a direct stateless JSON-RPC `POST /mcp` workflow.
- **Solution**: We implemented an elegant dual-routing pattern in `src/mcp/server.ts`:
  1. `SSEServerTransport` handles official persistent MCP connections on `/sse` and `/mcp`.
  2. `handleDirectJsonRpc` handles synchronous JSON-RPC 2.0 requests on `POST /mcp`. Both share the exact same underlying registered tools and schemas.

### 2. Voice UX Constraint Enforcement (< 40 Words)
- **Friction**: LLMs tend to be verbose when asked to steelman arguments, generating 80–120 word spoken paragraphs that overwhelm voice users on Alexa+.
- **Solution**: Implemented a two-tier output format:
  1. A strictly bounded `< 40 words` spoken string in the `say` field.
  2. A structured schema payload containing detailed premises, mechanisms, concessions, and an epistemic inquiry question for screen-enabled devices.
  3. Added an automated test in `tests/ml_calibration.test.ts` to enforce this rule continuously.

### 3. TypeScript Strict Null Checks on Session Cache
- **Friction**: `sessionStore.ts` had a type-inference gap with `LocalStoreData | null` where TypeScript required an explicit non-null assertion or guard after initialization.
- **Solution**: Refined `ensureInitialized` to ensure cached memory data is guaranteed non-null before returning.

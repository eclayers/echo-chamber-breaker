# Echo Chamber Breaker ⚡

> **The anti-sycophant layer for Alexa+**  
> *Self-Hosted Model Context Protocol (MCP) Server • Streamable HTTP • Amazon Bedrock • Epistemic Calibration*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Spec](https://img.shields.io/badge/MCP-2024--11--05-cyan.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock%20Ready-orange.svg)](https://aws.amazon.com/bedrock/)

---

## 💡 The Thesis

Most modern AI assistants are optimized for agreeableness. When a user expresses a strong conviction, the default response is soft agreement or mild hedging. This creates an invisible opinion bubble where opinions harden and reasoning degrades.

**Echo Chamber Breaker** turns Alexa+ (and any standard MCP client) into an **intellectual honesty coach**:
1. **Detects Stance & Blind Spots**: Analyzes conviction, affect, and cognitive unstated assumptions.
2. **Steelmans the Opposing View**: Generates the most charitable, rigorous counter-case with a voice-ready summary under 40 words.
3. **Measures Real Engagement**: Evaluates whether the user grapples with the counter-arguments, concedes points, or dismisses them.
4. **Maintains an Intellectual Honesty Score**: Maintains an append-only, auditable ledger with radar metrics (Openness, Rigor, Humility, Quality, Consistency).

---

## ⚡ Quickstart (Run in 2 Minutes)

Echo Chamber Breaker runs out of the box with zero external dependencies using its built-in cognitive mock mode.

### 1. Install & Build
```bash
git clone https://github.com/your-username/echo-chamber-breaker.git
cd echo-chamber-breaker
npm install
npm run build
```

### 2. Launch Server & Web Simulator
```bash
npm start
```

Open your browser to:
👉 **`http://localhost:3000/simulator`**

---

## 🛠️ MCP Protocol Specification

The server exposes both **Streamable HTTP** endpoints and standard **SSE transports**:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/mcp` | `POST` | Direct JSON-RPC 2.0 endpoint for stateless tool execution and inspection. |
| `/sse` or `/mcp` | `GET` | Streamable HTTP SSE stream establishing real-time MCP sessions. |
| `/mcp/messages` | `POST` | Ingestion endpoint for active SSE transport sessions. |
| `/api/benchmark`| `GET` | Runs ML evaluation benchmark (ECE calibration, Brier score, slice metrics). |
| `/simulator` | `GET` | Real MCP Client Web Simulator with live protocol wire tracing & voice I/O. |

### The 9 Production MCP Tools

1. `analyze_stance`: Evaluates certainty, polarity, cognitive bias, and blind spots.
2. `steelman`: Generates strongest charitable opposing arguments (< 40 words spoken summary + deep screen cards).
3. `record_engagement`: Assesses user reaction to the counter-case and appends to the Honesty Ledger.
4. `start_debate`: Initializes multi-turn dialectical sparring session.
5. `continue_debate`: Advances active debate session with counter-rebuttals.
6. `conclude_debate`: Finalizes debate with reflection notes and net score shift.
7. `honesty_report`: Longitudinal radar dimensions, score status, and recent history.
8. `challenge_me`: Proactively surfaces friction on unexamined topics or past claims.
9. `calibrate_baseline`: Calibrates user baseline honesty score (default: 50.0).

---

## ☁️ Connecting to Amazon Bedrock (AWS Builder Challenge)

By default, the server runs in deterministic cognitive mock mode. To switch to live Bedrock inference:

Edit `.env`:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
# Or use Amazon Nova:
# BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
```

Restart the server:
```bash
npm start
```

---

## 🧪 Testing & Verification

Run the full automated test suite:
```bash
npm test
```

### Test Coverage Highlights
- ✅ **MCP Protocol Handshake**: Validates `initialize`, `tools/list` (9 tools), and `tools/call`.
- ✅ **Voice Brevity Compliance**: Verifies spoken `say` field is strictly $\le$ 40 words.
- ✅ **Honesty Ledger Auditability**: Tests monotonic score delta updates and bounding.
- ✅ **ML Epistemic Calibration**: Computes Expected Calibration Error (ECE) and Brier Score.

---

## 📄 License
MIT License. Built for the Amazon Developer Hackathon 2026.
